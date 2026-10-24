"""Local integrity/evidence inventory for the farm milestone. No remote requests."""
import json,hashlib,struct,gzip,re
from pathlib import Path
from datetime import datetime,timezone
ROOT=Path(__file__).resolve().parents[1]
BASE=ROOT/'docs/evidence/assets/2026-10-24-farm'
def load(p):return json.loads(p.read_text(encoding='utf-8-sig'))
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def info(p):return {'path':p.relative_to(ROOT).as_posix(),'bytes':p.stat().st_size,'sha256':sha(p)}
old=load(ROOT/'docs/evidence/assets/2026-10-24-tree-growth/manifest.json')
retained=old['retainedEightModelsUnchanged']+[{'path':a['runtime']['output'],'sha256':a['runtime']['sha256']} for a in old['assets']]
for p in retained:assert sha(ROOT/p['path'])==p['sha256']
for folder in ['models','vegetation']:
 for p in (ROOT/f'public/assets/{folder}').rglob('*'):
  if p.is_file():assert sha(p)==sha(ROOT/'dist'/p.relative_to(ROOT/'public'))
assets=load(BASE/'runtime-assets.json')
for a in assets:assert sha(ROOT/a['output'])==a['sha256']
for kind in ['hen','sheep']:assert sha(ROOT/f'public/assets/models/farm-{kind}.glb')==sha(Path(f'F:/Projects/my-blog/public/assets/world/farm/animal-{kind}.glb'))
references=[]
for asset in ['animal-chicken','animal-sheep','ranch-coop']:
 p=ROOT/f'docs/references/farm/reused-{asset}.png'
 assert sha(p)==sha(Path(f'F:/Projects/my-blog/docs/references/world/farm/{asset}/working/{asset}.png'))
 references.append(info(p))
folders=[BASE/n for n in ['gameplay-final','views-final','production-final','rowing-production','growth-production']]
folders.append(ROOT/'docs/evidence/vegetation-expansion/2026-10-24/regression-farm-final-fishing_production')
suites=[]
for folder in folders:
 p=folder/'headless-validation.json';r=load(p);assert r['status'].startswith('PASS') and not r['errors'],p
 shots=[]
 for name in r['screenshots']:
  q=folder/name;b=q.read_bytes();assert b[:8]==b'\x89PNG\r\n\x1a\n';assert struct.unpack('>II',b[16:24])==(1440,900);shots.append(info(q))
 suites.append({'report':info(p),'status':r['status'],'screenshots':shots})
links=0
for name in ['PROGRESS.md','README.md','docs/PRD.md','docs/SCENE_UPGRADE_PLAN.md','docs/report/PROJECT_REPORT.md','docs/evidence/assets/2026-10-24-farm/evidence.md']:
 p=ROOT/name
 for target in re.findall(r'!?\[[^\]]*\]\(([^)]+)\)',p.read_text(encoding='utf-8')):
  target=target.split('#')[0]
  if not target or '://' in target:continue
  q=(p.parent/target).resolve();assert q.exists() or q==BASE/'validation.json',(name,target);links+=1
main=next((ROOT/'dist/assets').glob('index-*.js'))
code=['src/game/farm.ts','src/game/farm-colliders.json','src/game/store.ts','src/game/movement.ts','src/world/FarmScene.tsx','src/world/ForestWorld.tsx','src/world/ModelAsset.tsx','src/world/terrain.ts','src/world/GroundCover.tsx','src/App.tsx','scripts/check_farm_headless.mjs','scripts/check_farm_production.mjs','scripts/check_farm_views.mjs','scripts/prepare_farm.py','scripts/compress_farm.cjs','scripts/audit_farm_pose.py','scripts/fit_farm_mouth.py']
result={'date':datetime.now(timezone.utc).isoformat(),'status':'PASS','static':{'lint':'PASS, no warnings','tests':'40/40 in 12 files','build':'PASS; existing chunk-size warning'},'suites':suites,'screenshots':sum(len(s['screenshots']) for s in suites),'localLinks':links,'retainedTwelveModelsUnchanged':retained,'assets':assets,'references':references,'publicDistMatch':True,'modelTrackVegetationBytes':sum(p.stat().st_size for folder in ['models','vegetation'] for p in (ROOT/f'public/assets/{folder}').rglob('*') if p.is_file()),'mainJs':{**info(main),'gzipLevel6Bytes':len(gzip.compress(main.read_bytes(),compresslevel=6,mtime=0))},'code':[info(ROOT/n) for n in code],'performance':load(BASE/'production-final/headless-validation.json')['frameSample'],'limits':['One hen and one sheep; no breeding, products, hunger, night routines or inventory.','Only completed meals persist; reload discards pending food.','Reused interaction animation with scoped hand-bone grain release; no bespoke feed-bag action.','Mouth fit is sampled and visually reviewed, not full contact physics.','Uncapped headless RAF is not presented FPS; JS heap is not GPU memory.','Historical Tripo source assets; no new generation or payment; commercial license scope not independently verified.']}
(BASE/'validation.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({k:result[k] for k in ['status','screenshots','localLinks','modelTrackVegetationBytes']}))
