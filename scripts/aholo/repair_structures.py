"""Local, reversible structural edits. Raw Lux3D meshes/textures are retained.

No decimation, global remesh, or character changes. Each output remains a
candidate until its exported GLB has been rendered and inspected.
"""
import argparse
import bpy
import hashlib
import json
import math
from pathlib import Path
import sys
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from mathutils.geometry import barycentric_transform

ROOT = Path(__file__).resolve().parents[2]
parser = argparse.ArgumentParser()
parser.add_argument('asset', choices=['workshop', 'lookout', 'canoe'])
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
directory = ROOT / 'assets/lux3d/round-01' / args.asset
evidence = ROOT / 'docs/evidence/assets/2026-10-22-round-01' / args.asset / 'structure-v1'
evidence.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
source = directory / 'output-1.glb'
bpy.ops.import_scene.gltf(filepath=str(source))
body = next(o for o in bpy.context.scene.objects if o.type == 'MESH')
body.name = 'Lux3D_' + args.asset
bpy.context.view_layer.objects.active = body
body.select_set(True)
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
mesh = body.data
initial_triangles = len(mesh.polygons)
original_points = np.array([v.co[:] for v in mesh.vertices])
changes = []

def material(name, rgb, roughness=.8):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = (*rgb, 1)
    shader.inputs['Roughness'].default_value = roughness
    return mat

wood = material('Local warm timber repairs', (.34, .18, .075))
plaster = material('Local plaster backing', (.48, .40, .29))

def beam(name, start, end, width, depth, mat):
    start, end = Vector(start), Vector(end)
    bpy.ops.mesh.primitive_cube_add(size=1, location=(start + end) / 2)
    obj = bpy.context.object
    obj.name = name
    obj.rotation_euler = (end - start).to_track_quat('Z', 'Y').to_euler()
    obj.scale = (width, depth, (end - start).length)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    bevel = obj.modifiers.new('Small edge bevel', 'BEVEL')
    bevel.width = min(width, depth) * .12
    bevel.segments = 2
    bpy.ops.object.modifier_apply(modifier=bevel.name)
    return obj

if args.asset == 'workshop':
    # Picked from the original back camera. Thin backings are behind the visible
    # surface, closing the measured voids without replacing the facade or roof.
    beam('Attic_plaster_hole_backing', (.59, 2.075, .89), (.59, 2.075, 1.105), .23, .035, plaster)
    beam('Ridge_underbeam_backing', (.93, 2.04, 1.59), (.93, 2.04, 1.77), .22, .055, wood)
    beam('Annex_rear_eave_inner_timber', (-.98, 2.18, .35), (-2.78, 2.18, -.24), .15, .13, wood)
    changes += ['Three separate local backing meshes behind attic/eave defects; original workshop faces retained']
elif args.asset == 'lookout':
    # Separate the obstructing central gate, preserving its original polygons,
    # UVs and materials. Open inwards around the right post; no cut to stair treads.
    bpy.ops.object.select_all(action='DESELECT')
    body.select_set(True)
    bpy.context.view_layer.objects.active = body
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_mode(type='FACE')
    bpy.ops.mesh.select_all(action='DESELECT')
    bpy.ops.object.mode_set(mode='OBJECT')
    for polygon in mesh.polygons:
        x, y, z = polygon.center
        polygon.select = -.30 < x < .30 and .30 < y < .78 and .225 < z < .66
    selected = sum(p.select for p in mesh.polygons)
    assert selected > 50, 'Entry gate selection unexpectedly empty'
    before = set(bpy.data.objects)
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.separate(type='SELECTED')
    bpy.ops.object.mode_set(mode='OBJECT')
    gate = next(o for o in bpy.data.objects if o not in before and o.type == 'MESH')
    assert len(gate.data.polygons) == selected
    assert len(body.data.polygons) + selected == initial_triangles
    gate.name = 'Entry_gate_open_inward'
    pivot = Vector((.30, .51, .225))
    for v in gate.data.vertices:
        v.co -= pivot
    gate.location = pivot
    gate.rotation_euler.z = math.radians(100)
    changes += [{'operation': 'separate and open original entry gate', 'selectedFaces': selected,
                 'hinge': list(pivot), 'openDegrees': 100, 'stairsModified': False}]
