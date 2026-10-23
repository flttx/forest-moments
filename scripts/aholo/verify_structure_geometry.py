"""Verify retained source faces in working files, separately from visual review."""
from collections import Counter
import bpy
import json
from pathlib import Path
from mathutils import Vector
from mathutils.kdtree import KDTree

ROOT = Path(__file__).resolve().parents[2]
results = []
for asset, variant in [('workshop','structure-v2'), ('lookout','structure-v3'), ('canoe','structure-v2')]:
    directory = ROOT / 'assets/lux3d/round-01' / asset
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(directory / 'output-1.glb'))
    source = next(o for o in bpy.context.scene.objects if o.type == 'MESH')
    points = [source.matrix_world @ v.co for v in source.data.vertices]
    canonical = {}
    for point in points:
        key = tuple(round(float(x), 6) for x in point)
        if key not in canonical:
            canonical[key] = len(canonical)
    tree = KDTree(len(canonical))
    for point, index in canonical.items():
        tree.insert(point, index)
    tree.balance()
    def key_for(point):
        _, index, distance = tree.find(point)
        assert distance < 2e-6, distance
        return index
    original = Counter(tuple(sorted(key_for(points[i]) for i in p.vertices)) for p in source.data.polygons)
    bpy.ops.wm.open_mainfile(filepath=str(directory / (variant + '.blend')))
    retained = Counter()
    meshes = [bpy.data.objects['Lux3D_' + asset]]
    if asset == 'lookout':
        meshes.append(bpy.data.objects['Entry_gate_open_inward'])
    for obj in meshes:
        # Recover the gate's pre-separation coordinates; its pose intentionally
        # changes. Other source geometry must remain at the original coordinates.
        points = [v.co + obj.location if obj.name.startswith('Entry_gate') else obj.matrix_world @ v.co for v in obj.data.vertices]
        retained.update(tuple(sorted(key_for(points[i]) for i in p.vertices)) for p in obj.data.polygons)
    assert retained == original, (asset, len(original-retained), len(retained-original))
    results.append({'asset':asset,'variant':variant,'retainedImportedTriangles':sum(original.values()),
                    'retainedTriangleMultisetMatches':True,'coordinateTolerance':2e-6,
                    'gateOriginalCoordinatesRecovered':asset=='lookout'})
directory = ROOT / 'docs/evidence/assets/2026-10-22-structures'
directory.mkdir(parents=True,exist_ok=True)
(directory/'geometry-validation.json').write_text(json.dumps(results,indent=2)+'\n',encoding='utf-8')
print(json.dumps(results))
