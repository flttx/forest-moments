"""Fit the shaft inside the actual mittens while clearing clothing surfaces.

Bone midpoints are only a starting guess. A candidate must intersect the held
hand's skinned surface (both hands in the two-hand phase) and clear the protected
body and boat. Actor vertices, bones and weights are read only.
"""
import sys,itertools
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
import paddle_grip_geometry as geo
from paddle_grip_geometry import *
track=json.loads((OUT/'prop-track.json').read_text());changes=[]
def valid(q,loc,required):
 touching=set()
 for vertices,faces in parts:
  tree=BVHTree.FromPolygons([loc+q@(v*scale) for v in vertices],faces)
  if any(t.overlap(tree) for t in trees) or geo.protected.overlap(tree):return False
  touching.update(s for s,t in geo.hand_trees.items() if t.overlap(tree))
 return all(s in touching for s in required)
frames=sorted(set(range(10,20))|set(range(88,126))|set(range(129,138)))
for frame in frames:
 geo.protect_actor(frame);r=track['frames'][frame];q=r['quaternion'];q=Quaternion((q[3],*q[:3]));q=(convert.transposed()@q.to_matrix()@convert).to_quaternion()
 loc=convert.transposed()@Vector(r['position'])+shift
 required=[r['held']] if r['regrip'] else ['Left','Right']
 if valid(q,loc,required):continue
 held=Vector(r['gripTargets'][r['held']])+shift;pivot=q.conjugated()@(held-loc)/scale
 offsets=[Vector((x,y,z)) for x in [0,.01,.02,.03,.04,.05,-.01,-.02] for y in [0,-.01,.01,-.02,.02] for z in [0,-.01,.01]]
 offsets.sort(key=lambda v:v.length_squared)
 direction=q@axis;pitch_axis=direction.cross(Vector((0,0,1))).normalized()
 angles=sorted(itertools.product(range(-12,13,2),range(-12,13,2)),key=lambda p:p[0]**2+p[1]**2)
 found=None
 for yaw,pitch in angles:
  cq=Quaternion(Vector((0,0,1)),math.radians(yaw))@Quaternion(pitch_axis,math.radians(pitch))@q
  base=held-cq@(pivot*scale)
  for offset in offsets:
   cl=base+offset
   if valid(cq,cl,required):found=(cq,cl,offset,yaw,pitch);break
  if found:break
 if not found:raise RuntimeError('No surface grip at frame '+str(frame))
 q,loc,offset,yaw,pitch=found;direction=q@axis;anchor=loc+q@(handle*scale)
 grips={s:anchor+direction*((Vector(p)+shift-anchor).dot(direction)) for s,p in r['gripTargets'].items()}
 pivot=q.conjugated()@(grips[r['held']]-loc)/scale;oq=(convert@q.to_matrix()@convert.transposed()).to_quaternion()
 r.update(position=list(convert@(loc-shift)),quaternion=[oq.x,oq.y,oq.z,oq.w],pivot=list(convert@pivot),gripTargets={s:list(p-shift) for s,p in grips.items()})
 changes.append({'frame':frame,'translation':list(offset),'yawDegrees':yaw,'pitchDegrees':pitch,'physicalHandContact':required})
 print('HAND_SURFACE_FIT',changes[-1],flush=True)
track['surfaceGripAdjustments']=changes
(OUT/'prop-track.json').write_text(json.dumps(track,indent=2)+'\n')
(OUT/'hand-surface-fit.json').write_text(json.dumps(changes,indent=2)+'\n')
