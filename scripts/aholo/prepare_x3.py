"""Prepare the X3 Lux3D props for the browser: real size, bottom-centre origin, fewer triangles, smaller WebP textures.

Run: python scripts/aholo/blender_run.py scripts/aholo/prepare_x3.py --blender "<blender.exe>" -- <prop id> [<prop id> ...]
Reads assets/lux3d/x3-<id>-*/output-1.glb (latest attempt), writes public/assets/x3/<name>.glb and, in
docs/evidence/assets/2026-10-27-x3-lux3d/<run>/, optimized.png (same view as three-quarter.png) plus runtime.json.
Why reduce: these props stand 0.1-1.4 m tall and cover a few dozen to a few hundred pixels in play; the raw 30-50k
triangles and two 2048 px textures each are measured waste there, not a budget figure.
Decimation below about 8k triangles tore texture seams on the mushroom (UV islands collapse), so small props keep 8k.
"""
import bpy, json, math, sys, hashlib
from mathutils import Vector
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
EVIDENCE = ROOT / 'docs/evidence/assets/2026-10-27-x3-lux3d'
OUT = ROOT / 'public/assets/x3'
# id: (name, tallest or widest side in metres, triangle target, texture size)
PROPS = {
 '01': ('mushroom-cluster', .22, 8000, 512), '02': ('berry-twig', .24, 8000, 512), '03': ('seashell', .12, 8000, 512),
 '04': ('pinecone', .11, 8000, 512), '05': ('egg-nest', .24, 8000, 512), '06': ('wool-bundle', .22, 8000, 512),
 '07': ('small-wood-table', .75, 16000, 1024), '08': ('birdhouse', .34, 16000, 1024), '09': ('fishing-rod-rack', .9, 16000, 1024),
 '10': ('wood-signpost', 1.35, 16000, 1024), '11': ('message-bottle', .2, 8000, 512), '12': ('glowing-jellyfish', .45, 14000, 1024),
}
ids = [a for a in sys.argv[sys.argv.index('--') + 1:] if a != '--'] if '--' in sys.argv else list(PROPS)


def triangles(objects):
    return sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in objects)


def render(scene, path, centre, radius):
    camera = scene.camera
    y, p = math.radians(40), math.radians(22)
    camera.location = centre + Vector((math.sin(y) * math.cos(p), -math.cos(y) * math.cos(p), math.sin(p))) * radius * 3.4
    camera.rotation_euler = (centre - camera.location).to_track_quat('-Z', 'Y').to_euler()
    scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)


OUT.mkdir(parents=True, exist_ok=True)
for prop in ids:
    name, side, target, texture = PROPS[prop]
    run = sorted((ROOT / 'assets/lux3d').glob(f'x3-{prop}-{name}-v1*'))[-1]
    source = run / 'output-1.glb'
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.engine = 'BLENDER_EEVEE_NEXT' if 'BLENDER_EEVEE_NEXT' in {e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items} else 'BLENDER_EEVEE'
    scene.render.resolution_x = scene.render.resolution_y = 768
    world = bpy.data.worlds.new('White'); world.use_nodes = True
    world.node_tree.nodes['Background'].inputs[0].default_value = (1, 1, 1, 1); scene.world = world
    scene.view_settings.view_transform = 'Standard'
    bpy.ops.import_scene.gltf(filepath=str(source))
    meshes = [o for o in scene.objects if o.type == 'MESH']
    before = triangles(meshes)
    # Bake transforms, then scale so the largest side matches the real prop and put the origin at the bottom centre.
    for o in meshes:
        o.data.transform(o.matrix_world); o.matrix_world.identity()
    points = [v.co.copy() for o in meshes for v in o.data.vertices]
    low = Vector([min(p[i] for p in points) for i in range(3)]); high = Vector([max(p[i] for p in points) for i in range(3)])
    scale = side / max(high - low)
    for o in meshes:
        for v in o.data.vertices:
            v.co = Vector(((v.co.x - (low.x + high.x) / 2) * scale, (v.co.y - (low.y + high.y) / 2) * scale, (v.co.z - low.z) * scale))
        o.data.update()
        ratio = min(1, target / max(1, triangles([o])))
        if ratio < 1:
            mod = o.modifiers.new('Decimate', 'DECIMATE'); mod.ratio = ratio; mod.use_collapse_triangulate = True
            bpy.context.view_layer.objects.active = o; bpy.ops.object.modifier_apply(modifier=mod.name)
    # Lux3D materials come out metallic and glossy; the island is matte (as for the expansion assets), glass and jelly stay smoother.
    for o in meshes:
        for m in o.data.materials:
            bsdf = m.node_tree.nodes.get('Principled BSDF') if m and m.use_nodes else None
            if bsdf:
                bsdf.inputs['Metallic'].default_value = 0
                bsdf.inputs['Roughness'].default_value = {'11': .3, '12': .4}.get(prop, .8)
                for socket in ('Metallic', 'Roughness'):
                    for link in list(bsdf.inputs[socket].links): m.node_tree.links.remove(link)
    for image in bpy.data.images:
        if image.size[0] > texture:
            image.scale(texture, texture)
    after = triangles(meshes)
    size = Vector([max(v.co[i] for o in meshes for v in o.data.vertices) - min(v.co[i] for o in meshes for v in o.data.vertices) for i in range(3)])
    out = OUT / f'{name}.glb'
    bpy.ops.object.select_all(action='DESELECT')
    for o in meshes: o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(out), export_format='GLB', use_selection=True, export_animations=False,
                              export_image_format='WEBP', export_image_quality=85)
    sun = bpy.data.objects.new('Key', bpy.data.lights.new('Key', 'SUN')); sun.data.energy = 3.5
    sun.rotation_euler = (math.radians(50), 0, math.radians(35)); scene.collection.objects.link(sun)
    camera = bpy.data.objects.new('Camera', bpy.data.cameras.new('Camera')); camera.data.lens = 60
    scene.collection.objects.link(camera); scene.camera = camera
    folder = EVIDENCE / f'x3-{prop}-{name}'
    render(scene, folder / 'optimized.png', Vector((0, 0, size.z / 2)), size.length / 2)
    record = {'prop': prop, 'name': name, 'source': source.relative_to(ROOT).as_posix(),
              'sourceSha256': hashlib.sha256(source.read_bytes()).hexdigest(), 'output': out.relative_to(ROOT).as_posix(),
              'outputBytes': out.stat().st_size, 'outputSha256': hashlib.sha256(out.read_bytes()).hexdigest(),
              'trianglesBefore': before, 'trianglesAfter': after, 'sizeMetres': [round(v, 4) for v in size], 'textureSize': texture}
    (folder / 'runtime.json').write_text(json.dumps(record, indent=2), encoding='utf-8')
    print(json.dumps(record))
