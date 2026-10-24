// Isolated headless Edge only. CDP pattern reused from my-blog/scripts/t10-gait-check.mjs.
import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createHeadlessBrowser } from './browser-session.mjs'

const stage=process.env.FOREST_CAMERA_STAGE??'review'
const out=resolve('docs/evidence/2026-10-24-camera-speed/'+stage)
await mkdir(out, { recursive: true })
const { profile, cleanup } = await createHeadlessBrowser([
  '--headless=new', '--disable-features=CalculateNativeWinOcclusion', '--disable-frame-rate-limit', '--disable-gpu-vsync', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--remote-debugging-port=0', '--no-first-run', '--no-default-browser-check', 'about:blank',
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
const keys = { w: ['KeyW', 87], s: ['KeyS', 83], a: ['KeyA', 65], d: ['KeyD', 68], Shift: ['ShiftLeft', 16], f: ['KeyF', 70], Escape:['Escape',27] }
const key = (name, down) => cmd('Input.dispatchKeyEvent', { type: down ? 'keyDown' : 'keyUp', key: name, code: keys[name][0], windowsVirtualKeyCode: keys[name][1] })
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
  await cmd('Page.enable'); await cmd('Runtime.enable'); await cmd('Page.bringToFront'); await cmd('Emulation.setFocusEmulationEnabled',{enabled:true})
  await cmd('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })
  await cmd('Page.navigate', { url: 'http://127.0.0.1:5176/?qa' })

  for(let i=0;i<400;i++) {
    const loaded=await evaluate("!!document.querySelector('canvas')&&!document.querySelector('.asset-loading')&&!document.querySelector('.world-error')")
    if(loaded && i>10)break
    if(i===399)throw Error('Production assets failed to load')
    await sleep(200)
  }
  async function wait(predicate,label){for(let i=0;i<400;i++){const s=await snapshot();if(predicate(s))return s;await sleep(50)}throw Error('Timeout '+label+JSON.stringify(await snapshot()))}
  await wait(s=>s?.workshopReady&&s.ready,'all assets')
  async function hold(name, ms) { await key(name,true); await evaluate(`new Promise(resolve=>{let last=performance.now(),elapsed=0;function frame(t){elapsed+=Math.min(t-last,50);last=t;if(elapsed>=${ms})resolve();else requestAnimationFrame(frame)}requestAnimationFrame(frame)})`); await key(name,false) }
  const state=async value=>evaluate(`(async()=>{const {useForestStore:s}=await import(performance.getEntriesByType('resource').find(e=>new URL(e.name).pathname==='/src/game/store.ts').name);s.setState(${JSON.stringify(value)})})()`)
  const difference=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b))
  for(const light of (process.env.FOREST_LIGHTS??'day,dusk,night').split(',')){
    await cmd('Page.navigate',{url:`http://127.0.0.1:5176/?qa&light=${light}`});await sleep(400);await wait(s=>s?.ready&&s.workshopReady,'reload')
    for(const room of ['island','workshop'])for(const [turn,button,target] of [['quarter','d',-Math.PI/2],['reverse','s',Math.PI]]){
      await state({location:room,position:{x:0,z:0},mode:'walking',nearby:room==='workshop'?'workshop':null,workshopBook:{version:1,phase:'finished'}})
      await hold('w',300);await sleep(4000)
      const start=await snapshot();assert(Math.abs(difference(start.followYaw,0))<.015)
      await evaluate(`(()=>{window.turnTrace=[];const start=performance.now();let last=-20;function sample(t){if(t-start-last>=15){const q=JSON.parse(document.querySelector('canvas').dataset.forestQa);window.turnTrace.push({t:(t-start)/1000,yaw:q.followYaw,heading:q.followHeading,eye:q.cameraPosition});last=t-start}if(t-start<4100)requestAnimationFrame(sample)}requestAnimationFrame(sample)})()`)
      await hold(button,300);await sleep(50);await shot(`${light}-${room}-${turn}-early`)
      await sleep(3800);const end=await snapshot(),trace=await evaluate('window.turnTrace')
      assert(Math.abs(difference(end.followYaw,target))<.015,'Settles behind movement')
      assert(Math.abs(difference(end.followHeading,target))<.001)
      const first=trace.find(p=>Math.abs(difference(p.heading,target))<.01),early=trace.find(p=>p.t>=first.t+.35)
      const turnAt350ms=Math.abs(difference(early.yaw,start.followYaw))*180/Math.PI
      const settled=trace.find(p=>p.t>=first.t&&Math.abs(difference(p.yaw,target))<.05*Math.abs(target))
      if(!stage.startsWith('before'))assert(turnAt350ms<37,'No abrupt turn in first 350 ms: '+turnAt350ms)
      if(room==='workshop'){assert(Math.abs(end.cameraPosition[0])<3.73&&Math.abs(end.cameraPosition[2])<2.73);assert(end.cameraPosition[1]<=3.051)}
      await shot(`${light}-${room}-${turn}-settled`)
      check(`${light}-${room}-${turn}`,{turnAt350ms,settled95Seconds:settled?settled.t-first.t:null,start,end,trace})
    }
  }
  assert.equal(report.errors.length,0,report.errors.join('\n'));report.status='PASS'
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
