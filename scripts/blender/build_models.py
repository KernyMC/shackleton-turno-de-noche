# Modela los módulos de la base lunar en Blender, por script, y los exporta como GLB.
# No abre la ventana de Blender. Uso (desde la raíz del repo):
#
#   npm run models:build              (todos)
#   npm run models:build -- recycler  (uno)
#
# Cada modelo recrea, con formas propias, una imagen de referencia del equipo
# (cúpulas, paneles, tanques, anillos…). Convenciones que el juego espera (src/scene/base.ts):
#   - El modelo se apoya en el suelo (z = 0 en Blender) y está centrado en el origen.
#   - El frente mira hacia -Y de Blender (en el juego queda mirando hacia fuera de la base).
#   - Material "glow": piezas que el juego enciende en ámbar según la energía del módulo.
#   - Material "glass": el juego lo vuelve transparente.
#   - Colores de docs/ARTE.md: casco blanco hueso, detalles gris oscuro. Sin logos ni texto.

import math
import os
import random
import sys

import bmesh
import bpy
from mathutils import Vector

HULL = (0.82, 0.80, 0.74, 1.0)      # blanco hueso
PANEL = (0.62, 0.61, 0.57, 1.0)     # paneles algo más oscuros
DARK = (0.045, 0.045, 0.043, 1.0)   # gris oscuro mecánico
METAL = (0.42, 0.43, 0.45, 1.0)
GOLD = (0.80, 0.50, 0.10, 1.0)      # lámina aislante dorada
LEAF = (0.10, 0.42, 0.12, 1.0)
REGOLITH = (0.30, 0.29, 0.28, 1.0)
SANDBAG = (0.40, 0.39, 0.37, 1.0)
GLOW = (0.02, 0.02, 0.02, 1.0)      # apagado: el juego lo enciende
GLASS = (0.75, 0.90, 0.85, 1.0)
R90 = math.radians(90)


# ---------- utilidades ----------

def reset_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()
    for block in (bpy.data.meshes, bpy.data.materials):
        for item in list(block):
            block.remove(item)


def material(name, color, roughness=0.75, metallic=0.0, emission=0.0):
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
        if emission > 0:
            try:
                bsdf.inputs["Emission Color"].default_value = color
                bsdf.inputs["Emission Strength"].default_value = emission
            except KeyError:
                pass
    return mat


class Mats:
    """Materiales compartidos por todos los modelos."""

    def __init__(self):
        self.hull = material("hull", HULL)
        self.panel = material("panel", PANEL, roughness=0.8)
        self.dark = material("dark", DARK, roughness=0.65, metallic=0.15)
        self.metal = material("metal", METAL, roughness=0.5, metallic=0.35)
        self.glow = material("glow", GLOW, roughness=0.5)
        self.glass = material("glass", GLASS, roughness=0.08)
        self.gold = material("gold", GOLD, roughness=0.45, metallic=0.35)
        self.leaf = material("leaf", LEAF, roughness=0.9)
        self.regolith = material("regolith", REGOLITH, roughness=1.0)
        self.sandbag = material("sandbag", SANDBAG, roughness=1.0)
        self.lamp = material("lamp", (1.0, 0.92, 0.75, 1.0), emission=3.0)


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


def cylinder(radius, depth, loc, mat, verts=40, rot=(0, 0, 0), radius_top=None, bevel=0.0, smooth=True):
    if radius_top is None:
        bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=radius, depth=depth, location=loc, rotation=rot)
    else:
        bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=radius, radius2=radius_top, depth=depth, location=loc, rotation=rot)
    return finish(bpy.context.active_object, mat, smooth=smooth, bevel=bevel)


def sphere(radius, loc, mat, scale=(1, 1, 1), segments=32, rings=16, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, radius=radius, location=loc, rotation=rot)
    obj = bpy.context.active_object
    obj.scale = scale
    return finish(obj, mat)


def box(size, loc, mat, rot=(0, 0, 0), bevel=0.04):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    obj = bpy.context.active_object
    obj.scale = size
    return finish(obj, mat, smooth=False, bevel=bevel)


def torus(major, minor, loc, mat, rot=(0, 0, 0), segments=48, minor_segments=8):
    bpy.ops.mesh.primitive_torus_add(major_radius=major, minor_radius=minor, major_segments=segments, minor_segments=minor_segments, location=loc, rotation=rot)
    return finish(bpy.context.active_object, mat)


def beam(p1, p2, radius, mat, verts=10):
    """Barra cilíndrica entre dos puntos."""
    a, b = Vector(p1), Vector(p2)
    d = b - a
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=radius, depth=d.length, location=(a + b) / 2)
    obj = bpy.context.active_object
    obj.rotation_euler = d.to_track_quat("Z", "Y").to_euler()
    return finish(obj, mat)


