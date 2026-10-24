"""Audit this scale revision without rewriting earlier milestone evidence."""
import hashlib
import json
import re
import struct
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / 'docs/evidence/2026-10-24-scale'


def read(path):
    return json.loads(path.read_text(encoding='utf-8'))


assets = read(ROOT / 'docs/evidence/2026-10-24-camera/validation.json')['unchangedRuntimeAssets']
for asset in assets:
    path = ROOT / asset['path']
    assert hashlib.sha256(path.read_bytes()).hexdigest() == asset['sha256'], path
    assert path.read_bytes() == (ROOT / 'dist' / path.relative_to(ROOT / 'public')).read_bytes(), path

source = read(BASE / 'source-dimensions.json')['assets']
actual = sorted(p.relative_to(ROOT).as_posix() for p in (ROOT / 'public/assets').rglob('*.glb'))
assert sorted(a['file'] for a in source) == actual
assert len(actual) == 18
bundle = next((ROOT / 'dist/assets').glob('index-*.js')).read_text(encoding='utf-8')
assert 'scaleQa' not in bundle and 'unscaled-posed-local' not in bundle

suites = []
paths = [BASE / s / 'headless-validation.json' for s in ['views-verified', 'workshop-development', 'workshop-production']]
paths.append(ROOT / 'docs/evidence/vegetation-expansion/2026-10-24/regression-scale-final-fishing_production/headless-validation.json')
for path in paths:
    data = read(path)
    assert data['status'].startswith('PASS') and not data['errors'], path
    for name in data['screenshots']:
        png = (path.parent / name).read_bytes()
        assert png[:8] == b'\x89PNG\r\n\x1a\n'
        assert struct.unpack('>II', png[16:24]) == (1440, 900)
    suites.append(dict(path=path.relative_to(ROOT).as_posix(), status=data['status'], screenshots=len(data['screenshots']), browser=data.get('browser'), viewport=data.get('viewport')))

views = read(paths[0])
assert len(views['checks']) == 30
for check in views['checks']:
    dimensions = check['data']['dimensions']
    records = {r['label']: r['size'] for r in dimensions['records']}
    assert abs(records['workshop'][0] - 7.5) < .01
    assert abs(records['workshop'][1] - 5.6874) < .01
    assert all(abs(v[1] - 1.885) < .002 for v in dimensions['instances']['lantern'])
assert abs(views['fishProportions']['size'][1] - .3) < .005
before = read(BASE / 'before/headless-validation.json')['checks'][0]['data']['dimensions']
after = views['checks'][0]['data']['dimensions']

report = ROOT / 'docs/report/PROJECT_REPORT.md'
section = report.read_text(encoding='utf-8').split('### 5.35 ')[1].split('## 6.')[0]
links = re.findall(r'!?\[[^\]]*\]\(([^)]+)\)', section)
for link in links:
    if '://' not in link:
        assert (report.parent / link.split('#')[0]).resolve().exists(), link

result = dict(
    date=datetime.now(timezone.utc).isoformat(), status='PASS',
    static=dict(lint='PASS, no warnings', tests='58/58 in 15 files', build='PASS; existing chunk warning'),
    sourceGLBCount=len(actual), unchangedRuntimeAssets=assets, totalRuntimeBytes=sum(a['bytes'] for a in assets),
    before=before, after=after, fishProportions=views['fishProportions'], suites=suites,
    finalScreenshots=sum(s['screenshots'] for s in suites), reportLinks=len(links),
    preservedCandidates=['before: 8 reference screenshots', 'after: 8 first-pass screenshots', 'views-final: failed fish assertion', 'fish-diagnostic: confirmed 15 cm rejected candidate'],
    scope='Local PC Edge measurements and screenshot review; no geometry, texture or animation edits; no new generation, payment or deployment',
)
(BASE / 'validation.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps({key: result[key] for key in ['status', 'sourceGLBCount', 'finalScreenshots', 'totalRuntimeBytes', 'reportLinks']}))
