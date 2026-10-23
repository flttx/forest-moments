"""Measure dark regions in an existing Blender render; does not edit the image."""
from collections import deque
import hashlib
import json
from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
source = ROOT / 'docs/evidence/assets/2026-10-22-round-01/canoe/bottom.png'
pixels = np.array(Image.open(source))
mask = pixels[:, :, :3].max(axis=2) < 65
# The inspected underside wood area only; exclude the blue sidewall and outline.
mask[:440] = False
mask[553:] = False
mask[:, :100] = False
mask[:, 800:] = False
regions = []
for y, x in zip(*np.where(mask)):
    if not mask[y, x]:
        continue
    queue = deque([(int(x), int(y))])
    mask[y, x] = False
    component = []
    while queue:
        u, v = queue.popleft()
        component.append([u, v])
        for du, dv in [(0, 1), (0, -1), (1, 0), (-1, 0)]:
            nx, ny = u + du, v + dv
            if mask[ny, nx]:
                mask[ny, nx] = False
                queue.append((nx, ny))
    if 8 <= len(component) <= 1000 and np.ptp(np.array(component)[:, 1]) >= 2:
        regions.append(component)
output = ROOT / 'docs/evidence/assets/2026-10-22-round-01/canoe/structure-v2/defect-regions.json'
output.parent.mkdir(parents=True, exist_ok=True)
record = {'source': source.relative_to(ROOT).as_posix(), 'sourceSha256': hashlib.sha256(source.read_bytes()).hexdigest(),
          'method': 'Measured dark regions of inspected underside render; not a count of topological holes', 'regions': regions}
output.write_text(json.dumps(record, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'regions': len(regions), 'pixels': sum(map(len, regions))}))
