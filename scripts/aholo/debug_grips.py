import sys,json
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from paddle_grip_geometry import *
results=[]
for frame in range(190,217):
 protect_actor(frame);viable=[]
 for i in range(11):
  for j in range(11):
   for s in [0,.1,.2,.3,.4,.5,.6,.7,.8,.9,1]:
    c=candidate(frame,i/10,j/10,s)
    if c:viable.append([i/10,j/10,s]);break
 results.append({'frame':frame,'viable':viable})
 print('FEASIBLE',frame,viable,flush=True)
(OUT/'late-grip-feasible.json').write_text(json.dumps(results,indent=2))
