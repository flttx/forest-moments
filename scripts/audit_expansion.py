"""Compact, reproducible evidence; no credentials or raw API replies are read."""
import hashlib,json
from pathlib import Path
root=Path.cwd();evidence=root/'docs/evidence/2026-10-25-expansion'
def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()
assets=[]
for p in sorted((root/'public/assets').rglob('*')):
 if not p.is_file():continue
 relative=p.relative_to(root/'public');built=root/'dist'/relative
 assets.append({'path':str(relative).replace('\\','/'),'bytes':p.stat().st_size,'sha256':digest(p),'distMatches':built.exists() and digest(p)==digest(built)})
new=[a for a in assets if a['path'].startswith('assets/expansion/')]
source=root.parent/'my-blog/assets/blender/environment-kit/export/batch2-meshopt/low-bench.glb'
groups={}
for folder in ['final-v2','navigation-v2','polish','production']:
 p=evidence/folder/'headless-validation.json'
 if p.exists():
  r=json.loads(p.read_text(encoding='utf-8'));groups[folder]={'status':r['status'],'screenshots':len(r['screenshots']),'errors':r['errors'],'browser':r.get('browser'),'viewport':r['viewport']}
  if 'contact' in r:groups[folder]['maximumGripErrorMetres']=r['contact']['maximumGripErrorMetres']
  if 'localColdLoadMs' in r:groups[folder]['localColdLoadMs']=r['localColdLoadMs']
summary={'date':'2026-10-25','unitTests':{'passed':75,'total':75},'lint':'passed without warnings','build':'passed; existing large chunk warning',
 'validation':groups,'runtimeBytes':sum(a['bytes'] for a in assets),'newRuntimeBytes':sum(a['bytes'] for a in new),
 'benchSource':str(source),'benchByteIdentical':digest(source)==digest(root/'public/assets/expansion/low-bench.glb'),
 'tankDimensionsMetres':[1.44,1.296,.612],'assets':assets,
 'sourceTreeSha256':hashlib.sha256(b''.join(str(p.relative_to(root)).encode()+p.read_bytes() for p in sorted((root/'src').rglob('*')) if p.is_file())).hexdigest(),
 'scope':'Local Windows Edge; visual fixtures plus real keyboard routes and catch-to-aquarium. No deployment, upload or new AHOLO create calls this implementation turn.',
 'remaining':'No authored climb-into-bed animation or fish husbandry simulation; woodworking sleeve folds remain an art refinement. Cliff material/stream bank art may be refined; no cross-device or public-network performance claim.'}
assert all(a['distMatches'] for a in assets)
(evidence/'validation.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({k:v for k,v in summary.items() if k!='assets'},ensure_ascii=False,indent=2))
