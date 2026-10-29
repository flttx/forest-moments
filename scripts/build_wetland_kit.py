"""IE-04: original Blender boardwalk and small bankside rushes. No paid generation or decimation.
Run with scripts/aholo/blender_run.py. Z=0 is the walking surface; glTF converts Z-up to Y-up.
"""
import bpy, json, math, random, hashlib
import numpy as np
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public/assets/expansion/wetland-kit.glb'
WORK = ROOT / 'assets/blender/wetland'
EVIDENCE = ROOT / 'docs/evidence/2026-10-29-wetland'
for folder in [OUT.parent, WORK, EVIDENCE]:
    folder.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
rng = random.Random(204)

# A packed, original wood-grain image: muted grey-brown palette, long fibres and occasional knots.
# This is material authoring, not an edit of the AI reference image.
w, h = 512, 1024
v, u = np.mgrid[0:h, 0:w].astype(np.float32)
u /= w; v /= h
warp = u + .012*np.sin(v*21) + .006*np.sin(v*53+u*17)
grain = .035*np.sin(warp*430) + .02*np.sin(warp*1090+v*8) + .018*np.sin(warp*107)
for kx, ky in [(.28,.27),(.74,.72)]:
    d = np.sqrt(((u-kx)*2.5)**2 + ((v-ky)*.6)**2)
    grain += .035*np.sin(d*220)*np.exp(-d*17)
grain += np.random.default_rng(204).normal(0,.009,(h,w))
pixels = np.ones((h,w,4),dtype=np.float32)
pixels[:,:,:3] = np.clip(np.array([.43,.35,.255])+grain[:,:,None],0,1)
tex = bpy.data.images.new('Hand-painted muted wood grain',width=w,height=h)
tex.pixels.foreach_set(pixels.ravel()); tex.filepath_raw=str(WORK/'wood-grain.png'); tex.file_format='PNG'; tex.save(); tex.pack()

def material(name, texture=False):
    mat=bpy.data.materials.new(name); mat.use_nodes=True
    nodes=mat.node_tree.nodes; links=mat.node_tree.links; bsdf=nodes['Principled BSDF']
    bsdf.inputs['Roughness'].default_value=.92
    col=nodes.new('ShaderNodeVertexColor'); col.layer_name='Col'
    if texture:
        image=nodes.new('ShaderNodeTexImage'); image.image=tex
        mix=nodes.new('ShaderNodeMixRGB'); mix.blend_type='MULTIPLY'; mix.inputs[0].default_value=1
        links.new(image.outputs['Color'],mix.inputs[1]); links.new(col.outputs['Color'],mix.inputs[2]); links.new(mix.outputs[0],bsdf.inputs['Base Color'])
    else:
        links.new(col.outputs['Color'],bsdf.inputs['Base Color'])
    return mat
wood=material('Weathered warm wood',True); plant=material('Rush leaves and seed heads')

def finish(obj, tint, mat):
    mesh=obj.data
    col=mesh.color_attributes.new(name='Col',type='FLOAT_COLOR',domain='CORNER')
    for poly in mesh.polygons:
        shade=rng.uniform(.94,1.04)
        for index in poly.loop_indices: col.data[index].color=(*[c*shade for c in tint],1)
    obj.data.materials.append(mat)
    return obj

def block(name, loc, size, tint):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc)
    obj=bpy.context.object; obj.name=name; obj.scale=size
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    bevel=obj.modifiers.new('Worn edges','BEVEL'); bevel.width=.012; bevel.segments=2
    bpy.ops.object.modifier_apply(modifier=bevel.name)
    # Planar top UVs put the grain along the plank; vertical faces use the long horizontal axis.
    uv=obj.data.uv_layers.active
    for poly in obj.data.polygons:
        for li in poly.loop_indices:
            p=obj.data.vertices[obj.data.loops[li].vertex_index].co
            uv.data[li].uv=(p.x/size[0]+.5,p.y/size[1]+.5) if abs(poly.normal.z)>.5 else (p.z*2+.5,(p.y/size[1]+p.x/size[0])*.5+.5)
    return finish(obj,tint,wood)

def join(parts,name):
    bpy.ops.object.select_all(action='DESELECT')
    for obj in parts:obj.select_set(True)
    bpy.context.view_layer.objects.active=parts[0]; bpy.ops.object.join()
    obj=bpy.context.object; obj.name=name
    bpy.context.scene.cursor.location=(0,0,0); bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
    return obj

