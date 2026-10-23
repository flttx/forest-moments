"""Low aft-seat review derivative; original actor, paddle and source hull retained."""
import bpy
import hashlib
import json
from pathlib import Path
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'docs/evidence/assets/2026-10-23-canoe-stern'
OUT.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'assets/lux3d/round-01/canoe/assembly-review-v2.blend'))
scene=bpy.context.scene
ratio=.85;shift=Vector((-.6,-.15,.2))
body=bpy.data.objects['Lux3D_canoe']
original=[body.matrix_world@v.co*ratio for v in body.data.vertices]
def ease(x):
    x=max(0,min(1,x));return x*x*(3-2*x)
def band(x,lo,hi,feather):return ease((x-lo+feather)/feather)*ease((hi+feather-x)/feather)
def deform(p):
    x,y,z=p
    # Continuous vertex warp retains every face, UV and material. No punched holes.
    w=ease((-.65-x)/.25)
    if z>-.17:z+=( -.17+(z+.17)*.06-z)*w
    w=band(x,-.76,-.45,.10)*band(y,-.38,-.25,.08)
    if z>-.12:z+=( -.12+(z+.12)*.10-z)*w
    w=band(x,-.35,-.1,.08)*band(y,-.45,-.34,.06)*band(z,-.20,-.08,.05)
    y-=.035*w
    return Vector((x,y,z))
exports=[];changes=[]
for name in ['Lux3D_canoe','Measured_hull_cavity_caps']:
    o=bpy.data.objects[name]
    normal_matrix=o.matrix_world.to_3x3().inverted().transposed()
    normals=[(normal_matrix@n.vector).normalized() for n in o.data.corner_normals]
    points=[o.matrix_world@v.co*ratio for v in o.data.vertices]
    changed=0;max_delta=0;changed_ids=set()
    for v,p in zip(o.data.vertices,points):
        q=deform(p);delta=(q-p).length
        changed+=int(delta>1e-7);max_delta=max(max_delta,delta);v.co=q
        if delta>1e-7:changed_ids.add(v.index)
        if p.x>=.12:assert (q-p).length<1e-7,'Forward hull shape changed'
    o.parent=None;o.matrix_world=Matrix.Identity(4)
    o.data.update()
    o.data.normals_split_custom_set([(0,0,0) if loop.vertex_index in changed_ids else normals[loop.index] for loop in o.data.loops])
    exports.append(o)
    changes.append({'mesh':name,'vertices':len(points),'changedVertices':changed,'maxMoveM':max_delta,'polygons':len(o.data.polygons)})

# Use a wood patch from the existing center bench. Shape only the new seat,
# below the complete source animation envelope, including the hanging garment.
source_face=min(body.data.polygons,key=lambda p:((sum((original[i] for i in p.vertices),Vector())/len(p.vertices))-Vector((0,0,-.1))).length)
wood_uv=sum((body.data.uv_layers.active.data[i].uv for i in source_face.loop_indices),Vector((0,0)))/len(source_face.loop_indices)
character=bpy.data.objects['ASSEMBLY_ONLY_character'];character.location+=shift
actor=next(o for o in scene.objects if o.type=='MESH' and any(m.type=='ARMATURE' for m in o.modifiers))
nx,ny=25,33
grid=[(-.63+.22*i/(nx-1),-.29+.30*j/(ny-1)) for i in range(nx) for j in range(ny)]
ceiling=[.135]*len(grid)
for frame in range(217):
    scene.frame_set(frame);bpy.context.view_layer.update()
    e=actor.evaluated_get(bpy.context.evaluated_depsgraph_get());m=e.to_mesh()
    tree=BVHTree.FromPolygons([actor.matrix_world@v.co for v in m.vertices],[tuple(p.vertices) for p in m.polygons]);e.to_mesh_clear()
    for k,(x,y) in enumerate(grid):
        p=tree.ray_cast(Vector((x,y,-.35)),Vector((0,0,1)),.65)[0]
        if p:ceiling[k]=min(ceiling[k],p.z-.012)
    if frame%60==0:print('SEAT_ENVELOPE',frame,flush=True)
# Conservative neighbourhood minimum prevents bilinear peaks between rays.
safe=[]
for i in range(nx):
    for j in range(ny):safe.append(min(ceiling[a*ny+b] for a in range(max(0,i-1),min(nx,i+2)) for b in range(max(0,j-1),min(ny,j+2))))
verts=[(x,y,z) for (x,y),z in zip(grid,safe)]
faces=[(i*ny+j,(i+1)*ny+j,(i+1)*ny+j+1,i*ny+j+1) for i in range(nx-1) for j in range(ny-1)]
mesh=bpy.data.meshes.new('Reused_original_bench_surface')
mesh.from_pydata(verts,[],faces);mesh.update()
for mat in body.data.materials:mesh.materials.append(mat)
uv=mesh.uv_layers.new(name='Original_wood_UV')
for target in mesh.polygons:
    target.material_index=source_face.material_index;target.use_smooth=True
    for a in target.loop_indices:
        p=mesh.vertices[mesh.loops[a].vertex_index].co
        uv.data[a].uv=wood_uv+Vector(((p.x+.52)*.10,(p.y+.14)*.10))
seat=bpy.data.objects.new('Aft_low_seat_original_wood',mesh);scene.collection.objects.link(seat)
bpy.context.view_layer.objects.active=seat;seat.select_set(True)
solid=seat.modifiers.new('Seat thickness','SOLIDIFY');solid.thickness=.025;solid.offset=-1
bpy.ops.object.modifier_apply(modifier=solid.name);exports.append(seat)
material=bpy.data.materials.get('Local warm timber repairs') or body.data.materials[0]
for x in [-.57,-.47]:
    top=min(safe[i*ny+j] for i in range(nx) for j in range(ny) if abs(grid[i*ny+j][0]-x)<.025 and abs(grid[i*ny+j][1]+.13)<.025)-.025
    bpy.ops.mesh.primitive_cube_add(size=1,location=(x,-.13,(top-.19)/2))
    support=bpy.context.object;support.name='Aft_low_seat_support';support.dimensions=(.035,.035,top+.19)
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    support.data.materials.append(material);exports.append(support)
bpy.context.view_layer.update()
bpy.ops.object.select_all(action='DESELECT')
for o in exports:o.select_set(True)
out=ROOT/'assets/lux3d/round-01/canoe/stern-seat-v2.glb'
bpy.ops.export_scene.gltf(filepath=str(out),export_format='GLB',use_selection=True,export_animations=False)
bpy.ops.wm.save_as_mainfile(filepath=str(out.with_suffix('.blend')))
report={'status':'candidate; geometry and visual checks pending','boatScale':.425,'characterShift':list(shift),'waterZ':-.30,'asset':'/'+out.relative_to(ROOT).as_posix(),'bakedAssemblyCoordinates':True,'changes':changes,'seatEnvelopeFrames':217,'seatHeightRange':[min(safe),max(safe)],'sourceSHA256':hashlib.sha256((ROOT/'public/assets/models/canoe.glb').read_bytes()).hexdigest(),'outputSHA256':hashlib.sha256(out.read_bytes()).hexdigest(),'actorModified':False,'paddleModified':False,'decimation':False}
(OUT/'candidate.json').write_text(json.dumps(report,indent=2)+'\n')
print('STERN_BUILD',json.dumps(report),flush=True)
