"""Read-only central-bench fit: never alter source pose or move to the stern."""
import bpy,json,math
from pathlib import Path
from mathutils import Vector,Matrix,Quaternion
from mathutils.bvhtree import BVHTree
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'docs/evidence/assets/2026-10-23-center-seat-fit';OUT.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'assets/lux3d/round-01/canoe/assembly-review-v2.blend'))
trees=[]
for name in ['Lux3D_canoe','Measured_hull_cavity_caps']:
 o=bpy.data.objects[name];trees.append(BVHTree.FromPolygons([o.matrix_world@v.co for v in o.data.vertices],[tuple(p.vertices) for p in o.data.polygons]))
track=json.loads((ROOT/'docs/evidence/assets/2026-10-23-paddle-prop/prop-track.json').read_text())
convert=Matrix.Rotation(math.pi/2,3,'X');segments=[]
for f in track['frames']:
 q=f['quaternion'];rot=convert@Quaternion((q[3],*q[:3])).to_matrix()@convert.transposed()
 m=Matrix.Translation(convert@Vector(f['position']))@rot.to_4x4()@Matrix.Diagonal((track['scale'],)*3+(1,))
 a=m@Vector((.75,.8,.3));b=m@Vector((-1.3,-1.15,.3));segments.append((a,b))
results=[]
for width in [1,.9,.8]:
 for x in [-.06,0,.06]:
  for z in [.08,.12,.16,.20,.24,.28]:
   hits=[];shift=Vector((x,0,z))
   for frame,(a,b) in enumerate(segments):
    p=a+shift;q=b+shift;p.y/=width;q.y/=width;delta=q-p
    if any(t.ray_cast(p,delta.normalized(),delta.length)[0] is not None for t in trees):hits.append(frame)
   results.append({'widthRatio':width,'shift':list(shift),'shaftHitFrames':len(hits),'frames':hits})
results.sort(key=lambda r:(r['shaftHitFrames'],abs(r['widthRatio']-1),r['shift'][2],abs(r['shift'][0])))
(OUT/'center-search.json').write_text(json.dumps({'scope':'coarse shaft centerline only; body and blade not accepted','results':results},indent=2)+'\n')
print('CENTRAL_SEARCH',json.dumps(results[:12]),flush=True)