parts=[]
for i in range(10):
    tint=rng.uniform(.82,1.12)
    parts.append(block('Plank',(-1.08+i*.24,0,-.055),(.224,1.9,.11),(tint,tint,tint)))
    for y in [-.68,.68]:
        bpy.ops.mesh.primitive_cylinder_add(vertices=8,radius=.018,depth=.006,location=(-1.08+i*.24,y,.003))
        parts.append(finish(bpy.context.object,(.07,.065,.05),wood))
for y in [-.68,.68]:
    parts.append(block('Stringer',(0,y,-.21),(2.4,.14,.22),(.66,.64,.6)))
    for x in [-.87,.87]:
        parts.append(block('Support',(x,y,-.53),(.17,.17,.94),(.63,.64,.57)))
board=join(parts,'Boardwalk_240')

# Curved folded leaf ribbons rather than crossed flat grass cards; three restrained seed heads.
parts=[]
for i in range(13):
    a=i*2.399; height=rng.uniform(.38,.86); bend=rng.uniform(.18,.4)
    verts=[]; faces=[]
    for step in range(7):
        t=step/6; spread=bend*t*t; width=.032*math.sin(math.pi*(t*.9+.08))*(1-t*.8)
        x,y=math.cos(a)*spread,math.sin(a)*spread
        for side in [-1,0,1]:verts.append((x-side*math.sin(a)*width,y+side*math.cos(a)*width,height*t+(width*.3 if side==0 else 0)))
    for j in range(6):
        for k in range(2):n=j*3+k; faces.append((n,n+1,n+4,n+3))
    mesh=bpy.data.meshes.new('Folded rush blade'); mesh.from_pydata(verts,[],faces); mesh.update()
    obj=bpy.data.objects.new('Leaf',mesh); bpy.context.collection.objects.link(obj)
    parts.append(finish(obj,(.12+rng.random()*.05,.21+rng.random()*.05,.065),plant))
for x,y,height in [(-.07,.04,.88),(.09,.08,1.04),(.02,-.1,.72)]:
    bpy.ops.mesh.primitive_cylinder_add(vertices=7,radius=.012,depth=height,location=(x,y,height/2))
    parts.append(finish(bpy.context.object,(.16,.22,.065),plant))
    bpy.ops.mesh.primitive_uv_sphere_add(segments=10,ring_count=6,radius=1,location=(x,y,height))
    obj=bpy.context.object; obj.scale=(.038,.038,.12); bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    parts.append(finish(obj,(.16,.09,.035),plant))
rush=join(parts,'Rush_Clump')
plant.use_backface_culling=False
bpy.ops.object.select_all(action='DESELECT')
for obj in [board,rush]:obj.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(OUT),export_format='GLB',use_selection=True,export_animations=False,export_vertex_color='NAME',export_vertex_color_name='Col',export_all_vertex_colors=False)
bpy.ops.wm.save_as_mainfile(filepath=str(WORK/'wetland-kit.blend'))
summary={'blender':bpy.app.version_string,'source':'Local Blender authoring; IE-04 reference; no paid API call','decimated':False,'bytes':OUT.stat().st_size,'sha256':hashlib.sha256(OUT.read_bytes()).hexdigest(),'texture':[w,h],'modules':[]}
for obj in [board,rush]:
    obj.data.calc_loop_triangles()
    summary['modules'].append({'name':obj.name,'triangles':len(obj.data.loop_triangles),'sizeBlenderXYZ':list(obj.dimensions)})
(EVIDENCE/'blender.json').write_text(json.dumps(summary,indent=2),encoding='utf-8')

# Actual Blender review render, independent of runtime screenshot evidence.
rush.hide_render=True
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-1.02))
floor=bpy.context.object
mat=bpy.data.materials.new('Backdrop'); mat.diffuse_color=(.6,.62,.57,1); floor.data.materials.append(mat)
bpy.ops.object.light_add(type='AREA',location=(1,-3,6)); bpy.context.object.data.energy=550; bpy.context.object.data.shape='DISK'; bpy.context.object.data.size=5
bpy.ops.object.camera_add(location=(3.8,-4.6,3.2)); camera=bpy.context.object; camera.rotation_euler=(Vector((0,0,-.2))-camera.location).to_track_quat('-Z','Y').to_euler(); camera.data.type='ORTHO'; camera.data.ortho_scale=4.5
scene=bpy.context.scene; scene.camera=camera; scene.render.engine='CYCLES'; scene.cycles.samples=24; scene.cycles.use_denoising=False
scene.world=bpy.data.worlds.new('Review world'); scene.world.color=(.45,.45,.45); scene.render.resolution_x=1000; scene.render.resolution_y=760; scene.render.resolution_percentage=100
scene.render.filepath=str(EVIDENCE/'boardwalk-blender.png'); bpy.ops.render.render(write_still=True)
print(json.dumps(summary))
