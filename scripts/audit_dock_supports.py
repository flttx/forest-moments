"""Read-only Blender audit of the v0.31 jetty placement; no mesh edits or exports.

Coast/deck constants below mirror worldConfig.ts at this milestone. Recheck them
before using this historical audit against a future island layout.
"""
import bpy,json,math
from pathlib import Path
root=Path.cwd()
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(root/'assets/lux3d/coastal-jetty-v1/runtime-uncompressed.glb'))
points=[o.matrix_world@v.co for o in bpy.context.scene.objects if o.type=='MESH' for v in o.data.vertices]
rows=[]
for x in [-4.2,0,4.2]:
 for y in [-.85,.85]:
  near=[p for p in points if abs(p.x-x)<.55 and abs(p.y-y)<.3]
  if near:
   p=min(near,key=lambda p:p.z)
   wx,wz=27.6+p.x,-p.y
   a=math.atan2(wz,wx);coast=29+.85*math.sin(a*3+.4)+.55*math.sin(a*5-.8)+.25*math.cos(a*9)
   t=max(0,min(1,(math.hypot(wx,wz)-23.5)/(coast+1.8-23.5)));ground=-2.3*t*t*(3-2*t)
   rows.append(dict(region=[x,y],lowestLocal=list(p),worldXZ=[wx,wz],terrainY=ground,beforeBottom=.12+p.z,afterBottom=.12+p.z*1.06))
assert len(rows)==6,'A support region contained no vertices'
assert all(p['afterBottom']<p['terrainY'] for p in rows),'A support remains above terrain'
out=root/'docs/evidence/vegetation-expansion/2026-10-24/visual-finish'
out.mkdir(parents=True,exist_ok=True)
(out/'dock-support-audit.json').write_text(json.dumps(rows,indent=2)+'\n',encoding='utf-8')
print(json.dumps(rows))
