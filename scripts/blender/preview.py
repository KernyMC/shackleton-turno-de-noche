# Saca una imagen de vista previa de un GLB, para revisarlo sin abrir Blender ni el juego.
# Uso:  blender --background --factory-startup --python scripts/blender/preview.py -- modelo.glb salida.png

import math
import sys

import bpy
from mathutils import Vector

args = sys.argv[sys.argv.index("--") + 1:]
source, target = args[0], args[1]

bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete()
bpy.ops.import_scene.gltf(filepath=source)

# Como en el juego: el cristal es transparente y las piezas "glow" brillan en ámbar.
for mat in bpy.data.materials:
    bsdf = mat.node_tree.nodes.get("Principled BSDF") if mat.use_nodes else None
    if not bsdf:
        continue
    if mat.name.startswith("glass"):
        bsdf.inputs["Alpha"].default_value = 0.22
        try:
            mat.surface_render_method = "BLENDED"
        except Exception:
            mat.blend_method = "BLEND"
    if mat.name.startswith("glow"):
        try:
            bsdf.inputs["Emission Color"].default_value = (1.0, 0.45, 0.08, 1.0)
            bsdf.inputs["Emission Strength"].default_value = 6.0
        except KeyError:
            pass

# Caja que contiene el modelo, para encuadrar.
points = [obj.matrix_world @ Vector(corner) for obj in bpy.context.scene.objects if obj.type == "MESH" for corner in obj.bound_box]
low = Vector((min(p.x for p in points), min(p.y for p in points), min(p.z for p in points)))
high = Vector((max(p.x for p in points), max(p.y for p in points), max(p.z for p in points)))
center = (low + high) / 2
size = max((high - low).length, 1.0)

# Suelo gris, sol rasante y relleno suave: parecido a la luz del juego.
bpy.ops.mesh.primitive_plane_add(size=size * 8, location=(center.x, center.y, low.z))
ground = bpy.data.materials.new("ground")
ground.diffuse_color = (0.25, 0.25, 0.24, 1)
bpy.context.active_object.data.materials.append(ground)

bpy.ops.object.light_add(type="SUN", rotation=(math.radians(62), 0, math.radians(-35)))
bpy.context.active_object.data.energy = 4.0
bpy.context.scene.world = bpy.data.worlds.new("w")
bpy.context.scene.world.color = (0.05, 0.05, 0.055)

bpy.ops.object.camera_add()
camera = bpy.context.active_object
direction = Vector((0.9, -1.25, 0.62)).normalized()
camera.location = center + direction * size * 1.35
camera.rotation_euler = (center - camera.location).to_track_quat("-Z", "Y").to_euler()
bpy.context.scene.camera = camera

scene = bpy.context.scene
for engine in ("BLENDER_EEVEE_NEXT", "BLENDER_EEVEE", "BLENDER_WORKBENCH"):
    try:
        scene.render.engine = engine
        break
    except TypeError:
        continue
scene.render.resolution_x = 760
scene.render.resolution_y = 560
scene.render.filepath = target
bpy.ops.render.render(write_still=True)
print("PREVIEW", target, scene.render.engine)
