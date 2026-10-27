// Photo mode free framing: flies by hand, stays within 15 m of the raccoon, above ground, outside buildings and crowns. Real keys/mouse in isolated headless Edge.
import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createHeadlessBrowser } from './browser-session.mjs'

const out = resolve(process.env.FOREST_QA_OUT ?? 'docs/evidence/2026-10-27-photo/free')
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
  const qa = () => evaluate("JSON.parse(document.querySelector('canvas').dataset.forestQa)")
  const dist = async () => { const q = await qa(); const c = q.cameraPosition, p = q.position; return { d: Math.hypot(c[0] - p[0], c[1] - p[1] - .5, c[2] - p[2]), cam: c, pos: p } }
  const hold = async (code, k, ms) => { await cmd('Input.dispatchKeyEvent', { type: 'keyDown', code, key: k, windowsVirtualKeyCode: k.toUpperCase().charCodeAt(0) }); await sleep(ms); await cmd('Input.dispatchKeyEvent', { type: 'keyUp', code, key: k, windowsVirtualKeyCode: k.toUpperCase().charCodeAt(0) }) }
  const drag = async (dx, dy) => {
    await cmd('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 700, y: 400 })
    await cmd('Input.dispatchMouseEvent', { type: 'mousePressed', x: 700, y: 400, button: 'right', buttons: 2, clickCount: 1 })
    for (let i = 1; i <= 10; i++) await cmd('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 700 + dx * i / 10, y: 400 + dy * i / 10, buttons: 2 })
    await cmd('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 700 + dx, y: 400 + dy, button: 'right', buttons: 0, clickCount: 1 })
  }
  const photo = (expr) => evaluate(`(()=>{const p=photoStore.getState(),s=forestStore.getState();return ${expr}})()`)
  await boot(1440, 900, true)
  await waitFor("!document.querySelector('.guide')", 'guide folds away', 120)
  await press('KeyP', 'p'); await sleep(500)
  await click('.photo-bar button', '自由取景'); await sleep(600)
  assert.equal(await photo('p.free'), true)
  assert((await evaluate("document.querySelector('.photo-hint').textContent")).includes('WASD 平移'))
  const start = await dist(); await shot('01-free-start')

  // 1. Keys fly the camera and the raccoon stays put.
  await hold('KeyW', 'w', 1200); const ahead = await dist()
  assert(Math.hypot(ahead.cam[0] - start.cam[0], ahead.cam[2] - start.cam[2]) > 2, 'W flies forward')
  assert.deepEqual(ahead.pos, start.pos); check('free camera flies with WASD while the raccoon stays', { start: start.cam, ahead: ahead.cam })
  await hold('KeyE', 'e', 800); assert((await dist()).cam[1] > ahead.cam[1] + 1.5, 'E rises')
  check('Q/E fly down and up')

  // 2. Turning with the mouse changes the direction of travel; the wheel dollies along the view.
  const before = (await dist()).cam; await drag(250, 0); await hold('KeyW', 'w', 800); const after = (await dist()).cam
  const h1 = Math.atan2(before[0] - ahead.cam[0], before[2] - ahead.cam[2]), h2 = Math.atan2(after[0] - before[0], after[2] - before[2])
  assert(Math.abs(Math.atan2(Math.sin(h2 - h1), Math.cos(h2 - h1))) > 0.3, 'turned heading')
  const w0 = (await dist()).cam; for (let i = 0; i < 6; i++) { await cmd('Input.dispatchMouseEvent', { type: 'mouseWheel', x: 700, y: 400, deltaX: 0, deltaY: -300 }); await sleep(40) }
  await sleep(300); const w1 = (await dist()).cam; assert(Math.hypot(w1[0] - w0[0], w1[1] - w0[1], w1[2] - w0[2]) > 3, 'wheel dollies')
  check('right-drag turns the view (travel follows it); the wheel dollies')

  // 3. It can never leave the 15 m bubble, the ground, or the buildings.
  for (const code of ['KeyW', 'KeyD', 'KeyA', 'KeyS']) { await hold(code, code[3].toLowerCase(), 7000); const d = await dist(); assert(d.d <= 15.05, `radius ${d.d}`) }
  await hold('KeyW', 'w', 7000); assert((await dist()).d <= 15.05)
  await shot('02-far-edge')
  await drag(0, -500); await hold('KeyQ', 'q', 6000); const low = await qa()
  const ground = await evaluate(`(async()=>{const r=p=>performance.getEntriesByType('resource').find(e=>new URL(e.name).pathname===p).name;const m=await import(r('/src/game/movement.ts'));return m.groundHeightAt(${(await qa()).cameraPosition[0]},${(await qa()).cameraPosition[2]})})()`)
  assert(low.cameraPosition[1] >= Math.max(ground, 0) + 0.25, `above ground ${low.cameraPosition[1]} vs ${ground}`)
  check('stays within 15 m of the raccoon and above the ground', { cam: low.cameraPosition, ground })
  await shot('03-low')

  // 4. Hidden raccoon + shutter work in free mode; leaving restores the orbit camera.
  await press('Space', ' '); await waitFor("!!document.querySelector('.photo-last img')", 'free photo', 100)
  check('a photo can be taken from the free camera')
  await click('.photo-bar button', '自由取景'); await sleep(1500)
  assert.equal(await photo('p.free'), false); const back = await dist(); assert(back.d < 13, 'orbit camera returns')
  await shot('04-back-to-orbit')
  await press('Escape', 'Escape'); await sleep(400)
  assert.equal(await photo('p.active'), false); check('toggling off returns to the orbit; Esc leaves photo mode')

  assert.deepEqual(report.errors, [])
  report.status = 'PASS'
} catch (e) {
  report.status = 'FAIL'; report.failure = e.stack ?? String(e); console.error(e); process.exitCode = 1
} finally {
  try { await writeFile(`${out}/report.json`, JSON.stringify(report, null, 2)) } finally { socket?.close(); await cleanup() }
}
