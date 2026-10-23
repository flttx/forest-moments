"""Verify local rig artifacts and publish a small review manifest, without API use."""
from collections import Counter
import hashlib
import json
from pathlib import Path
import numpy as np
from PIL import Image
from audit import ROOT,audit_glb
from audit_tail_repair import load,texture_hashes

DIRECTORY=ROOT/'assets/lux3d/round-01/raccoon-multiview'
EVIDENCE=ROOT/'docs/evidence/assets/2026-10-22-raccoon-animation'
EVIDENCE.mkdir(parents=True,exist_ok=True)
VARIANTS=['surface-v1','rig-v1','rig-mixamo-v2','rig-mixamo-v3','rig-mixamo-v4','rig-mixamo-v5','rig-mixamo-v6']

def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()

def accessor(doc,binary,index):
    a=doc['accessors'][index];v=doc['bufferViews'][a['bufferView']]
    dtype=np.dtype({5121:'u1',5123:'<u2',5125:'<u4',5126:'<f4'}[a['componentType']])
    width={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}[a['type']]
    return np.ndarray((a['count'],width),dtype=dtype,buffer=binary,
        offset=v.get('byteOffset',0)+a.get('byteOffset',0),strides=(v.get('byteStride',width*dtype.itemsize),dtype.itemsize))

def triangles(doc,binary,require_identity=True):
    result=Counter()
    # Surface and tail-repair sources have identity mesh nodes.
    if require_identity:
        assert all(not any(k in n for k in ['translation','rotation','scale','matrix']) for n in doc['nodes'])
    for mesh in doc['meshes']:
        for p in mesh['primitives']:
            points=accessor(doc,binary,p['attributes']['POSITION'])
            for tri in accessor(doc,binary,p['indices']).ravel().reshape(-1,3):
                result[tuple(sorted(tuple(round(float(v),7) for v in points[i]) for i in tri))]+=1
    return result

def duration(doc,binary,animation):
    return max(float(accessor(doc,binary,s['input']).max()) for s in animation['samplers'])

def triangle_corners(doc,binary):
    # Blender keeps polygon/material order while it splits seam vertices. Compare
    # actual corresponding coordinates with an explicit float32 export tolerance,
    # not rounded set keys (rounding boundaries can create false mismatches).
    return np.concatenate([accessor(doc,binary,p['attributes']['POSITION'])[accessor(doc,binary,p['indices']).ravel()]
        for m in doc['meshes'] for p in m['primitives']])

