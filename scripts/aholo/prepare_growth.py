"""Normalize each AHOLO growth asset, preserve topology/UVs, render front/back evidence."""
import bpy,json,math,sys,hashlib
from pathlib import Path
from mathutils import Vector,Matrix
ROOT=Path(__file__).resolve().parents[2]
stage=sys.argv[sys.argv.index('--')+1]
height={'sprout':.22,'seedling':.55,'young':1.5,'mature':3}[stage]
archive=ROOT/f'assets/lux3d/growth-{stage}-v1'
out=ROOT/'docs/evidence/assets/2026-10-24-tree-growth'
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(archive/'output-1.glb'))
meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
for o in meshes:
 o.data.transform(o.matrix_world);o.matrix_world.identity()
pts=[v.co.copy() for o in meshes for v in o.data.vertices]
lo=[min(p[i] for p in pts) for i in range(3)];hi=[max(p[i] for p in pts) for i in range(3)]
base=[p for p in pts if p.z<lo[2]+(hi[2]-lo[2])*.02]
cx=sum(p.x for p in base)/len(base);cy=sum(p.y for p in base)/len(base)
scale=height/(hi[2]-lo[2]);matrix=Matrix.Diagonal((scale,scale,scale,1))@Matrix.Translation((-cx,-cy,-lo[2]))
for o in meshes:o.data.transform(matrix);o.data.update();o.name=f'Tree_{stage}'
triangles=sum(len(p.vertices)-2 for o in meshes for p in o.data.polygons)
audit={'stage':stage,'height':height,'sourceSha256':hashlib.sha256((archive/'output-1.glb').read_bytes()).hexdigest(),'rawBoundsBlenderXYZ':[lo,hi],'normalizationScale':scale,'rootCenter':[cx,cy,lo[2]],'triangles':triangles,'topologyPreserved':True,'uvLayers':[len(o.data.uv_layers) for o in meshes],'finiteNormals':all(all(math.isfinite(n) for n in v.normal) for o in meshes for v in o.data.vertices),'materials':len(bpy.data.materials),'images':[{'name':i.name,'size':list(i.size)} for i in bpy.data.images]}
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=True
scene.render.resolution_x=1000;scene.render.resolution_y=1000;scene.render.resolution_percentage=100
scene.world=bpy.data.worlds.new('Warm neutral');scene.world.use_nodes=True
scene.world.node_tree.nodes['Background'].inputs['Color'].default_value=(.68,.72,.7,1);scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.65
scene.view_settings.view_transform='AgX'
for name,location,power,size in [('Key',(1,-2,3),450,3),('Fill',(-2,1,2),220,2)]:
 data=bpy.data.lights.new(name,'AREA');data.energy=power*height*height;data.shape='DISK';data.size=size*height
 ob=bpy.data.objects.new(name,data);scene.collection.objects.link(ob);ob.location=Vector(location)*height
 ob.rotation_euler=(Vector((0,0,height*.45))-ob.location).to_track_quat('-Z','Y').to_euler()
data=bpy.data.cameras.new('Review');camera=bpy.data.objects.new('Review',data);scene.collection.objects.link(camera);scene.camera=camera
data.type='ORTHO';data.ortho_scale=height*1.4
def render(name,back=False):
 camera.location=Vector((-1.1,1.8,1) if back else (1.1,-1.8,1))*height
 camera.rotation_euler=(Vector((0,0,height*.48))-camera.location).to_track_quat('-Z','Y').to_euler()
 scene.render.filepath=str(out/f'{stage}-{name}.png');bpy.ops.render.render(write_still=True)
render('raw-normalized')
if stage=='mature':
 # This generated asset's broad crown runs along Y, unlike the other three stages.
 for o in meshes:o.data.transform(Matrix.Rotation(math.pi/2,4,'Z'))
 audit['orientationCorrectionDegrees']=90
if stage=='sprout':
 # The generated terminal bud floats above the main stem: bridge only the 8 mm gap.
 start=Vector((.001,.001,.164));end=Vector((-.005,-.005,.188))
 bpy.ops.mesh.primitive_cone_add(vertices=12,radius1=.0018,radius2=.0012,depth=(end-start).length,location=(start+end)/2)
 bridge=bpy.context.object;bridge.name='Terminal_bud_stalk'
 bridge.rotation_euler=(end-start).to_track_quat('Z','Y').to_euler()
 bridge.data.transform(bridge.matrix_world);bridge.matrix_world.identity()
 bark=bpy.data.materials.new('Bud stalk warm bark');bark.diffuse_color=(.32,.15,.065,1);bark.use_nodes=True
 node=bark.node_tree.nodes.get('Principled BSDF');node.inputs['Base Color'].default_value=(.32,.15,.065,1);node.inputs['Roughness'].default_value=.9
 bridge.data.materials.append(bark);meshes.append(bridge)
 audit['repair']={'terminalBudStalkEndpoints':[list(start),list(end)],'radiusMetres':[.0018,.0012],'reason':'Disconnected generated terminal bud','originalMeshTopologyPreserved':True}
 audit['topologyPreserved']=False
audit['runtimeTriangles']=sum(len(p.vertices)-2 for o in meshes for p in o.data.polygons)
for material in bpy.data.materials:
 if material.use_nodes:
  for node in material.node_tree.nodes:
   if node.type=='BSDF_PRINCIPLED':
    for name in ['Metallic','Roughness']:
     for link in list(node.inputs[name].links):material.node_tree.links.remove(link)
    node.inputs['Metallic'].default_value=0;node.inputs['Roughness'].default_value=.85
audit['roughnessTextureRemoved']=True
render('runtime-front');render('runtime-back',True)
for o in bpy.context.selected_objects:o.select_set(False)
for o in meshes:o.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(archive/'runtime-uncompressed.glb'),export_format='GLB',use_selection=True)
bpy.ops.wm.save_as_mainfile(filepath=str(archive/'review.blend'))
pts=[v.co for o in meshes for v in o.data.vertices]
audit['runtimeBoundsBlenderXYZ']=[[min(p[i] for p in pts) for i in range(3)],[max(p[i] for p in pts) for i in range(3)]]
(out/f'{stage}-audit.json').write_text(json.dumps(audit,indent=2)+'\n',encoding='utf-8')
print(json.dumps(audit))
