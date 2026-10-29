// One ledger per reference. No automatic retry or alternate paid task on failure.
import {readFile,writeFile,mkdir} from 'node:fs/promises'
import {resolve,join,basename} from 'node:path'
import {createHash} from 'node:crypto'
import {reserve,upload,createOnce,unwrap} from './aholo.mjs'

const catalog={
 '01':['old-pine',1,120000], '05':['spruce',1,100000],
 '06':['birch',1,100000], '07':['maple',1,120000],
 '08':['alder',2,100000], '09':['windswept-pine',1,100000],
}
const [command,id]=process.argv.slice(2),item=catalog[id]
if(!item||!['prepare','resume-prepare','submit'].includes(command))throw Error('Usage: submit_island_asset.mjs prepare|resume-prepare|submit 01|05|06|07|08|09')
const [name,version,faceCount]=item,baseUrl='https://api.aholo3d.cn'
const imagePath=resolve(`docs/references/island-expansion/ie-${id}-${name}-v${version}.png`)
const directory=resolve(`assets/lux3d/ie-${id}-${name}-v1`),ledger=join(directory,'ledger.json')
const key=process.env.AHOLO_API_KEY?.trim()
if(!key)throw Error('AHOLO_API_KEY missing')
async function call(path,body){
 const r=await fetch(baseUrl+path,{method:body?'POST':'GET',headers:{Authorization:key,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,redirect:'error',signal:AbortSignal.timeout(120000)})
 if(!r.ok)throw Error(`HTTP ${r.status} ${path.split('?')[0]}`)
 return unwrap(await r.json())
}
const bytes=await readFile(imagePath),sha=createHash('sha256').update(bytes).digest('hex')
if(!bytes.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex')))throw Error('Expected PNG')
if(command!=='submit'){
 const state=command==='resume-prepare'?JSON.parse(await readFile(ledger,'utf8')):{createdAt:new Date().toISOString(),baseUrl,imagePath,imageSha256:sha,phase:'reserved',options:{version:'G1',faceCount,outputFormat:['zip','glb'],aiPredictSize:false},authorization:'2026-10-29 user instructed using the approved tree references with AHOLO API; keep west expansion and add three smaller islands.'}
 if(command==='prepare'){await mkdir(directory,{recursive:true});await reserve(ledger,state)}
 else if(state.phase!=='reserved'||state.taskId||state.request||state.imageSha256!==sha||state.baseUrl!==baseUrl)throw Error('Cannot resume: task creation or upload may already have started')
 let account
 try{account=await call('/lux3d/v1/account/balance?source=1')}
 catch(error){if(!error.message.startsWith('HTTP 500 '))throw error;state.pricingUnavailable='Balance endpoint HTTP 500; actual credits not available. Same authorized no-quote route as submit_x3.mjs.'}
 if(account)state.balance={beforeCredits:account.availableCredits}
 await writeFile(ledger,JSON.stringify(state,null,2))
 state.request={img:await upload(bytes,basename(imagePath)),...state.options}
 state.phase='uploaded';await writeFile(ledger,JSON.stringify(state,null,2))
 if(account){
 const items={'1':{endpoint:{method:'POST',path:'/lux3d/v1/generate/img-to-3d/task/create'},parameters:{pathParameters:'{}',queryParameters:'{}',body:JSON.stringify(state.request)}}}
 const quote=await call('/lux3d/v1/pricing/openapi-quotes',{source:1,agentName:'codex',uniqueId:account.uniqueId,items})
 if(!Number.isInteger(quote.estimatedCreditsTotal)||quote.estimatedCreditsTotal<0||quote.estimatedCreditsTotal>account.availableCredits)throw Error('Invalid quote or insufficient balance')
 state.pricing={estimatedCredits:quote.estimatedCreditsTotal,beforeCredits:account.availableCredits,quoteId:quote.quoteId}
 state.request.contentId=quote.quoteId
 }
 state.phase='prepared';await writeFile(ledger,JSON.stringify(state,null,2))
 console.log(JSON.stringify({id,name,phase:state.phase,...state.pricing}))
}else{
 const state=JSON.parse(await readFile(ledger,'utf8'))
 if(state.phase!=='prepared'||state.taskId||state.imageSha256!==sha||state.baseUrl!==baseUrl)throw Error('Not a prepared, unchanged input; reconcile existing ledger')
 const taskId=await createOnce(ledger,state,()=>call('/lux3d/v1/generate/img-to-3d/task/create',state.request))
 console.log(JSON.stringify({id,name,taskId,estimatedCredits:state.pricing?.estimatedCredits??null}))
}
