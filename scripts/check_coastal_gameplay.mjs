// Isolated headless Edge only. CDP pattern reused from my-blog/scripts/t10-gait-check.mjs.
import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createHeadlessBrowser } from './browser-session.mjs'

const stage = process.env.FOREST_RENDER_STAGE ?? 'coastal-gameplay'
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

  await cmd('Page.navigate',{url:'http://127.0.0.1:5176/?qa'})
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
      await key('d',dx>.08);await key('a',dx<-.08);await key('s',dz>.08);await key('w',dz<-.08);await sleep(45)}
    await stop()
  }
  await key('Shift',true)
  await walk(-1,8,'grove');await walk(0,8,'plant');await press('f')
  await waitFor(s=>s?.tree?.stage===0&&s.mode==='walking','planting completed')
  assert.equal(await evaluate("JSON.parse(localStorage.getItem('forest-moments:tree:v2')).version"),2)
  await walk(-1.2,10.9,'workshop path');await walk(-12,11.3,'workshop front');await shot('01-workshop-front')
  await key('w',true);await sleep(1200);await key('w',false)
  const wall=await snapshot();assert(wall.position[2]>10.4&&wall.position[2]<10.6)
  check('relocated workshop collision',wall.position)
  await walk(-12,11.3,'leave workshop');await walk(-1.2,10.9,'main path');await walk(-1.2,1.4,'east path')
  await walk(13,1.4,'tower approach');await walk(13,-4.7,'tower entrance');await shot('02-tower-entrance')
  await walk(13,1.4,'beach branch');await walk(20,1,'beach');await walk(23.8,0,'dock entrance')
  await walk(30.6,0,'dock end');await key('Shift',false);await walk(30.6,.72,'boarding')
  const deck=await snapshot();assert.equal(deck.position[1],.12);assert(deck.canBoard);await shot('03-on-dock');check('beach and dock support feet',deck.position)
  await press('f');await waitFor(s=>s.mode==='rowing'&&!s.boatTransfer,'board');await shot('04-boat-start')
  const route=[]
  const angleDiff=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b))
  async function align(heading){
    await stop();const start=Date.now()
    for(;;){const b=(await snapshot()).boat,d=angleDiff(heading,b.heading);if(Math.abs(d)<.025)break;
      if(Date.now()-start>15000)throw Error('Turn blocked '+JSON.stringify(b));await key('a',d>0);await key('d',d<0);await sleep(35)}await stop()
  }
  async function sail(x,z,label,reverse=false){
    const start=Date.now()
    for(;;){const s=await snapshot(),b=s.boat,dx=x-b.x,dz=z-b.z,dist=Math.hypot(dx,dz);if(dist<.16)break;
      if(Date.now()-start>40000)throw Error('Sailing blocked '+label+' '+JSON.stringify(b));
      const target=Math.atan2(-dz,dx)+(reverse?Math.PI:0),d=angleDiff(target,b.heading);
      await key('a',d>.035);await key('d',d<-.035);await key(reverse?'s':'w',Math.abs(d)<.4);
      route.push({boat:b,ms:Date.now(),calls:s.calls,triangles:s.triangles});await sleep(45)}await stop()
  }
  await sail(34.8,2.15,'leave pier')
  await press('f');assert.equal((await snapshot()).mode,'rowing');check('cannot land away from pier',true)
  const radii=await evaluate("import('/src/world/worldConfig.ts').then(m=>Array.from({length:73},(_,i)=>{const a=.065+i*Math.PI*2/72,r=m.shorelineRadius(a)+8;return [Math.cos(a)*r,Math.sin(a)*r]}))")
  await evaluate("window.routeFrames=[];window.routeSampling=true;let last;function sample(t){document.querySelector('canvas').getContext('webgl2').finish();if(last!==undefined)window.routeFrames.push(t-last);last=t;if(window.routeSampling)requestAnimationFrame(sample)}requestAnimationFrame(sample)")
  for(let i=0;i<radii.length;i++){await sail(...radii[i],'circuit '+i);if(i%18===0){await shot('05-sea-quadrant-'+i);console.log('SEA QUADRANT '+i)}}
  await evaluate('window.routeSampling=false');const frames=await evaluate('window.routeFrames');frames.sort((a,b)=>a-b)
  report.movingCadence={frames:frames.length,meanFrameMs:frames.reduce((a,b)=>a+b,0)/frames.length,p95FrameMs:frames[Math.floor(frames.length*.95)],maxFrameMs:frames.at(-1),mode:'uncapped headless RAF with gl.finish; not display FPS'}
  await sail(34.8,2.15,'boundary approach');await align(0);await key('w',true);await sleep(9000);await key('w',false);await sleep(400)
  const boundary=await snapshot();await shot('06-sea-boundary');
  const limit=await evaluate("import('/src/game/rowing.ts').then(m=>{const b=JSON.parse(document.querySelector('canvas').dataset.forestQa).boat;return {fits:m.boatFits(b.x,b.z,b.heading),clearance:m.seaBoundaryClearance(b.x,b.z)}})")
  assert(limit.fits&&limit.clearance<.4);assert(boundary.boat.speed<.02);check('entire hull stops at island-following limit',{boat:boundary.boat,...limit})
  await sail(30.6,2.15,'return mooring',true);await align(0);await sleep(1100)
  await waitFor(s=>s.canLand,'stop parallel to pier');await shot('07-returned-boat');await press('f');await waitFor(s=>s.mode==='walking'&&!s.boatTransfer,'land');await shot('08-landed')
  await press('f');await waitFor(s=>s.mode==='rowing'&&!s.boatTransfer,'board again');await press('f');await waitFor(s=>s.mode==='walking'&&!s.boatTransfer,'land again')
  check('full circuit, reverse, repeat boarding and landing',{samples:route.length});report.route=route
  await walk(30.6,0,'deck centre');await key('Shift',true);await walk(22.5,0,'past shore posts');await walk(20,1,'beach');await walk(0,1.4,'return');await walk(0,0,'spawn');await key('Shift',false)
  await shot('09-returned-to-spawn');assert.equal(report.errors.length,0,report.errors.join('\n'))
  const previous=await evaluate('performance.timeOrigin');await cmd('Page.reload')
  for(let i=0;i<100;i++){await sleep(80);try{if(await evaluate('performance.timeOrigin')!==previous)break}catch{/* Context replacement. */}}
  await waitFor(s=>s?.ready&&s.dockReady,'reloaded scene',90000)
  assert(await evaluate("document.querySelector('.landmarks').textContent.includes('已种植')"));check('seedling persists after reload',true)
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
