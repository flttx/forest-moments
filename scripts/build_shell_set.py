"""Tide shells: four original shell forms for the Tide Isle shore (scallop, turban, cowrie, clam); no paid call or decimation.
Run: python scripts/aholo/blender_run.py scripts/build_shell_set.py --blender "<blender.exe>"
"""
import bpy, bmesh, math, random, json, hashlib
from pathlib import Path
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'public/assets/expansion/shell-set.glb'
WORK=ROOT/'assets/blender/shells'
EVIDENCE=ROOT/'docs/evidence/2026-11-03-archipelago/phase3/3b'
for folder in [OUT.parent,WORK,EVIDENCE]:folder.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
rng=random.Random(1103)

def build(name,verts,faces,colours,roughness):
    """colours: one RGB per vertex; written per corner so the GLB carries them."""
    mesh=bpy.data.meshes.new(name+' geometry');mesh.from_pydata(verts,[],faces);mesh.update()
    obj=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(obj)
    col=mesh.color_attributes.new(name='Col',type='FLOAT_COLOR',domain='CORNER')
    for poly in mesh.polygons:
        for loop in poly.loop_indices:col.data[loop].color=(*colours[mesh.loops[loop].vertex_index],1)
    bm=bmesh.new();bm.from_mesh(mesh);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(mesh);bm.free()
    for poly in mesh.polygons:poly.use_smooth=True
    mat=bpy.data.materials.new(name+' shell');mat.use_nodes=True;mat.use_backface_culling=False
    bsdf=mat.node_tree.nodes['Principled BSDF'];bsdf.inputs['Roughness'].default_value=roughness
    node=mat.node_tree.nodes.new('ShaderNodeVertexColor');node.layer_name='Col';mat.node_tree.links.new(node.outputs['Color'],bsdf.inputs['Base Color'])
    mesh.materials.append(mat)
    return obj

def grid(rows,cols,point,colour,close_cols=False):
    """Quad grid over (u,v) in [0,1]^2, optionally wrapped in v."""
    verts=[];colours=[];faces=[]
    span=cols if close_cols else cols+1
    for i in range(rows+1):
        for j in range(span):
            u=i/rows;v=j/cols;verts.append(point(u,v));colours.append(colour(u,v))
    for i in range(rows):
        for j in range(cols if close_cols else cols):
            a=i*span+j;b=i*span+(j+1)%span if close_cols else i*span+j+1
            faces.append((a,b,b+span,a+span))
    return verts,faces,colours

def lerp(a,b,t):return tuple(x+(y-x)*t for x,y in zip(a,b))

# Scallop: a ribbed fan with a low dome and two hinge ears; cream to coral bands across the ribs.
def scallop_point(u,v):
    a=math.radians(-70+140*v);r=.036*u**.9
    rib=.0022*abs(math.sin(v*math.pi*15))*u
    return Vector((math.sin(a)*r,math.cos(a)*r-.012,.011*(1-u**2)*math.sin(min(u*4,1)*math.pi/2)+rib+.001))
def scallop_colour(u,v):
    band=.5+.5*math.sin(u*26+v*3)
    return lerp((.86,.74,.6),(.78,.4,.3),band*.6*(u>.25))
v,f,c=grid(16,60,scallop_point,scallop_colour)
for side in (-1,1):  # hinge ears: small flat wings either side of the hinge
    base=len(v);v.extend([Vector((0,-.012,.004)),Vector((side*.012,-.014,.003)),Vector((side*.011,-.006,.004)),Vector((side*.002,-.004,.006))]);c.extend([(.82,.68,.55)]*4)
    f.append((base,base+1,base+2,base+3) if side>0 else (base+3,base+2,base+1,base))
scallop=build('Shell_Scallop',v,f,c,.55)

# Turban: a tightening spiral tube rising to a point, brown with cream flame stripes.
turns=3.4
def turban_point(u,v):
    # start a little up the whorl so the aperture sits against the body instead of flaring out as a flap
    t=.08+.92*u;theta=t*turns*2*math.pi;R=.013*(1-t)**1.05;tube=.0105*(1-t)**1.1+.0006
    centre=Vector((math.cos(theta)*R,math.sin(theta)*R,.03*t**.85))
    outward=Vector((math.cos(theta),math.sin(theta),0));up=Vector((0,0,1))
    phi=v*2*math.pi
    return centre+outward*math.cos(phi)*tube+up*math.sin(phi)*tube*.9
def turban_colour(u,v):
    flame=math.sin(u*turns*2*math.pi*6+v*2)>.35
    return (.82,.72,.56) if flame else (.42,.28,.18)
