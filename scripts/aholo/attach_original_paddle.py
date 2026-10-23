"""Fit only the existing paddle object to untouched source hand poses.

No bone, mesh, weight, garment or source-file writes. Recovery releases one
hand while the other stays on the shaft. Output is a prop-only review track.
"""
import bpy
import hashlib
import json
import math
from pathlib import Path
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'docs/evidence/assets/2026-10-23-paddle-prop'
OUT.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'assets/lux3d/round-01/canoe/assembly-review-v2.blend'))
scene=bpy.context.scene
rig=next(o for o in scene.objects if o.type=='ARMATURE')
assert rig.animation_data.action.name=='paddle'
assert not any(b.constraints for b in rig.pose.bones)
paddle=bpy.data.objects['ASSEMBLY_ONLY_paddle']
parts=[o for o in scene.objects if o.name.startswith(('Paddle_blade','Paddle_shaft'))]
trees=[]
for name in ['Lux3D_canoe','Measured_hull_cavity_caps']:
    o=bpy.data.objects[name]
    trees.append(BVHTree.FromPolygons([o.matrix_world@v.co for v in o.data.vertices],[tuple(p.vertices) for p in o.data.polygons]))
axis=Vector((2.05,1.95,0)).normalized()
handle=Vector((.75,.80,.30))-axis*.08
scale=.38
body=next(o for o in scene.objects if o.type=='MESH' and any(m.type=='ARMATURE' for m in o.modifiers))
groups={g.index:g.name for g in body.vertex_groups}
head_ids={v.index for v in body.data.vertices if sum(g.weight for g in v.groups if any(n in groups[g.group] for n in ['Head','Neck']))>.5}
head_faces=[tuple(p.vertices) for p in body.data.polygons if all(v in head_ids for v in p.vertices)]
head_used=sorted({i for p in head_faces for i in p});head_mapping={v:i for i,v in enumerate(head_used)}
head_faces=[tuple(head_mapping[i] for i in p) for p in head_faces]
def ease(t):return t*t*(3-2*t)
def blend(frame):
    if frame<12:return 0
    if frame<55:return ease((frame-12)/43)
    if frame<123:return 1
    if frame<163:return 1-ease((frame-123)/40)
    return 0
source_hands=[]
for frame in range(217):
    scene.frame_set(frame);bpy.context.view_layer.update()
    source_hands.append({s:rig.matrix_world@rig.pose.bones[f'mixamorig:{s}Hand'].head.lerp(rig.pose.bones[f'mixamorig:{s}Hand'].tail,.5) for s in ['Left','Right']})
def direction_at(frame,left_lower):
    hands=source_hands[frame]
    return ((hands['Left']-hands['Right'])*(1 if left_lower else -1)).normalized()
def prop_rotation(frame):
    for start,end,first_left in [(12,55,False),(123,163,True)]:
        if start<=frame<=end:
            dirs=[direction_at(start,first_left),Vector((1,.5 if first_left else -.5,-.1)).normalized(),Vector((1,0,-.05)).normalized(),direction_at(end,not first_left)]
            t=(frame-start)/(end-start)*3;segment=min(2,int(t));u=ease(t-segment)
            a=axis.rotation_difference(-dirs[segment]);b=axis.rotation_difference(-dirs[segment+1])
            return a.slerp(b,u)
    return axis.rotation_difference(-direction_at(frame,55<frame<123))
