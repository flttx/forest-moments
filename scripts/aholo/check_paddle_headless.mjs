// Dedicated headless Edge instance; never attach to the user's browser or desktop.
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { createHash } from 'node:crypto'
const out=resolve('docs/evidence/assets/2026-10-23-paddle-final')
const fit=JSON.parse(await readFile(resolve('docs/evidence/assets/2026-10-22-paddle-original/original-poses.json'),'utf8'))
const profile=await mkdtemp(resolve(tmpdir(),'forest-paddle-headless-'))
const edge=spawn(process.env.EDGE_PATH??'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',[
  '--headless=new','--remote-debugging-port=0',`--user-data-dir=${profile}`,'--no-first-run','--no-default-browser-check','about:blank',
],{windowsHide:true,stdio:'ignore'})
const sleep=(ms)=>new Promise(r=>setTimeout(r,ms))
let socket,sequence=0
const pending=new Map()
const report={date:new Date().toISOString(),mode:'isolated headless Edge',viewport:[1440,900],errors:[],screenshots:[],status:'RUNNING'}
function cmd(method,params={}) {
  return new Promise((resolve,reject)=>{
    const id=++sequence,timer=setTimeout(()=>{pending.delete(id);reject(Error(`CDP timeout: ${method}`))},45000)
    pending.set(id,m=>{clearTimeout(timer);if(m.error)reject(Error(JSON.stringify(m.error)));else resolve(m.result)})
    socket.send(JSON.stringify({id,method,params}))
  })
}
async function evaluate(expression) {
  const r=await cmd('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true})
  if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description??r.exceptionDetails.text)
  return r.result?.value
}
async function shot(name) {
  const result=await cmd('Page.captureScreenshot',{format:'png'})
  await writeFile(`${out}/${name}.png`,Buffer.from(result.data,'base64'));report.screenshots.push(`${name}.png`)
}
const snapshot=()=>evaluate("JSON.parse(document.querySelector('canvas')?.dataset.paddleQa || 'null')")
try {
  let port
  for(let i=0;i<100;i++){try{port=(await readFile(`${profile}/DevToolsActivePort`,'utf8')).split('\n')[0];break}catch{await sleep(200)}}
  assert(port,'Isolated Edge did not start')
  const target=await(await fetch(`http://127.0.0.1:${port}/json/new?about:blank`,{method:'PUT'})).json()
  socket=new WebSocket(target.webSocketDebuggerUrl)
  socket.onmessage=({data})=>{
    const m=JSON.parse(data)
    if(pending.has(m.id)){pending.get(m.id)(m);pending.delete(m.id)}
    if(m.method==='Runtime.exceptionThrown')report.errors.push(m.params.exceptionDetails?.exception?.description??m.params.exceptionDetails?.text)
    if(m.method==='Runtime.consoleAPICalled'&&m.params.type==='error')report.errors.push(m.params.args.map(a=>a.value??a.description).join(' '))
  }
  await new Promise((r,reject)=>{socket.addEventListener('open',r,{once:true});socket.addEventListener('error',reject,{once:true})})
  report.browser=await cmd('Browser.getVersion')
  await cmd('Page.enable');await cmd('Runtime.enable')
  await cmd('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false})
  await cmd('Page.navigate',{url:'http://127.0.0.1:5176/scripts/aholo/paddle-review.html'})
  let ready
  for(let i=0;i<450;i++){ready=await snapshot();if(ready?.ready)break;if(report.errors.length)throw Error(report.errors.join('\n'));await sleep(200)}
  assert(ready?.ready,'Review GLB load timeout');report.initial=ready
  assert.equal(ready.reviewVersion,'center-final-11','Stale review module served')
  report.propTrackSHA256=await evaluate(`(async()=>{
    const data=await(await fetch('/docs/evidence/assets/2026-10-23-paddle-final/prop-track.json',{cache:'no-store'})).arrayBuffer();
    return [...new Uint8Array(await crypto.subtle.digest('SHA-256',data))].map(v=>v.toString(16).padStart(2,'0')).join('');
  })()`)
  assert.equal(report.propTrackSHA256,createHash('sha256').update(await readFile(`${out}/prop-track.json`)).digest('hex'),'Stale prop track served')
  assert.equal(ready.layout.sternAsset,'/assets/lux3d/round-01/canoe/stern-seat-v3.glb','Wrong derived asset loaded')
  assert.equal(ready.layout.name,'center','Middle bench is not the default layout')
  assert.equal(ready.layout.centerVisible,true,'Central derivative must be visible')
  assert.equal(ready.layout.centerAsset,'/assets/lux3d/round-01/canoe/center-seat-v11.glb')
  assert.equal(ready.layout.sternVisible,false,'Unadopted aft hull is visible by default')
  assert.equal(ready.clips[0].name,'paddle')
  assert.equal(ready.source,'original rig-mixamo-v6 paddle; no arm overrides')
  assert(ready.paddle.visible&&ready.paddle.parts.length===2,'Original paddle meshes are not visible')
  assert(Math.abs(ready.clips[0].duration-7.2)<.001)
  // Exercise actual controls, then read the independently loaded GLB bone world positions.
  report.samples=await evaluate(`(async()=>{
    const samples=[], slider=document.querySelector('#time');
    for(const layout of ['baseline','center']){
      document.querySelector('#layout').value=layout;document.querySelector('#layout').dispatchEvent(new Event('change'));
      for(let frame=0;frame<=216;frame++){
      slider.value=String(frame/30);slider.dispatchEvent(new Event('input',{bubbles:true}));
      samples.push({frame,...JSON.parse(document.querySelector('canvas').dataset.paddleQa)});
    }}return samples;
  })()`)
  let maxError=0
  const expectedShifts={center:[0,.26,0],baseline:[0,0,0],compact:[.15,.059592485,.15],candidate:[-.6,.4,.2],stern:[-.6,.2,.15]}
  for(const sample of report.samples){
    assert(Math.hypot(...sample.layout.shift.map((v,i)=>v-expectedShifts[sample.layout.name][i]))<.00001,'Wrong layout transform')
    assert.equal(sample.layout.sternVisible,sample.layout.name==='stern','Wrong hull visible')
  }
  for(const sample of report.samples)for(const side of ['Left','Right']){
    const p=sample.hands[side],target=fit.frames[sample.frame].gripTargets[side]
    const shift=sample.layout.shift
    maxError=Math.max(maxError,Math.hypot(p[0]-shift[0]-target[0],p[1]-shift[1]-target[2],p[2]-shift[2]+target[1]))
  }
  report.maxExportedHandError=maxError;assert(maxError<.005,`Exported hand error ${maxError}`)
  report.maxHeldGripError=Math.max(...report.samples.map(s=>s.paddle.heldError))
  report.maxTwoHandGripError=Math.max(...report.samples.filter(s=>!s.paddle.regrip).flatMap(s=>Object.values(s.paddle.gripErrors)))
  assert(report.maxHeldGripError<.005&&report.maxTwoHandGripError<.005,'Prop detached from source hands')
  for(const layout of ['baseline','center']){
    await evaluate(`document.querySelector('#layout').value='${layout}';document.querySelector('#layout').dispatchEvent(new Event('change'));document.querySelector('#view').value='right';document.querySelector('#view').dispatchEvent(new Event('change'));document.querySelector('#time').value='${190/30}';document.querySelector('#time').dispatchEvent(new Event('input'))`)
    await sleep(80);await shot(`compare-${layout}-190`)
  }
  for(const view of ['right','left']) {
    await evaluate("document.querySelector('#layout').value='center';document.querySelector('#layout').dispatchEvent(new Event('change'))")
    await evaluate(`document.querySelector('#view').value='${view}';document.querySelector('#view').dispatchEvent(new Event('change'))`)
    for(const frame of [0,27,43,55,75,108,139,151,163,190,197,199,202,210,216]) {
      await evaluate(`document.querySelector('#time').value='${frame/30}';document.querySelector('#time').dispatchEvent(new Event('input'))`)
      await sleep(80);await shot(`headless-${view}-${String(frame).padStart(3,'0')}`)
    }
  }
  await evaluate("document.querySelector('#view').value='close';document.querySelector('#view').dispatchEvent(new Event('change'))")
  await sleep(80);await shot('headless-grip-close')
  for(const frame of [90,180]) {
    await evaluate(`document.querySelector('#view').value='right';document.querySelector('#view').dispatchEvent(new Event('change'));document.querySelector('#water').checked=true;document.querySelector('#water').dispatchEvent(new Event('change'));document.querySelector('#time').value='${frame/30}';document.querySelector('#time').dispatchEvent(new Event('input'))`)
    await sleep(80);await shot(`headless-water-${frame}`)
  }
  await evaluate("document.querySelector('#water').checked=false;document.querySelector('#water').dispatchEvent(new Event('change'))")
  if(process.argv.includes('--video')) {
    await mkdir(`${out}/video-frames`,{recursive:true})
    report.videoFrames=[]
    for(let frame=0;frame<216;frame++) {
      await evaluate(`document.querySelector('#time').value='${frame/30}';document.querySelector('#time').dispatchEvent(new Event('input'));new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))`)
      const png=await cmd('Page.captureScreenshot',{format:'png'})
      const file=`video-frames/frame-${String(frame).padStart(3,'0')}.png`
      await writeFile(`${out}/${file}`,Buffer.from(png.data,'base64'));report.videoFrames.push(file)
    }
  }
  await evaluate("document.querySelector('#view').value='right';document.querySelector('#view').dispatchEvent(new Event('change'));document.querySelector('#water').click();document.querySelector('#time').value='0';document.querySelector('#time').dispatchEvent(new Event('input'));document.querySelector('#play').click()")
  report.playback=await evaluate(`new Promise(resolve=>{
    const frames=[];const start=performance.now();
    function tick(){const s=JSON.parse(document.querySelector('canvas').dataset.paddleQa);frames.push({wallMs:performance.now()-start,time:s.time,hands:s.hands});if(performance.now()-start<15000)requestAnimationFrame(tick);else resolve(frames)}requestAnimationFrame(tick)
  })`)
  report.loopWraps=report.playback.filter((v,i,a)=>i&&v.time<a[i-1].time).length
  assert(report.loopWraps>=2,'Two complete playback cycles were not observed')
  await evaluate("document.querySelector('#play').click()")
  await shot('headless-water-playback')
  await evaluate("document.querySelector('#water').click();document.querySelector('#view').value='stern';document.querySelector('#view').dispatchEvent(new Event('change'));document.querySelector('#time').value='0';document.querySelector('#time').dispatchEvent(new Event('input'))")
  await sleep(80);await shot('headless-stern-close')
  await evaluate("document.querySelector('#actor').click()")
  await sleep(80);await shot('headless-stern-structure')
  await evaluate("document.querySelector('#actor').click()")
  assert.equal(report.errors.length,0)
  report.status='PASS: original pose, prop attachment and two playback loops; geometry and visual review recorded separately'
}catch(error){report.status='FAIL';report.failure=String(error);process.exitCode=1}
finally {
  await writeFile(`${out}/headless-validation.json`,JSON.stringify(report,null,2)+'\n')
  if(socket?.readyState===1){try{await cmd('Browser.close')}catch{/* Browser may close before acknowledging. */}socket.close()}
  edge.kill();console.log(JSON.stringify({status:report.status,failure:report.failure,maxExportedHandError:report.maxExportedHandError,loopWraps:report.loopWraps}))
}
