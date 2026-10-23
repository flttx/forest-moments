"""Fit only the original prop, using collision-free sliding grips inside the hands.

The source animation, hull exterior and actor are never edited. Dynamic
programming chooses a smooth path through independently checked grip pairs.
"""
import bpy,json,math
from pathlib import Path
from mathutils import Vector,Matrix,Quaternion
from mathutils.bvhtree import BVHTree

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'docs/evidence/assets/2026-10-23-paddle-final'
config=json.loads((OUT/'candidate.json').read_text())
bpy.ops.wm.open_mainfile(filepath=str((ROOT/config['asset'].lstrip('/')).with_suffix('.blend')))
scene=bpy.context.scene;rig=next(o for o in scene.objects if o.type=='ARMATURE')
shift=Vector(config['characterShift']);scale=.5
axis=Vector((2.05,1.95,0)).normalized();handle=Vector((.75,.8,.3))-axis*.08
convert=Matrix.Rotation(-math.pi/2,3,'X')
trees=[];tree_names=[]
for o in scene.objects:
 if o.name in ['Lux3D_canoe','Measured_hull_cavity_caps'] or o.name.startswith('Center_seat'):
  tree_names.append(o.name);trees.append(BVHTree.FromPolygons([o.matrix_world@v.co for v in o.data.vertices],[tuple(p.vertices) for p in o.data.polygons]))
parts=[]
for o in scene.objects:
 if o.name.startswith(('Paddle_shaft','Paddle_blade')):
  parts.append(([o.matrix_local@v.co for v in o.data.vertices],[tuple(p.vertices) for p in o.data.polygons]))
track=json.loads((ROOT/'docs/evidence/assets/2026-10-23-paddle-prop/prop-track.json').read_text())
poses=[]
for frame in range(217):
 scene.frame_set(frame);bpy.context.view_layer.update();p={}
 for side in ['Left','Right']:
  hand=rig.pose.bones['mixamorig:'+side+'Hand'];tip=rig.pose.bones['mixamorig:'+side+'HandIndex4']
  p[side]=(rig.matrix_world@hand.head.lerp(hand.tail,.5),rig.matrix_world@tip.tail)
 poses.append(p)

protected=None
body=bpy.data.objects['Lux3D_Raccoon_MixamoSkin']
groups={g.index:g.name for g in body.vertex_groups}
protected_faces=[];hand_faces={'Left':[],'Right':[]};hand_trees={}
for f in body.data.polygons:
 weights={}
 for i in f.vertices:
  for g in body.data.vertices[i].groups:weights[groups[g.group]]=weights.get(groups[g.group],0)+g.weight
 label=max(weights,key=weights.get) if weights else ''
 if 'Hand' not in label:protected_faces.append((tuple(f.vertices),label))
 else:hand_faces['Left' if 'Left' in label else 'Right'].append(tuple(f.vertices))

def protect_actor(frame):
 global protected, protected_labels, hand_trees
 scene.frame_set(int(frame),subframe=frame-int(frame));bpy.context.view_layer.update()
 e=body.evaluated_get(bpy.context.evaluated_depsgraph_get());mesh=e.to_mesh();verts=[body.matrix_world@v.co for v in mesh.vertices];e.to_mesh_clear()
 faces=[];protected_labels=[]
 current_hands=[rig.matrix_world@rig.pose.bones['mixamorig:'+side+'Hand'].head.lerp(rig.pose.bones['mixamorig:'+side+'Hand'].tail,.5) for side in ['Left','Right']]
 for ids,label in protected_faces:
  center=sum((verts[i] for i in ids),Vector())/len(ids)
  # The mitten/wrist seam is part of the grip; protect sleeves farther away.
  if 'ForeArm' in label and min((center-p).length for p in current_hands)<.09:continue
  faces.append(ids);protected_labels.append(label)
 protected=BVHTree.FromPolygons(verts,faces)
 hand_trees={s:BVHTree.FromPolygons(verts,f) for s,f in hand_faces.items()}

def candidate(frame,al,ar,slide=0):
 p=poses[frame];a=p['Left'][0].lerp(p['Left'][1],al);b=p['Right'][0].lerp(p['Right'][1],ar)
 if (a-b).length<.02 or slide+(a-b).length>2.82*scale-.08:return None
 q=axis.rotation_difference((a-b).normalized());loc=a-q@(handle*scale-axis*slide)
 # Full finite prop meshes, with 2 mm lateral clearance around their surfaces.
 for verts,faces in parts:
  points=[]
  for v in verts:
   delta=v-handle;off=delta-axis*delta.dot(axis)
   points.append(loc+q@(v*scale+(off.normalized()*.002 if off.length>1e-8 else Vector())))
  tree=BVHTree.FromPolygons(points,faces)
  hits=[tree_names[i] for i,t in enumerate(trees) if t.overlap(tree)]
  if protected and (overlaps:=protected.overlap(tree)):
   hits.append('actor')
   if frame==188 and slide in [0,.5,1]:print('ACTOR_CONTACT',frame,al,ar,slide,sorted(set(protected_labels[i] for i,j in overlaps)),flush=True)
  if hits:
   pass
   return None
 return {'alpha':(al,ar),'slide':slide,'q':q,'loc':loc,'grips':{'Left':a,'Right':b}}
