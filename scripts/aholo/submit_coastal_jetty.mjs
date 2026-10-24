// One explicitly authorized coastal jetty. Never retry an uncertain create.
import {readFile,writeFile,mkdir} from 'node:fs/promises'
import {resolve,join,basename} from 'node:path'
import {createHash} from 'node:crypto'
import {reserve,upload,createOnce,unwrap} from './aholo.mjs'
const imagePath=resolve('docs/references/waterside/forest-moments-seaside-jetty-v1.png')
const directory=resolve('assets/lux3d/coastal-jetty-v1')
const baseUrl='https://api.aholo3d.cn'
const options={version:'G1',faceCount:300000,outputFormat:['zip','glb']}
const apiKey=process.env.AHOLO_API_KEY?.trim()
if(!apiKey)throw Error('AHOLO_API_KEY is not configured')
const bytes=await readFile(imagePath)
if(!bytes.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex')))throw Error('Expected PNG reference')
await mkdir(directory,{recursive:true})
const ledger=join(directory,'ledger.json')
const state={createdAt:new Date().toISOString(),baseUrl,imagePath,imageSha256:createHash('sha256').update(bytes).digest('hex'),imageBytes:bytes.length,options,phase:'reserved'}
await reserve(ledger,state)
async function call(path,body){
 const response=await fetch(baseUrl+path,{method:body?'POST':'GET',headers:{Authorization:apiKey,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,redirect:'error',signal:AbortSignal.timeout(120000)})
 if(!response.ok)throw Error(`HTTP ${response.status} at ${path.split('?')[0]}`)
 return unwrap(await response.json())
}
try{
 const account=await call('/lux3d/v1/account/balance?source=1')
 const img=await upload(bytes,basename(imagePath))
 state.request={img,...options};state.phase='uploaded'
 await writeFile(ledger,JSON.stringify(state,null,2)+'\n')
 const items={'1':{endpoint:{method:'POST',path:'/lux3d/v1/generate/img-to-3d/task/create'},parameters:{pathParameters:'{}',queryParameters:'{}',body:JSON.stringify(state.request)}}}
 const quote=await call('/lux3d/v1/pricing/openapi-quotes',{source:1,agentName:'codex',uniqueId:account.uniqueId,items})
 if(!Number.isInteger(quote.estimatedCreditsTotal)||quote.estimatedCreditsTotal<0||quote.estimatedCreditsTotal>account.availableCredits)throw Error('Quote is invalid or exceeds available credits')
 state.pricing={quoteId:quote.quoteId,estimatedCredits:quote.estimatedCreditsTotal,beforeCredits:account.availableCredits,quotedAt:quote.quotedAt,expiresAt:quote.expiresAt}
 state.request.contentId=quote.quoteId
 const taskId=await createOnce(ledger,state,()=>call('/lux3d/v1/generate/img-to-3d/task/create',state.request))
 console.log(JSON.stringify({taskId,phase:state.phase,estimatedCredits:quote.estimatedCreditsTotal}))
}catch(error){
 console.error(error.message);process.exitCode=1
}
