"""Hand-shaped coastal rock and driftwood kit (local Blender, no external generation).

Run: python scripts/aholo/blender_run.py scripts/build_coastal_kit.py --blender "<blender.exe>"
Output: public/assets/expansion/coastal-kit.glb plus a JSON summary for the evidence folder.
Blender is Z-up; every module stands on its own origin (bottom centre). glTF export turns Z-up into Y-up.
"""
import bpy, bmesh, json, math, random
from mathutils import Vector, noise
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public/assets/expansion/coastal-kit.glb'
SUMMARY = ROOT / 'docs/evidence/2026-10-25-visual-v3/coastal-kit-blender.json'
bpy.ops.wm.read_factory_settings(use_empty=True)

# Linear-light colours from docs/ART_DIRECTION.md: warm grey stone #7D7A6E, moss between #446B4F and grass #879A68.
STONE = Vector((.205, .195, .155))
WET = Vector((.085, .082, .07))
MOSS = Vector((.085, .14, .05))
DRIFT = Vector((.32, .27, .2))


def material():
    m = bpy.data.materials.new('Coastal stone (vertex colour)')
    m.use_nodes = True
    nodes, links = m.node_tree.nodes, m.node_tree.links
    bsdf = nodes['Principled BSDF']
    attr = nodes.new('ShaderNodeVertexColor')
    attr.layer_name = 'Col'
    links.new(attr.outputs['Color'], bsdf.inputs['Base Color'])
    bsdf.inputs['Roughness'].default_value = .93
    return m


MAT = material()


def stone(size, seed, cuts=8, bevel=.06, bumps=.05):
    """A block chopped by random planes into crisp facets, then softened just at the edges."""
    rnd = random.Random(seed)
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=2)
    bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=1, use_grid_fill=True)
    for v in bm.verts:
        # Halfway between a cube and a sphere: a chunky body the planes can bite into.
        v.co = v.co.lerp(v.co.normalized() * 1.25, .55)
    for _ in range(cuts):
        n = Vector((rnd.uniform(-1, 1), rnd.uniform(-1, 1), rnd.uniform(-.55, 1))).normalized()
        d = rnd.uniform(.7, .95)
        geom = bm.verts[:] + bm.edges[:] + bm.faces[:]
        res = bmesh.ops.bisect_plane(bm, geom=geom, plane_co=n * d, plane_no=n, clear_outer=True)
        edges = [e for e in res['geom_cut'] if isinstance(e, bmesh.types.BMEdge)]
        if edges:
            bmesh.ops.holes_fill(bm, edges=edges, sides=0)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    for v in bm.verts:
        v.co = Vector((v.co.x * size[0] / 2, v.co.y * size[1] / 2, v.co.z * size[2] / 2))
    me = bpy.data.meshes.new(f'stone-{seed}')
    bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(f'stone-{seed}', me)
    bpy.context.scene.collection.objects.link(o)
    bpy.ops.object.select_all(action='DESELECT'); o.select_set(True); bpy.context.view_layer.objects.active = o
    # Triangulate the filled cut faces first so the narrow worn bevel follows clean edges.
    tri = o.modifiers.new('tri', 'TRIANGULATE'); tri.quad_method = 'BEAUTY'; tri.ngon_method = 'BEAUTY'
    m = o.modifiers.new('worn edges', 'BEVEL'); m.width = bevel * .5 * min(size); m.segments = 1; m.limit_method = 'ANGLE'; m.angle_limit = math.radians(40)
    for mod in list(o.modifiers):
        bpy.ops.object.modifier_apply(modifier=mod.name)
    # Coherent noise (same position, same offset) gently warps the planar cuts without tearing bevel seams.
    shift = Vector((seed * 3.7, seed * 1.3, seed * 2.9))
    for v in o.data.vertices:
        v.co += noise.noise_vector(v.co * (1.6 / min(size)) + shift) * bumps * min(size)
    return o


def join(parts, name):
    bpy.ops.object.select_all(action='DESELECT')
    for p in parts:
        p.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    o = bpy.context.object
    o.name = name
    o.data.name = name
    return o


def finish(o, tint, moss=True, seed=0):
    """Origin at bottom centre, soft facet shading, vertex colours: darker wet foot, moss on upward tops."""
    bpy.ops.object.select_all(action='DESELECT'); o.select_set(True); bpy.context.view_layer.objects.active = o
    bb = [o.matrix_world @ Vector(c) for c in o.bound_box]
    lo = Vector((sum(v.x for v in bb) / 8, sum(v.y for v in bb) / 8, min(v.z for v in bb)))
    o.data.transform(__import__('mathutils').Matrix.Translation(-lo))
    height = max(v.z for v in bb) - lo.z
    bpy.ops.object.shade_auto_smooth(angle=math.radians(28))
    mesh = o.data
    colour = mesh.color_attributes.new('Col', 'FLOAT_COLOR', 'CORNER')
    mesh.calc_loop_triangles()
    rnd = random.Random(seed)
    jitter = {v.index: .86 + .28 * rnd.random() for v in mesh.vertices}
    for poly in mesh.polygons:
        for li in poly.loop_indices:
            vi = mesh.loops[li].vertex_index
            p = mesh.vertices[vi].co
            n = poly.normal
            band = .82 + .3 * noise.noise(p * 1.7 + Vector((seed, 0, 0)))
            c = tint * band * jitter[vi]
            foot = 1 - min(1, p.z / max(.001, height * .22))
            c = c.lerp(WET, foot * .7)
            if moss:
                mossy = max(0, (n.z - .55) / .45) * max(0, min(1, (noise.noise(p * 2.3 + Vector((0, seed, 0))) + .15) * 2.5))
                c = c.lerp(MOSS, min(.85, mossy) * min(1, p.z / max(.001, height * .5)))
            colour.data[li].color = (c.x, c.y, c.z, 1)
    mesh.color_attributes.active_color = colour
    mesh.materials.clear(); mesh.materials.append(MAT)
    return o


