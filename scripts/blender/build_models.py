# Modela los módulos de la base lunar en Blender, por script, y los exporta como GLB.
# No abre la ventana de Blender. Uso (desde la raíz del repo):
#
#   "E:\USERS\KEVIN\Blender\blender.exe" --background --factory-startup \
#       --python scripts/blender/build_models.py -- public/models recycler
#
# Sin nombre de modelo construye todos los disponibles. Convenciones que el juego espera
# (src/scene/base.ts):
#   - El modelo se apoya en el suelo (z = 0 en Blender) y está centrado en el origen.
#   - El frente mira hacia -Y de Blender (en el juego queda mirando hacia fuera de la base).
#   - Las piezas con el material llamado "glow" se encienden en ámbar según la energía.
#   - Colores de docs/ARTE.md: casco blanco hueso, detalles gris oscuro. Sin logos ni texto.

import math
import os
import sys

import bpy

HULL = (0.82, 0.80, 0.74, 1.0)      # blanco hueso (#D9D4C7 aprox. en lineal)
HULL_2 = (0.62, 0.61, 0.57, 1.0)    # paneles algo más oscuros
DARK = (0.045, 0.045, 0.043, 1.0)   # gris oscuro mecánico
METAL = (0.35, 0.36, 0.38, 1.0)
GLOW = (0.02, 0.02, 0.02, 1.0)      # apagado: el juego lo enciende


# ---------- utilidades ----------

def reset_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()
    for block in (bpy.data.meshes, bpy.data.materials):
        for item in list(block):
            block.remove(item)


def material(name, color, roughness=0.75, metallic=0.0):
    mat = bpy.data.materials.get(name)
    if mat:
        return mat
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = color
        bsdf.inputs["Roughness"].default_value = roughness
        bsdf.inputs["Metallic"].default_value = metallic
    return mat


def finish(obj, mat, smooth=True, bevel=0.0):
    """Asigna material, suaviza y (opcional) bisela los cantos."""
    obj.data.materials.clear()
    obj.data.materials.append(mat)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    if bevel > 0:
        mod = obj.modifiers.new("bevel", "BEVEL")
        mod.width = bevel
        mod.segments = 2
        mod.limit_method = "ANGLE"
    if smooth:
        try:
            bpy.ops.object.shade_auto_smooth(angle=math.radians(40))
        except Exception:
            bpy.ops.object.shade_smooth()
    obj.select_set(False)
    return obj


def cylinder(radius, depth, loc, mat, verts=48, rot=(0, 0, 0), radius_top=None, bevel=0.0, smooth=True):
    if radius_top is None:
        bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=radius, depth=depth, location=loc, rotation=rot)
    else:
        bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=radius, radius2=radius_top, depth=depth, location=loc, rotation=rot)
    return finish(bpy.context.active_object, mat, smooth=smooth, bevel=bevel)


def sphere(radius, loc, mat, scale=(1, 1, 1), segments=40, rings=20):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, radius=radius, location=loc)
    obj = bpy.context.active_object
    obj.scale = scale
    return finish(obj, mat)


def box(size, loc, mat, rot=(0, 0, 0), bevel=0.04):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    obj = bpy.context.active_object
    obj.scale = size
    return finish(obj, mat, smooth=False, bevel=bevel)


def torus(major, minor, loc, mat, rot=(0, 0, 0), segments=64):
    bpy.ops.mesh.primitive_torus_add(major_radius=major, minor_radius=minor, major_segments=segments, minor_segments=10, location=loc, rotation=rot)
    return finish(bpy.context.active_object, mat)


def ring_of(count, radius, z, make):
    """Coloca `count` piezas en círculo; make(x, y, ángulo) crea cada una."""
    for i in range(count):
        a = 2 * math.pi * i / count
        make(radius * math.cos(a), radius * math.sin(a), a)


def export(path):
    bpy.ops.object.select_all(action="SELECT")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", export_apply=True, export_yup=True)
    print(f"EXPORTADO {path} ({os.path.getsize(path) / 1024:.0f} KB)")


# ---------- modelos ----------

