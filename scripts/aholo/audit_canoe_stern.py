"""Audit the derived aft hull and seat against untouched animated character."""
import bpy
import math
import json
import sys
import hashlib
import numpy as np
from pathlib import Path
from collections import Counter
from mathutils import Vector, Matrix, Quaternion
from mathutils.bvhtree import BVHTree

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/('docs/evidence/assets/2026-10-23-paddle-final' if '--final' in sys.argv else 'docs/evidence/assets/2026-10-23-center-seat-fit' if '--center' in sys.argv else 'docs/evidence/assets/2026-10-23-canoe-stern')
config=json.loads((OUT/'candidate.json').read_text())
bpy.ops.wm.open_mainfile(filepath=str((ROOT/config['asset'].lstrip('/')).with_suffix('.blend')))
scene=bpy.context.scene
rig=next(o for o in scene.objects if o.type=='ARMATURE')
assert rig.animation_data.action.name=='paddle' and not any(b.constraints for b in rig.pose.bones)
body=next(o for o in scene.objects if o.type=='MESH' and any(m.type=='ARMATURE' for m in o.modifiers))
parts=[o for o in scene.objects if o.name.startswith(('Paddle_blade','Paddle_shaft'))]
trees={}
for o in scene.objects:
    if o.name in ['Lux3D_canoe','Measured_hull_cavity_caps'] or o.name.startswith(('Aft_low_seat','Center_seat')):
        trees[o.name]=BVHTree.FromPolygons([o.matrix_world@v.co for v in o.data.vertices],[tuple(p.vertices) for p in o.data.polygons])
groups={g.index:g.name for g in body.vertex_groups}
labels=[]
for p in body.data.polygons:
    weights=Counter()
    for i in p.vertices:
        for g in body.data.vertices[i].groups:weights[groups[g.group]]+=g.weight
    labels.append(weights.most_common(1)[0][0] if weights else 'unweighted')
track=json.loads((ROOT/config.get('propTrack','docs/evidence/assets/2026-10-23-paddle-prop/prop-track.json')).read_text())
convert=Matrix.Rotation(math.pi/2,3,'X');shift=Vector(config['characterShift'])
body_faces=[tuple(p.vertices) for p in body.data.polygons]
face_array=np.asarray(body_faces)
world=np.asarray(body.matrix_world)
records=[]
sample_frames=[i/4 for i in range(865)] if '--dense' in sys.argv else [0,55,75,100,139,163,190,216] if '--quick' in sys.argv else range(217)
if '--range' in sys.argv:
    arg=sys.argv.index('--range');low,high=map(float,sys.argv[arg+1:arg+3]);sample_frames=[f for f in sample_frames if low<=f<=high]
