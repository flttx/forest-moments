import bpy,json
from pathlib import Path
from mathutils import Vector
root=Path(__file__).resolve().parents[1]
report={}
for kind,clip in [('hen','peck'),('sheep','graze')]:
 bpy.ops.wm.open_mainfile(filepath=f'F:/Projects/my-blog/assets/blender/farm/animal-{kind}.blend')
 rig=next(o for o in bpy.data.objects if o.type=='ARMATURE')
 mesh=next(o for o in bpy.data.objects if o.type=='MESH')
 actions=[(a.name,a.frame_range[:]) for a in bpy.data.actions]
 rig.animation_data_clear();rig.animation_data_create();rig.animation_data.action=bpy.data.actions[clip]
 if rig.animation_data.action.slots:rig.animation_data.action_slot=rig.animation_data.action.slots[0]
 report[kind]={'actions':actions,'bones':{b.name:{'head':list(b.head_local),'tail':list(b.tail_local),'matrix':[list(r) for r in b.matrix_local]} for b in rig.data.bones},'frames':[]}
 indices=[v.index for v in mesh.data.vertices if sum(g.weight for g in v.groups if mesh.vertex_groups[g.group].name in ('Head','Neck'))>.5]
 for f in [0,8,16,24,32]:
  bpy.context.scene.frame_set(f);deps=bpy.context.evaluated_depsgraph_get();evaluated=mesh.evaluated_get(deps);points=[evaluated.matrix_world@evaluated.data.vertices[i].co for i in indices]
  # Blender +Y is the animal forward direction; low-front vertices approximate mouth contact.
  low=sorted(points,key=lambda p:p.z)[:12]
  report[kind]['frames'].append({'frame':f,'rotations':{n:list(rig.pose.bones[n].rotation_euler) for n in ['Body','Neck','Head']},'headBounds':[[min(p[i] for p in points),max(p[i] for p in points)] for i in range(3)],'lowCentre':list(sum(low,Vector())/len(low))})
(root/'docs/evidence/assets/2026-10-24-farm/pose-audit.json').write_text(json.dumps(report,indent=2))
