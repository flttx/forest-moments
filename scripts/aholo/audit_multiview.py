"""Verify this raccoon regeneration and write a URL-free evidence manifest."""
import hashlib
import json
import zipfile
from audit import ROOT, audit_glb
from PIL import Image


def main():
    directory = ROOT / 'assets/lux3d/round-01/raccoon-multiview'
    evidence = ROOT / 'docs/evidence/assets/2026-10-22-raccoon-multiview'
    ledger = json.loads((directory / 'ledger.json').read_text(encoding='utf-8'))
    inputs = json.loads((evidence / 'inputs.json').read_text(encoding='utf-8'))['inputs']
    assert ledger['phase'] == 'succeeded' and ledger['operation'] == 'multi-image'
    assert len(inputs) == len(ledger['images']) == 4
    for entry, uploaded in zip(inputs, ledger['images']):
        source, copied = ROOT / entry['source'], ROOT / entry['path']
        assert copied.resolve() == type(copied)(uploaded['path']).resolve()
        assert hashlib.sha256(source.read_bytes()).hexdigest() == entry['sha256']
        assert hashlib.sha256(copied.read_bytes()).hexdigest() == uploaded['sha256'] == entry['sha256']
        with Image.open(copied) as image:
            image.load()
            assert list(image.size) == entry['size']
    files = []
    for entry in ledger['files']:
        path = directory / entry['filename']
        sha = hashlib.sha256(path.read_bytes()).hexdigest()
        assert sha == entry['sha256'] and path.stat().st_size == entry['bytes']
        record = {'path': path.relative_to(ROOT).as_posix(), 'sha256': sha, 'bytes': path.stat().st_size}
        if path.suffix == '.glb':
            record['glb'] = audit_glb(path)
        elif path.suffix == '.zip':
            with zipfile.ZipFile(path) as archive:
                assert archive.testzip() is None
                record['archiveEntries'] = len(archive.namelist())
        files.append(record)
    assert any('glb' in f for f in files) and any('archiveEntries' in f for f in files)
    record = {'asset': 'raccoon-multiview', 'taskId': ledger['taskId'], 'createdAt': ledger['createdAt'],
              'endpoint': ledger['baseUrl'], 'options': ledger['options'], 'inputs': inputs, 'files': files,
              'creditsConsumed': None, 'commercialLicense': 'not_verified', 'runtimeBrowserVerified': False}
    (evidence / 'manifest.json').write_text(json.dumps({'assets': [record]}, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'taskId': ledger['taskId'], 'inputHashesVerified': len(inputs), 'files': files}))


if __name__ == '__main__':
    main()
