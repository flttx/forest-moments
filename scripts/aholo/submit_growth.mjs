// Three explicitly requested stages, one reserved ledger per submission. Never retry uncertain creates.
import {readFile,writeFile,mkdir} from 'node:fs/promises'
import {resolve,basename,join} from 'node:path'
import {createHash} from 'node:crypto'
import {reserve,upload,createOnce,unwrap} from './aholo.mjs'
const stage=process.argv[2]
const faceCount={sprout:10000,seedling:15000,young:40000,mature:80000}[stage]
if(!faceCount)throw Error('Expected seedling, young or mature')
const key=process.env.AHOLO_API_KEY?.trim()
if(!key)throw Error('AHOLO_API_KEY missing')
const directory=resolve(`assets/lux3d/growth-${stage}-v1`),imagePath=resolve(`docs/references/growth/forest-moments-${stage}-v1.png`)
const bytes=await readFile(imagePath),baseUrl='https://api.aholo3d.cn'
const state={createdAt:new Date().toISOString(),baseUrl,imagePath,imageSha256:createHash('sha256').update(bytes).digest('hex'),imageBytes:bytes.length,options:{version:'G1',faceCount,outputFormat:['zip','glb'],aiPredictSize:false},phase:'reserved',authorization:'User explicitly requested stage models; existing instruction requires reference then AHOLO API'}
await mkdir(directory,{recursive:true});const ledger=join(directory,'ledger.json');await reserve(ledger,state)
const img=await upload(bytes,basename(imagePath));state.request={img,...state.options};state.phase='uploaded'
await writeFile(ledger,JSON.stringify(state,null,2)+'\n')
const taskId=await createOnce(ledger,state,async()=>{
 const r=await fetch(baseUrl+'/lux3d/v1/generate/img-to-3d/task/create',{method:'POST',redirect:'error',headers:{Authorization:key,'Content-Type':'application/json'},body:JSON.stringify(state.request),signal:AbortSignal.timeout(120000)})
 if(!r.ok)throw Error(`Create HTTP ${r.status}`)
 return unwrap(await r.json())
})
console.log(JSON.stringify({stage,taskId,faceCount,phase:state.phase}))
