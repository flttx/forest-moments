import bpy,json,math
from pathlib import Path
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(Path('public/assets/models/raccoon.glb').resolve()))
a=next(o for o in bpy.data.objects if o.type=='ARMATURE')
a.animation_data_create()
action=bpy.data.actions['interact'];a.animation_data.action=action
if len(action.slots):a.animation_data.action_slot=action.slots[0]
for track in a.animation_data.nla_tracks:track.mute=True
for t in [.3,.5,.65,.85,1.1]:
 bpy.context.scene.frame_set(int(t*24),subframe=t*24%1)
 rows={}
 for side in ['Left','Right']:
  for suffix in ['Arm','ForeArm','Hand','HandIndex1']:
   b=a.pose.bones[f'mixamorig:{side}{suffix}'];v=a.matrix_world@b.head
   rows[side+suffix]=[-.6-v.x*7/3,(v.z+.3)*7/3,-.65+v.y*7/3]
 print('POSE_SAMPLE',t,json.dumps(rows))
