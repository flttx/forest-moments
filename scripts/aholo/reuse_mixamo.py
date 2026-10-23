"""Retarget existing, local my-blog Mixamo clips onto the new Lux3D raccoon.

Source FBXs stay in the original project. Only source hashes and baked animation
are recorded here. The previous procedural clips remain a rejected diagnostic.
"""
import argparse
import bpy
import hashlib
import json
import math
from pathlib import Path
import sys
import numpy as np
from mathutils import Matrix, Quaternion, Vector

ROOT=Path(__file__).resolve().parents[2]
parser=argparse.ArgumentParser()
parser.add_argument('--source-directory',type=Path,default=Path('E:/Projects/my-blog/assets/mixamo/raw/v4'))
args=parser.parse_args(sys.argv[sys.argv.index('--')+1:])
directory=ROOT/'assets/lux3d/round-01/raccoon-multiview'
evidence=ROOT/'docs/evidence/assets/2026-10-22-round-01/raccoon-multiview/rig-mixamo-v2'
evidence.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(directory/'rig-v1.blend'))
scene=bpy.context.scene;scene.render.fps=30
rig=next(o for o in scene.objects if o.type=='ARMATURE')
body=next(o for o in scene.objects if o.type=='MESH')
rig.animation_data_clear()
for action in list(bpy.data.actions):bpy.data.actions.remove(action)
for pb in rig.pose.bones:pb.matrix_basis.identity()
mesh=body.data
points=np.array([v.co[:] for v in mesh.vertices])*5+np.array([0,0,1.5])
names=[b.name for b in rig.data.bones];indices={n:i for i,n in enumerate(names)}

def smooth(a,b,value):
    t=np.clip((value-a)/(b-a),0,1)
    return t*t*(3-2*t)

def segment_distance(points,a,b):
    a=np.array(a);b=np.array(b);d=b-a
    t=np.clip(((points-a)@d)/(d@d),0,1)
    return np.linalg.norm(points-a-t[:,None]*d,axis=1)

# Smooth spatial weights replace per-material hard labels, which split connected
# sleeve/skirt faces in rig-v1. Coincident UV-split vertices receive equal weights.
distances=[]
for bone in rig.data.bones:
    a=np.array(bone.head_local)*5+[0,0,1.5]
    b=np.array(bone.tail_local)*5+[0,0,1.5]
    distances.append(segment_distance(points,a,b))
distance=np.array(distances).T
weight=np.zeros_like(distance)
x,y,z=points.T
body_names=['Pelvis','Spine','Chest','Neck','Head']
for n in body_names:weight[:,indices[n]]=1/(distance[:,indices[n]]+.10)**5
arm_gate=smooth(.27,.45,abs(x))*(1-smooth(1.80,1.98,z))*smooth(.96,1.10,z)
leg_gate=1-smooth(1.23,1.51,z)
for side,sign in [('L',1),('R',-1)]:
    side_gate=smooth(-.10,.10,x*sign)
    for n in [f'UpperArm.{side}',f'Forearm.{side}',f'Hand.{side}']:
        weight[:,indices[n]]=arm_gate*side_gate*1/(distance[:,indices[n]]+.07)**5
    for n in [f'Thigh.{side}',f'Shin.{side}',f'Foot.{side}']:
        weight[:,indices[n]]=leg_gate*side_gate*1/(distance[:,indices[n]]+.07)**5
