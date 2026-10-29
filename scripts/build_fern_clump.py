"""IE-03: original pinnate fern, authored from the approved shape reference; no paid call or decimation."""
import bpy, bmesh, math, random, json, hashlib
from pathlib import Path
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'public/assets/expansion/fern-clump.glb'
WORK=ROOT/'assets/blender/fern'
EVIDENCE=ROOT/'docs/evidence/2026-10-29-mist-detail'
for folder in [OUT.parent,WORK,EVIDENCE]:folder.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
rng=random.Random(303)
verts=[];faces=[];colours=[]
def face(points,colour):
    start=len(verts);verts.extend(points);faces.append(tuple(range(start,len(verts))));colours.append(colour)

# Nine differently arched fronds. Leaflets are actual folded geometry, with no alpha-card rectangles.
for frond in range(9):
    a=frond*2.399963;reach=[.42,.5,.31][frond%3];height=[.41,.46,.64][frond%3]
    direction=Vector((math.cos(a),math.sin(a),0));side=Vector((-math.sin(a),math.cos(a),0))
    def stem(t):return direction*(reach*t**1.35)+Vector((0,0,height*math.sin(t*math.pi*.74)))
    colour=Vector((.13,.215,.057))*(.85+rng.random()*.28)
    # Thin rachis ribbon with a raised centre, shared hue with the green leaf midribs.
    for j in range(24):
        t=j/24;u=(j+1)/24;w=.0045*(1-t)+.001
        face([stem(t)-side*w,stem(u)-side*w,stem(u)+side*w,stem(t)+side*w],(.18,.26,.07))
    for j in range(13):
        t=.16+j*.062
        for sign in [-1,1]:
            base=stem(t+(sign+1)*.007)
            length=.115*(math.sin(math.pi*t)**.72)
            tangent=(stem(t+.01)-stem(t-.01)).normalized()
            axis=(side*sign*.92+tangent*.39).normalized()
            cross=(tangent*.92-side*sign*.39).normalized()
            normal=axis.cross(cross).normalized()
            # Blunt lanceolate outline with shallow lobes; a folded midrib catches soft highlights.
            outline=[]
            for fraction,width in [(0,0),(.2,.27),(.38,.33),(.52,.29),(.68,.26),(.84,.16),(1,0),(.84,-.16),(.68,-.26),(.52,-.29),(.38,-.33),(.2,-.27)]:
                point=base+axis*(length*fraction)+cross*(length*width)
                point+=normal*(.006*math.sin(math.pi*fraction))
                point.z-=.012*fraction*fraction
                outline.append(point)
            centre=base+axis*(length*.48)+normal*.006
            for k in range(len(outline)):
                shade=.9+rng.random()*.16
                face([outline[k],outline[(k+1)%len(outline)],centre],tuple(colour*shade))

mesh=bpy.data.meshes.new('Pinnate fern geometry');mesh.from_pydata(verts,[],faces);mesh.update()
obj=bpy.data.objects.new('Fern_Clump',mesh);bpy.context.collection.objects.link(obj)
col=mesh.color_attributes.new(name='Col',type='FLOAT_COLOR',domain='CORNER')
for poly,colour in zip(mesh.polygons,colours):
    for index in poly.loop_indices:col.data[index].color=(*colour,1)
# Weld identical leaflet corners for continuous shading; no faces are removed or simplified.
bm=bmesh.new();bm.from_mesh(mesh);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.000001);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(mesh);bm.free()
for poly in mesh.polygons:poly.use_smooth=True
mat=bpy.data.materials.new('Muted olive fern');mat.use_nodes=True;mat.use_backface_culling=False
bsdf=mat.node_tree.nodes['Principled BSDF'];bsdf.inputs['Roughness'].default_value=.88
node=mat.node_tree.nodes.new('ShaderNodeVertexColor');node.layer_name='Col';mat.node_tree.links.new(node.outputs['Color'],bsdf.inputs['Base Color'])
mesh.materials.append(mat);bpy.context.view_layer.objects.active=obj;obj.select_set(True);bpy.context.view_layer.update()
bpy.ops.export_scene.gltf(filepath=str(OUT),export_format='GLB',use_selection=True,export_animations=False,export_vertex_color='NAME',export_vertex_color_name='Col',export_all_vertex_colors=False)
bpy.ops.wm.save_as_mainfile(filepath=str(WORK/'fern-clump.blend'))
mesh.calc_loop_triangles()
summary={'source':'Original Blender geometry guided by IE-03 reference; no texture copied','blender':bpy.app.version_string,'fronds':9,'triangles':len(mesh.loop_triangles),'sizeBlenderXYZ':list(obj.dimensions),'bytes':OUT.stat().st_size,'sha256':hashlib.sha256(OUT.read_bytes()).hexdigest(),'doubleSided':True,'alphaCards':False,'decimated':False,'paidCalls':0}
(EVIDENCE/'fern-validation.json').write_text(json.dumps(summary,indent=2),encoding='utf-8')
bpy.ops.mesh.primitive_plane_add(size=20,location=(0,0,-.007))
floor=bpy.context.object;fm=bpy.data.materials.new('Review backdrop');fm.diffuse_color=(.5,.51,.46,1);floor.data.materials.append(fm)
bpy.ops.object.light_add(type='AREA',location=(1,-2,4));bpy.context.object.data.energy=300;bpy.context.object.data.size=3
bpy.ops.object.camera_add(location=(1.1,-1.5,.95));cam=bpy.context.object;cam.rotation_euler=(Vector((0,0,.29))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=1.35
scene=bpy.context.scene;scene.camera=cam;scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=False
scene.world=bpy.data.worlds.new('Review world');scene.world.color=(.4,.4,.4)
scene.render.resolution_x=900;scene.render.resolution_y=760;scene.render.resolution_percentage=100
scene.render.filepath=str(EVIDENCE/'fern-blender.png');bpy.ops.render.render(write_still=True)
print(json.dumps(summary))
