// Controlled mist-island detail views and trail regression, using the isolated browser helper.
import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createHeadlessBrowser } from './browser-session.mjs'

// Each run writes a separate evidence directory; user browser profiles and saves are untouched.
const out = resolve(process.env.FOREST_QA_OUT ?? 'docs/evidence/2026-10-29-mist-detail/before')
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
  try { return await evaluate("(()=>{const s=JSON.parse(document.querySelector('canvas')?.dataset.forestQa || 'null');return s?{...s,loading:!!document.querySelector('.asset-loading'),documentId:performance.timeOrigin}:null})()") }
  catch(e){if(/Execution context was destroyed|Cannot find context/.test(String(e)))return null;throw e}
}
async function waitFor(predicate, label, limit = 45000) {
  const start = Date.now()
  while (Date.now() - start < limit) { const value = await snapshot(); if (predicate(value)) return value; await sleep(100) }
  throw Error(`Timeout: ${label}; state=${JSON.stringify(await snapshot())}`)
}
async function shot(name) {
  await waitFor(s=>s?.ready&&!s.loading,'visible scene before screenshot',90000)
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
  await waitFor(s=>s?.ready&&s.models.length===4&&s.boatReady,'ready',90000)
  await evaluate(`(async()=>{const r=p=>performance.getEntriesByType('resource').find(e=>new URL(e.name).pathname===p)?.name??p;window.S=(await import(r('/src/game/store.ts'))).useForestStore;window.U=(await import(r('/src/game/uiStore.ts'))).useUiStore;window.P=(await import(r('/src/game/photoStore.ts'))).usePhotoStore;U.setState({guideSeen:true,panel:null});S.setState({position:{x:106,z:-6.3},timeOfDay:'day',menuPaused:true})})()`)
  await sleep(1200)
  const views=process.env.FOREST_LOG_VIEWS==='1'?['mistLog','mistLogMouth','mistEdge']:['mistOverview','mistUnderstory','mistRidge','mistBerth']
  for(const light of ['day','dusk','night'])for(const view of views){
    await evaluate(`history.replaceState(null,'','/?qa&view=${view}');S.setState({timeOfDay:'${light}'})`)
    await sleep(700);await shot(`${light}-${view}`)
  }
  report.frames=await evaluate(`new Promise(resolve=>{const t=[];let p=performance.now();function f(n){t.push(n-p);p=n;if(t.length<180)requestAnimationFrame(f);else{t.sort((a,b)=>a-b);resolve({median:t[90],p95:t[171],low:P.getState().lowQuality,samples:180,view:${JSON.stringify(views.at(-1))},light:'night'})}}requestAnimationFrame(f)})`)
  check('three lighting presets and matching views',views)
  if(process.env.FOREST_SHORE_AFTER==='1'){
    const veil=()=>evaluate("(()=>{const m=forestScene.getObjectByName('mist-ridge-veil');return m?{time:m.material.uniforms.mistTime.value,density:m.material.uniforms.density.value,tint:m.material.uniforms.tint.value.toArray(),depthTest:m.material.depthTest,depthWrite:m.material.depthWrite}:null})()")
    const night=await veil();assert(night?.depthTest&&!night.depthWrite)
    await evaluate("history.replaceState(null,'','/?qa&view=mistRidge');S.setState({timeOfDay:'day'})")
    await cmd('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]})
    await sleep(300);const frozen=await veil();await sleep(900);assert.equal((await veil()).time,frozen.time)
    await shot('day-reduced-mistRidge')
    const day=await veil();assert(day.tint.reduce((a,b)=>a+b)>night.tint.reduce((a,b)=>a+b))
    await cmd('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]})
    await sleep(500);assert((await veil()).time>frozen.time)
    await evaluate("P.setState({active:true,weatherPreview:'rain'})");await sleep(6000)
    const rain=await veil();assert(rain.density>day.density);await shot('rain-mistRidge')
    await evaluate("history.replaceState(null,'','/?qa&view=mistBerth')");await sleep(600);await shot('rain-mistBerth')
    await evaluate("P.setState({active:false,weatherPreview:null})");await sleep(4000)
    check('local veil: reduced motion freeze/resume, night tint, rain and depth occlusion settings',{day,night,rain,frozen})
    const layout=await evaluate(`(async()=>{
      const r=p=>performance.getEntriesByType('resource').find(e=>new URL(e.name).pathname===p)?.name??p;
      const [t,w,m,v,c]=await Promise.all(['/src/world/terrain.ts','/src/world/worldConfig.ts','/src/game/movement.ts','/src/world/vegetationLayout.ts','/src/world/coastalLayout.ts'].map(p=>import(r(p))));
      const terrainSamples=[];for(let x=-32;x<=40;x+=2)for(let z=-40;z<=40;z+=2)terrainSamples.push([x,z,t.terrainHeight(x,z)]);
      let walkable=0;for(let x=78;x<135;x+=.5)for(let z=-36;z<17;z+=.5)if(m.canStandAt(x,z))walkable+=.25;
      return{walkable,terrainSamples,plants:v.vegetationPositions,lamps:v.lampPositions,landing:w.landing,mooring:w.mooring,ridgePieces:c.mistRidgePieces.length};
    })()`)
    const baseline=JSON.parse(await readFile('docs/evidence/2026-10-29-west-expansion/before/world-snapshot.json','utf8'))
    function close(a,b){if(typeof a==='number'){assert(Math.abs(a-b)<1e-10);return}if(a&&typeof a==='object'){assert.deepEqual(Object.keys(a),Object.keys(b));for(const k of Object.keys(a))close(a[k],b[k]);return}assert.equal(a,b)}
    close(layout.terrainSamples,baseline.terrainSamples);close(layout.plants.filter(p=>p.x>=-35&&p.x<72),baseline.plants)
    close(layout.lamps,baseline.lamps);close(layout.landing,baseline.landing);close(layout.mooring,baseline.mooring)
    const ratio=layout.walkable/baseline.walkableArea;assert(ratio>=.2&&ratio<=.25)
    report.layout={sampleStep:.5,originalMainWalkable:baseline.walkableArea,mistWalkable:layout.walkable,ratio,ridgePieces:layout.ridgePieces,mistPlants:layout.plants.filter(p=>p.x>72).reduce((a,p)=>({...a,[p.kit]:(a[p.kit]??0)+1}),{}),originalTerrainSamplesUnchanged:baseline.terrainSamples.length,originalPlantsUnchanged:baseline.plants.length,originalLampsAndBerthUnchanged:true,crossEngineTolerance:1e-10}
    check('smaller island area and original main island preserved',report.layout)
  }
  if(process.env.FOREST_DETAIL_AFTER==='1'){
    await waitFor(()=>true,'snapshot')
    report.ferns=await evaluate("forestScene.getObjectByName('mist-ferns')?.userData.qa")
    assert(report.ferns?.count>0);check('authored fern model loaded as instances',report.ferns)
    await evaluate("history.replaceState(null,'','/?qa');S.setState({position:{x:95,z:-10},timeOfDay:'day',menuPaused:false})")
    await sleep(500)
    async function key(on){await cmd('Input.dispatchKeyEvent',{type:on?'keyDown':'keyUp',key:'w',code:'KeyW',windowsVirtualKeyCode:87})}
    async function walk(x,z){const start=Date.now();for(;;){const s=await snapshot(),dx=x-s.position[0],dz=z-s.position[2],distance=Math.hypot(dx,dz);if(distance<.23)break;if(Date.now()-start>40000)throw Error('blocked '+JSON.stringify({x,z,p:s.position}));await key(false);const a=Math.atan2(-dx,-dz)-s.orbit.yaw,delta=Math.atan2(Math.sin(a),Math.cos(a))/.004;await cmd('Input.dispatchMouseEvent',{type:'mousePressed',x:720,y:450,button:'right',buttons:2,clickCount:1});await cmd('Input.dispatchMouseEvent',{type:'mouseMoved',x:720+delta,y:450,button:'right',buttons:2});await cmd('Input.dispatchMouseEvent',{type:'mouseReleased',x:720+delta,y:450,button:'right',buttons:0,clickCount:1});await key(true);await sleep(Math.min(600,Math.max(70,distance*600)))}await key(false)}
    for(const [x,z] of [[99,-18],[110,-20],[118,-13],[116,-1],[106,4],[98,0],[95,-10],[102,-6],[106,-6.3]])await walk(x,z)
    assert((await snapshot()).travel.foundPine);await shot('walking-pine');check('real keyboard north ridge and complete forest loop with discovery',true)
    if(process.env.FOREST_LOG_VIEWS==='1'){
      report.logs=await evaluate("forestScene.getObjectByName('mist-hollow-logs')?.userData.qa")
      assert.equal(report.logs?.count,2)
      assert(report.logs.bounds.max.x<=1.65&&report.logs.bounds.min.x>=-1.65)
      assert(report.logs.bounds.max.z<=.55&&report.logs.bounds.min.z>=-.55)
      const p={x:101,z:-9.5,yaw:-.3},hx=2.1,hz=1
      const point=(x,z)=>({x:p.x+Math.cos(p.yaw)*x+Math.sin(p.yaw)*z,z:p.z-Math.sin(p.yaw)*x+Math.cos(p.yaw)*z})
      const start=point(-hx,-hz)
      await evaluate(`S.setState({position:${JSON.stringify(start)}})`);await sleep(300)
      for(const [x,z] of [[hx,-hz],[hx,hz],[-hx,hz],[-hx,-hz],[-hx,0]]){const q=point(x,z);await walk(q.x,q.z)}
      await shot('walked-around-log')
      const approach=point(0,1.25)
      await evaluate(`S.setState({position:${JSON.stringify(approach)}})`);await sleep(300)
      const s=await snapshot(),target=Math.atan2(Math.sin(p.yaw),Math.cos(p.yaw)),a=target-s.orbit.yaw,delta=Math.atan2(Math.sin(a),Math.cos(a))/.004
      await cmd('Input.dispatchMouseEvent',{type:'mousePressed',x:720,y:450,button:'right',buttons:2,clickCount:1})
      await cmd('Input.dispatchMouseEvent',{type:'mouseMoved',x:720+delta,y:450,button:'right',buttons:2})
      await cmd('Input.dispatchMouseEvent',{type:'mouseReleased',x:720+delta,y:450,button:'right',buttons:0,clickCount:1})
      await key(true);await sleep(1400);await key(false)
      const stopped=await snapshot(),dx=stopped.position[0]-p.x,dz=stopped.position[2]-p.z,localZ=Math.sin(p.yaw)*dx+Math.cos(p.yaw)*dz
      assert(localZ>.8&&localZ<1.15,`log side collision: ${localZ}`);await shot('log-collision')
      check('authored log bounds, real keyboard loop around it and solid-side collision',{logs:report.logs,localZ})
      await evaluate("S.setState({position:{x:106,z:-6.3}})");await sleep(300)
    }
    await evaluate("P.setState({active:true})");await sleep(400);await shot('pine-photo')
    await evaluate("P.setState({active:false});U.setState({panel:'places'})")
    await evaluate("[...document.querySelectorAll('.place-list strong')].find(e=>e.textContent.includes('古松'))?.scrollIntoView({block:'center'})");await sleep(400);await shot('discovery-panel')
  }
  assert.deepEqual(report.errors,[]);report.status='PASS'
}catch(e){report.status='FAIL';report.failure=e.stack??String(e);console.error(e);process.exitCode=1}
finally{try{await writeFile(`${out}/report.json`,JSON.stringify(report,null,2))}finally{if(socket?.readyState===1){try{await cmd('Browser.close')}catch{/* Socket may close before the reply. */}}socket?.close();await cleanup()}}
