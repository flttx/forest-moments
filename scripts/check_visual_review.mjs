// Read-only visual review capture. Reuses project createHeadlessBrowser (temp under project .tmp/).
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createHeadlessBrowser } from './browser-session.mjs'

const out = resolve(process.argv[2] ?? 'docs/evidence/2026-10-25-visual-review/latest')
const [W, H] = (process.argv[3] ?? '1440x900').split('x').map(Number)
await mkdir(out, { recursive: true })
const { profile, cleanup } = await createHeadlessBrowser([
  '--headless=new', '--disable-features=CalculateNativeWinOcclusion', '--disable-frame-rate-limit', '--disable-gpu-vsync', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--remote-debugging-port=0', '--no-first-run', '--no-default-browser-check', 'about:blank',
])
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const errors = []
let socket, seq = 0
const pending = new Map()
const cmd = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++seq
  const t = setTimeout(() => { pending.delete(id); reject(Error('CDP timeout ' + method)) }, 45000)
  pending.set(id, (m) => { clearTimeout(t); if (m.error) reject(Error(JSON.stringify(m.error))); else resolve(m.result) })
  socket.send(JSON.stringify({ id, method, params }))
})
const evaluate = async (expression) => {
  const r = await cmd('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  if (r.exceptionDetails) throw Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text)
  return r.result?.value
}
const ready = "!!document.querySelector('canvas')&&!document.querySelector('.asset-loading')&&!document.querySelector('.world-error')"
const shot = async (name) => {
  let stable = 0
  for (let i = 0; i < 200 && stable < 10; i++) { stable = (await evaluate(ready)) ? stable + 1 : 0; await sleep(100) }
  // HIDE_HUD=1: scene-only images (the in-game photo view would still leave its restore button).
  if (process.env.HIDE_HUD) await evaluate("document.getElementById('qa-hide-hud')||document.head.append(Object.assign(document.createElement('style'),{id:'qa-hide-hud',textContent:'.hud{display:none!important}'}))")
  await cmd('Page.captureScreenshot', { format: 'png' }); await sleep(250)
  const r = await cmd('Page.captureScreenshot', { format: 'png' })
  await writeFile(`${out}/${name}.png`, Buffer.from(r.data, 'base64'))
}
try {
  let port
  for (let i = 0; i < 100 && !port; i++) { try { port = (await readFile(`${profile}/DevToolsActivePort`, 'utf8')).split('\n')[0] } catch { await sleep(200) } }
  const target = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json()
  socket = new WebSocket(target.webSocketDebuggerUrl)
  socket.onmessage = ({ data }) => {
    const m = JSON.parse(data)
    if (pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) }
    if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails?.exception?.description ?? m.params.exceptionDetails?.text)
  }
  await new Promise((r, j) => { socket.addEventListener('open', r, { once: true }); socket.addEventListener('error', j, { once: true }) })
  const version = await cmd('Browser.getVersion')
  await cmd('Page.enable'); await cmd('Runtime.enable'); await cmd('Page.bringToFront')
  await cmd('Emulation.setFocusEmulationEnabled', { enabled: true })
  await cmd('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false })
  await cmd('Page.navigate', { url: 'http://127.0.0.1:5176/?qa' })
  for (let i = 0; i < 400; i++) { if ((await evaluate(ready)) && i > 10) break; await sleep(200) }
  await sleep(2500)
  // Default gameplay camera with real HUD, as a player first sees it.
  await shot('00-default-hud')
  await evaluate(`(async()=>{window.forestStore=(await import(performance.getEntriesByType('resource').find(e=>new URL(e.name).pathname==='/src/game/store.ts').name)).useForestStore})()`)
  for (const light of ['dusk', 'night']) { await evaluate(`forestStore.setState({timeOfDay:'${light}'})`); await sleep(1500); await shot(`00-default-${light}`) }
  await evaluate(`forestStore.setState({timeOfDay:'day'})`)
  // Mid zoom-out with gameplay camera
  for (let i = 0; i < 6; i++) await cmd('Input.dispatchMouseEvent', { type: 'mouseWheel', x: W / 2, y: H / 2, deltaX: 0, deltaY: 300 })
  await sleep(1500); await shot('01-zoom-mid')
  for (let i = 0; i < 20; i++) await cmd('Input.dispatchMouseEvent', { type: 'mouseWheel', x: W / 2, y: H / 2, deltaX: 0, deltaY: 300 })
  await sleep(1800); await shot('02-zoom-wide')
  const views = (process.env.VIEWS ?? 'fullIsland,overview,coast,beach,dock,pond,workshop,tower,farm,player,grove,trail,flowers,camp,stream,cabin,seaCliff,creekMouth,reef,bedroom,interior').split(',')
  const lights = (process.env.LIGHTS ?? 'day').split(',')
  for (const light of lights) for (const view of views) {
    const loc = ['bedroom', 'tank'].includes(view) ? 'bedroom' : ['interior', 'craft'].includes(view) ? 'workshop' : 'island'
    await evaluate(`history.replaceState(null,'','/?qa&view=${view}');forestStore.setState(${JSON.stringify({ mode: 'walking', location: loc, position: { x: 0, z: 0 }, timeOfDay: light, nearby: null })})`)
    await sleep(1400); await shot(`${light}-${view}`)
  }
  await writeFile(`${out}/meta.json`, JSON.stringify({ version, viewport: [W, H], errors }, null, 2))
  console.log('DONE', errors.length)
} catch (e) { console.error(e); process.exitCode = 1 } finally { socket?.close(); await cleanup() }
