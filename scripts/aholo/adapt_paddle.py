"""Reversible boat-specific arm/prop candidate; never write accepted sources.

Run with blender_run.py. Full mesh surface intersections and wrist errors are
diagnostics, not continuous collision or final visual acceptance.
"""
import bpy
import hashlib
import json
import math
import sys
from pathlib import Path
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree

raise RuntimeError('Rejected by user: incorrect arm poses and tearing. Do not regenerate or use the IK adaptation; reuse the original paddle clip.')

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'docs/evidence/assets/2026-10-22-paddle-fit'
OUT.mkdir(parents=True, exist_ok=True)
SOURCES = [ROOT/'public/assets/models'/f'{name}.glb' for name in ['raccoon', 'canoe']]
hashes = {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in SOURCES}
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'assets/lux3d/round-01/canoe/assembly-review-v2.blend'))
scene = bpy.context.scene
rig = next(o for o in scene.objects if o.type == 'ARMATURE')
source_action = rig.animation_data.action
paddle = bpy.data.objects['ASSEMBLY_ONLY_paddle']
parts = [o for o in scene.objects if o.name.startswith(('Paddle_blade', 'Paddle_shaft'))]
hulls = [bpy.data.objects[n] for n in ['Lux3D_canoe', 'Measured_hull_cavity_caps']]
trees = [BVHTree.FromPolygons([o.matrix_world@v.co for v in o.data.vertices], [tuple(p.vertices) for p in o.data.polygons]) for o in hulls]
source_axis = Vector((2.05, 1.95, 0)).normalized()
source_mid = Vector((.75, .80, .30)) - source_axis * .30
scale = .48

# Coordinates: +X bow, +Y left, +Z up; copied body motion remains unchanged.
# Keys span two strokes and a forward, raised recovery, with a closed seam.
keys = [
    (0, (-.08,-.15,.43), (-.30,-.80,-.45)),
    (12, (.10,-.08,.48), (0,-.95,.35)),
    (27, (.16,0,.47), (1,0,.30)),
    (43, (.16,.10,.46), (.30,.85,-.30)),
    (55, (.14,.10,.43), (.30,.80,-.68)),
    (90, (.02,.10,.43), (-.08,.80,-.68)),
    (108, (-.08,.10,.43), (-.30,.80,-.45)),
    (123, (.10,.08,.48), (0,.95,.35)),
    (139, (.16,0,.47), (1,0,.30)),
    (151, (.16,-.10,.46), (.30,-.85,-.30)),
    (163, (.14,-.15,.43), (.30,-.80,-.68)),
    (198, (.02,-.15,.43), (-.08,-.80,-.68)),
    (216, (-.08,-.15,.43), (-.30,-.80,-.45)),
]

def ease(t):
    return t*t*(3-2*t)

def trajectory(frame):
    for a, b in zip(keys, keys[1:]):
        if a[0] <= frame <= b[0]:
            u = ease((frame-a[0])/(b[0]-a[0]))
            mid = Vector(a[1]).lerp(Vector(b[1]), u)
            # Keep the upper grip below the muzzle; asymmetric hull needs more
            # outboard reach on the right. Neither hull nor seated body moves.
            mid.x = mid.x*.5 + .10
            mid.y *= 1.6 if mid.y >= 0 else 1.4
            mid.z -= .14
            down = Vector(a[2]).normalized().lerp(Vector(b[2]).normalized(), u).normalized()
            down.z *= .8
            return mid, down.normalized()
    raise ValueError(frame)

def grip_sign(frame):
    # Left is the lower hand on the left stroke. Regrip in the raised recovery.
    if frame < 12: return -1
    if frame < 43: return -1+2*ease((frame-12)/31)
    if frame < 123: return 1
    if frame < 151: return 1-2*ease((frame-123)/28)
    return -1

targets = {}
poles = {}
constraints = []
for side in ['Left', 'Right']:
    target = bpy.data.objects.new(f'CANDIDATE_{side}_wrist', None)
    scene.collection.objects.link(target)
    targets[side] = target
    pole = bpy.data.objects.new(f'CANDIDATE_{side}_elbow', None)
    scene.collection.objects.link(pole); poles[side] = pole
    fore = rig.pose.bones[f'mixamorig:{side}ForeArm']
    ik = fore.constraints.new('IK'); ik.target = target; ik.chain_count = 2
    ik.iterations = 200; ik.use_stretch = False
    ik.pole_target = pole; ik.pole_angle = -math.pi/2
    hand = rig.pose.bones[f'mixamorig:{side}Hand']
    rot = hand.constraints.new('COPY_ROTATION'); rot.target = target
    rot.owner_space = 'WORLD'; rot.target_space = 'WORLD'
    constraints.extend([ik, rot])

