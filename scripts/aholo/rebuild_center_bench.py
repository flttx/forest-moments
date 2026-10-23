"""Replace only the central interior bench with a rigid timber seat."""
import bpy,bmesh,json,hashlib
from pathlib import Path
from mathutils import Vector,Matrix
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'docs/evidence/assets/2026-10-23-center-seat-fit'
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
outline=[(-.06,-.24),(.22,-.24),(.22,.24),(-.06,.24),(-.06,.10),(.15,.10),(.15,-.20),(-.06,-.20)]
vertices=[(x,y,z) for z in [-.033,.007] for x,y in outline];n=len(outline)
faces=[tuple(reversed(range(n))),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
mesh=bpy.data.meshes.new('Central_bench_with_rear_clearance');mesh.from_pydata(vertices,[],faces);mesh.update()
seat=bpy.data.objects.new('Center_seat_top',mesh);bpy.context.scene.collection.objects.link(seat);mesh.materials.append(material)
layer=mesh.uv_layers.new()
for loop in mesh.loops:
 p=mesh.vertices[loop.vertex_index].co;layer.data[loop.index].uv=uv+Vector((p.x*.22,p.y*.22))
bpy.context.view_layer.objects.active=seat;seat.select_set(True)
bevel=seat.modifiers.new('Rounded seat edges','BEVEL');bevel.width=.005;bevel.segments=2;bpy.ops.object.modifier_apply(modifier=bevel.name);exports.append(seat)
for y in [-.215,.215]:timber('Center_seat_support',(.08,y,-.164),(.19,.035,.262))
# Conceals only the exposed old pedestal cut inside the boat; exterior untouched.
timber('Center_seat_lower_cover',(.07,0,-.281),(.55,.60,.022))
bpy.data.objects['ASSEMBLY_ONLY_character'].location.z+=.14
bpy.context.view_layer.update();bpy.ops.object.select_all(action='DESELECT')
for o in exports:o.select_set(True)
out=ROOT/'assets/lux3d/round-01/canoe/center-seat-v6.glb'
bpy.ops.export_scene.gltf(filepath=str(out),export_format='GLB',use_selection=True,export_animations=False)
bpy.ops.wm.save_as_mainfile(filepath=str(out.with_suffix('.blend')))
config={'status':'central rigid bench candidate; checks pending','asset':'/'+out.relative_to(ROOT).as_posix(),'boatScale':.5,'characterShift':[0,0,.14],'waterZ':-.355,'bakedAssemblyCoordinates':True,'interiorBenchFacesRemoved':removed,'exteriorHullDeformed':False,'seatTopZ':.007,'seatBoundsXY':[[-.06,.22],[-.24,.24]],'outputSHA256':hashlib.sha256(out.read_bytes()).hexdigest(),'bytes':out.stat().st_size,'sourceActorModified':False,'sourceHullModified':False}
(OUT/'candidate.json').write_text(json.dumps(config,indent=2)+'\n');print('CENTER_BENCH',json.dumps(config),flush=True)
