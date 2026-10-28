// Isolated headless Edge only. CDP pattern reused from my-blog/scripts/t10-gait-check.mjs.
import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createHeadlessBrowser } from './browser-session.mjs'

const stage=process.env.FOREST_SLOPE_STAGE??'after'
const out=resolve('docs/evidence/2026-10-28-slope-camera/'+stage)
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
  const imp=p=>`await import(performance.getEntriesByType('resource').find(e=>new URL(e.name).pathname==='${p}')?.name??'${p}')`
  // Pick a walkable spot whose slope along the current view is uphill or downhill.
  const findSpot=(yaw,sign)=>evaluate(`(async()=>{const m=${imp('/src/game/movement.ts')},f=${imp('/src/game/followCamera.ts')};let best=null
   for(let x=-34;x<=34;x+=.5)for(let z=-34;z<=34;z+=.5){const n=m.moveOnGround({x,y:0,z},.01,0,[],'finished');if(Math.hypot(n.x-x-.01,n.z-z)>.001)continue
    const s=f.slopePitch(m.groundHeightAt,{x,y:0,z},${yaw})*${sign};const ahead=m.moveOnGround({x,y:0,z},-Math.sin(${yaw})*.02,-Math.cos(${yaw})*.02,[],'finished');if(Math.hypot(ahead.x-x,ahead.z-z)<.019)continue
    if(!best||s>best.s+1e-6||(Math.abs(s-best.s)<1e-6&&Math.hypot(x,z)<Math.hypot(best.x,best.z)))best={x,z,s}}return best})()`)
  const pitchOf=s=>{const dx=s.cameraPosition[0]-s.position[0],dz=s.cameraPosition[2]-s.position[2],dy=s.cameraPosition[1]-(s.position[1]+.8);return Math.atan2(dy,Math.hypot(dx,dz))}
  await state({location:'island',position:{x:0,z:0},mode:'walking'});await sleep(1500)
  const yaw=(await snapshot()).orbit.yaw
  const flat=await snapshot()
  check('flat',{orbitPitch:flat.orbit.pitch,cameraPitch:pitchOf(flat)});await shot('flat')
  for(const [name,sign] of [['uphill',-1],['downhill',1]]){
    const spot=await findSpot(yaw,sign);assert(spot,'no '+name+' spot')
    await state({position:{x:spot.x,z:spot.z},mode:'walking'});await sleep(2500)
    const still=await snapshot();await shot(name+'-still')
    await hold('w',900);const walked=await snapshot();await shot(name+'-walking')
    const data={spot,orbitPitch:still.orbit.pitch,cameraPitch:pitchOf(still),walkedPitch:pitchOf(walked),climb:walked.position[1]-still.position[1]}
    // Uphill flattens the view; downhill looks further down. Ground-height clamping can only raise the eye.
    if(stage==='before');else if(sign<0)assert(data.cameraPitch<still.orbit.pitch-.08,JSON.stringify(data));else assert(data.cameraPitch>still.orbit.pitch+.1,JSON.stringify(data))
    assert(sign<0?data.climb>0:data.climb<0,name+' walk direction '+JSON.stringify(data))
    check(name,data)
  }
  assert.equal(report.errors.length,0,report.errors.join('\n'));report.status='PASS'
} catch (error) {
  report.status = 'FAIL'; report.failure = String(error?.stack ?? error); process.exitCode = 1
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