def ring_of(count, radius, make, start=0.0):
    """Coloca `count` piezas en círculo; make(x, y, ángulo) crea cada una."""
    for i in range(count):
        a = start + 2 * math.pi * i / count
        make(radius * math.cos(a), radius * math.sin(a), a)


def half_icosphere(radius, subdivisions, loc, scale_z=1.0):
    """Media esfera geodésica (triángulos), abierta por abajo."""
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=subdivisions, radius=radius, location=(0, 0, 0))
    obj = bpy.context.active_object
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.z < -0.02 * radius], context="VERTS")
    bm.to_mesh(obj.data)
    bm.free()
    obj.location = loc
    obj.scale = (1, 1, scale_z)
    return obj


def duplicate(obj):
    copy = obj.copy()
    copy.data = obj.data.copy()
    bpy.context.collection.objects.link(copy)
    return copy


def feet(count, radius, mats, z=0.18):
    ring_of(count, radius, lambda x, y, a: box((0.7, 0.45, 0.36), (x, y, z), mats.metal, rot=(0, 0, a), bevel=0.06))


def export(path):
    bpy.ops.object.select_all(action="SELECT")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", export_apply=True, export_yup=True)
    print(f"EXPORTADO {path} ({os.path.getsize(path) / 1024:.0f} KB)")


# ---------- modelos ----------

def build_recycler(m):
    """Reciclador: torre con cúpula, cinturón de aletas de radiador, puerta y dos tanques."""
    # Base escalonada con patas y rampa.
    cylinder(3.35, 0.3, (0, 0, 0.15), m.dark, bevel=0.04)
    cylinder(3.0, 0.35, (0, 0, 0.45), m.metal, bevel=0.04)
    feet(6, 3.3, m)
    box((1.5, 1.0, 0.14), (0, -3.25, 0.5), m.dark)

    # Torre, hombro y cúpula.
    cylinder(2.7, 2.9, (0, 0, 2.05), m.hull)
    cylinder(2.82, 0.35, (0, 0, 3.6), m.panel, bevel=0.04)
    sphere(2.75, (0, 0, 3.78), m.hull, scale=(1, 1, 0.6), segments=40, rings=20)
    cylinder(0.95, 0.3, (0, 0, 5.4), m.panel, bevel=0.04)
    cylinder(0.75, 0.22, (0, 0, 5.62), m.dark, bevel=0.03)

    # Juntas de paneles.
    for z in (1.2, 2.2):
        torus(2.71, 0.03, (0, 0, z), m.dark)
    ring_of(10, 2.715, lambda x, y, a: box((0.05, 0.05, 2.8), (x, y, 2.05), m.dark, rot=(0, 0, a), bevel=0.0), start=math.radians(18))
    for z in (4.3, 4.85):
        torus(2.75 * math.sqrt(max(0.05, 1 - ((z - 3.78) / 1.65) ** 2)), 0.03, (0, 0, z), m.dark)

    # Cinturón de aletas de radiador bajo la cúpula, con sus dos raíles.
    ring_of(30, 2.98, lambda x, y, a: box((0.42, 0.09, 0.85), (x, y, 3.05), m.metal, rot=(0, 0, a), bevel=0.03))
    for z in (2.8, 3.3):
        torus(2.95, 0.045, (0, 0, z), m.dark)
    # Franja de energía: el juego la enciende en ámbar.
    cylinder(2.74, 0.2, (0, 0, 2.45), m.glow)

    # Puerta al frente (-Y): marco, hoja, ventanilla y manija.
    box((1.75, 0.22, 2.55), (0, -2.66, 1.75), m.dark, bevel=0.18)
    box((1.4, 0.26, 2.2), (0, -2.7, 1.75), m.hull, bevel=0.14)
    box((0.6, 0.08, 0.42), (0, -2.84, 2.3), m.dark, bevel=0.08)
    box((0.12, 0.12, 0.45), (0.45, -2.86, 1.6), m.metal, bevel=0.03)
    for side in (-1, 1):
        box((0.42, 0.06, 0.55), (side * 1.55, -2.3, 1.25), m.dark, bevel=0.02, rot=(0, 0, side * 0.55))

    # Dos tanques esféricos con aro, ojo de buey, soporte y tuberías acodadas hacia la torre.
    for side in (-1, 1):
        x = side * 3.9
        sphere(1.3, (x, 0.2, 2.0), m.hull)
        torus(1.31, 0.045, (x, 0.2, 2.0), m.metal)
        cylinder(0.34, 0.12, (x, -1.08, 2.0), m.metal, rot=(R90, 0, 0), bevel=0.02)
        cylinder(0.24, 0.14, (x, -1.1, 2.0), m.dark, rot=(R90, 0, 0))
        cylinder(1.33, 0.16, (x, 0.2, 1.45), m.glow)
        cylinder(0.6, 0.75, (x, 0.2, 0.42), m.metal, bevel=0.05)
        beam((x, 0.2, 3.25), (x, 0.2, 3.85), 0.16, m.metal)
        beam((x, 0.2, 3.85), (side * 2.55, 0.2, 3.85), 0.16, m.metal)
        sphere(0.19, (x, 0.2, 3.85), m.metal, segments=12, rings=8)
        beam((x, 0.2, 0.9), (side * 2.6, 0.2, 0.9), 0.13, m.metal)
        box((0.45, 0.45, 1.1), (side * 2.95, -0.9, 1.3), m.metal, bevel=0.08)


