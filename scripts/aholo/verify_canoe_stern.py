"""Independent scope checks for the hull derivative and unchanged source meshes."""
import bpy
import hashlib
import json
import array
from pathlib import Path
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'docs/evidence/assets/2026-10-23-canoe-stern'
config=json.loads((OUT/'candidate.json').read_text())
def digest_mesh(m):
    return {'faces':hashlib.sha256(str([(tuple(p.vertices),p.material_index) for p in m.polygons]).encode()).hexdigest(),
            'uv':hashlib.sha256(array.array('f',[v for d in m.uv_layers.active.data for v in d.uv]).tobytes()).hexdigest() if m.uv_layers.active else None,
            'positions':hashlib.sha256(array.array('f',[v for p in m.vertices for v in p.co]).tobytes()).hexdigest()}
def images(obj):
    found={}
    for mat in obj.data.materials:
        for node in mat.node_tree.nodes:
            if node.type=='TEX_IMAGE' and node.image and node.image.name not in found:
                img=node.image;pixels=array.array('f',[0])*len(img.pixels);img.pixels.foreach_get(pixels)
                found[img.name]={'size':list(img.size),'pixelsSHA256':hashlib.sha256(pixels.tobytes()).hexdigest()}
    return found
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'assets/lux3d/round-01/canoe/assembly-review-v2.blend'))
hull=bpy.data.objects['Lux3D_canoe'];before=digest_mesh(hull.data);textures=images(hull)
points=[hull.matrix_world@v.co*.85 for v in hull.data.vertices]
names=[o.name for o in bpy.context.scene.objects if o.type=='MESH' and (o.name.startswith('Paddle_') or any(m.type=='ARMATURE' for m in o.modifiers))]
unchanged={name:digest_mesh(bpy.data.objects[name].data) for name in names}
bpy.ops.wm.open_mainfile(filepath=str((ROOT/config['asset'].lstrip('/')).with_suffix('.blend')))
hull=bpy.data.objects['Lux3D_canoe'];after=digest_mesh(hull.data)
assert before['faces']==after['faces'] and before['uv']==after['uv']
assert textures==images(hull)
assert all(digest_mesh(bpy.data.objects[n].data)==v for n,v in unchanged.items())
fore=[(hull.matrix_world@v.co-points[v.index]).length for v in hull.data.vertices if points[v.index].x>=.12]
assert max(fore)<1e-6
diffs=[(hull.matrix_world@v.co-points[v.index]).length for v in hull.data.vertices]
report={'hullTopologyAndMaterialAssignmentPreserved':True,'hullUVPreserved':True,'hullTexturePixelsPreserved':textures,'actorAndPaddleLocalMeshPreserved':names,'forwardHullVerticesChecked':len(fore),'forwardHullMaxErrorM':max(fore),'hullVerticesMoved':sum(d>1e-7 for d in diffs),'maximumHullMoveM':max(diffs),'wholeBoatInstanceRatio':.85,'candidateSHA256':hashlib.sha256((ROOT/config['asset'].lstrip('/')).read_bytes()).hexdigest()}
(OUT/'scope-verification.json').write_text(json.dumps(report,indent=2)+'\n')
print('SCOPE_VERIFIED',json.dumps(report),flush=True)