tail_names=[f'Tail0{i}' for i in range(1,5)]
tail_distance=distance[:,[indices[n] for n in tail_names]].min(axis=1)
leg_distance=distance[:,[indices[n] for n in names if n.startswith(('Thigh','Shin','Foot'))]].min(axis=1)
tail_gate=smooth(.07,.20,y)*(1-smooth(1.39,1.53,z))*smooth(-.06,.08,leg_distance-tail_distance)
for n in tail_names:weight[:,indices[n]]=tail_gate/(distance[:,indices[n]]+.08)**5
weight/=weight.sum(axis=1,keepdims=True)
# Local graph relaxation removes hard boundaries while retaining anatomy. UV seam
# vertices are merged ONLY in this weight computation; the mesh is not welded.
_,inverse=np.unique(np.round(points,5),axis=0,return_inverse=True)
count=int(inverse.max())+1
unique_weight=np.zeros((count,len(names)));counts=np.bincount(inverse)
np.add.at(unique_weight,inverse,weight);unique_weight/=counts[:,None]
edge=np.array([e.vertices[:] for e in mesh.edges])
edge=np.unique(np.sort(inverse[edge],axis=1),axis=0)
degree=np.bincount(edge.ravel(),minlength=count)
for _ in range(12):
    sums=np.zeros_like(unique_weight)
    np.add.at(sums,edge[:,0],unique_weight[edge[:,1]])
    np.add.at(sums,edge[:,1],unique_weight[edge[:,0]])
    unique_weight=.55*unique_weight+.45*sums/np.maximum(degree,1)[:,None]
weight=unique_weight[inverse]
# glTF defaults to four influences; explicitly prune and normalize before export.
keep=np.argpartition(weight,-4,axis=1)[:,-4:]
pruned=np.zeros_like(weight);np.put_along_axis(pruned,keep,np.take_along_axis(weight,keep,axis=1),axis=1)
weight=pruned/pruned.sum(axis=1,keepdims=True)
body.vertex_groups.clear()
for j,name in enumerate(names):
    group=body.vertex_groups.new(name=name)
    quantized=np.round(weight[:,j],3)
    for value in np.unique(quantized[quantized>0]):group.add(np.flatnonzero(quantized==value).tolist(),float(value),'REPLACE')
bpy.context.view_layer.objects.active=body
body.select_set(True)
bpy.ops.object.vertex_group_normalize_all(lock_active=False)

mapping={'Pelvis':'Hips','Spine':'Spine1','Chest':'Spine2','Neck':'Neck','Head':'Head'}
for side,word in [('L','Left'),('R','Right')]:
    for target,source in [('UpperArm','Arm'),('Forearm','ForeArm'),('Hand','Hand'),('Thigh','UpLeg'),('Shin','Leg'),('Foot','Foot')]:
        mapping[f'{target}.{side}']=word+source
sources={'Idle':'Breathing Idle.fbx','Walk':'Walk.fbx','Run':'Running.fbx',
         'SitDown':'Stand To Sit.fbx','Sit':'Sitting Idle (1).fbx','StandUp':'Sit To Stand.fbx',
         'CrouchReach':'Picking Up.fbx','FishCast':'Fishing Cast.fbx','FishIdle':'Fishing Idle.fbx','Paddle':'Paddling.fbx'}
rest={b.name:b.matrix_local.copy() for b in rig.data.bones}
order=[]
def visit(bone):
    order.append(bone.name)
    for child in bone.children:visit(child)
for b in rig.data.bones:
    if b.parent is None:visit(b)
