"""Keep reused Mixamo body animation, separate tail skin from leg-owned faces.

Faces and UVs are preserved; only vertices on the semantic seam are duplicated.
This is a local rig candidate, requiring pose review of the new seam and clearance.
"""
import bpy
import argparse
import hashlib
import json
import math
from pathlib import Path
import sys
import numpy as np
from mathutils import Vector, Quaternion, Matrix

ROOT=Path(__file__).resolve().parents[2]
directory=ROOT/'assets/lux3d/round-01/raccoon-multiview'
parser=argparse.ArgumentParser()
parser.add_argument('--variant',choices=['rig-mixamo-v4','rig-mixamo-v5','rig-mixamo-v6'],default='rig-mixamo-v6')
args=parser.parse_args(sys.argv[sys.argv.index('--')+1:])
evidence=ROOT/'docs/evidence/assets/2026-10-22-round-01/raccoon-multiview'/args.variant
evidence.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(directory/'rig-mixamo-v3.blend'))
rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
body=next(o for o in bpy.context.scene.objects if o.type=='MESH')
rig.animation_data.action=None
for track in rig.animation_data.nla_tracks:track.mute=True
for pb in rig.pose.bones:pb.matrix_basis.identity()
old=body.data
old.calc_loop_triangles()
groups={g.index:g.name for g in body.vertex_groups}
old_weights=[{groups[g.group]:g.weight for g in v.groups} for v in old.vertices]
normals=[tuple(n.vector) for n in old.corner_normals]
vertices=[];faces=[];mapping={};regions=[];origins=[]
for polygon in old.polygons:
    center=sum((old.vertices[i].co for i in polygon.vertices),Vector())/len(polygon.vertices)*3
    x,y,z=center
    threshold=.13 if z<1.22 else .10
    tail=(y>threshold and z<1.48 and -.78<x<.19)
    face=[]
    for index in polygon.vertices:
        key=(index,tail)
        if key not in mapping:
            mapping[key]=len(vertices);vertices.append(tuple(old.vertices[index].co));regions.append(tail);origins.append(index)
        face.append(mapping[key])
    faces.append(face)
mesh=bpy.data.meshes.new('Lux3D_preserved_faces_tail_skin_seam')
mesh.from_pydata(vertices,[],faces);mesh.update()
for material in old.materials:mesh.materials.append(material)
for polygon,source in zip(mesh.polygons,old.polygons):
    polygon.material_index=source.material_index;polygon.use_smooth=source.use_smooth
for layer in old.uv_layers:
    target=mesh.uv_layers.new(name=layer.name)
    for a,b in zip(target.data,layer.data):a.uv=b.uv
for layer in old.color_attributes:
    if layer.domain=='CORNER':
        target=mesh.color_attributes.new(name=layer.name,type=layer.data_type,domain='CORNER')
        for a,b in zip(target.data,layer.data):a.color=b.color
mesh.normals_split_custom_set(normals)
body.data=mesh
body.vertex_groups.clear()
new_groups={b.name:body.vertex_groups.new(name=b.name) for b in rig.data.bones}
tail_names=[f'tail_0{i}' for i in range(1,6)]
centers=[1.43,1.22,.98,.70,.38]
buckets={n:{} for n in new_groups}
for i,(point,is_tail,source_index) in enumerate(zip(vertices,regions,origins)):
    if is_tail:
        z=point[2]*3
        if z>1.43:
            t=min(1,(z-1.43)/.05);weights={'mixamorig:Hips':t,'tail_01':1-t}
        else:
            weights={tail_names[-1]:1.}
            for j in range(4):
                if centers[j]>=z>=centers[j+1]:
                    t=(z-centers[j+1])/(centers[j]-centers[j+1]);weights={tail_names[j]:t,tail_names[j+1]:1-t};break
    else:
        weights={n:w for n,w in old_weights[source_index].items() if not n.startswith('tail_')}
        if not weights:weights={'mixamorig:Hips':1.}
    total=sum(weights.values())
    for n,w in weights.items():
        value=round(w/total,4)
        if value:buckets[n].setdefault(value,[]).append(i)
for n,values in buckets.items():
    for w,indices in values.items():new_groups[n].add(indices,w,'REPLACE')
