"""Build a local, reproducible rig candidate and authored diagnostic/action clips.

No automatic heat weighting or topology reduction: region constraints prevent the
cape from following the arms and the skirt from following the tail. Visual and
deformation checks remain separate from successfully exporting a skin.
"""
import bpy
import hashlib
import json
import math
from pathlib import Path
from mathutils import Vector, Quaternion, Matrix
import numpy as np

ROOT = Path(__file__).resolve().parents[2]
DIRECTORY = ROOT / 'assets/lux3d/round-01/raccoon-multiview'
EVIDENCE = ROOT / 'docs/evidence/assets/2026-10-22-round-01/raccoon-multiview/rig-v1'
EVIDENCE.mkdir(parents=True, exist_ok=True)
source = DIRECTORY / 'surface-v1.glb'
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(source))
body = next(o for o in bpy.context.scene.objects if o.type == 'MESH')
body.name = 'Raccoon_Surface'
bpy.context.view_layer.objects.active = body
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
mesh = body.data

def local(point):
    return (Vector(point) - Vector((0, 0, 1.5))) / 5

bones = {
    'Root': ((0,0,0),(0,0,.2),None),
    'Pelvis': ((0,0,1.30),(0,0,1.55),'Root'),
    'Spine': ((0,0,1.55),(0,0,1.87),'Pelvis'),
    'Chest': ((0,0,1.87),(0,0,2.08),'Spine'),
    'Neck': ((0,0,2.08),(0,0,2.24),'Chest'),
    'Head': ((0,0,2.24),(0,-.02,2.83),'Neck'),
    'Tail01': ((0,.07,1.47),(-.07,.28,1.18),'Pelvis'),
    'Tail02': ((-.07,.28,1.18),(-.22,.44,.86),'Tail01'),
    'Tail03': ((-.22,.44,.86),(-.34,.52,.52),'Tail02'),
    'Tail04': ((-.34,.52,.52),(-.38,.56,.22),'Tail03'),
}
for sign, side in [(1,'L'),(-1,'R')]:
    bones.update({
        f'UpperArm.{side}': ((sign*.34,0,1.99),(sign*.48,-.01,1.61),'Chest'),
        f'Forearm.{side}': ((sign*.48,-.01,1.61),(sign*.57,-.07,1.29),f'UpperArm.{side}'),
        f'Hand.{side}': ((sign*.57,-.07,1.29),(sign*.57,-.10,1.13),f'Forearm.{side}'),
        f'Thigh.{side}': ((sign*.23,0,1.30),(sign*.23,-.025,.78),'Pelvis'),
        f'Shin.{side}': ((sign*.23,-.025,.78),(sign*.23,0,.25),f'Thigh.{side}'),
        f'Foot.{side}': ((sign*.23,0,.25),(sign*.23,-.27,.15),f'Shin.{side}'),
    })
armature = bpy.data.armatures.new('Forest_Raccoon_Skeleton')
rig = bpy.data.objects.new('Forest_Raccoon_Rig', armature)
bpy.context.collection.objects.link(rig)
bpy.ops.object.select_all(action='DESELECT')
rig.select_set(True)
bpy.context.view_layer.objects.active = rig
bpy.ops.object.mode_set(mode='EDIT')
for name, (head, tail, parent) in bones.items():
    bone = armature.edit_bones.new(name)
    bone.head, bone.tail = local(head), local(tail)
    if parent:
        bone.parent = armature.edit_bones[parent]
bpy.ops.object.mode_set(mode='OBJECT')
rig.show_in_front = True
for bone in rig.pose.bones:
    bone.rotation_mode = 'QUATERNION'

positions = np.array([tuple(v.co * 5 + Vector((0,0,1.5))) for v in mesh.vertices])
# Material membership is deliberately conservative at UV/material boundaries.
cloth = np.zeros(len(mesh.vertices), dtype=bool)
for polygon in mesh.polygons:
    if 'Cloth' in mesh.materials[polygon.material_index].name:
        cloth[list(polygon.vertices)] = True

def mix(a, b, t):
    t = max(0., min(1., t))
    return {a: 1-t, b: t}

def chain(z, joints, names):
    # Smooth transitions between adjacent bone centers, with at most two influences.
    for i in range(len(joints)-1):
        if joints[i] >= z >= joints[i+1]:
            return mix(names[i+1], names[i], (z-joints[i+1])/(joints[i]-joints[i+1]))
    return {names[0] if z > joints[0] else names[-1]: 1.}

