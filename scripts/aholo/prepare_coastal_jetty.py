"""Normalize the generated jetty without changing its topology or UVs."""
import bpy, json, math, hashlib
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2]
ARCHIVE=ROOT/'assets/lux3d/coastal-jetty-v1'
OUT=ROOT/'docs/evidence/assets/2026-10-24-coastal-layout'
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(ARCHIVE/'output-1.glb'))
meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
for o in meshes:
    o.data.transform(o.matrix_world);o.matrix_world.identity()
pts=[v.co for o in meshes for v in o.data.vertices]
lo=[min(p[i] for p in pts) for i in range(3)]
hi=[max(p[i] for p in pts) for i in range(3)]
hist={}
for o in meshes:
    for p in o.data.polygons:
        if p.normal.z>.8:
            k=round(p.center.z,2);hist[k]=hist.get(k,0)+p.area
report={'sourceBoundsBlenderXYZ':[lo,hi], 'horizontalUpwardArea':sorted(hist.items(),key=lambda x:-x[1])[:20], 'triangles':sum(len(p.vertices)-2 for o in meshes for p in o.data.polygons),'materials':len(bpy.data.materials),'images':[{ 'name':i.name,'size':list(i.size)} for i in bpy.data.images]}
(OUT/'raw-inspection.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report))
from mathutils import Matrix
# Generated long axis is Blender Y; rotate it onto the runtime X axis.
long_scale=9.2/(hi[1]-lo[1]); width_scale=2.2/(hi[0]-lo[0]); deck=.54
original=[o.data.copy() for o in meshes]
def transform(width):
    matrix=Matrix(((0,long_scale,0,0),(-width,0,0,0),(0,0,1.8,-deck*1.8),(0,0,0,1)))
    for o,data in zip(meshes,original):
        o.data=data.copy();o.data.transform(matrix);o.data.update()
def render(label):
    scene.render.filepath=str(OUT/(label+'.png'));bpy.ops.render.render(write_still=True)
scene=bpy.context.scene
scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=True
scene.render.resolution_x=1400;scene.render.resolution_y=850;scene.render.resolution_percentage=100
scene.world=bpy.data.worlds.new('Warm studio');scene.world.use_nodes=True
scene.world.node_tree.nodes['Background'].inputs['Color'].default_value=(.68,.72,.73,1)
scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.6
scene.view_settings.view_transform='AgX'
for name,location,power,size in [('Key',(1,-6,9),1800,8),('Fill',(-6,2,5),1300,6),('Rim',(4,5,6),1600,6)]:
    data=bpy.data.lights.new(name,'AREA');data.energy=power;data.shape='DISK';data.size=size
    ob=bpy.data.objects.new(name,data);scene.collection.objects.link(ob);ob.location=location
    ob.rotation_euler=(Vector((0,0,-.8))-ob.location).to_track_quat('-Z','Y').to_euler()
data=bpy.data.cameras.new('Review');camera=bpy.data.objects.new('Review',data);scene.collection.objects.link(camera);scene.camera=camera
data.type='ORTHO';data.ortho_scale=12
camera.location=(9,-12,7);camera.rotation_euler=(Vector((0,0,-.7))-camera.location).to_track_quat('-Z','Y').to_euler()
transform(long_scale);render('jetty-raw-normalized')
transform(width_scale);render('jetty-runtime')
for o in bpy.context.selected_objects:o.select_set(False)
for o in meshes:o.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(ARCHIVE/'runtime-uncompressed.glb'),export_format='GLB',use_selection=True)
bpy.ops.wm.save_as_mainfile(filepath=str(ARCHIVE/'review.blend'))
pts=[v.co for o in meshes for v in o.data.vertices]
report.update({'taskId':4321451,'sourceSha256':hashlib.sha256((ARCHIVE/'output-1.glb').read_bytes()).hexdigest(),'runtimeBoundsBlenderXYZ':[[min(v[i] for v in pts) for i in range(3)],[max(v[i] for v in pts) for i in range(3)]],'deckSourceHeight':deck,'scaleLong':long_scale,'scaleWidth':width_scale,'scaleVertical':1.8,'topologyPreserved':True,'uvPreserved':True,'finiteNormals':all(all(math.isfinite(n) for n in v.normal) for o in meshes for v in o.data.vertices),'browserVerified':False})
(OUT/'model-audit.json').write_text(json.dumps(report,indent=2)+'\n')