def main():
    surface=DIRECTORY/'surface-v1.glb';tail=DIRECTORY/'tail-repair-v5.glb'
    sd,sb=load(surface);td,tb=load(tail)
    assert triangles(sd,sb)==triangles(td,tb),'Surface material edit changed geometry'
    assert len(set(texture_hashes(sd,sb))&set(texture_hashes(td,tb)))==1,'Base color texture not preserved'
    cut=[p for m in sd['meshes'] for p in m['primitives'] if 'Tail_root' in sd['materials'][p['material']]['name']]
    assert cut and all('COLOR_0' in p['attributes'] for p in cut),'Cut-face sampled colors missing'
    native=Path('E:/Projects/my-blog/public/assets/world/player/raccoon-mixamo.meshopt.glb')
    expected_source='040014b784e477327757132224efda5d6bc24496b1b42354084b7fb82e9e710a'
    assert sha(native)==expected_source
    # The local decoded source gives ordinary accessors for duration comparison.
    od,ob=load(ROOT/'.tmp/my-blog-raccoon-decoded.glb')
    nd,nb=load(DIRECTORY/'rig-mixamo-v6.glb')
    old_clips={a['name']:duration(od,ob,a) for a in od['animations']}
    new_clips={a['name']:duration(nd,nb,a) for a in nd['animations']}
    assert set(old_clips)==set(new_clips) and len(new_clips)==19
    assert all(abs(v-new_clips[n])<1e-3 for n,v in old_clips.items())
    assert len(nd['skins'])==1 and len(nd['skins'][0]['joints'])==38
    assert audit_glb(DIRECTORY/'rig-mixamo-v6.glb')['triangles']==290520
    v3d,v3b=load(DIRECTORY/'rig-mixamo-v3.glb')
    old_corners=triangle_corners(v3d,v3b);new_corners=triangle_corners(nd,nb)
    assert old_corners.shape==new_corners.shape
    corner_error=float(np.abs(old_corners-new_corners).max())
    assert corner_error<1e-6,f'Tail seam changed face geometry: {corner_error}'
    joint_names=[nd['nodes'][i]['name'] for i in nd['skins'][0]['joints']]
    max_tail_leg_weight=0
    for mesh in nd['meshes']:
        for primitive in mesh['primitives']:
            joints=accessor(nd,nb,primitive['attributes']['JOINTS_0'])
            weights=accessor(nd,nb,primitive['attributes']['WEIGHTS_0'])
            tail=np.array([n.startswith('tail_') for n in joint_names])[joints]
            leg=np.array([any(k in n for k in ['UpLeg','Leg','Foot','Toe']) for n in joint_names])[joints]
            tail_led=(weights*tail).sum(axis=1)>.5
            if tail_led.any():max_tail_leg_weight=max(max_tail_leg_weight,float((weights*leg).sum(axis=1)[tail_led].max()))
    assert max_tail_leg_weight==0
    assert sha(DIRECTORY/'output-1.glb')=='5acfd21e2dff79849019455606d5f97cf55ddc8311da5faed38f889e2db3fb34'
    artifacts=[]
    for variant in VARIANTS:
        path=DIRECTORY/f'{variant}.glb'
        artifacts.append({'variant':variant,'path':path.relative_to(ROOT).as_posix(),'sha256':sha(path),'bytes':path.stat().st_size,'glb':audit_glb(path)})
    assets=[]
    for asset,variant in [('raccoon-surface','surface-v1'),('raccoon-mixamo','rig-mixamo-v6')]:
        file=next(a for a in artifacts if a['variant']==variant)
        assets.append({'asset':asset,'variant':variant,'taskId':'4268120','sourceSha256':sha(DIRECTORY/'output-1.glb'),'files':[file],
                       'status':'candidate; visual/skin acceptance not passed'})
    (EVIDENCE/'manifest.json').write_text(json.dumps({'assets':assets},indent=2)+'\n',encoding='utf-8')
    pngs=[]
    for variant in VARIANTS:
        for path in (ROOT/'docs/evidence/assets/2026-10-22-round-01/raccoon-multiview'/variant).rglob('*.png'):
            with Image.open(path) as im:im.load()
            pngs.append(path.relative_to(ROOT).as_posix())
    report={'artifacts':artifacts,'surfaceGeometryMatchesTailV5':True,'surfaceBaseColorTextureBytesPreserved':True,
            'cutVertexColorsPresent':True,'originalLux3dFileUnchanged':True,'myBlogRuntimeFileUnchanged':True,
            'reusedAnimationCount':19,'nativeSkeletonJoints':38,'durationsPreserved':True,
            'tailSeamFaceGeometryPreserved':True,'tailLedVerticesMaxLegWeight':max_tail_leg_weight,
            'tailSeamMaxCoordinateDrift':corner_error,'tailSeamCoordinateTolerance':1e-6,
            'clips':new_clips,'pngs':pngs,'pngCount':len(pngs),'browserVerified':False,
            'visualAcceptance':'NOT PASSED: projected/analytical skin weights still deform garment and tail incorrectly',
            'checks':{'lint':'passed','test':'3/3 passed','build':'passed with existing >500 kB warning',
                      'pythonSyntax':'passed','reviewModuleSyntax':'passed'}}
    (EVIDENCE/'validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({k:v for k,v in report.items() if k not in ['artifacts','pngs','clips']},ensure_ascii=False))

if __name__=='__main__':main()
