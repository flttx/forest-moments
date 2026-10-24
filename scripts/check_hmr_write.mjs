import assert from 'node:assert/strict'
import {readFile,writeFile,mkdir,rm,realpath} from 'node:fs/promises'
import {resolve,relative,isAbsolute} from 'node:path'
import {createServer,loadConfigFromFile} from 'vite'
import {createProjectTempDirectory} from './browser-session.mjs'

const sleep=ms=>new Promise(r=>setTimeout(r,ms))
const loaded=await loadConfigFromFile({command:'serve',mode:'development'},resolve('vite.config.ts'))
const report={cases:[],status:'RUNNING'}
for(const [name,watch] of [['before',{}],['after',loaded.config.server.watch]]){
 const directory=await createProjectTempDirectory('forest-hmr-write-')
 let server
 try{
  const file=resolve(directory,'store.ts'),pending=[]
  await writeFile(file,'export const useForestStore = () => 1\n')
  server=await createServer({root:directory,configFile:false,logLevel:'silent',server:{host:'127.0.0.1',port:0,watch},optimizeDeps:{noDiscovery:true}})
  await server.listen();await sleep(300);await server.transformRequest('/store.ts')
  const events=[]
  server.watcher.on('change',changed=>{
   if(resolve(changed)!==file)return
   pending.push((async()=>{
    const raw=await readFile(file,'utf8'),result=await server.transformRequest('/store.ts?t='+Date.now())
    events.push({rawBytes:raw.length,exportPresent:!!result?.code.includes('export const useForestStore')})
   })())
  })
  // Only this disposable fixture is truncated. The real project source is never altered.
  await writeFile(file,'');await sleep(100);await writeFile(file,'export const useForestStore = () => 2\n')
  await sleep(800);await Promise.all(pending)
  assert(events.length>0,'File watcher emitted an update')
  if(name==='after')assert(events.every(e=>e.rawBytes>0&&e.exportPresent),'No partial module emitted after stabilization')
  report.cases.push({name,watch,events})
 }finally{
  await server?.close()
  const target=await realpath(directory),tempRoot=await realpath(resolve('.tmp')),part=relative(tempRoot,target)
  assert(part&&!part.startsWith('..')&&!isAbsolute(part),'Cleanup must stay within project .tmp')
  await rm(target,{recursive:true,force:true})
 }
}
report.status='PASS'
const out=resolve('docs/evidence/2026-10-24-hmr');await mkdir(out,{recursive:true})
await writeFile(resolve(out,'write-stability.json'),JSON.stringify(report,null,2)+'\n')
console.log(JSON.stringify(report))
