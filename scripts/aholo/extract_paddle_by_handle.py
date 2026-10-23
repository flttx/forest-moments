"""Let the supporting hand lift by the handle after the other hand releases."""
import bpy,json,math
from pathlib import Path
from mathutils import Vector,Matrix,Quaternion
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'docs/evidence/assets/2026-10-23-paddle-final'
track=json.loads((OUT/'prop-track-working.json').read_text());base=json.loads((OUT/'prop-track-base.json').read_text());assert track['sampleFPS']==120
axis=Vector((2.05,1.95,0)).normalized();handle=Vector((.75,.8,.3))-axis*.08;cv=Matrix.Rotation(-math.pi/2,3,'X');scale=track['scale']
def ease(t):t=max(0,min(1,t));return t*t*(3-2*t)
pa=cv.transposed()@Vector(base['frames'][190]['pivot']);pb=cv.transposed()@Vector(base['frames'][216]['pivot']);da=(handle-pa).dot(axis)*scale;db=(handle-pb).dot(axis)*scale
for i in range(761,865):
 frame=i/4;index=int(frame);u=frame-index;a=base['frames'][index];b=base['frames'][min(index+1,216)];qa=a['quaternion'];qb=b['quaternion'];q=Quaternion((qa[3],*qa[:3])).slerp(Quaternion((qb[3],*qb[:3])),u)
 # The later outward return was already checked against the legs and torso.
 # Blend into that orientation after the handle has cleared the released arm.
 corrected=track['frames'][i]['quaternion'];q=q.slerp(Quaternion((corrected[3],*corrected[:3])),ease((frame-199)/3));native_q=(cv.transposed()@q.to_matrix()@cv).to_quaternion()
 grips={s:Vector(p).lerp(Vector(b['gripTargets'][s]),u) for s,p in a['gripTargets'].items()}
 if frame<=195:w=ease((frame-190)/5);distance=da*(1-w)+.02*w
 elif frame<=205:distance=.02
 else:distance=.02+(db-.02)*ease((frame-205)/11)
 pivot=handle-axis*(distance/scale);location=grips['Right']-native_q@(pivot*scale)
 track['frames'][i].update(position=list(cv@location),quaternion=[q.x,q.y,q.z,q.w],pivot=list(cv@pivot),held='Right',regrip=frame<216,gripTargets={s:list(p) for s,p in grips.items()})
track['extraction']='Right hand slides toward the handle during single-hand recovery; original actor unchanged'
(OUT/'prop-track.json').write_text(json.dumps(track,indent=2)+'\n');print('HANDLE_EXTRACTION',{'startDistance':da,'endDistance':db},flush=True)
