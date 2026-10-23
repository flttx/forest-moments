"""Fit the independent paddle to the frozen character clip; no source writes."""
import bpy
import json
import math
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT/'docs/evidence/assets/2026-10-22-paddle-fit'
OUT.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'assets/lux3d/round-01/canoe/assembly-review-v2.blend'))
scene = bpy.context.scene
rig = next(o for o in scene.objects if o.type=='ARMATURE')
hull = bpy.data.objects['Lux3D_canoe']
tree = BVHTree.FromPolygons([hull.matrix_world@v.co for v in hull.data.vertices], [tuple(p.vertices) for p in hull.data.polygons])
poses=[]
for frame in range(217):
    scene.frame_set(frame); bpy.context.view_layer.update()
    hands=[]
    for side in ['Left','Right']:
        bone=rig.pose.bones[f'mixamorig:{side}Hand']
        hands.append(rig.matrix_world@bone.head.lerp(bone.tail,.5))
    poses.append(hands)

def ease(x):
    x=max(0,min(1,x)); return x*x*(3-2*x)

def direction(clip):
    # Adapted from my-blog/src/world/boat/paddlePlan.ts; assembly frame +X bow, -Y right, +Z up.
    time=clip%7.2
    strokes=[(1.83,3.83,-1),(5.43,7.2,1)]
    def stroke(side,u): return Vector((.5-.92*u,-side*math.sin(.55),-math.cos(.55))).normalized()
    def flat(side): return Vector((0,-side,.3)).normalized()
    for a,b,s in strokes:
        if a<=time<=b: return stroke(s,(time-a)/(b-a))
    after,nxt=(strokes[0],strokes[1]) if 3.83<time<5.43 else (strokes[1],strokes[0])
    g=((time-after[1])%7.2)/((nxt[0]-after[1])%7.2)
    if g<.25: return stroke(after[2],1).lerp(flat(after[2]),ease(g/.25)).normalized()
    if g<.75:
        angle=(after[2]+(nxt[2]-after[2])*ease((g-.25)/.5))*math.pi/2
        return Vector((math.cos(angle),-math.sin(angle),.3)).normalized()
    return flat(nxt[2]).lerp(stroke(nxt[2],0),ease((g-.75)/.25)).normalized()

def intersect(mid, down, reach, radius=.016, beam=1, depth=1):
    # Five offset rays include shaft thickness; the full blade is checked on finalists separately.
    cross=down.cross(Vector((0,0,1)))
    if cross.length<.001: cross=down.cross(Vector((0,1,0)))
    cross.normalize(); other=down.cross(cross).normalized()
    for offset in [Vector(),cross*radius,-cross*radius,other*radius,-other*radius]:
        start=mid-down*.16+offset; end=mid+down*reach+offset
        start=Vector((start.x,start.y/beam,start.z/depth))
        end=Vector((end.x,end.y/beam,end.z/depth)); delta=end-start
        if tree.ray_cast(start,delta.normalized(),delta.length)[0] is not None: return True
    return False

def solve(shift, scale):
    result=[]; max_gap=0; bad=0; adjusted=0
    reach=(math.hypot(2.05,1.95)+.65)*scale-.16
    for frame,(left0,right0) in enumerate(poses):
        left,right=left0+shift,right0+shift; mid=(left+right)*.5
        plan=direction(frame/30); axis=(left-right).normalized()
        if axis.dot(plan)<0: axis.negate()
        trust=max(0,min(1,((left-right).length-.12)/.12))*max(0,min(1,(axis.dot(plan)-.6)/.25))
        down=plan.lerp(axis,.7*trust).normalized()
        initial=down.copy()
        # Lift over the nearest side, preserving the blade's intended stroke side.
        side=1 if plan.y>=0 else -1
        for attempt in range(28):
            if not intersect(mid,down,reach): break
            down=down.lerp(Vector((0,side,1.4)).normalized(),.10).normalized()
        collision=intersect(mid,down,reach)
        bad+=int(collision); adjusted+=int(initial.dot(down)<.9999)
        gap=(left-mid).cross(down).length
        max_gap=max(max_gap,gap)
        result.append({'frame':frame,'mid':list(mid),'down':list(down),'handGap':gap,'collision':collision})
    return {'shift':list(shift),'paddleScale':scale,'shaftHits':bad,'maxHandGap':max_gap,'adjustedFrames':adjusted,'poses':result}

records=[]
for lift in [0,.04,.08,.12,.16]:
    for scale in [.32,.35,.38]:
        for forward in [0,.15,-.15]:
            r=solve(Vector((forward,0,lift)),scale)
            records.append(r)
            print(json.dumps({k:v for k,v in r.items() if k!='poses'}),flush=True)
records.sort(key=lambda r:(r['shaftHits'],r['maxHandGap'],r['shift'][2]))
(OUT/'fit-scan.json').write_text(json.dumps(records,indent=2)+'\n',encoding='utf-8')
print('FIT_SCAN_COMPLETE',flush=True)

exact=[]
for beam in [1,.85,.7,.6]:
    for depth in [1,.8,.65]:
        for lift in [0,.08,.16,.24]:
            shift=Vector((0,0,lift+.117086887*(1-depth)))
            hits=[]
            for frame,(left0,right0) in enumerate(poses):
                left,right=left0+shift,right0+shift
                down=(left-right).normalized() if 30<=frame<130 else (right-left).normalized()
                if intersect((left+right)*.5,down,1.06,beam=beam,depth=depth): hits.append(frame)
            strokes=[f for f in hits if 55<=f<=115 or 163<=f<=216]
            exact.append({'beamScale':beam,'depthScale':depth,'seatLift':lift,'shift':list(shift),'hits':hits,'strokeHits':len(strokes)})
exact.sort(key=lambda r:(r['strokeHits'],len(r['hits']),r['seatLift'],1-r['beamScale']))
(OUT/'exact-hand-scan.json').write_text(json.dumps(exact,indent=2)+'\n',encoding='utf-8')
print(json.dumps([{k:(len(v) if k=='hits' else v) for k,v in r.items()} for r in exact[:10]]),flush=True)
