// Isolated headless Edge only (muted by browser-session). Stage 3d/3e of docs/ARCHIPELAGO_POLISH_PLAN.md:
// clearing robins fly off and come back, the archipelago panorama shot, roasting a mist cap, the two Autumn recipes,
// and the bedroom shelf/charm/frame showing what came home. Real key presses for walking, F, R, P and Space;
// teleports only place the raccoon at each spot, and the panorama's camera angle is set the way check_photo_tasks does.
import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createHeadlessBrowser } from './browser-session.mjs'

const out = resolve(process.env.FOREST_QA_OUT ?? 'docs/evidence/2026-11-03-archipelago/phase3/3de')
const base = process.env.FOREST_URL ?? 'http://127.0.0.1:5176/'
await mkdir(out, { recursive: true })
const { profile, cleanup } = await createHeadlessBrowser([
  '--headless=new', '--disable-features=CalculateNativeWinOcclusion', '--disable-frame-rate-limit', '--disable-gpu-vsync', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--remote-debugging-port=0', '--no-first-run', '--no-default-browser-check', 'about:blank',
])
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const report = { date: new Date().toISOString(), mode: 'isolated muted headless Edge', viewport: [1440, 900], checks: [], errors: [], screenshots: [], status: 'RUNNING' }
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
const keys = { w: ['KeyW', 87], s: ['KeyS', 83], a: ['KeyA', 65], d: ['KeyD', 68], f: ['KeyF', 70], r: ['KeyR', 82], p: ['KeyP', 80], ' ': ['Space', 32], Escape: ['Escape', 27] }
const key = (name, down) => cmd('Input.dispatchKeyEvent', { type: down ? 'keyDown' : 'keyUp', key: name, code: keys[name][0], windowsVirtualKeyCode: keys[name][1] })
const press = async (k) => { await key(k, true); await key(k, false) }
const frames = (ms) => evaluate(`new Promise(resolve=>{let last=performance.now(),elapsed=0;function frame(t){elapsed+=Math.min(t-last,50);last=t;if(elapsed>=${ms})resolve();else requestAnimationFrame(frame)}requestAnimationFrame(frame)})`)
async function waitFor(expression, label, tries = 300) { for (let i = 0; i < tries; i++) { if (await evaluate(expression)) return; await sleep(100) } throw Error('Timed out: ' + label) }
const centre = (selector, text = '') => evaluate(`(()=>{const e=[...document.querySelectorAll(${JSON.stringify(selector)})].find(b=>!${JSON.stringify(text)}||b.textContent.includes(${JSON.stringify(text)}));if(!e)return null;const r=e.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`)
async function click(selector, text = '') {
  const box = await centre(selector, text); assert(box, `Missing ${selector} ${text}`)
  for (const type of ['mousePressed', 'mouseReleased']) await cmd('Input.dispatchMouseEvent', { type, x: box.x, y: box.y, button: 'left', buttons: type === 'mousePressed' ? 1 : 0, clickCount: 1 })
}
async function shot(name) {
  await cmd('Page.captureScreenshot', { format: 'png' }); await sleep(250)
  const result = await cmd('Page.captureScreenshot', { format: 'png' })
  await writeFile(`${out}/${name}.png`, Buffer.from(result.data, 'base64'))
  report.screenshots.push(`${name}.png`)
}
function check(name, data) { report.checks.push({ name, data }); console.log(`PASS ${name}`) }
const ready = "!!document.querySelector('canvas')&&!document.querySelector('.asset-loading')&&!document.querySelector('.world-error')"
const prompt = "document.querySelector('.interaction button')?.textContent??''"
const at = (x, z) => evaluate(`forestStore.getState().updatePosition(${x},${z})`)
// ONLY=birds,photo,maple,curio,roast,craft,journal,home,seasons,benches,boat runs a subset (journal and home expect the stages before them).
const only = (process.env.ONLY ?? 'birds,photo,maple,curio,roast,craft,journal,home,seasons,benches,boat').split(',')
const view = (v) => evaluate(`history.replaceState(null,'','/?qa${v ? '&view=' + v : ''}')`)

