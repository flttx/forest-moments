// Isolated headless Edge only. CDP pattern reused from my-blog/scripts/t10-gait-check.mjs.
import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createHeadlessBrowser } from './browser-session.mjs'

const out=resolve(process.env.FOREST_QA_OUT??'docs/evidence/2026-10-25-expansion/navigation-final')
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
const keys = { w: ['KeyW', 87], s: ['KeyS', 83], a: ['KeyA', 65], d: ['KeyD', 68], Shift: ['ShiftLeft', 16], f: ['KeyF', 70], Escape:['Escape',27], Space:['Space',32] }
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
  await state({position:{x:-14,z:-15},location:'island',mode:'walking',nearby:null});await sleep(1000)
  const trace=[]
  for(const z of [-16.5,-18,-19.5,-21,-22.5,-24]){await walkTo({x:-14,z});trace.push(await snapshot());if(z===-19.5)await shot('01-crossing-bridge')}
  await walkTo({x:-15,z:-24.5});await shot('02-cabin-door');await press('f');await wait(s=>s.location==='bedroom'&&!s.homeTransfer,'enter bedroom');check('continuous camera-relative keys across bridge to bedroom',{trace,state:await snapshot()})
  await walkTo({x:-1,z:-.5});await press('f');await wait(s=>s.mode==='sleeping','sleep');await sleep(600);await shot('03-sleep-live-camera');await press('Escape');await wait(s=>s.mode==='walking','wake')
  await walkTo({x:0,z:0});await walkTo({x:2,z:-.3});await press('f');assert(await evaluate("!!document.querySelector('[aria-label=卧室鱼缸]')"));await shot('04-tank-live-camera');await press('Escape')
  await walkTo({x:0,z:0});await walkTo({x:0,z:2.5});await press('f');await wait(s=>s.location==='island'&&!s.homeTransfer,'exit bedroom');check('bedroom furniture navigation and early waking',await snapshot())
  await state({position:{x:15.45,z:-27.65},location:'island',mode:'walking',nearby:'lookout'});await press('f');await wait(s=>s.mode==='lookout'&&!s.lookoutTransfer,'tower');await shot('05-highland-lookout');await press('Escape');await wait(s=>s.mode==='walking'&&!s.lookoutTransfer,'leave tower')
  await state({position:{x:42.6,z:.8},location:'island',mode:'walking',nearby:'dock'});await press('f');await wait(s=>s.mode==='rowing'&&!s.boatTransfer,'board');await hold('w',1100);await shot('06-expanded-coast-rowing');await key('s',true);await wait(s=>s.boat.x<42.7,'reverse to dock');await key('s',false);await wait(s=>s.canLand,'stop at dock');await press('f');await wait(s=>s.mode==='walking'&&!s.boatTransfer,'land');check('new dock boarding, rowing and returning',await snapshot())
  await state({position:{x:1.5,z:-5},location:'island',mode:'walking',nearby:'pond'});await press('f');await wait(s=>s.fishing?.phase==='bite','bite');await press('f');await wait(s=>s.fishing?.phase==='reeling','hook')
  let held=false
  for(let i=0;i<400;i++){const s=await snapshot();if(s.fishing.phase!=='reeling')break;const next=held?s.fishing.tension<.72:s.fishing.tension<.3;if(next!==held){held=next;await key('Space',held)}await sleep(50)}
  await key('Space',false);await wait(s=>s.fishing?.phase==='caught','catch');assert.equal((await snapshot()).fishBook.count,1);await shot('07-real-catch');await press('Escape')
  await state({position:{x:-15,z:-24.5},location:'island',mode:'walking'});await press('f');await wait(s=>s.location==='bedroom'&&!s.homeTransfer,'return home with catch');await walkTo({x:0,z:0});await walkTo({x:2,z:-.3});await press('f');await sleep(100)
  await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent==='放入鱼缸').click()");await sleep(700);assert.equal((await snapshot()).homeBook.fish.length,1);await shot('08-actual-catch-in-aquarium');check('fish caught through F and tension controls becomes a resident',await snapshot())
  await cmd('Page.reload');await sleep(1200);const reloaded=await wait(s=>s?.ready&&s.homeReady&&s.homeBook.fish.length===1,'reload');assert.equal(reloaded.homeBook.fish.length,1);check('aquarium resident survives reload',await snapshot())
  assert.equal(report.errors.length,0,report.errors.join('\n'));report.status='PASS'
} catch (error) {
  report.status = 'FAIL'; report.failure = String(error);report.failureState=await snapshot(); process.exitCode = 1
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
