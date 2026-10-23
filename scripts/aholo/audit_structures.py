"""Validate local structure artifacts and publish their separate review manifest."""
import hashlib
import io
import json
from pathlib import Path
from PIL import Image
from audit import ROOT, audit_glb
from audit_tail_repair import load

EVIDENCE = ROOT / 'docs/evidence/assets/2026-10-22-structures'
VARIANTS = {'workshop':'structure-v2','lookout':'structure-v3','canoe':'structure-v2'}
EXPECTED = {
    'workshop':'79f76e1283c72b6ee8239c66524325d61d12c812554e4823c0ce2db22a33fc14',
    'lookout':'183120006624644f71289fdd669631123558c96e8fad51548efa3f236545f38c',
    'canoe':'d76f1bf7b807e763cbd4b7c0fd42496253b4c9d66a9b25bcb2b1299165876d21'}

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def decoded_images(path):
    doc, binary = load(path)
    result = set()
    for entry in doc['images']:
        view = doc['bufferViews'][entry['bufferView']]
        start = view.get('byteOffset',0)
        with Image.open(io.BytesIO(binary[start:start+view['byteLength']])) as image:
            result.add((image.size, hashlib.sha256(image.convert('RGBA').tobytes()).hexdigest()))
    return result

def main():
    EVIDENCE.mkdir(parents=True,exist_ok=True)
    retained = ROOT / 'assets/lux3d/round-01/raccoon-multiview/rig-mixamo-v6.glb'
    assert sha(retained) == 'f35123a06d790a6802d20f278c4d2c23997ccf16c49dfd56923e6d8acf8a2a41'
    geometry = json.loads((EVIDENCE/'geometry-validation.json').read_text(encoding='utf-8'))
    assert len(geometry)==3 and all(r['retainedTriangleMultisetMatches'] for r in geometry)
    original_manifest = json.loads((ROOT/'docs/evidence/assets/2026-10-22-round-01/manifest.json').read_text(encoding='utf-8'))
    assets, pngs = [], []
    for asset, variant in VARIANTS.items():
        directory = ROOT/'assets/lux3d/round-01'/asset
        raw, output = directory/'output-1.glb', directory/(variant+'.glb')
        assert sha(raw)==EXPECTED[asset]
        source_images, output_images = decoded_images(raw), decoded_images(output)
        assert source_images <= output_images, f'Original decoded texture pixels changed: {asset}'
        file = {'path':output.relative_to(ROOT).as_posix(),'sha256':sha(output),'bytes':output.stat().st_size,'glb':audit_glb(output)}
        parent = next(a for a in original_manifest['assets'] if a['asset']==asset)
        assets.append({'asset':asset+'-structure','variant':variant,'taskId':parent['taskId'],
            'sourceSha256':sha(raw),'files':[file], 'status':'local structure improvement; runtime validation pending',
            'originalDecodedTexturesPreserved':True, 'commercialLicense':parent['commercialLicense']})
        for path in (ROOT/'docs/evidence/assets/2026-10-22-round-01'/asset).glob('structure-v*/*.png'):
            with Image.open(path) as image:
                image.load()
                assert image.size==(900,900)
            pngs.append(path.relative_to(ROOT).as_posix())
    (EVIDENCE/'manifest.json').write_text(json.dumps({'assets':assets},indent=2)+'\n',encoding='utf-8')
    record = {'assets':assets,'geometry':geometry,'raccoonV6Unchanged':True,
        'tailDecision':'User accepted current tail and requested moving on; no character edits in this round',
        'pngs':pngs,'pngCount':len(pngs),'browserVerified':False,'decimationApplied':False,'paidApiCalls':0,
        'limits':['No runtime collision/stair traversal test','Interior canoe fit and paddle grip alignment pending',
                  'Workshop door/workbench interaction parts not separated','Small original eave/cabin defects remain']}
    (EVIDENCE/'validation.json').write_text(json.dumps(record,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({'pngCount':len(pngs),'raccoonV6Unchanged':True,
        'assets':[{ 'asset':a['asset'],'variant':a['variant'],'triangles':a['files'][0]['glb']['triangles'],'bytes':a['files'][0]['bytes']} for a in assets]}))

if __name__=='__main__':
    main()
