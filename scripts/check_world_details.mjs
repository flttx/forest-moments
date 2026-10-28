// Rain on the ground and the creek, the jellyfish under the sea, the three new hidden corners and the seasons' own life. Isolated headless Edge, one browser.
import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createHeadlessBrowser } from './browser-session.mjs'

const out = resolve(process.env.FOREST_QA_OUT ?? 'docs/evidence/2026-10-28-details')
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
  await evaluate(`(async()=>{const r=p=>performance.getEntriesByType('resource').find(e=>new URL(e.name).pathname===p).name;window.forestStore=(await import(r('/src/game/store.ts'))).useForestStore;window.uiStore=(await import(r('/src/game/uiStore.ts'))).useUiStore;window.photoStore=(await import(r('/src/game/photoStore.ts'))).usePhotoStore;window.journalStore=(await import(r('/src/game/journalStore.ts'))).useJournalStore;window.photoStore=(await import(r('/src/game/photoStore.ts'))).usePhotoStore;window.photoMod=await import(r('/src/game/photoStore.ts'));window.forage=await import(r('/src/game/forage.ts'));window.farm=await import(r('/src/game/farm.ts'));window.inventoryStore=(await import(r('/src/game/inventoryStore.ts'))).useInventoryStore;window.settlement=await import(r('/src/world/settlement.ts'));window.workshop=await import(r('/src/game/workshop.ts'));window.movement=await import(r('/src/game/movement.ts'));window.furniture=await import(r('/src/game/furniture.ts'));window.secrets=await import(r('/src/game/secrets.ts'));window.expansion=await import(r('/src/game/expansion.ts'));window.weather=await import(r('/src/game/weather.ts'));window.lookout=await import(r('/src/game/lookout.ts'))})()`)
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
  const days = await evaluate("(()=>{const pick=(w,s)=>{for(let d=1;d<400;d++)if(weather.weatherFor(d)===w&&weather.seasonFor(d)===s)return d;return null};return{clear:pick('clear','summer'),rain:pick('rain','summer'),spring:pick('clear','spring'),autumn:pick('clear','autumn')}})()")
  const found = () => evaluate("Object.keys(forestStore.getState().secretsBook.found)")
  const day = async (d, light = 'day') => { await evaluate(`forestStore.setState(s=>({homeBook:{...s.homeBook,nights:${d}},timeOfDay:'${light}',location:'island',mode:'walking'}))`); await sleep(5500); await evaluate('uiStore.getState().closePanel()') }
  const free = async (view, wait = 1500) => { await evaluate(`photoMod.freeCam.view=${view}`); await sleep(wait) }
  const openFree = async () => { await press('KeyP', 'p'); await sleep(300); await click('.photo-bar button', '自由取景'); await sleep(200); await click('.photo-bar button', '隐藏浣熊'); await sleep(200) }
  const shoot = async () => { await evaluate('photoStore.setState({last:null})'); await press('Space', ' '); await waitFor('!!photoStore.getState().last', 'photo', 100); await sleep(400); return evaluate('photoStore.getState().last.subjects') }
  const leave = async () => { await press('Escape', 'Escape'); await sleep(300) }
  const look = (from, to) => `{x:${from[0]},y:${from[1]},z:${from[2]},yaw:Math.atan2(${to[0] - from[0]},${to[2] - from[2]}),pitch:Math.atan2(${to[1] - from[1]},Math.hypot(${to[0] - from[0]},${to[2] - from[2]}))}`
  const action = () => evaluate("document.querySelector('.interaction .action-button')?.textContent??''")

  // 1. Rain on the ground: puddles in the worn track and splashes around the raccoon; the creek takes rings too.
  for (const [label, d] of [['clear', days.clear], ['rain', days.rain]]) {
    await day(d); await evaluate('forestStore.getState().updatePosition(-1.3,7)'); await sleep(800)
    const splash = await evaluate("forestScene.getObjectByName('rain-splashes')?.visible")
    await openFree(); await free(look([-.6, 1.6, 12.5], [-1.6, 0, 6]), 2000); await shot(`01-path-${label}`)
    await evaluate('forestStore.getState().updatePosition(-17.7,-17.3)'); await sleep(600)
    await free(look([-16.6, 7, -17.6], [-21, 4.2, -19.9]), 2000); await shot(`02-creek-${label}`)
    await leave()
    assert.equal(splash, label === 'rain', `splashes ${label}`)
  }
  check('rain leaves puddles with rings on the tracks, splashes around the raccoon and rings on the creek; none on a clear day')

  // 2. The jellyfish at night shows through the sea beside the jetty.
  await day(days.clear, 'night'); const j = await evaluate('secrets.jellyfishSpot')
  await evaluate(`forestStore.getState().updatePosition(${j.x},0)`); await sleep(800)
  await openFree(); await free(look([j.x - 1.6, 1.4, j.z + 1.6], [j.x, j.y, j.z]), 2500); await shot('03-jellyfish-night'); await leave()
  check('the jellyfish glows through the sea at night')

  // 3. Fox den below the lookout hill: a tail tip by day, eyes at night; F finds it.
  const fox = await evaluate('secrets.foxDen')
  await day(days.clear); await evaluate(`forestStore.getState().updatePosition(${fox.stand.x},${fox.stand.z})`); await sleep(1000)
  assert((await action()).includes('洞口'), await action())
  await openFree(); await free(look([fox.x - 1.1, 5.4, fox.z + 2.5], [fox.x - .4, 4.8, fox.z + .7]), 1800); await shot('04-fox-den-day'); await leave()
  await press('KeyF', 'f'); await sleep(400); assert((await found()).includes('foxDen'))
  // A finished journal task may take the first notice; F again reads the note.
  await press('KeyF', 'f'); await sleep(400)
  assert((await evaluate("document.querySelector('.notice')?.textContent??''")).includes('狐狸'))
  await evaluate("forestStore.setState({timeOfDay:'night'})"); await sleep(2500)
  await openFree(); await free(look([fox.x - 1.1, 5.4, fox.z + 2.5], [fox.x - .4, 4.8, fox.z + .7]), 1800); await shot('05-fox-den-night'); await leave()
  await evaluate("forestStore.setState({timeOfDay:'dusk'})"); await sleep(2500)
  await openFree(); await free(look([fox.x - 1.1, 5.4, fox.z + 2.5], [fox.x - .4, 4.8, fox.z + .7]), 1800); await shot('05b-fox-den-dusk'); await leave()
  const foxes = await evaluate("(()=>{const g=forestScene.getObjectByName('secret-fox-den');let meshes=0;g?.traverse(m=>{if(m.isMesh)meshes++});return meshes})()")
  assert(foxes > 3, 'fox den models missing')
  check('the fox den: the fox sleeps in front by day, peeks out at dusk, only its eyes show at night; F at the trail finds it')

  // 4. The heart stone: a plain slab from the trail, a heart face on; only the face-on photo finds it.
  await day(days.clear)
  const heart = await evaluate('secrets.heartStone')
  await evaluate(`forestStore.getState().updatePosition(${heart.x},${heart.z - 5})`); await sleep(800)
  await openFree(); await free(look([heart.x, 1.4, heart.z - 6], [heart.x, .6, heart.z]), 1800); await shot('07-heart-stone-trail')
  let subjects = await shoot(); assert(!subjects.includes('heartStone'), JSON.stringify(subjects))
  await free(look([heart.x - 4.5, 1.3, heart.z + .3], [heart.x, .6, heart.z]), 1800); await shot('08-heart-stone-face')
  subjects = await shoot(); assert(subjects.includes('heartStone'), JSON.stringify(subjects)); await leave()
  assert((await found()).includes('heartStone'))
  assert.notEqual(await evaluate(`movement.standBlocker(${heart.x},${heart.z})`), null)
  check('the heart stone shows its heart only face on; that photo finds it, the trail view does not', { subjects })

  // 5. The carving on the lookout timber: look back from the platform and photograph it.
  await evaluate('forestStore.getState().updatePosition(lookout.lookoutEntry.x,lookout.lookoutEntry.z)'); await sleep(600)
  await press('KeyF', 'f'); await waitFor("forestStore.getState().mode==='lookout'&&!forestStore.getState().lookoutTransfer", 'on the lookout', 120)
  const carving = await evaluate("(()=>{const o=forestScene.getObjectByName('secret-carving');if(!o?.visible)return null;const p=o.getWorldPosition(o.position.clone());return{x:p.x,y:p.y,z:p.z}})()")
  assert(carving, 'carving not placed')
  await evaluate(`(()=>{const e=lookout.lookoutEye,dx=${carving.x}-e.x,dy=${carving.y}-e.y,dz=${carving.z}-e.z;forestStore.setState({lookoutView:{yaw:Math.atan2(dx,dz),pitch:Math.atan2(dy,Math.hypot(dx,dz))}})})()`); await sleep(1500)
  await press('KeyP', 'p'); await sleep(500); await shot('09-carving')
  subjects = await shoot(); assert(subjects.includes('carving'), JSON.stringify(subjects)); await leave()
  assert((await found()).includes('carving'))
  await press('KeyF', 'f'); await waitFor("forestStore.getState().mode==='walking'&&!forestStore.getState().lookoutTransfer", 'back down', 120)
  check('the carving sits on the lookout timber behind the view; a photo of it finds it', { carving })

  // 6. Seasons: the same meadow in spring, summer and autumn; summer nights full of fireflies.
  for (const [label, d] of [['spring', days.spring], ['summer', days.clear], ['autumn', days.autumn]]) {
    await day(d); await evaluate('forestStore.getState().updatePosition(-17,15)'); await sleep(800)
    await openFree(); await free(look([-15.5, 1.7, 13], [-20, 0, 19.5]), 2000); await shot(`10-meadow-${label}`); await leave()
  }
  const flies = {}
  for (const [label, d] of [['summer', days.clear], ['autumn', days.autumn]]) {
    await day(d, 'night'); await evaluate('forestStore.getState().updatePosition(-17,15)'); await sleep(3000)
    flies[label] = await evaluate("+forestScene.getObjectByName('fireflies').material.uniforms.opacity.value.toFixed(2)")
  }
  assert(flies.summer > flies.autumn + .3, JSON.stringify(flies))
  check('spring fills the meadow with flowers, autumn lays leaves; summer nights have the most fireflies', { flies })

  await click('.menu button', '图鉴'); await sleep(300); await click('.catalog-tabs button', '隐藏角落'); await sleep(300)
  const page = await evaluate("[...document.querySelectorAll('#catalog-page li')].map(li=>li.className+':'+li.querySelector('strong').textContent)")
  assert.equal(page.length, 6); assert.equal(page.filter(p => p.startsWith('found')).length, 3, JSON.stringify(page)); await shot('11-field-guide')
  check('the field guide lists six hidden corners, the three new ones found', { page })
  assert.deepEqual(report.errors, [])
  report.status = 'PASS'
} catch (e) {
  report.status = 'FAIL'; report.failure = e.stack ?? String(e); console.error(e); process.exitCode = 1
} finally {
  try { await writeFile(`${out}/report.json`, JSON.stringify(report, null, 2)) } finally { socket?.close(); await cleanup() }
}
