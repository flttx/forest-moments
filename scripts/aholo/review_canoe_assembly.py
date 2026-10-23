"""Local assembly review only: preserve accepted meshes, weights and authored clips."""
import bpy
import hashlib
import json
import math
import sys
from pathlib import Path
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'docs/evidence/assets/2026-10-22-runtime-integration/canoe-assembly-v2'
OUT.mkdir(parents=True, exist_ok=True)
audit_only = '--audit-only' in sys.argv
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.fps = 30
sources = [ROOT / 'public/assets/models/canoe.glb', ROOT / 'public/assets/models/raccoon.glb']
hashes = {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in sources}

def empty(name):
    obj = bpy.data.objects.new(name, None)
    scene.collection.objects.link(obj)
    return obj

bpy.ops.import_scene.gltf(filepath=str(sources[0]))
boat_objects = list(scene.objects)
boat = empty('ASSEMBLY_ONLY_boat')
paddle_objects = [o for o in boat_objects if o.name.startswith(('Paddle_blade', 'Paddle_shaft'))]
for obj in boat_objects:
    if not obj.parent and obj not in paddle_objects:
        obj.parent = boat
boat.scale = (.5,) * 3
boat.rotation_euler.z = -math.pi / 4
bpy.context.view_layer.update()
hull = next(o for o in boat_objects if o.name == 'Lux3D_canoe')
tree = BVHTree.FromPolygons([hull.matrix_world @ v.co for v in hull.data.vertices], [tuple(p.vertices) for p in hull.data.polygons])
seat_hit = tree.ray_cast(Vector((0, 0, 3)), Vector((0, 0, -1)))[0]
assert seat_hit is not None, 'No center seat surface'

before = set(scene.objects)
bpy.ops.import_scene.gltf(filepath=str(sources[1]))
character_objects = [o for o in scene.objects if o not in before]
character = empty('ASSEMBLY_ONLY_character')
for obj in character_objects:
    if not obj.parent:
        obj.parent = character
character.scale = (1.4 / .6,) * 3
character.rotation_euler.z = math.pi / 2
rig = next(o for o in character_objects if o.type == 'ARMATURE')
for track in rig.animation_data.nla_tracks:
    track.mute = True
action = next(a for a in bpy.data.actions if a.name.startswith('paddle'))
rig.animation_data.action = action
if action.slots:
    rig.animation_data.action_slot = action.slots[0]
scene.frame_set(int(action.frame_range[0]))
bpy.context.view_layer.update()
hip = rig.matrix_world @ rig.pose.bones['mixamorig:Hips'].head
character.location = Vector((0, 0, seat_hit.z + .14)) - hip
bpy.context.view_layer.update()

paddle = empty('ASSEMBLY_ONLY_paddle')
for obj in paddle_objects:
    matrix = obj.matrix_world.copy()
    obj.parent = paddle
    obj.matrix_parent_inverse = Matrix.Identity(4)
    obj.matrix_basis = matrix
source_axis = Vector((2.05, 1.95, 0)).normalized()
# Keep the delivered paddle unchanged; place its shaft between existing hand centers.
source_grip_mid = Vector((.75, .80, .30)) - source_axis * .30

def hand(side):
    bone = rig.pose.bones[f'mixamorig:{side}Hand']
    return rig.matrix_world @ bone.head.lerp(bone.tail, .5)

records = []
def align(frame):
    scene.frame_set(frame)
    bpy.context.view_layer.update()
    left, right = hand('Left'), hand('Right')
    target_axis = (left - right).normalized()
    rotation = source_axis.rotation_difference(target_axis).to_matrix().to_4x4()
    paddle.matrix_world = Matrix.Translation((left + right) / 2) @ rotation @ Matrix.Diagonal((.5, .5, .5, 1)) @ Matrix.Translation(-source_grip_mid)
    bpy.context.view_layer.update()
    feet = [list(rig.matrix_world @ rig.pose.bones[f'mixamorig:{s}Foot'].head) for s in ['Left', 'Right']]
    records.append({'frame': frame, 'handCenters': [list(left), list(right)], 'handSeparation': (right-left).length,
                    'hip': list(rig.matrix_world @ rig.pose.bones['mixamorig:Hips'].head), 'footBones': feet})