async function boot() {
  await cmd('Page.navigate', { url: `${base}?qa` })
  await sleep(500); await waitFor(ready, 'scene ready', 1200)
  await waitFor("JSON.parse(document.querySelector('canvas')?.dataset.forestQa||'null')?.ready===true", 'raccoon ready', 1200); await sleep(1500)
  await evaluate(`(async()=>{const r=p=>performance.getEntriesByType('resource').find(e=>new URL(e.name).pathname===p).name
   window.forestStore=(await import(r('/src/game/store.ts'))).useForestStore
   window.inventoryStore=(await import(r('/src/game/inventoryStore.ts'))).useInventoryStore
   window.photoStore=(await import(r('/src/game/photoStore.ts'))).usePhotoStore
   window.photoMod=await import(r('/src/game/photoStore.ts'))
   window.movement=await import(r('/src/game/movement.ts'))
   window.curios=await import(r('/src/game/curios.ts'))
   window.autumn=await import(r('/src/world/autumnIsland.ts'))
   window.forage=await import(r('/src/game/forage.ts'))
   window.journalStore=(await import(r('/src/game/journalStore.ts'))).useJournalStore})()`)
  await waitFor("!document.querySelector('.guide')", 'guide folds away', 150)
}

try {
  let port
  for (let i = 0; i < 100 && !port; i++) { try { port = (await readFile(`${profile}/DevToolsActivePort`, 'utf8')).split('\n')[0] } catch { await sleep(200) } }
  assert(port, 'Headless Edge did not expose its isolated debug port')
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
  await cmd('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })
  // A save that has already been to the islands: Autumn finds and caps in the satchel, the stool made, two curios from earlier days.
  // Seed from a plain file on the same origin, so the app cannot save its own fresh journal page over the seed.
  await cmd('Page.navigate', { url: base + 'fonts/LXGW-WenKai-OFL.txt' }); await sleep(800)
  await evaluate(`localStorage.clear();indexedDB.deleteDatabase('forest-moments:photos:v1')
   localStorage.setItem('forest-moments:inventory:v1',JSON.stringify({version:1,items:{mistcap:2,mapleLeaf:4,birchBark:2,wood:2,shell:1,seaGlass:1},found:['mistcap','mapleLeaf','birchBark','wood','shell','seaGlass']}))
   localStorage.setItem('forest-moments:workshop:v1',JSON.stringify({version:1,phase:'finished',made:[]}))
   localStorage.setItem('forest-moments:curios:v1',JSON.stringify({version:1,found:['compass','button'],day:null}))
   localStorage.setItem('forest-moments:island-travel:v1',JSON.stringify({version:1,checkpoint:'main',visitedMist:true,foundPine:true,visitedAutumn:true,foundVista:true,visitedTide:true,foundPools:true,creatures:[]}))
   localStorage.setItem('forest-moments:journal:v1',JSON.stringify({version:1,page:{number:1,tasks:['curio','shotArchipelago','mapleLeaves'].map(id=>({id,progress:0,doneAt:null}))},stamps:[]}))`)
  await boot()

  if (only.includes('birds')) {
    // 3d-1 Clearing robins: walk in with W until they scatter, back off with S, and they settle again.
    const birds = "(()=>{const g=forestScene.getObjectByName('clearing-birds'),p=forestStore.getState().position;return g.children.map(b=>({lift:+(b.position.y-movement.groundHeightAt(b.position.x,b.position.z)).toFixed(2),d:+Math.hypot(b.position.x-p.x,b.position.z-p.z).toFixed(2)}))})()"
    await at(110, 54); await sleep(1500)
    const p0 = await evaluate('forestStore.getState().position'); await key('w', true); await frames(500); await key('w', false)
    const p1 = await evaluate('forestStore.getState().position'), len = Math.hypot(p1.x - p0.x, p1.z - p0.z); assert(len > .2, 'W did not move the raccoon')
    const dir = { x: (p1.x - p0.x) / len, z: (p1.z - p0.z) / len }
    await at(110 - dir.x * 7.5, 47 - dir.z * 7.5); await sleep(2500)
    const calm = await evaluate(birds); assert(calm.every(b => b.lift < .2), JSON.stringify(calm)); await shot('01-birds-ground')
    // hops glide: frame by frame for 4 s, no bird on the ground moves more than a few centimetres in one frame
    const step = await evaluate("new Promise(r=>{const g=forestScene.getObjectByName('clearing-birds'),last=g.children.map(b=>b.position.clone());let max=0,frames=0,t0=performance.now();(function f(){g.children.forEach((b,i)=>{max=Math.max(max,b.position.distanceTo(last[i]));last[i].copy(b.position)});frames++;if(performance.now()-t0<4000)requestAnimationFrame(f);else r({max:+max.toFixed(3),frames})})()})")
    assert(step.max < .12, `a bird jumped ${step.max} m in one frame`)
    await key('w', true)
    for (let i = 0; i < 60 && !(await evaluate(birds)).some(b => b.d < 3.4); i++) await frames(100)
    await key('w', false); await frames(500)
    const scattered = await evaluate(birds); await shot('02-birds-scatter')
    assert(scattered.some(b => b.lift > .5), JSON.stringify(scattered))
    await frames(1500); const perched = await evaluate(birds); await shot('03-birds-perched')
    assert(perched.filter(b => b.lift > 1.5).length >= 1, JSON.stringify(perched))
    // the ones that flew sit at their own perch in a real crown, not in the air
    const onPerch = await evaluate(`(async()=>{const r=p=>performance.getEntriesByType('resource').find(e=>new URL(e.name).pathname===p).name;const {perchFor}=await import(r('/src/world/birdPerches.ts'));const g=forestScene.getObjectByName('clearing-birds');return g.children.map((b,i)=>+b.position.distanceTo(perchFor(i*2.2+.4+.3)).toFixed(2))})()`)
    assert(perched.every((b, i) => b.lift < .2 || onPerch[i] < .05), JSON.stringify({ perched, onPerch }))
    for (const [i, b] of perched.entries()) if (b.lift > 1.5) { await view(`perch-${i}`); await sleep(900); await shot(`03-birds-perch-${i}`) }
    await view('')
    await key('s', true); await frames(5000); await key('s', false)
    const away = await evaluate("Math.hypot(forestStore.getState().position.x-110,forestStore.getState().position.z-47)")
    assert(away > 8, `only ${away} m from the clearing`)
    await frames(8000); const back = await evaluate(birds); await shot('04-birds-back')
    assert(back.every(b => b.lift < .2), JSON.stringify(back))
    check('clearing robins hop without jumps, scatter to perches in real crowns when the raccoon walks in, and drop back once it has gone', { calm, step, scattered, perched, onPerch, away, back })
  }

  if (only.includes('photo')) {
    // 3d-2 Archipelago panorama from the Autumn vista hill: P, free camera, Space.
    const vista = await evaluate('autumn.autumnVista'); await at(vista.x, vista.z); await sleep(1500)
    await press('p'); await sleep(500); await click('.photo-bar button', '自由取景'); await sleep(400)
    const aim = await evaluate(`(()=>{const v=autumn.autumnVista,u=(x,z)=>{const l=Math.hypot(x-v.x,z-v.z);return[(x-v.x)/l,(z-v.z)/l]},a=u(0,0),b=u(107,-10);return{yaw:Math.atan2(a[0]+b[0],a[1]+b[1]),y:movement.groundHeightAt(v.x,v.z)+1.7}})()`)
    const shoot = async () => { await evaluate('photoStore.setState({last:null})'); await press(' '); await waitFor('!!photoStore.getState().last', 'shot', 100); await sleep(700); return evaluate('photoStore.getState().last.subjects') }
    // at eye height the hill's own crowns fill the frame: no panorama
    await evaluate(`photoMod.freeCam.view={x:${vista.x},y:${aim.y},z:${vista.z},yaw:${aim.yaw},pitch:-.06}`); await sleep(1200)
    const screened = await shoot(); await shot('05-archipelago-screened')
    assert(!screened.includes('archipelago'), JSON.stringify(screened))
    // flown up above the crowns (within the free camera's 15 m), the strait opens out
    await evaluate(`photoMod.freeCam.view={x:${vista.x},y:${aim.y}+11,z:${vista.z},yaw:${aim.yaw},pitch:-.14}`); await sleep(1500)
    const raised = await evaluate('photoMod.freeCam.view')
    const panorama = await shoot(); await shot('06-archipelago-shot')
    assert(panorama.includes('archipelago'), JSON.stringify(panorama))
    await evaluate(`photoMod.freeCam.view={...photoMod.freeCam.view,yaw:${aim.yaw}+Math.PI}`); await sleep(1000)
    const turned = await shoot(); assert(!turned.includes('archipelago'), JSON.stringify(turned))
    await press('Escape'); await sleep(500)
    check('above the vista hill crowns the main and Mist isles count as the archipelago panorama; screened by the crowns, or facing out to sea, they do not', { aim, raised, screened, panorama, turned })
  }

  if (only.includes('maple')) {
    // 3f Autumn finds for the journal: real F beside two of today's maple-leaf spots.
    const spots = await evaluate("forage.availableSpots(forestStore.getState().forageBook,forestStore.getState().homeBook.nights).filter(s=>s.kind==='mapleLeaf').slice(0,2).map(s=>({x:s.x,z:s.z}))")
    assert.equal(spots.length, 2, JSON.stringify(spots))
    for (const spot of spots) {
      const before = await evaluate('inventoryStore.getState().inv.items.mapleLeaf??0')
      await at(spot.x + .3, spot.z); await sleep(900); await press('f')
      await waitFor(`(inventoryStore.getState().inv.items.mapleLeaf??0)>${before}&&forestStore.getState().mode==='walking'`, 'maple leaf picked', 80)
    }
    check('two maple leaves picked up on Autumn Isle with F', { spots, mapleLeaf: await evaluate('inventoryStore.getState().inv.items.mapleLeaf') })
  }

  if (only.includes('curio')) {
    // 3e-1 Mist Isle hollow log: F turns up today's curio for the bedroom shelf.
    const end = await evaluate('curios.hollowEnds[0]'); await at(end.x, end.z); await sleep(1200)
    await waitFor(`${prompt}.includes('树洞')`, 'hollow log prompt'); await press('f'); await sleep(600)
    const curiosFound = await evaluate('forestStore.getState().curiosBook.found'); assert.deepEqual(curiosFound, ['compass', 'button', 'marble'])
    check('reaching into the hollow log adds the next curio', { curiosFound })
  }

  if (only.includes('roast')) {
    // 3e-2 Campfire: light it with F, sit with F, roast a mist cap with R; no fish on hand so the cap goes on.
    await at(20, 21.2); await sleep(800); await press('f'); await waitFor('forestStore.getState().homeBook.fireLit', 'fire lit')
    await at(20, 24.4); await sleep(1000); await waitFor(`${prompt}.includes('坐')`, 'seat prompt'); await press('f')
    await waitFor("forestStore.getState().sitting?.phase==='idle'", 'seated', 200)
    assert(await evaluate("document.querySelector('.camp-hud, .hud')?.textContent.includes('烤一朵雾松菌')"), 'roast-cap button missing')
    await press('r'); await waitFor("forestStore.getState().roast?.item==='mistcap'", 'roast started'); await sleep(2500); await shot('07-roasting-cap')
    await waitFor('!forestStore.getState().roast', 'roast done', 150); await sleep(300)
    const satchel = await evaluate('inventoryStore.getState().inv.items'); await shot('08-roasted-cap')
    assert.equal(satchel.mistcap, 1); assert.equal(satchel.roastCap, 1)
    check('R at the lit fire roasts a mist cap and the satchel swaps it for a roasted one', { satchel, message: await evaluate('forestStore.getState().message') })
    await press('f'); await waitFor("forestStore.getState().mode==='walking'", 'stood up', 200)
  }

  if (only.includes('craft')) {
    // 3e-3 Workshop: F at the bench opens the pattern book; make each Autumn piece with three F strokes in the green.
    await evaluate("forestStore.setState({location:'workshop',position:{x:-.6,z:-.65},mode:'walking',nearby:'workshop'})"); await sleep(1500)
    const craft = async (name, id) => {
      await waitFor(`${prompt}.includes('图样')`, 'pattern book prompt'); await press('f'); await waitFor('forestStore.getState().recipesOpen', 'recipe card')
      await evaluate(`document.querySelector('[data-qa-make]')?.removeAttribute('data-qa-make');[...document.querySelectorAll('.recipe-list li')].find(l=>l.textContent.includes(${JSON.stringify(name)})).querySelector('button').setAttribute('data-qa-make','1')`)
      await click('[data-qa-make="1"]'); await waitFor("!!document.querySelector('.craft-hud')", 'craft hud')
      for (let i = 0; i < 3; i++) {
        await waitFor("(()=>{const m=document.querySelector('[role=meter]'),b=document.querySelector('.craft-hud button');const v=Number(m?.getAttribute('aria-valuenow'));return m&&!b.disabled&&v>.41&&v<.59})()", 'green range')
        await press('f'); await sleep(1400)
      }
      await waitFor(`(JSON.parse(localStorage.getItem('forest-moments:workshop:v1')||'{}').made??[]).includes('${id}')`, `${id} made`, 200)
      await waitFor("forestStore.getState().mode==='walking'", 'back to walking')
      // the bench lets a stray tap of F pass for 1.5 s after the last stroke
      await sleep(1600)
    }
    const held = await evaluate('inventoryStore.getState().inv.items')
    await craft('枫叶挂饰', 'mapleCharm'); await shot('09-made-charm')
    await craft('桦皮相框', 'birchFrame'); await shot('10-made-frame')
    // charm: 3 leaves + 1 wood; frame: 2 bark + 1 leaf + 1 wood
    const leftover = await evaluate('inventoryStore.getState().inv.items'), used = (k) => (held[k] ?? 0) - (leftover[k] ?? 0)
    assert.deepEqual([used('mapleLeaf'), used('birchBark'), used('wood')], [4, 2, 2], JSON.stringify({ held, leftover }))
    check('both Autumn recipes made at the bench, taking exactly their leaves, bark and wood', { held, leftover })
  }

  if (only.includes('journal')) {
    // 3f The journal page of island tasks: the curio, the panorama and the leaves above each ticked it off.
    const tasks = await evaluate('journalStore.getState().book.page.tasks.map(t=>t.id+":"+(t.doneAt?1:0))')
    await click('.menu button', '手账'); await sleep(800); await shot('13-journal-island-tasks')
    const lines = await evaluate("[...document.querySelectorAll('.journal-tasks li')].map(l=>l.textContent)")
    await press('Escape'); await sleep(400)
    assert.deepEqual(tasks, ['curio:1', 'shotArchipelago:1', 'mapleLeaves:1'], JSON.stringify(tasks))
    check('the island journal page fills in from a real curio find, panorama shot and leaf pickups', { tasks, lines })
  }

  if (only.includes('home')) {
    // 3e-4 Home: after a reload, the bedroom holds the charm, the frame and the shelf of curios and shore finds.
    await boot()
    await evaluate("forestStore.setState({location:'bedroom',position:{x:0,z:1.1},mode:'walking',nearby:'bedroom'})"); await sleep(2000)
    const scene = await evaluate("(()=>{const s=forestScene.getObjectByName('bedroom-shelf');return{shelfItems:s?s.children.length-3:-1,charm:!!forestScene.getObjectByName('furniture-mapleCharm'),frame:!!forestScene.getObjectByName('furniture-birchFrame')}})()")
    assert.equal(scene.shelfItems, 6, JSON.stringify(scene)); assert(scene.charm && scene.frame, JSON.stringify(scene))
    await shot('11-bedroom-player')
    await evaluate("document.head.append(Object.assign(document.createElement('style'),{textContent:'.hud{display:none!important}'}))")
    for (const v of ['bedroomShelf', 'bedroomCharm', 'bedroomFrame', 'bedroom']) { await view(v); await sleep(1200); await shot(`12-${v}`) }
    await view('')
    check('after a reload the bedroom shows three curios, two shells and sea glass on the shelf, the maple charm and the birch frame', scene)
  }

  if (only.includes('seasons')) {
    // Fallen maple leaves through the year: the count drawn for the day and the colours actually on the ground.
    await evaluate("forestStore.setState({location:'island',position:{x:110,z:54},mode:'walking',nearby:null});document.getElementById('qa-hide')||document.head.append(Object.assign(document.createElement('style'),{id:'qa-hide',textContent:'.hud{display:none!important}'}))")
    const seasons = {}
    for (const [season, nights] of [['spring', 1], ['summer', 5], ['autumn', 9]]) {
      await evaluate(`forestStore.setState(s=>({homeBook:{...s.homeBook,nights:${nights}}}))`); await sleep(3500)
      seasons[season] = await evaluate("(()=>{const g=forestScene.getObjectByName('forage-items'),leaves=g.children.filter(c=>c.name.startsWith('forage-autumn-mapleLeaf-'));const m=[];leaves[0]?.traverse(o=>{if(o.isMesh)m.push('#'+o.material.color.getHexString())});return{count:leaves.length,colours:m}})()")
      for (const v of ['forageMaple', 'autumnMaple']) { await view(v); await sleep(1500); await shot(`14-${season}-${v}`) }
      await view('')
    }
    assert.deepEqual([seasons.spring.count, seasons.summer.count, seasons.autumn.count], [2, 3, 5], JSON.stringify(seasons))
    assert.notDeepEqual(seasons.spring.colours, seasons.autumn.colours); assert.notDeepEqual(seasons.summer.colours, seasons.autumn.colours)
    check('fallen maple leaves follow the season: 2 weathered brown in spring, 3 early yellow in summer, 5 red, orange and gold in autumn', seasons)
  }

  if (only.includes('benches')) {
    // Stage 4: each island bench is a real seat (F to sit, F to stand), its lamps light the dusk, and the set pieces read
    // in day, dusk and night from fixed views.
    await evaluate("document.getElementById('qa-hide')?.remove();forestStore.setState({location:'island',mode:'walking',timeOfDay:'night'})"); await view('')
    await mkdir(resolve(out, '../../phase4'), { recursive: true })
    // a season turned over in the stage before opens the season recap; close it with Esc as a player would
    for (let i = 0; i < 4 && await evaluate('forestStore.getState().menuPaused'); i++) { await press('Escape'); await sleep(400) }
    const sat = {}
    for (const id of ['mistBench', 'autumnBench', 'tideBench']) {
      const o = await evaluate(`(async()=>{const r=p=>performance.getEntriesByType('resource').find(e=>new URL(e.name).pathname===p).name;const x=await import(r('/src/game/expansion.ts'));const s=x.seats.find(v=>v.id==='${id}');return x.seatOrigin(s)})()`)
      await at(o.x, o.z); await sleep(1500); await waitFor(`${prompt}.includes('坐')`, `${id} prompt`); await press('f')
      await waitFor(`forestStore.getState().sitting?.id==='${id}'&&forestStore.getState().sitting.phase==='idle'`, `${id} seated`, 200); await sleep(800)
      const lights = await evaluate("JSON.parse(document.querySelector('canvas').dataset.vegetationQa).lights.filter(l=>l.intensity>.5).map(l=>l.position.map(v=>+v.toFixed(1)))")
      await shot(`../../phase4/night-seated-${id}`)
      await press('f'); await waitFor("forestStore.getState().mode==='walking'", `${id} stood`, 200)
      sat[id] = { origin: o, litLamps: lights }
      assert(lights.length >= 2, `${id}: ${JSON.stringify(lights)}`)
    }
    check('each island bench seats the raccoon with F and its two nearby lamps light up at night', sat)
    await evaluate("document.getElementById('qa-hide')||document.head.append(Object.assign(document.createElement('style'),{id:'qa-hide',textContent:'.hud{display:none!important}'}))")
    for (const light of ['day', 'dusk', 'night']) for (const v of ['mistBench', 'autumnBench', 'tideBench', 'mistDockHead', 'autumnDockHead', 'tideDockHead']) {
      await evaluate(`forestStore.setState({timeOfDay:'${light}'})`); await view(v); await sleep(1300); await shot(`../../phase4/${light}-${v}`)
    }
    await view('')
  }

  if (only.includes('boat')) {
    // The canoe rowed straight at a channel buoy with a real W: the hull outline never overlaps the buoy.
    for (let i = 0; i < 4 && await evaluate('forestStore.getState().menuPaused'); i++) { await press('Escape'); await sleep(400) }
    const start = await evaluate(`(async()=>{const r=p=>performance.getEntriesByType('resource').find(e=>new URL(e.name).pathname===p).name
     window.archi=await import(r('/src/world/archipelago.ts'));window.rowing=await import(r('/src/game/rowing.ts'))
     const b=archi.buoys[0];for(let k=0;k<16;k++){const a=k*Math.PI/8,x=b.x+Math.cos(a)*7,z=b.z+Math.sin(a)*7,h=Math.atan2(-(b.z-z),b.x-x)
      if(rowing.boatFits(x,z,h)&&rowing.boatFits(b.x+Math.cos(a)*3,b.z+Math.sin(a)*3,h))return{x,z,heading:h,buoy:b}}return null})()`)
    assert(start, 'no open water to approach the buoy from')
    await evaluate(`forestStore.setState({location:'island',mode:'rowing',timeOfDay:'day',boat:{x:${start.x},z:${start.z},heading:${start.heading},speed:0,effort:0,phase:0}})`); await sleep(1200)
    const gap = `(()=>{const s=forestStore.getState().boat,b=archi.buoys[0],c=Math.cos(s.heading),n=Math.sin(s.heading),dx=b.x-s.x,dz=b.z-s.z,al=dx*c-dz*n,ac=dx*n+dz*c;return +(Math.hypot(Math.max(Math.abs(al)-1.7,0),Math.max(Math.abs(ac)-.57,0))-archi.buoyRadius).toFixed(3)})()`
    let closest = Infinity
    await key('w', true)
    for (let i = 0; i < 60; i++) { await sleep(100); closest = Math.min(closest, await evaluate(gap)) }
    await key('w', false); await shot('17-boat-at-buoy')
    // from the side, level with the water, where a gap (or an overlap) between bow and float shows plainly
    await press('p'); await sleep(500); await click('.photo-bar button', '自由取景'); await sleep(400)
    await evaluate(`(()=>{const s=forestStore.getState().boat,b=archi.buoys[0],mx=(s.x+b.x)/2,mz=(s.z+b.z)/2,dx=b.x-s.x,dz=b.z-s.z,l=Math.hypot(dx,dz),nx=-dz/l,nz=dx/l;photoMod.freeCam.view={x:mx+nx*4,y:.7,z:mz+nz*4,yaw:Math.atan2(-nx,-nz),pitch:-.08}})()`); await sleep(1200)
    await evaluate("document.getElementById('qa-hide')||document.head.append(Object.assign(document.createElement('style'),{id:'qa-hide',textContent:'.hud{display:none!important}'}))"); await sleep(300)
    await shot('18-boat-at-buoy-side'); await press('Escape'); await sleep(400)
    const moved = await evaluate(`Math.hypot(forestStore.getState().boat.x-(${start.x}),forestStore.getState().boat.z-(${start.z}))`)
    assert(moved > 2, `the boat barely moved (${moved} m)`); assert(closest >= .15, `hull came within ${closest} m of the buoy`)
    check('rowing straight at a channel buoy stops the hull at it instead of passing through', { start, moved: +moved.toFixed(2), closest })
  }

  assert.deepEqual(report.errors, []); report.status = 'PASS'
} catch (error) {
  report.status = 'FAIL'; report.failure = String(error); process.exitCode = 1
  if (socket?.readyState === 1) {
    try { await shot('failure'); report.state = await evaluate("(()=>{const s=forestStore.getState();return{location:s.location,position:s.position,nearby:s.nearby,mode:s.mode,message:s.message,workshopReady:s.workshopReady,recipesOpen:s.recipesOpen,menuPaused:s.menuPaused,active:document.activeElement?.outerHTML.slice(0,120)}})()") } catch { /* Original error stays in report. */ }
  }
} finally {
  try {
    await writeFile(`${out}/report.json`, JSON.stringify(report, null, 2) + '\n')
    if (socket?.readyState === 1) { try { await cmd('Browser.close') } catch { /* Closing the socket can precede the response. */ } socket.close() }
    console.log(report.status, report.failure ?? '')
  } finally {
    await cleanup()
  }
}
