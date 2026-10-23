"""Record intersection coordinates before changing any central-seat geometry."""
import bpy,json,math
from mathutils import Vector,Quaternion,Matrix
from pathlib import Path
from mathutils.bvhtree import BVHTree
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'docs/evidence/assets/2026-10-23-center-seat-fit'
c=json.loads((OUT/'candidate.json').read_text());bpy.ops.wm.open_mainfile(filepath=str((ROOT/c['asset'].lstrip('/')).with_suffix('.blend')))
scene=bpy.context.scene;body=bpy.data.objects['Lux3D_Raccoon_MixamoSkin'];targets={}
track=json.loads((ROOT/'docs/evidence/assets/2026-10-23-paddle-prop/prop-track.json').read_text());convert=Matrix.Rotation(math.pi/2,3,'X')
for name in ['Lux3D_canoe','Center_seat_top']:
 o=bpy.data.objects[name];v=[o.matrix_world@p.co for p in o.data.vertices];f=[tuple(p.vertices) for p in o.data.polygons];targets[name]=(v,f,BVHTree.FromPolygons(v,f))
out=[]
for frame in [0,100,190]:
 scene.frame_set(frame);bpy.context.view_layer.update();e=body.evaluated_get(bpy.context.evaluated_depsgraph_get());m=e.to_mesh();bv=[body.matrix_world@v.co for v in m.vertices];bf=[tuple(p.vertices) for p in m.polygons];t=BVHTree.FromPolygons(bv,bf);e.to_mesh_clear()
 for name,(v,f,tree) in targets.items():
  pairs=tree.overlap(t);pts=[bv[i] for _,j in pairs for i in bf[j]]
  out.append({'frame':frame,'mesh':name,'bodyHitBounds':[[min(p[i] for p in pts),max(p[i] for p in pts)] for i in range(3)] if pts else None,'bodyFaceCenters':[[sum(bv[i][a] for i in bf[j])/len(bf[j]) for a in range(3)] for j in set(j for _,j in pairs)]})
 f=track['frames'][frame];q=f['quaternion'];rot=convert@Quaternion((q[3],*q[:3])).to_matrix()@convert.transposed()
 transform=Matrix.Translation(convert@Vector(f['position'])+Vector(c['characterShift']))@rot.to_4x4()@Matrix.Diagonal((track['scale'],)*3+(1,))
 for name,(v,faces,tree) in targets.items():
  ids=set()
  for obj in scene.objects:
   if not obj.name.startswith(('Paddle_blade','Paddle_shaft')):continue
   mat=transform@obj.matrix_local;t=BVHTree.FromPolygons([mat@p.co for p in obj.data.vertices],[tuple(p.vertices) for p in obj.data.polygons]);ids.update(i for i,j in tree.overlap(t))
  pts=[v[i] for j in ids for i in faces[j]]
  out.append({'frame':frame,'mesh':name,'paddleHitHullBounds':[[min(p[i] for p in pts),max(p[i] for p in pts)] for i in range(3)] if pts else None})
(OUT/'contact-locations.json').write_text(json.dumps(out,indent=2)+'\n');print(json.dumps([{k:v for k,v in r.items() if k!='bodyFaceCenters'} for r in out]),flush=True)
