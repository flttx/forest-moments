"""Review renders and counts for downloaded X3 props (no API calls, no edits to the models).

Run: python scripts/aholo/blender_run.py scripts/aholo/render_x3_review.py --blender "<blender.exe>" -- <run-dir> [<run-dir> ...]
Writes docs/evidence/assets/2026-10-27-x3-lux3d/<prop>/{front,three-quarter,top}.png and review.json.
"""
import bpy, json, math, os, sys
from mathutils import Vector
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / {'x3': 'docs/evidence/assets/2026-10-27-x3-lux3d', 'x5': 'docs/evidence/assets/2026-10-28-x5-lux3d'}[os.environ.get('FOREST_SERIES', 'x3')]
runs = [Path(a) for a in sys.argv[sys.argv.index('--') + 1:] if a != '--'] if '--' in sys.argv else []


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.engine = 'BLENDER_EEVEE_NEXT' if 'BLENDER_EEVEE_NEXT' in {e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items} else 'BLENDER_EEVEE'
    scene.render.resolution_x = scene.render.resolution_y = 768
    scene.render.film_transparent = False
    world = bpy.data.worlds.new('White')
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs[0].default_value = (1, 1, 1, 1)
    world.node_tree.nodes['Background'].inputs[1].default_value = 1.0
    scene.world = world
    scene.view_settings.view_transform = 'Standard'
    return scene


def review(run):
    scene = reset()
    glb = run / 'output-1.glb'
    bpy.ops.import_scene.gltf(filepath=str(glb))
    meshes = [o for o in scene.objects if o.type == 'MESH']
    tris = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in meshes)
    points = [o.matrix_world @ Vector(c) for o in meshes for c in o.bound_box]
    low = Vector((min(p.x for p in points), min(p.y for p in points), min(p.z for p in points)))
    high = Vector((max(p.x for p in points), max(p.y for p in points), max(p.z for p in points)))
    size = high - low
    images = [{'name': i.name, 'size': list(i.size)} for i in bpy.data.images if i.size[0]]
    centre, radius = (low + high) / 2, size.length / 2
    sun = bpy.data.objects.new('Key', bpy.data.lights.new('Key', 'SUN'))
    sun.data.energy = 3.5
    sun.rotation_euler = (math.radians(50), 0, math.radians(35))
    scene.collection.objects.link(sun)
    camera = bpy.data.objects.new('Camera', bpy.data.cameras.new('Camera'))
    camera.data.lens = 60
    scene.collection.objects.link(camera)
    scene.camera = camera
    name = run.name.replace('-v1', '').replace('-r2', '')
    out = OUT / name
    out.mkdir(parents=True, exist_ok=True)
    distance = radius * 3.4
    for view, (yaw, pitch) in {'front': (0, 8), 'three-quarter': (40, 22), 'top': (20, 70)}.items():
        y, p = math.radians(yaw), math.radians(pitch)
        camera.location = centre + Vector((math.sin(y) * math.cos(p), -math.cos(y) * math.cos(p), math.sin(p))) * distance
        camera.rotation_euler = (centre - camera.location).to_track_quat('-Z', 'Y').to_euler()
        scene.render.filepath = str(out / f'{view}.png')
        bpy.ops.render.render(write_still=True)
    report = {'run': run.name, 'objects': len(meshes), 'triangles': tris, 'size': [round(v, 4) for v in size],
              'images': images, 'glbBytes': glb.stat().st_size}
    (out / 'review.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    print(json.dumps(report))


for run in runs:
    review(ROOT / run if not run.is_absolute() else run)
