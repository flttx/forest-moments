// Isolated headless Edge only. CDP pattern reused from my-blog/scripts/t10-gait-check.mjs.
import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createHeadlessBrowser } from './browser-session.mjs'

const stage = process.env.FOREST_RENDER_STAGE ?? 'development-v1'
const out = resolve(`docs/evidence/2026-10-24-lookout/${stage}`)
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

  const key=async(name,down)=>{const map={f:['KeyF',70],a:['KeyA',65],d:['KeyD',68],w:['KeyW',87],s:['KeyS',83],Escape:['Escape',27]};await cmd('Input.dispatchKeyEvent',{type:down?'keyDown':'keyUp',key:name,code:map[name][0],windowsVirtualKeyCode:map[name][1]})}
  const press=async(name)=>{await key(name,true);await key(name,false)}
  // Frame rate varies in headless Edge, so hold until the limit is reached instead of for a fixed time.
  const holdUntil=async(name,reached,maxMs=8000)=>{await key(name,true);for(const t=Date.now();Date.now()-t<maxMs&&!reached((await snapshot()).lookoutView);)await sleep(50);await key(name,false)}
  const hold=async(name,ms)=>{await key(name,true);await sleep(ms);await key(name,false)}
  for(const light of (process.env.FOREST_LIGHTS??'day,dusk,night').split(',')){
    await cmd('Page.navigate',{url:`http://127.0.0.1:5176/?qa&light=${light}`})
    await waitFor(s=>s?.ready&&s.lookoutReady&&s.farmReady,'ready',90000)
    await evaluate("import(performance.getEntriesByType('resource').find(e=>new URL(e.name).pathname==='/src/game/store.ts').name).then(({useForestStore:s})=>s.getState().updatePosition(13,-23.2))")
    await sleep(300);await press('f');assert.equal((await snapshot()).mode,'walking')
    await evaluate("import(performance.getEntriesByType('resource').find(e=>new URL(e.name).pathname==='/src/game/store.ts').name).then(({useForestStore:s})=>s.getState().updatePosition(9.05,-29.85))")
    await sleep(1500);const initial=await snapshot();await shot(`${light}-entry`)
    await press('f');await press('f')
    const samples=[]
    for(let i=0;i<50;i++){samples.push(await evaluate("({s:JSON.parse(document.querySelector('canvas').dataset.forestQa),opacity:Number(document.querySelector('.boat-transfer-shade').style.opacity)})"));if(samples.at(-1).s.mode==='lookout'&&!samples.at(-1).s.lookoutTransfer)break;await sleep(20)}
    const state=await waitFor(s=>s?.mode==='lookout'&&!s.lookoutTransfer,'entered')
    assert.equal(state.playerVisible,false);assert.deepEqual(state.position,initial.position)
    assert.deepEqual(state.cameraPosition,[11.5,12.7,-31.5])
    const commit=samples.find(s=>s.s.lookoutTransfer?.committed)
    assert(commit&&commit.opacity===1,'camera must switch inside opaque shade')
    await shot(`${light}-island`)
    await hold('d',2300);await shot(`${light}-sea`)
    await holdUntil('w',v=>v.pitch>=.18);assert.equal((await snapshot()).lookoutView.pitch,.18);await shot(`${light}-upper-limit`)
    await holdUntil('s',v=>v.pitch<=-.48);assert.equal((await snapshot()).lookoutView.pitch,-.48);await shot(`${light}-lower-limit`)
    await key('a',true);await sleep(200);await evaluate("window.dispatchEvent(new Event('blur'))")
    const paused=(await snapshot()).lookoutView.yaw;await sleep(300);assert.equal((await snapshot()).lookoutView.yaw,paused);await key('a',false)
    await press('Escape');await waitFor(s=>s?.mode==='walking'&&!s.lookoutTransfer,'returned')
    assert.deepEqual((await snapshot()).position,initial.position);assert.equal((await snapshot()).playerVisible,true)
    await sleep(600);await shot(`${light}-returned`)
    await press('f');await waitFor(s=>s?.mode==='lookout'&&!s.lookoutTransfer,'repeat entry')
    await evaluate("document.querySelector('[aria-label=\"向左环顾\"]').click()")
    assert(Math.abs((await snapshot()).lookoutView.yaw-(-2.11))<.001)
    await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent.includes('返回塔脚')).click()")
    await waitFor(s=>s?.mode==='walking'&&!s.lookoutTransfer,'button exit')
    await press('f');await waitFor(s=>s?.mode==='lookout'&&!s.lookoutTransfer,'third entry');await press('f');await waitFor(s=>s?.mode==='walking'&&!s.lookoutTransfer,'keyboard F exit')
    check(`${light}: reach, shade, turn, tilt bounds, blur, repeated enter/exit and exact return`,{initial,entered:state,commitOpacity:commit.opacity})
  }
  assert.equal(report.errors.length,0,report.errors.join('\n'));report.status='PASS'
}catch(error){report.status='FAIL';report.failure=String(error);process.exitCode=1;if(socket?.readyState===1){try{await shot('headless-failure')}catch{}}}
finally{
  try {
    await writeFile(`${out}/headless-validation.json`,JSON.stringify(report,null,2)+'\n');if(socket?.readyState===1){try{await cmd('Browser.close')}catch{}socket.close()}console.log(report.status)
  } finally {
    await cleanup()
  }
}
