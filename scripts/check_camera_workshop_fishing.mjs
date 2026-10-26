// Isolated headless Edge only. CDP pattern reused from my-blog/scripts/t10-gait-check.mjs.
// Interior camera on entry, workbench reach, stool sitting, trail slopes and fishing water feedback.
// FOREST_QA_BEFORE=1 records the same route on the previous build without asserting the fixes.
import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createHeadlessBrowser } from './browser-session.mjs'

const before = process.env.FOREST_QA_BEFORE === '1'
const out = resolve(process.env.FOREST_QA_OUT ?? `docs/evidence/2026-10-26-camera-workshop-fishing/${before ? 'before' : 'after'}`)
await mkdir(out, { recursive: true })
const { profile, cleanup } = await createHeadlessBrowser([
  '--headless=new', '--disable-features=CalculateNativeWinOcclusion', '--disable-frame-rate-limit', '--disable-gpu-vsync', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--remote-debugging-port=0', '--no-first-run', '--no-default-browser-check', 'about:blank',
])
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const report = { date: new Date().toISOString(), mode: 'isolated headless Edge', build: before ? 'before' : 'after', viewport: [1440, 900], checks: [], errors: [], screenshots: [], status: 'RUNNING' }
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
async function shot(name) {
  const result = await cmd('Page.captureScreenshot', { format: 'png' })
  await writeFile(`${out}/${name}.png`, Buffer.from(result.data, 'base64'))
  report.screenshots.push(`${name}.png`)
}
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
  await cmd('Page.enable'); await cmd('Runtime.enable'); await cmd('Page.bringToFront'); await cmd('Emulation.setFocusEmulationEnabled', { enabled: true })
  await cmd('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })
  await cmd('Page.navigate', { url: 'http://127.0.0.1:5176/?qa' })
  for (let i = 0; i < 400; i++) {
    const loaded = await evaluate("!!document.querySelector('canvas')&&!document.querySelector('.asset-loading')&&!document.querySelector('.world-error')")
    if (loaded && i > 10) break
    if (i === 399) throw Error('Assets failed to load')
    await sleep(200)
  }

  const load = (p) => `(await import(performance.getEntriesByType('resource').find(e=>new URL(e.name).pathname==='${p}').name))`
  await evaluate(`(async()=>{window.forestStore=${load('/src/game/store.ts')}.useForestStore;window.workshop=${load('/src/game/workshop.ts')};window.fishing=${load('/src/game/fishing.ts')}})()`)
  const qa = () => evaluate("JSON.parse(document.querySelector('canvas').dataset.forestQa)")
  const press = (type, code, key) => cmd('Input.dispatchKeyEvent', { type, code, key })
  const key = async (code, key) => { await press('keyDown', code, key); await press('keyUp', code, key) }
  const hold = async (code, key, ms) => { await press('keyDown', code, key); await sleep(ms); await press('keyUp', code, key) }
  const waitFor = async (expression) => { for (let i = 0; i < 240; i++) { if (await evaluate(expression)) return; await sleep(100) } throw Error('Condition timed out: ' + expression) }
  const prompt = () => evaluate("document.querySelector('.action-button')?.textContent??document.querySelector('.prompt-hint')?.textContent??''")
  // Downward viewing angle from the camera to the follow target, 0.8 m above the feet.
  const camera = async () => { const q = await qa(), [cx, cy, cz] = q.cameraPosition, [px, py, pz] = q.position; return { camera: q.cameraPosition, player: q.position, downDeg: +(Math.atan2(cy - py - .8, Math.hypot(cx - px, cz - pz)) * 180 / Math.PI).toFixed(1) } }
  const record = async (name, extra = {}) => { await shot(name); report.checks.push({ name, ...extra, camera: await camera(), prompt: await prompt(), mode: (await qa()).mode }) }
  const reset = async (state, view = '') => {
    await evaluate(`history.replaceState(null,'','/?qa${view ? '&view=' + view : ''}');forestStore.setState(${JSON.stringify({ mode: 'walking', sitting: null, homeTransfer: null, workshopTransfer: null, craft: null, fishing: null, aquariumOpen: false, ...state })})`)
    await sleep(900)
  }
  // W walks along the camera forward (-sin yaw, -cos yaw); Q/E turn the orbit.
  const face = async (yaw) => {
    for (let i = 0; i < 30; i++) {
      const y = (await qa()).orbit.yaw, d = Math.atan2(Math.sin(yaw - y), Math.cos(yaw - y))
      if (Math.abs(d) < .05) return
      await hold(d > 0 ? 'KeyQ' : 'KeyE', d > 0 ? 'q' : 'e', Math.max(40, Math.min(500, Math.abs(d) / 1.8 * 1000)))
    }
  }
  const walk = async (points) => {
    const reached = []
    for (const p of points) {
      const q = await qa(), dx = p.x - q.position[0], dz = p.z - q.position[2]
      await face(Math.atan2(-dx, -dz)); await hold('KeyW', 'w', Math.hypot(dx, dz) / 1.1 * 1000)
      const r = (await qa()).position
      reached.push({ target: p, at: [+r[0].toFixed(2), +r[2].toFixed(2)], miss: +Math.hypot(r[0] - p.x, r[2] - p.z).toFixed(2) })
    }
    return reached
  }
  const results = {}

  // Workshop: entering, walking to the bench, shaping, then sitting on the finished stool.
  await reset({ location: 'island', position: await evaluate('workshop.workshopDoor'), nearby: 'workshop', workshopBook: { version: 1, phase: 'carrying' } })
  await key('KeyF', 'f'); await waitFor("forestStore.getState().location==='workshop'&&!forestStore.getState().workshopTransfer"); await sleep(1500)
  await record('workshop-enter'); results.enterDown = (await camera()).downDeg
  await hold('KeyW', 'w', 3200); await sleep(600); await record('workshop-bench'); results.benchPrompt = await prompt()
  await key('KeyF', 'f'); await sleep(900); results.craftMode = (await qa()).mode; await record('workshop-crafting'); await key('Escape', 'Escape'); await sleep(400)
  const seat = await evaluate('workshop.stoolSeat??{x:-.0073,z:-1.6}')
  await reset({ location: 'workshop', position: { x: seat.x + .55, z: -1 }, nearby: 'workshop', workshopBook: { version: 1, phase: 'finished' } })
  results.stoolPrompt = await prompt(); await key('KeyF', 'f'); await sleep(2800); await record('stool-sit')
  await evaluate("history.replaceState(null,'','/?qa&view=craftContact')"); await sleep(500); await record('stool-sit-close')
  await evaluate("history.replaceState(null,'','/?qa&view=craft')"); await sleep(500); await record('stool-sit-wide')
  await key('Escape', 'Escape'); await sleep(2600)
  // Walk to the door as a player would, so the raccoon faces the doorway when it steps out.
  await reset({ location: 'workshop', position: { x: 0, z: .9 }, nearby: 'workshop' }); await walk([await evaluate('workshop.indoorExit')])
  await key('KeyF', 'f'); await waitFor("forestStore.getState().location==='island'&&!forestStore.getState().workshopTransfer"); await sleep(1500)
  await record('workshop-exit'); results.exitDown = (await camera()).downDeg

  // The bedroom shares the interior camera.
  await reset({ location: 'island', position: { x: -15, z: -24.5 }, nearby: 'bedroom' })
  await key('KeyF', 'f'); await waitFor("forestStore.getState().location==='bedroom'&&!forestStore.getState().homeTransfer"); await sleep(1500)
  await record('bedroom-enter'); results.bedroomDown = (await camera()).downDeg
  await reset({ location: 'bedroom', position: { x: 0, z: 1.1 }, nearby: 'bedroom' }); await walk([{ x: 0, z: 2.45 }])
  await key('KeyF', 'f'); await waitFor("forestStore.getState().location==='island'&&!forestStore.getState().homeTransfer"); await sleep(1500)
  await record('bedroom-exit'); results.bedroomExitDown = (await camera()).downDeg

  // Trails over the terrace road: the main trail north and the loop past the bridge approach.
  const mainX = (z) => -1.7 + Math.sin(z * .23) * 1.15, loop = (a) => { const r = 19.5 + .65 * Math.sin(a * 3 + .3); return { x: Math.cos(a) * r, z: Math.sin(a) * r } }
  await reset({ location: 'island', position: { x: mainX(-9), z: -9 }, nearby: null })
  await face(0); await sleep(400); await record('main-trail-start')
  results.mainTrail = await walk([-11, -13, -15, -17, -19, -21].map((z) => ({ x: mainX(z), z })))
  await face(Math.PI); await sleep(500); await record('main-trail-top')
  await reset({ location: 'island', position: loop(-100 * Math.PI / 180), nearby: null })
  results.loopTrail = await walk([-108, -116, -124, -132, -140, -148, -156, -164].map((d) => loop(d * Math.PI / 180)))
  await sleep(400); await record('loop-trail-end')

  // Fishing: cast flight, touch-down, waiting, bite, reeling and landing.
  await reset({ location: 'island', position: await evaluate('fishing.fishingSpot'), nearby: 'pond' })
  await key('KeyF', 'f'); await sleep(2600); await record('fish-cast-flight')
  await waitFor("forestStore.getState().fishing?.phase==='waiting'"); await sleep(150); await record('fish-touchdown')
  await sleep(1800); await record('fish-waiting')
  await evaluate("forestStore.setState({fishing:{...forestStore.getState().fishing,phase:'bite',elapsed:0}})"); await sleep(300); await record('fish-bite')
  await sleep(450); await record('fish-bite-2')
  // Two captures can use up most of the 2.4 s bite window; restart it so F lands inside it.
  await evaluate("forestStore.setState({fishing:{...forestStore.getState().fishing,elapsed:0}})"); await key('KeyF', 'f'); await waitFor("forestStore.getState().fishing?.phase==='reeling'")
  await press('keyDown', 'Space', ' '); await sleep(1500); await record('fish-reeling'); await press('keyUp', 'Space', ' ')
  await evaluate("forestStore.setState({fishing:{...forestStore.getState().fishing,phase:'landing',elapsed:0}})"); await sleep(250); await record('fish-landing')
  if (!before) {
    // The catch card offers the tank or the pond right away; each choice is made once.
    const click = (label) => evaluate(`var b=[...document.querySelectorAll('.fishing-hud button')].find(b=>b.textContent==='${label}');b?b.click():0;b?'clicked':'missing'`)
    const tank = () => evaluate('forestStore.getState().homeBook.fish.length')
    await waitFor("forestStore.getState().fishing?.phase==='caught'"); await sleep(300); await record('fish-caught-choice')
    const before = await tank(); results.keepClick = await click('放入鱼缸'); await sleep(400); await record('fish-kept')
    results.keptInTank = (await tank()) - before
    await key('KeyF', 'f'); await sleep(400)
    await evaluate("forestStore.setState({fishing:{...forestStore.getState().fishing,phase:'landing',elapsed:0,sizeCm:22}})")
    await waitFor("forestStore.getState().fishing?.phase==='caught'"); await sleep(300)
    results.releaseClick = await click('放回池塘'); await sleep(180); await record('fish-released')
    results.afterRelease = { tank: await tank(), status: await evaluate("document.querySelector('.fishing-hud small')?.textContent") }
  }
  await key('Escape', 'Escape'); await sleep(300)

  report.results = results
  if (!before) {
    assert.ok(results.enterDown < 40, `entering the workshop looks down ${results.enterDown}°`)
    for (const k of ['exitDown', 'bedroomDown', 'bedroomExitDown']) assert.ok(results[k] < 40, `${k} looks down ${results[k]}°`)
    assert.match(results.benchPrompt, /开始修整|Start shaping/)
    assert.equal(results.craftMode, 'crafting')
    assert.match(results.stoolPrompt, /坐上木墩凳|Sit on the stool/)
    assert.equal(results.keepClick, 'clicked'); assert.equal(results.releaseClick, 'clicked'); assert.equal(results.keptInTank, 1); assert.equal(results.afterRelease.tank, 1); assert.equal(results.afterRelease.status, '已放回池塘')
    for (const r of [...results.mainTrail, ...results.loopTrail]) assert.ok(r.miss < .8, `trail walk stopped at ${r.at} short of ${JSON.stringify(r.target)}`)
  }
  assert.equal(report.errors.length, 0, report.errors.join('\n'))
  report.status = 'PASS'
} finally { try { await writeFile(`${out}/headless-validation.json`, JSON.stringify(report, null, 2)) } finally { socket?.close(); await cleanup() } }