weights = []
tail_vertices = []
for index, (x,y,z) in enumerate(positions):
    side = 'L' if x >= 0 else 'R'
    tail_threshold = float(np.interp(z, [0,.8,1.1,1.4,1.52], [.20,.22,.15,.07,.04]))
    is_tail = z < 1.52 and y > tail_threshold and -.72 < x < .16 and not cloth[index]
    if is_tail:
        w = chain(z, [1.52,1.23,.96,.63,.28], ['Pelvis','Tail01','Tail02','Tail03','Tail04'])
        tail_vertices.append(index)
    elif z > 2.08:
        w = mix('Neck','Head',(z-2.10)/.16)
    elif abs(x) > .35 and z < 1.96 and z > 1.02 and not cloth[index]:
        w = chain(z, [1.84,1.52,1.23], [f'UpperArm.{side}',f'Forearm.{side}',f'Hand.{side}'])
    elif z < 1.34 and not cloth[index]:
        w = chain(z, [1.35,1.08,.57,.24], ['Pelvis',f'Thigh.{side}',f'Shin.{side}',f'Foot.{side}'])
    elif z < 1.52:
        # The lower tunic follows the pelvis, with limited thigh influence to open
        # the front in seated poses. Tail weights can never reach this branch.
        w = mix('Pelvis',f'Thigh.{side}',max(0,(1.43-z))*.65)
    else:
        w = chain(z,[2.04,1.76,1.52],['Chest','Spine','Pelvis'])
    weights.append({name:value for name,value in w.items() if value > 1e-6})
for name in bones:
    group = body.vertex_groups.new(name=name)
    # Quantize only weights, not geometry, and batch equal weights for speed.
    buckets = {}
    for i,w in enumerate(weights):
        if name in w:
            value = round(w[name], 4)
            if value > 0:
                buckets.setdefault(value,[]).append(i)
    for value, indices in buckets.items():
        group.add(indices,value,'REPLACE')
modifier = body.modifiers.new('Forest_Skin','ARMATURE')
modifier.object = rig
body.parent = rig
assert all(abs(sum(w.values())-1) < 1e-6 for w in weights)
assert all(not any(k.startswith('Tail') for k in weights[i]) for i in np.flatnonzero(cloth))

def rotate(name, axis, radians):
    bone = rig.pose.bones[name]
    local_axis = bone.bone.matrix_local.to_quaternion().inverted() @ Vector(axis)
    bone.rotation_quaternion = Quaternion(local_axis, radians)

def aim(name, head, tail):
    bone = rig.pose.bones[name]
    rest = bone.bone
    direction = local(tail)-local(head)
    rotation = (rest.tail_local-rest.head_local).rotation_difference(direction)
    bone.matrix = Matrix.Translation(local(head)) @ rotation.to_matrix().to_4x4() @ rest.matrix_local.to_quaternion().to_matrix().to_4x4()
    bpy.context.view_layer.update()

def leg(side, hip, ankle):
    upper = (Vector(bones[f'Thigh.{side}'][1])-Vector(bones[f'Thigh.{side}'][0])).length
    lower = (Vector(bones[f'Shin.{side}'][1])-Vector(bones[f'Shin.{side}'][0])).length
    delta = Vector(ankle)-Vector(hip)
    distance = min(delta.length,upper+lower-.001)
    along = (upper*upper-lower*lower+distance*distance)/(2*distance)
    perpendicular = Vector((0, delta.z, -delta.y)).normalized()
    knee = Vector(hip)+delta.normalized()*along+perpendicular*math.sqrt(max(0,upper*upper-along*along))
    aim(f'Thigh.{side}',hip,knee)
    aim(f'Shin.{side}',knee,ankle)
    aim(f'Foot.{side}',ankle,Vector(ankle)+Vector((0,-.27,-.10)))

