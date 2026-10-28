// Isolated headless Edge only. CDP pattern reused from my-blog/scripts/t10-gait-check.mjs.
import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createHeadlessBrowser } from './browser-session.mjs'

// Rewritten 2026-10-28 for the expanded island: routes are planned in the page from the game's own collision rules,
// coordinates come from its constants. Writes to a new folder so the 2026-10-24 evidence stays as recorded.
const out = resolve(process.env.FOREST_QA_OUT ?? 'docs/evidence/2026-10-28-tier1/coastal-gameplay')
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
  // Current-map constants and rules, read from the game itself so the route follows the island as it changes.
  await evaluate(`(async()=>{const m=p=>import(p);window.qa={M:await m('/src/game/movement.ts'),G:await m('/src/game/growth.ts'),W:await m('/src/game/workshop.ts'),L:await m('/src/game/lookout.ts'),C:await m('/src/world/worldConfig.ts'),R:await m('/src/game/rowing.ts'),S:(await m('/src/game/store.ts')).useForestStore}
   // Grid path (0.5 m, 8 neighbours) through ground the raccoon can stand on with a little room either side, then
   // shortened to the farthest point still reachable in a straight, clear line (at most 6 m per leg).
   let room=.45
   const clear=(x,z,t)=>[[0,0],[room,0],[-room,0],[0,room],[0,-room],[room*.7,room*.7],[-room*.7,room*.7],[room*.7,-room*.7],[-room*.7,-room*.7]].every(([a,b])=>qa.M.canStandAt(x+a,z+b,t,qa.S.getState().workshopBook.phase))
   const line=(a,b,t)=>{const n=Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/.15);for(let i=1;i<=n;i++)if(!clear(a.x+(b.x-a.x)*i/n,a.z+(b.z-a.z)*i/n,t))return false;return true}
   // Wide berth first; narrow gaps (the jetty between its posts) are tried with less room.
   window.qa.plan=(from,to)=>{for(const r of [.45,.32,.22]){room=r;const p=planWith(from,to);if(p)return p}return null}
   const planWith=(from,to)=>{
    const t=qa.G.trunks(qa.S.getState().garden),step=.5,x0=-46,z0=-46,n=Math.round(92/step),id=(i,k)=>k*n+i,cell=(x,z)=>[Math.round((x-x0)/step),Math.round((z-z0)/step)]
    const [si,sk]=cell(from.x,from.z),[ti,tk]=cell(to.x,to.z),pos=(i,k)=>({x:x0+i*step,z:z0+k*step}),ok=new Map(),free=(i,k)=>{const c=id(i,k);if(!ok.has(c)){const p=pos(i,k);ok.set(c,clear(p.x,p.z,t))}return ok.get(c)}
    const g=new Map([[id(si,sk),0]]),came=new Map(),open=[[Math.hypot(ti-si,tk-sk),si,sk]],done=new Set()
    while(open.length){open.sort((a,b)=>a[0]-b[0]);const [,i,k]=open.shift(),c=id(i,k);if(done.has(c))continue;done.add(c)
     if(Math.abs(i-ti)<=1&&Math.abs(k-tk)<=1){const path=[to];let p=c;while(came.has(p)){p=came.get(p);path.unshift(pos(p%n,Math.floor(p/n)))}path[0]=from
      const out=[from];let at=0;while(at<path.length-1){let j=path.length-1;while(j>at+1&&(Math.hypot(path[j].x-path[at].x,path[j].z-path[at].z)>6||!line(path[at],path[j],t)))j--;out.push(path[j]);at=j}return out.slice(1)}
     for(const [a,b] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){const ni=i+a,nk=k+b;if(ni<0||nk<0||ni>=n||nk>=n||!free(ni,nk))continue
      if(a&&b&&(!free(i+a,k)||!free(i,k+b)))continue
      const nc=id(ni,nk),cost=g.get(c)+Math.hypot(a,b);if(cost<(g.get(nc)??Infinity)){g.set(nc,cost);came.set(nc,c);open.push([cost+Math.hypot(ti-ni,tk-nk),ni,nk])}}}
    return null}})()`)
  // Movement is camera-relative: rotate the world offset into input space with the live orbit yaw, then press the keys
  // of the nearest of the eight directions (a component counts once it is over ~22° of the heading).
  async function steer(dx,dz,yaw){const c=Math.cos(yaw),n=Math.sin(yaw),ix=dx*c-dz*n,iz=dx*n+dz*c,m=Math.hypot(ix,iz)||1
    await key('d',ix/m>.38);await key('a',ix/m<-.38);await key('s',iz/m>.38);await key('w',iz/m<-.38)}
  /** Walks straight to a point; false when the raccoon stops making progress for 1.5 s. */
  async function walk(x,z,label,tolerance=.16){
    let best=Infinity,since=Date.now()
    for(;;){const s=await snapshot(),dx=x-s.position[0],dz=z-s.position[2],d=Math.hypot(dx,dz);if(d<tolerance)break
      if(d<best-.05){best=d;since=Date.now()}else if(Date.now()-since>1500){await stop();return false}
      await steer(dx,dz,s.orbit?.yaw??0);await sleep(35)}
    await stop();return true
  }
  /** Follows a planned path; a leg that stalls is planned again from where the raccoon stands. */
  async function go(to,label){
    for(let attempt=0;attempt<4;attempt++){
      const p=(await snapshot()).position,legs=await evaluate(`qa.plan({x:${p[0]},z:${p[2]}},${JSON.stringify(to)})`)
      assert(legs,`No path to ${label}`)
      let ok=true
      for(let i=0;i<legs.length&&ok;i++)ok=await walk(legs[i].x,legs[i].z,`${label} ${i+1}/${legs.length}`,i<legs.length-1?.3:.16)
      if(ok)return
    }
    throw Error('Walking blocked '+label+' '+JSON.stringify((await snapshot()).position))
  }
  const k=await evaluate('({door:qa.W.workshopDoor,entry:qa.L.lookoutEntry,landing:qa.C.landing,mooring:qa.C.mooring,deckY:qa.C.coastalDock.deckY,workshop:qa.C.workshopPosition})')

  // 1. Plant on the first plot, then walk the island: workshop door, lookout stairs, beach and jetty.
  await key('Shift',true)
  await go({x:0,z:9.2},'grove');await press('f')
  await waitFor(s=>s?.garden?.trees.find(t=>t.spot===0)?.stage===0&&s.mode==='walking','planting completed')
  assert.equal(await evaluate("JSON.parse(localStorage.getItem('forest-moments:tree:v3')).version"),3)
  await evaluate('qa.S.setState({inspectingTree:false})')
  await go(k.door,'workshop door');await shot('01-workshop-front')
  // Pushing on into the building: the wall holds the raccoon at the doorway.
  const towards={x:k.workshop[0],z:k.workshop[2]},begin=Date.now()
  while(Date.now()-begin<1500){const s=await snapshot();await steer(towards.x-s.position[0],towards.z-s.position[2],s.orbit?.yaw??0);await sleep(35)}
  await stop()
  const wall=await snapshot()
  assert(await evaluate(`qa.M.canStandAt(${wall.position[0]},${wall.position[2]})`)&&Math.hypot(wall.position[0]-k.door.x,wall.position[2]-k.door.z)<1.2,JSON.stringify(wall.position))
  check('workshop wall holds at the doorway',wall.position)
  await go(k.entry,'lookout stairs');await shot('02-tower-entrance')
  await go({x:k.landing.x-.6,z:k.landing.z},'jetty');await key('Shift',false);assert(await walk(k.landing.x,k.landing.z,'boarding spot'),'boarding spot')
  const deck=await snapshot();assert.equal(deck.position[1],k.deckY);assert(deck.canBoard);await shot('03-on-dock');check('beach and jetty support feet',deck.position)

  // 2. Row: out from the mooring, a full circuit outside the shoreline, the outer limit, back to the jetty.
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
    for(;;){const s=await snapshot(),b=s.boat,dx=x-b.x,dz=z-b.z,dist=Math.hypot(dx,dz);if(dist<.3)break;
      if(Date.now()-start>40000)throw Error('Sailing blocked '+label+' '+JSON.stringify(b));
      const target=Math.atan2(-dz,dx)+(reverse?Math.PI:0),d=angleDiff(target,b.heading);
      await key('a',d>.035);await key('d',d<-.035);await key(reverse?'s':'w',Math.abs(d)<.4);
      route.push({boat:b,ms:Date.now(),calls:s.calls,triangles:s.triangles});await sleep(35)}await stop()
  }
  // Straight out along the jetty past its end before turning, so the hull never swings into the deck.
  const clearOfJetty={x:k.mooring.x+5,z:k.mooring.z},out1={x:k.mooring.x+6,z:k.mooring.z+3.5}
  assert(await evaluate(`qa.R.boatFits(${out1.x},${out1.z},0)`),'leaving point on open water')
  await sail(clearOfJetty.x,clearOfJetty.z,'along the jetty');await sail(out1.x,out1.z,'leave jetty')
  await press('f');assert.equal((await snapshot()).mode,'rowing');check('cannot land away from the jetty',true)
  const radii=await evaluate("Array.from({length:73},(_,i)=>{const a=.065+i*Math.PI*2/72,r=qa.C.shorelineRadius(a)+8;return [Math.cos(a)*r,Math.sin(a)*r]})")
  await evaluate("window.routeFrames=[];window.routeSampling=true;let last;function sample(t){if(last!==undefined)window.routeFrames.push(t-last);last=t;if(window.routeSampling)requestAnimationFrame(sample)}requestAnimationFrame(sample)")
  for(let i=0;i<radii.length;i++){await sail(...radii[i],'circuit '+i);if(i%18===0){await shot('05-sea-quadrant-'+i);console.log('SEA QUADRANT '+i)}}
  await evaluate('window.routeSampling=false');const frames=await evaluate('window.routeFrames');frames.sort((a,b)=>a-b)
  report.movingCadence={frames:frames.length,medianFrameMs:frames[frames.length>>1],p95FrameMs:frames[Math.floor(frames.length*.95)],maxFrameMs:frames.at(-1),mode:'uncapped headless RAF; not display FPS'}
  check('full circuit outside the shoreline',{legs:radii.length,samples:route.length})
  // Straight out to sea, radially, from a few metres inside the island-following limit until it stops the hull.
  const run=await evaluate("(()=>{const a=.6,r=qa.C.shorelineRadius(a)+5;return{x:Math.cos(a)*r,z:Math.sin(a)*r,heading:-a,clearance:qa.R.seaBoundaryClearance(Math.cos(a)*r,Math.sin(a)*r)}})()")
  assert(run.clearance>2,JSON.stringify(run))
  await sail(run.x,run.z,'boundary approach');await align(run.heading);await key('w',true);await sleep(12000);await key('w',false);await sleep(400)
  const boundary=await snapshot();await shot('06-sea-boundary')
  const travelled=Math.hypot(boundary.boat.x-run.x,boundary.boat.z-run.z);assert(travelled>2,`only ${travelled.toFixed(2)} m toward the limit`)
  const limit=await evaluate("(()=>{const b=JSON.parse(document.querySelector('canvas').dataset.forestQa).boat;return{fits:qa.R.boatFits(b.x,b.z,b.heading),clearance:qa.R.seaBoundaryClearance(b.x,b.z)}})()")
  assert(limit.fits&&limit.clearance<.4,JSON.stringify(limit));assert(boundary.boat.speed<.02);check('entire hull stops at the island-following limit',{boat:boundary.boat,...limit,start:run,travelled})
  // Back alongside: forward to just beyond the mooring, then reverse into it parallel to the jetty.
  // Pressed against the limit there is no room to turn: back straight off it first, then round past the jetty end.
  await key('s',true);await sleep(3000);await key('s',false);await sleep(400)
  await sail(out1.x,out1.z,'back to the jetty');await sail(clearOfJetty.x,clearOfJetty.z,'return');await align(0);await sail(k.mooring.x,k.mooring.z,'return mooring',true);await align(0);await sleep(1100)
  await waitFor(s=>s.canLand,'stop parallel to the jetty');await shot('07-returned-boat');await press('f');await waitFor(s=>s.mode==='walking'&&!s.boatTransfer,'land');await shot('08-landed')
  await press('f');await waitFor(s=>s.mode==='rowing'&&!s.boatTransfer,'board again');await press('f');await waitFor(s=>s.mode==='walking'&&!s.boatTransfer,'land again')
  check('reverse into the mooring, repeat boarding and landing',true);report.route=route.filter((_,i)=>i%10===0)

  // 3. Walk home and reload: the tree is still there.
  await key('Shift',true);await go({x:0,z:0},'spawn');await key('Shift',false)
  await shot('09-returned-to-spawn');assert.equal(report.errors.length,0,report.errors.join('\n'))
  const previous=await evaluate('performance.timeOrigin');await cmd('Page.reload')
  for(let i=0;i<100;i++){await sleep(80);try{if(await evaluate('performance.timeOrigin')!==previous)break}catch{/* Context replacement. */}}
  await waitFor(s=>s?.ready&&s.dockReady,'reloaded scene',90000)
  assert.equal((await snapshot()).garden.trees.length,1)
  await evaluate("[...document.querySelectorAll('.menu button')].find(b=>b.textContent.includes('地点')).click()");await sleep(500)
  assert(await evaluate("document.querySelector('.place-list').textContent.includes('已种 1 / 6 棵')"));check('the planted tree persists after reload',true)
  assert.equal(report.errors.length,0,report.errors.join('\n'))
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
