"""Clear the free-hand extraction against the body without editing any bones."""
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
import paddle_grip_geometry as geometry
from paddle_grip_geometry import *

track=json.loads((OUT/'prop-track.json').read_text());changes=[]
smooth='--smooth-right' in sys.argv
base=json.loads((OUT/'prop-track-base.json').read_text()) if smooth else None
def clear(q,loc):
 for vertices,faces in parts:
  verts=[]
  for v in vertices:
   d=v-handle;off=d-axis*d.dot(axis)
   verts.append(loc+q@(v*scale+(off.normalized()*.002 if off.length else Vector())))
  tree=BVHTree.FromPolygons(verts,faces)
  if any(t.overlap(tree) for t in trees) or geometry.protected.overlap(tree):return False
 return True
for frame in (range(191,201) if smooth else list(range(48,55))+list(range(191,216))):
 geometry.protect_actor(frame)
 r=track['frames'][frame];source_r=base['frames'][frame] if smooth else r;q=source_r['quaternion'];q=Quaternion((q[3],*q[:3]));q=(convert.transposed()@q.to_matrix()@convert).to_quaternion()
 pivot=convert.transposed()@Vector(r['pivot']);grip=Vector(r['gripTargets'][r['held']])+shift;loc=grip-q@(pivot*scale)
 if not smooth and clear(q,loc):continue
 direction=q@axis;pitch_axis=direction.cross(Vector((0,0,1))).normalized()
 phase=max(0,1-abs(frame-195)/5);phase=phase*phase*(3-2*phase)
 preferred=(-12*phase,-10*phase) if smooth else (0,0)
 options=sorted([(yaw,pitch) for yaw in range(-50,51,2) for pitch in range(-40,41,2)],key=lambda p:(p[0]-preferred[0])**2+(p[1]-preferred[1])**2+.02*(p[0]**2+p[1]**2))
 found=None
 for yaw,pitch in options:
  dq=Quaternion(Vector((0,0,1)),math.radians(yaw))@Quaternion(pitch_axis,math.radians(pitch));candidate_q=dq@q
  candidate_loc=grip-candidate_q@(pivot*scale)
  if clear(candidate_q,candidate_loc):found=(candidate_q,candidate_loc,yaw,pitch);break
 if not found:raise RuntimeError('No free-hand extraction at frame '+str(frame))
 q,loc,yaw,pitch=found;oq=(convert@q.to_matrix()@convert.transposed()).to_quaternion()
 r.update(position=list(convert@(loc-shift)),quaternion=[oq.x,oq.y,oq.z,oq.w])
 changes.append({'frame':frame,'yawDegrees':yaw,'pitchDegrees':pitch})
 print('FREE_HAND_CLEARANCE',changes[-1],flush=True)
track['freeHandClearanceAdjustments']=changes
(OUT/'prop-track.json').write_text(json.dumps(track,indent=2)+'\n')
(OUT/'extraction-clearance.json').write_text(json.dumps(changes,indent=2)+'\n')
print('POLISHED',json.dumps(changes),flush=True)