def build_greenhouse(m):
    """Invernadero: anillo base con paneles, cúpula geodésica de cristal, plantas y esclusa."""
    # Base: zócalo, anillo de paneles, rejillas y patas.
    cylinder(3.85, 0.25, (0, 0, 0.12), m.dark, bevel=0.04)
    cylinder(3.6, 1.15, (0, 0, 0.82), m.hull)
    torus(3.62, 0.07, (0, 0, 0.3), m.metal)
    torus(3.62, 0.09, (0, 0, 1.42), m.metal)
    ring_of(14, 3.62, lambda x, y, a: box((0.05, 0.05, 1.05), (x, y, 0.82), m.dark, rot=(0, 0, a), bevel=0.0))
    ring_of(7, 3.63, lambda x, y, a: box((0.1, 0.62, 0.4), (x, y, 0.85), m.dark, rot=(0, 0, a), bevel=0.03), start=math.radians(13))
    feet(8, 3.85, m)
    # Franja de energía en la base.
    cylinder(3.64, 0.14, (0, 0, 1.22), m.glow)

    # Cúpula geodésica: cristal + estructura de barras (misma malla en alambre).
    dome = half_icosphere(3.45, 2, (0, 0, 1.45), scale_z=0.84)
    frame = duplicate(dome)
    finish(dome, m.glass, smooth=False)
    wire = frame.modifiers.new("wire", "WIREFRAME")
    wire.thickness = 0.085
    finish(frame, m.metal, smooth=False)
    cylinder(0.85, 0.28, (0, 0, 4.42), m.panel, bevel=0.05)
    cylinder(0.6, 0.18, (0, 0, 4.62), m.dark, bevel=0.03)

    # Interior: columna central, dos niveles de bandejas y plantas.
    cylinder(0.22, 2.9, (0, 0, 2.9), m.metal, verts=12)
    for radius, z in ((2.55, 1.62), (1.75, 2.5)):
        cylinder(radius + 0.45, 0.14, (0, 0, z), m.hull, verts=32)
        torus(radius, 0.36, (0, 0, z + 0.32), m.leaf, segments=28, minor_segments=7)
        random.seed(int(radius * 10))
        for i in range(int(radius * 9)):
            a = 2 * math.pi * i / int(radius * 9)
            r = radius + random.uniform(-0.2, 0.2)
            sphere(random.uniform(0.2, 0.3), (r * math.cos(a), r * math.sin(a), z + 0.55 + random.uniform(0, 0.12)), m.leaf, segments=7, rings=5)
    # Luces de cultivo: se encienden con la energía.
    torus(1.9, 0.07, (0, 0, 3.55), m.glow, segments=32)
    torus(0.9, 0.07, (0, 0, 4.05), m.glow, segments=24)

    # Esclusa lateral (+X): cuerpo, aros y puerta octogonal con ventanilla.
    cylinder(1.12, 2.0, (4.45, 0, 1.3), m.hull, rot=(0, R90, 0), verts=8, smooth=False, bevel=0.08)
    for x in (3.75, 5.2):
        torus(1.14, 0.08, (x, 0, 1.3), m.dark, rot=(0, R90, 0), segments=8)
    cylinder(0.85, 0.16, (5.48, 0, 1.3), m.dark, rot=(0, R90, 0), verts=8, smooth=False, bevel=0.04)
    box((0.14, 0.8, 1.35), (5.5, 0, 1.3), m.hull, bevel=0.1)
    box((0.08, 0.38, 0.3), (5.58, 0, 1.6), m.dark, bevel=0.05)
    cylinder(0.75, 0.3, (4.45, 0, 0.15), m.metal, bevel=0.05)


