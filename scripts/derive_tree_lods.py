"""Distant LODs for the AHOLO island trees, in an isolated Blender process.

Measured 2026-11-05: the full trees were 16.7 M of the scene's 22.7 M triangles and half the frame time. A tree past about
30 m covers a few hundred pixels, so it is drawn from a collapse-decimated copy; near trees keep the full model.
Only geometry is exported: the runtime reuses the full model's material and texture, so nothing is downloaded twice.
"""
import bpy, json, hashlib, sys
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
TREES=ROOT/'public/assets/island-trees'
EVIDENCE=ROOT/'docs/evidence/2026-11-05-tree-lod'
EVIDENCE.mkdir(parents=True,exist_ok=True)
RATIO=float(next((a.split('=')[1] for a in sys.argv if a.startswith('--ratio=')),'.12'))
NAMES=['old-pine','spruce','spruce-sapling','birch','maple','windswept-pine','windswept-pine-b','young-pine','young-birch','young-maple','alder']

def triangles(objects):return sum(len(p.vertices)-2 for o in objects for p in o.data.polygons)
record={'blender':bpy.app.version_string,'ratio':RATIO,'method':'collapse decimate, triangulated, geometry only (runtime reuses the full material)','trees':{}}
for name in NAMES:
 bpy.ops.wm.read_factory_settings(use_empty=True)
 bpy.ops.import_scene.gltf(filepath=str(TREES/f'{name}.glb'))
 meshes=[o for o in bpy.context.scene.objects if o.type=='MESH'];assert len(meshes)==1,name
 full=triangles(meshes)
 for o in meshes:
  bpy.context.view_layer.objects.active=o
  mod=o.modifiers.new('Distant','DECIMATE');mod.ratio=RATIO;mod.use_collapse_triangulate=True
  bpy.ops.object.modifier_apply(modifier=mod.name)
 bpy.ops.object.select_all(action='DESELECT')
 for o in meshes:o.select_set(True)
 out=TREES/f'{name}-lod.glb'
 bpy.ops.export_scene.gltf(filepath=str(out),export_format='GLB',use_selection=True,export_animations=False,export_materials='NONE')
 record['trees'][name]={'fullTriangles':full,'lodTriangles':triangles(meshes),'bytes':out.stat().st_size,'sha256':hashlib.sha256(out.read_bytes()).hexdigest()}
 print(name,record['trees'][name]['fullTriangles'],'->',record['trees'][name]['lodTriangles'])
(EVIDENCE/'lod-validation.json').write_text(json.dumps(record,indent=2),encoding='utf-8')
print('SUMMARY',json.dumps({k:(v['lodTriangles'],v['bytes']) for k,v in record['trees'].items()}))
