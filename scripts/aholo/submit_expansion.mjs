import {readFile,writeFile,mkdir} from 'node:fs/promises'
import {resolve,join,basename} from 'node:path'
import {createHash} from 'node:crypto'
import {reserve,upload,createOnce,unwrap} from './aholo.mjs'
const id=process.argv[2],faces={plane:30000,cabin:180000,bed:80000,bridge:100000,reef:100000,firepit:60000,tank:100000}[id]
if(!faces)throw Error('Unknown expansion asset')
const key=process.env.AHOLO_API_KEY?.trim();if(!key)throw Error('AHOLO_API_KEY missing')
const imagePath=resolve(`docs/references/expansion/${id}-v1.png`),dir=resolve(`assets/lux3d/expansion-${id}-v1`),baseUrl='https://api.aholo3d.cn'
const bytes=await readFile(imagePath),options={version:'G1',faceCount:faces,outputFormat:['zip','glb'],aiPredictSize:false}
await mkdir(dir,{recursive:true});const ledger=join(dir,'ledger.json')
const state={createdAt:new Date().toISOString(),baseUrl,imagePath,imageSha256:createHash('sha256').update(bytes).digest('hex'),options,phase:'reserved',authorization:'2026-10-25 user requested expansion and fine models via AHOLO; chairs excluded and reused from my-blog'}
try{await reserve(ledger,state)}catch(e){if(e.code!=='EEXIST')throw e;const previous=JSON.parse(await readFile(ledger,'utf8'));if(previous.phase!=='reserved'||previous.taskId||previous.imageSha256!==state.imageSha256)throw Error('Existing submission: reconcile before retry');}
async function call(path,body){const r=await fetch(baseUrl+path,{method:body?'POST':'GET',headers:{Authorization:key,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,redirect:'error',signal:AbortSignal.timeout(120000)});if(!r.ok)throw Error(`HTTP ${r.status} ${path.split('?')[0]}`);return unwrap(await r.json())}
let account;try{account=await call('/lux3d/v1/account/balance?source=1')}catch{state.pricingUnavailable='Balance endpoint returned server error; no quote available. User authorized generation; no actual credit claim.'}
state.request={img:await upload(bytes,basename(imagePath)),...options};state.phase='uploaded';await writeFile(ledger,JSON.stringify(state,null,2))
if(account){const items={'1':{endpoint:{method:'POST',path:'/lux3d/v1/generate/img-to-3d/task/create'},parameters:{pathParameters:'{}',queryParameters:'{}',body:JSON.stringify(state.request)}}}
const quote=await call('/lux3d/v1/pricing/openapi-quotes',{source:1,agentName:'codex',uniqueId:account.uniqueId,items})
if(!Number.isInteger(quote.estimatedCreditsTotal)||quote.estimatedCreditsTotal<0||quote.estimatedCreditsTotal>account.availableCredits)throw Error('Invalid quote or insufficient balance')
state.pricing={estimatedCredits:quote.estimatedCreditsTotal,beforeCredits:account.availableCredits,quoteId:quote.quoteId};state.request.contentId=quote.quoteId}
const taskId=await createOnce(ledger,state,()=>call('/lux3d/v1/generate/img-to-3d/task/create',state.request))
console.log(JSON.stringify({id,taskId,estimatedCredits:state.pricing?.estimatedCredits??null}))
