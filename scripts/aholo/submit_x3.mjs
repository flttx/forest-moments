import {readFile,writeFile,mkdir} from 'node:fs/promises'
import {resolve,join,basename} from 'node:path'
import {createHash} from 'node:crypto'
import {reserve,upload,createOnce,unwrap} from './aholo.mjs'
// X3 props (docs/GAMEPLAY_EXPANSION_PLAN.md §7) and X5 hidden-corner assets (§8): one reserved ledger per prop; never
// retry an uncertain create. Usage: node submit_x3.mjs <id> [attempt] [series=x3|x5]
const series=process.argv[4]??'x3'
const x3={'01':['mushroom-cluster',30000],'02':['berry-twig',30000],'03':['seashell',30000],'04':['pinecone',30000],'05':['egg-nest',30000],'06':['wool-bundle',30000],
 '07':['small-wood-table',50000],'08':['birdhouse',50000],'09':['fishing-rod-rack',50000],'10':['wood-signpost',50000],'11':['message-bottle',30000],'12':['glowing-jellyfish',40000]}
const x5={'01':['sleeping-fox',40000],'02':['fox-den-entrance',50000],'03':['heart-stone',30000],'04':['peeking-fox',40000]}
const authorizations={x3:'2026-10-27 user approved the X3 prop list (12 items, about 240-480 credits) and supplied the reference images',
 x5:'2026-10-28 user approved the X5 hidden-corner list (4 items, about 80-160 credits) and supplied the reference images'}
const props={x3,x5}[series]
if(!props)throw Error('Unknown series')
// Optional second argument: attempt number. A later attempt gets its own directory, so an unconfirmed earlier ledger stays as the record.
const id=process.argv[2],attempt=Number(process.argv[3]??1),[name,faces]=props[id]??[]
if(!Number.isInteger(attempt)||attempt<1)throw Error('Attempt must be a positive integer')
if(!faces)throw Error(`Unknown ${series} prop`)
const key=process.env.AHOLO_API_KEY?.trim();if(!key)throw Error('AHOLO_API_KEY missing')
const imagePath=resolve(`docs/forest-moments-${series}-${id}-${name}-v1.png`),dir=resolve(`assets/lux3d/${series}-${id}-${name}-v1${attempt>1?`-r${attempt}`:''}`),baseUrl='https://api.aholo3d.cn'
const bytes=await readFile(imagePath),options={version:'G1',faceCount:faces,outputFormat:['zip','glb'],aiPredictSize:false}
await mkdir(dir,{recursive:true});const ledger=join(dir,'ledger.json')
const state={createdAt:new Date().toISOString(),baseUrl,imagePath,imageSha256:createHash('sha256').update(bytes).digest('hex'),options,phase:'reserved',authorization:authorizations[series]}
try{await reserve(ledger,state)}catch(e){if(e.code!=='EEXIST')throw e;const previous=JSON.parse(await readFile(ledger,'utf8'));if(previous.phase!=='reserved'||previous.taskId||previous.imageSha256!==state.imageSha256)throw Error('Existing submission: reconcile before retry');}
async function call(path,body){const r=await fetch(baseUrl+path,{method:body?'POST':'GET',headers:{Authorization:key,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,redirect:'error',signal:AbortSignal.timeout(120000)});if(!r.ok)throw Error(`HTTP ${r.status} ${path.split('?')[0]}`);return unwrap(await r.json())}
let account;try{account=await call('/lux3d/v1/account/balance?source=1')}catch{state.pricingUnavailable='Balance endpoint returned server error; no quote available. User authorized generation; no actual credit claim.'}
state.request={img:await upload(bytes,basename(imagePath)),...options};state.phase='uploaded';await writeFile(ledger,JSON.stringify(state,null,2))
if(account){const items={'1':{endpoint:{method:'POST',path:'/lux3d/v1/generate/img-to-3d/task/create'},parameters:{pathParameters:'{}',queryParameters:'{}',body:JSON.stringify(state.request)}}}
const quote=await call('/lux3d/v1/pricing/openapi-quotes',{source:1,agentName:'codex',uniqueId:account.uniqueId,items})
if(!Number.isInteger(quote.estimatedCreditsTotal)||quote.estimatedCreditsTotal<0||quote.estimatedCreditsTotal>account.availableCredits)throw Error('Invalid quote or insufficient balance')
state.pricing={estimatedCredits:quote.estimatedCreditsTotal,beforeCredits:account.availableCredits,quoteId:quote.quoteId};state.request.contentId=quote.quoteId}
const taskId=await createOnce(ledger,state,()=>call('/lux3d/v1/generate/img-to-3d/task/create',state.request))
console.log(JSON.stringify({id,name,taskId,estimatedCredits:state.pricing?.estimatedCredits??null}))
