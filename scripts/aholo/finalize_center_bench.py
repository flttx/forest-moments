"""Replace only the central interior bench with a rigid timber seat."""
import bpy,bmesh,json,hashlib
from pathlib import Path
from mathutils import Vector,Matrix
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'docs/evidence/assets/2026-10-23-paddle-final'
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'assets/lux3d/round-01/canoe/assembly-review-v2.blend'))
hull=bpy.data.objects['Lux3D_canoe'];world=[hull.matrix_world@v.co for v in hull.data.vertices]
def ease(t):
 t=max(0,min(1,t));return t*t*(3-2*t)
face=min(hull.data.polygons,key=lambda f:(sum((world[i] for i in f.vertices),Vector())/len(f.vertices)-Vector((0,0,-.117))).length)
uv=sum((hull.data.uv_layers.active.data[i].uv for i in face.loop_indices),Vector((0,0)))/len(face.loop_indices)
material=hull.data.materials[face.material_index]
exports=[]
for name in ['Lux3D_canoe','Measured_hull_cavity_caps']:
 o=bpy.data.objects[name];mat=o.matrix_world.copy();nm=mat.to_3x3().inverted().transposed();normals=[(nm@n.vector).normalized() for n in o.data.corner_normals]
 for v in o.data.vertices:v.co=mat@v.co
 o.parent=None;o.matrix_world=Matrix.Identity(4);o.data.update();o.data.normals_split_custom_set(normals);exports.append(o)
bm=bmesh.new();bm.from_mesh(hull.data)
remove=[f for f in bm.faces if -.20<f.calc_center_median().x<.34 and abs(f.calc_center_median().y)<.30 and min(v.co.z for v in f.verts)>-.28 and max(v.co.z for v in f.verts)<-.065]
removed=len(remove);bmesh.ops.delete(bm,geom=remove,context='FACES');bm.to_mesh(hull.data);bm.free();hull.data.update()
def timber(name,center,size):
 bpy.ops.mesh.primitive_cube_add(size=1,location=center);o=bpy.context.object;o.name=name;o.dimensions=size
 bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 bevel=o.modifiers.new('Rounded timber edges','BEVEL');bevel.width=.006;bevel.segments=2;bpy.ops.object.modifier_apply(modifier=bevel.name)
 o.data.materials.append(material)
 layer=o.data.uv_layers.active or o.data.uv_layers.new()
 for loop in o.data.loops:
  p=o.data.vertices[loop.vertex_index].co;layer.data[loop.index].uv=uv+Vector((p.x*.22,p.y*.22))
 exports.append(o);return o
# Slatted bench: a narrow front gap lets the unchanged hanging garment pass.
for name,center,size in [
 ('Center_seat_top',(.035,.17,.085),(.33,.14,.04)),
 ('Center_seat_top_left',(.035,-.22,.085),(.33,.04,.04)),
 ('Center_seat_top_rear',(-.11,0,.085),(.04,.48,.04)),
 ('Center_seat_top_front_left',(.175,-.185,.067),(.05,.03,.04)),
 ('Center_seat_top_front_right',(.175,-.005,.067),(.05,.21,.04)),
]:timber(name,(center[0],center[1],center[2]+.04),size)
for y in [-.215,.215]:timber('Center_seat_support',(.08,y,-.095),(.19,.035,.40))
# Conceals only the exposed old pedestal cut inside the boat; exterior untouched.
timber('Center_seat_lower_cover',(.07,0,-.281),(.55,.60,.022))
bpy.data.objects['ASSEMBLY_ONLY_character'].location.z+=.26
bpy.context.view_layer.update();bpy.ops.object.select_all(action='DESELECT')
for o in exports:o.select_set(True)
out=ROOT/'assets/lux3d/round-01/canoe/center-seat-v11.glb'
bpy.ops.export_scene.gltf(filepath=str(out),export_format='GLB',use_selection=True,export_animations=False)
bpy.ops.wm.save_as_mainfile(filepath=str(out.with_suffix('.blend')))
config={'status':'central rigid bench candidate; checks pending','asset':'/'+out.relative_to(ROOT).as_posix(),'boatScale':.5,'characterShift':[0,0,.26],'waterZ':-.355,'bakedAssemblyCoordinates':True,'interiorBenchFacesRemoved':removed,'exteriorHullDeformed':False,'seatTopZ':.145,'seatBoundsXY':[[-.13,.20],[-.24,.24]],'outputSHA256':hashlib.sha256(out.read_bytes()).hexdigest(),'bytes':out.stat().st_size,'sourceActorModified':False,'sourceHullModified':False}
(OUT/'candidate.json').write_text(json.dumps(config,indent=2)+'\n');print('CENTER_BENCH',json.dumps(config),flush=True)
