// Tier-one play (docs/GAMEPLAY_TIER1_PLAN.md): weather extras, season recap, more plots, river lanterns and the guided tour. Isolated headless Edge, one browser.
import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createHeadlessBrowser } from './browser-session.mjs'

const out = resolve(process.env.FOREST_QA_OUT ?? 'docs/evidence/2026-10-28-tier1')
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
const centre = (selector, text = '') => evaluate(`(()=>{const e=[...document.querySelectorAll(${JSON.stringify(selector)})].find(b=>!${JSON.stringify(text)}||b.textContent.includes(${JSON.stringify(text)}));if(!e)return null;const r=e.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`)
const click = async (selector, text = '') => {
  const box = await centre(selector, text); assert(box, `Missing ${selector} ${text}`)
  for (const type of ['mousePressed', 'mouseReleased']) await cmd('Input.dispatchMouseEvent', { type, x: box.x, y: box.y, button: 'left', buttons: type === 'mousePressed' ? 1 : 0, clickCount: 1 })
}
async function boot(width, height, fresh = false) {
  await cmd('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false })
  if (fresh) await evaluate('localStorage.clear()').catch(() => {})
  await cmd('Page.navigate', { url: `${base}?qa` })
  await sleep(500); await waitFor(ready, 'scene ready', 400); await sleep(1500)
  await evaluate(`(async()=>{const r=p=>performance.getEntriesByType('resource').find(e=>new URL(e.name).pathname===p).name;window.forestStore=(await import(r('/src/game/store.ts'))).useForestStore;window.uiStore=(await import(r('/src/game/uiStore.ts'))).useUiStore;window.photoStore=(await import(r('/src/game/photoStore.ts'))).usePhotoStore;window.journalStore=(await import(r('/src/game/journalStore.ts'))).useJournalStore;window.photoStore=(await import(r('/src/game/photoStore.ts'))).usePhotoStore;window.photoMod=await import(r('/src/game/photoStore.ts'));window.forage=await import(r('/src/game/forage.ts'));window.farm=await import(r('/src/game/farm.ts'));window.inventoryStore=(await import(r('/src/game/inventoryStore.ts'))).useInventoryStore;window.settlement=await import(r('/src/world/settlement.ts'));window.workshop=await import(r('/src/game/workshop.ts'));window.movement=await import(r('/src/game/movement.ts'));window.furniture=await import(r('/src/game/furniture.ts'));window.secrets=await import(r('/src/game/secrets.ts'));window.expansion=await import(r('/src/game/expansion.ts'));window.weather=await import(r('/src/game/weather.ts'));window.lookout=await import(r('/src/game/lookout.ts'));window.growth=await import(r('/src/game/growth.ts'));window.lanterns=await import(r('/src/game/lanterns.ts'));window.tourStore=(await import(r('/src/game/tourStore.ts'))).useTourStore;window.tour=await import(r('/src/game/tour.ts'));window.seasonStore=(await import(r('/src/game/seasonStore.ts'))).useSeasonStore;window.fishing=await import(r('/src/game/fishing.ts'))})()`)
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
  await boot(1440, 900, true)
  await waitFor("!document.querySelector('.guide')", 'guide folds away', 120)
  const s = (expr) => evaluate(`(()=>{const s=forestStore.getState();return ${expr}})()`)
  // Jumping days by hand can cross a season; the recap that opens is closed so the next check starts clean.
  const day = async (d, light = 'day', wait = 5500) => { await evaluate(`forestStore.setState(s=>({homeBook:{...s.homeBook,nights:${d}},timeOfDay:'${light}',location:'island',mode:'walking'}))`); await evaluate('uiStore.getState().closePanel()'); await sleep(wait) }
  const at = async (x, z, wait = 900) => { await evaluate(`forestStore.getState().updatePosition(${x},${z})`); await sleep(wait) }
  const free = async (view, wait = 1500) => { await evaluate(`photoMod.freeCam.view=${view}`); await sleep(wait) }
  const openFree = async () => { await press('KeyP', 'p'); await sleep(300); await click('.photo-bar button', '自由取景'); await sleep(200); await click('.photo-bar button', '隐藏浣熊'); await sleep(200) }
  const shoot = async () => { await evaluate('photoStore.setState({last:null})'); await press('Space', ' '); await waitFor('!!photoStore.getState().last', 'photo', 100); await sleep(400); return evaluate('photoStore.getState().last.subjects') }
  const leave = async () => { await press('Escape', 'Escape'); await sleep(300) }
  const look = (from, to) => `{x:${from[0]},y:${from[1]},z:${from[2]},yaw:Math.atan2(${to[0] - from[0]},${to[2] - from[2]}),pitch:Math.atan2(${to[1] - from[1]},Math.hypot(${to[0] - from[0]},${to[2] - from[2]}))}`
  const action = () => evaluate("document.querySelector('.interaction .action-button')?.textContent??''")
  const hint = () => evaluate("document.querySelector('.interaction .prompt-hint')?.textContent??''")
  const frameMs = (sec = 4) => evaluate(`new Promise(r=>{const d=[];let last=performance.now();const end=last+${sec * 1000};const f=t=>{d.push(t-last);last=t;if(t<end)requestAnimationFrame(f);else{d.sort((a,b)=>a-b);r(+d[d.length>>1].toFixed(2))}};requestAnimationFrame(f)})`)
  const pick = (test) => evaluate(`(()=>{for(let d=1;d<400;d++)if((${test})(d))return d;return null})()`)
  const plots = await evaluate('growth.plantingSpots')
  await waitFor('forestStore.getState().growthReady&&forestStore.getState().fishingReady&&forestStore.getState().homeReady', 'assets', 300)

  // 1. Plant on the first plot (day 0); the second plot waits for tomorrow.
  await at(plots[0].x, plots[0].z + 1.2)
  assert.equal(await action(), 'F种一棵树')
  await press('KeyF', 'f'); await waitFor("forestStore.getState().mode==='planting'", 'planting', 40)
  await waitFor('forestStore.getState().garden.trees.length===1', 'planted', 60); await sleep(600)
  await evaluate('forestStore.setState({inspectingTree:false})')
  await at(plots[2].x, plots[2].z + 1.2)
  assert.equal(await hint(), '今天已经种过树了')
  await openFree(); await free(look([plots[2].x + 2.2, 1.6, plots[2].z + 2.6], [plots[2].x, 0, plots[2].z]), 1500); await shot('01-empty-plot'); await leave()
  check('the first plot takes a tree by F on day 0; another plot is marked as soil and waits for tomorrow')

  // 2. Season recap: a photo on day 3, then a real night's sleep in the cabin into summer.
  await evaluate('forestStore.setState(s=>({homeBook:{...s.homeBook,nights:3}}))'); await sleep(400)
  assert.equal(await evaluate('uiStore.getState().panel'), null)
  await at(0, 10); await press('KeyP', 'p'); await sleep(600); await shoot(); await leave()
  const cabin = await evaluate('expansion.cabin')
  await at(cabin.x, cabin.doorZ + .6); await press('KeyF', 'f'); await waitFor("forestStore.getState().location==='bedroom'&&!forestStore.getState().homeTransfer", 'bedroom', 120)
  const bed = await evaluate('expansion.bedSpot'); await at(bed.x, bed.z, 600)
  await press('KeyF', 'f'); await waitFor("forestStore.getState().mode==='sleeping'", 'asleep', 40); await sleep(2500)
  await press('KeyF', 'f'); await waitFor("uiStore.getState().panel==='season'", 'season recap opens', 80); await sleep(1500)
  const recap = await evaluate('seasonStore.getState().book.recaps.at(-1)')
  assert.deepEqual([recap.season, recap.startDay, recap.endDay, recap.tally.trees], ['spring', 0, 4, 1], JSON.stringify(recap))
  await waitFor("document.querySelectorAll('.recap-photos img').length===1", 'recap photo', 60); await sleep(500)
  const recapText = await evaluate("document.querySelector('.season-recap').textContent")
  assert(recapText.includes('春天回顾') && recapText.includes('种下的树'), recapText)
  await shot('02-season-recap')
  await press('Escape', 'Escape'); await sleep(300); await click('.menu button', '手账'); await sleep(400)
  assert((await evaluate("document.querySelector('.recap-row')?.textContent??''")).includes('春'))
  await shot('03-journal-seasons'); await press('Escape', 'Escape'); await sleep(300)
  check('waking into summer opens the spring recap: days, the tree planted and the photo taken; the journal lists it', { recap })

  // 3. The next day, a second plot takes a tree.
  await evaluate("forestStore.setState({location:'island',mode:'walking'})"); await sleep(1500)
  await at(plots[2].x, plots[2].z + 1.2)
  assert.equal(await action(), 'F种一棵树')
  await press('KeyF', 'f'); await waitFor('forestStore.getState().garden.trees.length===2', 'second tree', 80); await sleep(400)
  assert.deepEqual(await s('s.garden.trees.map(t=>[t.spot,t.day])'), [[0, 0], [2, 4]])
  assert(await evaluate("!!forestScene.getObjectByName('planted-tree-2')"))
  check('a day later the second plot takes a tree, saved with its day')

  // 4. Mist: the mistfish bites in the pond on a misty day only.
  const mist = await pick("d=>weather.weatherFor(d)==='mist'"), clear = await pick("d=>weather.weatherFor(d)==='clear'&&!weather.rainbowFor(d)")
  const site = await evaluate('fishing.fishingSites.pond')
  const cast = async () => { await at(site.stand.x + .2, site.stand.z, 800); await evaluate('window.__random=Math.random;Math.random=()=>.999'); await press('KeyF', 'f'); await waitFor("forestStore.getState().mode==='fishing'", 'fishing', 40); await evaluate('Math.random=window.__random'); return s('s.fishing.species') }
  await day(clear); assert.notEqual(await cast(), 'mistfish'); await press('Escape', 'Escape'); await sleep(400)
  await day(mist); assert.equal(await cast(), 'mistfish')
  await evaluate("forestStore.setState(s=>({fishing:{...s.fishing,phase:'landing',elapsed:1.1,sizeCm:27}}))"); await waitFor("forestStore.getState().fishing.phase==='caught'", 'caught', 40); await sleep(1200)
  assert((await evaluate("document.querySelector('.fishing-hud').textContent")).includes('雾鱼'))
  await shot('04-mistfish'); await press('Escape', 'Escape'); await sleep(400)
  check('on a misty day the pond gives the mistfish; on a clear day the same roll does not')

  // 5. Rainbow: the morning after rain, opposite the sun; a photo of it counts.
  const bow = await pick('weather.rainbowFor')
  await day(bow, 'day', 7000)
  const centre = await evaluate("(()=>{const o=forestScene.getObjectByName('rainbow');return o.visible?{x:o.position.x,z:o.position.z,opacity:o.userData.opacity}:null})()")
  assert(centre && centre.opacity > .3, JSON.stringify(centre))
  const k = Math.hypot(centre.x, centre.z), ux = centre.x / k, uz = centre.z / k
  await evaluate("journalStore.setState(s=>({book:{...s.book,page:{...s.book.page,tasks:[{id:'shotRainbow',progress:0,doneAt:null},{id:'lantern',progress:0,doneAt:null},{id:'shotLanterns',progress:0,doneAt:null}]}}}))")
  const placed = await evaluate(`(()=>{for(let r=26;r>8;r-=.5){const x=${ux}*r,z=${uz}*r;if(movement.canStandAt(x,z))return{x,z}}return null})()`)
  assert(placed, 'no ground toward the rainbow'); await at(placed.x, placed.z)
  await openFree(); await free(look([placed.x, 6, placed.z], [placed.x + ux * 100, 40, placed.z + uz * 100]), 2500); await shot('05-rainbow')
  let subjects = await shoot(); assert(subjects.includes('rainbow'), JSON.stringify(subjects)); await leave()
  assert(await evaluate("journalStore.getState().book.page.tasks.find(t=>t.id==='shotRainbow')?.doneAt!==null"))
  await day(clear, 'day', 6000); await at(placed.x, placed.z)
  await openFree(); await free(look([placed.x, 6, placed.z], [placed.x + ux * 100, 40, placed.z + uz * 100]), 2500); await shot('06-no-rainbow')
  subjects = await shoot(); assert(!subjects.includes('rainbow'), JSON.stringify(subjects)); await leave()
  check('the day after rain shows a rainbow over the sea opposite the sun and its photo completes the task; a plain clear day does not', { stand: placed })

  // 6. River lanterns: refused by day, set at night with F, ride the creek and count in a photo.
  const launch = await evaluate('lanterns.launchStand')
  await day(clear, 'day', 2000); await at(launch.x, launch.z)
  assert.equal(await hint(), '天黑后再来放灯')
  await evaluate("forestStore.setState({timeOfDay:'night'})"); await sleep(3000)
  assert.equal(await action(), 'F放一盏河灯')
  for (let i = 0; i < 3; i++) { await press('KeyF', 'f'); await waitFor(`forestStore.getState().lanterns.total===${i + 1}`, 'lantern set', 60); await sleep(2200) }
  assert(await evaluate("journalStore.getState().book.page.tasks.find(t=>t.id==='lantern')?.doneAt!==null"))
  // From upstream on the north bank, looking down the creek toward the bridge as the lanterns set off.
  await openFree(); await free(look([launch.x + 2.6, 7.3, launch.z + .4], [launch.x - 4, 5.5, launch.z - 1.7]), 1200); await shot('07-lanterns-set')
  subjects = await shoot(); assert(subjects.includes('lanterns'), JSON.stringify(subjects)); await leave()
  await sleep(22000)
  const mid = await evaluate("(()=>{const g=forestScene.getObjectByName('river-lanterns');return g.children.filter(o=>o.visible).map(o=>({x:+o.position.x.toFixed(1),y:+o.position.y.toFixed(2),z:+o.position.z.toFixed(1)}))})()")
  assert.equal(mid.length, 3); assert(mid.every(p => p.x < -18), JSON.stringify(mid))
  const lead = mid.reduce((a, b) => a.x < b.x ? a : b)
  const bank = await evaluate(`(()=>{for(const d of [2.2,2.6,3,-2.2,-2.6,-3])if(movement.canStandAt(${lead.x}+2,${lead.z}+d))return{x:${lead.x}+2,z:${lead.z}+d};return null})()`)
  assert(bank, 'no bank near the lanterns'); await at(bank.x, bank.z)
  // Above the stream behind the lanterns, looking down the valley after them.
  const behind = await evaluate(`(()=>{const x=${lead.x}+5;return{x,z:expansion.creekZ(x),y:expansion.creekWaterY(x)}})()`)
  await openFree(); await free(look([behind.x, behind.y + 1.8, behind.z], [lead.x - 3, lead.y, lead.z]), 1500); await shot('08-lanterns-creek')
  subjects = await shoot(); assert(subjects.includes('lanterns'), JSON.stringify(subjects)); await leave()
  const lanternMs = await frameMs()
  check('lanterns are refused by day, set at night with F, photographed at the stone and carried down the creek', { mid, lanternMs })

  // 7. All six plots grown: how they sit in the island, and what they cost, from the tour's overview.
  await day(clear, 'day', 3000); await evaluate('forestStore.setState({lanterns:{launched:[],total:3}})')
  const overview = async () => { await click('.menu button', '导览'); await waitFor('tourStore.getState().active', 'tour on', 40); await waitFor('tourStore.getState().elapsed>8', 'overview hold', 200) }
  await evaluate('forestStore.setState({garden:{version:3,trees:[]}})'); await overview(); const bareMs = await frameMs(); await press('KeyW', 'w'); await sleep(800)
  await evaluate('forestStore.setState({garden:{version:3,trees:growth.plantingSpots.map((_,spot)=>({spot,plantedAt:0,stage:3,day:spot}))}})'); await sleep(1500)
  await overview(); const grownMs = await frameMs(); await shot('09-six-trees-overview'); await press('KeyW', 'w'); await sleep(800)
  // Each from the island-centre side of its plot, where the approach is open.
  for (const i of [1, 4, 5]) {
    const p = plots[i], k = Math.hypot(p.x, p.z), ux = -p.x / k, uz = -p.z / k, g = await evaluate(`movement.groundHeightAt(${p.x},${p.z})`)
    await at(p.x + ux * 1.6, p.z + uz * 1.6); await openFree(); await free(look([p.x + ux * 5.5, g + 2.4, p.z + uz * 5.5], [p.x, g + 1.3, p.z]), 1500); await shot(`10-plot-${i}-grown`); await leave()
  }
  check('six grown trees stand clear on their plots', { bareMs, grownMs })

  // 8. The tour: start from the toolbar, fly the stops, dusk at the tower, then hand the island back unchanged.
  await evaluate("forestStore.setState({timeOfDay:'day'})"); await at(0, 10); await sleep(800)
  const before = await s('({p:s.position,light:s.timeOfDay})')
  await click('.menu button', '导览'); await waitFor('tourStore.getState().active', 'tour on', 40)
  assert.equal(await evaluate("document.querySelector('.menu')"), null)
  const stopAt = async (i, name) => { const t = await evaluate(`tour.tourStops.slice(0,${i}).reduce((n,s)=>n+s.fly+s.hold,0)+tour.tourStops[${i}].fly+2.5`); await waitFor(`tourStore.getState().elapsed>${t}`, name, 1200); await shot(name) }
  await stopAt(0, '11-tour-overview'); await stopAt(2, '12-tour-farm'); await stopAt(4, '13-tour-dock')
  await stopAt(6, '14-tour-lookout-dusk')
  assert.equal(await s('s.timeOfDay'), 'dusk')
  assert((await evaluate("document.querySelector('.tour-card').textContent")).includes('瞭望塔'))
  await waitFor('!tourStore.getState().active', 'tour ends', 300); await sleep(800)
  const after = await s('({p:s.position,light:s.timeOfDay,paused:s.menuPaused})')
  assert.deepEqual([after.p, after.light, after.paused], [before.p, 'day', false])
  assert.equal(await evaluate("document.activeElement?.getAttribute('aria-label')"), '导览小岛（约 90 秒，按任意键退出）')
  await click('.menu button', '导览'); await waitFor('tourStore.getState().elapsed>3', 'second tour', 80)
  await press('KeyW', 'w'); await sleep(600)
  assert.equal(await evaluate('tourStore.getState().active'), false); assert.deepEqual(await s('s.position'), before.p)
  check('the tour flies all seven stops with captions, turns to dusk at the tower, ends by itself or on any key, and leaves position and light as they were')

  // 9. The field guide's mistfish line, and English captions.
  await click('.menu button', '图鉴'); await sleep(300)
  assert((await evaluate("document.querySelector('.species-list').textContent")).includes('雾鱼')); await press('Escape', 'Escape'); await sleep(300)
  await click('.lang-switch'); await sleep(300)
  await click('.menu button', 'Tour'); await waitFor('tourStore.getState().elapsed>9', 'english tour', 200)
  assert((await evaluate("document.querySelector('.tour-card').textContent")).includes('forest island')); await shot('15-tour-english')
  await press('Escape', 'Escape'); await sleep(300); await click('.lang-switch'); await sleep(300)
  check('captions follow the language switch')

  assert.deepEqual(report.errors, [])
  report.status = 'PASS'
} catch (e) {
  report.status = 'FAIL'; report.failure = e.stack ?? String(e); console.error(e); process.exitCode = 1
} finally {
  try { await writeFile(`${out}/report.json`, JSON.stringify(report, null, 2)) } finally { socket?.close(); await cleanup() }
}