records = []
arm_names = [f'mixamorig:{s}{b}' for s in ['Left','Right'] for b in ['Arm','ForeArm','Hand']]
arm_poses = []
for frame in range(217):
    for c in constraints: c.influence = 0
    scene.frame_set(frame); bpy.context.view_layer.update()
    original = {}
    for side in targets:
        b = rig.pose.bones[f'mixamorig:{side}Hand']
        original[side] = (rig.matrix_world@b.head, rig.matrix_world@b.head.lerp(b.tail,.5), (rig.matrix_world@b.matrix).to_quaternion())
    mid, down = trajectory(frame)
    q = source_axis.rotation_difference(-down)
    paddle.matrix_world = Matrix.Translation(mid) @ q.to_matrix().to_4x4() @ Matrix.Diagonal((scale,scale,scale,1)) @ Matrix.Translation(-source_mid)
    paddle.keyframe_insert('location', frame=frame)
    paddle.rotation_mode = 'QUATERNION'; paddle.rotation_quaternion = q
    paddle.keyframe_insert('rotation_quaternion', frame=frame)
    sign = grip_sign(frame)
    desired = {}
    for side, target in targets.items():
        wrist, center, rotation = original[side]
        s = sign if side == 'Left' else -sign
        # Separate the released hand in front while changing grip order.
        release = max(0, 1-abs(sign))
        goal = mid + down*(.13*s) + Vector((.06*release*(1 if side=='Left' else -1),0,0))
        desired[side] = goal
        target.location = goal - (center-wrist)
        target.rotation_mode = 'QUATERNION'; target.rotation_quaternion = rotation
        shoulder = rig.matrix_world @ rig.pose.bones[f'mixamorig:{side}Arm'].head
        poles[side].location = shoulder + Vector((.2, .15 if side=='Left' else -.15, -.6))
    for c in constraints: c.influence = 1
    bpy.context.view_layer.update()
    errors = {}
    for side in targets:
        b = rig.pose.bones[f'mixamorig:{side}Hand']
        errors[side] = (rig.matrix_world@b.head.lerp(b.tail,.5)-desired[side]).length
    arm_poses.append({n: rig.pose.bones[n].matrix.copy() for n in arm_names})
    overlaps = {}
    tips = []
    for obj in parts:
        vertices = [obj.matrix_world@v.co for v in obj.data.vertices]
        part_tree = BVHTree.FromPolygons(vertices, [tuple(p.vertices) for p in obj.data.polygons])
        overlaps[obj.name] = sum(len(tree.overlap(part_tree)) for tree in trees)
        if obj.name == 'Paddle_blade': tips = vertices
    records.append({'frame': frame, 'handError': errors, 'gripTargets': {s:list(v) for s,v in desired.items()}, 'surfaceIntersections': overlaps,
                    'bladeMinZ': min(v.z for v in tips), 'mid':list(mid), 'down':list(down)})

# Bake only the six arm bones into a COPY of the original action.
candidate = source_action.copy(); candidate.name = 'paddle_boat_fit_candidate'
rig.animation_data.action = candidate
if candidate.slots: rig.animation_data.action_slot = candidate.slots[0]
for bone in rig.pose.bones:
    for c in list(bone.constraints):
        if c in constraints: bone.constraints.remove(c)
previous_rotations = {}
for frame, poses in enumerate(arm_poses):
    scene.frame_set(frame)
    for name in arm_names:
        bone = rig.pose.bones[name]; bone.matrix = poses[name]
        # q and -q are the same orientation, but component interpolation between
        # opposite signs passes through zero and flips the arm between frames.
        if name in previous_rotations:
            bone.rotation_quaternion.make_compatible(previous_rotations[name])
        previous_rotations[name] = bone.rotation_quaternion.copy()
        bpy.context.view_layer.update()
        bone.keyframe_insert('location', frame=frame)
        bone.keyframe_insert('rotation_quaternion', frame=frame)
        bone.keyframe_insert('scale', frame=frame)

for layer in candidate.layers:
    for strip in layer.strips:
        for bag in strip.channelbags:
            for curve in bag.fcurves:
                if any(f'["{n}"]' in curve.data_path for n in arm_names):
                    for key in curve.keyframe_points: key.interpolation = 'LINEAR'

summary = {'sourceHashes':hashes, 'paddleScale':scale, 'sourceModified':False,
           'editedBones':arm_names, 'status':'candidate, awaiting visual review',
           'waterZ':-.355, 'frames':records,
           'intersectingFrames':[r['frame'] for r in records if any(r['surfaceIntersections'].values())],
           'maxHandError':max(max(r['handError'].values()) for r in records),
           'wetFramesLeft':[r['frame'] for r in records if 55<=r['frame']<=108 and r['bladeMinZ']<-.355],
           'wetFramesRight':[r['frame'] for r in records if 163<=r['frame']<=216 and r['bladeMinZ']<-.355]}
assert all(hashlib.sha256(p.read_bytes()).hexdigest()==hashes[p.name] for p in SOURCES)
(OUT/'candidate-audit.json').write_text(json.dumps(summary,indent=2)+'\n',encoding='utf-8')
scene.frame_set(75); bpy.context.view_layer.update()
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets/lux3d/round-01/canoe/paddle-fit-candidate.blend'))
print('CANDIDATE_RESULT',json.dumps({k:v for k,v in summary.items() if k!='frames'}),flush=True)
if '--render' in sys.argv:
    scene.cycles.samples = 12
    for frame in [27,75,139,190]:
        scene.frame_set(frame); bpy.context.view_layer.update()
        scene.camera.location = (2.5,-4,2.4)
        scene.camera.rotation_euler=(Vector((0,0,.25))-scene.camera.location).to_track_quat('-Z','Y').to_euler()
        scene.render.filepath=str(OUT/f'candidate-{frame:03d}.png')
        bpy.ops.render.render(write_still=True)
