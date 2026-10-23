"""Inspect actual exported GLB skin deformation and render repeatable motion frames."""
import argparse
import bpy
import hashlib
import json
import math
from pathlib import Path
import sys
import numpy as np
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[2]
parser=argparse.ArgumentParser()
parser.add_argument('--continuous',action='store_true')
parser.add_argument('--clip',default='TailSweep')
parser.add_argument('--variant',default='rig-v1',choices=['rig-v1','rig-mixamo-v2','rig-mixamo-v3','rig-mixamo-v4','rig-mixamo-v5','rig-mixamo-v6','rig-mixamo-v7','rig-mixamo-v8','rig-mixamo-v9'])
parser.add_argument('--quick',action='store_true',help='Scoped walk/run/paddle diagnosis, not a complete motion gate')
args=parser.parse_args(sys.argv[sys.argv.index('--')+1:])
source=ROOT/f'assets/lux3d/round-01/raccoon-multiview/{args.variant}.glb'
output=ROOT/f'docs/evidence/assets/2026-10-22-round-01/raccoon-multiview/{args.variant}'
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.scene.render.fps=30
bpy.ops.import_scene.gltf(filepath=str(source))
rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
body=next(o for o in bpy.context.scene.objects if o.type=='MESH')
for track in rig.animation_data.nla_tracks:track.mute=True
rig.animation_data.action=None
for bone in rig.pose.bones:bone.matrix_basis.identity()
bpy.context.view_layer.update()
mesh=body.data
original=np.array([tuple(body.matrix_world@v.co) for v in mesh.vertices])
edges=np.array([e.vertices[:] for e in mesh.edges])
rest_lengths=np.linalg.norm(original[edges[:,0]]-original[edges[:,1]],axis=1)
significant=rest_lengths>.001
scene=bpy.context.scene
scene.render.fps=30
actions={a.name.split('_Forest')[0]:a for a in bpy.data.actions}

def select(name):
    action=next((a for n,a in actions.items() if n==name or n.startswith(name+'_')),None)
    if action is None:raise RuntimeError(f'Missing animation {name}: {list(actions)}')
    rig.animation_data.action=action
    if action.slots:rig.animation_data.action_slot=action.slots[0]
    return action

def evaluated_positions():
    evaluated=body.evaluated_get(bpy.context.evaluated_depsgraph_get())
    evaluated_mesh=evaluated.to_mesh()
    values=np.empty(len(evaluated_mesh.vertices)*3,dtype=np.float32)
    evaluated_mesh.vertices.foreach_get('co',values)
    matrix=np.array(evaluated.matrix_world)
    evaluated.to_mesh_clear()
    return values.reshape(-1,3)@matrix[:3,:3].T+matrix[:3,3]

if not args.continuous:
    metrics=[]
    clip_names=['Idle','Walk','Run','Sit','Crouch','Fish','Paddle','TailSweep'] if args.variant=='rig-v1' else ['Idle','Walk','Run','SitDown','Sit','StandUp','CrouchReach','FishCast','FishIdle','Paddle']
    if args.variant in ['rig-mixamo-v3','rig-mixamo-v4','rig-mixamo-v5','rig-mixamo-v6','rig-mixamo-v7','rig-mixamo-v8','rig-mixamo-v9']:clip_names=list(actions)
    if args.quick:clip_names=['walk','run','paddle']
    for name in clip_names:
        action=select(name)
        start,end=(int(round(v)) for v in action.frame_range)
        peak_ratio,peak_frame,stretched,lowest=0,0,0,10.
        first,last=None,None
        for frame in range(start,end+1):
            scene.frame_set(frame)
            values=evaluated_positions()
            assert np.isfinite(values).all()
            ratios=np.linalg.norm(values[edges[:,0]]-values[edges[:,1]],axis=1)[significant]/rest_lengths[significant]
            peak=float(ratios.max())
            if peak>peak_ratio:peak_ratio,peak_frame=peak,frame
            stretched=max(stretched,int(np.count_nonzero(ratios>2)))
            lowest=min(lowest,float(values[:,2].min()*5+1.5))
            if frame==start:first=values.copy()
            last=values
        metrics.append({'clip':name,'frames':end-start+1,'peakEdgeStretch':peak_ratio,'peakFrame':peak_frame,
                        'maxEdgesStretchedOver2x':stretched,'minimumHeightNormalized':lowest,
                        'loopMaxVertexDelta':float(np.linalg.norm(last-first,axis=1).max()),
                        'status':'requires visual acceptance; thresholds are diagnostics, not pass criteria'})
        print(json.dumps(metrics[-1]),flush=True)
    (output/'deformation.json').write_text(json.dumps({'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),
        'method':'Imported exported GLB, evaluate every animation frame; edges longer than 0.001 model units',
        'clips':metrics,'browserVerified':False},indent=2)+'\n',encoding='utf-8')

