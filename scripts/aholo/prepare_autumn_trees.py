"""Normalize IE-06/07 without decimation; preserve originals and render controlled evidence."""
import bpy, json, math, sys, hashlib
from pathlib import Path
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[2]
ID=sys.argv[sys.argv.index('--')+1]
NAME,HEIGHT={'06':('birch',6.5),'07':('maple',6.0)}[ID]
RUN=ROOT/f'assets/lux3d/ie-{ID}-{NAME}-v1'
OUT=ROOT/'public/assets/island-trees'/f'{NAME}.glb'
FOLDER=ROOT/'docs/evidence/2026-10-29-autumn-trees'/NAME
FOLDER.mkdir(parents=True,exist_ok=True)
source=next(RUN.glob('output-*.glb'))
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(source))
scene=bpy.context.scene
meshes=[o for o in scene.objects if o.type=='MESH']
for o in meshes:
    transform=o.matrix_world.copy();o.parent=None;o.matrix_world.identity();o.data.transform(transform)
points=[v.co.copy() for o in meshes for v in o.data.vertices]
lo=Vector([min(p[i] for p in points) for i in range(3)])
hi=Vector([max(p[i] for p in points) for i in range(3)])
factor=HEIGHT/(hi.z-lo.z)
for o in meshes:
    for v in o.data.vertices:v.co=(v.co-Vector(((lo.x+hi.x)/2,(lo.y+hi.y)/2,lo.z)))*factor
    o.data.update()
triangles=sum(len(p.vertices)-2 for o in meshes for p in o.data.polygons)
scene.render.engine='CYCLES';scene.cycles.samples=16;scene.cycles.use_denoising=False
scene.render.resolution_x=scene.render.resolution_y=900;scene.render.resolution_percentage=100
scene.view_settings.view_transform='Standard'
world=bpy.data.worlds.new('Neutral review');world.use_nodes=True
world.node_tree.nodes['Background'].inputs[0].default_value=(.7,.7,.7,1)
world.node_tree.nodes['Background'].inputs[1].default_value=.7;scene.world=world
sun=bpy.data.objects.new('Key',bpy.data.lights.new('Key','SUN'));sun.data.energy=2
sun.rotation_euler=(.7,-.4,-.6);scene.collection.objects.link(sun)
camera=bpy.data.objects.new('Camera',bpy.data.cameras.new('Camera'));camera.data.type='ORTHO'
camera.data.ortho_scale=HEIGHT*1.2;scene.collection.objects.link(camera);scene.camera=camera
def render(name,angle):
    centre=Vector((0,0,HEIGHT/2));camera.location=centre+Vector((math.sin(angle),-math.cos(angle),.2))*HEIGHT*2
    camera.rotation_euler=(centre-camera.location).to_track_quat('-Z','Y').to_euler()
    scene.render.filepath=str(FOLDER/f'{name}.png');bpy.ops.render.render(write_still=True)
render('before',.45)
for o in meshes:
    for m in o.data.materials:
        bsdf=m.node_tree.nodes.get('Principled BSDF') if m and m.use_nodes else None
        if not bsdf:continue
        for slot,value in [('Metallic',0),('Roughness',.88)]:
            for link in list(bsdf.inputs[slot].links):m.node_tree.links.remove(link)
            bsdf.inputs[slot].default_value=value
render('after',.45);render('back',math.pi+.45)
bpy.ops.wm.save_as_mainfile(filepath=str(RUN/'normalized.blend'))
bpy.ops.object.select_all(action='DESELECT')
for o in meshes:o.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(OUT),export_format='GLB',use_selection=True,export_animations=False,export_image_format='WEBP',export_image_quality=90)
vertices=[v.co for o in meshes for v in o.data.vertices]
radius=max(math.hypot(p.x,p.y) for p in vertices if .15<p.z<1.2)
crown=max(math.hypot(p.x,p.y) for p in vertices if p.z>HEIGHT*.3)
template={'frame':{'center':[0,HEIGHT/2,0],'half':HEIGHT/2},'colliders':[[0,0,round(radius,4)]],'crown':{'y':HEIGHT*.62,'r':round(crown,4)}}
# Separate output is merged only after review; never overwrite existing tree templates.
(FOLDER/'template.json').write_text(json.dumps(template,indent=2)+'\n',encoding='utf-8')
record={'asset':ID,'name':NAME,'taskId':json.loads((RUN/'ledger.json').read_text())['taskId'],
    'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'sourceTriangles':triangles,'runtimeTriangles':triangles,
    'height':HEIGHT,'bodyRadius':radius,'crownRadius':crown,'decimated':False,
    'uvLayers':[len(o.data.uv_layers) for o in meshes],
    'finiteNormals':all(all(math.isfinite(n) for n in v.normal) for o in meshes for v in o.data.vertices),
    'images':[{'name':im.name,'size':list(im.size)} for im in bpy.data.images],
    'files':[{'path':OUT.relative_to(ROOT).as_posix(),'bytes':OUT.stat().st_size,'sha256':hashlib.sha256(OUT.read_bytes()).hexdigest()}]}
(FOLDER/'runtime.json').write_text(json.dumps(record,indent=2)+'\n',encoding='utf-8')
print(json.dumps(record))