modules = []
# Layered slab: three strata stepped back like weathered bedding planes.
rnd = random.Random(7)
parts = []
z = 0
for i, (sx, sy, sz) in enumerate([(2.2, 1.8, .7), (1.85, 1.5, .62), (1.4, 1.15, .55)]):
    s = stone((sx, sy, sz), 11 + i, cuts=7)
    s.location = (rnd.uniform(-.12, .12), rnd.uniform(-.18, .04) - i * .1, z + sz / 2 - .04)
    bpy.ops.object.transform_apply(location=True)
    z += sz * .8
    parts.append(s)
modules.append(finish(join(parts, 'Rock_Slab'), STONE, seed=1))
# Tall buttress: two stacked blocks, used where the cliff is highest.
parts = [stone((1.6, 1.35, 1.6), 21, cuts=9), stone((1.25, 1.1, 1.3), 22, cuts=8)]
parts[0].location = (0, 0, .72); parts[1].location = (.1, -.08, 1.95)
for p in parts:
    bpy.context.view_layer.objects.active = p; bpy.ops.object.select_all(action='DESELECT'); p.select_set(True); bpy.ops.object.transform_apply(location=True)
modules.append(finish(join(parts, 'Rock_Tall'), STONE * .95, seed=2))
# Rounded boulder for the tide line and the creek mouth.
b = stone((1.7, 1.45, 1.15), 31, cuts=9, bevel=.1, bumps=.07)
b.location = (0, 0, .48); bpy.ops.object.transform_apply(location=True)
modules.append(finish(join([b], 'Rock_Boulder'), STONE * 1.05, seed=3))
# Cobble cluster: small stones that sit half in the wash.
parts = []
for i, (x, y, s) in enumerate([(0, 0, .55), (.55, .25, .38), (-.45, .3, .32), (.2, -.45, .3)]):
    c = stone((s * 1.3, s, s * .75), 41 + i, cuts=6, bevel=.12)
    c.location = (x, y, s * .3); bpy.ops.object.transform_apply(location=True); parts.append(c)
modules.append(finish(join(parts, 'Rock_Cobbles'), STONE * 1.1, moss=False, seed=4))


def driftwood(name, length, seed, branch=True):
    """Bleached log: real end faces, a gentle bow, ends tapered, a broken side branch."""
    bpy.ops.mesh.primitive_cylinder_add(vertices=9, radius=.12, depth=length)
    log = bpy.context.object
    log.rotation_euler = (0, math.pi / 2, 0); bpy.ops.object.transform_apply(rotation=True)
    cut = log.modifiers.new('rings', 'SUBSURF'); cut.levels = 2; cut.subdivision_type = 'SIMPLE'
    bpy.context.view_layer.objects.active = log
    bpy.ops.object.modifier_apply(modifier=cut.name)
    rnd = random.Random(seed)
    for v in log.data.vertices:
        t = abs(v.co.x) / (length / 2)
        k = (1 - .45 * t * t) * (.9 + .2 * rnd.random())
        v.co.y *= k; v.co.z *= k
    bend = log.modifiers.new('bow', 'SIMPLE_DEFORM'); bend.deform_method = 'BEND'; bend.angle = math.radians(16); bend.deform_axis = 'Z'
    bpy.ops.object.modifier_apply(modifier=bend.name)
    parts = [log]
    if branch:
        bpy.ops.mesh.primitive_cone_add(vertices=7, radius1=.07, radius2=.03, depth=.6)
        br = bpy.context.object
        br.rotation_euler = (0, math.radians(62), math.radians(38)); br.location = (length * .18, .16, .1)
        bpy.ops.object.transform_apply(location=True, rotation=True)
        parts.append(br)
    o = join(parts, name)
    return finish(o, DRIFT, moss=False, seed=seed)


modules.append(driftwood('Driftwood_Long', 2.4, 5))
modules.append(driftwood('Driftwood_Short', 1.4, 6, branch=False))

bpy.ops.object.select_all(action='DESELECT')
for m in modules:
    m.select_set(True)
OUT.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.export_scene.gltf(filepath=str(OUT), export_format='GLB', use_selection=True, export_animations=False,
                          export_vertex_color='MATERIAL', export_normals=True, export_texcoords=False)
summary = {'blender': bpy.app.version_string, 'output': str(OUT.relative_to(ROOT)).replace('\\', '/'), 'bytes': OUT.stat().st_size, 'modules': []}
for m in modules:
    m.data.calc_loop_triangles()
    d = m.dimensions
    summary['modules'].append({'name': m.name, 'triangles': len(m.data.loop_triangles), 'size_m': [round(d.x, 3), round(d.y, 3), round(d.z, 3)]})
SUMMARY.parent.mkdir(parents=True, exist_ok=True)
SUMMARY.write_text(json.dumps(summary, indent=2, ensure_ascii=False))
print(json.dumps(summary, ensure_ascii=False))
