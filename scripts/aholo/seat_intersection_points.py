"""Compute actual triangle crossing points instead of broad triangle bounds."""
import bpy,json
from pathlib import Path
from mathutils.bvhtree import BVHTree
from mathutils.geometry import intersect_ray_tri
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'docs/evidence/assets/2026-10-23-paddle-final'
c=json.loads((OUT/'candidate.json').read_text());bpy.ops.wm.open_mainfile(filepath=str((ROOT/c['asset'].lstrip('/')).with_suffix('.blend')))
scene=bpy.context.scene;body=bpy.data.objects['Lux3D_Raccoon_MixamoSkin'];seat=bpy.data.objects['Center_seat_top'];seat.data.calc_loop_triangles();sv=[seat.matrix_world@v.co for v in seat.data.vertices];sf=[tuple(p.vertices) for p in seat.data.loop_triangles];st=BVHTree.FromPolygons(sv,sf,all_triangles=True);results=[]
for frame in [0,30,55,100,163,190,200,210,216]:
 scene.frame_set(frame);bpy.context.view_layer.update();e=body.evaluated_get(bpy.context.evaluated_depsgraph_get());m=e.to_mesh();bv=[body.matrix_world@v.co for v in m.vertices];bf=[tuple(p.vertices) for p in m.polygons];bt=BVHTree.FromPolygons(bv,bf);e.to_mesh_clear();points=[]
 for i,j in st.overlap(bt):
  a=[sv[k] for k in sf[i]];b=[bv[k] for k in bf[j]]
  for edges,tri in [(a,b),(b,a)]:
   for k,p in enumerate(edges):
    delta=edges[(k+1)%3]-p
    if delta.length<1e-8:continue
    h=intersect_ray_tri(*tri,delta.normalized(),p,True)
    if h and (h-p).dot(delta)>=-1e-8 and (h-p).length<=delta.length+1e-7:points.append(list(h))

 results.append({'frame':frame,'points':points,'bounds':[[min(p[a] for p in points),max(p[a] for p in points)] for a in range(3)] if points else None})
(OUT/'seat-crossings.json').write_text(json.dumps(results,indent=2)+'\n');print(json.dumps([{k:v for k,v in r.items() if k!='points'} for r in results]),flush=True)