scene = bpy.context.scene
scene.render.fps = 30
clips = [('Idle',90),('Walk',36),('Run',24),('Sit',90),('Crouch',90),('Fish',90),('Paddle',60),('TailSweep',60)]
rig.animation_data_create()
for clip, length in clips:
    action = bpy.data.actions.new(clip)
    action.use_fake_user = True
    rig.animation_data.action = action
    for frame in range(1,length+2):
        phase = 2*math.pi*(frame-1)/length
        for bone in rig.pose.bones:
            bone.matrix_basis.identity()
        bob = 0
        seated = clip in ['Sit','Paddle']
        crouch = clip == 'Crouch'
        if clip in ['Walk','Run']:
            run = clip == 'Run'
            bob = -.045 + (.022 if run else .012)*math.cos(phase*2)
            rig.pose.bones['Root'].location.z = bob/5
            rotate('Spine',(1,0,0),-.06 if run else -.02)
            for sign,side in [(1,'L'),(-1,'R')]:
                p = phase+(math.pi if side == 'R' else 0)
                ankle = (sign*.23,-(.25 if run else .16)*math.cos(p),.25+max(0,math.sin(p))*(.16 if run else .08))
                leg(side,(sign*.23,0,1.30+bob),ankle)
                rotate(f'UpperArm.{side}',(1,0,0),-(.35 if run else .18)*math.cos(p))
                rotate(f'Forearm.{side}',(1,0,0),-.20 if run else -.06)
        elif seated or crouch:
            drop = .48 if seated else .33
            rig.pose.bones['Root'].location.z = -drop/5
            for sign,side in [(1,'L'),(-1,'R')]:
                leg(side,(sign*.23,0,1.30-drop),(sign*.23,-(.55 if seated else .20),.25))
            rotate('Spine',(1,0,0),-.08 if seated else -.24)
            for side in ['L','R']:
                rotate(f'UpperArm.{side}',(1,0,0),-.48 if seated else -.68)
                rotate(f'Forearm.{side}',(1,0,0),-.48)
        else:
            rotate('Chest',(1,0,0),.012*math.sin(phase))
            rotate('Head',(0,0,1),.035*math.sin(phase))
        if clip == 'Fish':
            rotate('UpperArm.L',(1,0,0),-.82+.04*math.sin(phase))
            rotate('Forearm.L',(1,0,0),-.54)
            rotate('UpperArm.R',(1,0,0),-.57)
            rotate('Forearm.R',(1,0,0),-.73+.05*math.sin(phase))
        if clip == 'Paddle':
            rotate('Chest',(0,0,1),.10*math.sin(phase))
            for side,offset in [('L',0),('R',.7)]:
                rotate(f'UpperArm.{side}',(1,0,0),-.85+.28*math.sin(phase+offset))
                rotate(f'Forearm.{side}',(1,0,0),-.48-.18*math.sin(phase+offset))
        for i in range(1,5):
            delay = (i-1)*.38
            amplitude = .17 if clip == 'TailSweep' else (.065 if clip == 'Run' else .035)
            rotate(f'Tail0{i}',(0,1,0),amplitude*math.sin(phase-delay))
            # A seated tail lifts behind the pelvis instead of clipping the floor.
            if seated or crouch:
                bone = rig.pose.bones[f'Tail0{i}']
                axis = bone.bone.matrix_local.to_quaternion().inverted() @ Vector((1,0,0))
                bone.rotation_quaternion = Quaternion(axis, -.27 if i == 1 else -.12) @ bone.rotation_quaternion
        for bone in rig.pose.bones:
            bone.keyframe_insert('location',frame=frame,group=bone.name)
            bone.keyframe_insert('rotation_quaternion',frame=frame,group=bone.name)
    track = rig.animation_data.nla_tracks.new()
    track.name = clip
    strip = track.strips.new(clip,1,action)
    strip.action_frame_start, strip.action_frame_end = 1,length+1
    track.mute = True
    print('AUTHORED',clip,flush=True)
rig.animation_data.action = None
for bone in rig.pose.bones:
    bone.matrix_basis.identity()
scene.frame_set(1)
bpy.context.view_layer.update()
body.select_set(True)
rig.select_set(True)
output = DIRECTORY/'rig-v1.glb'
bpy.ops.export_scene.gltf(filepath=str(output),export_format='GLB',use_selection=True,
                         export_animations=True,export_animation_mode='ACTIONS',
                         export_force_sampling=True,export_frame_range=False)
bpy.ops.wm.save_as_mainfile(filepath=str(DIRECTORY/'rig-v1.blend'))
record = {'source':source.relative_to(ROOT).as_posix(),'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),
          'output':output.relative_to(ROOT).as_posix(),'outputSha256':hashlib.sha256(output.read_bytes()).hexdigest(),
          'bones':len(bones),'tailBones':4,'clips':[{'name':n,'durationSeconds':f/30} for n,f in clips],
          'weights':'region-constrained, normalized, max two influences; cloth excluded from tail',
          'tailVertexCount':len(tail_vertices),'clothVerticesWithTailWeights':0,
          'geometryModified':False,'paidApiCalls':0,'status':'candidate; deformation and continuous playback review pending',
          'motionLimitations':['Procedurally authored in-place cycles, not motion capture','Fish/Paddle require prop alignment and interaction integration','No runtime transition or foot-lock acceptance yet']}
(EVIDENCE/'rig.json').write_text(json.dumps(record,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps(record),flush=True)