else:
    # Scan the original hull underside in its longitudinal frame. Only deep,
    # locally anomalous recesses get small backing patches; hull/ribs stay intact.
    points = [v.co.copy() for v in mesh.vertices]
    tree = BVHTree.FromPolygons(points, [tuple(p.vertices) for p in mesh.polygons], all_triangles=True)
    uv = mesh.uv_layers.active.data
    texture = next(n.image for mat in mesh.materials for n in mat.node_tree.nodes
                   if n.type == 'TEX_IMAGE' and n.image.colorspace_settings.name == 'sRGB')
    width, height = texture.size
    pixels = np.empty(width * height * 4, dtype=np.float32)
    texture.pixels.foreach_get(pixels)
    pixels = pixels.reshape(height, width, 4)
    us = np.arange(-3.25, 3.26, .035)
    vs = np.arange(-.92, .93, .035)
    grid = np.full((len(us), len(vs), 6), np.nan)
    for i, u in enumerate(us):
        for j, v in enumerate(vs):
            x, y = (u - v) / math.sqrt(2), (u + v) / math.sqrt(2)
            point, normal, face_index, _ = tree.ray_cast(Vector((x, y, -2)), Vector((0, 0, 1)))
            if point is None:
                continue
            face = mesh.polygons[face_index]
            texcoord = barycentric_transform(point, *(points[k] for k in face.vertices),
                *(Vector((*uv[k].uv, 0)) for k in face.loop_indices))
            color = pixels[int(np.clip(texcoord.y * height, 0, height - 1)),
                           int(np.clip(texcoord.x * width, 0, width - 1)), :3]
            grid[i, j] = [*point, *color]
    z = grid[:, :, 2]
    import warnings
    with warnings.catch_warnings():
        warnings.simplefilter('ignore', RuntimeWarning)
        median = np.nanmedian(np.lib.stride_tricks.sliding_window_view(
            np.pad(z, 3, constant_values=np.nan), (7, 7)), axis=(-2, -1))
    u, v = np.meshgrid(us, vs, indexing='ij')
    selected = ((z - median) > .060) & (abs(u) < 2.8) & (abs(v) < .72) & (median < -.30)
    patch_z = np.where(selected, median - .008, z - .003)
    patch_points, patch_faces, patch_colors, mapping = [], [], [], {}
    for i in range(1, len(us) - 2):
        for j in range(1, len(vs) - 2):
            if not selected[i:i+2, j:j+2].any() or not np.isfinite(z[i:i+2, j:j+2]).all():
                continue
            corners = [(i, j), (i+1, j), (i+1, j+1), (i, j+1)]
            face = []
            for a, b in corners:
                if (a, b) not in mapping:
                    mapping[a, b] = len(patch_points)
                    patch_points.append((*grid[a, b, :2], patch_z[a, b]))
                    color = np.nanmedian(grid[max(0,a-2):a+3, max(0,b-2):b+3, 3:6], axis=(0, 1))
                    # PNG pixels are sRGB; vertex colors in Blender are linear.
                    color = np.where(color <= .04045, color / 12.92, ((color + .055) / 1.055) ** 2.4)
                    patch_colors.append((*color, 1))
                face.append(mapping[a, b])
            patch_faces.append(tuple(reversed(face)))
    patch_mesh = bpy.data.meshes.new('Local_hull_recess_backings')
    patch_mesh.from_pydata(patch_points, [], patch_faces)
    patch_mesh.update()
    obj = bpy.data.objects.new('Local_hull_recess_backings', patch_mesh)
    bpy.context.collection.objects.link(obj)
    colors = patch_mesh.color_attributes.new(name='Sampled_hull_color', type='FLOAT_COLOR', domain='CORNER')
    for loop in patch_mesh.loops:
        colors.data[loop.index].color = patch_colors[loop.vertex_index]
    mat = material('Sampled original hull wood', (.2, .1, .04))
    color_node = mat.node_tree.nodes.new('ShaderNodeVertexColor')
    color_node.layer_name = colors.name
    mat.node_tree.links.new(color_node.outputs['Color'], mat.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])
    patch_mesh.materials.append(mat)
    for polygon in patch_mesh.polygons:
        polygon.use_smooth = True
    changes += [{'operation': 'local underside recess backing', 'samplePitch': .035,
                 'recessThreshold': .06, 'selectedSamples': int(selected.sum()), 'addedQuads': len(patch_faces)}]

    # A separate wooden paddle, authored locally. No edits to the woven seat,
    # ribs or hull; object remains independently selectable for later animation.
    shaft = beam('Paddle_shaft', (-1.30, -1.15, .30), (.75, .80, .30), .045, .045, wood)
    blade = beam('Paddle_blade', (-1.61, -1.45, .30), (-1.15, -1.00, .30), .23, .035, wood)
    changes += ['Separate shaft and blade meshes for a resting paddle; grip alignment awaits gameplay integration']

bpy.context.view_layer.update()
bpy.ops.object.select_all(action='SELECT')
output = directory / 'structure-v1.glb'
bpy.ops.export_scene.gltf(filepath=str(output), export_format='GLB', use_selection=True)
bpy.ops.wm.save_as_mainfile(filepath=str(directory / 'structure-v1.blend'))
unchanged = True if args.asset == 'lookout' else bool(np.array_equal(original_points, np.array([v.co[:] for v in mesh.vertices])))
assert unchanged
record = {'asset': args.asset, 'source': source.relative_to(ROOT).as_posix(),
    'sourceSha256': hashlib.sha256(source.read_bytes()).hexdigest(), 'output': output.relative_to(ROOT).as_posix(),
    'outputSha256': hashlib.sha256(output.read_bytes()).hexdigest(), 'importedOriginalTriangles': initial_triangles,
    'changes': changes, 'decimationApplied': False, 'characterModified': False, 'paidApiCalls': 0,
    'originalMeshCoordinatesUnchanged': unchanged if args.asset != 'lookout' else 'gate moved as a separate object',
    'status': 'candidate; exported GLB visual review pending', 'browserVerified': False}
(evidence / 'structure.json').write_text(json.dumps(record, indent=2) + '\n', encoding='utf-8')
print(json.dumps(record), flush=True)
