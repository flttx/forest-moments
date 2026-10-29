"""Inspect and derive a full-geometry spruce crown variant in an isolated Blender process."""
import bpy, json, math, sys, hashlib
from pathlib import Path
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/'public/assets/island-trees/spruce.glb'
WORK=ROOT/'assets/blender/spruce-sapling'
EVIDENCE=ROOT/'docs/evidence/2026-10-29-spruce-sapling'
for p in [WORK,EVIDENCE]:p.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(SOURCE))
meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
for o in meshes:
 transform=o.matrix_world.copy();o.parent=None;o.matrix_world.identity();o.data.transform(transform)
inspection=[]
for o in meshes:
 parent=list(range(len(o.data.vertices)))
 def find(a):
  while parent[a]!=a:parent[a]=parent[parent[a]];a=parent[a]
  return a
 for e in o.data.edges:
  a,b=e.vertices;parent[find(a)]=find(b)
 groups={}
 for v in o.data.vertices:groups.setdefault(find(v.index),[]).append(v.index)
 inspection.append({'name':o.name,'vertices':len(o.data.vertices),'triangles':sum(len(p.vertices)-2 for p in o.data.polygons),'materials':[m.name for m in o.data.materials],'components':len(groups),'largestComponents':sorted([len(g) for g in groups.values()],reverse=True)[:20],'bounds':[[min(v.co[k] for v in o.data.vertices),max(v.co[k] for v in o.data.vertices)] for k in range(3)]})
(EVIDENCE/'source-inspection.json').write_text(json.dumps({'blender':bpy.app.version_string,'source':str(SOURCE.relative_to(ROOT)),'sha256':hashlib.sha256(SOURCE.read_bytes()).hexdigest(),'meshes':inspection},indent=2),encoding='utf-8')
print(json.dumps(inspection))
if '--inspect-only' in sys.argv:sys.exit(0)

scene=bpy.context.scene
scene.render.engine='CYCLES';scene.cycles.samples=16;scene.cycles.use_denoising=False
scene.render.resolution_x=scene.render.resolution_y=900;scene.render.resolution_percentage=100
scene.view_settings.view_transform='Standard'
world=bpy.data.worlds.new('Review');world.use_nodes=True
world.node_tree.nodes['Background'].inputs[0].default_value=(.7,.7,.7,1)
world.node_tree.nodes['Background'].inputs[1].default_value=.7;scene.world=world
sun=bpy.data.objects.new('Review key',bpy.data.lights.new('Review key','SUN'))
sun.data.energy=2;sun.rotation_euler=(.7,-.4,-.6);scene.collection.objects.link(sun)
camera=bpy.data.objects.new('Camera',bpy.data.cameras.new('Camera'))
camera.data.type='ORTHO';camera.data.ortho_scale=4.5;scene.collection.objects.link(camera);scene.camera=camera
def render(name,angle=.45):
 centre=Vector((0,0,1.9));camera.location=centre+Vector((math.sin(angle),-math.cos(angle),.12))*8
 camera.rotation_euler=(centre-camera.location).to_track_quat('-Z','Y').to_euler()
 scene.render.filepath=str(EVIDENCE/name);bpy.ops.render.render(write_still=True)
def smooth(a,b,t):
 t=max(0,min(1,(t-a)/(b-a)));return t*t*(3-2*t)
original={o.name:[v.co.copy() for v in o.data.vertices] for o in meshes}
# Same final height and studio framing: compare uniform scaling to a reshaped crown.
for o in meshes:
 for v,p in zip(o.data.vertices,original[o.name]):v.co=p*(3.8/9)
 o.data.update()
render('uniform-front.png')
for o in meshes:
 for v,p in zip(o.data.vertices,original[o.name]):
  t=p.z/9;r=math.hypot(p.x,p.y);a=math.atan2(p.y,p.x)
  # A thin root flare, shortened lower boughs, broader upper whorls and a mild bend.
  radial=.25+.25*smooth(.05,.7,t)
  asymmetry=1+.13*math.sin(a*2+t*4)*smooth(.12,.3,t)
  twist=.16*math.sin(t*math.pi);c=math.cos(twist);s=math.sin(twist)
  x=(c*p.x-s*p.y)*radial*asymmetry+.13*t*t
  y=(s*p.x+c*p.y)*radial*asymmetry-.07*t*t
  z=p.z*(3.8/9)+.065*r*r*math.sin(a+.4)*smooth(.12,.3,t)*(1-smooth(.7,.95,t))
  v.co=(x,y,z)
 o.data.update()
 o.name='Spruce_Sapling'
 # Recalculate normals after the continuous deformation, keeping every face and UV.
 bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o
 if o.data.has_custom_normals:bpy.ops.mesh.customdata_custom_splitnormals_clear()
 o.data.validate();o.data.update()
bpy.context.view_layer.update()
render('sapling-front.png');render('sapling-back.png',math.pi+.45);render('sapling-side.png',math.pi/2+.45)
bpy.ops.object.select_all(action='DESELECT')
for o in meshes:o.select_set(True)
bpy.context.view_layer.objects.active=meshes[0]
out=WORK/'spruce-sapling.glb'
bpy.ops.export_scene.gltf(filepath=str(out),export_format='GLB',use_selection=True,export_animations=False,export_image_format='AUTO')
bpy.ops.wm.save_as_mainfile(filepath=str(WORK/'spruce-sapling.blend'))
vertices=[v.co for o in meshes for v in o.data.vertices]
body=max(math.hypot(v.x,v.y) for v in vertices if .15<v.z<1.2)
crown=max(math.hypot(v.x,v.y) for v in vertices if v.z>1.2)
summary={'sourceTaskId':4461973,'source':str(SOURCE.relative_to(ROOT)),'sourceSha256':hashlib.sha256(SOURCE.read_bytes()).hexdigest(),'blender':bpy.app.version_string,'method':'continuous crown taper, asymmetric bough length, whorl twist and trunk bend; no uniform-scale-only claim','height':max(v.z for v in vertices),'triangles':sum(len(p.vertices)-2 for o in meshes for p in o.data.polygons),'sourceTriangles':sum(i['triangles'] for i in inspection),'bodyRadius':body,'crownRadius':crown,'vertices':len(vertices),'materials':sum(len(o.data.materials) for o in meshes),'uvLayers':[len(o.data.uv_layers) for o in meshes],'bytes':out.stat().st_size,'sha256':hashlib.sha256(out.read_bytes()).hexdigest(),'paidCalls':0,'decimated':False,'candidate':str(out.relative_to(ROOT))}
assert summary['triangles']==summary['sourceTriangles']
(EVIDENCE/'asset-validation.json').write_text(json.dumps(summary,indent=2),encoding='utf-8')
template={'frame':{'center':[0,summary['height']/2,0],'half':summary['height']/2},'colliders':[[0,0,round(body,4)]],'crown':{'y':2.3,'r':round(crown,4)}}
(EVIDENCE/'template.json').write_text(json.dumps(template,indent=2),encoding='utf-8')
print(json.dumps(summary))
