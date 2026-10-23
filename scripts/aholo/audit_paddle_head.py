"""Check the rendered/skinned head against hands and paddle at source frame rate."""
import bpy
import json
from pathlib import Path
from mathutils.bvhtree import BVHTree

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'docs/evidence/assets/2026-10-22-paddle-fit'
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'assets/lux3d/round-01/canoe/paddle-fit-candidate.blend'))
scene=bpy.context.scene
rig=next(o for o in scene.objects if o.type=='ARMATURE')
body=next(o for o in scene.objects if o.type=='MESH' and any(m.type=='ARMATURE' for m in o.modifiers))
groups={g.index:g.name for g in body.vertex_groups}
region={}
for key, names in [('head',['Head','Neck']),('hands',['LeftHand','RightHand'])]:
    ids={v.index for v in body.data.vertices if sum(g.weight for g in v.groups if any(name in groups[g.group] for name in names))>.5}
    faces=[tuple(p.vertices) for p in body.data.polygons if all(v in ids for v in p.vertices)]
    used=sorted({i for p in faces for i in p}); mapping={v:i for i,v in enumerate(used)}
    region[key]=(used,[tuple(mapping[v] for v in p) for p in faces])
parts=[o for o in scene.objects if o.name.startswith(('Paddle_blade','Paddle_shaft'))]
records=[]
for frame in range(217):
    scene.frame_set(frame);bpy.context.view_layer.update()
    evaluated=body.evaluated_get(bpy.context.evaluated_depsgraph_get());mesh=evaluated.to_mesh()
    trees={key:BVHTree.FromPolygons([body.matrix_world@mesh.vertices[i].co for i in ids],faces) for key,(ids,faces) in region.items()}
    collisions={}
    for obj in parts:
        tree=BVHTree.FromPolygons([obj.matrix_world@v.co for v in obj.data.vertices],[tuple(p.vertices) for p in obj.data.polygons])
        collisions[obj.name]=len(trees['head'].overlap(tree))
    collisions['hands']=len(trees['head'].overlap(trees['hands']))
    distances={}
    for side in ['Left','Right']:
        b=rig.pose.bones[f'mixamorig:{side}Hand'];center=rig.matrix_world@b.head.lerp(b.tail,.5)
        distances[side]=trees['head'].find_nearest(center)[3]
    evaluated.to_mesh_clear()
    records.append({'frame':frame,'headSurfaceIntersections':collisions,'gripCenterToHeadDistance':distances})
report={'scope':'217 frames; evaluated skin; head/neck and hand faces selected by >50% corresponding bone weights',
        'regionFaces':{k:len(v[1]) for k,v in region.items()},'records':records,
        'intersectingFrames':[r for r in records if any(r['headSurfaceIntersections'].values())],
        'minGripCenterHeadDistance':min(min(r['gripCenterToHeadDistance'].values()) for r in records)}
(OUT/'head-clearance.json').write_text(json.dumps(report,indent=2)+'\n')
print('HEAD_CLEARANCE',json.dumps({k:(len(v) if k=='intersectingFrames' else v) for k,v in report.items() if k!='records'}),flush=True)
assert not report['intersectingFrames'], 'Hand or paddle intersects head/neck skin'
