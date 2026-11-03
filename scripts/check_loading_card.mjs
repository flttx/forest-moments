// Isolated headless Edge only (muted by browser-session). The loading card must stay until the world is really drawn:
// cold loads with the cache off, polling every 50 ms; the moment the card goes, the dev telemetry must already show the
// raccoon ready, and a screenshot is taken right then (no bare green canvas).
import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createHeadlessBrowser } from './browser-session.mjs'

const out = resolve(process.env.FOREST_QA_OUT ?? 'docs/evidence/2026-11-03-loading-card/after')
const base = process.env.FOREST_URL ?? 'http://127.0.0.1:5176/'
const runs = Number(process.env.RUNS ?? 3)
await mkdir(out, { recursive: true })
const { profile, cleanup } = await createHeadlessBrowser([
  '--headless=new', '--disable-features=CalculateNativeWinOcclusion', '--disable-frame-rate-limit', '--disable-gpu-vsync', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--remote-debugging-port=0', '--no-first-run', '--no-default-browser-check', 'about:blank',
])
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const report = { date: new Date().toISOString(), mode: 'isolated muted headless Edge, cache disabled', viewport: [1440, 900], runs: [], errors: [], status: 'RUNNING' }
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
const state = "(()=>{const c=document.querySelector('canvas'),q=JSON.parse(c?.dataset.forestQa||'null');return{card:!!document.querySelector('.asset-loading'),error:!!document.querySelector('.world-error'),ready:q?.ready??false}})()"

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
  await cmd('Page.enable'); await cmd('Runtime.enable'); await cmd('Network.enable'); await cmd('Network.setCacheDisabled', { cacheDisabled: true })
  await cmd('Page.bringToFront'); await cmd('Emulation.setFocusEmulationEnabled', { enabled: true })
  await cmd('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })
  for (let run = 0; run < runs; run++) {
    await cmd('Page.navigate', { url: 'about:blank' }); await sleep(300)
    const t0 = Date.now(); await cmd('Page.navigate', { url: `${base}?qa` })
    let sawCard = false, at = null
    for (let i = 0; i < 4000; i++) {
      const s = await evaluate(state).catch(() => null)
      if (s?.card) sawCard = true
      if (sawCard && s && !s.card) { at = { ...s, ms: Date.now() - t0 }; break }
      await sleep(50)
    }
    assert(sawCard && at, `run ${run}: the card never showed or never left`)
    const shot = await cmd('Page.captureScreenshot', { format: 'png' })
    await writeFile(`${out}/run-${run}-card-gone.png`, Buffer.from(shot.data, 'base64'))
    report.runs.push(at); console.log(`run ${run}`, JSON.stringify(at))
    // PROD=1: a production build has no dev telemetry, so the screenshot taken above is the evidence
    if (!process.env.PROD) assert(at.ready, `run ${run}: card left before the world was drawn ${JSON.stringify(at)}`)
  }
  assert.deepEqual(report.errors, []); report.status = 'PASS'
} catch (error) {
  report.status = 'FAIL'; report.failure = String(error); process.exitCode = 1
} finally {
  try {
    await writeFile(`${out}/report.json`, JSON.stringify(report, null, 2) + '\n')
    if (socket?.readyState === 1) { try { await cmd('Browser.close') } catch { /* Closing the socket can precede the response. */ } socket.close() }
    console.log(report.status, report.failure ?? '')
  } finally {
    await cleanup()
  }
}
