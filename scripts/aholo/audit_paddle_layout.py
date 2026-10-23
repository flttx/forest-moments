"""Check actual skinned body surfaces for layout finalists, without source edits."""
import bpy
import json
import sys
import math
from pathlib import Path
from collections import Counter
from mathutils import Vector, Matrix, Quaternion
from mathutils.bvhtree import BVHTree

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'docs/evidence/assets/2026-10-23-paddle-layout'
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'assets/lux3d/round-01/canoe/assembly-review-v2.blend'))
scene=bpy.context.scene
body=next(o for o in scene.objects if o.type=='MESH' and any(m.type=='ARMATURE' for m in o.modifiers))
trees=[]
for name in ['Lux3D_canoe','Measured_hull_cavity_caps']:
    o=bpy.data.objects[name]
    trees.append(BVHTree.FromPolygons([o.matrix_world@v.co for v in o.data.vertices],[tuple(p.vertices) for p in o.data.polygons]))
groups={g.index:g.name for g in body.vertex_groups}
labels=[]
for p in body.data.polygons:
    weights=Counter()
    for i in p.vertices:
        for g in body.data.vertices[i].groups:weights[groups[g.group]]+=g.weight
    labels.append(weights.most_common(1)[0][0] if weights else 'unweighted')
current='--current' in sys.argv
search=json.loads((OUT/'layout-search.json').read_text())
config=json.loads((OUT/'layout-config.json').read_text()) if current else None
layouts=[{'boatScale':.5,'characterShift':[0,0,0],'name':'baseline'},*([config] if current else search['finalists'])]
seat_trees=[]
if current:
    before=set(scene.objects)
    bpy.ops.import_scene.gltf(filepath=str(ROOT/config['seatAsset'].lstrip('/')))
    for o in set(scene.objects)-before:
        if o.type=='MESH':seat_trees.append(BVHTree.FromPolygons([o.matrix_world@v.co for v in o.data.vertices],[tuple(p.vertices) for p in o.data.polygons]))
frames=[0,55,75,100,139,163,190,216]
meshes={}
for frame in frames:
    scene.frame_set(frame);bpy.context.view_layer.update()
    e=body.evaluated_get(bpy.context.evaluated_depsgraph_get());m=e.to_mesh()
    meshes[frame]=([body.matrix_world@v.co for v in m.vertices],[tuple(p.vertices) for p in m.polygons])
    e.to_mesh_clear()
results=[]
for layout in layouts:
    ratio=layout['boatScale']/.5;shift=Vector(layout['characterShift']);records=[]
    for frame,(verts,faces) in meshes.items():
        tree=BVHTree.FromPolygons([(v+shift)/ratio for v in verts],faces)
        hits={pair[1] for t in trees for pair in t.overlap(tree)}
        by_bone=Counter(labels[i] for i in hits)
        seat_hits={pair[1] for t in seat_trees for pair in t.overlap(tree)} if layout is config else set()
        records.append({'frame':frame,'intersectingBodyTriangles':len(hits),'dominantBone':dict(by_bone),'seatContactTriangles':len(seat_hits),'seatContactBones':dict(Counter(labels[i] for i in seat_hits))})
    record={'layout':layout,'samples':records,'allHitTriangles':sum(r['intersectingBodyTriangles'] for r in records)}
    results.append(record)
    print('BODY_LAYOUT',json.dumps({'scale':layout['boatScale'],'shift':layout['characterShift'],'hits':record['allHitTriangles'],'first':records[0]}),flush=True)
report={'scope':'actual skinned body / original hull and caps; surface overlap includes seating contact; 8 poses only','results':results}
if current:
    track=json.loads((ROOT/'docs/evidence/assets/2026-10-23-paddle-prop/prop-track.json').read_text())
    shift=Vector(config['characterShift']);convert=Matrix.Rotation(math.pi/2,3,'X')
    parts=[o for o in scene.objects if o.name.startswith(('Paddle_blade','Paddle_shaft'))]
    contacts=[]
    for f in track['frames']:
        q=f['quaternion'];q=Quaternion((q[3],*q[:3]));rotation=convert@q.to_matrix()@convert.transposed()
        matrix=Matrix.Translation(convert@Vector(f['position'])+shift)@rotation.to_4x4()@Matrix.Diagonal((track['scale'],)*3+(1,))
        hull_hits=0;seat_hits=0
        for o in parts:
            m=matrix@o.matrix_local
            tree=BVHTree.FromPolygons([m@v.co for v in o.data.vertices],[tuple(p.vertices) for p in o.data.polygons])
            hull_hits+=sum(len(t.overlap(tree)) for t in trees)
            seat_hits+=sum(len(t.overlap(tree)) for t in seat_trees)
        contacts.append({'frame':f['frame'],'hull':hull_hits,'seat':seat_hits,'bladeMinZ':f['bladeMinZ']+shift.z})
    report['paddle']=contacts
    report['summary']={'hullHitFrames':sum(bool(r['hull']) for r in contacts),'seatHitFrames':sum(bool(r['seat']) for r in contacts),'wetLeftFrames':[r['frame'] for r in contacts[55:116] if r['bladeMinZ']<config['waterZ']],'wetRightFrames':[r['frame'] for r in contacts[163:217] if r['bladeMinZ']<config['waterZ']]}
    print('SEAT_PADDLE',json.dumps(report['summary']),flush=True)
(OUT/('seat-review-audit.json' if current else 'body-layout-audit.json')).write_text(json.dumps(report,indent=2)+'\n')