def build_shield(m):
    """Blindaje: base octogonal con rejillas y torre de tres anillos que brillan por debajo."""
    # Base.
    cylinder(3.85, 0.25, (0, 0, 0.12), m.dark, verts=8, smooth=False, bevel=0.05)
    feet(8, 3.7, m)
    cylinder(3.3, 2.0, (0, 0, 1.3), m.hull, verts=8, radius_top=2.75, smooth=False, bevel=0.07)
    cylinder(2.8, 0.25, (0, 0, 2.42), m.metal, verts=8, smooth=False, bevel=0.04)
    cylinder(2.3, 0.55, (0, 0, 2.8), m.panel, verts=8, radius_top=1.5, smooth=False, bevel=0.05)
    # Rejillas y cajas en las caras; mangueras de energía hacia el suelo.
    ring_of(8, 3.06, lambda x, y, a: box((0.14, 1.25, 0.55), (x, y, 1.25), m.dark, rot=(0, 0, a), bevel=0.06), start=math.radians(22.5))
    ring_of(4, 3.15, lambda x, y, a: box((0.5, 0.8, 0.8), (x, y, 1.35), m.panel, rot=(0, 0, a), bevel=0.07), start=math.radians(67.5))
    for a in (math.radians(200), math.radians(250), math.radians(290), math.radians(340)):
        p = Vector((math.cos(a), math.sin(a), 0))
        beam(p * 3.0 + Vector((0, 0, 0.9)), p * 3.9 + Vector((0, 0, 0.22)), 0.2, m.dark)
        beam(p * 3.9 + Vector((0, 0, 0.22)), p * 4.6 + Vector((0, 0, 0.2)), 0.2, m.dark)
    # Franja de energía en la base.
    cylinder(3.08, 0.16, (0, 0, 2.2), m.glow, verts=8, smooth=False)

    # Columna central con pistones.
    cylinder(1.25, 0.9, (0, 0, 3.5), m.metal, bevel=0.05)
    cylinder(0.75, 5.0, (0, 0, 6.3), m.hull)
    for z in (4.6, 6.2, 7.6):
        cylinder(0.83, 0.3, (0, 0, z), m.metal, bevel=0.03)
    ring_of(4, 1.0, lambda x, y, a: cylinder(0.26, 1.5, (x, y, 4.0), m.metal, verts=14, bevel=0.03), start=math.radians(45))

    # Tres anillos emisores: aro blanco, luz ámbar por debajo y brazos a la columna.
    for radius, z in ((3.1, 5.35), (2.25, 7.0), (1.5, 8.35)):
        torus(radius, 0.24, (0, 0, z), m.hull, segments=56, minor_segments=6)
        torus(radius, 0.1, (0, 0, z - 0.26), m.glow, segments=56, minor_segments=6)
        torus(radius - 0.26, 0.05, (0, 0, z + 0.05), m.metal, segments=48)
        ring_of(6, 1.0, lambda x, y, a, r=radius, zz=z: beam((0.75 * math.cos(a), 0.75 * math.sin(a), zz - 0.9), (r * math.cos(a), r * math.sin(a), zz - 0.1), 0.07, m.metal))
        ring_of(12, radius, lambda x, y, a, zz=z: box((0.12, 0.5, 0.52), (x, y, zz), m.metal, rot=(0, 0, a), bevel=0.02))

    # Aguja superior.
    cylinder(0.55, 0.5, (0, 0, 8.95), m.metal, bevel=0.04)
    cylinder(0.42, 0.3, (0, 0, 9.3), m.glow)
    cylinder(0.4, 0.9, (0, 0, 9.9), m.hull, radius_top=0.08)
    cylinder(0.04, 0.7, (0, 0, 10.65), m.metal, verts=8)


