"""Normalize/review confirmed trees without reducing runtime geometry. Optional LOD trial stays outside public/."""
import bpy, json, math, sys, hashlib
from pathlib import Path
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[2]
CATALOG={'01':('old-pine',8.0),'05':('spruce',9.0)}
OUT=ROOT/'public/assets/island-trees'
EVIDENCE=ROOT/'docs/evidence/assets/2026-10-29-island-trees'
OUT.mkdir(parents=True,exist_ok=True)
templates={}
trial_lod='--lod-trial' in sys.argv
def triangles(meshes):return sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in meshes)
def export(path,meshes):
 bpy.ops.object.select_all(action='DESELECT')
 for o in meshes:o.select_set(True)
 bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_animations=False,export_image_format='WEBP',export_image_quality=90)
def render(scene,path,height,angle):
 centre=Vector((0,0,height/2));scene.camera.location=centre+Vector((math.sin(angle),-math.cos(angle),.25))*height*2
 scene.camera.rotation_euler=(centre-scene.camera.location).to_track_quat('-Z','Y').to_euler()
 scene.render.filepath=str(path);bpy.ops.render.render(write_still=True)

for id,(name,height) in CATALOG.items():
 run=ROOT/f'assets/lux3d/ie-{id}-{name}-v1'
 source=next(run.glob('output-*.glb'))
 folder=EVIDENCE/name/'retained-detail';folder.mkdir(parents=True,exist_ok=True)
 bpy.ops.wm.read_factory_settings(use_empty=True)
 scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=16;scene.cycles.use_denoising=False
 scene.render.resolution_x=scene.render.resolution_y=1024;scene.render.resolution_percentage=100
 scene.view_settings.view_transform='Standard'
 world=bpy.data.worlds.new('Review');world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.7,.7,.7,1);world.node_tree.nodes['Background'].inputs[1].default_value=.7;scene.world=world
 bpy.ops.import_scene.gltf(filepath=str(source))
 meshes=[o for o in scene.objects if o.type=='MESH']
 for o in meshes:
  transform=o.matrix_world.copy();o.parent=None;o.matrix_world.identity();o.data.transform(transform)
 points=[v.co.copy() for o in meshes for v in o.data.vertices]
 low=Vector([min(p[i] for p in points) for i in range(3)]);high=Vector([max(p[i] for p in points) for i in range(3)])
 scale=height/(high.z-low.z)
 for o in meshes:
  for v in o.data.vertices:v.co=(v.co-Vector(((low.x+high.x)/2,(low.y+high.y)/2,low.z)))*scale
  o.data.update()
 sun=bpy.data.objects.new('Review key',bpy.data.lights.new('Review key','SUN'));sun.data.energy=2;sun.rotation_euler=(.7,-.4,-.6);scene.collection.objects.link(sun)
 camera=bpy.data.objects.new('Camera',bpy.data.cameras.new('Camera'));camera.data.type='ORTHO';camera.data.ortho_scale=height*1.15;scene.collection.objects.link(camera);scene.camera=camera
 raw=triangles(meshes)
 render(scene,folder/'before.png',height,.45)
 for o in meshes:
  for m in o.data.materials:
   bsdf=m.node_tree.nodes.get('Principled BSDF') if m and m.use_nodes else None
   if bsdf:
    for slot,value in [('Metallic',0),('Roughness',.88)]:
     for link in list(bsdf.inputs[slot].links):m.node_tree.links.remove(link)
     bsdf.inputs[slot].default_value=value
 bpy.ops.wm.save_as_mainfile(filepath=str(run/'normalized.blend'))
 # First 50k/14k trial visibly shredded leaf groups. Keep source geometry nearby;
 # only use the reviewed 50k simplification at long distance, with the full textures.
 runtime=triangles(meshes);export(OUT/f'{name}.glb',meshes)
 render(scene,folder/'after.png',height,.45);render(scene,folder/'back.png',height,math.pi+.45)
 vertices=[v.co for o in meshes for v in o.data.vertices]
 # Conservatively enclose all actual geometry in the raccoon's body band; crowns remain camera-only.
 body=[p for p in vertices if .15<p.z<1.2]
 radius=max((math.hypot(p.x,p.y) for p in body),default=.3)
 crown=max(math.hypot(p.x,p.y) for p in vertices if p.z>height*.3)
 templates['ie-'+name]={'frame':{'center':[0,height/2,0],'half':height/2},'colliders':[[0,0,round(radius,4)]],'crown':{'y':height*.6,'r':round(crown,4)}}
 if trial_lod:
  for o in meshes:
   mod=o.modifiers.new('Distant foliage','DECIMATE');mod.ratio=min(1,50000/runtime);mod.use_collapse_triangulate=True
   bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name)
  export(run/f'{name}-lod-candidate.glb',meshes)
  render(scene,folder/'lod.png',height,.45)
 record={'asset':id,'name':name,'taskId':json.loads((run/'ledger.json').read_text())['taskId'],'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'sourceTriangles':raw,'runtimeTriangles':runtime,'lodCandidateTriangles':triangles(meshes) if trial_lod else None,'lodAdopted':False,'height':height,'bodyRadius':radius,'crownRadius':crown,'files':[{'path':p.relative_to(ROOT).as_posix(),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in [OUT/f'{name}.glb']]}
 (folder/'runtime.json').write_text(json.dumps(record,indent=2),encoding='utf-8')
 print(json.dumps(record))
(ROOT/'src/world/island-tree-templates.json').write_text(json.dumps(templates,indent=2)+'\n',encoding='utf-8')
