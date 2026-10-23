"""Audit baked interpolation, source preservation, and export a review-only GLB."""
import bpy
import hashlib
import json
import math
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree

raise RuntimeError('IK candidate rejected for incorrect arm poses and tearing; export disabled. Use original paddle playback.')

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'docs/evidence/assets/2026-10-22-paddle-fit'
SOURCE=ROOT/'assets/lux3d/round-01/canoe/paddle-fit-candidate.blend'
bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
scene=bpy.context.scene
rig=next(o for o in scene.objects if o.type=='ARMATURE')
candidate=rig.animation_data.action
original=next(a for a in bpy.data.actions if a.name=='paddle')
fit=json.loads((OUT/'candidate-audit.json').read_text())
unchanged=[b.name for b in rig.pose.bones if b.name not in fit['editedBones']]
def select(action):
    rig.animation_data.action=action
    if action.slots: rig.animation_data.action_slot=action.slots[0]
    bpy.context.view_layer.update()
max_other=0
for frame in range(217):
    select(original); scene.frame_set(frame); bpy.context.view_layer.update()
    before={n:rig.pose.bones[n].matrix_basis.copy() for n in unchanged}
    select(candidate); scene.frame_set(frame); bpy.context.view_layer.update()
    max_other=max(max_other,max(abs(before[n][i][j]-rig.pose.bones[n].matrix_basis[i][j]) for n in unchanged for i in range(4) for j in range(4)))
trees=[]
for name in ['Lux3D_canoe','Measured_hull_cavity_caps']:
    o=bpy.data.objects[name]
    trees.append(BVHTree.FromPolygons([o.matrix_world@v.co for v in o.data.vertices],[tuple(p.vertices) for p in o.data.polygons]))
parts=[o for o in scene.objects if o.name.startswith(('Paddle_blade','Paddle_shaft'))]
records=[]; hand_positions=[]; arm_quaternions=[]
for sample in range(865):
    frame=sample/4; base=int(frame); u=frame-base
    scene.frame_set(base,subframe=u); bpy.context.view_layer.update()
    collisions={}
    for o in parts:
        tree=BVHTree.FromPolygons([o.matrix_world@v.co for v in o.data.vertices],[tuple(p.vertices) for p in o.data.polygons])
        collisions[o.name]=sum(len(t.overlap(tree)) for t in trees)
    errors={}; positions={}
    for side in ['Left','Right']:
        b=rig.pose.bones[f'mixamorig:{side}Hand']; p=rig.matrix_world@b.head.lerp(b.tail,.5)
        a=Vector(fit['frames'][base]['gripTargets'][side]); z=Vector(fit['frames'][min(base+1,216)]['gripTargets'][side])
        errors[side]=(p-a.lerp(z,u)).length;positions[side]=p
    hand_positions.append(positions)
    arm_quaternions.append({n:rig.pose.bones[n].matrix_basis.to_quaternion() for n in fit['editedBones']})
    records.append({'frame':frame,'intersections':collisions,'handErrors':errors})
report={'scope':'865 samples at 120 Hz of baked animation; mesh surface intersection only, not swept volume proof',
        'samples':len(records),'maxUneditedLocalMatrixDelta':max_other,
        'maxBakedHandError':max(max(r['handErrors'].values()) for r in records),
        'intersectingFrames':[r for r in records if any(r['intersections'].values())],
        'handLoopSeamMeters':{s:(hand_positions[0][s]-hand_positions[-1][s]).length for s in ['Left','Right']},
        'maxHandStepMeters':max((b[s]-a[s]).length for a,b in zip(hand_positions,hand_positions[1:]) for s in ['Left','Right']),
        'maxArmStepDegrees':max(min(math.degrees(a[n].rotation_difference(b[n]).angle),360-math.degrees(a[n].rotation_difference(b[n]).angle)) for a,b in zip(arm_quaternions,arm_quaternions[1:]) for n in fit['editedBones']),
        'records':records}
(OUT/'baked-audit.json').write_text(json.dumps(report,indent=2)+'\n')
print('BAKED_AUDIT',json.dumps({k:v for k,v in report.items() if k!='records'}),flush=True)
assert max_other<1e-6,'Non-arm source poses changed'
assert not report['intersectingFrames'],'Baked paddle intersects hull'
assert report['maxBakedHandError']<.005,'Baking or interpolation broke grip'
assert max(report['handLoopSeamMeters'].values())<.005,'Loop position seam'

# Exclude studio/cameras/constraint targets. A separate review assembly never
# replaces the accepted runtime model or its 19 original clips.
bpy.ops.object.select_all(action='DESELECT')
for root_name in ['ASSEMBLY_ONLY_boat','ASSEMBLY_ONLY_character','ASSEMBLY_ONLY_paddle']:
    root=bpy.data.objects[root_name]; root.select_set(True)
    for child in root.children_recursive: child.select_set(True)
scene.frame_start=0;scene.frame_end=216;scene.frame_set(0)
dest=ROOT/'assets/lux3d/round-01/canoe/paddle-fit-review.glb'
bpy.ops.export_scene.gltf(filepath=str(dest),use_selection=True,export_format='GLB',
    export_animation_mode='ACTIVE_ACTIONS',export_force_sampling=True,export_frame_range=True,
    export_anim_single_armature=False,export_current_frame=False)
report['reviewGlb']={'path':str(dest.relative_to(ROOT)),'bytes':dest.stat().st_size,'sha256':hashlib.sha256(dest.read_bytes()).hexdigest()}
(OUT/'baked-audit.json').write_text(json.dumps(report,indent=2)+'\n')
print('REVIEW_EXPORTED',json.dumps(report['reviewGlb']),flush=True)
