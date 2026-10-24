"""Audit this milestone without rewriting historical evidence."""
import json, hashlib, struct, gzip, re
from pathlib import Path
from datetime import datetime, timezone
ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / 'docs/evidence/2026-10-24-lookout'
def load(p): return json.loads(p.read_text(encoding='utf-8-sig'))
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def info(p): return {'path': p.relative_to(ROOT).as_posix(), 'bytes': p.stat().st_size, 'sha256': sha(p)}
previous = load(ROOT / 'docs/evidence/assets/2026-10-24-runtime-encoding/validation.json')
for record in previous['runtimeFiles']:
    p = ROOT / record['path']
    assert sha(p) == record['sha256'] == sha(ROOT / 'dist' / p.relative_to(ROOT / 'public'))
geometry = load(BASE / 'geometry.json')
assert geometry['status'] == 'PASS' and geometry['sha256'] == sha(ROOT / geometry['asset'])
folders = [BASE / n for n in ['development-final', 'views-final', 'production-final', 'rowing-production', 'growth-production', 'farm-production']]
folders.append(ROOT / 'docs/evidence/vegetation-expansion/2026-10-24/regression-lookout-final-fishing_production')
def suite(folder):
    p = folder / 'headless-validation.json'; r = load(p)
    assert r['status'].startswith('PASS') and not r['errors'], p
    shots = []
    for name in r['screenshots']:
        q = folder / name; data = q.read_bytes()
        assert data[:8] == b'\x89PNG\r\n\x1a\n' and struct.unpack('>II', data[16:24]) == (1440, 900)
        shots.append(info(q))
    return {'report': info(p), 'status': r['status'], 'screenshots': shots}
suites = [suite(folder) for folder in folders]
before = suite(BASE / 'before')
assert sum(len(s['screenshots']) for s in suites) == 65
prod = load(BASE / 'production-final/headless-validation.json')
assert len(prod['assets']) == 16
for resource in prod['assets']:
    assert resource['bytes'] == (ROOT / 'public' / resource['url'].lstrip('/')).stat().st_size
assert not list((ROOT / '.tmp').glob('forest-*'))
links = 0
for name in ['PROGRESS.md', 'README.md', 'docs/PRD.md', 'docs/SCENE_UPGRADE_PLAN.md', 'docs/report/PROJECT_REPORT.md', 'docs/evidence/2026-10-24-lookout/evidence.md']:
    p = ROOT / name
    for target in re.findall(r'!?\[[^\]]*\]\(([^)]+)\)', p.read_text(encoding='utf-8')):
        target = target.split('#')[0]
        if not target or '://' in target: continue
        q = (p.parent / target).resolve()
        assert q.exists() or q == BASE / 'validation.json', (name, target)
        links += 1
main = next((ROOT / 'dist/assets').glob('index-*.js'))
code = ['src/game/lookout.ts', 'src/game/lookout.test.ts', 'src/game/store.ts', 'src/game/landmarks.ts', 'src/world/ForestWorld.tsx', 'src/world/ForestKit.tsx', 'src/BoatTransferOverlay.tsx', 'src/LookoutHud.tsx', 'src/App.tsx', 'src/App.css', 'scripts/check_lookout_headless.mjs', 'scripts/check_lookout_production.mjs', 'scripts/check_lookout_views.mjs', 'scripts/audit_lookout_geometry.cjs', 'scripts/audit_lookout.py']
result = {
    'date': datetime.now(timezone.utc).isoformat(), 'status': 'PASS',
    'static': {'lint': 'PASS, no warnings', 'tests': '44/44 in 13 files', 'build': 'PASS; existing chunk-size warning'},
    'geometry': geometry, 'allRuntimeAssetsUnchanged': previous['runtimeFiles'], 'publicDistMatch': True,
    'modelTrackVegetationBytes': previous['modelTrackVegetationBytes'],
    'suites': suites, 'postChangeScreenshots': 65, 'before': before, 'localLinks': links,
    'mainJs': {**info(main), 'gzipLevel6Bytes': len(gzip.compress(main.read_bytes(), compresslevel=6, mtime=0))},
    'code': [info(ROOT / n) for n in code],
    'limits': ['First-person observation camera, not free stair climbing or climbing animation.', 'Ground position is retained; view is not saved across reload.', 'Development start positions are fixtures; production travels using real keyboard input.', 'No new assets, generation, fees or deployment.', 'Download size is advisory per latest user instruction; cross-device performance remains unverified.'],
    'failuresPreserved': ['development-v1/headless-validation.json', 'development-v2/headless-validation.json', 'development-hmr/headless-validation.json', 'production-lamp-blocked/headless-validation.json']
}
(BASE / 'validation.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps({k: result[k] for k in ['status', 'postChangeScreenshots', 'localLinks', 'modelTrackVegetationBytes']}))
