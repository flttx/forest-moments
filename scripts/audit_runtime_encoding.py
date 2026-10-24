"""Current runtime integrity audit; historical milestone baselines stay unchanged."""
import json, hashlib, struct, gzip, re
from pathlib import Path
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / 'docs/evidence/assets/2026-10-24-runtime-encoding'
def load(p): return json.loads(p.read_text(encoding='utf-8-sig'))
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def info(p): return {'path': p.relative_to(ROOT).as_posix(), 'bytes': p.stat().st_size, 'sha256': sha(p)}

encoding = load(BASE / 'encoding.json')
previous = load(ROOT / 'docs/evidence/assets/2026-10-24-farm/validation.json')
baseline = {p['path']: p['sha256'] for p in previous['retainedTwelveModelsUnchanged']}
baseline.update({p['output']: p['sha256'] for p in previous['assets']})
replaced = set()
for record in encoding:
    original = ROOT / record['original']
    oldpath = 'public/assets/models/' + original.name
    assert sha(original) == record['originalSha256'] == baseline[oldpath]
    candidate = ROOT / record['target']
    runtime = ROOT / 'public/assets/models' / candidate.name
    assert sha(candidate) == sha(runtime) == record['sha256']
    assert record['losslessSemantic'] and record['visiblePixelsExact']
    assert not any(record[k] for k in ['decimated', 'quantized', 'textureResized'])
    replaced.add(oldpath)
unchanged = []
for name, expected in baseline.items():
    if name not in replaced:
        assert sha(ROOT / name) == expected
        unchanged.append(info(ROOT / name))
assert len(unchanged) == 10
assert not (ROOT / 'public/assets/models/canoe.glb').exists()
assert not (ROOT / 'dist/assets/models/canoe.glb').exists()
runtime_files = []
for folder in ['models', 'vegetation']:
    for p in (ROOT / f'public/assets/{folder}').rglob('*'):
        if p.is_file():
            assert sha(p) == sha(ROOT / 'dist' / p.relative_to(ROOT / 'public'))
            runtime_files.append(info(p))

folders = [BASE / 'after', ROOT / 'docs/evidence/rowing-polish/2026-10-24/runtime-encoding']
folders += [BASE / n for n in ['rowing-production', 'growth-production', 'farm-production']]
folders += [ROOT / 'docs/evidence/vegetation-expansion/2026-10-24/regression-runtime-encoding-fishing_production', BASE / 'paddle-recovery']
def suite(folder):
    p = folder / 'headless-validation.json'
    report = load(p)
    assert report['status'].startswith('PASS') and not report['errors'], p
    screenshots = []
    for name in report['screenshots']:
        q = folder / name
        data = q.read_bytes()
        assert data[:8] == b'\x89PNG\r\n\x1a\n'
        assert struct.unpack('>II', data[16:24]) == (1440, 900)
        screenshots.append(info(q))
    return {'report': info(p), 'status': report['status'], 'screenshots': screenshots}
suites = [suite(folder) for folder in folders]
before = suite(BASE / 'before')
network = load(BASE / 'rowing-production/headless-validation.json')['assets']
assert len(network) == 16
for record in network:
    assert record['bytes'] == (ROOT / 'public' / record['url'].lstrip('/')).stat().st_size
assert not any(a['url'].endswith('/canoe.glb') for a in network)
assert next(a['bytes'] for a in network if a['url'].endswith('/paddle.glb')) == 9536
assert not list((ROOT / '.tmp').glob('forest-*')), 'Browser profiles must be cleaned after serial QA'
links = 0
for name in ['PROGRESS.md', 'README.md', 'docs/PRD.md', 'docs/SCENE_UPGRADE_PLAN.md', 'docs/report/PROJECT_REPORT.md', 'docs/evidence/assets/2026-10-24-runtime-encoding/evidence.md']:
    p = ROOT / name
    for target in re.findall(r'!?\[[^\]]*\]\(([^)]+)\)', p.read_text(encoding='utf-8')):
        target = target.split('#')[0]
        if not target or '://' in target: continue
        q = (p.parent / target).resolve()
        assert q.exists() or q == BASE / 'validation.json', (name, target)
        links += 1
main = next((ROOT / 'dist/assets').glob('index-*.js'))
total = sum(p['bytes'] for p in runtime_files)
assert total == 54339033
code = ['scripts/encode_runtime.cjs', 'scripts/audit_runtime_encoding.py', 'scripts/check_encoding_views.mjs', 'scripts/check_encoding_recovery.mjs', 'scripts/check_coastal_production.mjs', 'scripts/check_farm_production.mjs', 'scripts/aholo/review.mjs', 'scripts/aholo/paddle-review.mjs', 'src/world/RowingBoat.tsx', 'src/world/assets.ts']
result = {
    'date': datetime.now(timezone.utc).isoformat(), 'status': 'PASS',
    'static': {'lint': 'PASS, no warnings', 'tests': '40/40 in 12 files', 'build': 'PASS; existing chunk-size warning'},
    'encoding': encoding, 'unchangedTenModels': unchanged, 'publicDistMatch': True,
    'runtimeFiles': runtime_files, 'productionModelTrackRequests': network,
    'previousModelTrackVegetationBytes': previous['modelTrackVegetationBytes'],
    'modelTrackVegetationBytes': total,
    'savedBytes': previous['modelTrackVegetationBytes'] - total,
    'suites': suites, 'postChangeScreenshots': sum(len(s['screenshots']) for s in suites),
    'before': before, 'localLinks': links,
    'failuresPreserved': ['serialization-v1-failure.json', 'farm-production-blocked/headless-validation.json'],
    'mainJs': {**info(main), 'gzipLevel6Bytes': len(gzip.compress(main.read_bytes(), compresslevel=6, mtime=0))},
    'code': [info(ROOT / n) for n in code],
    'limits': ['Download bytes reduced; geometry and GPU workload are not reduced.', 'Still exceeds 25 MiB full-download target.', 'No new model generation, fees, deployment or license claim.', 'Local encoding tool depends on existing my-blog dependencies and archived original GLBs.', 'Injected recovery errors are recorded separately from unexpected errors.']
}
(BASE / 'validation.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps({k: result[k] for k in ['status', 'postChangeScreenshots', 'localLinks', 'modelTrackVegetationBytes', 'savedBytes']}))
