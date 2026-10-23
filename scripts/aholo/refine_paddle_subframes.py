"""Resolve measured subframe contacts on a 120 Hz prop track, with actual grips."""
import sys,itertools,copy,hashlib
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
import paddle_grip_geometry as geo
from paddle_grip_geometry import *
path=OUT/'prop-track.json';source=json.loads(path.read_text());track=copy.deepcopy(source)
if source.get('sampleFPS',30)==30:
 (OUT/'prop-track-30fps.json').write_bytes(path.read_bytes());records=[]
 for i in range(865):
  frame=i/4;index=int(frame);u=frame-index;a=source['frames'][index];b=source['frames'][min(index+1,216)];r=copy.deepcopy(a)
  qa=a['quaternion'];qb=b['quaternion'];q=Quaternion((qa[3],*qa[:3])).slerp(Quaternion((qb[3],*qb[:3])),u)
  r.update(frame=frame,position=list(Vector(a['position']).lerp(Vector(b['position']),u)),quaternion=[q.x,q.y,q.z,q.w],
   pivot=list(Vector(a['pivot']).lerp(Vector(b['pivot'] if a['held']==b['held'] else a['pivot']),u)),
   gripTargets={s:list(Vector(p).lerp(Vector(b['gripTargets'][s]),u)) for s,p in a['gripTargets'].items()},regrip=bool(a['regrip'] or u>0 and b['regrip']))
  records.append(r)
 track.update(sampleFPS=120,frames=records,coarseTrackSHA256=hashlib.sha256(path.read_bytes()).hexdigest())
audit=json.loads((OUT/'geometry-dense-audit.json').read_text())
def bad(r):return bool(r['paddleProtectedBodyContacts'] or r['paddleContacts'] or not r['heldHandContact'])
targets={r['frame'] for r in audit['frames'] if bad(r)}
if '--left-only' in sys.argv:targets={f for f in targets if f<190}
if '--current-range' in sys.argv:
 ranged=json.loads((OUT/'geometry-range-audit.json').read_text());low=min(r['frame'] for r in ranged['frames']);high=max(r['frame'] for r in ranged['frames'])
 targets={f for f in targets if not low<=f<=high}|{r['frame'] for r in ranged['frames'] if bad(r)}
def valid(q,loc,required):
 start=loc+q@(Vector((.75,.8,.3))*scale);end=loc+q@(Vector((-1.3,-1.15,.3))*scale);delta=end-start
 if geo.protected.ray_cast(start,delta.normalized(),delta.length)[0] is not None:return False
 touching=set()
 for vertices,faces in parts:
  tree=BVHTree.FromPolygons([loc+q@(v*scale) for v in vertices],faces)
  if any(t.overlap(tree) for t in trees) or geo.protected.overlap(tree):return False
  touching.update(s for s,t in geo.hand_trees.items() if t.overlap(tree))
 return all(s in touching for s in required)
changes=[]
for frame in sorted(targets):
 print('REFINE_FRAME',frame,flush=True)
 geo.protect_actor(frame);r=track['frames'][round(frame*4)];q=r['quaternion'];q=Quaternion((q[3],*q[:3]));q=(convert.transposed()@q.to_matrix()@convert).to_quaternion();loc=convert.transposed()@Vector(r['position'])+shift
 required=[r['held']] if r['regrip'] else ['Left','Right']
 if valid(q,loc,required):continue
 held=Vector(r['gripTargets'][r['held']])+shift;pivot=q.conjugated()@(held-loc)/scale
 offsets=[Vector(p) for p in set(itertools.product([0,.01,-.01,.02,-.02,.03,-.03,.04,-.04],repeat=3))|set(itertools.product([0,.005,-.005],repeat=3))];offsets.sort(key=lambda v:v.length_squared)
 direction=q@axis;pitch_axis=direction.cross(Vector((0,0,1))).normalized();angles=sorted(itertools.product(range(-30,31,2),repeat=2),key=lambda p:p[0]**2+p[1]**2);found=None
 for yaw,pitch in angles:
  cq=Quaternion(Vector((0,0,1)),math.radians(yaw))@Quaternion(pitch_axis,math.radians(pitch))@q;base=held-cq@(pivot*scale)
  for offset in offsets:
   cl=base+offset
   if valid(cq,cl,required):found=(cq,cl,offset,yaw,pitch);break
  if found:break
 if not found:raise RuntimeError('No 120 Hz surface grip at '+str(frame))
 q,loc,offset,yaw,pitch=found;direction=q@axis;anchor=loc+q@(handle*scale);grips={s:anchor+direction*((Vector(p)+shift-anchor).dot(direction)) for s,p in r['gripTargets'].items()};pivot=q.conjugated()@(grips[r['held']]-loc)/scale;oq=(convert@q.to_matrix()@convert.transposed()).to_quaternion()
 r.update(position=list(convert@(loc-shift)),quaternion=[oq.x,oq.y,oq.z,oq.w],pivot=list(convert@pivot),gripTargets={s:list(p-shift) for s,p in grips.items()})
 changes.append({'frame':frame,'translation':list(offset),'yawDegrees':yaw,'pitchDegrees':pitch,'physicalHandContact':required});print('SUBFRAME_FIT',changes[-1],flush=True)
 track['subframeAdjustments']=changes
 (OUT/'prop-track-working.json').write_text(json.dumps(track,indent=2)+'\n')
track['subframeAdjustments']=changes
path.write_text(json.dumps(track,indent=2)+'\n');(OUT/'subframe-fit.json').write_text(json.dumps(changes,indent=2)+'\n')
