"""Raise the existing central bench locally; preserve actor and exterior hull."""
import bpy,json,hashlib
from pathlib import Path
from mathutils import Matrix,Vector
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'docs/evidence/assets/2026-10-23-center-seat-fit'
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'assets/lux3d/round-01/canoe/assembly-review-v2.blend'))
def ease(t):
 t=max(0,min(1,t));return t*t*(3-2*t)
def band(v,a,b,f):return ease((v-a+f)/f)*ease((b+f-v)/f)
changes=[];exports=[]
for name in ['Lux3D_canoe','Measured_hull_cavity_caps']:
 o=bpy.data.objects[name];mat=o.matrix_world.copy();nm=mat.to_3x3().inverted().transposed()
 normals=[(nm@n.vector).normalized() for n in o.data.corner_normals];ids=set();max_move=0
 for v in o.data.vertices:
  p=mat@v.co
  w=band(p.x,-.10,.12,.06)*band(p.y,-.22,.22,.06)*band(p.z,-.18,-.09,.035)
  q=p+Vector((.04*w,0,.145*w));v.co=q
  if w>1e-7:ids.add(v.index);max_move=max(max_move,(q-p).length)
 o.parent=None;o.matrix_world=Matrix.Identity(4);o.data.update()
 o.data.normals_split_custom_set([(0,0,0) if l.vertex_index in ids else normals[l.index] for l in o.data.loops])
 exports.append(o);changes.append({'mesh':name,'changedVertices':len(ids),'maxMoveM':max_move,'polygons':len(o.data.polygons)})
shift=Vector((0,0,.14));bpy.data.objects['ASSEMBLY_ONLY_character'].location+=shift
bpy.context.view_layer.update();bpy.ops.object.select_all(action='DESELECT')
for o in exports:o.select_set(True)
out=ROOT/'assets/lux3d/round-01/canoe/center-seat-v1.glb'
bpy.ops.export_scene.gltf(filepath=str(out),export_format='GLB',use_selection=True,export_animations=False)
bpy.ops.wm.save_as_mainfile(filepath=str(out.with_suffix('.blend')))
config={'status':'central bench candidate; checks pending','asset':'/'+out.relative_to(ROOT).as_posix(),'boatScale':.5,'characterShift':list(shift),'waterZ':-.355,'bakedAssemblyCoordinates':True,'changes':changes,'outputSHA256':hashlib.sha256(out.read_bytes()).hexdigest(),'bytes':out.stat().st_size,'sourceActorModified':False,'sourceHullModified':False}
(OUT/'candidate.json').write_text(json.dumps(config,indent=2)+'\n');print('CENTER_BUILD',json.dumps(config),flush=True)
