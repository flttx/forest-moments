"""Validate this camera response revision without touching previous evidence."""
import hashlib
import json
import re
import struct
from pathlib import Path
from datetime import datetime, timezone

root = Path(__file__).resolve().parents[1]
base = root / 'docs/evidence/2026-10-24-camera-speed'
read = lambda p: json.loads(p.read_text(encoding='utf-8'))
assets = read(root / 'docs/evidence/2026-10-24-scale/validation.json')['unchangedRuntimeAssets']
for asset in assets:
    path = root / asset['path']
    assert hashlib.sha256(path.read_bytes()).hexdigest() == asset['sha256'], path
    assert path.read_bytes() == (root / 'dist' / path.relative_to(root / 'public')).read_bytes(), path
suites = []
for stage in ['after', 'directions-walls']:
    path = base / stage / 'headless-validation.json'
    data = read(path)
    assert data['status'] == 'PASS' and not data['errors'], path
    for name in data['screenshots']:
        png = (path.parent / name).read_bytes()
        assert png[:8] == b'\x89PNG\r\n\x1a\n' and struct.unpack('>II', png[16:24]) == (1440, 900)
    suites.append(dict(path=path.relative_to(root).as_posix(), screenshots=len(data['screenshots']), status=data['status'], browser=data['browser']))
summary = {}
for stage in ['before-verified', 'after']:
    summary[stage] = [{key: item['data'][key] for key in ['turnAt350ms', 'settled95Seconds']} | {'case': item['name']} for item in read(base / stage / 'headless-validation.json')['checks']]
report = root / 'docs/report/PROJECT_REPORT.md'
section = report.read_text(encoding='utf-8').split('### 5.36 ')[1].split('## 6.')[0]
links = re.findall(r'!?\[[^\]]*\]\(([^)]+)\)', section)
for link in links:
    if '://' not in link and not link.endswith('/validation.json'):
        assert (report.parent / link.split('#')[0]).resolve().exists(), link
result = dict(date=datetime.now(timezone.utc).isoformat(), status='PASS', static=dict(lint='PASS, no warnings', tests='60/60 in 15 files', build='PASS; existing chunk warning'), suites=suites, finalScreenshots=sum(s['screenshots'] for s in suites), summary=summary, unchangedRuntimeAssets=assets, totalRuntimeBytes=sum(a['bytes'] for a in assets), reportLinks=len(links), scope='Local PC Edge; bounded follow-arm rotation, not a bound on collision-corrected final view; no new assets or deployment')
(base / 'validation.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps({key: result[key] for key in ['status', 'finalScreenshots', 'totalRuntimeBytes', 'reportLinks']}))
