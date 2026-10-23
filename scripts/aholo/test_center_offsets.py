"""Evaluate small lateral placement on the central bench, without asset writes."""
import bpy,json,math
from pathlib import Path
from mathutils import Vector,Matrix,Quaternion
from mathutils.bvhtree import BVHTree
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'docs/evidence/assets/2026-10-23-center-seat-fit'
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'assets/lux3d/round-01/canoe/center-seat-v3.blend'))
scene=bpy.context.scene;body=bpy.data.objects['Lux3D_Raccoon_MixamoSkin'];trees={}
for o in scene.objects:
 if o.name in ['Lux3D_canoe','Measured_hull_cavity_caps'] or o.name.startswith('Center_seat'):trees[o.name]=BVHTree.FromPolygons([o.matrix_world@v.co for v in o.data.vertices],[tuple(p.vertices) for p in o.data.polygons])
track=json.loads((ROOT/'docs/evidence/assets/2026-10-23-paddle-prop/prop-track.json').read_text());convert=Matrix.Rotation(math.pi/2,3,'X');records=[]
parts=[o for o in scene.objects if o.name.startswith(('Paddle_shaft','Paddle_blade'))]
for y in [-.04,-.08,-.12]:
 record={'y':y,'paddleHull':[],'paddleSeat':[],'body':[]}
 for frame in range(217):
  f=track['frames'][frame];q=f['quaternion'];rot=convert@Quaternion((q[3],*q[:3])).to_matrix()@convert.transposed();matrix=Matrix.Translation(convert@Vector(f['position'])+Vector((0,y,.14)))@rot.to_4x4()@Matrix.Diagonal((track['scale'],)*3+(1,))
  hit=set()
  for o in parts:
   m=matrix@o.matrix_local;t=BVHTree.FromPolygons([m@v.co for v in o.data.vertices],[tuple(p.vertices) for p in o.data.polygons]);hit.update(n for n,t2 in trees.items() if t2.overlap(t))
  if any(n in ['Lux3D_canoe','Measured_hull_cavity_caps'] for n in hit):record['paddleHull'].append(frame)
  if any(n.startswith('Center_seat') for n in hit):record['paddleSeat'].append(frame)
  if frame in [0,55,75,100,139,163,190,216]:
   scene.frame_set(frame);bpy.context.view_layer.update();e=body.evaluated_get(bpy.context.evaluated_depsgraph_get());mesh=e.to_mesh();t=BVHTree.FromPolygons([body.matrix_world@v.co+Vector((0,y,0)) for v in mesh.vertices],[tuple(p.vertices) for p in mesh.polygons]);e.to_mesh_clear()
   record['body'].append({'frame':frame,'contacts':{n:len(t2.overlap(t)) for n,t2 in trees.items()}})
 records.append(record);print('CENTER_OFFSET',json.dumps({'y':y,'hull':len(record['paddleHull']),'seat':len(record['paddleSeat']),'body':record['body']}),flush=True)
(OUT/'offset-search.json').write_text(json.dumps(records,indent=2)+'\n')
