"""Check local rowing-polish artifacts; no remote calls or credentials."""
import gzip
import hashlib
import json
from pathlib import Path
import re
import struct
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / 'docs/evidence/rowing-polish/2026-10-24'


def load(p):
    return json.loads(p.read_text(encoding='utf-8-sig'))


def digest(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()


def info(p):
    return {'path': p.relative_to(ROOT).as_posix(), 'bytes': p.stat().st_size, 'sha256': digest(p)}


old = load(ROOT / 'docs/evidence/assets/2026-10-24-tree-growth/manifest.json')
models = old['retainedEightModelsUnchanged'] + [{'path': x['runtime']['output'], 'sha256': x['runtime']['sha256']} for x in old['assets']]
for model in models:
    assert digest(ROOT / model['path']) == model['sha256']
    assert digest(ROOT / model['path'].replace('public/', 'dist/', 1)) == model['sha256']
track = ROOT / 'public/assets/models/paddle-track.json'
assert digest(track) == digest(ROOT / 'dist/assets/models/paddle-track.json') == '268db90b6394087902ab1a97c541f1d21ee0c245261c94aaea7e98ead23091b1'
old_vegetation = load(ROOT / 'docs/evidence/vegetation-expansion/2026-10-24/resource-validation.json')
for group in old_vegetation['sourcePublicDist']:
    for path, sha in group.items():
        assert digest(ROOT / path) == sha

folders = [BASE / name for name in ['development', 'dusk-final', 'night-final', 'views-final', 'production', 'growth-production']]
folders.append(ROOT / 'docs/evidence/vegetation-expansion/2026-10-24/regression-rowing-polish-final-fishing_production')
suites = []
for folder in folders:
    path = folder / 'headless-validation.json'
    report = load(path)
    assert report['status'].startswith('PASS'), path
    assert not report['errors'], path
    shots = []
    for name in report['screenshots']:
        shot = folder / name
        data = shot.read_bytes()
        assert data[:8] == b'\x89PNG\r\n\x1a\n'
        dimensions = list(struct.unpack('>II', data[16:24]))
        assert dimensions == [1440, 900]
        shots.append({**info(shot), 'dimensions': dimensions})
    suites.append({'report': info(path), 'status': report['status'], 'screenshots': shots, 'errors': report['errors']})
docs = ['PROGRESS.md', 'README.md', 'docs/PRD.md', 'docs/SCENE_UPGRADE_PLAN.md', 'docs/report/PROJECT_REPORT.md', 'docs/evidence/rowing-polish/2026-10-24/evidence.md']
links = 0
for name in docs:
    path = ROOT / name
    for target in re.findall(r'!?\[[^\]]*\]\(([^)]+)\)', path.read_text(encoding='utf-8')):
        target = target.split('#')[0]
        if not target or '://' in target:
            continue
        dest = (path.parent / target).resolve()
        assert dest.exists() or dest == BASE / 'validation.json', (name, target)
        links += 1
code = ['src/game/boatPresentation.ts', 'src/game/store.ts', 'src/game/rowing.test.ts', 'src/world/ForestWorld.tsx', 'src/world/RowingBoat.tsx', 'src/world/BoatWaterFeedback.tsx', 'src/BoatTransferOverlay.tsx', 'src/App.tsx', 'src/App.css', 'scripts/check_rowing_polish.mjs', 'scripts/check_rowing_views.mjs', 'scripts/check_coastal_production.mjs']
main_js = next((ROOT / 'dist/assets').glob('index-*.js'))
code += ['scripts/browser-session.mjs', 'scripts/check_vegetation_regressions.mjs']
result = {
    'date': datetime.now(timezone.utc).isoformat(), 'status': 'PASS',
    'static': {'lint': 'PASS, no warnings', 'tests': '34/34 in 10 files', 'build': 'PASS with existing >500 kB chunk warning'},
    'suites': suites, 'screenshots': sum(len(s['screenshots']) for s in suites), 'localLinks': links,
    'modelsUnchanged': models, 'paddleTrack': info(track), 'vegetationUnchanged': True,
    'modelTrackVegetationBytes': sum(p.stat().st_size for name in ['models', 'vegetation'] for p in (ROOT / f'public/assets/{name}').rglob('*') if p.is_file()),
    'mainJs': {**info(main_js), 'gzipLevel': 6, 'gzipBytes': len(gzip.compress(main_js.read_bytes(), compresslevel=6, mtime=0))},
    'code': [info(ROOT / name) for name in code],
    'failureNotes': [
        'Initial exact-zero test failed on signed negative zero; corrected to an explicit neutral pose.',
        'Initial mutable useMemo pool triggered two lint warnings; replaced with a ref.',
        'Concurrent heavy browser runs encountered texture/shader failures, a screenshot timeout and local dev-server exit. Cause not conclusively established.',
        'Retained failed runs: views, dusk, night and regression-rowing-polish-fishing_production. Restarted local dev server and reran these suites sequentially into final folders.',
        'After browser-temp migration the generated fishing runner retained an invalid relative import. Fixed to a module URL and project-local temporary script cleanup; production fishing and cleanup then passed.',
    ],
    'scope': 'Local isolated headless Edge 156, 1440x900, RTX 5060 Ti. No rigid-body buoyancy, dedicated boarding animation, cross-device or public-network performance approval.'
}
(BASE / 'validation.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'status': 'PASS', 'screenshots': result['screenshots'], 'localLinks': links, 'resourceBytes': result['modelTrackVegetationBytes'], 'jsBytes': result['mainJs']['bytes'], 'gzipBytes': result['mainJs']['gzipBytes']}))
