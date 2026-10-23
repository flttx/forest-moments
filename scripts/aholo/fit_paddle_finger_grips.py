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
shift=Vector(config['characterShift']);scale=.38
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

def candidate(frame,al,ar,slide=0):
 p=poses[frame];a=p['Left'][0].lerp(p['Left'][1],al);b=p['Right'][0].lerp(p['Right'][1],ar)
 if (a-b).length<.02:return None
 q=axis.rotation_difference((a-b).normalized());loc=a-q@(handle*scale-axis*slide)
 # Full finite prop meshes, with 2 mm lateral clearance around their surfaces.
 for verts,faces in parts:
  points=[]
  for v in verts:
   delta=v-handle;off=delta-axis*delta.dot(axis)
   points.append(loc+q@(v*scale+(off.normalized()*.002 if off.length>1e-8 else Vector())))
  tree=BVHTree.FromPolygons(points,faces)
  hits=[tree_names[i] for i,t in enumerate(trees) if t.overlap(tree)]
  if hits:
   pass
   return None
 return {'alpha':(al,ar),'slide':slide,'q':q,'loc':loc,'grips':{'Left':a,'Right':b}}

layers=[]
for frame in range(163,217):
 candidates=[]
 grid=[0] if frame in [163,216] else [i/10 for i in range(11)]
 for al in grid:
  for ar in grid:
   slides=[0] if frame in [163,216] else [i*.02 for i in range(16)]
   viable=0
   for slide in slides:
    c=candidate(frame,al,ar,slide)
    if c:
     candidates.append(c);viable+=1
     if viable==2:break
 if not candidates:raise RuntimeError('No full-mesh collision-free grip at frame '+str(frame))
 if not layers:
  for c in candidates:c.update(cost=0,parent=None)
 else:
  for c in candidates:
   choices=[]
   for i,p in enumerate(layers[-1]):
    # Angular and spatial costs penalize pops, especially at stroke extraction.
    angle=p['q'].rotation_difference(c['q']).angle
    cost=p['cost']+sum((a-b)**2 for a,b in zip(p['alpha'],c['alpha']))+angle**2*8+(p['slide']-c['slide'])**2*100+(p['loc']-c['loc']).length_squared*20
    choices.append((cost,i))
   cost,parent=min(choices);c.update(cost=cost+.002*sum(a*a for a in c['alpha'])+.2*c['slide']**2,parent=parent)
 layers.append(candidates)
 print('GRIP_LAYER',frame,len(candidates),flush=True)
index=min(range(len(layers[-1])),key=lambda i:layers[-1][i]['cost']);path=[]
for layer in reversed(layers):
 c=layer[index];path.append(c);index=c['parent']
path.reverse()
for r in track['frames']:
 r['fingerAlpha']={'Left':0,'Right':0}
 r['gripTargets']={s:list(p[0]-shift) for s,p in poses[r['frame']].items()}
for frame,c in zip(range(163,217),path):
 r=track['frames'][frame];q=c['q'];p=c['loc'];outq=(convert@q.to_matrix()@convert.transposed()).to_quaternion()
 sep=(c['grips']['Left']-c['grips']['Right']).length
 r.update(position=list(convert@(p-shift)),quaternion=[outq.x,outq.y,outq.z,outq.w],pivot=list(convert@(handle-axis*((sep+c['slide'])/scale))),held='Right',regrip=False,
  gripSlide=c['slide'],fingerAlpha=dict(zip(['Left','Right'],c['alpha'])),gripTargets={s:list(v-shift) for s,v in c['grips'].items()},
  bladeMinZ=min((p+q@(v*scale)).z-shift.z for v in parts[-1][0]))
 # Existing native blade metadata is recomputed independently during audit.
for key in ['intersectingFrames','headIntersectingFrames','maxHeldHandError','maxTwoHandErrorOutsideRecovery','wetFramesLeft','wetFramesRight']:
 track.pop(key,None)
track.update(status='Finger grip candidate; interpolation, hand contact and visual checks pending',boneOverrides=False,fitAsset=config['asset'])
(OUT/'prop-track.json').write_text(json.dumps(track,indent=2)+'\n')
config['propTrack']='docs/evidence/assets/2026-10-23-paddle-final/prop-track.json'
(OUT/'candidate.json').write_text(json.dumps(config,indent=2)+'\n')
print('GRIP_PATH',json.dumps([{'frame':f,'alpha':c['alpha'],'slide':c['slide']} for f,c in zip(range(163,217),path)]),flush=True)
