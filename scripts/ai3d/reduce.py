# Reduce una malla generada por IA (Hunyuan3D, TRELLIS…) a pocos triángulos para el juego.
# Uso:  npm run models:reduce -- entrada.glb salida.glb [triangulos]      (por defecto 20000)
# Pasos: une mallas, limpia vértices duplicados, remalla por vóxeles (cierra la malla y la deja
# regular; sin esto "Decimate" se atasca con los bordes sueltos que deja la IA), reduce hasta el
# objetivo, suaviza normales y deja el origen en el centro de la base.

import sys

import bpy
from mathutils import Matrix, Vector

args = sys.argv[sys.argv.index("--") + 1:]
source, target = args[0], args[1]
goal = int(args[2]) if len(args) > 2 else 20000

bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete()
bpy.ops.import_scene.gltf(filepath=source)

meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
bpy.ops.object.select_all(action="DESELECT")
for o in meshes:
    o.select_set(True)
bpy.context.view_layer.objects.active = meshes[0]
if len(meshes) > 1:
    bpy.ops.object.join()
obj = bpy.context.view_layer.objects.active

before = sum(len(p.vertices) - 2 for p in obj.data.polygons)

bpy.ops.object.mode_set(mode="EDIT")
bpy.ops.mesh.select_all(action="SELECT")
bpy.ops.mesh.remove_doubles(threshold=0.0001)
bpy.ops.mesh.delete_loose()
bpy.ops.object.mode_set(mode="OBJECT")

# Remallado por vóxeles: ~110 celdas en el lado más largo.
obj.data.remesh_voxel_size = max(obj.dimensions) / 110.0
obj.data.remesh_voxel_adaptivity = 0.0
bpy.ops.object.voxel_remesh()

tris = sum(len(p.vertices) - 2 for p in obj.data.polygons)
mod = obj.modifiers.new("reducir", "DECIMATE")
mod.ratio = min(1.0, goal / max(tris, 1))
bpy.ops.object.modifier_apply(modifier="reducir")

bpy.ops.object.shade_smooth()
points = [obj.matrix_world @ Vector(c) for c in obj.bound_box]
low = Vector((min(p.x for p in points), min(p.y for p in points), min(p.z for p in points)))
high = Vector((max(p.x for p in points), max(p.y for p in points), max(p.z for p in points)))
obj.data.transform(Matrix.Translation(-Vector(((low.x + high.x) / 2, (low.y + high.y) / 2, low.z))))

after = sum(len(p.vertices) - 2 for p in obj.data.polygons)
bpy.ops.export_scene.gltf(filepath=target, export_format="GLB")
print(f"Reducido: {before} -> {after} triángulos, medidas {tuple(round(v, 3) for v in obj.dimensions)}")
