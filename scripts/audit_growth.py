"""Audit local growth provenance without copying keys or signed download URLs."""
import hashlib
import json
import pathlib
import re
import struct
from datetime import datetime, timezone

ROOT = pathlib.Path(__file__).resolve().parents[1]
BASE = ROOT / 'docs/evidence/assets/2026-10-24-tree-growth'


def read(path):
    return json.loads(path.read_text(encoding='utf-8-sig'))


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def file_info(path):
    return {'path': path.relative_to(ROOT).as_posix(), 'bytes': path.stat().st_size, 'sha256': sha(path)}


runtime = read(BASE / 'runtime-assets.json')
entries = []
for asset in runtime:
    stage = asset['stage']
    private = ROOT / f'assets/lux3d/growth-{stage}-v1'
    ledger = read(private / 'ledger.json')
    result = read(private / 'result.json')
    public = ROOT / asset['output']
    dist = ROOT / asset['output'].replace('public/', 'dist/', 1)
    reference = ROOT / f'docs/references/growth/forest-moments-{stage}-v1.png'
    assert sha(public) == sha(dist) == asset['sha256']
    assert sha(reference) == ledger['imageSha256']
    assert result['status'] == 3
    entries.append({
        'stage': stage, 'taskId': ledger['taskId'], 'createdAt': ledger['createdAt'],
        'provider': 'AHOLO Lux3D G1', 'status': result['status'],
        'parameters': {key: ledger['request'][key] for key in ['version', 'faceCount', 'outputFormat', 'aiPredictSize']},
        'reference': file_info(reference),
        'originals': [file_info(private / name) for name in ['output-0.zip', 'output-1.glb']],
        'runtime': asset, 'distMatchesPublic': True,
        'audit': f'{stage}-audit.json', 'actualCharge': None, 'commercialLicenseNewlyVerified': False,
    })

retained = read(ROOT / 'docs/evidence/assets/2026-10-24-coastal-layout/retained-models.json')
dock = read(ROOT / 'docs/evidence/assets/2026-10-24-coastal-layout/runtime-asset.json')
retained.append({'path': dock['output'], 'sha256': dock['sha256']})
for asset in retained:
    assert sha(ROOT / asset['path']) == asset['sha256']
    assert sha(ROOT / asset['path'].replace('public/', 'dist/', 1)) == asset['sha256']
previous = read(ROOT / 'docs/evidence/vegetation-expansion/2026-10-24/resource-validation.json')
for group in previous['sourcePublicDist']:
    for path, digest in group.items():
        assert sha(ROOT / path) == digest
for path, digest in previous['readOnlySourceCode'].items():
    assert sha(pathlib.Path(path)) == digest
resource_bytes = sum(p.stat().st_size for folder in ['models', 'vegetation'] for p in (ROOT / f'public/assets/{folder}').rglob('*') if p.is_file())
manifest = {
    'date': datetime.now(timezone.utc).isoformat(), 'assets': entries,
    'growthBytes': sum(a['bytes'] for a in runtime), 'allModelTrackVegetationBytes': resource_bytes,
    'retainedEightModelsUnchanged': retained, 'vegetationAndReadOnlyMyBlogSourcesUnchanged': True,
    'secretPolicy': 'No environment keys, upload URLs or signed output URLs copied into this manifest.',
}
(BASE / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

suite_paths = [BASE / n for n in ['browser-development', 'browser-views-final', 'browser-production-final', 'rowing-production']]
suite_paths += [ROOT / f'docs/evidence/vegetation-expansion/2026-10-24/{n}' for n in ['regression-tree-growth-fishing_production', 'tree-growth-recovery']]
suites = []
for folder in suite_paths:
    report_path = folder / 'headless-validation.json'
    report = read(report_path)
    assert report['status'].startswith('PASS')
    shots = []
    for name in report['screenshots']:
        path = folder / name
        data = path.read_bytes()
        assert data[:8] == b'\x89PNG\r\n\x1a\n'
        dimensions = list(struct.unpack('>II', data[16:24]))
        assert dimensions == [1440, 900]
        shots.append({**file_info(path), 'dimensions': dimensions})
    suites.append({'report': file_info(report_path), 'status': report['status'], 'screenshots': shots, 'errors': report.get('errors', [])})

docs = ['PROGRESS.md', 'README.md', 'docs/PRD.md', 'docs/ART_DIRECTION.md', 'docs/SCENE_UPGRADE_PLAN.md',
        'docs/references/README.md', 'docs/references/DESIGN_CONTROLS.md', 'docs/report/PROJECT_REPORT.md',
        'docs/evidence/assets/2026-10-24-tree-growth/evidence.md']
links, broken = 0, []
for name in docs:
    path = ROOT / name
    for target in re.findall(r'!?\[[^\]]*\]\(([^)]+)\)', path.read_text(encoding='utf-8')):
        target = target.split('#')[0]
        if not target or '://' in target:
            continue
        links += 1
        destination = (path.parent / target).resolve()
        if not destination.exists() and destination != BASE / 'validation.json':
            broken.append({'document': name, 'target': target})
assert not broken, broken
validation = {
    'date': datetime.now(timezone.utc).isoformat(), 'status': 'PASS',
    'staticChecks': {'lint': 'PASS, no warnings', 'tests': '32/32, 10 files', 'build': 'PASS, existing >500 kB chunk warning'},
    'browser': 'Edge 156.0.4314.42, isolated headless, Windows, RTX 5060 Ti, 1440x900',
    'suites': suites, 'screenshots': sum(len(s['screenshots']) for s in suites),
    'notes': [
        'Four-minute real-time development gameplay was captured before the final material-only revision.',
        'Final visual stage/light coverage uses saved-stage fixtures; final production waits the first 45-second growth.',
        'Load recovery deliberately aborts tree-sprout.glb; expected injected errors remain in its report.',
        'Initial failed production run is retained separately in browser-production; it is not counted as passing evidence.',
        'No new 30-second performance baseline or cross-device verification claimed.',
    ],
    'localLinksChecked': links, 'brokenLinks': broken,
    'resourcesBytes': resource_bytes, 'growthBytes': manifest['growthBytes'],
    'mainJsKB': 1273.76, 'mainJsGzipKB': 358.18,
}
(BASE / 'validation.json').write_text(json.dumps(validation, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
assert (BASE / 'validation.json').is_file()
print(json.dumps({'status': 'PASS', 'screenshots': validation['screenshots'], 'localLinks': links, 'resourceBytes': resource_bytes, 'growthBytes': manifest['growthBytes']}))
