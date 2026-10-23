"""Locate original-prop hull contacts before choosing a local boat edit."""
import bpy,json,math
from pathlib import Path
from mathutils import Matrix,Vector,Quaternion
from mathutils.bvhtree import BVHTree
from mathutils.geometry import intersect_ray_tri
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'docs/evidence/assets/2026-10-23-paddle-final'
c=json.loads((OUT/'candidate.json').read_text());bpy.ops.wm.open_mainfile(filepath=str((ROOT/c['asset'].lstrip('/')).with_suffix('.blend')))
h=bpy.data.objects['Lux3D_canoe'];h.data.calc_loop_triangles();hv=[h.matrix_world@v.co for v in h.data.vertices];hf=[tuple(t.vertices) for t in h.data.loop_triangles];ht=BVHTree.FromPolygons(hv,hf,all_triangles=True)
track=json.loads((OUT/'prop-track.json').read_text());cv=Matrix.Rotation(math.pi/2,3,'X');records=[]
parts=[o for o in bpy.context.scene.objects if o.name.startswith(('Paddle_shaft','Paddle_blade'))]
for frame,r in enumerate(track['frames']):
 q=r['quaternion'];q=Quaternion((q[3],*q[:3]));rot=cv@q.to_matrix()@cv.transposed();m=Matrix.Translation(cv@Vector(r['position'])+Vector(c['characterShift']))@rot.to_4x4()@Matrix.Diagonal((track['scale'],)*3+(1,));points=[]
 m.translation-=rot@Vector((2.05,1.95,0)).normalized()*r.get('gripSlide',0)
 for o in parts:
  o.data.calc_loop_triangles();v=[m@o.matrix_local@p.co for p in o.data.vertices];f=[tuple(p.vertices) for p in o.data.loop_triangles];tree=BVHTree.FromPolygons(v,f,all_triangles=True)
  for i,j in ht.overlap(tree):
   a=[hv[k] for k in hf[i]];b=[v[k] for k in f[j]]
   for edges,tri in [(a,b),(b,a)]:
    for k,p in enumerate(edges):
     d=edges[(k+1)%3]-p
     if d.length<1e-8:continue
     hit=intersect_ray_tri(*tri,d.normalized(),p,True)
     if hit and (hit-p).dot(d)>=-1e-8 and (hit-p).length<=d.length+1e-7:points.append(list(hit))
 if points:records.append({'frame':frame,'points':points})
points=[p for r in records for p in r['points']]
report={'frames':records,'bounds':[[min(p[i] for p in points),max(p[i] for p in points)] for i in range(3)]}
(OUT/'gunwale-finger-diagnosis.json').write_text(json.dumps(report,indent=2)+'\n');print('CONTACT_BOUNDS',report['bounds'],flush=True)
