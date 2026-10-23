"""Check the actual linear-position/spherical-rotation prop playback at 120 Hz."""
import bpy,json,math,hashlib
from pathlib import Path
from mathutils import Vector,Matrix,Quaternion
from mathutils.bvhtree import BVHTree
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'docs/evidence/assets/2026-10-23-paddle-final'
c=json.loads((OUT/'candidate.json').read_text());path=ROOT/c['propTrack'];track=json.loads(path.read_text())
bpy.ops.wm.open_mainfile(filepath=str((ROOT/c['asset'].lstrip('/')).with_suffix('.blend')))
trees={}
for o in bpy.context.scene.objects:
 if o.name in ['Lux3D_canoe','Measured_hull_cavity_caps'] or o.name.startswith('Center_seat'):
  trees[o.name]=BVHTree.FromPolygons([o.matrix_world@v.co for v in o.data.vertices],[tuple(p.vertices) for p in o.data.polygons])
parts=[o for o in bpy.context.scene.objects if o.name.startswith(('Paddle_shaft','Paddle_blade'))]
convert=Matrix.Rotation(math.pi/2,3,'X');shift=Vector(c['characterShift']);records=[];previous=None
for i in range(865):
 frame=i/4;prop_frame=frame*track.get('sampleFPS',30)/30;index=int(prop_frame);u=prop_frame-index;a=track['frames'][index];b=track['frames'][min(index+1,len(track['frames'])-1)]
 def quat(f):q=f['quaternion'];return Quaternion((q[3],*q[:3]))
 q=quat(a).slerp(quat(b),u);p=Vector(a['position']).lerp(Vector(b['position']),u)
 rot=convert@q.to_matrix()@convert.transposed();m=Matrix.Translation(convert@p+shift)@rot.to_4x4()@Matrix.Diagonal((track['scale'],)*3+(1,))
 hits={};blade=None
 for part in parts:
  pm=m@part.matrix_local;verts=[pm@v.co for v in part.data.vertices];t=BVHTree.FromPolygons(verts,[tuple(f.vertices) for f in part.data.polygons])
  for name,tree in trees.items():
   n=len(tree.overlap(t))
   if n:hits[name]=hits.get(name,0)+n
  if part.name.startswith('Paddle_blade'):blade=min(v.z for v in verts)
 r={'frame':frame,'contacts':hits,'bladeMinZ':blade}
 if previous:
  angle=abs(previous[1].rotation_difference(q).angle)
  r.update(speed=(p-previous[0]).length*120,angularSpeed=min(angle,2*math.pi-angle)*120)
 records.append(r);previous=(p,q)
first,last=track['frames'][0],track['frames'][-1]
report={'asset':c['asset'],'sha256':c['outputSHA256'],'trackSHA256':hashlib.sha256(path.read_bytes()).hexdigest(),'sampleHz':120,'sampleCount':len(records),
 'collisionSamples':[r for r in records if r['contacts']],
 'loopPositionGap':(Vector(first['position'])-Vector(last['position'])).length,'loopAngleGap':quat(first).rotation_difference(quat(last)).angle,
 'maxSpeed':max(r.get('speed',0) for r in records),'maxAngularSpeed':max(r.get('angularSpeed',0) for r in records),
 'wetSamplesLeft':sum(55<=r['frame']<=123 and r['bladeMinZ']<c['waterZ'] for r in records),
 'wetSamplesRight':sum(163<=r['frame']<=216 and r['bladeMinZ']<c['waterZ'] for r in records),
 'frames':records,'scope':'120 Hz finite prop mesh surface intersections; not continuous collision proof'}
(OUT/'interpolation-audit.json').write_text(json.dumps(report,indent=2)+'\n');print('INTERPOLATION',json.dumps({k:v for k,v in report.items() if k!='frames'}),flush=True)
