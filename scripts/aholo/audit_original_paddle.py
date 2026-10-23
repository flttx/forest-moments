"""Read the unmodified source paddle poses for independent browser comparison."""
import bpy
import hashlib
import json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'docs/evidence/assets/2026-10-22-paddle-original'
OUT.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'assets/lux3d/round-01/canoe/assembly-review-v2.blend'))
rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
assert rig.animation_data.action.name=='paddle'
assert not any(b.constraints for b in rig.pose.bones)
frames=[]
for frame in range(217):
    bpy.context.scene.frame_set(frame);bpy.context.view_layer.update()
    hands={}
    for side in ['Left','Right']:
        bone=rig.pose.bones[f'mixamorig:{side}Hand']
        hands[side]=list(rig.matrix_world@bone.head.lerp(bone.tail,.5))
    frames.append({'frame':frame,'gripTargets':hands})
source=ROOT/'public/assets/models/raccoon.glb'
digest=hashlib.sha256(source.read_bytes()).hexdigest()
assert digest=='f35123a06d790a6802d20f278c4d2c23997ccf16c49dfd56923e6d8acf8a2a41'
(OUT/'original-poses.json').write_text(json.dumps({'sourceSha256':digest,'clip':'paddle','frames':frames},indent=2)+'\n')
print('ORIGINAL_PADDLE_POSES',len(frames),digest)
