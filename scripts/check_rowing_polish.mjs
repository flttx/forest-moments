// Isolated headless Edge only. CDP pattern reused from my-blog/scripts/t10-gait-check.mjs.
import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createHeadlessBrowser } from './browser-session.mjs'

const stage = process.env.FOREST_RENDER_STAGE ?? 'development'
const light=process.env.FOREST_QA_LIGHT??'day'
const out = resolve(`docs/evidence/rowing-polish/2026-10-24/${stage}`)
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

  await cmd('Page.navigate',{url:`http://127.0.0.1:5176/?qa&light=${light}`})
  await waitFor(s=>s?.ready&&s.models.length===4&&s.boatReady&&s.dockReady,'ready',90000)
  const codes={w:'KeyW',s:'KeyS',a:'KeyA',d:'KeyD',f:'KeyF',Shift:'ShiftLeft'}
  const pressed=new Set()
  async function key(k,on){if(pressed.has(k)===on)return;await cmd('Input.dispatchKeyEvent',{type:on?'keyDown':'keyUp',key:k,code:codes[k],windowsVirtualKeyCode:k==='Shift'?16:k.toUpperCase().charCodeAt(0)});if(on)pressed.add(k);else pressed.delete(k)}
  async function stop(){for(const k of ['w','s','a','d'])await key(k,false)}
  async function press(k){await key(k,true);await key(k,false)}
  async function walk(x,z,label){
    const start=Date.now()
    for(;;){const s=await snapshot(),dx=x-s.position[0],dz=z-s.position[2];if(Math.hypot(dx,dz)<.16)break;
      if(Date.now()-start>35000)throw Error('Walking blocked '+label+' '+JSON.stringify(s.position));
      // Movement is camera-relative: rotate the world offset into input space with the live orbit yaw.
      const y=s.orbit?.yaw??0,c=Math.cos(y),n=Math.sin(y),ix=dx*c-dz*n,iz=dx*n+dz*c
      await key('d',ix>.08);await key('a',ix<-.08);await key('s',iz>.08);await key('w',iz<-.08);await sleep(45)}
    await stop()
  }
  await key('Shift',true)
  await walk(0,1.4,'east path');await walk(20,1.4,'beach');await walk(23.8,0,'deck');await walk(30.6,0,'end');await key('Shift',false);await walk(30.6,.72,'boarding')
  await shot('01-before-boarding')
  assert((await snapshot()).canBoard)
  await evaluate("window.transferTrace=[];window.collectTransfer=true;function sample(){const s=JSON.parse(document.querySelector('canvas').dataset.forestQa);window.transferTrace.push({mode:s.mode,transfer:s.boatTransfer,opacity:Number(getComputedStyle(document.querySelector('.boat-transfer-shade')).opacity),boat:s.boat});if(window.collectTransfer)requestAnimationFrame(sample)}requestAnimationFrame(sample)")
  await press('f');await key('w',true);await sleep(160);await press('f');await shot('02-boarding-shade');await key('w',false)
  await waitFor(s=>s.mode==='rowing'&&!s.boatTransfer,'boarding finished');await evaluate('window.collectTransfer=false')
  const trace=await evaluate('window.transferTrace');const commit=trace.find(s=>s.mode==='rowing')
  assert(commit&&commit.opacity>=.99);assert.equal((await snapshot()).boat.x,30.6)
  report.transferTrace=trace;check('opaque midpoint and locked repeated inputs',{samples:trace.length,commit})
  await shot('03-seated')
  await key('w',true);await waitFor(s=>s.boat.x>=34.7,'leave berth');await shot('04-moving-water');await key('w',false);await sleep(900)
  const moving=await snapshot();assert(moving.waterFeedback.emittedWake>0);assert(Math.abs(moving.boatSurface.heave)<=.021)
  check('distance-driven wake and bounded hull motion',moving)
  await cmd('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});await sleep(150)
  const reduced=await snapshot();assert.deepEqual(reduced.boatSurface,{heave:0,pitch:0,roll:0});assert.equal(reduced.waterFeedback.active,0)
  await shot('05-reduced-motion');await cmd('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]})
  await key('a',true)
  let frames=[]
  for(let i=0;i<80;i++){
    await sleep(300);const s=await snapshot();frames.push({boat:s.boat,water:s.waterFeedback,surface:s.boatSurface})
    if(i===25||i===55)await shot('06-stroke-'+i)
  }
  await key('a',false);await sleep(100)
  const strokes=await snapshot();assert(strokes.waterFeedback.emittedPaddle>0,'Actual blade contact must emit ripples')
  const marks=frames.flatMap(f=>f.water.marks);const repeated=marks.some((m,i)=>marks.slice(i+1).some(n=>n.x===m.x&&n.z===m.z&&n.age>m.age))
  assert(repeated,'World-space mark must remain at its emission coordinates while aging')
  report.waterSamples=frames;check('real blade contacts and world-space marks',{paddle:strokes.waterFeedback.emittedPaddle,wake:strokes.waterFeedback.emittedWake})
  await sleep(2800);assert.equal((await snapshot()).waterFeedback.active,0);await shot('07-settled-water')
  const angleDiff=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b))
  const turnStart=Date.now()
  for(;;){const b=(await snapshot()).boat,d=angleDiff(0,b.heading);if(Math.abs(d)<.02)break;if(Date.now()-turnStart>14000)throw Error('Align timeout');await key('a',d>0);await key('d',d<0);await sleep(25)}await stop()
  await key('s',true);await waitFor(s=>s.boat.x<=30.7,'return berth');await key('s',false);await sleep(1100)
  await waitFor(s=>s.canLand,'landable');await shot('08-returned')
  await press('f');await evaluate("window.dispatchEvent(new Event('blur'))")
  await waitFor(s=>s.mode==='walking'&&!s.boatTransfer,'landed after blur');await shot('09-landed')
  const landed=await snapshot();assert(Math.abs(landed.position[1]-.12)<.001)
  assert.deepEqual(landed.boatSurface,{heave:0,pitch:0,roll:0})
  await press('f');await waitFor(s=>s.mode==='rowing'&&!s.boatTransfer,'repeat board');await press('f');await waitFor(s=>s.mode==='walking'&&!s.boatTransfer,'repeat land')
  await key('Shift',true);await walk(30.6,0,'deck');await walk(22.5,0,'shore');await key('Shift',false);await shot('10-back-on-island')
  check('repeat transfer and return to island',{landed})
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