def build_workshop(m):
    """Taller: hangar de techo curvo, portón de lamas, brazo grúa, tuberías, cajas y rueda."""
    width, length = 6.4, 7.6
    front = -length / 2
    # Cuerpo y techo de cañón.
    box((width + 0.15, length + 0.15, 0.4), (0, 0, 0.2), m.panel, bevel=0.06)
    wall_top = 3.3
    box((width, length, wall_top - 0.4), (0, 0, 0.4 + (wall_top - 0.4) / 2), m.hull, bevel=0.1)
    roof = cylinder(width / 2, length, (0, 0, wall_top), m.hull, rot=(R90, 0, 0), verts=48)
    roof.scale = (1, 1, 0.5)  # arco rebajado (el eje local Z es el largo; se aplasta en altura)
    roof.scale = (1, 0.5, 1)
    for y in (front + 0.05, -1.3, 1.3, -front - 0.05):
        rib = torus(width / 2 + 0.02, 0.08, (0, y, wall_top), m.panel, rot=(R90, 0, 0), segments=48)
        rib.scale = (1, 0.5, 1)
    # Paneles laterales acolchados.
    for side in (-1, 1):
        for y in (-2.5, 0, 2.5):
            box((0.08, 2.2, 1.6), (side * (width / 2 + 0.01), y, 1.55), m.panel, bevel=0.1)

    # Frente: marco, portón de lamas, rejilla, asas y luz de trabajo.
    box((3.9, 0.3, 3.2), (0, front - 0.05, 1.75), m.dark, bevel=0.14)
    for i in range(13):
        box((3.3, 0.1, 0.17), (0, front - 0.2, 0.42 + i * 0.215), m.metal, bevel=0.03)
    box((1.3, 0.1, 0.5), (0, front - 0.12, 4.05), m.dark, bevel=0.04)
    for side in (-1, 1):
        beam((side * 2.35, front - 0.18, 0.9), (side * 2.35, front - 0.18, 2.4), 0.06, m.metal)
    box((3.9, 0.12, 0.2), (0, front - 0.12, 3.5), m.glow, bevel=0.03)

    # Tuberías a lo largo del lado derecho y cuadro eléctrico.
    for z in (2.55, 2.78, 3.0):
        beam((width / 2 + 0.14, front + 2.2, z), (width / 2 + 0.14, -front, z), 0.075, m.metal)
        beam((width / 2 + 0.14, front + 2.2, z), (width / 2 - 0.5, front + 2.2, z + 1.5), 0.075, m.metal)
    box((0.16, 1.1, 0.7), (width / 2 + 0.06, 2.6, 1.2), m.dark, bevel=0.04)
    box((0.3, 0.45, 0.6), (width / 2 + 0.12, 0.9, 0.95), m.panel, bevel=0.05)
    band = cylinder(width / 2 + 0.03, 0.22, (0, 0, wall_top), m.glow, rot=(R90, 0, 0), verts=48)
    band.scale = (1, 0.5, 1)

    # Brazo grúa sobre el techo: pedestal, dos tramos, codo y pinza.
    base = Vector((1.3, -1.6, 4.85))
    box((0.9, 0.9, 0.5), base, m.panel, bevel=0.08)
    cylinder(0.32, 0.7, base + Vector((0, 0, 0.55)), m.metal, bevel=0.04)
    shoulder = base + Vector((0, 0, 0.95))
    elbow = shoulder + Vector((2.3, 0.3, 1.1))
    wrist = elbow + Vector((2.1, 0.2, -0.5))
    for a, b in ((shoulder, elbow), (elbow, wrist)):
        beam(a, b, 0.15, m.hull)
    for joint in (shoulder, elbow, wrist):
        sphere(0.24, joint, m.metal, segments=14, rings=8)
    beam(wrist, wrist + Vector((0, 0, -0.8)), 0.09, m.metal)
    box((0.34, 0.3, 0.3), wrist + Vector((0, 0, -0.95)), m.dark, bevel=0.05)
    for dx in (-0.14, 0.14):
        box((0.07, 0.2, 0.4), wrist + Vector((dx, 0, -1.25)), m.metal, bevel=0.02)

    # Cajas de herramientas junto al portón y rueda de repuesto apoyada.
    for size, loc in (((1.3, 0.8, 0.55), (2.9, front - 0.9, 0.28)), ((0.8, 0.6, 0.5), (2.75, front - 0.85, 0.8)), ((0.6, 0.45, 0.4), (3.9, front - 0.5, 0.2))):
        box(size, loc, m.metal, bevel=0.06)
    torus(0.72, 0.3, (width / 2 + 0.75, -1.9, 0.98), m.dark, rot=(0, math.radians(72), 0), segments=28)
    cylinder(0.42, 0.34, (width / 2 + 0.75, -1.9, 0.98), m.metal, rot=(0, math.radians(72), 0), bevel=0.04)