# Preview normalization and studio are kept outside the deliverable GLB.
root=bpy.data.objects.new('REVIEW_ONLY_normalization',None)
scene.collection.objects.link(root)
for obj in list(scene.objects):
    if obj!=root and obj.parent is None:obj.parent=root
root.scale=(5,5,5)
root.location=(0,0,1.5)
scene.render.engine='CYCLES'
scene.cycles.samples=8 if args.continuous else (12 if args.quick else 20)
scene.cycles.use_denoising=True
scene.render.resolution_x=scene.render.resolution_y=480 if args.continuous else (640 if args.quick else 900)
scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'
scene.world=bpy.data.worlds.new('Motion studio')
scene.world.use_nodes=True
scene.world.node_tree.nodes['Background'].inputs['Color'].default_value=(.75,.78,.72,1)
scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.6
scene.view_settings.view_transform='AgX'
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.015))
ground=bpy.context.object
material=bpy.data.materials.new('Warm review floor');material.diffuse_color=(.65,.63,.57,1)
ground.data.materials.append(material)
for name,location,energy,size in [('Key',(4,-5,7),800,5),('Fill',(-4,-2,4),500,4),('Rim',(2,4,6),700,4)]:
    data=bpy.data.lights.new(name,'AREA');data.energy=energy;data.shape='DISK';data.size=size
    lamp=bpy.data.objects.new(name,data);scene.collection.objects.link(lamp);lamp.location=location
    lamp.rotation_euler=(Vector((0,0,1.5))-lamp.location).to_track_quat('-Z','Y').to_euler()
camera=bpy.data.objects.new('Motion review camera',bpy.data.cameras.new('Motion review camera'))
scene.collection.objects.link(camera);scene.camera=camera;camera.data.type='ORTHO';camera.data.ortho_scale=4.0

def view(label):
    camera.location={'front':(0,-6,2.1),'side':(6,0,2.1),'back':(0,6,2.1),'three-quarter':(4,-5,2.5)}[label]
    camera.rotation_euler=(Vector((0,0,1.4))-camera.location).to_track_quat('-Z','Y').to_euler()

if args.continuous:
    action=select(args.clip);start,end=(int(round(v)) for v in action.frame_range)
    frames=output/'continuous'/args.clip;frames.mkdir(parents=True,exist_ok=True)
    view('back' if args.clip=='TailSweep' else 'three-quarter')
    for i,frame in enumerate(range(start,end,2)):
        scene.frame_set(frame);scene.render.filepath=str(frames/f'{i:04d}.png');bpy.ops.render.render(write_still=True)
else:
    poses=[('Idle',1,'front'),('Walk',10,'front'),('Walk',10,'side'),('Run',7,'side'),
           ('Sit',1,'side'),('Crouch',1,'side'),('Fish',23,'three-quarter'),('Paddle',16,'three-quarter'),
           ('TailSweep',16,'back'),('TailSweep',46,'back')]
    if args.variant!='rig-v1':
        poses=[('Idle',1,'front'),('Walk',10,'front'),('Walk',10,'side'),('Run',7,'side'),
               ('Sit',1,'side'),('CrouchReach',95,'side'),('FishCast',90,'three-quarter'),
               ('Paddle',55,'three-quarter'),('Walk',10,'back'),('Walk',25,'back')]
    if args.variant in ['rig-mixamo-v3','rig-mixamo-v4','rig-mixamo-v5','rig-mixamo-v6','rig-mixamo-v7','rig-mixamo-v8','rig-mixamo-v9']:
        poses=[('idle',1,'front'),('walk',10,'front'),('walk',10,'side'),('run',7,'side'),
               ('bench_sit_idle',1,'side'),('interact',55,'side'),('fish_cast',65,'three-quarter'),
               ('paddle',55,'three-quarter'),('walk',10,'back'),('walk',25,'back')]
    if args.quick:poses=[('walk',10,'side'),('walk',10,'back'),('paddle',55,'three-quarter')]
    for name,frame,label in poses:
        select(name);scene.frame_set(frame);view(label)
        scene.render.filepath=str(output/f'{name}-{frame:03d}-{label}.png');bpy.ops.render.render(write_still=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(source.with_name(f'review-{args.variant}-motion.blend')))
print('MOTION_REVIEW_COMPLETE',flush=True)
