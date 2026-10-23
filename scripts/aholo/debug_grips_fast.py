import sys,json
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from paddle_grip_geometry import *
results=[]
for frame in range(190,217):
 protect_actor(frame);viable=[]
 for slide in [0,.1,.2,.3,.4,.5,.6,.7,.8,.9,1]:
  for i in range(21):
   for ar in [1,.8,.6,.4,.2,0]:
    c=candidate(frame,i/20,ar,slide)
    if c:viable.append([i/20,ar,slide])
  if viable:break
 results.append({'frame':frame,'viable':viable})
 (OUT/'late-grip-fast.json').write_text(json.dumps(results,indent=2))
 print('FEASIBLE_FAST',frame,viable,flush=True)
