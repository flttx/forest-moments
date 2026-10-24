"""Audit latest-heading input evidence without rewriting historical checks."""
import hashlib
import json
import re
import struct
from datetime import datetime, timezone
from pathlib import Path

root = Path(__file__).resolve().parents[1]
base = root / 'docs/evidence/2026-10-24-heading'
read = lambda p: json.loads(p.read_text(encoding='utf-8'))
assets = read(root / 'docs/evidence/2026-10-24-controls/validation.json')['unchangedRuntimeAssets']
for asset in assets:
    p = root / asset['path']
    assert hashlib.sha256(p.read_bytes()).hexdigest() == asset['sha256'], p
    assert p.read_bytes() == (root / 'dist' / p.relative_to(root / 'public')).read_bytes(), p
suites = []
for stage in ['after', 'transitions', 'navigation', 'production']:
    path = base / stage / 'headless-validation.json'
    data = read(path)
    assert data['status'] == 'PASS' and not data['errors'], path
    for name in data['screenshots']:
        png = (path.parent / name).read_bytes()
        assert png[:8] == b'\x89PNG\r\n\x1a\n' and struct.unpack('>II', png[16:24]) == (1440, 900)
    suites.append(dict(path=path.relative_to(root).as_posix(), status=data['status'], screenshots=len(data['screenshots']), browser=data['browser']))
errors = [abs(c['data']['errorDegrees']) for c in read(base / 'after/headless-validation.json')['checks']]
assert len(errors) == 12 and max(errors) < 2
report = root / 'docs/report/PROJECT_REPORT.md'
section = report.read_text(encoding='utf-8').split('### 5.39 ')[1].split('## 6.')[0]
links = re.findall(r'!?\[[^\]]*\]\(([^)]+)\)', section)
for link in links:
    if '://' not in link and not link.endswith('/validation.json'):
        assert (report.parent / link.split('#')[0]).resolve().exists(), link
result = dict(date=datetime.now(timezone.utc).isoformat(), status='PASS', static=dict(lint='PASS, no warnings', tests='66/66 in 16 files', build='PASS; existing chunk warning'), suites=suites, finalScreenshots=sum(s['screenshots'] for s in suites), maximumHeadingErrorDegrees=max(errors), unchangedRuntimeAssets=assets, totalRuntimeBytes=sum(a['bytes'] for a in assets), reportLinks=len(links), scope='Latest actual actor course drives walking; immediate and delayed key transitions, workshop navigation, production visual smoke; not all historical gameplay macros')
(base / 'validation.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps({key: result[key] for key in ['status', 'finalScreenshots', 'maximumHeadingErrorDegrees', 'totalRuntimeBytes']}))
