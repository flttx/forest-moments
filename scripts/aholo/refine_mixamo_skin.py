"""ARCHIVED REJECTED EXPERIMENT: garment weight changes caused broken surfaces.

Reuse the existing Mixamo skeleton/actions. Color and position constrain garment
weights; spatial welding smooths UV splits without changing delivered geometry.
User stopped this approach. These outputs must not become the review default.
"""
import bpy
import argparse
import hashlib
import json
from pathlib import Path
import numpy as np
import sys

ROOT = Path(__file__).resolve().parents[2]
DIRECTORY = ROOT / 'assets/lux3d/round-01/raccoon-multiview'
parser = argparse.ArgumentParser(description='Archived failed experiment; garment editing stopped by user.')
parser.add_argument('--variant', choices=['rig-mixamo-v7', 'rig-mixamo-v8', 'rig-mixamo-v9'], required=True)
parser.add_argument('--reproduce-rejected-experiment', action='store_true')
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
if not args.reproduce_rejected_experiment:
    parser.error('Garment editing stopped by user; archived failed experiment is disabled by default.')
VARIANT = args.variant
EVIDENCE = ROOT / 'docs/evidence/assets/2026-10-22-round-01/raccoon-multiview' / VARIANT
EVIDENCE.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(DIRECTORY / 'rig-mixamo-v6.blend'))
rig = next(o for o in bpy.context.scene.objects if o.type == 'ARMATURE')
body = next(o for o in bpy.context.scene.objects if o.type == 'MESH')
rig.animation_data.action = None
for track in rig.animation_data.nla_tracks:
    track.mute = True
for bone in rig.pose.bones:
    bone.matrix_basis.identity()
mesh = body.data
names = [g.name for g in body.vertex_groups]
indices = {name: i for i, name in enumerate(names)}
positions = np.array([v.co[:] for v in mesh.vertices])
weights = np.zeros((len(positions), len(names)), dtype=np.float32)
for v in mesh.vertices:
    for g in v.groups:
        weights[v.index, g.group] = g.weight
original = weights.copy()
tail_columns = [i for i, n in enumerate(names) if n.startswith('tail_')]
is_tail = weights[:, tail_columns].sum(axis=1) > 0

# Sample the actual albedo; the earlier roughness-material regions are not an
# anatomical segmentation (some green hem faces were labelled Fur).
texture = next(n.image for m in mesh.materials for n in m.node_tree.nodes if n.type == 'TEX_IMAGE')
width, height = texture.size
pixels = np.empty(width * height * 4, dtype=np.float32)
texture.pixels.foreach_get(pixels)
pixels = pixels.reshape(height, width, 4)
loop_vertex = np.array([l.vertex_index for l in mesh.loops])
uv = np.array([l.uv[:] for l in mesh.uv_layers.active.data])
color = pixels[np.clip((uv[:, 1] * height).astype(int), 0, height - 1),
               np.clip((uv[:, 0] * width).astype(int), 0, width - 1), :3]
vertex_color = np.zeros((len(positions), 3), dtype=np.float32)
np.add.at(vertex_color, loop_vertex, color)
counts = np.bincount(loop_vertex, minlength=len(positions))
vertex_color /= np.maximum(counts[:, None], 1)
r, g, b = vertex_color.T
green = (g >= r * .96) & (g > b * 1.24)

def smoothstep(value):
    value = np.clip(value, 0, 1)
    return value * value * (3 - 2 * value)

def assign(row, values):
    weights[row] = 0
    for name, value in values.items():
        weights[row, indices['mixamorig:' + name]] = value

corrected = {'garment': 0, 'torso': 0, 'leg': 0, 'arm': 0}
for i, (x, y, z) in enumerate(positions):
    if is_tail[i] or z > .735:
        continue
    side = 'Left' if x >= 0 else 'Right'
    ax = abs(x)
    if VARIANT == 'rig-mixamo-v9':
        garment = (green[i] and .375 < z < .735) or (.402 < z < .515 and ax < .155)
        if garment:
            if z < .515:
                allowed = [indices['mixamorig:' + n] for n in ['Hips', 'Spine', side + 'UpLeg']]
                fallback = {'Hips': .85, side + 'UpLeg': .15}
            else:
                allowed = [indices['mixamorig:' + n] for n in ['Spine', 'Spine1', 'Spine2', 'Neck', side + 'Shoulder', side + 'Arm']]
                fallback = {side + 'Arm': 1} if ax > .13 else {'Spine2': 1}
            total = weights[i, allowed].sum()
            if total > .1:
                values = weights[i, allowed].copy() / total
                weights[i] = 0
                weights[i, allowed] = values
            else:
                assign(i, fallback)
            corrected['garment'] += 1
        elif z < .40 and ax < .13 and weights[i, indices['mixamorig:Hips']] > .5:
            assign(i, {side + 'UpLeg': 1})
            corrected['leg'] += 1
        continue
    lower_garment = VARIANT == 'rig-mixamo-v8' and .402 < z < .515 and ax < .155
    if (green[i] and .375 < z < .735) or lower_garment:
        if z < .515:
            # Keep the hem attached to the pelvis; blend towards the matching
            # thigh at its lower edge so sitting does not bury it in the legs.
            thigh = .48 * smoothstep((.49 - z) / .11)
            assign(i, {'Hips': 1 - thigh, side + 'UpLeg': thigh})
        else:
            spine = smoothstep((z - .515) / .14)
            arm = .32 * smoothstep((ax - .09) / .09) * smoothstep((z - .54) / .06)
            assign(i, {'Spine': (1 - spine) * (1 - arm), 'Spine2': spine * (1 - arm), side + 'Arm': arm})
        corrected['garment'] += 1
    elif .405 < z < .735 and ax < .105:
        if z < .55:
            blend = smoothstep((z - .475) / .075)
            assign(i, {'Hips': 1 - blend, 'Spine': blend})
        else:
            blend = smoothstep((z - .55) / .14)
            assign(i, {'Spine': 1 - blend, 'Spine2': blend})
        corrected['torso'] += 1
    elif z < .42 and ax < (.135 if VARIANT == 'rig-mixamo-v8' else .16):
        # Avoid the Hips=1 fallback left behind when old tail weights were
        # removed. Restrict legs to their own chain, then smooth transitions.
        allowed = [indices['mixamorig:' + side + suffix] for suffix in ['UpLeg', 'Leg', 'Foot', 'ToeBase', 'Toe_End']]
        total = weights[i, allowed].sum()
        if total > .25:
            valid = weights[i, allowed].copy() / total
            weights[i] = 0
            weights[i, allowed] = valid
        else:
            knee = smoothstep((z - .19) / .085)
            ankle = smoothstep((z - .07) / .06)
            assign(i, {side + 'UpLeg': knee, side + 'Leg': (1 - knee) * ankle, side + 'Foot': (1 - knee) * (1 - ankle)})
        corrected['leg'] += 1
    elif .34 < z < .68 and ax > .115:
        allowed = [j for j, name in enumerate(names) if name.startswith('mixamorig:' + side) and any(part in name for part in ['Arm', 'Hand'])]
        total = weights[i, allowed].sum()
        if total > .25:
            valid = weights[i, allowed].copy() / total
            weights[i] = 0
            weights[i, allowed] = valid
        else:
            elbow = smoothstep((z - .515) / .08)
            wrist = smoothstep((z - .415) / .055)
            assign(i, {side + 'Arm': elbow, side + 'ForeArm': (1 - elbow) * wrist, side + 'Hand': (1 - elbow) * (1 - wrist)})
        corrected['arm'] += 1

