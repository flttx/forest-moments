// Isolated headless Edge only. CDP pattern reused from my-blog/scripts/t10-gait-check.mjs.
import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createHeadlessBrowser } from './browser-session.mjs'

const stage = process.env.FOREST_RENDER_STAGE ?? 'outer-route-final'
const out = resolve(`docs/evidence/vegetation-expansion/2026-10-24/${stage}`)
await mkdir(out, { recursive: true })
const { profile, cleanup } = await createHeadlessBrowser([
  '--headless=new', '--disable-features=CalculateNativeWinOcclusion', '--disable-frame-rate-limit', '--disable-gpu-vsync', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--remote-debugging-port=0', '--no-first-run', '--no-default-browser-check', 'about:blank',
])
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const report = { date: new Date().toISOString(), mode: 'isolated headless Edge', viewport: [1440, 900], checks: [], errors: [], screenshots: [], status: 'RUNNING' }
let socket, sequence = 0
const pending = new Map()
function cmd(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++sequence
    const timer = setTimeout(() => { pending.delete(id); reject(Error(`CDP timeout: ${method}`)) }, 45000)
    pending.set(id, (m) => { clearTimeout(timer); if (m.error) reject(Error(JSON.stringify(m.error))); else resolve(m.result) })
    socket.send(JSON.stringify({ id, method, params }))
  })
}
async function evaluate(expression) {
  const r = await cmd('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  if (r.exceptionDetails) throw Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text)
  return r.result?.value
}
const snapshot = () => evaluate("JSON.parse(document.querySelector('canvas')?.dataset.forestQa || 'null')")
async function waitFor(predicate, label, limit = 45000) {
  const start = Date.now()
  while (Date.now() - start < limit) { const value = await snapshot(); if (predicate(value)) return value; await sleep(100) }
  throw Error(`Timeout: ${label}; state=${JSON.stringify(await snapshot())}`)
}
async function shot(name) {
  const result = await cmd('Page.captureScreenshot', { format: 'png' })
  await writeFile(`${out}/${name}.png`, Buffer.from(result.data, 'base64'))
  report.screenshots.push(`${name}.png`)
}
function check(name, data) { report.checks.push({ name, data }); console.log(`PASS ${name}`) }
try {
  let port
  for (let i = 0; i < 100; i++) {
    try { port = (await readFile(`${profile}/DevToolsActivePort`, 'utf8')).split('\n')[0]; break } catch { await sleep(200) }
  }
  assert(port, 'Headless Edge did not expose its isolated debug port')
  const target = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json()
  socket = new WebSocket(target.webSocketDebuggerUrl)
  socket.onmessage = ({ data }) => {
    const m = JSON.parse(data)
    if (pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) }
    if (m.method === 'Runtime.exceptionThrown') report.errors.push(m.params.exceptionDetails?.exception?.description ?? m.params.exceptionDetails?.text)
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') report.errors.push(m.params.args.map((a) => a.value ?? a.description).join(' '))
  }
  await new Promise((r, reject) => { socket.addEventListener('open', r, { once: true }); socket.addEventListener('error', reject, { once: true }) })
  report.browser = await cmd('Browser.getVersion')
  await cmd('Page.enable'); await cmd('Runtime.enable'); await cmd('Page.bringToFront'); await cmd('Emulation.setFocusEmulationEnabled', {enabled:true})
  await cmd('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })

  await cmd('Page.navigate',{url:'http://127.0.0.1:5176/?qa&light=night'})
  await waitFor(s=>s?.ready&&s.models.length===4&&s.boatReady,'ready',90000)
  await sleep(1500)
  const motion=[];let previousLights=[];let maxReassignmentIntensity=0,maxIntensityStep=0
  const codes={w:'KeyW',s:'KeyS',a:'KeyA',d:'KeyD',Shift:'ShiftLeft'}
  const pressed=new Set()
  async function key(k,on){if(pressed.has(k)===on)return;await cmd('Input.dispatchKeyEvent',{type:on?'keyDown':'keyUp',key:k,code:codes[k],windowsVirtualKeyCode:k==='Shift'?16:k.toUpperCase().charCodeAt(0)});if(on)pressed.add(k);else pressed.delete(k)}
  async function go(x,z,label){
    const start=Date.now()
    for(;;){
      const s=await snapshot(),dx=x-s.position[0],dz=z-s.position[2]
      if(Math.hypot(dx,dz)<.2)break
      if(Date.now()-start>30000)throw Error('Travel blocked '+label+' '+JSON.stringify(s.position))
      await key('d',dx>.10);await key('a',dx<-.10);await key('s',dz>.10);await key('w',dz<-.10)
      const v=await evaluate("JSON.parse(document.querySelector('canvas').dataset.vegetationQa)")
      for(let i=0;i<v.lights.length;i++)if(previousLights[i]){
        if(previousLights[i].index!==v.lights[i].index)maxReassignmentIntensity=Math.max(maxReassignmentIntensity,v.lights[i].assignmentIntensity)
        maxIntensityStep=Math.max(maxIntensityStep,Math.abs(previousLights[i].intensity-v.lights[i].intensity))
      }
      previousLights=v.lights
      motion.push({ms:Date.now(),position:s.position,calls:s.calls,triangles:s.triangles,lights:v.lights,occlusion:v.occlusion})
      await sleep(60)
    }
    for(const k of ['w','s','a','d'])await key(k,false)
  }
  await key('Shift',true)
  await go(-1.7,0,'main path')
  for(let z=2;z<=18;z+=2)await go(-1.7+Math.sin(z*.23)*1.15,z,'main path '+z)
  const routeStart=Date.now()
  await evaluate("window.routeFrames=[];window.routeSampling=true;let last;function sample(t){document.querySelector('canvas').getContext('webgl2').finish();if(last!==undefined)window.routeFrames.push(t-last);last=t;if(window.routeSampling)requestAnimationFrame(sample)}requestAnimationFrame(sample)")
  for(let i=0;i<=96;i++){
    const angle=Math.PI/2+i*Math.PI*2/96,r=19.5+.65*Math.sin(angle*3+.3)
    await go(Math.cos(angle)*r,Math.sin(angle)*r,'loop '+i)
    if(i%24===0){await sleep(350);await shot('loop-'+i)}
  }
  await evaluate('window.routeSampling=false')
  const frames=await evaluate('window.routeFrames')
  frames.sort((a,b)=>a-b)
  report.movingCadence={durationMs:Date.now()-routeStart,frames:frames.length,meanFrameMs:frames.reduce((a,b)=>a+b,0)/frames.length,p95FrameMs:frames[Math.floor(frames.length*.95)],maxFrameMs:frames.at(-1),mode:'uncapped headless RAF with gl.finish; not display FPS'}
  await go(-1.7+Math.sin(18*.23)*1.15,18,'return')
  for(let z=16;z>=0;z-=2)await go(-1.7+Math.sin(z*.23)*1.15,z,'return '+z)
  await go(0,0,'spawn');await key('Shift',false);await shot('returned-to-spawn')
  report.route=motion;report.maxReassignmentIntensity=maxReassignmentIntensity;report.maxIntensityStep=maxIntensityStep
  assert(maxReassignmentIntensity<.015,'light pool moved a visibly lit slot')
  assert(report.movingCadence.durationMs>=30000)
  assert(motion.some(s=>s.occlusion?.hidden>0),'route never exercised whole-tree concealment')
  assert.equal(report.errors.length,0,report.errors.join('\n'))
  check('real keyboard full outer loop and return',{samples:motion.length,cadence:report.movingCadence})
  report.status='PASS'
} catch (error) {
  report.status = 'FAIL'; report.failure = String(error); process.exitCode = 1
  if (socket?.readyState === 1) { try { await shot('headless-failure') } catch { /* Original error stays in report. */ } }
} finally {
  try {
    await writeFile(`${out}/headless-validation.json`, JSON.stringify(report, null, 2) + '\n')
    if (socket?.readyState === 1) { try { await cmd('Browser.close') } catch { /* Closing the socket can precede the response. */ } socket.close() }
    console.log(report.status)
  } finally {
    await cleanup()
  }
}
