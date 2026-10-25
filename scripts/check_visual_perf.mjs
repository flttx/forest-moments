// Frame cadence for visual upgrade stages. Uncapped RAF in headless Edge: compare runs on the same machine only.
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { createHeadlessBrowser } from './browser-session.mjs'

const out = resolve(process.argv[2] ?? 'docs/evidence/2026-10-25-visual-review/perf-latest.json')
const [W, H] = (process.argv[3] ?? '1440x900').split('x').map(Number)
await mkdir(dirname(out), { recursive: true })
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
const cadence = (ms) => evaluate(`new Promise(resolve=>{const s=[];let first,prev;function tick(t){if(first===undefined)first=t;if(prev!==undefined)s.push(t-prev);prev=t;if(t-first<${ms})requestAnimationFrame(tick);else{s.sort((a,b)=>a-b);const mean=s.reduce((a,b)=>a+b,0)/s.length;resolve({frames:s.length,meanMs:+mean.toFixed(2),p95Ms:+s[Math.floor(s.length*.95)].toFixed(2),maxMs:+s[s.length-1].toFixed(2),over33:s.filter(x=>x>33).length})}}requestAnimationFrame(tick)})`)
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
  await cmd('Page.navigate', { url: `${process.env.FOREST_URL ?? 'http://127.0.0.1:5176/'}?qa${process.env.FOREST_QUERY ?? ''}` })
  for (let i = 0; i < 400; i++) { if ((await evaluate(ready)) && i > 10) break; await sleep(200) }
  await sleep(4000)
  const webgl = await evaluate(`(()=>{const g=document.createElement('canvas').getContext('webgl2');const e=g.getExtension('WEBGL_debug_renderer_info');return e?g.getParameter(e.UNMASKED_RENDERER_WEBGL):g.getParameter(g.RENDERER)})()`)
  const result = { date: new Date().toISOString(), browser: version.product, viewport: [W, H], webgl, runs: {} }
  for (const light of ['day', 'night']) {
    if (light === 'night') { await cmd('Page.reload'); await sleep(1000) }
    for (let i = 0; i < 400; i++) { if ((await evaluate(ready)) && i > 10) break; await sleep(200) }
    await evaluate(`(async()=>{window.forestStore=(await import(performance.getEntriesByType('resource').find(e=>new URL(e.name).pathname==='/src/game/store.ts').name)).useForestStore;forestStore.setState({timeOfDay:'${light}'})})()`).catch(() => {})
    await sleep(2500)
    result.runs[`${light}-idle`] = await cadence(10000)
    await cmd('Input.dispatchKeyEvent', { type: 'keyDown', code: 'KeyW', key: 'w' })
    try { result.runs[`${light}-walk`] = await cadence(10000) } finally { await cmd('Input.dispatchKeyEvent', { type: 'keyUp', code: 'KeyW', key: 'w' }) }
    for (let i = 0; i < 24; i++) await cmd('Input.dispatchMouseEvent', { type: 'mouseWheel', x: W / 2, y: H / 2, deltaX: 0, deltaY: 300 })
    await sleep(2000)
    result.runs[`${light}-wide`] = await cadence(10000)
  }
  result.errors = errors
  await writeFile(out, JSON.stringify(result, null, 2))
  console.log(JSON.stringify(result.runs))
} catch (e) { console.error(e); process.exitCode = 1 } finally { socket?.close(); await cleanup() }
