"""Write a URL-free record of the X3 Lux3D runs (ledgers are git-ignored and may hold temporary URLs)."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
EVIDENCE = ROOT / 'docs/evidence/assets/2026-10-27-x3-lux3d'
rows = []
for run in sorted((ROOT / 'assets/lux3d').glob('x3-*')):
    state = json.loads((run / 'ledger.json').read_text(encoding='utf-8'))
    row = {'dir': run.relative_to(ROOT).as_posix(), 'phase': state.get('phase'), 'taskId': state.get('taskId'),
           'imageSha256': state.get('imageSha256'), 'faceCount': state.get('options', {}).get('faceCount'),
           'files': [{k: f.get(k) for k in ('filename', 'bytes', 'sha256')} for f in state.get('files', [])]}
    review = EVIDENCE / run.name.replace('-v1', '').replace('-r2', '') / 'review.json'
    if row['phase'] == 'succeeded' and review.exists():
        row['review'] = json.loads(review.read_text(encoding='utf-8'))
    rows.append(row)
record = {'date': '2026-10-27', 'service': 'Aholo Lux3D img-to-3d G1, China region API',
          'pricing': 'Balance/quote endpoint returned a server error, so no quote was recorded; the first-round bill showed 20 credits per generation.',
          'runs': rows}
(EVIDENCE / 'generation.json').write_text(json.dumps(record, indent=1, ensure_ascii=False) + '\n', encoding='utf-8')
print(*[f"{r['dir'].split('/')[-1]} {r['phase']} {r['taskId']}" for r in rows], sep='\n')