def build_shelter(m):
    """Refugio: montículo de sacos de regolito con un túnel de entrada y escotilla blindada."""
    random.seed(7)
    # Montículo de regolito.
    sphere(4.3, (0, 0.6, 0), m.regolith, scale=(1.05, 1.0, 0.66), segments=40, rings=20)
    # Sacos apilados en hileras sobre el montículo.
    for row in range(8):
        lat = math.radians(6 + row * 11)
        count = max(4, int(26 * math.cos(lat)))
        for i in range(count):
            a = 2 * math.pi * (i + 0.5 * (row % 2)) / count
            # Se deja libre el frente (-Y), donde está la entrada.
            if row < 5 and math.cos(a + R90) > 0.72:
                continue
            r = 4.35 * math.cos(lat)
            pos = (1.05 * r * math.cos(a), 0.6 + r * math.sin(a), 4.35 * 0.66 * math.sin(lat))
            normal = Vector((math.cos(lat) * math.cos(a), math.cos(lat) * math.sin(a), math.sin(lat)))
            bag = sphere(0.66, pos, m.sandbag, scale=(1.0, 0.64, 0.34), segments=10, rings=6)
            bag.rotation_euler = normal.to_track_quat("Z", "X").to_euler()
            bag.location.z += random.uniform(-0.03, 0.05)

    # Túnel de entrada al frente y su marco.
    box((2.9, 3.2, 1.5), (0, -3.5, 0.75), m.hull, bevel=0.12)
    cylinder(1.45, 3.2, (0, -3.5, 1.5), m.hull, rot=(R90, 0, 0), verts=40)
    for y in (-2.1, -3.5, -5.05):
        torus(1.47, 0.07, (0, y, 1.5), m.panel, rot=(R90, 0, 0), segments=40)
    box((3.0, 3.3, 0.3), (0, -3.5, 0.15), m.panel, bevel=0.05)

    # Escotilla blindada: aro, hoja, volante, bisagra y cerrojos.
    cylinder(1.36, 0.2, (0, -5.15, 1.5), m.dark, rot=(R90, 0, 0), bevel=0.04)
    cylinder(1.08, 0.26, (0, -5.2, 1.5), m.hull, rot=(R90, 0, 0), bevel=0.05)
    torus(1.36, 0.075, (0, -5.27, 1.5), m.glow, rot=(R90, 0, 0), segments=40)
    torus(0.36, 0.05, (0, -5.4, 1.5), m.metal, rot=(R90, 0, 0), segments=24)
    cylinder(0.12, 0.2, (0, -5.38, 1.5), m.metal, rot=(R90, 0, 0))
    for a in range(3):
        ang = a * 2 * math.pi / 3
        beam((0, -5.4, 1.5), (0.36 * math.cos(ang), -5.4, 1.5 + 0.36 * math.sin(ang)), 0.03, m.metal, verts=6)
    box((0.7, 0.22, 1.1), (-1.25, -5.25, 1.5), m.dark, bevel=0.06)
    box((0.16, 0.2, 2.0), (0, -5.36, 1.5), m.metal, bevel=0.03)
    for z in (0.85, 2.15):
        torus(0.16, 0.04, (0.5, -5.38, z), m.metal, rot=(R90, 0, 0), segments=14)

    # Respiraderos y cuadro eléctrico.
    for x, y in ((0.9, -2.6), (-0.3, -4.3)):
        cylinder(0.26, 0.9, (x, y, 3.2), m.hull, verts=16, bevel=0.03)
        cylinder(0.32, 0.18, (x, y, 3.7), m.metal, verts=16)
    box((0.5, 0.2, 0.55), (1.55, -4.6, 0.75), m.panel, bevel=0.04)


