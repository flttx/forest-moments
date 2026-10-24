"""Re-ground existing my-blog farm meshes; no new geometry or generation requests."""
import bpy, bmesh, json, hashlib
from pathlib import Path
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree

ROOT=Path(__file__).resolve().parents[1]
SOURCE=Path('F:/Projects/my-blog')
OUT=ROOT/'assets/farm'
EVIDENCE=ROOT/'docs/evidence/assets/2026-10-24-farm'
OUT.mkdir(parents=True,exist_ok=True); EVIDENCE.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(SOURCE/'assets/blender/world-v3/derived/forest-island-terrain-v3.glb'))
bm=bmesh.new()
for o in bpy.data.objects:
    if o.type=='MESH' and o.name.startswith(('Terrain_ContinuousElevation','TerrainWaterBed')):
        part=bmesh.new();part.from_mesh(o.data);part.transform(o.matrix_world)
        mesh=bpy.data.meshes.new('tmp');part.to_mesh(mesh);part.free();bm.from_mesh(mesh);bpy.data.meshes.remove(mesh)
tree=BVHTree.FromBMesh(bm);bm.free()
def ground(x,y):
    hit=tree.ray_cast(Vector((x,y,50)),Vector((0,0,-1)))[0]
    if hit is None: raise RuntimeError(f'No terrain at {x}, {y}')
    return hit.z
bpy.ops.wm.open_mainfile(filepath=str(SOURCE/'assets/blender/farm/ranch.blend'))
px,py=-20.5,-25.8
objects=[o for o in bpy.data.objects if o.type=='MESH' and o.name.startswith(('Ranch_','RanchCollider_','RanchGrassBlock_'))]
records=[];colliders=[]
for o in objects:
    points=[o.matrix_world@v.co for v in o.data.vertices]
    bounds=[[min(p[i] for p in points),max(p[i] for p in points)] for i in range(3)]
    cx,cy=[sum(bounds[i])/2 for i in range(2)]
    conform=o.name.startswith(('Ranch_Fence','Ranch_Straw','Ranch_Worn','RanchCollider_Fence','RanchGrassBlock'))
    # Rigid props retain proportions; terrain-following rail/post vertices lose the old slope.
    offset=bounds[2][0] if o.name in ('Ranch_Coop','Ranch_Hay') else ground(cx,cy)
    if o.name in ('Ranch_Trough','Ranch_Trough_Fill','RanchCollider_Ranch_Trough'): offset=ground(px+1.7,py+2.05)
    if o.name in ('Ranch_Water','Ranch_Water_Fill','RanchCollider_Water'): offset=ground(px+2.7,py-1.3)
    for v,p in zip(o.data.vertices,points): v.co=(p.x-px,p.y-py,p.z-(ground(p.x,p.y) if conform else offset))
    o.matrix_world=Matrix.Identity(4)
    o.data.update()
    new=[[min(v.co[i] for v in o.data.vertices),max(v.co[i] for v in o.data.vertices)] for i in range(3)]
    tris=sum(len(p.vertices)-2 for p in o.data.polygons)
    records.append({'name':o.name,'triangles':tris,'beforeBounds':bounds,'afterBounds':new,'conform':conform,'uvLayers':len(o.data.uv_layers)})
    if o.name.startswith('RanchCollider_'):
        colliders.append({'name':o.name,'x':8+sum(new[0])/2,'z':6-sum(new[1])/2,'halfX':(new[0][1]-new[0][0])/2,'halfZ':(new[1][1]-new[1][0])/2})
    o.hide_render=o.name.startswith(('RanchCollider_','RanchGrassBlock_'))
for o in list(bpy.data.objects):
    if o not in objects:bpy.data.objects.remove(o,do_unlink=True)
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'ranch-grounded.blend'))
bpy.ops.object.select_all(action='DESELECT')
for o in objects:
    if not o.hide_render:o.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(OUT/'ranch-grounded.glb'),export_format='GLB',use_selection=True,export_yup=True,export_animations=False,export_cameras=False,export_lights=False)
for c in colliders:
    target={'RanchCollider_Coop':'Ranch_Coop','RanchCollider_Ranch_Hay':'Ranch_Hay','RanchCollider_Ranch_Trough':'Ranch_Trough','RanchCollider_Water':'Ranch_Water'}.get(c['name'])
    if target:
        b=next(r['afterBounds'] for r in records if r['name']==target)
        c.update(x=8+sum(b[0])/2,z=6-sum(b[1])/2,halfX=(b[0][1]-b[0][0])/2,halfZ=(b[1][1]-b[1][0])/2)
(ROOT/'src/game/farm-colliders.json').write_text(json.dumps(colliders,indent=2)+'\n')
(EVIDENCE/'grounding.json').write_text(json.dumps({'operation':'Existing meshes re-grounded; no decimation; source blend read-only','objects':records,'colliders':colliders},indent=2)+'\n')
# Actual-model offline review, with both animals in the same scale.
for kind,pos in [('hen',(0,-.2,0)),('sheep',(1,-.1,0))]:
    with bpy.data.libraries.load(str(SOURCE/f'assets/blender/farm/animal-{kind}.blend'),link=False) as (src,dst):dst.objects=src.objects
    imported=[o for o in dst.objects if o]
    for o in imported:
        if o.type not in ('CAMERA','LIGHT'):bpy.context.scene.collection.objects.link(o)
    for o in imported:
        if o.parent is None:o.location+=Vector(pos)
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=24
scene.render.resolution_x=1200;scene.render.resolution_y=900;scene.render.resolution_percentage=100
scene.world=bpy.data.worlds.new('FarmReview');scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.55,.65,.75,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.6
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.015));floor=bpy.context.object
mat=bpy.data.materials.new('review-ground');mat.diffuse_color=(.23,.31,.13,1);floor.data.materials.append(mat)
bpy.ops.object.light_add(type='AREA',location=(1,-5,9));bpy.context.object.data.energy=1600;bpy.context.object.data.shape='DISK';bpy.context.object.data.size=7
bpy.ops.object.camera_add();cam=bpy.context.object;scene.camera=cam;cam.data.type='ORTHO';cam.data.ortho_scale=9.5
for name,eye in [('front',(9,11,8)),('back',(-9,-11,8))]:
    cam.location=eye;cam.rotation_euler=(Vector((0,0,.5))-cam.location).to_track_quat('-Z','Y').to_euler()
    scene.render.filepath=str(EVIDENCE/f'model-{name}.png');bpy.ops.render.render(write_still=True)
