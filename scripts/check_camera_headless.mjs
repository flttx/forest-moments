// Isolated headless Edge only. CDP pattern reused from my-blog/scripts/t10-gait-check.mjs.
import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createHeadlessBrowser } from './browser-session.mjs'

const out = resolve(process.env.FOREST_QA_OUT ?? 'docs/evidence/2026-10-24-camera/development-final')
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
  for(const light of ['day','dusk','night']){
    await cmd('Page.navigate',{url:`http://127.0.0.1:5176/?qa&light=${light}`});await sleep(400);await wait(s=>s?.ready&&s.workshopReady,'reload')
    for(const room of ['island','workshop']){
      await state({location:room,position:{x:0,z:0},mode:'walking',nearby:room==='workshop'?'workshop':null,workshopBook:{version:1,phase:'finished'}})
      await sleep(700)
      for(const [keyName,heading] of [['w',0],['d',-Math.PI/2],['s',Math.PI],['a',Math.PI/2]]){
        await hold(keyName,500);await sleep(3200)
        const q=await snapshot();assert(Math.abs(difference(q.followYaw,heading))<.025,JSON.stringify(q));assert(Math.abs(difference(q.followHeading,heading))<.001)
        const offset=[q.cameraPosition[0]-q.position[0],q.cameraPosition[2]-q.position[2]]
        assert(offset[0]*Math.sin(heading)+offset[1]*Math.cos(heading)>.1,'camera remains behind movement')
        await shot(`${light}-${room}-${keyName}`);check(`${light}-${room}-${keyName}`,q)
        const before=q.followHeading;await sleep(200);assert.equal((await snapshot()).followHeading,before)
      }
    }
    await state({location:'island',position:await evaluate("(async()=>{const {workshopDoor}=await import('/src/game/workshop.ts');return workshopDoor})()"),mode:'walking',nearby:'workshop'});await hold('s',300);await sleep(1500);await shot(`${light}-building`);check(`${light}-building`,await snapshot())
    for(const [name,position,keyName] of [['door',{x:0,z:2.5},'w'],['east-wall',{x:3.55,z:1.4},'a'],['bench',{x:0,z:-1.25},'s']]){
      await state({location:'workshop',position,mode:'walking',nearby:'workshop'});await hold(keyName,300);await sleep(1500)
      const q=await snapshot();assert(Math.abs(q.cameraPosition[0])<3.73&&Math.abs(q.cameraPosition[2])<2.73);assert(q.cameraPosition[1]<=3.051)
      await shot(`${light}-${name}`);check(`${light}-${name}`,q)
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
