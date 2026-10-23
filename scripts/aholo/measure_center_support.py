"""Measure real clothing/leg envelope above the original central bench."""
import bpy,json
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'docs/evidence/assets/2026-10-23-center-seat-fit'
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'assets/lux3d/round-01/canoe/assembly-review-v2.blend'))
scene=bpy.context.scene;body=bpy.data.objects['Lux3D_Raccoon_MixamoSkin']
grid=[(round(-.12+i*.02,3),round(-.18+j*.02,3)) for i in range(25) for j in range(19)]
heights=[1.]*len(grid)
for frame in range(0,217,6):
 scene.frame_set(frame);bpy.context.view_layer.update();e=body.evaluated_get(bpy.context.evaluated_depsgraph_get());m=e.to_mesh()
 tree=BVHTree.FromPolygons([body.matrix_world@v.co for v in m.vertices],[tuple(p.vertices) for p in m.polygons]);e.to_mesh_clear()
 for k,(x,y) in enumerate(grid):
  hit=tree.ray_cast(Vector((x,y,-.4)),Vector((0,0,1)),.7)[0]
  if hit:heights[k]=min(heights[k],hit.z)
rows=[]
for i in range(25):
 vals=[heights[i*19+j] for j in range(19) if abs(grid[i*19+j][1])<=.14 and heights[i*19+j]<1]
 rows.append({'x':grid[i*19][0],'min':min(vals) if vals else None,'max':max(vals) if vals else None,'heights':[round(v,3) if v<1 else None for v in heights[i*19:(i+1)*19]]})
(OUT/'support-envelope.json').write_text(json.dumps({'sampleFrames':37,'grid':grid,'heights':heights,'rows':rows},indent=2)+'\n')
print('SUPPORT_ROWS',json.dumps(rows),flush=True)
