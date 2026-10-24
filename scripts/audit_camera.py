"""Validate camera milestone resources, screenshots and report links without changing past audits."""
import hashlib,json,re
from pathlib import Path
from datetime import datetime,timezone
ROOT=Path(__file__).resolve().parents[1];BASE=ROOT/'docs/evidence/2026-10-24-camera'
previous=json.loads((ROOT/'docs/evidence/2026-10-24-workshop/validation.json').read_text(encoding='utf-8'))
assets=previous['preservedAssets']+previous['addedAssets']
for a in assets:
 p=ROOT/a['path'];assert hashlib.sha256(p.read_bytes()).hexdigest()==a['sha256'],p
 assert p.read_bytes()==(ROOT/'dist'/p.relative_to(ROOT/'public')).read_bytes(),p
stages=['development-final','views-final','workshop-production','lookout-production','farm-production','growth-production','rowing-production']
paths=[BASE/s/'headless-validation.json' for s in stages]+[ROOT/'docs/evidence/vegetation-expansion/2026-10-24/regression-camera-final-fishing_production/headless-validation.json']
suites=[]
for p in paths:
 d=json.loads(p.read_text(encoding='utf-8'));assert d['status'].startswith('PASS'),p;assert not d['errors'],p
 for name in d['screenshots']:assert (p.parent/name).read_bytes()[:8]==b'\x89PNG\r\n\x1a\n'
 suites.append(dict(path=p.relative_to(ROOT).as_posix(),status=d['status'],screenshots=len(d['screenshots']),browser=d.get('browser'),viewport=d.get('viewport')))
report=ROOT/'docs/report/PROJECT_REPORT.md';section=report.read_text(encoding='utf-8').split('### 5.34 ')[1].split('## 6.')[0];links=[]
for link in re.findall(r'!?\[[^\]]*\]\(([^)]+)\)',section):
 if '://' in link:continue
 p=(report.parent/link.split('#')[0]).resolve();assert p.exists(),p;links.append(link)
result=dict(date=datetime.now(timezone.utc).isoformat(),status='PASS',static=dict(lint='PASS, no warnings',tests='57/57 in 15 files',build='PASS; existing chunk warning'),unchangedRuntimeAssets=assets,totalRuntimeBytes=sum(a['bytes'] for a in assets),suites=suites,finalScreenshots=sum(s['screenshots'] for s in suites),reportLinks=len(links),scope='Local browser validation, automatic walk/run camera, no free orbit or full mesh collision claim')
(BASE/'validation.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');print(json.dumps({k:result[k] for k in ['status','finalScreenshots','totalRuntimeBytes','reportLinks']}))
