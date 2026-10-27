// Photo tasks and the photo wall (plan X2 §2.6–2.7): the shutter judges what is in frame; album tags and filter; hung photos appear in the bedroom. Isolated headless Edge.
import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createHeadlessBrowser } from './browser-session.mjs'

const out = resolve(process.env.FOREST_QA_OUT ?? 'docs/evidence/2026-10-27-expansion/x2-photo-tasks')
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
  await evaluate(`(async()=>{const r=p=>performance.getEntriesByType('resource').find(e=>new URL(e.name).pathname===p).name;window.forestStore=(await import(r('/src/game/store.ts'))).useForestStore;window.uiStore=(await import(r('/src/game/uiStore.ts'))).useUiStore;window.photoStore=(await import(r('/src/game/photoStore.ts'))).usePhotoStore;window.journalStore=(await import(r('/src/game/journalStore.ts'))).useJournalStore;window.photoStore=(await import(r('/src/game/photoStore.ts'))).usePhotoStore;window.photoMod=await import(r('/src/game/photoStore.ts'));window.photoAlbum=await import(r('/src/game/photoAlbum.ts'));window.expansion=await import(r('/src/game/expansion.ts'))})()`)
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
  await evaluate('indexedDB.deleteDatabase("forest-moments:photos:v1")'); await sleep(300)
  await waitFor("!document.querySelector('.guide')", 'guide folds away', 120)
  await evaluate("journalStore.setState(s=>({book:{...s.book,page:{...s.book.page,tasks:[{id:'shotCabin',progress:0,doneAt:null},{id:'shotSunset',progress:0,doneAt:null},{id:'shotFireflies',progress:0,doneAt:null}]}}}))")
  // Latency: shutter key to the preview being ready (includes the in-frame judgement and PNG encoding).
  const latency = []
  const shoot = async () => { await evaluate("photoStore.setState({last:null})"); const t0 = Date.now(); await press('Space', ' '); await waitFor("!!photoStore.getState().last", 'shot', 100); latency.push(Date.now() - t0); await sleep(700); return evaluate("photoStore.getState().last.subjects") }
  // 1. Stand south of the cabin, free camera framing the whole cabin.
  const cabin = await evaluate("expansion.cabin")
  await evaluate(`forestStore.getState().updatePosition(${cabin.x},${cabin.doorZ + 6})`); await sleep(1200)
  await press('KeyP', 'p'); await sleep(400); await click('.photo-bar button', '自由取景'); await sleep(400)
  await evaluate(`photoMod.freeCam.view={x:${cabin.x},y:10.6,z:${cabin.doorZ + 12},yaw:Math.PI,pitch:-.12}`); await sleep(900)
  const cabinShot = await shoot(); await shot('01-cabin')
  assert(cabinShot.includes('cabin'), JSON.stringify(cabinShot)); check('a framed shot of the cabin counts as the cabin', { cabinShot })
  // Turned away it does not.
  await evaluate(`photoMod.freeCam.view={x:${cabin.x},y:10.6,z:${cabin.doorZ + 12},yaw:0,pitch:-.12}`); await sleep(900)
  const away = await shoot(); assert(!away.includes('cabin'), JSON.stringify(away)); check('facing away from the cabin does not count', { away })
  // 2. Dusk, looking at the sun.
  await click('.photo-bar button', '黄昏'); await sleep(1500)
  const sun = await evaluate("(async()=>{const r=p=>performance.getEntriesByType('resource').find(e=>new URL(e.name).pathname===p).name;const {dayLighting}=await import(r('/src/world/dayLighting.ts'));const {daylightAt}=await import(r('/src/game/dayCycle.ts'));const p=dayLighting(daylightAt(forestStore.getState()),forestStore.getState().sunRising).sunPosition;return {x:p.x,y:p.y,z:p.z}})()")
  const yaw = Math.atan2(sun.x, sun.z), pitch = Math.atan2(sun.y, Math.hypot(sun.x, sun.z))
  await evaluate(`photoMod.freeCam.view={...photoMod.freeCam.view,yaw:${yaw},pitch:${pitch}}`); await sleep(900)
  const sunset = await shoot(); await shot('02-sunset')
  assert(sunset.includes('sunsetSea'), JSON.stringify({ sunset, sun })); check('dusk with the sun in frame counts as a sunset', { sunset })
  // 3. Night fireflies around the raccoon.
  await click('.photo-bar button', '自由取景'); await click('.photo-bar button', '夜晚'); await sleep(3500)
  const night = await shoot(); await shot('03-fireflies')
  check('night shot near fireflies', { night })
  const done = await evaluate("journalStore.getState().book.page.tasks.map(t=>t.id+':'+(t.doneAt?1:0))")
  check('journal photo tasks', { done, shutterMs: latency })
  assert(done.includes('shotCabin:1') && done.includes('shotSunset:1'), JSON.stringify(done))
  await press('Escape', 'Escape'); await sleep(400)
  // 4. Album: tags and filter; hang the cabin photo on the wall.
  await click('.menu button', '相册'); await sleep(800)
  const tags = await evaluate("[...document.querySelectorAll('.album-tags button')].map(b=>b.textContent)")
  assert(tags.includes('小屋') && tags.includes('落日海面'), JSON.stringify(tags))
  await click('.album-tags button', '小屋'); await sleep(300)
  assert.equal(await evaluate("document.querySelectorAll('.album-grid li').length"), 1); check('album filters by what is in frame', { tags })
  await click('.album-grid button', '挂到墙上'); await sleep(300)
  assert.equal(await evaluate("photoStore.getState().wall.length"), 1); await shot('04-album')
  await press('Escape', 'Escape')
  // 5. Into the bedroom: the photo hangs on the north wall; survives a reload.
  await boot(1440, 900)
  assert.equal(await evaluate("photoStore.getState().wall.length"), 1)
  await evaluate("forestStore.setState({location:'bedroom',position:{x:.3,z:1.2},mode:'walking'})"); await sleep(1500)
  await evaluate("photoStore.getState().enter()"); await sleep(300); await click('.photo-bar button', '自由取景'); await sleep(300)
  await evaluate("photoMod.freeCam.view={x:-1.2,y:1.9,z:1.2,yaw:Math.PI+.35,pitch:.04}"); await sleep(1500)
  const frames = await evaluate("(()=>{const w=forestScene.getObjectByName('photo-wall');let maps=0;w?.traverse(o=>{if(o.isMesh&&o.material.map)maps++});return maps})()")
  assert.equal(frames, 1); await shot('05-photo-wall'); check('the hung photo shows on the bedroom wall after reload', { frames })
  assert.deepEqual(report.errors, [])
  report.status = 'PASS'
} catch (e) {
  report.status = 'FAIL'; report.failure = e.stack ?? String(e); console.error(e); process.exitCode = 1
} finally {
  try { await writeFile(`${out}/report.json`, JSON.stringify(report, null, 2)) } finally { socket?.close(); await cleanup() }
}
