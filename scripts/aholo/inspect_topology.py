"""Inspect welded analysis copies only; does not export or repair source geometry."""
import bpy
import bmesh
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
records = []
for asset in ['workshop', 'canoe', 'lookout', 'raccoon']:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    source = ROOT / 'assets/lux3d/round-01' / asset / 'output-1.glb'
    bpy.ops.import_scene.gltf(filepath=str(source))
    objects = []
    for obj in bpy.context.scene.objects:
        if obj.type != 'MESH':
            continue
        mesh = bmesh.new()
        mesh.from_mesh(obj.data)
        vertices_before = len(mesh.verts)
        # Analysis only: attribute seams otherwise masquerade as physical holes.
        bmesh.ops.remove_doubles(mesh, verts=list(mesh.verts), dist=0.000001)
        boundary = {edge for edge in mesh.edges if edge.is_boundary}
        count = len(boundary)
        regions = []
        while boundary:
            edge = boundary.pop()
            edges, pending, vertices = {edge}, [edge], set(edge.verts)
            while pending:
                for vertex in pending.pop().verts:
                    for other in vertex.link_edges:
                        if other in boundary:
                            boundary.remove(other)
                            edges.add(other)
                            vertices.update(other.verts)
                            pending.append(other)
            points = [obj.matrix_world @ vertex.co for vertex in vertices]
            low = [min(p[i] for p in points) for i in range(3)]
            high = [max(p[i] for p in points) for i in range(3)]
            regions.append({'edges':len(edges),'min':low,'max':high,
                            'closedLoop':all(sum(e in edges for e in v.link_edges)==2 for v in vertices)})
        objects.append({'name':obj.name,'verticesBeforeAnalysisWeld':vertices_before,
                        'verticesAfterAnalysisWeld':len(mesh.verts),
                        'boundaryEdges':count,'boundaryRegions':len(regions),
                        'edgesWithMoreThanTwoFaces':sum(len(e.link_faces)>2 for e in mesh.edges),
                        'zeroAreaFaces':sum(f.calc_area()<1e-12 for f in mesh.faces),
                        'regions':sorted(regions,key=lambda r:r['edges'],reverse=True)})
        mesh.free()
    records.append({'asset':asset,'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),
                    'analysisWeldDistance':1e-6,'sourceModified':False,'objects':objects})
    print(asset,[(o['boundaryEdges'],o['boundaryRegions'],o['edgesWithMoreThanTwoFaces']) for o in objects],flush=True)
output = ROOT / 'docs/evidence/assets/2026-10-22-round-01/topology-inspection.json'
output.write_text(json.dumps({'note':'Analysis copy only. A boundary may be intentional; nonmanifold counts do not locate every visual defect.',
                              'assets':records},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
