"""Audit downloaded first-round GLBs/ZIPs; export a URL-free evidence manifest."""
import hashlib
import io
import json
from pathlib import Path
import struct
import zipfile

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
ROUND = ROOT / 'assets/lux3d/round-01'
EVIDENCE = ROOT / 'docs/evidence/assets/2026-10-22-round-01'


def audit_glb(path):
    raw = path.read_bytes()
    magic, version, length = struct.unpack_from('<4sII', raw)
    assert magic == b'glTF' and version == 2 and length == len(raw)
    offset, chunks = 12, {}
    while offset < length:
        size, kind = struct.unpack_from('<II', raw, offset)
        assert offset + 8 + size <= length
        chunks[kind] = raw[offset + 8:offset + 8 + size]
        offset += 8 + size
    assert offset == length
    doc = json.loads(chunks[0x4E4F534A])
    binary = chunks.get(0x004E4942, b'')
    assert all('uri' not in b for b in doc.get('buffers', [])), 'External buffer'
    for buffer in doc.get('buffers', []):
        assert buffer['byteLength'] <= len(binary)
    for view in doc.get('bufferViews', []):
        assert view.get('byteOffset', 0) + view['byteLength'] <= len(binary)
    triangles, vertices = 0, 0
    for mesh in doc.get('meshes', []):
        for prim in mesh['primitives']:
            assert prim.get('mode', 4) == 4, 'Non-triangle primitive'
            positions = doc['accessors'][prim['attributes']['POSITION']]
            vertices += positions['count']
            count = doc['accessors'][prim['indices']]['count'] if 'indices' in prim else positions['count']
            assert count % 3 == 0
            triangles += count // 3
    images = []
    for entry in doc.get('images', []):
        assert 'bufferView' in entry, 'External texture'
        view = doc['bufferViews'][entry['bufferView']]
        start = view.get('byteOffset', 0)
        image_bytes = binary[start:start + view['byteLength']]
        with Image.open(io.BytesIO(image_bytes)) as image:
            image.load()
            images.append({'width': image.width, 'height': image.height, 'format': image.format, 'bytes': len(image_bytes)})
    return {'version': version, 'meshes': len(doc.get('meshes', [])), 'vertices': vertices,
            'triangles': triangles, 'materials': len(doc.get('materials', [])),
            'skins': len(doc.get('skins', [])), 'animations': len(doc.get('animations', [])),
            'textures': images, 'extensionsRequired': doc.get('extensionsRequired', [])}


def main():
    assets = []
    for asset in ['raccoon', 'workshop', 'lookout', 'canoe']:
        directory = ROUND / asset
        ledger = json.loads((directory / 'ledger.json').read_text(encoding='utf-8'))
        assert ledger['phase'] == 'succeeded' and ledger['files'], f'{asset} incomplete'
        input_path = ROUND / 'inputs' / f'{asset}.png'
        assert hashlib.sha256(input_path.read_bytes()).hexdigest() == ledger['imageSha256']
        with Image.open(input_path) as image:
            image.load()
            input_size = [image.width, image.height]
        files = []
        for entry in ledger['files']:
            path = directory / entry['filename']
            sha = hashlib.sha256(path.read_bytes()).hexdigest()
            assert sha == entry['sha256'] and path.stat().st_size == entry['bytes']
            record = {**entry, 'path': path.relative_to(ROOT).as_posix()}
            if path.suffix == '.glb':
                record['glb'] = audit_glb(path)
            elif path.suffix == '.zip':
                with zipfile.ZipFile(path) as archive:
                    assert archive.testzip() is None
                    record['archiveEntries'] = len(archive.namelist())
            files.append(record)
        assets.append({'asset': asset, 'taskId': ledger['taskId'], 'createdAt': ledger['createdAt'],
                       'endpoint': ledger['baseUrl'], 'options': ledger['options'],
                       'inputSha256': ledger['imageSha256'], 'files': files,
                       'inputPath': input_path.relative_to(ROOT).as_posix(), 'inputSize': input_size,
                       'creditsConsumed': None, 'commercialLicense': 'not_verified'})
    EVIDENCE.mkdir(parents=True, exist_ok=True)
    (EVIDENCE / 'manifest.json').write_text(json.dumps({'assets': assets}, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    for asset in assets:
        model = next(f for f in asset['files'] if 'glb' in f)
        print(json.dumps({'asset': asset['asset'], 'taskId': asset['taskId'], 'bytes': model['bytes'], **model['glb']}))


if __name__ == '__main__':
    main()
