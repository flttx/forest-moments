import bpy,json
from pathlib import Path
from mathutils import Vector
root=Path.cwd()
result={}
for asset in ['bridge','bed']:
 bpy.ops.wm.open_mainfile(filepath=str(root/f'assets/expansion/{asset}.blend'))
 deps=bpy.context.evaluated_depsgraph_get()
 rows=[]
 for y in [i/10 for i in range(-30,31,2)]:
  hit,point,normal,face,obj,matrix=bpy.context.scene.ray_cast(deps,Vector((0,y,10)),Vector((0,0,-1)))
  if hit:rows.append([round(y,3),round(point.z,4),obj.name])
 result[asset]=rows
(root/'docs/evidence/2026-10-25-expansion/surface-samples.json').write_text(json.dumps(result,indent=2))
print(json.dumps(result))
