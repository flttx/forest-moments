"""Read-only layout search: move whole character/prop, never bones or meshes."""
import bpy
import json
import math
from pathlib import Path
from mathutils import Vector, Quaternion, Matrix
from mathutils.bvhtree import BVHTree

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'docs/evidence/assets/2026-10-23-paddle-layout'
OUT.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'assets/lux3d/round-01/canoe/assembly-review-v2.blend'))
scene=bpy.context.scene
track=json.loads((ROOT/'docs/evidence/assets/2026-10-23-paddle-prop/prop-track.json').read_text())
trees=[]
for name in ['Lux3D_canoe','Measured_hull_cavity_caps']:
    o=bpy.data.objects[name]
    trees.append(BVHTree.FromPolygons([o.matrix_world@v.co for v in o.data.vertices],[tuple(p.vertices) for p in o.data.polygons]))
convert=Matrix.Rotation(math.pi/2,3,'X')
parts=[o for o in scene.objects if o.name.startswith(('Paddle_blade','Paddle_shaft'))]
native={o.name:o.matrix_local.copy() for o in parts}
segments=[];matrices=[]
for f in track['frames']:
    q=f['quaternion'];q=Quaternion((q[3],*q[:3]))
    rotation=convert@q.to_matrix()@convert.transposed()
    matrix=Matrix.Translation(convert@Vector(f['position']))@rotation.to_4x4()@Matrix.Diagonal((track['scale'],)*3+(1,))
    matrices.append(matrix)
    a=matrix@Vector((.75,.8,.3));b=matrix@Vector((-1.3,-1.15,.3))
    down=(b-a).normalized();cross=down.cross(Vector((0,0,1))).normalized();other=down.cross(cross)
    segments.append([(a+offset,b+offset) for offset in [Vector(),cross*.012,-cross*.012,other*.012,-other*.012]])

def hit_count(ratio,shift,frames):
    hits=[]
    for frame in frames:
        for a,b in segments[frame]:
            start=(a+shift)/ratio;end=(b+shift)/ratio;delta=end-start
            if any(t.ray_cast(start,delta.normalized(),delta.length)[0] is not None for t in trees):
                hits.append(frame);break
    return hits

layouts=[]
for scale in [.5,.475,.45]:
    ratio=scale/.5
    for x in [-.6,-.5,-.4,-.3,-.2,0]:
        for y in [-.3,-.25,-.2,-.15]:
            seat=trees[0].ray_cast(Vector((x/ratio,y/ratio,2)),Vector((0,0,-1)))[0]
            if seat is None or not -.5<seat.z<.03:continue
            for height in [.20,.24,.28,.32,.36]:
                lift=height-seat.z*ratio-.117086887
                shift=Vector((x,y,height))
                hits=hit_count(ratio,shift,range(0,217,3))
                layouts.append({'boatScale':scale,'characterShift':list(shift),'seatSurface':list(seat*ratio),'seatLift':lift,'coarseHits':len(hits)})
layouts.sort(key=lambda r:(r['coarseHits'],abs(r['boatScale']-.5),abs(r['characterShift'][0]),r['characterShift'][2]))
for r in layouts[:24]:
    r['shaftFrames']=hit_count(r['boatScale']/.5,Vector(r['characterShift']),range(217))
    r['shaftHits']=len(r['shaftFrames'])
finalists=sorted(layouts[:24],key=lambda r:(r['shaftHits'],abs(r['boatScale']-.5),abs(r['characterShift'][0]),r['characterShift'][2]))[:8]
for r in finalists:
    ratio=r['boatScale']/.5;shift=Vector(r['characterShift']);hits=[]
    # Inverse-transform the finite paddle mesh into the unchanged hull BVH.
    for frame,matrix in enumerate(matrices):
        collided=False
        for o in parts:
            m=matrix@native[o.name]
            vertices=[(m@v.co+shift)/ratio for v in o.data.vertices]
            tree=BVHTree.FromPolygons(vertices,[tuple(p.vertices) for p in o.data.polygons])
            if any(t.overlap(tree) for t in trees):collided=True;break
        if collided:hits.append(frame)
    r['fullPaddleFrames']=hits;r['fullPaddleHits']=len(hits)
    print('LAYOUT_FINALIST',json.dumps(r),flush=True)
(OUT/'layout-search.json').write_text(json.dumps({'scope':'layout only; no body containment acceptance','candidateCount':len(layouts),'finalists':finalists,'coarse':layouts},indent=2)+'\n')