# New tail proportions require their own rest chain; the humanoid skeleton and
# all authored Mixamo body tracks remain unchanged.
bpy.ops.object.select_all(action='DESELECT');rig.select_set(True);bpy.context.view_layer.objects.active=rig
bpy.ops.object.mode_set(mode='EDIT')
chain=[(0,.07,1.47),(-.04,.22,1.25),(-.12,.36,1.02),(-.25,.47,.77),(-.34,.53,.49),(-.38,.56,.20)]
# The imported production armature keeps glTF Y-up in its local coordinates,
# while the mesh data is Blender Z-up. Convert through their object matrices.
native_to_arm=rig.matrix_world.inverted()@body.matrix_world if args.variant=='rig-mixamo-v6' else Matrix.Identity(4)
for i,n in enumerate(tail_names):
    b=rig.data.edit_bones[n];b.use_connect=False
    b.head=native_to_arm@(Vector(chain[i])/3);b.tail=native_to_arm@(Vector(chain[i+1])/3)
bpy.ops.object.mode_set(mode='OBJECT')
bpy.context.view_layer.objects.active=body;body.select_set(True)
bpy.ops.object.vertex_group_normalize_all(lock_active=False)
for pb in rig.pose.bones:pb.matrix_basis.identity()
tail_adaptation=[]
if args.variant in ['rig-mixamo-v5','rig-mixamo-v6']:
    # Existing body clips are reusable. Tail transforms were baked for the old
    # model and must be regenerated after changing its rest chain, particularly
    # their translations (otherwise the tail can detach in seated clips).
    root_rest=rig.data.bones['tail_01'].matrix_local.copy()
    hip_rest=rig.data.bones['mixamorig:Hips'].matrix_local.copy()
    tip_points=[native_to_arm@Vector(p) for p,tail in zip(vertices,regions) if tail and p[2]*3<1.23]
    root_local=np.array([tuple(root_rest.inverted()@p) for p in tip_points])[::8]
    axis=root_rest.to_quaternion().inverted()@(native_to_arm.to_3x3()@Vector((1,0,0)))
    for action in bpy.data.actions:
        rig.animation_data.action=action
        if action.slots:rig.animation_data.action_slot=action.slots[0]
        frames=range(int(round(action.frame_range[0])),int(round(action.frame_range[1]))+1)
        max_angle=0
        for frame in frames:
            bpy.context.scene.frame_set(frame)
            hip=rig.pose.bones['mixamorig:Hips'].matrix.copy()
            base=hip@hip_rest.inverted()@root_rest
            chosen=0.
            for candidate in np.linspace(0,math.radians(120),81):
                matrix=np.array(native_to_arm.inverted()@base@Quaternion(axis,float(candidate)).to_matrix().to_4x4())
                lowest=float((root_local@matrix[:3,:3].T+matrix[:3,3])[:,2].min())
                chosen=float(candidate)
                if lowest>=.008:break
            max_angle=max(max_angle,chosen)
            for n in tail_names:
                pb=rig.pose.bones[n];pb.location=(0,0,0)
                pb.rotation_quaternion=Quaternion(axis,chosen) if n=='tail_01' else Quaternion()
                pb.keyframe_insert('location',frame=frame,group=n)
                pb.keyframe_insert('rotation_quaternion',frame=frame,group=n)
        tail_adaptation.append({'clip':action.name,'maxRootLiftDegrees':math.degrees(max_angle)})
    rig.animation_data.action=None
    for pb in rig.pose.bones:pb.matrix_basis.identity()
bpy.context.scene.frame_set(0)
bpy.ops.object.select_all(action='SELECT')
output=directory/f'{args.variant}.glb'
bpy.ops.export_scene.gltf(filepath=str(output),export_format='GLB',use_selection=True,export_animations=True,
    export_animation_mode='ACTIONS',export_force_sampling=True,export_frame_range=False)
bpy.ops.wm.save_as_mainfile(filepath=str(directory/f'{args.variant}.blend'))
record={'source':'rig-mixamo-v3.glb','output':output.relative_to(ROOT).as_posix(),'outputSha256':hashlib.sha256(output.read_bytes()).hexdigest(),
    'preservedTriangles':len(faces),'sourceVertices':len(old.vertices),'outputVertices':len(mesh.vertices),
    'tailOwnedVertices':sum(regions),'tailVerticesWithLegWeights':0,'tailRestChainNormalized':chain,
    'adaptedTailTracks':tail_adaptation,'tailMotion':'rigid chain clearance candidate; spring damping not yet integrated',
    'method':'Duplicate tail/body seam vertices without deleting source faces, reweight tail to independent chain',
    'status':'candidate; semantic seam and seated clearance awaiting visual review','paidApiCalls':0}
(evidence/'rig.json').write_text(json.dumps(record,indent=2)+'\n',encoding='utf-8')
print(json.dumps(record),flush=True)
