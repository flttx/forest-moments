"""Smooth the grip transition, then lift the finite blade over the gunwale.

All motion is on the independent paddle. Every chosen slide is rechecked
against the actual meshes; the final playback also needs a separate audit.
"""
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from paddle_grip_geometry import *

seed=json.loads((OUT/'prop-track.json').read_text())
seed=json.loads((ROOT/'docs/evidence/assets/2026-10-23-paddle-prop/prop-track.json').read_text())
for r in seed['frames']:
 q=r['quaternion'];q=Quaternion((q[3],*q[:3]));rotation=convert.transposed()@q.to_matrix()@convert
 native_pivot=convert.transposed()@Vector(r['pivot'])
 new_pivot=handle+(native_pivot-handle)*(seed['scale']/scale)
 location=poses[r['frame']][r['held']][0]-shift-rotation@(new_pivot*scale)
 r.update(position=list(convert@location),pivot=list(convert@new_pivot),fingerAlpha={'Left':0,'Right':0},gripTargets={s:list(p[0]-shift) for s,p in poses[r['frame']].items()})
alphas=[r['fingerAlpha'] for r in seed['frames']]
path=[]
for frame in range(163,217):
 protect_actor(frame)
 # Blend the late-stroke grip continuously instead of switching feasible islands.
 if frame<=177:
  t=max(0,min(1,(frame-163)/14));ar=t*t*(3-2*t);al=.65*ar
 elif frame<=197:al=.65;ar=1
 else:
  t=(frame-197)/19;t=t*t*(3-2*t);ar=1-t;al=.65*ar
 slides=[]
 for i in ([0] if frame<=185 or frame==216 else range(101)):
  c=candidate(frame,al,ar,i*.01)
  if c:slides.append(c)
 if not slides:raise RuntimeError('No extraction path at frame '+str(frame))
 path.append(slides)
 print('SMOOTH_OPTIONS',frame,al,ar,slides[0]['slide'],slides[-1]['slide'],flush=True)

# Permit anticipation of the extraction so the blade rises at a steady speed.
for layer_index,layer in enumerate(path):
 for c in layer:
  if layer_index==0:
   if c['slide']==0:c.update(cost=0,parent=None)
   continue
  opts=[]
  for i,p in enumerate(path[layer_index-1]):
   if 'cost' not in p:continue
   if abs(c['slide']-p['slide'])>.08001:continue
   opts.append((p['cost']+(c['slide']-p['slide'])**2*10+c['slide']**2,i))
  if opts:c['cost'],c['parent']=min(opts)
 if not any('cost' in c for c in layer):raise RuntimeError('Extraction needs a faster slide at '+str(163+layer_index))
indices=[i for i,c in enumerate(path[-1]) if 'cost' in c and c['slide']==0]
if not indices:raise RuntimeError('Cannot return to the original loop grip')
index=min(indices,key=lambda i:path[-1][i]['cost']);chosen=[]
for layer in reversed(path):
 c=layer[index];chosen.append(c);index=c['parent']
chosen.reverse()
for frame,c in zip(range(163,217),chosen):
 r=seed['frames'][frame];q=c['q'];p=c['loc'];outq=(convert@q.to_matrix()@convert.transposed()).to_quaternion();sep=(c['grips']['Left']-c['grips']['Right']).length
 r.update(position=list(convert@(p-shift)),quaternion=[outq.x,outq.y,outq.z,outq.w],pivot=list(convert@(handle-axis*((sep+c['slide'])/scale))),held='Right',regrip=False,
  gripSlide=c['slide'],fingerAlpha=dict(zip(['Left','Right'],c['alpha'])),gripTargets={s:list(v-shift) for s,v in c['grips'].items()})
seed['status']='Smooth grip extraction; independent audits pending'
seed['scale']=scale
(OUT/'prop-track-discrete.json').write_text(json.dumps(track,indent=2)+'\n')
(OUT/'prop-track.json').write_text(json.dumps(seed,indent=2)+'\n')
print('SMOOTH_PATH',json.dumps([{'frame':i+163,'alpha':c['alpha'],'slide':c['slide']} for i,c in enumerate(chosen)]),flush=True)
