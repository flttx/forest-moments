"""Run in an isolated Blender background process; never edits the source GLB."""
import bpy
import argparse
import hashlib
import json
import math
from pathlib import Path
import sys
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
parser = argparse.ArgumentParser()
parser.add_argument('asset', choices=['raccoon', 'raccoon-multiview', 'workshop', 'lookout', 'canoe'])
parser.add_argument('--variant', choices=['raw', 'optimized-v1', 'optimized-v2', 'material-v1', 'tail-repair-v1', 'tail-repair-v2', 'tail-repair-v3', 'tail-repair-v4', 'tail-repair-v5', 'surface-v1', 'rig-v1', 'structure-v1', 'structure-v2', 'structure-v3'], default='raw')
parser.add_argument('--clay', action='store_true', help='Diagnostic material override; preserves the mesh')
parser.add_argument('--tail-closeup', action='store_true', help='Raccoon tail attachment inspection camera')
parser.add_argument('--views', nargs='+', default=['front', 'three-quarter', 'side', 'back', 'left', 'elevated'],
                    choices=['front', 'three-quarter', 'side', 'back', 'left', 'elevated', 'bottom'])
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
asset = args.asset
source = ROOT / 'assets/lux3d/round-01' / asset / ('output-1.glb' if args.variant == 'raw' else f'{args.variant}.glb')
output = ROOT / 'docs/evidence/assets/2026-10-22-round-01' / asset
if args.variant != 'raw':
    output = output / args.variant
if args.clay:
    output = output / 'clay'
if args.tail_closeup:
    assert asset in ['raccoon', 'raccoon-multiview']
    output = output / 'tail-closeup'
output.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(source))
objects = list(bpy.context.scene.objects)
meshes = [obj for obj in objects if obj.type == 'MESH']
points = [obj.matrix_world @ Vector(corner) for obj in meshes for corner in obj.bound_box]
low = Vector(tuple(min(p[i] for p in points) for i in range(3)))
high = Vector(tuple(max(p[i] for p in points) for i in range(3)))
size = high - low
if args.variant != 'raw':
    baseline = json.loads((ROOT / 'docs/evidence/assets/2026-10-22-round-01' / asset / 'render.json').read_text(encoding='utf-8'))
    # Keep original framing for valid before/after comparisons, even if decimation
    # nudges an extremum. The original source's dimensions anchor both camera and scale.
    low = Vector(baseline['sourceBoundsBlenderXYZ']['min'])
    high = Vector(baseline['sourceBoundsBlenderXYZ']['max'])
    size = high - low
center = (high + low) / 2
model_scale = 3 / max(size)
# One new parent normalizes preview scale only; source transforms and mesh data stay intact.
root = bpy.data.objects.new('REVIEW_ONLY_normalization', None)
bpy.context.collection.objects.link(root)
for obj in objects:
    if obj.parent is None:
        obj.parent = root
root.scale = (model_scale,) * 3
root.location = (-center.x * model_scale, -center.y * model_scale, -low.z * model_scale)
bpy.context.view_layer.update()
height = size.z * model_scale
scene = bpy.context.scene
if args.clay:
    clay = bpy.data.materials.new('DIAGNOSTIC_clay')
    clay.use_nodes = True
    shader = clay.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = (.55,.55,.55,1)
    shader.inputs['Roughness'].default_value = .8
    scene.view_layers[0].material_override = clay
scene.render.engine = 'CYCLES'
scene.cycles.samples = 24
scene.cycles.use_denoising = True
scene.render.resolution_x = 900
scene.render.resolution_y = 900
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.world = bpy.data.worlds.new('Review studio')
scene.world.use_nodes = True
scene.world.node_tree.nodes['Background'].inputs['Color'].default_value = (.75, .78, .72, 1)
scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value = .6
scene.view_settings.view_transform = 'AgX'
bpy.ops.mesh.primitive_plane_add(size=200, location=(0, 0, -.015))
ground = bpy.context.object
ground.name = 'REVIEW_ONLY_floor'
material = bpy.data.materials.new('Review warm gray')
material.diffuse_color = (.65, .63, .57, 1)
ground.data.materials.append(material)
for name, location, energy, lamp_size in [('Key', (4,-5,7),800,5),('Fill',(-4,-2,4),500,4),('Rim',(2,4,6),700,4)]:
    data = bpy.data.lights.new(name, 'AREA')
    data.energy, data.shape, data.size = energy, 'DISK', lamp_size
    lamp = bpy.data.objects.new(name, data)
    scene.collection.objects.link(lamp)
    lamp.location = location
    lamp.rotation_euler = (Vector((0,0,height/2))-lamp.location).to_track_quat('-Z','Y').to_euler()
camera_data = bpy.data.cameras.new('Review camera')
camera = bpy.data.objects.new('Review camera', camera_data)
scene.collection.objects.link(camera)
scene.camera = camera
camera_data.type = 'ORTHO'
camera_data.ortho_scale = 4.8 if asset == 'canoe' else 4.2
target = Vector((0,0,height*.48))
if args.tail_closeup:
    camera_data.ortho_scale = 1.55
    target = Vector((0, .3, height*.5))
views = {'front':0, 'three-quarter':45, 'side':90, 'back':180, 'left':270, 'elevated':225, 'bottom':45}
for label in args.views:
    if label == 'bottom' and asset != 'canoe':
        continue
    degrees = views[label]
    radians = math.radians(degrees)
    camera.location = (6*math.sin(radians),-6*math.cos(radians),height*.48 + (2.8 if asset=='canoe' else 1.1))
    if label == 'elevated':
        camera.location.z = height*.48 + 7
    if args.tail_closeup:
        camera.location.z = target.z + .3
    ground.hide_render = label == 'bottom'
    if label == 'bottom':
        camera.location.z = -5
    camera.rotation_euler = (target-camera.location).to_track_quat('-Z','Y').to_euler()
    scene.render.filepath = str(output / f'{label}.png')
    bpy.ops.render.render(write_still=True)
ground.hide_render = False
blend_parts = ['review']
if args.tail_closeup:
    blend_parts.append('tail')
if args.clay:
    blend_parts.append('clay')
if args.variant != 'raw':
    blend_parts.append(args.variant)
blend_name = '-'.join(blend_parts) + '.blend'
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / 'assets/lux3d/round-01' / asset / blend_name))
record = {'asset':asset, 'blenderVersion':bpy.app.version_string,'source':source.relative_to(ROOT).as_posix(),
          'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),
          ('sourceBoundsBlenderXYZ' if args.variant == 'raw' else 'framingBoundsBlenderXYZ'):
              {'min':list(low),'max':list(high),'size':list(size)},
          'framingReference':'raw-source-bounds', 'orthographicScale':camera_data.ortho_scale,
          'meshObjects':len(meshes),'renderEngine':scene.render.engine,'resolution':[900,900],
          'views':[label for label in views if (output/f'{label}.png').exists()], 'previewScaleOnly':model_scale,
          'sourceGeometryModified':args.variant.startswith(('optimized-', 'tail-repair-', 'structure-')),'runtimeBrowserVerified':False}
record['clayDiagnostic'] = args.clay
record['tailCloseup'] = args.tail_closeup
(output/'render.json').write_text(json.dumps(record,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('FOREST_REVIEW_COMPLETE '+asset)
