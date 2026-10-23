"""Reuse the actual my-blog production skeleton and 19 baked Mixamo clips.

The compressed source is decoded with gltf-transform copy into .tmp first.
Only the new Lux3D geometry/materials are exported; nearest-surface skin transfer
is a starting point requiring deformation review, not automatic acceptance.
"""
import bpy
import hashlib
import json
from pathlib import Path
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree
from mathutils.geometry import barycentric_transform

ROOT=Path(__file__).resolve().parents[2]
directory=ROOT/'assets/lux3d/round-01/raccoon-multiview'
evidence=ROOT/'docs/evidence/assets/2026-10-22-round-01/raccoon-multiview/rig-mixamo-v3'
evidence.mkdir(parents=True,exist_ok=True)
source=Path('E:/Projects/my-blog/public/assets/world/player/raccoon-mixamo.meshopt.glb')
decoded=ROOT/'.tmp/my-blog-raccoon-decoded.glb'
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.scene.render.fps=30
bpy.ops.import_scene.gltf(filepath=str(decoded))
rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
old=next(o for o in bpy.context.scene.objects if o.type=='MESH')
rig.animation_data.action=None
for track in rig.animation_data.nla_tracks:track.mute=True
for pb in rig.pose.bones:pb.matrix_basis=Matrix.Identity(4)
bpy.context.view_layer.update()
source_points=[old.matrix_world@v.co for v in old.data.vertices]
faces=[tuple(p.vertices) for p in old.data.polygons]
tree=BVHTree.FromPolygons(source_points,faces,all_triangles=True)
source_names={g.index:g.name for g in old.vertex_groups}
old_weights=[{source_names[g.group]:g.weight for g in v.groups} for v in old.data.vertices]
before=set(bpy.data.objects)
bpy.ops.import_scene.gltf(filepath=str(directory/'surface-v1.glb'))
body=next(o for o in bpy.data.objects if o not in before and o.type=='MESH')
body.name='Lux3D_Raccoon_MixamoSkin'
mesh=body.data
groups={b.name:body.vertex_groups.new(name=b.name) for b in rig.data.bones}
distances=[]
buckets={name:{} for name in groups}
for v in mesh.vertices:
    # Target height .6 m -> source native height 1 m, feet at zero.
    p=(body.matrix_world@v.co)/.6+Vector((0,0,.5))
    v.co=p
    near,_,face_index,distance=tree.find_nearest(p)
    distances.append(distance)
    face=faces[face_index]
    bary=barycentric_transform(near,*(source_points[i] for i in face),Vector((1,0,0)),Vector((0,1,0)),Vector((0,0,1)))
    weights={}
    for index,factor in zip(face,bary):
        for name,value in old_weights[index].items():weights[name]=weights.get(name,0)+max(0,factor)*value
    weights=sorted(weights.items(),key=lambda x:x[1],reverse=True)[:4]
    total=sum(w for _,w in weights)
    assert total>0
    for name,w in weights:
        value=round(w/total,4)
        if value:buckets[name].setdefault(value,[]).append(v.index)
for name,values in buckets.items():
    for weight,verts in values.items():groups[name].add(verts,weight,'REPLACE')
body.matrix_world=Matrix.Identity(4)
body.parent=rig;body.matrix_parent_inverse=rig.matrix_world.inverted()
modifier=body.modifiers.new('Reused_Mixamo_Skin','ARMATURE');modifier.object=rig
bpy.data.objects.remove(old,do_unlink=True)
# Keep the delivered asset in the original .6 m bounding frame. This container
# scales the existing bones/animation uniformly; no source clip is overwritten.
container=bpy.data.objects.new('Source_scale_adapter',None)
bpy.context.scene.collection.objects.link(container)
roots=[o for o in bpy.context.scene.objects if o.parent is None and o!=container]
for obj in roots:obj.parent=container
container.scale=(.6,)*3;container.location=(0,0,-.3)
bpy.context.view_layer.objects.active=body
bpy.ops.object.select_all(action='DESELECT');body.select_set(True)
bpy.ops.object.vertex_group_normalize_all(lock_active=False)
bpy.ops.object.select_all(action='SELECT')
output=directory/'rig-mixamo-v3.glb'
bpy.ops.export_scene.gltf(filepath=str(output),export_format='GLB',use_selection=True,export_animations=True,
    export_animation_mode='ACTIONS',export_force_sampling=True,export_frame_range=False)
bpy.ops.wm.save_as_mainfile(filepath=str(directory/'rig-mixamo-v3.blend'))
clips=[{'name':a.name,'frameRange':list(a.frame_range)} for a in bpy.data.actions]
record={'output':output.relative_to(ROOT).as_posix(),'outputSha256':hashlib.sha256(output.read_bytes()).hexdigest(),
    'sourceRig':str(source),'sourceRigSha256':hashlib.sha256(source.read_bytes()).hexdigest(),
    'decodedSourceSha256':hashlib.sha256(decoded.read_bytes()).hexdigest(),
    'geometrySource':'surface-v1.glb','geometrySourceSha256':hashlib.sha256((directory/'surface-v1.glb').read_bytes()).hexdigest(),
    'bones':len(rig.data.bones),'clips':clips,'tailBones':len([b for b in rig.data.bones if b.name.startswith('tail_')]),
    'weightTransfer':'Nearest original skinned surface, barycentric interpolation, normalized four influences',
    'maxProjectionDistanceSourceMeters':max(distances),'meanProjectionDistanceSourceMeters':sum(distances)/len(distances),
    'sourceFilesModified':False,'paidApiCalls':0,'status':'candidate; new mesh deformation and tail clearance not accepted',
    'runtimeBrowserVerified':False}
(evidence/'rig.json').write_text(json.dumps(record,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps(record),flush=True)