records=[];previous=None;shaft_segments=[]
for frame in range(217):
    scene.frame_set(frame);bpy.context.view_layer.update()
    untouched={b.name:tuple(v for row in b.matrix_basis for v in row) for b in rig.pose.bones}
    hands={}
    for side in ['Left','Right']:
        b=rig.pose.bones[f'mixamorig:{side}Hand']
        hands[side]=rig.matrix_world@b.head.lerp(b.tail,.5)
    separation=(hands['Left']-hands['Right']).length
    w=blend(frame)
    # Keep the forward hand attached while the other changes grip near the face.
    q=prop_rotation(frame);down=-(q@axis)
    held='Left' if 12<=frame<123 else 'Right'
    lower_fraction=1-w if held=='Right' else w
    for start,end in [(12,55),(123,163)]:
        if start<frame<end:
            # During release the supporting hand holds near the handle end;
            # slide back to the two-hand grip only as the hands lower again.
            lower_fraction*=ease(max(0,min(1,((frame-start)/(end-start)-.75)*4)))
    pivot=handle-axis*(separation*lower_fraction/scale)
    for start,end in [(12,55),(123,163)]:
        if start<frame<end:
            pivot+=axis*(.08*math.sin(math.pi*(frame-start)/(end-start)))
    rotation=q.to_matrix()
    if previous:q.make_compatible(previous)
    previous=q.copy()
    location=hands[held]-q@(pivot*scale)
    paddle.matrix_world=Matrix.Translation(location)@q.to_matrix().to_4x4()@Matrix.Diagonal((scale,scale,scale,1))
    shaft_segments.append((paddle.matrix_world@Vector((.75,.8,.3)),paddle.matrix_world@Vector((-1.3,-1.15,.3))))
    bpy.context.view_layer.update()
    evaluated=body.evaluated_get(bpy.context.evaluated_depsgraph_get());mesh=evaluated.to_mesh()
    head_tree=BVHTree.FromPolygons([body.matrix_world@mesh.vertices[i].co for i in head_used],head_faces)
    evaluated.to_mesh_clear()
    hits={};head_hits={};blade_z=[]
    for o in parts:
        verts=[o.matrix_world@v.co for v in o.data.vertices]
        tree=BVHTree.FromPolygons(verts,[tuple(p.vertices) for p in o.data.polygons])
        hits[o.name]=sum(len(t.overlap(tree)) for t in trees)
        head_hits[o.name]=len(head_tree.overlap(tree))
        if o.name=='Paddle_blade':blade_z=[v.z for v in verts]
    assert all(tuple(v for row in b.matrix_basis for v in row)==untouched[b.name] for b in rig.pose.bones)
    # Export Blender Z-up to glTF/Three Y-up, including quaternion conjugation.
    convert=Matrix.Rotation(-math.pi/2,3,'X')
    out_q=(convert@rotation@convert.transposed()).to_quaternion()
    out_p=convert@location
    records.append({'frame':frame,'position':list(out_p),'quaternion':[out_q.x,out_q.y,out_q.z,out_q.w],'pivot':list(convert@pivot),
        'held':held,'regrip':0<w<1,'handCenters':{s:list(p) for s,p in hands.items()},
        'gripErrors':{s:(p-hands[held]).cross(down).length for s,p in hands.items()},
        'surfaceIntersections':hits,'headIntersections':head_hits,'bladeMinZ':min(blade_z)})
sources={n:hashlib.sha256((ROOT/f'public/assets/models/{n}.glb').read_bytes()).hexdigest() for n in ['raccoon','canoe']}
report={'sourceHashes':sources,'scale':scale,'frames':records,'boneOverrides':False,
        'status':'prop-only candidate; inspect source poses, grip and hull contacts separately',
        'intersectingFrames':[r['frame'] for r in records if any(r['surfaceIntersections'].values())],
        'headIntersectingFrames':[r['frame'] for r in records if any(r['headIntersections'].values())],
        'maxHeldHandError':max(r['gripErrors'][r['held']] for r in records),
        'maxTwoHandErrorOutsideRecovery':max(max(r['gripErrors'].values()) for r in records if not r['regrip']),
        'wetFramesLeft':[r['frame'] for r in records if 55<=r['frame']<=115 and r['bladeMinZ']<-.355],
        'wetFramesRight':[r['frame'] for r in records if 163<=r['frame']<=216 and r['bladeMinZ']<-.355]}
(OUT/'prop-track.json').write_text(json.dumps(report,indent=2)+'\n')
print('PROP_ONLY_RESULT',json.dumps({k:v for k,v in report.items() if k!='frames'}),flush=True)

# Read-only layout diagnosis, not an automatic change to the hull or seating.
layouts=[]
for boat_scale in [.2,.225,.25,.275,.3,.35,.4,.45,.5]:
    ratio=boat_scale/.5
    for x in [-.4,-.2,0,.2,.4]:
        seat=trees[0].ray_cast(Vector((x/ratio,0,2)),Vector((0,0,-1)))[0]
        if seat is None:continue
        shift=Vector((x,0,seat.z*ratio+.117086887))
        hits=[]
        for frame,(a,b) in enumerate(shaft_segments):
            start=(a+shift)/ratio;end=(b+shift)/ratio;delta=end-start
            if any(t.ray_cast(start,delta.normalized(),delta.length)[0] is not None for t in trees):hits.append(frame)
        layouts.append({'boatScale':boat_scale,'characterShift':list(shift),'shaftCenterHits':len(hits),'frames':hits})
layouts.sort(key=lambda r:(r['shaftCenterHits'],abs(r['boatScale']-.5)))
(OUT/'layout-scan.json').write_text(json.dumps(layouts,indent=2)+'\n')
print('LAYOUT_DIAGNOSIS',json.dumps(layouts[:4]),flush=True)
