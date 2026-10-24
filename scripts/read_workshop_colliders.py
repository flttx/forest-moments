import bpy,json
from pathlib import Path
from mathutils import Vector
root=Path('F:/Projects/forest-moments')
bpy.ops.wm.open_mainfile(filepath='F:/Projects/my-blog/assets/blender/interiors/derived/workshop-interior.blend')
boxes=[]
for o in bpy.data.objects:
 if o.name.startswith('Collider_'):
  p=[o.matrix_world@Vector(v) for v in o.bound_box]
  boxes.append(dict(name=o.name,minX=min(v.x for v in p),maxX=max(v.x for v in p),minZ=min(-v.y for v in p),maxZ=max(-v.y for v in p)))
(root/'src/game/workshopColliders.json').write_text(json.dumps(boxes,indent=2)+'\n')
