// Real keyboard and mouse island roundtrip, using the project isolated browser helper.
import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createHeadlessBrowser } from './browser-session.mjs'

// Each run writes a separate evidence directory; user browser profiles and saves are untouched.
const out = resolve(process.env.FOREST_QA_OUT ?? 'docs/evidence/2026-10-29-mist-island/first')
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
const snapshot = async () => {
  try { return await evaluate("(()=>{const s=JSON.parse(document.querySelector('canvas')?.dataset.forestQa || 'null');return s?{...s,documentId:performance.timeOrigin}:null})()") }
  catch(e){if(/Execution context was destroyed|Cannot find context/.test(String(e)))return null;throw e}
}
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

  const codes={w:'KeyW',s:'KeyS',a:'KeyA',d:'KeyD',f:'KeyF',p:'KeyP',Shift:'ShiftLeft'}
  const pressed=new Set()
  async function key(k,on){if(pressed.has(k)===on)return;await cmd('Input.dispatchKeyEvent',{type:on?'keyDown':'keyUp',key:k,code:codes[k],windowsVirtualKeyCode:k==='Shift'?16:k.toUpperCase().charCodeAt(0)});if(on)pressed.add(k);else pressed.delete(k)}
  async function stop(){for(const k of [...pressed])await key(k,false)}
  async function press(k){await key(k,true);await key(k,false)}
  async function modules(){await evaluate(`(async()=>{const r=p=>performance.getEntriesByType('resource').find(e=>new URL(e.name).pathname===p)?.name??p;window.qa={S:(await import(r('/src/game/store.ts'))).useForestStore,C:await import(r('/src/world/worldConfig.ts')),R:await import(r('/src/game/rowing.ts')),M:await import(r('/src/game/movement.ts')),I:await import(r('/src/world/mistIsland.ts')),T:await import(r('/src/game/islandTravel.ts')),U:(await import(r('/src/game/uiStore.ts'))).useUiStore,P:(await import(r('/src/game/photoStore.ts'))).usePhotoStore};qa.U.setState({guideSeen:true,panel:null})})()`)}
  await modules()
  assert(Math.hypot(...(await snapshot()).position.filter((_,i)=>i!==1))<1,'old save still starts on main island')
  check('legacy save starts on main island with the original boat',true)
  await evaluate("history.replaceState(null,'','/?qa&view=archipelago');qa.S.setState({menuPaused:true})")
  await sleep(1200);await shot('01-island-scale')
  // Fixture setup places the player at the existing departure berth only. All travel after F is real input.
  await evaluate("history.replaceState(null,'','/?qa');qa.S.setState({position:{...qa.C.berths.main.landing},nearby:'dock',menuPaused:false})")
  await sleep(500);await press('f');await waitFor(s=>s.mode==='rowing'&&!s.boatTransfer,'board main')
  const angleDiff=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b))
  async function align(heading){
    await stop();const start=Date.now()
    for(;;){const b=(await snapshot()).boat,d=angleDiff(heading,b.heading);if(Math.abs(d)<.025)break;
      if(Date.now()-start>16000)throw Error('Turn blocked '+JSON.stringify(b));await key('a',d>0);await key('d',d<0);await sleep(35)}await stop()
  }
  const route=[]
  async function sail(x,z,label){
    const start=Date.now()
    for(;;){const s=await snapshot(),b=s.boat,dx=x-b.x,dz=z-b.z,dist=Math.hypot(dx,dz);if(dist<.27)break;
      if(Date.now()-start>65000)throw Error('Sailing blocked '+label+' '+JSON.stringify(b));
      const d=angleDiff(Math.atan2(-dz,dx),b.heading)
      await key('a',d>.025);await key('d',d<-.025);await key('w',Math.abs(d)<.3)
      route.push({x:b.x,z:b.z,heading:b.heading});await sleep(35)}await stop();await sleep(600)
  }
  const start=Date.now()
  await sail(48,2.15,'leave main jetty');await sail(56,-7,'channel');await press('f');assert.equal((await snapshot()).mode,'rowing')
  await sail(74,-12.15,'mist approach');await align(0);await sail(80.6,-12.15,'mist berth');await align(0)
  report.outboundSeconds=(Date.now()-start)/1000
  await press('f');await waitFor(s=>s.mode==='walking'&&!s.boatTransfer,'land mist')
  assert.equal((await snapshot()).travel.checkpoint,'mist');assert((await snapshot()).travel.visitedMist)
  await shot('02-landed-mist');check('real keyboard crossing and landing at the neighbour',report.outboundSeconds)
  const mistDocument=(await snapshot()).documentId
  await cmd('Page.reload');await waitFor(s=>s?.documentId!==mistDocument&&s?.ready&&s.boatReady&&s.dockReady,'reload mist',90000);await modules();await sleep(800)
  const restored=await snapshot();assert.equal(restored.travel.checkpoint,'mist');assert(restored.canBoard);check('reload on neighbour restores player and returnable boat',restored.position)
  async function walk(x,z){
    const start=Date.now()
    for(;;){const s=await snapshot(),dx=x-s.position[0],dz=z-s.position[2];if(Math.hypot(dx,dz)<.21)break
      if(Date.now()-start>45000)throw Error('Walk blocked '+JSON.stringify({x,z,position:s.position}))
      const target=Math.atan2(-dx,-dz),yaw=s.orbit.yaw,delta=angleDiff(target,yaw)/.004
      await key('w',false)
      await cmd('Input.dispatchMouseEvent',{type:'mousePressed',x:720,y:450,button:'right',buttons:2,clickCount:1})
      await cmd('Input.dispatchMouseEvent',{type:'mouseMoved',x:720+delta,y:450,button:'right',buttons:2})
      await cmd('Input.dispatchMouseEvent',{type:'mouseReleased',x:720+delta,y:450,button:'right',buttons:0,clickCount:1})
      await key('w',true);await sleep(Math.min(600,Math.max(70,Math.hypot(dx,dz)*600)))
    }await stop()
  }
  for(const [x,z] of [[88.2,-10],[95,-10],[102,-6],[106,-6.3]])await walk(x,z)
  assert((await snapshot()).travel.foundPine);check('walking reaches the old pine and records discovery',true)
  await press('p');await sleep(300);assert(await evaluate('qa.P.getState().active'));await shot('03-pine-photo')
  await cmd('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await cmd('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27})
  for(const light of ['day','dusk','night'])for(const view of ['mistOverview','mistBerth','mistPine','archipelago']){
    await evaluate(`history.replaceState(null,'','/?qa&view=${view}');qa.S.setState({timeOfDay:'${light}',menuPaused:true})`)
    await sleep(900);await shot(`${light}-${view}`)
  }
  report.frames=await evaluate(`new Promise(resolve=>{const t=[];let p=performance.now();function f(n){t.push(n-p);p=n;if(t.length<180)requestAnimationFrame(f);else{t.sort((a,b)=>a-b);resolve({median:t[90],p95:t[171],low:qa.P.getState().lowQuality,view:'archipelago',light:'night',samples:180})}}requestAnimationFrame(f)})`)
  await evaluate("history.replaceState(null,'','/?qa');qa.S.setState({timeOfDay:'day',menuPaused:false})")
  for(const [x,z] of [[111,-5],[116,-1],[118,-13],[110,-20],[99,-18],[95,-10],[88.2,-10],[80.6,-10.8]])await walk(x,z)
  assert((await snapshot()).canBoard);check('forest trail returns to the same berth',true)
  await press('f');await waitFor(s=>s.mode==='rowing'&&!s.boatTransfer,'reboard mist')
  await sail(74,-12.15,'leave mist');await sail(56,-7,'return channel');await sail(48,2.15,'main approach');await align(Math.PI);await sail(42.6,2.15,'main berth');await align(Math.PI)
  await press('f');await waitFor(s=>s.mode==='walking'&&!s.boatTransfer,'land main');assert.equal((await snapshot()).travel.checkpoint,'main')
  await shot('04-returned-main');check('real keyboard return trip and main berth landing',true)
  const mainDocument=(await snapshot()).documentId
  await cmd('Page.reload');await waitFor(s=>s?.documentId!==mainDocument&&s?.ready&&s.boatReady&&s.dockReady,'reload main',90000);await modules();await sleep(700)
  assert((await snapshot()).travel.foundPine);assert((await snapshot()).canBoard);check('main-island reload preserves discovery and moored boat',true)
  for(const [width,height] of [[1920,1080],[1280,720],[1024,768]]){
    await cmd('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});await evaluate("qa.U.setState({panel:'places'})");await sleep(400)
    assert(await evaluate('document.documentElement.scrollWidth<=innerWidth'));await shot(`places-${width}x${height}`)
  }
  check('places panel in three PC sizes',true)
  report.travel=await evaluate('qa.S.getState().travel');report.routeSamples=route.length
  await writeFile(`${out}/route.json`,JSON.stringify(route));assert.deepEqual(report.errors,[]);report.status='PASS'
}catch(e){report.status='FAIL';report.failure=e.stack??String(e);console.error(e);process.exitCode=1}
finally{try{await writeFile(`${out}/report.json`,JSON.stringify(report,null,2))}finally{if(socket?.readyState===1){try{await cmd('Browser.close')}catch{/* Browser may close its socket before replying. */}}socket?.close();await cleanup()}}
