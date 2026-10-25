import bpy,json,sys,math
from pathlib import Path
from mathutils import Vector,Matrix
ROOT=Path.cwd();asset=sys.argv[-1]
source=ROOT/f'assets/lux3d/expansion-{asset}-v1/output-1.glb'
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(source))
meshes=[o for o in bpy.data.objects if o.type=='MESH']
for o in meshes:o.data.transform(o.matrix_world);o.matrix_world.identity()
points=[v.co for o in meshes for v in o.data.vertices];lo=[min(p[i] for p in points) for i in range(3)];hi=[max(p[i] for p in points) for i in range(3)]
print('RAW_BOUNDS',asset,lo,hi)
# Preserve original vertices, faces, UV and texture detail, author transforms only.
sizes={'plane':(.12,.36,.17),'cabin':(6.8,5.6,4.8),'bed':(1.65,2.7,1.05),'bridge':(2.7,6,1.2),'reef':(4,3,2.4),'firepit':(1.8,1.8,.48),'tank':(2,.85,1.8)}
target=sizes[asset]
# Image generations usually have width X, depth Y; long props are checked via rendered review.
rotate=asset in ['bridge','plane','bed'] and hi[0]-lo[0]>hi[1]-lo[1]
if rotate:
 for o in meshes:o.data.transform(Matrix.Rotation(math.pi/2,4,'Z'))
 points=[v.co for o in meshes for v in o.data.vertices];lo=[min(p[i] for p in points) for i in range(3)];hi=[max(p[i] for p in points) for i in range(3)]
scale=[target[i]/(hi[i]-lo[i]) for i in range(3)]
for o in meshes:
 for v in o.data.vertices:
  for i in range(3):v.co[i]=(v.co[i]-(lo[i] if i==2 else (lo[i]+hi[i])/2))*scale[i]
 o.data.update()
 for m in o.data.materials:
  if m and m.use_nodes:
   bs=m.node_tree.nodes.get('Principled BSDF')
   if bs:bs.inputs['Metallic'].default_value=0;bs.inputs['Roughness'].default_value=.8
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=16;scene.cycles.use_denoising=True;scene.render.resolution_x=960;scene.render.resolution_y=800;scene.render.resolution_percentage=100
scene.world=bpy.data.worlds.new('Studio');scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.7
span=max(target)
for pos,power in [((span,-span*1.3,span*1.7),180*span*span),((-span,0,span),80*span*span)]:
 bpy.ops.object.light_add(type='AREA',location=pos);l=bpy.context.object;l.data.energy=power;l.data.shape='DISK';l.data.size=span*1.5;l.rotation_euler=(Vector((0,0,target[2]/2))-l.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(location=(span*1.15,-span*1.5,span));c=bpy.context.object;c.rotation_euler=(Vector((0,0,target[2]/2))-c.location).to_track_quat('-Z','Y').to_euler();c.data.type='ORTHO';c.data.ortho_scale=span*1.65;scene.camera=c
out=ROOT/'docs/evidence/2026-10-25-expansion';scene.render.filepath=str(out/f'{asset}-normalized.png');bpy.ops.render.render(write_still=True)
bpy.ops.object.select_all(action='DESELECT')
for o in meshes:o.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(ROOT/f'assets/expansion/{asset}.glb'),export_format='GLB',use_selection=True,export_animations=False)
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/f'assets/expansion/{asset}.blend'))
(out/f'{asset}-blender.json').write_text(json.dumps({'asset':asset,'source':str(source.relative_to(ROOT)),'sourceBounds':[lo,hi],'targetBlenderXYZ':target,'rotateZ90':rotate,'triangles':sum(len(p.vertices)-2 for o in meshes for p in o.data.polygons),'blender':bpy.app.version_string,'textures':[{'name':i.name,'size':list(i.size)} for i in bpy.data.images],'topologyPreserved':True},indent=2))
