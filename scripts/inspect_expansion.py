import bpy,json
from pathlib import Path
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(Path('public/assets/models/raccoon.glb').resolve()))
a=next(o for o in bpy.data.objects if o.type=='ARMATURE')
print('ARMATURE',a.name, 'MATRIX',list(a.location),list(a.scale))
for b in a.data.bones:
 print('BONE',b.name,list(b.head_local),list(b.tail_local))
print('ACTIONS',[(x.name,x.frame_range[:]) for x in bpy.data.actions])
