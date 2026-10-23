"""Make a reversible raccoon material trial, preserving every binary byte."""
import copy
import hashlib
import json
from pathlib import Path
import struct

ROOT = Path(__file__).resolve().parents[2]
source = ROOT / 'assets/lux3d/round-01/raccoon/output-1.glb'
raw = source.read_bytes()
assert struct.unpack_from('<4sII', raw) == (b'glTF', 2, len(raw))
size, kind = struct.unpack_from('<II', raw, 12)
assert kind == 0x4E4F534A
document = json.loads(raw[20:20+size])
original = copy.deepcopy(document)
binary_chunks = raw[20+size:]
assert len(document['materials']) == 1
pbr = document['materials'][0]['pbrMetallicRoughness']
pbr.pop('metallicRoughnessTexture', None)
pbr['metallicFactor'] = 0.0
pbr['roughnessFactor'] = 0.68
encoded = json.dumps(document, separators=(',', ':')).encode('utf-8')
encoded += b' ' * (-len(encoded) % 4)
output = source.with_name('material-v1.glb')
output.write_bytes(struct.pack('<4sII', b'glTF', 2, 20+len(encoded)+len(binary_chunks))
                   + struct.pack('<II', len(encoded), kind) + encoded + binary_chunks)
# Geometry, UVs, normals, and embedded texture payloads are byte-identical.
assert output.read_bytes()[20+len(encoded):] == binary_chunks
assert {k:v for k,v in document.items() if k != 'materials'} == {
    k:v for k,v in original.items() if k != 'materials'}
record = {'asset':'raccoon', 'variant':'material-v1', 'status':'material-trial-not-runtime-approved',
          'sourceSha256':hashlib.sha256(raw).hexdigest(),
          'outputSha256':hashlib.sha256(output.read_bytes()).hexdigest(),
          'outputBytes':output.stat().st_size,
          'binaryChunksSha256':hashlib.sha256(binary_chunks).hexdigest(),
          'binaryChunksIdentical':True, 'geometryModified':False,
          'materialBefore':original['materials'], 'materialAfter':document['materials'],
          'note':'Uniform roughness trial; existing packed texture remains embedded but unused. No texture compression.',
          'runtimeBrowserVerified':False}
evidence = ROOT / 'docs/evidence/assets/2026-10-22-round-01/raccoon/material-v1'
evidence.mkdir(parents=True, exist_ok=True)
(evidence/'material-change.json').write_text(json.dumps(record,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('Material trial written; binary chunks unchanged.')
