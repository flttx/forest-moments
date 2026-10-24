// Isolated headless Edge only. CDP pattern reused from my-blog/scripts/t10-gait-check.mjs.
import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createHeadlessBrowser } from './browser-session.mjs'

const out=resolve('docs/evidence/2026-10-24-orbit/navigation')
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
  const forward=q=>[-Math.sin(q.orbit.yaw),-Math.cos(q.orbit.yaw)]
  const basisMove=(q,x,z)=>{const f=forward(q),n=Math.hypot(x,z);return[(-f[1]*x-f[0]*z)/n,(f[0]*x-f[1]*z)/n]}
  await state({position:{x:-1,z:1},location:'island',mode:'walking',nearby:null});await sleep(2500);const start=await snapshot(),right=basisMove(start,1,0)
  await key('d',true)
  const trace=await evaluate(`new Promise(resolve=>{const trace=[];let last=performance.now(),elapsed=0;function frame(t){elapsed+=Math.min(t-last,50);last=t;const q=JSON.parse(document.querySelector('canvas').dataset.forestQa);trace.push({position:q.position,input:q.inputDirection});if(elapsed>=3000)resolve(trace);else requestAnimationFrame(frame)}requestAnimationFrame(frame)})`)
  await key('d',false);const end=await snapshot(),delta=[end.position[0]-start.position[0],end.position[2]-start.position[2]]
  report.longHold={start,end,distance:Math.hypot(...delta)};assert(Math.hypot(...delta)>3.1,JSON.stringify(report.longHold));for(const p of trace){const dx=p.position[0]-start.position[0],dz=p.position[2]-start.position[2];assert(Math.abs(dx*right[1]-dz*right[0])<.03,'Held side input stays straight')}
  await shot('01-held-side-straight');check('three-second side movement has no camera feedback loop',{start,end,trace})
  await sleep(3000);const fresh=await snapshot(),f=forward(fresh);await hold('w',450);const next=await snapshot(),v=[next.position[0]-fresh.position[0],next.position[2]-fresh.position[2]]
  assert((v[0]*f[0]+v[1]*f[1])/Math.hypot(...v)>.98);await shot('02-new-forward');check('released then W follows independent camera heading',{fresh,next})
  await state({position:{x:0,z:0},location:'island',mode:'walking',nearby:null});await sleep(2000)
  await key('w',true);await sleep(200);await evaluate("window.dispatchEvent(new Event('blur'))");const stopped=await snapshot();await sleep(500);const still=await snapshot();await key('w',false)
  assert(Math.hypot(still.position[0]-stopped.position[0],still.position[2]-stopped.position[2])<.02);check('blur clears directional input',still)
  const {workshopDoor,craftSpot,indoorExit}=await evaluate("(async()=>{const m=await import('/src/game/workshop.ts');return{workshopDoor:m.workshopDoor,craftSpot:m.craftSpot,indoorExit:m.indoorExit}})()")
  const press=async k=>{await key(k,true);await key(k,false)}
  async function walkTo(target){
   const options=[[0,-1,['w']],[1,-1,['w','d']],[1,0,['d']],[1,1,['d','s']],[0,1,['s']],[-1,1,['s','a']],[-1,0,['a']],[-1,-1,['a','w']]]
   for(let step=0;step<160;step++){
    const q=await snapshot(),dx=target.x-q.position[0],dz=target.z-q.position[2],distance=Math.hypot(dx,dz);if(distance<.16)return q
    const sorted=options.map(([x,z,buttons])=>{const v=basisMove(q,x,z);return{buttons,score:v[0]*dx+v[1]*dz}}).sort((a,b)=>b.score-a.score)
    for(const k of sorted[0].buttons)await key(k,true)
    await evaluate(`new Promise(resolve=>{let last=performance.now(),elapsed=0;function frame(t){elapsed+=Math.min(t-last,50);last=t;if(elapsed>=${Math.min(120,distance/1.1*1000)})resolve();else requestAnimationFrame(frame)}requestAnimationFrame(frame)})`)
    for(const k of sorted[0].buttons)await key(k,false)
   }throw Error('Could not reach '+JSON.stringify(target))
  }
  await state({position:{x:workshopDoor.x,z:workshopDoor.z+.6},location:'island',mode:'walking',nearby:'workshop',workshopBook:{version:1,phase:'carrying'}});await sleep(2000)
  await walkTo(workshopDoor);await shot('03-door');await press('f');await wait(s=>s.location==='workshop'&&!s.workshopTransfer,'enter');await sleep(1500)
  await walkTo(craftSpot);await shot('04-station');await press('f');await wait(s=>s.mode==='crafting','craft');await press('Escape');await wait(s=>s.mode==='walking','cancel craft');await sleep(2000)
  await walkTo(indoorExit);await shot('05-exit');await press('f');await wait(s=>s.location==='island'&&!s.workshopTransfer,'return');await shot('06-return');check('camera-relative route through room and interaction camera transitions',await snapshot())
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
