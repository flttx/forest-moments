// Isolated headless Edge only. CDP pattern reused from my-blog/scripts/t10-gait-check.mjs.
import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createHeadlessBrowser } from './browser-session.mjs'

const out=resolve('docs/evidence/2026-10-24-heading/transitions')
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
  const angle=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b))
  async function reset(){await cmd('Page.navigate',{url:'http://127.0.0.1:5176/?qa'});await sleep(300);await wait(s=>s?.ready&&s.workshopReady,'reload');await sleep(1000)}
  const cases=[['tap-a','a',100,0],['tap-d-wait','d',100,2200],['reverse','s',300,0],['long-d','d',3000,0]]
  for(const [name,button,time,gap] of cases){
    await reset();const initial=await snapshot();await hold(button,time);const turn=await snapshot();if(gap)await sleep(gap)
    const start=await snapshot();await hold('w',450);const end=await snapshot(),dx=end.position[0]-start.position[0],dz=end.position[2]-start.position[2],error=Math.abs(angle(Math.atan2(-dx,-dz),turn.movementHeading))
    assert(error<.035,name+' forward course');assert(Math.hypot(dx,dz)>.3)
    if(name==='long-d'){assert(turn.position[0]-initial.position[0]>3.1);assert(Math.abs(turn.position[2]-initial.position[2])<.02)}
    await sleep(400);const settled=await snapshot();assert(Math.abs(angle(settled.characterYaw,settled.movementHeading))<.01,'Actor finishes turn after releasing keys')
    await shot(name);report.checks.push({name,initial,turn,start,end,errorDegrees:error*180/Math.PI});console.log('PASS '+name)
  }
  for(const side of ['a','d']){
    await reset();await key('w',true);await key(side,true)
    await evaluate(`new Promise(resolve=>{let last=performance.now(),elapsed=0;function f(t){elapsed+=Math.min(t-last,50);last=t;if(elapsed>=300)resolve();else requestAnimationFrame(f)}requestAnimationFrame(f)})`)
    await key(side,false);const start=await snapshot();await sleep(450);await key('w',false);const end=await snapshot(),dx=end.position[0]-start.position[0],dz=end.position[2]-start.position[2]
    assert(Math.abs(angle(Math.atan2(-dx,-dz),start.movementHeading))<.035,'Diagonal release preserves course')
    await shot('diagonal-'+side);report.checks.push({name:'diagonal-'+side,start,end});console.log('PASS diagonal-'+side)
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
