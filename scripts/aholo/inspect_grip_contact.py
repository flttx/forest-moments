"""Locate contact relative to original hand surfaces at the difficult hand-off."""
import bpy,json,math
from pathlib import Path
from mathutils import Vector,Matrix,Quaternion
from mathutils.bvhtree import BVHTree
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'docs/evidence/assets/2026-10-23-paddle-final'
c=json.loads((OUT/'candidate.json').read_text());bpy.ops.wm.open_mainfile(filepath=str((ROOT/c['asset'].lstrip('/')).with_suffix('.blend')))
scene=bpy.context.scene;scene.frame_set(195,subframe=.5);bpy.context.view_layer.update();body=bpy.data.objects['Lux3D_Raccoon_MixamoSkin'];rig=next(o for o in scene.objects if o.type=='ARMATURE');groups={g.index:g.name for g in body.vertex_groups}
labels=[]
for f in body.data.polygons:
 weights={}
 for i in f.vertices:
  for g in body.data.vertices[i].groups:weights[groups[g.group]]=weights.get(groups[g.group],0)+g.weight
 labels.append(max(weights,key=weights.get))
e=body.evaluated_get(bpy.context.evaluated_depsgraph_get());m=e.to_mesh();v=[body.matrix_world@p.co for p in m.vertices];faces=[tuple(p.vertices) for p in m.polygons];e.to_mesh_clear();bt=BVHTree.FromPolygons(v,faces)
hands={s:rig.matrix_world@rig.pose.bones['mixamorig:'+s+'Hand'].head.lerp(rig.pose.bones['mixamorig:'+s+'Hand'].tail,.5) for s in ['Left','Right']}
track=json.loads((OUT/'prop-track.json').read_text());a=track['frames'][195];b=track['frames'][196];qa=a['quaternion'];qb=b['quaternion'];q=Quaternion((qa[3],*qa[:3])).slerp(Quaternion((qb[3],*qb[:3])),.5);cv=Matrix.Rotation(math.pi/2,3,'X');rot=cv@q.to_matrix()@cv.transposed();mat=Matrix.Translation(cv@Vector(a['position']).lerp(Vector(b['position']),.5)+Vector(c['characterShift']))@rot.to_4x4()@Matrix.Diagonal((track['scale'],)*3+(1,));records=[]
for o in scene.objects:
 if not o.name.startswith(('Paddle_shaft','Paddle_blade')):continue
 pm=mat@o.matrix_local;t=BVHTree.FromPolygons([pm@p.co for p in o.data.vertices],[tuple(f.vertices) for f in o.data.polygons])
 for i,j in bt.overlap(t):
  label=labels[i]
  if 'Hand' in label:continue
  center=sum((v[k] for k in faces[i]),Vector())/3
  records.append({'label':label,'point':list(center),'handDistances':{s:(center-p).length for s,p in hands.items()}})
(OUT/'difficult-grip-contact.json').write_text(json.dumps(records,indent=2)+'\n');print('CONTACT',json.dumps({label:{s:[min(r['handDistances'][s] for r in records if r['label']==label),max(r['handDistances'][s] for r in records if r['label']==label)] for s in hands} for label in set(r['label'] for r in records)}),flush=True)
