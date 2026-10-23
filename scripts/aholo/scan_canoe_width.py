"""Read-only proportional width study; never deform local hull sections."""
import bpy,json,math
from pathlib import Path
from mathutils import Vector,Matrix,Quaternion
from mathutils.bvhtree import BVHTree
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'docs/evidence/assets/2026-10-23-paddle-final'
c=json.loads((OUT/'candidate.json').read_text());bpy.ops.wm.open_mainfile(filepath=str((ROOT/c['asset'].lstrip('/')).with_suffix('.blend')))
body=bpy.data.objects['Lux3D_Raccoon_MixamoSkin'];scene=bpy.context.scene;body_trees={}
for frame in [0,55,75,100,139,163,190,216]:
 scene.frame_set(frame);bpy.context.view_layer.update();e=body.evaluated_get(bpy.context.evaluated_depsgraph_get());m=e.to_mesh();body_trees[frame]=BVHTree.FromPolygons([body.matrix_world@v.co for v in m.vertices],[tuple(p.vertices) for p in m.polygons]);e.to_mesh_clear()
parts=[o for o in scene.objects if o.name.startswith(('Paddle_shaft','Paddle_blade'))]
track=json.loads((ROOT/'docs/evidence/assets/2026-10-23-paddle-prop/prop-track.json').read_text());cv=Matrix.Rotation(math.pi/2,3,'X');axis=Vector((2.05,1.95,0)).normalized();handle=Vector((.75,.8,.3))-axis*.08;results=[]
for width in [1,.85,.75,.65,.6,.55]:
 trees=[]
 for name in ['Lux3D_canoe','Measured_hull_cavity_caps']:
  o=bpy.data.objects[name];v=[o.matrix_world@v.co for v in o.data.vertices];v=[Vector((p.x,p.y*width,p.z)) for p in v];trees.append(BVHTree.FromPolygons(v,[tuple(p.vertices) for p in o.data.polygons]))
 for scale in [.38,.5]:
  hits=[]
  for frame,r in enumerate(track['frames']):
   q=r['quaternion'];q=Quaternion((q[3],*q[:3]));rot=cv@q.to_matrix()@cv.transposed();pos=cv@Vector(r['position'])+Vector(c['characterShift']);pos+=rot@(handle*(.38-scale));mat=Matrix.Translation(pos)@rot.to_4x4()@Matrix.Diagonal((scale,)*3+(1,))
   for part in parts:
    pm=mat@part.matrix_local;t=BVHTree.FromPolygons([pm@v.co for v in part.data.vertices],[tuple(p.vertices) for p in part.data.polygons])
    if any(tree.overlap(t) for tree in trees):hits.append(frame);break
  entry={'width':width,'paddleScale':scale,'paddleHitFrames':hits,'bodyHits':{f:sum(len(tree.overlap(bt)) for tree in trees) for f,bt in body_trees.items()}}
  results.append(entry);print('WIDTH',json.dumps(entry),flush=True)
(OUT/'width-study.json').write_text(json.dumps(results,indent=2)+'\n')
