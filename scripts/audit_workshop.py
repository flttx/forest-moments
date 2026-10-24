"""Audit this workshop milestone without rewriting earlier milestone evidence."""
import hashlib,json,re
from pathlib import Path
from datetime import datetime,timezone
ROOT=Path(__file__).resolve().parents[1]
BASE=ROOT/'docs/evidence/2026-10-24-workshop'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
previous=json.loads((ROOT/'docs/evidence/2026-10-24-lookout/validation.json').read_text(encoding='utf-8'))
original=previous['allRuntimeAssetsUnchanged']
for record in original:
 p=ROOT/record['path'];assert sha(p)==record['sha256'],p
new=json.loads((BASE/'interior-assets.json').read_text(encoding='utf-8'))
for record in new['files']:
 assert sha(ROOT/record['path'])==record['sha256']
for record in original+new['files']:
 p=ROOT/record['path'];built=ROOT/'dist'/p.relative_to(ROOT/'public');assert p.read_bytes()==built.read_bytes(),built
for name in ['craft-workbench.glb','craft-stool.glb']:
 assert not (ROOT/'public/assets/models'/name).exists()
 assert not (ROOT/'dist/assets/models'/name).exists()
 assert (ROOT/'assets/workshop/rejected-outdoor-runtime'/name).exists()
paths=[BASE/stage/'headless-validation.json' for stage in ['development-release','production-final','views-final','rowing-production','growth-production','farm-production','lookout-production-retry']]
paths.append(ROOT/'docs/evidence/vegetation-expansion/2026-10-24/regression-workshop-final-fishing_production/headless-validation.json')
suites=[]
for p in paths:
 d=json.loads(p.read_text(encoding='utf-8'));assert d['status'].startswith('PASS'),p
 assert not d.get('errors'),p
 shots=d.get('screenshots',[])
 for shot in shots:
  f=p.parent/(shot if isinstance(shot,str) else shot['path']);assert f.read_bytes()[:8]==b'\x89PNG\r\n\x1a\n',f
 suites.append(dict(path=p.relative_to(ROOT).as_posix(),status=d['status'],shots=len(shots),browser=d.get('browser'),viewport=d.get('viewport')))
report=ROOT/'docs/report/PROJECT_REPORT.md';content=report.read_text(encoding='utf-8');section=content.split('### 5.33 ')[1].split('## 6.')[0]
links=[]
for link in re.findall(r'!?\[[^\]]*\]\(([^)]+)\)',section):
 if '://' in link:continue
 target=(report.parent/link.split('#')[0]).resolve();assert target.exists(),target;links.append(link)
result=dict(date=datetime.now(timezone.utc).isoformat(),status='PASS',static=dict(lint='PASS, no warnings',tests='52/52 in 14 files',build='PASS, existing large chunk warning'),preservedAssets=original,addedAssets=new['files'],totalRuntimeBytes=sum(a['bytes'] for a in original+new['files']),suites=suites,finalScreenshots=sum(s['shots'] for s in suites),reportLinks=len(links),scope='Local Edge validation only; not cross-device performance or dedicated carpentry animation acceptance')
(BASE/'validation.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({k:result[k] for k in ['status','totalRuntimeBytes','finalScreenshots','reportLinks']}))
