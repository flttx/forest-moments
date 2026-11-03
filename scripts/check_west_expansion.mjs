// West expansion baseline and browser regression. Isolated profile; original saves never touched.
import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createHeadlessBrowser } from './browser-session.mjs'

const phase=process.env.FOREST_PHASE ?? 'after'
const finalPhase=phase.startsWith('final')
const out = resolve(process.env.FOREST_OUT ?? `docs/evidence/2026-10-29-west-expansion/${phase}`)
const base = process.env.FOREST_URL ?? 'http://127.0.0.1:5176/'
await mkdir(out, { recursive: true })
const { profile, cleanup } = await createHeadlessBrowser([
  '--headless=new', '--disable-features=CalculateNativeWinOcclusion', '--disable-frame-rate-limit', '--disable-gpu-vsync', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--remote-debugging-port=0', '--no-first-run', '--no-default-browser-check', 'about:blank',
])
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const report = { date: new Date().toISOString(), checks: [], errors: [], screenshots: [], status: 'RUNNING' }
let socket, seq = 0
const pending = new Map()
const cmd = (method, params = {}) => new Promise((ok, fail) => {
  const id = ++seq, timer = setTimeout(() => { pending.delete(id); fail(Error('CDP timeout ' + method)) }, 45000)
  pending.set(id, (m) => { clearTimeout(timer); if (m.error) fail(Error(JSON.stringify(m.error))); else ok(m.result) })
  socket.send(JSON.stringify({ id, method, params }))
})
const evaluate = async (expression) => {
  const r = await cmd('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  if (r.exceptionDetails) throw Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text)
  return r.result?.value
}
const ready = "!!document.querySelector('canvas')&&!document.querySelector('.asset-loading')&&!document.querySelector('.world-error')"
const waitFor = async (expression, label, tries = 200) => { for (let i = 0; i < tries; i++) { if (await evaluate(expression)) return; await sleep(100) } throw Error('Timed out: ' + label) }
const shot = async (name) => { await sleep(300); const r = await cmd('Page.captureScreenshot', { format: 'png' }); await writeFile(`${out}/${name}.png`, Buffer.from(r.data, 'base64')); report.screenshots.push(`${name}.png`) }
const check = (name, detail = {}) => { report.checks.push({ name, ...detail }); console.log('PASS', name) }
const keyCode = (k) => k === ' ' ? 32 : k.length === 1 ? k.toUpperCase().charCodeAt(0) : k === 'Escape' ? 27 : 0
const press = async (code, k) => { for (const type of ['keyDown', 'keyUp']) await cmd('Input.dispatchKeyEvent', { type, code, key: k, windowsVirtualKeyCode: keyCode(k) }) }
async function boot(width, height, fresh = false) {
  await cmd('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false })
  if (fresh) await evaluate('localStorage.clear()').catch(() => {})
  await cmd('Page.navigate', { url: `${base}?qa` })
  await sleep(500); await waitFor(ready, 'scene ready', 400); await sleep(1500)
  await evaluate(`(async()=>{const r=p=>performance.getEntriesByType('resource').find(e=>new URL(e.name).pathname===p).name;window.forestStore=(await import(r('/src/game/store.ts'))).useForestStore;window.uiStore=(await import(r('/src/game/uiStore.ts'))).useUiStore;window.photoStore=(await import(r('/src/game/photoStore.ts'))).usePhotoStore;window.journalStore=(await import(r('/src/game/journalStore.ts'))).useJournalStore;window.photoAlbum=await import(r('/src/game/photoAlbum.ts'))})()`)
}

try {
  let port
  for (let i = 0; i < 100 && !port; i++) { try { port = (await readFile(`${profile}/DevToolsActivePort`, 'utf8')).split('\n')[0] } catch { await sleep(200) } }
  const target = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json()
  socket = new WebSocket(target.webSocketDebuggerUrl)
  socket.onmessage = ({ data }) => {
    const m = JSON.parse(data)
    if (pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) }
    if (m.method === 'Runtime.exceptionThrown') report.errors.push(m.params.exceptionDetails?.exception?.description ?? m.params.exceptionDetails?.text)
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') report.errors.push(m.params.args.map((a) => a.value ?? a.description).join(' '))
  }
  await new Promise((r, j) => { socket.addEventListener('open', r, { once: true }); socket.addEventListener('error', j, { once: true }) })
  report.browser = (await cmd('Browser.getVersion')).product
  await cmd('Page.enable'); await cmd('Runtime.enable'); await cmd('Page.bringToFront'); await cmd('Emulation.setFocusEmulationEnabled', { enabled: true })
  await cmd('Page.navigate', { url: base }); await sleep(800)
  await boot(1440,900,true)
  report.viewport=[1440,900]
  await evaluate(`(async()=>{const r=p=>performance.getEntriesByType('resource').find(e=>new URL(e.name).pathname===p)?.name??p;window.terrain=await import(r('/src/world/terrain.ts'));window.world=await import(r('/src/world/worldConfig.ts'));window.movement=await import(r('/src/game/movement.ts'));window.plants=await import(r('/src/world/vegetationLayout.ts'));window.west=await import(r('/src/world/westExpansion.ts'));window.expansion=await import(r('/src/game/expansion.ts'))})()`)
  const snapshot=await evaluate(`(()=>{const terrainSamples=[];for(let x=-32;x<=40;x+=2)for(let z=-40;z<=40;z+=2)terrainSamples.push([x,z,terrain.terrainHeight(x,z)]);let groundArea=0,walkableArea=0;for(let x=-86;x<=45;x+=.5)for(let z=-44;z<=44;z+=.5){const h=terrain.terrainHeight(x,z),slope=Math.hypot(terrain.terrainHeight(x+.15,z)-terrain.terrainHeight(x-.15,z),terrain.terrainHeight(x,z+.15)-terrain.terrainHeight(x,z-.15))/.3;if(h>=world.seaLevel+.16&&slope<=.85)groundArea+=.25;if(movement.canStandAt(x,z))walkableArea+=.25}return{terrainSamples,plants:plants.vegetationPositions,lamps:plants.lampPositions,groundArea,walkableArea,landing:world.landing,mooring:world.mooring}})()`)
  await writeFile(`${out}/world-snapshot.json`,JSON.stringify(snapshot))
  report.area={ground:snapshot.groundArea,walkable:snapshot.walkableArea}
  if(phase!=='before'){
    const before=JSON.parse(await readFile(resolve('docs/evidence/2026-10-29-west-expansion/before/world-snapshot.json'),'utf8'))
    // 2026-11-03: the user approved re-laying the whole main island (coast, relief, paths, plants), so terrain and plant
    // positions are no longer frozen; saves still need no migration: the berth is unchanged and the old high ground
    // (outside the creek gorge) still stands above the sea.
    const rework=await evaluate(`${JSON.stringify(before.terrainSamples)}.map(([x,z])=>expansion.inCreekRework(x,z))`)
    const seaLevel=await evaluate('world.seaLevel')
    const sunk=snapshot.terrainSamples.filter(([x,z,y],i)=>{const old=before.terrainSamples[i][2];return !rework[i]&&old>seaLevel+.5&&Math.hypot(x,z)<30&&y<=seaLevel+.16})
    assert.deepEqual(sunk,[],'old high ground sank below the sea')
    assert.deepEqual(snapshot.landing,before.landing);assert.deepEqual(snapshot.mooring,before.mooring)
    report.area.growth=snapshot.groundArea/before.groundArea-1
    check('berth preserved and old high ground still above the sea')
  }
  report.load=await evaluate(`({elapsed:performance.now(),resources:performance.getEntriesByType('resource').reduce((n,r)=>n+r.transferSize,0)})`)
  report.frames={}
  for(const light of ['day','dusk','night'])for(const view of finalPhase?['fullIsland','westOverview','westTrailClear','westWetlandClear','westBoardwalkClose','tower']:['fullIsland','westOverview','westTrail','westWetland']){
    const local=finalPhase&&(view.includes('Clear')||view==='westBoardwalkClose')
    await evaluate(`history.replaceState(null,'','/?qa&view=${view}');forestStore.setState({timeOfDay:'${light}',position:${local?'{x:-60.4,z:-2.5}':'{x:0,z:0}'},menuPaused:true});uiStore.setState({panel:null,guideSeen:true})`)
    await sleep(1200);await shot(`${light}-${view}`)
    if(light==='day')report.frames[view]=await evaluate(`new Promise(resolve=>{const times=[];let prev=performance.now();function frame(now){times.push(now-prev);prev=now;if(times.length<180)requestAnimationFrame(frame);else{times.sort((a,b)=>a-b);resolve({median:times[90],p95:times[171],frames:times.length,low:photoStore.getState().lowQuality})}}requestAnimationFrame(frame)})`)
  }
  if(phase.includes('wetland')){
    const qa=await evaluate("JSON.parse(document.querySelector('canvas').dataset.forestQa).wetland")
    assert(qa.modules>=5);assert.equal(qa.deckTop,.78);assert.equal(qa.clearWidth,1.5);assert(qa.reeds>10)
    check('authored wetland kit loaded with continuous deck and clear approaches',qa)
    await evaluate("history.replaceState(null,'','/?qa&view=westBoardwalkClose');forestStore.setState({position:{x:-60.4,z:-2.5},timeOfDay:'day',menuPaused:true});photoStore.setState({active:true,weatherPreview:'rain'})")
    await sleep(3500);await shot('rain-boardwalk')
    await cmd('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]})
    await sleep(400)
    const clock=()=>evaluate("(async()=>{const p=performance.getEntriesByType('resource').find(e=>new URL(e.name).pathname==='/src/world/climateUniforms.ts').name;return (await import(p)).climateUniforms.climateTime.value})()")
    const first=await clock();await sleep(500);assert.equal(await clock(),first)
    await shot('rain-reduced-motion');check('wetland shared weather clock freezes under reduced motion')
    await cmd('Emulation.setEmulatedMedia',{features:[]})
    await evaluate("photoStore.setState({active:false,weatherPreview:null})")
  }
  if(phase!=='before'){
    // The deck zigzags across the marsh: start at its east end, turn the camera behind the raccoon with a real
    // right-drag for each run, then hold W along it. Every sample must stay on the deck.
    const deck=await evaluate("west.westBoardwalk.points")
    await evaluate(`history.replaceState(null,'','/?qa');forestStore.setState({position:{x:${deck[0][0]},z:${deck[0][1]}},mode:'walking',timeOfDay:'day',menuPaused:false});uiStore.setState({panel:null,guideSeen:true})`)
    await sleep(800)
    const qaState=()=>evaluate("JSON.parse(document.querySelector('canvas').dataset.forestQa)")
    const walk=[]
    for(const [tx,tz] of deck.slice(1)){
     for(let burst=0;burst<30;burst++){
      const q=await qaState(),[px,,pz]=q.position
      walk.push({position:q.position,camera:q.cameraPosition,onDeck:await evaluate(`west.onWestBoardwalk(${px},${pz},-.05)`)})
      if(Math.hypot(tx-px,tz-pz)<.35)break
      let d=Math.atan2(-(tx-px),-(tz-pz))-q.orbit.yaw;d=Math.atan2(Math.sin(d),Math.cos(d))
      if(Math.abs(d)>.03){
       await cmd('Input.dispatchMouseEvent',{type:'mousePressed',x:720,y:450,button:'right',buttons:2,clickCount:1})
       await cmd('Input.dispatchMouseEvent',{type:'mouseMoved',x:720+d/.004,y:450,button:'right',buttons:2})
       await cmd('Input.dispatchMouseEvent',{type:'mouseReleased',x:720+d/.004,y:450,button:'right',buttons:0,clickCount:1})
       await sleep(400)
      }
      await cmd('Input.dispatchKeyEvent',{type:'keyDown',code:'KeyW',key:'w',windowsVirtualKeyCode:87})
      await sleep(Math.min(450,120+160*Math.hypot(tx-px,tz-pz)))
      await cmd('Input.dispatchKeyEvent',{type:'keyUp',code:'KeyW',key:'w',windowsVirtualKeyCode:87})
      await sleep(150)
     }
    }
    const [ex,ez]=deck.at(-1),last=walk.at(-1).position
    assert(Math.hypot(last[0]-ex,last[2]-ez)<.5,JSON.stringify(walk.at(-1)))
    assert(walk.every(q=>q.onDeck),'walk left the deck: '+JSON.stringify(walk.find(q=>!q.onDeck)))
    check('real mouse orbit and W walk cross the wetland deck', {start:walk[0],end:walk.at(-1),samples:walk.length})
    await shot('walk-west-boardwalk')
    await press('KeyP','p');await sleep(300)
    assert(await evaluate('photoStore.getState().active'),'photo opens on new land')
    await press('Escape','Escape');await sleep(200)
    if(finalPhase){
      for(const [width,height] of [[1920,1080],[1280,720],[1024,768]]){
        await cmd('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false})
        await evaluate("history.replaceState(null,'','/?qa&view=westWetlandClear');forestStore.setState({menuPaused:true})")
        await sleep(600);await shot(`pc-${width}x${height}`)
        assert(await evaluate('document.documentElement.scrollWidth<=innerWidth'),'horizontal overflow')
      }
      check('three PC window sizes without horizontal overflow')
    }
    await cmd('Page.reload');await sleep(600);await waitFor(ready,'reload',400)
    await sleep(1500);await waitFor("!!document.querySelector('canvas')?.dataset.forestQa",'reload QA state',400)
    const returned=await evaluate("JSON.parse(document.querySelector('canvas').dataset.forestQa).position")
    assert(Math.abs(returned[0])<1&&Math.abs(returned[2])<1,'reload returns to the original safe spawn')
    check('photo mode on new land and reload to original safe spawn')
  }
  assert.deepEqual(report.errors,[])
  report.status='PASS'
} catch(e){report.status='FAIL';report.failure=e.stack??String(e);console.error(e);process.exitCode=1}
finally{try{await writeFile(`${out}/report.json`,JSON.stringify(report,null,2))}finally{if(socket?.readyState===1){try{await cmd('Browser.close')}catch{/* Browser shutdown may close the socket first. */}}socket?.close();await cleanup()}}