scene.render.engine = 'CYCLES'
scene.cycles.samples = 20
scene.cycles.use_denoising = True
scene.render.resolution_x, scene.render.resolution_y = 1100, 900
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.world = bpy.data.worlds.new('Assembly studio')
scene.world.use_nodes = True
scene.world.node_tree.nodes['Background'].inputs['Color'].default_value = (.75, .78, .72, 1)
scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value = .6
scene.view_settings.view_transform = 'AgX'
bpy.ops.mesh.primitive_plane_add(size=200, location=(0, 0, -.39))
floor = bpy.context.object
floor.name = 'REVIEW_ONLY_floor'
mat = bpy.data.materials.new('Review warm gray'); mat.diffuse_color = (.65, .63, .57, 1)
floor.data.materials.append(mat)
for name, location, energy in [('Key', (3,-4,6),800), ('Fill',(-4,-1,4),400), ('Rim',(1,4,5),600)]:
    data = bpy.data.lights.new(name, 'AREA'); data.energy = energy; data.shape = 'DISK'; data.size = 4
    obj = bpy.data.objects.new(name, data); scene.collection.objects.link(obj); obj.location = location
    obj.rotation_euler = (Vector((0,0,.3))-obj.location).to_track_quat('-Z','Y').to_euler()
data = bpy.data.cameras.new('Assembly camera'); camera = bpy.data.objects.new('Assembly camera', data)
scene.collection.objects.link(camera); scene.camera = camera; data.type='ORTHO'; data.ortho_scale = 4.2
frames = [int(round(action.frame_range[0] + (action.frame_range[1]-action.frame_range[0])*fraction)) for fraction in [0,.25,.5,.75,1]]
for frame in frames:
    align(frame)
    camera.location=(3,-5,3)
    camera.rotation_euler=(Vector((0,0,.35))-camera.location).to_track_quat('-Z','Y').to_euler()
    if not audit_only:
        scene.render.filepath=str(OUT/f'paddle-{frame:03d}.png'); bpy.ops.render.render(write_still=True)
align(frames[2])
camera.location=(0,-6,1.1)
camera.rotation_euler=(Vector((0,0,.35))-camera.location).to_track_quat('-Z','Y').to_euler()
if not audit_only:
    scene.render.filepath=str(OUT/'side.png'); bpy.ops.render.render(write_still=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets/lux3d/round-01/canoe/assembly-review-v2.blend'))
shaft_hits = []
for frame in range(int(action.frame_range[0]), int(action.frame_range[1]) + 1):
    align(frame)
    a = paddle.matrix_world @ Vector((-1.30, -1.15, .30))
    b = paddle.matrix_world @ Vector((.75, .80, .30))
    direction = b-a
    hit, normal, index, distance = tree.ray_cast(a, direction.normalized(), direction.length)
    if hit is not None:
        shaft_hits.append({'frame':frame, 'point':list(hit), 'distanceAlongShaft':distance})
assert all(hashlib.sha256(p.read_bytes()).hexdigest() == hashes[p.name] for p in sources)
record = {'sourceHashes':hashes, 'boatScale':.5, 'characterScale':1.4/.6, 'seatSurface':list(seat_hit),
          'characterTranslation':list(character.location), 'paddleScale':.5, 'clip':action.name, 'frames':records,
          'sourceModified':False, 'status':'diagnostic assembly; hand bone alignment is not grip or continuous collision acceptance',
          'shaftHullIntersections':shaft_hits, 'sampledEveryFrame':True,
          'collisionScope':'shaft center line against original hull only; blade, body and finite thickness not certified',
          'renders':[p.name for p in OUT.glob('*.png')]}
(OUT/'alignment.json').write_text(json.dumps(record,indent=2)+'\n',encoding='utf-8')
print('ASSEMBLY_REVIEW_COMPLETE',flush=True)