# Geometry adjacency, welded at coincident UV/material seams. Keep the deliberate
# tail/body split separate. Smoothing spreads constraints across texture borders
# and removes the old nearest-triangle weight discontinuities.
keys = np.column_stack((np.round(positions * 100000).astype(np.int64), is_tail))
_, inverse = np.unique(keys, axis=0, return_inverse=True)
node_count = int(inverse.max()) + 1
node_counts = np.bincount(inverse, minlength=node_count)
node_weights = np.zeros((node_count, len(names)), dtype=np.float32)
np.add.at(node_weights, inverse, weights)
node_weights /= node_counts[:, None]
edges = inverse[np.array([e.vertices[:] for e in mesh.edges])]
edges = np.unique(np.sort(edges, axis=1), axis=0)
edges = edges[edges[:, 0] != edges[:, 1]]
dest = np.concatenate((edges[:, 0], edges[:, 1]))
source = np.concatenate((edges[:, 1], edges[:, 0]))
degree = np.bincount(dest, minlength=node_count)
for _ in range(24):
    neighbor = np.zeros_like(node_weights)
    np.add.at(neighbor, dest, node_weights[source])
    average = neighbor / np.maximum(degree[:, None], 1)
    node_weights = .45 * node_weights + .55 * average
weights = node_weights[inverse]
# The original tail distribution/animation is unchanged in this body repair.
weights[is_tail] = original[is_tail]
strongest = np.argsort(weights, axis=1)[:, -4:]
limited = np.zeros_like(weights)
np.put_along_axis(limited, strongest, np.take_along_axis(weights, strongest, axis=1), axis=1)
weights = limited
weights /= np.maximum(weights.sum(axis=1, keepdims=True), 1e-8)
body.vertex_groups.clear()
groups = [body.vertex_groups.new(name=n) for n in names]
for j, group in enumerate(groups):
    quantized = np.round(weights[:, j], 4)
    ordered = np.argsort(quantized)
    ordered = ordered[quantized[ordered] > 0]
    boundaries = np.flatnonzero(np.diff(quantized[ordered])) + 1
    for bucket in np.split(ordered, boundaries):
        if len(bucket):
            group.add(bucket.tolist(), float(quantized[bucket[0]]), 'REPLACE')
bpy.context.view_layer.objects.active = body
bpy.ops.object.vertex_group_normalize_all(lock_active=False)
bpy.context.scene.frame_set(0)
bpy.ops.object.select_all(action='SELECT')
output = DIRECTORY / (VARIANT + '.glb')
bpy.ops.export_scene.gltf(filepath=str(output), export_format='GLB', use_selection=True,
    export_animations=True, export_animation_mode='ACTIONS', export_force_sampling=True, export_frame_range=False,
    export_all_influences=False)
bpy.ops.wm.save_as_mainfile(filepath=str(DIRECTORY / (VARIANT + '.blend')))
record = {'source': 'rig-mixamo-v6.glb', 'output': output.relative_to(ROOT).as_posix(),
    'outputSha256': hashlib.sha256(output.read_bytes()).hexdigest(), 'correctedVertices': corrected,
    'triangles': len(mesh.polygons), 'actions': len(bpy.data.actions), 'geometryModified': False,
    'tailTracksModified': False, 'bodyTracksModified': False, 'smoothingIterations': 24,
    'paidApiCalls': 0, 'status': 'REJECTED: garment deformation; user instructed no further garment editing'}
(EVIDENCE / 'rig.json').write_text(json.dumps(record, indent=2) + '\n', encoding='utf-8')
print(json.dumps(record), flush=True)