for frame in sample_frames:
    scene.frame_set(int(frame),subframe=frame-int(frame));bpy.context.view_layer.update()
    unchanged={b.name:tuple(v for row in b.matrix_basis for v in row) for b in rig.pose.bones}
    e=body.evaluated_get(bpy.context.evaluated_depsgraph_get());m=e.to_mesh()
    coords=np.empty((len(m.vertices),3),dtype=np.float32);m.vertices.foreach_get('co',coords.ravel());coords=coords@world[:3,:3].T+world[:3,3]
    body_tree=BVHTree.FromPolygons(coords.tolist(),body_faces);e.to_mesh_clear()
    hands=[np.asarray(rig.matrix_world@rig.pose.bones['mixamorig:'+side+'Hand'].head.lerp(rig.pose.bones['mixamorig:'+side+'Hand'].tail,.5)) for side in ['Left','Right']]
    body_contacts={}
    for name,tree in trees.items():
        ids={pair[1] for pair in tree.overlap(body_tree)}
        if ids:body_contacts[name]={'triangles':len(ids),'bones':dict(Counter(labels[i] for i in ids))}
    support_gaps=[]
    for x in [-.11,-.06,0,.08,.17]:
        for y in [-.22,-.12,0,.12,.17,.22]:
            for name,tree in trees.items():
                if not name.startswith('Center_seat_top'):continue
                seat_hit=tree.ray_cast(Vector((x,y,.4)),Vector((0,0,-1)),.5)[0]
                if seat_hit is None:continue
                hit=body_tree.ray_cast(seat_hit+Vector((0,0,.0001)),Vector((0,0,1)),.3)
                if hit[0] is not None and any(b in labels[hit[2]] for b in ['Hips','UpLeg']):support_gaps.append(hit[0].z-seat_hit.z)
    prop_frame=frame*track.get('sampleFPS',30)/30;index=int(prop_frame);u=prop_frame-index;f=track['frames'][index];next_f=track['frames'][min(index+1,len(track['frames'])-1)]
    q=f['quaternion'];q=Quaternion((q[3],*q[:3]));qn=next_f['quaternion'];q=q.slerp(Quaternion((qn[3],*qn[:3])),u);rot=convert@q.to_matrix()@convert.transposed()
    pos=Vector(f['position']).lerp(Vector(next_f['position']),u)
    matrix=Matrix.Translation(convert@pos+shift)@rot.to_4x4()@Matrix.Diagonal((track['scale'],)*3+(1,))
    prop_contacts={};head_hits=0;other_body=Counter();protected_body=Counter();hand_hits=Counter();blade_min=None
    for o in parts:
        m=matrix@o.matrix_local
        t=BVHTree.FromPolygons([m@v.co for v in o.data.vertices],[tuple(p.vertices) for p in o.data.polygons])
        for name,tree in trees.items():
            hits=len(tree.overlap(t))
            if hits:prop_contacts[name]=prop_contacts.get(name,0)+hits
        contacts=body_tree.overlap(t)
        head_hits+=sum('Head' in labels[i] or 'Neck' in labels[i] for i,j in contacts)
        for i,j in contacts:
            label=labels[i]
            if 'Hand' in label:hand_hits['Left' if 'Left' in label else 'Right']+=1
            else:
                other_body[label]+=1
                center=coords[face_array[i]].mean(axis=0)
                if 'ForeArm' not in label or min(float(np.linalg.norm(center-h)) for h in hands)>=.09:protected_body[label]+=1
        if o.name.startswith('Paddle_blade'):blade_min=min((m@v.co).z for v in o.data.vertices)
    assert all(tuple(v for row in b.matrix_basis for v in row)==unchanged[b.name] for b in rig.pose.bones)
    records.append({'frame':frame,'bodyContacts':body_contacts,'paddleContacts':prop_contacts,'paddleHeadTriangles':head_hits,'paddleOtherBodyContacts':dict(other_body),'paddleProtectedBodyContacts':dict(protected_body),'handContactTriangles':dict(hand_hits),'heldHandContact':hand_hits[f['held']]>0,'twoHandPhase':not (f['regrip'] or u and next_f['regrip']),'bladeMinZ':blade_min,'seatSupportGap':min(support_gaps) if support_gaps else None})
    if frame%30==0:print('AUDIT_FRAME',frame,json.dumps(records[-1]),flush=True)
report={'sampleRate':30,'sampleCount':len(records),'boneOverrides':False,'frames':records,'summary':{'paddleHullFrames':[r['frame'] for r in records if any(k in ['Lux3D_canoe','Measured_hull_cavity_caps'] for k in r['paddleContacts'])],'paddleSeatFrames':[r['frame'] for r in records if any(k.startswith(('Aft_low_seat','Center_seat')) for k in r['paddleContacts'])],'bodyHullFrames':[r['frame'] for r in records if any(k in ['Lux3D_canoe','Measured_hull_cavity_caps'] for k in r['bodyContacts'])],'bodySeatFrames':[r['frame'] for r in records if any(k.startswith(('Aft_low_seat','Center_seat')) for k in r['bodyContacts'])],'paddleHeadFrames':[r['frame'] for r in records if r['paddleHeadTriangles']]}}
report.update({'asset':config['asset'],'assetSHA256':config['outputSHA256'],'timelineFPS':30,'sampleRate':None if '--quick' in sys.argv else 30})
report.update(trackSHA256=hashlib.sha256((ROOT/config['propTrack']).read_bytes()).hexdigest(),protectedBodyExclusion='Hand faces and ForeArm faces with centroid within 9 cm of an original hand midpoint; all other body faces checked')
report['summary']['paddleProtectedBodyFrames']=[r['frame'] for r in records if r['paddleProtectedBodyContacts']]
report['summary']['missingHeldHandFrames']=[r['frame'] for r in records if not r['heldHandContact']]
report['summary']['missingSecondHandFrames']=[r['frame'] for r in records if r['twoHandPhase'] and len(r['handContactTriangles'])<2]
if '--dense' in sys.argv:report['sampleRate']=120
(OUT/('geometry-range-audit.json' if '--range' in sys.argv else 'geometry-dense-audit.json' if '--dense' in sys.argv else 'quick-audit.json' if '--quick' in sys.argv else 'geometry-audit.json')).write_text(json.dumps(report,indent=2)+'\n')
print('STERN_AUDIT',json.dumps(report['summary']),flush=True)
