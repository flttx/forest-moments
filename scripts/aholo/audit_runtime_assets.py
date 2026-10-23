"""Verify source/runtime/build identity and decode evidence without changing assets."""
import hashlib
import json
from pathlib import Path
import struct
from PIL import Image
from audit import audit_glb

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'docs/evidence/assets/2026-10-22-runtime-integration'
manifest = json.loads((OUT / 'manifest.json').read_text(encoding='utf-8'))
assets = []
for entry in manifest['assets']:
    runtime = ROOT / entry['runtime']
    paths = [ROOT / entry['source'], runtime, ROOT / 'dist/assets/models' / runtime.name]
    assert all(hashlib.sha256(p.read_bytes()).hexdigest() == entry['sha256'] for p in paths)
    data = audit_glb(runtime)
    if entry['asset'] == 'raccoon':
        raw = runtime.read_bytes()
        doc = json.loads(raw[20:20 + struct.unpack_from('<I', raw, 12)[0]])
        clips = [a['name'] for a in doc['animations']]
        assert len(clips) == 19 and all(c in clips for c in ['idle', 'walk', 'run', 'paddle'])
        data['clips'] = clips
    assets.append({'asset': entry['asset'], 'sha256': entry['sha256'], 'sourceRuntimeDistIdentical': True, **data})
images = []
for path in sorted(OUT.rglob('*.png')):
    with Image.open(path) as image:
        image.load()
        images.append({'file': path.relative_to(OUT).as_posix(), 'size': list(image.size), 'sha256': hashlib.sha256(path.read_bytes()).hexdigest()})
assert not any((ROOT/'dist').rglob('*.blend'))
assert len(list((ROOT/'dist/assets/models').glob('*.glb'))) == 4
record = {'assets': assets, 'images': images, 'bytes': sum(a['bytes'] for a in manifest['assets']),
          'sourceMeshWeightsClipsModified': False, 'paidCalls': 0, 'deployed': False}
(OUT/'asset-validation.json').write_text(json.dumps(record, indent=2)+'\n', encoding='utf-8')
print(json.dumps({'assets':len(assets), 'decodedImages':len(images), 'bytes':record['bytes'], 'sourceRuntimeDistIdentical':True}))
