// South beach sand play (docs/BEACH_SANDPLAY_PLAN.md): paw prints, the quick bar, four works, refusals, cancelling, reload and the overnight tide. Isolated headless Edge, one browser.
import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createHeadlessBrowser } from './browser-session.mjs'

const out = resolve(process.env.FOREST_QA_OUT ?? 'docs/evidence/2026-10-28-sandplay/after')
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
async function boot(view = '', fresh = false) {
  await cmd('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })
  if (fresh) await evaluate('localStorage.clear()').catch(() => {})
  await cmd('Page.navigate', { url: `${base}?qa&light=day${view ? '&view=' + view : ''}` })
  await sleep(500); await waitFor(ready, 'scene ready', 400); await sleep(1500)
  await evaluate(`(async()=>{const r=p=>performance.getEntriesByType('resource').find(e=>new URL(e.name).pathname===p).name;window.forestStore=(await import(r('/src/game/store.ts'))).useForestStore;window.uiStore=(await import(r('/src/game/uiStore.ts'))).useUiStore;window.sandMod=await import(r('/src/game/sandStore.ts'));window.sandStore=sandMod.useSandStore;window.field=await import(r('/src/world/sandField.ts'));window.lang=(await import(r('/src/i18n.ts'))).useLang})()`)
  await evaluate('uiStore.getState().closePanel()')
}
const key = async (code, k, ms) => { await cmd('Input.dispatchKeyEvent', { type: 'keyDown', code, key: k, windowsVirtualKeyCode: keyCode(k) }); await sleep(ms); await cmd('Input.dispatchKeyEvent', { type: 'keyUp', code, key: k, windowsVirtualKeyCode: keyCode(k) }) }
const place = async (x, z) => { await evaluate(`forestStore.setState({location:'island',mode:'walking',position:{x:${x},z:${z}}})`); await sleep(600) }
const sandState = () => evaluate('(()=>{const s=sandStore.getState();return{active:s.active,tool:s.tool,build:!!s.build,works:s.book.works,day:s.book.day}})()')
const message = () => evaluate('forestStore.getState().message')
const groundY = (x, z) => evaluate(`field.sandGroundAt(${x},${z})`)
const builtUpTo = (n) => waitFor(`sandStore.getState().book.works.length===${n}&&!sandStore.getState().build`, 'work done', 80)
/** Which movement key heads out to sea (+z on the south beach) under the current camera, so outlines land on the sand. */
const keys = { w: 'KeyW', a: 'KeyA', s: 'KeyS', d: 'KeyD' }
let seaward = 'd'
async function findSeaward() {
  let best = -Infinity
  for (const k of Object.keys(keys)) {
    await place(0, 30); await key(keys[k], k, 200)
    const x = await evaluate('forestStore.getState().position.z')
    if (x > best) { best = x; seaward = k }
  }
  report.seaward = { key: seaward, x: best }
}
/** Step briefly toward the sea so the raccoon faces it. */
const faceSea = async () => { await key(keys[seaward], seaward, 120); await sleep(100) }
const reach = { castle: 1.25, river: .9, pit: 1.2, imprint: 1.1 }
/** Stand so the outline of `kind` lands on (x, z): face the sea, then step back along the facing. */
async function aimAt(kind, x, z) {
  await faceSea()
  const f = await evaluate('sandMod.sandAim.facing')
  await place(x + Math.sin(f) * reach[kind], z + Math.cos(f) * reach[kind])
}
const wheel = (deltaY) => cmd('Input.dispatchMouseEvent', { type: 'mouseWheel', x: 720, y: 450, deltaX: 0, deltaY })
const printTexels = () => evaluate('(()=>{let n=0;const t=field.sandTexture.image.data;for(let i=1;i<t.length;i+=4)if(t[i])n++;return n})()')
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
  await boot('', true)

  // 1. Paw prints: walking the sand presses alternating prints that shade the beach.
  await findSeaward(); await place(-2.5, 28.5); await shot('01-beach-before')
  await key(keys[seaward], seaward, 1500)
  const prints = await printTexels()
  assert(prints > 40, `prints ${prints}`)
  await shot('02-paw-prints')
  await wheel(-900); await sleep(900); await shot('02b-paw-prints-close'); await wheel(900); await sleep(600)
  check('walking on the play sand presses paw prints', { printTexels: prints })

  // 2. Off the beach there is no way in; on it, B opens the quick bar.
  await place(-1.7, 12); await press('KeyB', 'b'); await sleep(300)
  assert.equal((await sandState()).active, false)
  await place(-4, 28); await sleep(300)
  assert(await evaluate("[...document.querySelectorAll('.action-button')].some(b=>b.textContent.includes('玩沙'))"), 'beach prompt')
  await press('KeyB', 'b'); await sleep(400)
  assert.equal((await sandState()).active, true)
  assert.equal(await evaluate("document.querySelectorAll('.sand-tool').length"), 4)
  check('B is refused away from the beach and opens the four-work quick bar on it')

  // 3. A castle: outline, F, the raccoon digs for three seconds, it stands.
  await aimAt('castle', -4, 30); await press('Digit1', '1'); await sleep(500); await shot('03-castle-outline')
  await press('KeyF', 'f'); await sleep(1500)
  const building = (await sandState()).build
  await shot('04-castle-building')
  await builtUpTo(1)
  const castle = (await sandState()).works[0]; assert.equal(castle.kind, 'castle'); assert(building, 'still building halfway')
  await sleep(500); await shot('05-castle-done')
  check('F builds a castle over about three seconds', { castle, message: await message() })

  // 4. Refusal: against the rocks the outline turns red and F says why.
  await aimAt('pit', -12.5, 35.3); await press('Digit3', '3'); await sleep(400); await shot('06-refused-dock')
  await press('KeyF', 'f'); await sleep(300)
  const refused = await message();
  assert.equal((await sandState()).works.length, 1, 'nothing built on the rocks'); assert(refused, 'a reason is given')
  check('a pit against the rocks is refused with a reason', { refused })

  // 5. A pit lowers the ground; Esc halfway through leaves nothing.
  await aimAt('pit', 4, 30); await press('Digit3', '3'); await sleep(300)
  await press('KeyF', 'f'); await sleep(1200); await press('Escape', 'Escape'); await sleep(400)
  assert.equal((await sandState()).works.length, 1, 'cancelled pit not kept')
  await press('KeyF', 'f'); await builtUpTo(2)
  const pit = (await sandState()).works[1], pitGround = await groundY(pit.x, pit.z)
  assert(pitGround < -.25, `pit ground ${pitGround}`)
  check('Esc stops a pit halfway with nothing kept; a finished pit lowers the ground', { pit, pitGround })

  // 6. A stream from the dug end to the sea, and a raccoon print turned with R.
  await aimAt('river', 1, 33.2); await press('Digit2', '2'); await sleep(400); await shot('07-river-outline')
  await click('.sand-hud .action-button'); await builtUpTo(3); await sleep(1200); await shot('08-river-done')
  await aimAt('imprint', -8, 31); await click('.sand-tool', '浣熊印'); await press('KeyR', 'r'); await press('KeyR', 'r'); await sleep(400); await shot('09-imprint-outline')
  await press('KeyF', 'f'); await builtUpTo(4)
  const works = (await sandState()).works
  assert.deepEqual(works.map(w => w.kind), ['castle', 'pit', 'river', 'imprint'])
  assert(Math.abs(works[3].yaw - Math.PI / 4) < 1e-6, `print turned ${works[3].yaw}`)
  await press('Escape', 'Escape'); await sleep(300); assert.equal((await sandState()).active, false)
  check('a stream runs to the sea, a print turns with R; Esc closes the bar', { works })

  // 7. Reload: the day's works are still there.
  await boot('sandPlay'); await sleep(1500); await shot('10-beach-overview')
  assert.equal((await sandState()).works.length, 4, 'works survive a reload')
  await boot('sandClose'); await sleep(1500); await shot('11-beach-close')
  check('works survive a reload')

  // 8. The tide: sleeping into the next day smooths the beach.
  await boot('sandPlay')
  const today = (await sandState()).day
  await evaluate(`forestStore.setState(s=>({homeBook:{...s.homeBook,nights:${today + 1}}}))`); await sleep(1500); await evaluate('uiStore.getState().closePanel()')
  const after = await sandState(); assert.equal(after.works.length, 0); assert.equal(after.day, today + 1)
  assert(Math.abs(await groundY(pit.x, pit.z)) < 1e-6, 'pit smoothed')
  await sleep(800); await shot('12-after-tide')
  check('the next day starts with smooth sand')

  // 9. English labels.
  await boot(); await place(0, 30); await evaluate("lang.getState().setLang('en')")
  await press('KeyB', 'b'); await sleep(500); await shot('13-quick-bar-en')
  const labels = await evaluate("[...document.querySelectorAll('.sand-tool span')].map(s=>s.textContent)")
  assert.deepEqual(labels, ['Castle', 'Stream', 'Pit', 'Raccoon print'])
  await evaluate("lang.getState().setLang('zh')")
  check('quick bar in English', { labels })

  assert.deepEqual(report.errors, [])
  report.status = 'PASS'
} catch (e) {
  report.status = 'FAIL'; report.failure = e.stack ?? String(e); console.error(e); process.exitCode = 1
  try { await shot('failure') } catch { /* the original error is what the report needs */ }
} finally {
  try { await writeFile(`${out}/report.json`, JSON.stringify(report, null, 2)) } finally { socket?.close(); await cleanup() }
}