v,f,c=grid(120,14,turban_point,turban_colour,close_cols=True)
turban=build('Shell_Turban',v,f,c,.5)

# Cowrie: a glossy flattened egg with a toothed slit underneath and dark spots over a honey back.
def cowrie_point(u,v):
    lat=(u-.5)*math.pi;lon=v*2*math.pi
    x=.022*math.cos(lat)*math.cos(lon);y=.015*math.cos(lat)*math.sin(lon);z=.012*math.sin(lat)+.012
    if z<.006:z=.006-(.006-z)*.25  # flat underside
    slit=math.exp(-((y/.0015)**2))*(z<.0075)*.0012
    return Vector((x,y,z+slit))
def cowrie_colour(u,v):
    p=cowrie_point(u,v)
    if p.z<.007:return (.88,.82,.7)
    spot=math.sin(p.x*900)*math.sin(p.y*1100)>.55
    return (.34,.22,.14) if spot else (.74,.56,.34)
v,f,c=grid(24,40,cowrie_point,cowrie_colour,close_cols=True)
cowrie=build('Shell_Cowrie',v,f,c,.28)

# Clam: a smooth dome with concentric growth rings, pale lilac grey.
def clam_point(u,v):
    # a deep dome whose crown (the umbo) leans toward the hinge, with fine growth ridges
    a=v*2*math.pi;r=.025*u
    x=math.cos(a)*r*1.12;y=math.sin(a)*r
    ring=.0005*math.sin(u*48)
    crown=Vector((0,-.007,0))*(1-u)**2
    return Vector((x,y,.015*math.sqrt(max(0,1-u**2.2))+ring+.001))+crown
def clam_colour(u,v):
    ring=.5+.5*math.sin(u*48);ray=.5+.5*math.sin(v*2*math.pi*7)
    return lerp(lerp((.82,.76,.72),(.55,.45,.5),ray*.55*u),(.42,.34,.38),ring*.25+(u>.92)*.35)
v,f,c=grid(20,48,clam_point,clam_colour,close_cols=True)
clam=build('Shell_Clam',v,f,c,.5)

shells=[scallop,turban,cowrie,clam]
for i,obj in enumerate(shells):obj.location=(i*.1,0,0)
bpy.ops.object.select_all(action='DESELECT')
for obj in shells:obj.select_set(True)
bpy.context.view_layer.objects.active=scallop
# Export each at the origin; the review layout above is only for the render.
for obj in shells:obj.location=(0,0,0)
bpy.ops.export_scene.gltf(filepath=str(OUT),export_format='GLB',use_selection=True,export_animations=False,export_vertex_color='NAME',export_vertex_color_name='Col',export_all_vertex_colors=False)
bpy.ops.wm.save_as_mainfile(filepath=str(WORK/'shell-set.blend'))
summary={'source':'Original Blender geometry for the Tide Isle shore; no reference image or texture copied','blender':bpy.app.version_string,'shells':{}}
for obj in shells:
    obj.data.calc_loop_triangles();summary['shells'][obj.name]={'triangles':len(obj.data.loop_triangles),'sizeXYZ':[round(d,4) for d in obj.dimensions]}
summary.update({'bytes':OUT.stat().st_size,'sha256':hashlib.sha256(OUT.read_bytes()).hexdigest(),'decimated':False,'paidCalls':0})
(EVIDENCE/'shell-validation.json').write_text(json.dumps(summary,indent=2),encoding='utf-8')
for i,obj in enumerate(shells):obj.location=(i*.075-.11,0,0)
bpy.ops.mesh.primitive_plane_add(size=2,location=(0,0,0))
floor=bpy.context.object;fm=bpy.data.materials.new('Sand backdrop');fm.diffuse_color=(.62,.56,.46,1);floor.data.materials.append(fm)
bpy.ops.object.light_add(type='AREA',location=(.1,-.25,.45));bpy.context.object.data.energy=3;bpy.context.object.data.size=.4
bpy.ops.object.camera_add(location=(0,-.2,.16));cam=bpy.context.object;cam.rotation_euler=(Vector((0,0,.008))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=.32
scene=bpy.context.scene;scene.camera=cam;scene.render.engine='CYCLES';scene.cycles.samples=32;scene.cycles.use_denoising=False
scene.world=bpy.data.worlds.new('Review world');scene.world.color=(.22,.22,.22)
scene.render.resolution_x=1000;scene.render.resolution_y=420;scene.render.resolution_percentage=100
scene.render.filepath=str(EVIDENCE/'shell-blender.png');bpy.ops.render.render(write_still=True)
print(json.dumps(summary))
