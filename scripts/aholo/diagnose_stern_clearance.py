"""Locate actual contact regions for a low aft seat, without editing assets."""
import bpy
import json
import math
import sys
from pathlib import Path
from collections import Counter
from mathutils import Vector, Matrix, Quaternion
from mathutils.bvhtree import BVHTree

ROOT=Path(__file__).resolve().parents[2]
center='--center' in sys.argv
OUT=ROOT/('docs/evidence/assets/2026-10-23-canoe-center' if center else 'docs/evidence/assets/2026-10-23-canoe-stern')
OUT.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'assets/lux3d/round-01/canoe/assembly-review-v2.blend'))
scene=bpy.context.scene
body=next(o for o in scene.objects if o.type=='MESH' and any(m.type=='ARMATURE' for m in o.modifiers))
track=json.loads((ROOT/'docs/evidence/assets/2026-10-23-paddle-prop/prop-track.json').read_text())
parts=[o for o in scene.objects if o.name.startswith(('Paddle_blade','Paddle_shaft'))]
geometry=[]
for name in ['Lux3D_canoe','Measured_hull_cavity_caps']:
    o=bpy.data.objects[name];verts=[o.matrix_world@v.co for v in o.data.vertices];faces=[tuple(p.vertices) for p in o.data.polygons]
    geometry.append((name,verts,faces,BVHTree.FromPolygons(verts,faces)))
groups={g.index:g.name for g in body.vertex_groups}
labels=[]
for p in body.data.polygons:
    weights=Counter()
    for i in p.vertices:
        for g in body.data.vertices[i].groups:weights[groups[g.group]]+=g.weight
    labels.append(weights.most_common(1)[0][0] if weights else 'unweighted')
convert=Matrix.Rotation(math.pi/2,3,'X')
def bounds(points):
    return [[min(v[i] for v in points),max(v[i] for v in points)] for i in range(3)] if points else None
reports=[]
for ratio in ([1] if center else [1,.85]):
    shift=Vector((0,0,0) if center else (-.6,-.15,.2));contacts={'paddle':[],'body':[]};hull_faces={'paddle':{},'body':{}}
    for frame in range(217):
        f=track['frames'][frame];q=f['quaternion'];q=Quaternion((q[3],*q[:3]));rot=convert@q.to_matrix()@convert.transposed()
        matrix=Matrix.Translation(convert@Vector(f['position'])+shift)@rot.to_4x4()@Matrix.Diagonal((track['scale'],)*3+(1,))
        target=[]
        for o in parts:
            m=matrix@o.matrix_local
            target.append(BVHTree.FromPolygons([(m@v.co)/ratio for v in o.data.vertices],[tuple(p.vertices) for p in o.data.polygons]))
        for name,verts,faces,tree in geometry:
            hits={pair[0] for t in target for pair in tree.overlap(t)}
            if hits:
                hull_faces['paddle'].setdefault(name,set()).update(hits)
                contacts['paddle'].append({'frame':frame,'mesh':name,'hullTriangles':len(hits),'bounds':bounds([verts[i]*ratio for p in hits for i in faces[p]])})
        if frame not in [0,55,75,100,139,163,190,216]:continue
        scene.frame_set(frame);bpy.context.view_layer.update()
        e=body.evaluated_get(bpy.context.evaluated_depsgraph_get());m=e.to_mesh()
        tree_body=BVHTree.FromPolygons([(body.matrix_world@v.co+shift)/ratio for v in m.vertices],[tuple(p.vertices) for p in m.polygons]);e.to_mesh_clear()
        for name,verts,faces,tree in geometry:
            pairs=tree.overlap(tree_body);hits={p[0] for p in pairs};body_hits={p[1] for p in pairs}
            if hits:
                hull_faces['body'].setdefault(name,set()).update(hits)
                contacts['body'].append({'frame':frame,'mesh':name,'bodyBones':dict(Counter(labels[i] for i in body_hits)),'bounds':bounds([verts[i]*ratio for p in hits for i in faces[p]])})
    combined={}
    for category,meshes in hull_faces.items():
        combined[category]={name:{'faces':len(ids),'bounds':bounds([verts[i]*ratio for p in ids for i in faces[p]])} for name,verts,faces,tree in geometry if (ids:=meshes.get(name))}
    report={'boatScale':ratio*.5,'characterShift':list(shift),'summary':combined,'contacts':contacts}
    reports.append(report);print('LOW_STERN_CONTACTS',json.dumps({k:v for k,v in report.items() if k!='contacts'}),flush=True)
(OUT/'contact-regions.json').write_text(json.dumps(reports,indent=2)+'\n')
if center:
    scene.frame_set(0);bpy.context.view_layer.update()
    rig=next(o for o in scene.objects if o.type=='ARMATURE')
    hip=rig.matrix_world@rig.pose.bones['mixamorig:Hips'].head
    e=body.evaluated_get(bpy.context.evaluated_depsgraph_get());m=e.to_mesh()
    actor_tree=BVHTree.FromPolygons([body.matrix_world@v.co for v in m.vertices],[tuple(p.vertices) for p in m.polygons]);e.to_mesh_clear()
    rays=[]
    for x in [-.08,0,.08]:
        for y in [-.12,0,.12]:
            bench=geometry[0][3].ray_cast(Vector((x,y,2)),Vector((0,0,-1)))[0]
            hit=actor_tree.ray_cast(Vector((x,y,-.35)),Vector((0,0,1)),.6);underside=hit[0]
            rays.append({'xy':[x,y],'boatSurface':list(bench) if bench else None,'actorUnderside':list(underside) if underside else None,'dominantBone':labels[hit[2]] if underside else None,'signedGapM':underside.z-bench.z if bench and underside else None})
    result={'status':'diagnostic only; underside rays may include clothing or tail','hipsAtFrame0':list(hip),'rays':rays,'sourcePoseModified':False}
    (OUT/'seat-measurement.json').write_text(json.dumps(result,indent=2)+'\n')
    print('CENTER_SEAT',json.dumps(result),flush=True)