rig.animation_data_create()
records=[]
for clip,filename in sources.items():
    path=args.source_directory/filename
    before=set(bpy.data.objects)
    bpy.ops.import_scene.fbx(filepath=str(path))
    imported=[o for o in bpy.data.objects if o not in before]
    source_arm=next(o for o in imported if o.type=='ARMATURE')
    source_action=source_arm.animation_data.action
    start,end=(int(round(v)) for v in source_action.frame_range)
    source_rest={n:source_arm.matrix_world@source_arm.data.bones['mixamorig:'+s].matrix_local for n,s in mapping.items()}
    source_hip=source_rest['Pelvis'].translation
    scale=.26/source_hip.z
    frames=[]
    for frame in range(start,end+1):
        scene.frame_set(frame)
        source_pose={n:source_arm.matrix_world@source_arm.pose.bones['mixamorig:'+s].matrix for n,s in mapping.items()}
        poses={}
        for name in order:
            bone=rig.data.bones[name]
            parent=bone.parent.name if bone.parent else None
            base=(poses[parent]@rest[parent].inverted()@rest[name]) if parent else rest[name].copy()
            if name in mapping:
                rotation=source_pose[name].to_quaternion()@source_rest[name].to_quaternion().inverted()@rest[name].to_quaternion()
                head=base.translation.copy()
                if name=='Pelvis':head=rest[name].translation+(source_pose[name].translation-source_hip)*scale
                poses[name]=Matrix.Translation(head)@rotation.to_matrix().to_4x4()
            elif name.startswith('Tail'):
                # Tail bones do not exist in the humanoid source; keep an independent
                # low-amplitude lagged motion. Seated clearance is checked separately.
                i=int(name[-1]);phase=2*math.pi*(frame-start)/max(1,end-start)
                angle=.025*math.sin(phase-(i-1)*.35)
                if clip in ['Sit','Paddle']:angle=0
                poses[name]=base@Quaternion((0,0,1),angle).to_matrix().to_4x4()
            else:poses[name]=base
        frames.append(poses)
    for obj in imported:bpy.data.objects.remove(obj,do_unlink=True)
    bpy.data.actions.remove(source_action)
    action=bpy.data.actions.new(clip);action.use_fake_user=True
    rig.animation_data.action=action
    previous={}
    for frame,poses in enumerate(frames,1):
        for name in order:
            pb=rig.pose.bones[name];parent=pb.parent.name if pb.parent else None
            basis=rest[name].inverted()@poses[name] if parent is None else (rest[parent].inverted()@rest[name]).inverted()@poses[parent].inverted()@poses[name]
            location,rotation,_=basis.decompose()
            if name in previous:rotation.make_compatible(previous[name])
            previous[name]=rotation.copy()
            pb.location=location;pb.rotation_quaternion=rotation
            pb.keyframe_insert('location',frame=frame,group=name)
            pb.keyframe_insert('rotation_quaternion',frame=frame,group=name)
    track=rig.animation_data.nla_tracks.new();track.name=clip;track.strips.new(clip,1,action);track.mute=True
    records.append({'name':clip,'sourceFile':str(path),'sourceSha256':hashlib.sha256(path.read_bytes()).hexdigest(),'sourceFrames':[start,end],'frames':len(frames),'durationSeconds':(len(frames)-1)/30})
    print('RETARGETED',clip,len(frames),flush=True)
rig.animation_data.action=None
for pb in rig.pose.bones:pb.matrix_basis.identity()
scene.frame_set(1)
bpy.ops.object.select_all(action='DESELECT');rig.select_set(True);body.select_set(True)
bpy.context.view_layer.objects.active=rig
output=directory/'rig-mixamo-v2.glb'
bpy.ops.export_scene.gltf(filepath=str(output),export_format='GLB',use_selection=True,export_animations=True,
    export_animation_mode='ACTIONS',export_force_sampling=True,export_frame_range=False)
bpy.ops.wm.save_as_mainfile(filepath=str(directory/'rig-mixamo-v2.blend'))
record={'output':output.relative_to(ROOT).as_posix(),'outputSha256':hashlib.sha256(output.read_bytes()).hexdigest(),
    'sourceGeometry':'surface-v1.glb','geometryModified':False,'weights':'smooth anatomical distance fields, graph relaxation on coincident UV vertices, four normalized influences',
    'animationSource':'Existing user-provided my-blog Mixamo FBXs, read-only reuse; rest-frame rotation retargeting and scaled hip translation',
    'clips':records,'bones':len(names),'tailBones':4,'status':'retargeted candidate, visual and skin acceptance pending',
    'rawFbxCopied':False,'paidApiCalls':0,'browserVerified':False,
    'limitations':['Tail/leg overlap and seated tail clearance still require diagnostics','Humanoid clips do not provide tail motion','Props and runtime transitions not yet aligned']}
(evidence/'rig.json').write_text(json.dumps(record,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('MIXAMO_CANDIDATE_EXPORTED',flush=True)