def build_recycler():
    """Reciclador: torre de soporte vital con cúpula, dos tanques, radiadores y escotilla."""
    hull = material("hull", HULL)
    panel = material("panel", HULL_2, roughness=0.8)
    dark = material("dark", DARK, roughness=0.6, metallic=0.3)
    metal = material("metal", METAL, roughness=0.4, metallic=0.9)
    glow = material("glow", GLOW, roughness=0.5)

    # Zócalo, torre y cúpula.
    cylinder(3.05, 0.5, (0, 0, 0.25), dark, bevel=0.05)
    cylinder(2.7, 3.3, (0, 0, 2.1), hull)
    sphere(2.7, (0, 0, 3.75), hull, scale=(1, 1, 0.62))
    cylinder(0.9, 0.35, (0, 0, 5.42), panel, bevel=0.04)
    cylinder(0.5, 0.5, (0, 0, 5.75), dark, bevel=0.04)

    # Juntas de paneles: aros finos y montantes verticales.
    for z in (1.0, 2.0, 3.0):
        torus(2.71, 0.035, (0, 0, z), dark)
    ring_of(12, 2.72, 0, lambda x, y, a: box((0.06, 0.06, 3.2), (x, y, 2.1), dark, rot=(0, 0, a), bevel=0.0))

    # Franja de energía: el juego la enciende en ámbar.
    cylinder(2.76, 0.28, (0, 0, 3.55), glow, smooth=True)

    # Aletas de radiador en la parte trasera y los lados (no tapan la escotilla del frente).
    # El frente es -Y; la espalda es +Y (90°). Las aletas ocupan un arco de 110° centrado atrás.
    for i in range(11):
        a = math.radians(35 + i * 11)
        box((0.7, 0.05, 1.3), (3.0 * math.cos(a), 3.0 * math.sin(a), 1.75), metal, rot=(0, 0, a), bevel=0.01)

    # Escotilla al frente (-Y) con su marco.
    cylinder(0.85, 0.22, (0, -2.68, 1.35), panel, rot=(math.radians(90), 0, 0), bevel=0.03)
    torus(0.9, 0.07, (0, -2.72, 1.35), dark, rot=(math.radians(90), 0, 0))
    cylinder(0.16, 0.12, (0, -2.84, 1.35), metal, rot=(math.radians(90), 0, 0))
    box((1.4, 0.9, 0.12), (0, -3.3, 0.5), dark)  # rampa

    # Dos tanques esféricos (agua y oxígeno) con correas, soporte y tubería a la torre.
    for side in (-1, 1):
        x = side * 3.75
        sphere(1.25, (x, 0.6, 1.6), hull)
        torus(1.26, 0.05, (x, 0.6, 1.6), dark, rot=(math.radians(90), 0, 0))
        torus(1.26, 0.05, (x, 0.6, 1.6), dark, rot=(0, math.radians(90), 0))
        cylinder(1.29, 0.2, (x, 0.6, 1.6), glow)
        cylinder(0.75, 0.4, (x, 0.6, 0.2), dark, bevel=0.04)
        cylinder(0.14, 1.3, (side * 2.85, 0.6, 2.2), metal, rot=(0, math.radians(90), 0))
        cylinder(0.1, 1.2, (side * 2.9, 0.6, 1.0), metal, rot=(0, math.radians(90), 0))
        cylinder(0.2, 0.25, (x, 0.6, 2.95), metal, bevel=0.03)

    # Antena.
    cylinder(0.05, 1.4, (0.9, 0.9, 5.6), metal, verts=12)
    sphere(0.12, (0.9, 0.9, 6.3), glow)


MODELS = {
    "recycler": build_recycler,
}


def main():
    args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    out_dir = os.path.abspath(args[0]) if args else os.path.abspath("public/models")
    names = args[1:] or list(MODELS)
    for name in names:
        if name not in MODELS:
            print(f"Modelo desconocido: {name}. Disponibles: {', '.join(MODELS)}")
            continue
        reset_scene()
        MODELS[name]()
        export(os.path.join(out_dir, f"{name}.glb"))


main()
