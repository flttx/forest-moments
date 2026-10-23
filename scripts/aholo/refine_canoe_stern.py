"""Refine the reviewed v2 derivative: rising aft tip and seat-edge clearance."""
import bpy
import json
import hashlib
from pathlib import Path
from mathutils import Matrix
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'docs/evidence/assets/2026-10-23-canoe-stern'
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'assets/lux3d/round-01/canoe/assembly-review-v2.blend'))
hull=bpy.data.objects['Lux3D_canoe'];original=[hull.matrix_world@v.co*.85 for v in hull.data.vertices]
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'assets/lux3d/round-01/canoe/stern-seat-v2.blend'))
hull=bpy.data.objects['Lux3D_canoe'];changed=set()
normals=[n.vector.copy() for n in hull.data.corner_normals]
for v,p in zip(hull.data.vertices,original):
    u=max(0,min(1,(-1.15-p.x)/.45));w=u*u*(3-2*u)
    if p.z>-.17 and w>0:v.co.z+=(p.z+.17)*.60*w;changed.add(v.index)
hull.data.update()
hull.data.normals_split_custom_set([(0,0,0) if loop.vertex_index in changed else normals[loop.index] for loop in hull.data.loops])
seat=bpy.data.objects['Aft_low_seat_original_wood']
for v in seat.data.vertices:v.co.z-=.022
for o in bpy.context.scene.objects:
    if o.name.startswith('Aft_low_seat_support'):
        # Shorten the support from its top; keep the lower anchoring point.
        bottom=min((o.matrix_world@v.co).z for v in o.data.vertices)
        top=max((o.matrix_world@v.co).z for v in o.data.vertices)
        transform=o.matrix_world.copy()
        for v in o.data.vertices:
            p=transform@v.co;p.z-=.022*(p.z-bottom)/(top-bottom);v.co=p
        o.matrix_world=Matrix.Identity(4)
bpy.context.view_layer.update();bpy.ops.object.select_all(action='DESELECT')
for o in bpy.context.scene.objects:
    if o.name in ['Lux3D_canoe','Measured_hull_cavity_caps'] or o.name.startswith('Aft_low_seat'):o.select_set(True)
out=ROOT/'assets/lux3d/round-01/canoe/stern-seat-v3.glb'
bpy.ops.export_scene.gltf(filepath=str(out),export_format='GLB',use_selection=True,export_animations=False)
bpy.ops.wm.save_as_mainfile(filepath=str(out.with_suffix('.blend')))
config=json.loads((OUT/'candidate.json').read_text())
config.update({'asset':'/'+out.relative_to(ROOT).as_posix(),'outputSHA256':hashlib.sha256(out.read_bytes()).hexdigest(),'refinement':'gentle aft-tip rise; seat and support top lowered 22 mm','status':'candidate; v3 verification pending','seatHeightRange':[min(v.co.z for v in seat.data.vertices),max(v.co.z for v in seat.data.vertices)]})
(OUT/'candidate.json').write_text(json.dumps(config,indent=2)+'\n')
print('STERN_REFINED',config['outputSHA256'],flush=True)
