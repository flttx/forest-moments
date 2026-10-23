"""Read-only search of real finger anchors, preserving every original bone pose."""
import bpy,json,sys
from pathlib import Path
from mathutils import Vector,Matrix
from mathutils.bvhtree import BVHTree
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'docs/evidence/assets/2026-10-23-paddle-final'
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'assets/lux3d/round-01/canoe/center-seat-v6.blend'))
rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE');scene=bpy.context.scene
trees=[]
for o in scene.objects:
 if o.name in ['Lux3D_canoe','Measured_hull_cavity_caps'] or o.name.startswith('Center_seat'):trees.append(BVHTree.FromPolygons([o.matrix_world@v.co for v in o.data.vertices],[tuple(p.vertices) for p in o.data.polygons]))
poses=[]
for frame in range(217):
 scene.frame_set(frame);bpy.context.view_layer.update();entry={}
 for side in ['Left','Right']:
  bone=rig.pose.bones['mixamorig:'+side+'Hand'];entry[side]=[rig.matrix_world@bone.head.lerp(bone.tail,.5)]+[rig.matrix_world@rig.pose.bones['mixamorig:'+side+'HandIndex'+str(i)].head for i in range(1,5)]
 for side in ['Left','Right']:
  b=rig.pose.bones['mixamorig:'+side+'HandIndex4'];entry[side]+=[rig.matrix_world@b.tail,rig.matrix_world@b.head.lerp(b.tail,.7)]
 poses.append(entry)
lift=float(sys.argv[sys.argv.index('--lift')+1]) if '--lift' in sys.argv else 0
axis=Vector((2.05,1.95,0)).normalized();handle=Vector((.75,.80,.30))-axis*.08;scale=.38
results=[];parts=[o for o in scene.objects if o.name.startswith(('Paddle_shaft','Paddle_blade'))]
frames=list(range(0,13))+list(range(55,124))+list(range(163,217))
for left in range(7):
 for right in range(7):
  hits=[];matrices=[]
  for frame in frames:
   upper='Right' if 55<=frame<=123 else 'Left';lower='Left' if upper=='Right' else 'Right'
   p=poses[frame];a=p[upper][left if upper=='Left' else right]+Vector((0,0,lift));b=p[lower][left if lower=='Left' else right]+Vector((0,0,lift));q=axis.rotation_difference((a-b).normalized());m=Matrix.Translation(a-q@(handle*scale))@q.to_matrix().to_4x4()@Matrix.Diagonal((scale,scale,scale,1));matrices.append(m)
   start=m@Vector((.75,.8,.3));end=m@Vector((-1.3,-1.15,.3));d=end-start
   if any(t.ray_cast(start,d.normalized(),d.length)[0] for t in trees):hits.append(frame)
  r={'leftAnchor':left,'rightAnchor':right,'shaftHitFrames':hits,'fullPaddleHitFrames':[]}
  if len(hits)<10:
   for frame,matrix in zip(frames,matrices):
    for o in parts:
     m=matrix@o.matrix_local;t=BVHTree.FromPolygons([m@v.co for v in o.data.vertices],[tuple(p.vertices) for p in o.data.polygons])
     if any(t2.overlap(t) for t2 in trees):r['fullPaddleHitFrames'].append(frame);break
  results.append(r)
results.sort(key=lambda r:(len(r['shaftHitFrames']),len(r['fullPaddleHitFrames'])))
(OUT/f'finger-grip-search-{lift:.2f}.json').write_text(json.dumps(results,indent=2)+'\n');print('FINGER_GRIPS',json.dumps(results[:8]),flush=True)

m=matrices[frames.index(190)];start=m@Vector((.75,.8,.3));end=m@Vector((-1.3,-1.15,.3));d=end-start
print('EXACT_190',list(start),list(end),[(i,list(h[0]),h[2]) for i,t in enumerate(trees) if (h:=t.ray_cast(start,d.normalized(),d.length))[0]],flush=True)