def build_rover(m):
    """Rover presurizado: cabina con ventanas, cuerpo cilíndrico, 6 ruedas de malla, antena y taladro."""
    front = -1
    # Chasis, parachoques y suspensión.
    box((2.3, 6.0, 0.35), (0, 0.2, 1.15), m.dark, bevel=0.06)
    box((2.9, 0.4, 0.45), (0, -3.15, 1.05), m.metal, bevel=0.1)
    box((1.6, 0.25, 0.2), (0, -3.32, 1.05), m.dark, bevel=0.04)
    # Seis ruedas de malla metálica.
    for side in (-1, 1):
        for y in (-2.1, 0.5, 2.6):
            x = side * 1.75
            torus(0.72, 0.26, (x, y, 0.98), m.metal, rot=(0, R90, 0), segments=28, minor_segments=8)
            torus(0.72, 0.28, (x, y, 0.98), m.dark, rot=(0, R90, 0), segments=14, minor_segments=5)
            cylinder(0.3, 0.42, (x, y, 0.98), m.panel, rot=(0, R90, 0), verts=18, bevel=0.04)
            for k in range(8):
                ang = k * math.pi / 4
                beam((x, y, 0.98), (x, y + 0.66 * math.cos(ang), 0.98 + 0.66 * math.sin(ang)), 0.02, m.metal, verts=5)
            beam((side * 0.9, y, 1.25), (x - side * 0.25, y, 0.98), 0.09, m.metal)
            cylinder(0.14, 0.7, (side * 1.15, y, 1.55), m.metal, rot=(0, side * math.radians(25), 0), verts=12)

    # Cuerpo presurizado (cilindro a lo largo) con aros y escotilla lateral.
    cylinder(1.55, 3.4, (0, 0.9, 2.75), m.hull, rot=(R90, 0, 0), verts=40)
    for y in (-0.75, 0.9, 2.55):
        torus(1.57, 0.06, (0, y, 2.75), m.panel, rot=(R90, 0, 0), segments=40)
    box((0.1, 1.0, 1.7), (1.52, 0.9, 2.6), m.panel, bevel=0.12)
    box((0.08, 0.34, 0.32), (1.57, 0.9, 3.1), m.dark, bevel=0.05)
    for y in (0.25, 1.55):
        beam((1.62, y, 2.0), (1.62, y, 3.2), 0.04, m.metal, verts=6)

    # Cabina delantera con parabrisas partido, ventanas bajas y laterales.
    box((2.9, 1.9, 2.3), (0, -1.9, 2.45), m.hull, bevel=0.3)
    for side in (-1, 1):
        box((1.15, 0.12, 0.85), (side * 0.66, -2.82, 2.95), m.dark, bevel=0.08, rot=(math.radians(-12), 0, 0))
        box((1.05, 0.12, 0.5), (side * 0.66, -2.87, 2.05), m.dark, bevel=0.08)
        box((0.12, 1.1, 0.8), (side * 1.46, -1.95, 2.95), m.dark, bevel=0.08)
        box((0.28, 0.18, 0.3), (side * 1.15, -2.95, 1.5), m.panel, bevel=0.05)
        cylinder(0.11, 0.06, (side * 1.15, -3.06, 1.5), m.lamp, rot=(R90, 0, 0), verts=14)
    # Barra de luces en el techo.
    box((1.5, 0.4, 0.3), (0, -2.3, 3.78), m.panel, bevel=0.06)
    for x in (-0.5, -0.17, 0.17, 0.5):
        cylinder(0.1, 0.06, (x, -2.52, 3.78), m.lamp, rot=(R90, 0, 0), verts=14)
    beam((-1.3, -2.6, 3.62), (1.3, -2.6, 3.62), 0.04, m.metal, verts=6)

    # Plataforma trasera: equipos, antena parabólica y brazo con taladro.
    box((2.2, 1.3, 0.9), (0, 3.0, 1.85), m.panel, bevel=0.08)
    box((0.9, 0.7, 0.8), (0.4, 3.0, 2.7), m.hull, bevel=0.06)
    beam((-0.6, 2.8, 2.3), (-0.6, 2.8, 4.3), 0.06, m.metal, verts=8)
    cylinder(0.85, 0.3, (-0.6, 2.75, 4.5), m.panel, rot=(math.radians(55), 0, math.radians(20)), radius_top=0.1, verts=28)
    shoulder = Vector((0.7, 3.5, 2.3))
    elbow = shoulder + Vector((0.2, 0.9, 1.5))
    tip = elbow + Vector((0.1, 1.0, -0.9))
    beam(shoulder, elbow, 0.1, m.hull)
    beam(elbow, tip, 0.09, m.hull)
    for joint in (shoulder, elbow, tip):
        sphere(0.17, joint, m.metal, segments=12, rings=8)
    box((0.3, 0.3, 0.4), tip + Vector((0, 0, -0.2)), m.panel, bevel=0.05)
    cylinder(0.2, 0.75, tip + Vector((0, 0, -0.75)), m.metal, radius_top=0.02, rot=(math.radians(180), 0, 0), verts=14)
    _ = front


