"""Second local structure pass, preserving raw geometry and rejected v1 evidence."""
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
evidence = ROOT / 'docs/evidence/assets/2026-10-22-round-01' / args.asset / 'structure-v2'
evidence.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(directory / 'structure-v1.blend'))
changes = []
if args.asset == 'workshop':
    bpy.data.objects['Attic_plaster_hole_backing'].location.y = 2.015
    changes.append('Recess plaster backing behind intact original wall to avoid rectangular overlay')
elif args.asset == 'lookout':
    gate = bpy.data.objects['Entry_gate_open_inward']
    gate.rotation_mode = 'XYZ'
    gate.rotation_euler = (0, 0, math.radians(100))
    changes.append('Set explicit XYZ rotation mode so the separated 1480-face gate actually opens 100 degrees')
else:
    bpy.data.objects.remove(bpy.data.objects['Local_hull_recess_backings'], do_unlink=True)
    body = bpy.data.objects['Lux3D_canoe']
    mesh = body.data
    points = [v.co.copy() for v in mesh.vertices]
    tree = BVHTree.FromPolygons(points, [tuple(p.vertices) for p in mesh.polygons], all_triangles=True)
    uv = mesh.uv_layers.active.data
    texture = next(n.image for mat in mesh.materials for n in mat.node_tree.nodes
                   if n.type == 'TEX_IMAGE' and n.image.colorspace_settings.name == 'sRGB')
    width, height = texture.size
    pixels = np.empty(width * height * 4, dtype=np.float32)
    texture.pixels.foreach_get(pixels)
    pixels = pixels.reshape(height, width, 4)
    regions = json.loads((evidence / 'defect-regions.json').read_text(encoding='utf-8'))
    assert hashlib.sha256((ROOT / regions['source']).read_bytes()).hexdigest() == regions['sourceSha256']
    # The exact original bottom-view camera, transformed into source coordinates.
    scale = .6232703421200058
    camera = Vector((6 / math.sqrt(2) / scale, -6 / math.sqrt(2) / scale, -5 / scale - .7301744818687439))
    target = Vector((0, 0, 1.4603489637374878 * .48 - .7301744818687439))
    rotation = (target - camera).to_track_quat('-Z', 'Y')
    direction = rotation @ Vector((0, 0, -1))
    ortho = 4.8 / scale

    def ray(u, v):
        return camera + rotation @ Vector(((u / 900 - .5) * ortho, (.5 - v / 900) * ortho, 0))

    def sample(u, v):
        point, normal, face_index, distance = tree.ray_cast(ray(u, v), direction)
        if point is None:
            return None
        face = mesh.polygons[face_index]
        coord = barycentric_transform(point, *(points[k] for k in face.vertices),
            *(Vector((*uv[k].uv, 0)) for k in face.loop_indices))
        color = pixels[int(np.clip(coord.y * height, 0, height - 1)), int(np.clip(coord.x * width, 0, width - 1)), :3]
        return distance, color

    vertices, faces, colors = [], [], []
    accepted = 0
    for region in regions['regions']:
        a = np.array(region)
        low, high = a.min(axis=0), a.max(axis=0)
        center = (low + high) / 2
        samples = []
        for x in np.linspace(low[0] - 4, high[0] + 4, 9):
            for y in [low[1] - 4, high[1] + 4]:
                result = sample(x, y)
                if result is not None:
                    samples.append((x, y, *result))
        for y in np.linspace(low[1] - 3, high[1] + 3, 7):
            for x in [low[0] - 4, high[0] + 4]:
                result = sample(x, y)
                if result is not None:
                    samples.append((x, y, *result))
        if len(samples) < 12:
            continue
        xy = np.array([[x - center[0], y - center[1], 1] for x, y, _, _ in samples])
        distance = np.array([d for _, _, d, _ in samples])
        coef = np.linalg.lstsq(xy, distance, rcond=None)[0]
        residual = distance - xy @ coef
        keep = (residual >= np.quantile(residual, .10)) & (residual <= np.quantile(residual, .75))
        coef = np.linalg.lstsq(xy[keep], distance[keep], rcond=None)[0]
        if np.std((distance - xy @ coef)[keep]) > .045:
            continue
        color = np.median(np.array([c for _, _, _, c in samples])[keep], axis=0)
        color = np.where(color <= .04045, color / 12.92, ((color + .055) / 1.055) ** 2.4)
        # A one-pixel overlap closes the ragged edge. Fit only a local surface
        # plane; retain the rest of the hull and every original polygon.
        cells = {(int(x) + dx, int(y) + dy) for x, y in region for dx, dy in [(0,0),(1,0),(-1,0),(0,1),(0,-1)]}
        mapping = {}
        for x, y in sorted(cells):
            face = []
            for u, v in [(x-.5,y-.5),(x+.5,y-.5),(x+.5,y+.5),(x-.5,y+.5)]:
                if (u, v) not in mapping:
                    depth = float(np.dot([u-center[0], v-center[1], 1], coef)) - .006
                    point = ray(u, v) + direction * depth
                    mapping[u,v] = len(vertices)
                    vertices.append(tuple(point))
                    colors.append((*color, 1))
                face.append(mapping[u,v])
            faces.append(tuple(reversed(face)))
        accepted += 1
    patch = bpy.data.meshes.new('Measured_hull_cavity_caps')
    patch.from_pydata(vertices, [], faces)
    patch.update()
    obj = bpy.data.objects.new('Measured_hull_cavity_caps', patch)
    bpy.context.collection.objects.link(obj)
    layer = patch.color_attributes.new(name='Sampled_hull_color', type='FLOAT_COLOR', domain='CORNER')
    for loop in patch.loops:
        layer.data[loop.index].color = colors[loop.vertex_index]
    patch.materials.append(bpy.data.materials['Sampled original hull wood'])
    for polygon in patch.polygons:
        polygon.use_smooth = True
    changes.append({'operation': 'local cavity caps fitted from surrounding original hull surface',
                    'regionsMeasured': len(regions['regions']), 'regionsCapped': accepted, 'addedQuads': len(faces),
                    'sourceImageSha256': regions['sourceSha256']})

    # Replace the rectangular trial blade with a tapered, rounded wooden blade.
    old = bpy.data.objects['Paddle_blade']
    bpy.data.objects.remove(old, do_unlink=True)
    axis = Vector((1, 1, 0)).normalized()
    across = Vector((-1, 1, 0)).normalized()
    origin = Vector((-1.61, -1.45, .30))
    points, polys = [], []
    for length, width in [(0,.025),(.04,.12),(.22,.14),(.48,.09),(.65,.023)]:
        for j in range(12):
            angle = 2 * math.pi * j / 12
            points.append(tuple(origin + axis * length + across * (math.cos(angle) * width) + Vector((0,0,math.sin(angle)*.018))))
    for i in range(4):
        for j in range(12):
            polys.append((i*12+j,i*12+(j+1)%12,(i+1)*12+(j+1)%12,(i+1)*12+j))
    polys += [tuple(reversed(range(12))), tuple(range(48,60))]
    m = bpy.data.meshes.new('Tapered_paddle_blade')
    m.from_pydata(points, [], polys)
    o = bpy.data.objects.new('Paddle_blade', m)
    bpy.context.collection.objects.link(o)
    m.materials.append(bpy.data.materials['Local warm timber repairs'])
    for p in m.polygons:
        p.use_smooth = True
    changes.append('Tapered independent paddle blade; character grip not yet aligned')

bpy.context.view_layer.update()
bpy.ops.object.select_all(action='SELECT')
output = directory / 'structure-v2.glb'
bpy.ops.export_scene.gltf(filepath=str(output), export_format='GLB', use_selection=True)
bpy.ops.wm.save_as_mainfile(filepath=str(directory / 'structure-v2.blend'))
record = {'asset': args.asset, 'source': 'structure-v1.blend', 'output': output.relative_to(ROOT).as_posix(),
          'outputSha256': hashlib.sha256(output.read_bytes()).hexdigest(), 'changes': changes,
          'decimationApplied': False, 'characterModified': False, 'paidApiCalls': 0,
          'status': 'candidate; visual review pending', 'browserVerified': False}
(evidence / 'structure.json').write_text(json.dumps(record, indent=2) + '\n', encoding='utf-8')
print(json.dumps(record), flush=True)
