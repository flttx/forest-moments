// Campfire evenings (plan X2 §2.2): real keys to sit, roast a fish (R) and look up at the stars (V); satchel and journal follow. Isolated headless Edge.
import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createHeadlessBrowser } from './browser-session.mjs'

const out = resolve(process.env.FOREST_QA_OUT ?? 'docs/evidence/2026-10-27-expansion/x2-camp')
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
const state = (expr) => evaluate(`(()=>{const s=forestStore.getState(),u=uiStore.getState();return ${expr}})()`)
const setState = (value) => evaluate(`forestStore.setState(${JSON.stringify(value)})`)
async function boot(width, height, fresh = false) {
  await cmd('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false })
  if (fresh) await evaluate('localStorage.clear()').catch(() => {})
  await cmd('Page.navigate', { url: `${base}?qa` })
  await sleep(500); await waitFor(ready, 'scene ready', 400); await sleep(1500)
  await evaluate(`(async()=>{const r=p=>performance.getEntriesByType('resource').find(e=>new URL(e.name).pathname===p).name;window.forestStore=(await import(r('/src/game/store.ts'))).useForestStore;window.uiStore=(await import(r('/src/game/uiStore.ts'))).useUiStore;window.photoStore=(await import(r('/src/game/photoStore.ts'))).usePhotoStore;window.journalStore=(await import(r('/src/game/journalStore.ts'))).useJournalStore;window.fishing=await import(r('/src/game/fishing.ts'));window.inventoryStore=(await import(r('/src/game/inventoryStore.ts'))).useInventoryStore;window.expansion=await import(r('/src/game/expansion.ts'))})()`)
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
  await evaluate("journalStore.setState(s=>({book:{...s.book,page:{...s.book.page,tasks:[{id:'roast',progress:0,doneAt:null},{id:'stars',progress:0,doneAt:null},{id:'tree',progress:0,doneAt:null}]}}}))")
  // A fish on hand and a lit fire; then walk up to the west seat and sit with F.
  await evaluate("forestStore.setState(s=>({fishBook:{count:1,bestCm:30,recent:[{sizeCm:30,at:new Date().toISOString(),species:'goldKoi'}],kinds:{goldKoi:{count:1,bestCm:30}}},homeBook:{...s.homeBook,fireLit:true}}))")
  const seat = await evaluate("(()=>{const s=expansion.seats.find(v=>v.id==='camp-west');return expansion.seatOrigin(s)})()")
  await evaluate(`forestStore.getState().updatePosition(${seat.x},${seat.z})`); await sleep(600)
  await press('KeyF', 'f'); await waitFor("forestStore.getState().sitting?.phase==='idle'", 'seated', 120)
  assert(await evaluate("!!document.querySelector('.camp-hud button')")); await shot('01-seated-camp')
  // R roasts: the gold koi goes on the spit and browns; standing still for six seconds finishes it.
  await press('KeyR', 'r'); await sleep(300)
  assert.equal(await state('s.roast?.species'), 'goldKoi')
  assert(await evaluate("!!forestScene.getObjectByName('roast-spit')")); await sleep(2500); await shot('02-roasting')
  await waitFor("forestStore.getState().roasted===1", 'roast done', 120)
  assert.equal(await evaluate("inventoryStore.getState().inv.items.roastFish"), 1)
  assert(await evaluate("!forestScene.getObjectByName('roast-spit')"))
  check('R roasts the newest fish by the lit fire; it lands in the satchel and leaves the spit')
  // Nothing left to roast: the button explains why.
  assert((await evaluate("document.querySelector('.camp-hud').textContent")).includes('没有可烤的鱼'))
  check('with nothing on hand the card says so')
  // Night: V looks up; stars brighten; V again looks back down.
  await setState({ timeOfDay: 'night' }); await sleep(1200)
  const before = await evaluate("JSON.parse(document.querySelector('canvas').dataset.forestQa).cameraPosition")
  await press('KeyV', 'v'); await sleep(3500)
  assert.equal(await state('s.stargazing'), true)
  const look = await evaluate("(()=>{const q=JSON.parse(document.querySelector('canvas').dataset.forestQa);return q.cameraPosition})()")
  await shot('03-stargazing')
  check('V looks up at the night sky from the seat', { before, look })
  const done = await evaluate("journalStore.getState().book.page.tasks.map(t=>t.id+':'+(t.doneAt?1:0))")
  assert.deepEqual(done, ['roast:1', 'stars:1', 'tree:0']); check('journal: roast and stars tasks complete', { done })
  await press('KeyV', 'v'); await sleep(500); assert.equal(await state('s.stargazing'), false)
  await press('KeyV', 'v'); await sleep(300); await press('KeyF', 'f'); await sleep(500)
  assert.equal(await state('s.stargazing'), false); check('V toggles back; standing up ends stargazing')
  // The satchel tab now lists the roast fish.
  await waitFor("forestStore.getState().mode==='walking'", 'stood up', 120)
  await click('.menu button', '图鉴'); await sleep(300); await click('.catalog-tabs button', '背包'); await sleep(300)
  assert((await evaluate("document.querySelector('.satchel-list').textContent")).includes('烤鱼')); await shot('04-satchel')
  check('satchel lists the roast fish')
  assert.deepEqual(report.errors, [])
  report.status = 'PASS'
} catch (e) {
  report.status = 'FAIL'; report.failure = e.stack ?? String(e); console.error(e); process.exitCode = 1
} finally {
  try { await writeFile(`${out}/report.json`, JSON.stringify(report, null, 2)) } finally { socket?.close(); await cleanup() }
}
