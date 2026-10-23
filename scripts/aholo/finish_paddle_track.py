"""Original animation with an independent, single-hand extraction of the paddle."""
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from paddle_grip_geometry import *

source=json.loads((ROOT/'docs/evidence/assets/2026-10-23-paddle-prop/prop-track.json').read_text())
def ease(t):t=max(0,min(1,t));return t*t*(3-2*t)
def export(r,q,loc,pivot,grips,held,regrip):
 oq=(convert@q.to_matrix()@convert.transposed()).to_quaternion()
 r.update(position=list(convert@(loc-shift)),quaternion=[oq.x,oq.y,oq.z,oq.w],pivot=list(convert@pivot),gripTargets={s:list(p-shift) for s,p in grips.items()},held=held,regrip=regrip)

# At rest the blade retains its original reach; during the hand change the
# support moves toward the handle so the extra handle length stays off the face.
for r in source['frames']:
 f=r['frame'];q=r['quaternion'];q=Quaternion((q[3],*q[:3]));q=(convert.transposed()@q.to_matrix()@convert).to_quaternion()
 old_pivot=convert.transposed()@Vector(r['pivot']);distance=(handle-old_pivot).dot(axis)*.38
 extra=.32*(1-ease(f/12)) if f<=12 else (.32 if f==216 else 0)
 pivot=handle-axis*((distance+extra)/scale)
 grips={s:p[0] for s,p in poses[f].items()};loc=grips[r['held']]-q@(pivot*scale)
 r['fingerAlpha']={'Left':0,'Right':0}
 export(r,q,loc,pivot,grips,r['held'],r['regrip'])

for f in range(163,191):
 t=ease((f-163)/14);al=.65*t;ar=t
 a=poses[f]['Left'][0].lerp(poses[f]['Left'][1],al);b=poses[f]['Right'][0].lerp(poses[f]['Right'][1],ar)
 q=axis.rotation_difference((a-b).normalized());pivot=handle-axis*((a-b).length/scale);loc=b-q@(pivot*scale)
 r=source['frames'][f];export(r,q,loc,pivot,{'Left':a,'Right':b},'Right',False);r['fingerAlpha']={'Left':al,'Right':ar}

start=source['frames'][190];finish=source['frames'][216]
def native_q(r):
 q=r['quaternion'];q=Quaternion((q[3],*q[:3]));return (convert.transposed()@q.to_matrix()@convert).to_quaternion()
qa=native_q(start);qb=native_q(finish);qm=axis.rotation_difference(Vector((.7,.7,-.10)).normalized())
pa=convert.transposed()@Vector(start['pivot']);pb=convert.transposed()@Vector(finish['pivot'])
for f in range(191,217):
 t=(f-190)/26;w=ease(t)
 q=qa.slerp(qm,ease((f-190)/12)) if f<=202 else qm.slerp(qb,ease((f-202)/14))
 pivot=pa.lerp(pb,w);grips={s:p[0] for s,p in poses[f].items()};grips['Right']=poses[f]['Right'][0].lerp(poses[f]['Right'][1],1-w)
 loc=grips['Right']-q@(pivot*scale);r=source['frames'][f]
 export(r,q,loc,pivot,grips,'Right',f<216);r['fingerAlpha']={'Left':0,'Right':1-w}
source.update(scale=scale,status='Original bones with one-hand extraction; validation pending',boneOverrides=False)
for key in ['intersectingFrames','headIntersectingFrames','maxHeldHandError','maxTwoHandErrorOutsideRecovery','wetFramesLeft','wetFramesRight']:source.pop(key,None)
(OUT/'prop-track-base.json').write_text(json.dumps(source,indent=2)+'\n')
if '--base-only' not in sys.argv:(OUT/'prop-track.json').write_text(json.dumps(source,indent=2)+'\n')
config['propTrack']='docs/evidence/assets/2026-10-23-paddle-final/prop-track.json'
(OUT/'candidate.json').write_text(json.dumps(config,indent=2)+'\n')
print('EXTRACTION_TRACK_WRITTEN',flush=True)
