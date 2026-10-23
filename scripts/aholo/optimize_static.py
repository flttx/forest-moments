"""Conservative first decimation trial for approved static silhouettes only.

Run inside factory-startup Blender. Keeps raw files and UV/material assignments;
does not claim retopology, collision, interaction, or browser acceptance.
"""
import bpy
import bmesh
import hashlib
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[2]
asset = sys.argv[sys.argv.index('--') + 1]
variant = sys.argv[sys.argv.index('--') + 2] if len(sys.argv) > sys.argv.index('--') + 2 else 'optimized-v1'
assert variant in {'optimized-v1', 'optimized-v2'}
targets = {'workshop': 30000, 'canoe': 12000}
assert asset in targets, 'Character and stairs need structural work before this trial'
folder = ROOT / 'assets/lux3d/round-01' / asset
source = folder / 'output-1.glb'
source_hash = hashlib.sha256(source.read_bytes()).hexdigest()
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(source), merge_vertices=variant == 'optimized-v2')
meshes = [obj for obj in bpy.context.scene.objects if obj.type == 'MESH']

def triangle_count(objects):
    total = 0
    for obj in objects:
        obj.data.calc_loop_triangles()
        total += len(obj.data.loop_triangles)
    return total

before = triangle_count(meshes)
ratio = min(1.0, targets[asset] / before)
vertices_before = sum(len(obj.data.vertices) for obj in meshes)
vertices_after_weld = vertices_before
for obj in meshes:
    bpy.context.view_layer.objects.active = obj
    if variant == 'optimized-v2':
        # GLB duplicates vertices at attribute seams. Weld positions while keeping
        # UVs on face corners, so collapsing isolated seam islands cannot open cracks.
        mesh = bmesh.new()
        mesh.from_mesh(obj.data)
        bmesh.ops.remove_doubles(mesh, verts=list(mesh.verts), dist=0.000001)
        mesh.to_mesh(obj.data)
        mesh.free()
        obj.data.validate(clean_customdata=True)
        obj.data.update()
        vertices_after_weld = sum(len(item.data.vertices) for item in meshes)
    modifier = obj.modifiers.new('Local trial - collapse decimation', 'DECIMATE')
    modifier.ratio = ratio
    modifier.use_collapse_triangulate = True
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    obj.data.validate(clean_customdata=True)
    obj.data.update()
textures = []
for img in bpy.data.images:
    if img.type == 'IMAGE' and img.size[0] > 0:
        original = list(img.size)
        scale = min(1.0, 1024 / max(original))
        if scale < 1:
            img.scale(round(original[0]*scale), round(original[1]*scale))
        img.pack()
        textures.append({'name':img.name,'before':original,'after':list(img.size)})
output = folder / f'{variant}.glb'
bpy.ops.export_scene.gltf(filepath=str(output), export_format='GLB', export_animations=False,
                          export_image_format='AUTO')
bpy.ops.wm.save_as_mainfile(filepath=str(folder / f'{variant}.blend'))
assert hashlib.sha256(source.read_bytes()).hexdigest() == source_hash
record = {'asset':asset,'status':'local-decimation-trial-not-runtime-approved',
          'blenderVersion':bpy.app.version_string,'sourceSha256':source_hash,
          'outputSha256':hashlib.sha256(output.read_bytes()).hexdigest(),
          'trianglesBefore':before,'targetTriangles':targets[asset],
          'variant':variant,'verticesBeforeWeld':vertices_before,'verticesAfterWeld':vertices_after_weld,
          'trianglesAfter':triangle_count(meshes),'textures':textures,
          'bytesBefore':source.stat().st_size,'bytesAfter':output.stat().st_size,
          'materialEdits':False,'uvRebake':False,'rigged':False,
          'sourcePreserved':True,'runtimeBrowserVerified':False}
evidence = ROOT / 'docs/evidence/assets/2026-10-22-round-01' / asset / variant
evidence.mkdir(parents=True,exist_ok=True)
(evidence/'optimization.json').write_text(json.dumps(record,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps(record),flush=True)
