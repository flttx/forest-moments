import bpy,json,math
from pathlib import Path
from mathutils import Vector
out={}
for kind in ['hen','sheep']:
 bpy.ops.wm.open_mainfile(filepath=f'F:/Projects/my-blog/assets/blender/farm/animal-{kind}.blend')
 rig=next(o for o in bpy.data.objects if o.type=='ARMATURE');mesh=next(o for o in bpy.data.objects if o.type=='MESH')
 rig.animation_data_clear()
 for b in rig.pose.bones:b.rotation_mode='XYZ';b.rotation_euler=(0,0,0);b.location=(0,0,0)
 indices=[v.index for v in mesh.data.vertices if v.co.y>(.19 if kind=='hen' else .44)]
 def mouth():
  bpy.context.view_layer.update();e=mesh.evaluated_get(bpy.context.evaluated_depsgraph_get());ps=[e.matrix_world@e.data.vertices[i].co for i in indices];return sum(ps,Vector())/len(ps)
 candidates=[]
 for body in ([0] if kind=='sheep' else [-.22,-.30,-.38]):
  for neck in ([-1.2,-1.25,-1.3,-1.35,-1.4] if kind=='sheep' else [-.3,-.4,-.5]):
   for head in ([.2,.3,.4,.5,.6] if kind=='sheep' else [-.1,-.2]):
    rig.pose.bones['Body'].rotation_euler.x=body;rig.pose.bones['Neck'].rotation_euler.x=neck;rig.pose.bones['Head'].rotation_euler.x=head
    p=mouth();targetY=.42 if kind=='sheep' else .24
    candidates.append({'body':body,'neck':neck,'head':head,'mouth':list(p),'error':abs(p.z-.245)+abs(p.y-targetY)})
 out[kind]=sorted(candidates,key=lambda x:x['error'])[:8]
Path('docs/evidence/assets/2026-10-24-farm/mouth-fit.json').write_text(json.dumps(out,indent=2))