def build_lander(m):
    """Módulo de aterrizaje: cabina blanca, etapa de descenso dorada, 4 patas, escalera y motor."""
    stage_z = 2.6
    # Etapa de descenso octogonal con lámina dorada y paneles oscuros.
    cylinder(2.5, 1.6, (0, 0, stage_z), m.gold, verts=8, smooth=False, bevel=0.05, rot=(0, 0, math.radians(22.5)))
    cylinder(2.55, 0.14, (0, 0, stage_z + 0.82), m.dark, verts=8, smooth=False, rot=(0, 0, math.radians(22.5)))
    cylinder(2.55, 0.14, (0, 0, stage_z - 0.82), m.dark, verts=8, smooth=False, rot=(0, 0, math.radians(22.5)))
    ring_of(4, 2.33, lambda x, y, a: box((0.12, 1.5, 1.2), (x, y, stage_z), m.dark, rot=(0, 0, a), bevel=0.03), start=math.radians(45))
    # Motor de descenso.
    cylinder(0.95, 1.0, (0, 0, 1.35), m.dark, radius_top=0.4, verts=28)
    # Tanques al frente-derecha.
    for x in (1.0, 1.75):
        cylinder(0.3, 0.8, (x, -2.35, stage_z - 0.1), m.metal, verts=16)
        sphere(0.3, (x, -2.35, stage_z + 0.3), m.metal, segments=14, rings=8)
        sphere(0.3, (x, -2.35, stage_z - 0.5), m.metal, segments=14, rings=8)

    # Cuatro patas con puntal, tirantes y plato de apoyo.
    for sx, sy in ((1, 1), (1, -1), (-1, 1), (-1, -1)):
        top = Vector((sx * 1.75, sy * 1.75, stage_z + 0.6))
        knee = Vector((sx * 2.9, sy * 2.9, 1.6))
        foot = Vector((sx * 3.5, sy * 3.5, 0.22))
        beam(top, knee, 0.11, m.metal)
        beam(knee, foot, 0.09, m.metal)
        beam(Vector((sx * 1.75, sy * 1.75, stage_z - 0.7)), knee, 0.07, m.gold)
        beam(Vector((sx * 2.3, sy * 0.9, stage_z - 0.6)), knee, 0.045, m.metal)
        beam(Vector((sx * 0.9, sy * 2.3, stage_z - 0.6)), knee, 0.045, m.metal)
        cylinder(0.62, 0.14, (foot.x, foot.y, 0.1), m.panel, radius_top=0.75, verts=24)
        sphere(0.15, foot, m.metal, segments=10, rings=6)

    # Cabina de ascenso: cuerpo abombado con paneles, escotilla, ventanilla y tapa.
    cabin_z = 5.05
    sphere(2.1, (0, 0, cabin_z), m.hull, scale=(1, 1, 0.8), segments=10, rings=8)
    torus(2.1, 0.035, (0, 0, cabin_z), m.dark, segments=10)
    cylinder(0.9, 0.2, (0, 0, cabin_z + 1.66), m.panel, bevel=0.04)
    cylinder(0.35, 0.12, (0, 0, cabin_z + 1.8), m.dark)
    box((0.95, 0.2, 1.15), (0, -2.0, cabin_z - 0.45), m.panel, bevel=0.14)
    box((0.42, 0.14, 0.4), (-0.75, -1.9, cabin_z + 0.55), m.dark, bevel=0.08)
    # Estructura entre la etapa y la cabina.
    ring_of(4, 1.7, lambda x, y, a: beam((x, y, stage_z + 0.8), (x * 0.72, y * 0.72, cabin_z - 1.3), 0.05, m.metal), start=math.radians(45))
    ring_of(4, 1.7, lambda x, y, a: beam((x, y, stage_z + 0.8), (y * 0.72, -x * 0.72, cabin_z - 1.3), 0.03, m.metal), start=math.radians(45))

    # Propulsores de maniobra a los lados (bloque con toberas).
    for side in (-1, 1):
        block = Vector((side * 2.25, 0, cabin_z + 0.35))
        box((0.5, 0.45, 0.5), block, m.panel, bevel=0.06)
        for d in (Vector((side, 0, 0)), Vector((0, 0, 1)), Vector((0, 0, -1)), Vector((0, -1, 0))):
            beam(block + d * 0.2, block + d * 0.55, 0.11, m.metal, verts=10)

    # Plataforma y escalera al frente.
    box((1.3, 0.9, 0.08), (0, -2.75, stage_z + 0.85), m.metal, bevel=0.02)
    for x in (-0.36, 0.36):
        beam((x, -3.1, stage_z + 0.85), (x, -3.95, 0.35), 0.045, m.panel, verts=8)
        beam((x, -3.15, stage_z + 0.85), (x, -3.15, stage_z + 1.65), 0.03, m.panel, verts=6)
    for i in range(9):
        t = (i + 0.5) / 9
        y = -3.1 + (-3.95 + 3.1) * t
        z = stage_z + 0.85 + (0.35 - stage_z - 0.85) * t
        beam((-0.36, y, z), (0.36, y, z), 0.03, m.panel, verts=6)

    # Antenas.
    beam((-1.3, 0.9, cabin_z + 1.2), (-2.0, 1.2, cabin_z + 1.9), 0.03, m.metal, verts=6)
    cylinder(0.36, 0.14, (-2.05, 1.22, cabin_z + 1.95), m.panel, radius_top=0.05, rot=(math.radians(-40), math.radians(30), 0), verts=18)
    beam((1.2, 0.8, cabin_z + 1.2), (1.2, 0.8, cabin_z + 2.5), 0.025, m.metal, verts=6)


MODELS = {
    "recycler": build_recycler,
    "greenhouse": build_greenhouse,
    "shield": build_shield,
    "workshop": build_workshop,
    "shelter": build_shelter,
    "rover": build_rover,
    "lander": build_lander,
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
        MODELS[name](Mats())
        export(os.path.join(out_dir, f"{name}.glb"))


main()
