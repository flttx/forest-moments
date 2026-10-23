"""Copy selected local GLBs byte-for-byte into static runtime assets."""
import hashlib
import json
from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parents[2]
sources = {
    'raccoon': ('raccoon-multiview/rig-mixamo-v6.glb', 'f35123a06d790a6802d20f278c4d2c23997ccf16c49dfd56923e6d8acf8a2a41'),
    'workshop': ('workshop/structure-v2.glb', '8a105dc57f1314eb3fb975d26a04584a278277e7ac5ed3140cba71393aafb43d'),
    'lookout': ('lookout/structure-v3.glb', '7775967911e30b0090e0c14d91ade25d4f76e2187405c2b8d96d833250aba1b5'),
    'canoe': ('canoe/structure-v2.glb', '0adaf76fee4d01db337c7499760396fd9642159756b95551c092080fc9eb6ec9'),
}
target = ROOT / 'public/assets/models'
target.mkdir(parents=True, exist_ok=True)
records = []
for name, (relative, expected) in sources.items():
    source = ROOT / 'assets/lux3d/round-01' / relative
    assert hashlib.sha256(source.read_bytes()).hexdigest() == expected
    output = target / (name + '.glb')
    if output.exists():
        assert hashlib.sha256(output.read_bytes()).hexdigest() == expected, f'Preserve unexpected runtime file: {output}'
    else:
        shutil.copyfile(source, output)
    assert hashlib.sha256(output.read_bytes()).hexdigest() == expected
    records.append({'asset': name, 'source': source.relative_to(ROOT).as_posix(),
                    'runtime': output.relative_to(ROOT).as_posix(), 'sha256': expected, 'bytes': output.stat().st_size})
evidence = ROOT / 'docs/evidence/assets/2026-10-22-runtime-integration'
evidence.mkdir(parents=True, exist_ok=True)
(evidence / 'manifest.json').write_text(json.dumps({'assets': records, 'meshOrWeightsChanged': False,
    'paidApiCalls': 0, 'deployed': False}, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'assets': len(records), 'bytes': sum(r['bytes'] for r in records), 'byteIdentical': True}))
