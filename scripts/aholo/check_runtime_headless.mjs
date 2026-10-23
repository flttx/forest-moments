// Isolated headless Edge only. CDP pattern reused from my-blog/scripts/t10-gait-check.mjs.
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { tmpdir } from 'node:os'

const out = resolve(process.env.FOREST_QA_OUT ?? 'docs/evidence/assets/2026-10-23-rowing-gameplay/regression')
await mkdir(out, { recursive: true })
const profile = await mkdtemp(resolve(tmpdir(), 'forest-moments-headless-'))
const edge = spawn(process.env.EDGE_PATH ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', [
  '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`,
  '--no-first-run', '--no-default-browser-check', 'about:blank',
], { windowsHide: true, stdio: 'ignore' })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const report = { date: new Date().toISOString(), mode: 'isolated headless Edge', viewport: [1440, 900], checks: [], errors: [], screenshots: [], status: 'RUNNING' }
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
const snapshot = () => evaluate("JSON.parse(document.querySelector('canvas')?.dataset.forestQa || 'null')")
async function waitFor(predicate, label, limit = 45000) {
  const start = Date.now()
  while (Date.now() - start < limit) { const value = await snapshot(); if (predicate(value)) return value; await sleep(100) }
  throw Error(`Timeout: ${label}`)
}
const keys = { w: ['KeyW', 87], s: ['KeyS', 83], a: ['KeyA', 65], d: ['KeyD', 68], Shift: ['ShiftLeft', 16], f: ['KeyF', 70] }
const key = (name, down) => cmd('Input.dispatchKeyEvent', { type: down ? 'keyDown' : 'keyUp', key: name, code: keys[name][0], windowsVirtualKeyCode: keys[name][1] })
async function shot(name) {
  const result = await cmd('Page.captureScreenshot', { format: 'png' })
  await writeFile(`${out}/${name}.png`, Buffer.from(result.data, 'base64'))
  report.screenshots.push(`${name}.png`)
}
function check(name, data) { report.checks.push({ name, data }); console.log(`PASS ${name}`) }
async function travel(name, predicate, label) {
  await key(name, true)
  try { return await waitFor(predicate, label) } finally { await key(name, false) }
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
  await cmd('Page.enable'); await cmd('Runtime.enable')
  await cmd('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })
  await cmd('Page.navigate', { url: 'http://127.0.0.1:5176/?qa' })
  const ready = await waitFor((s) => s?.ready && s.models.length === 4 && s.animation?.clip === 'idle', 'four models and idle', 90000)
  assert(ready.triangles > 1000000)
  check('four assets and real idle clip loaded', ready)
  await sleep(500); await shot('headless-spawn')
  report.webgl = await evaluate(`(() => { const g=document.querySelector('canvas').getContext('webgl2'); const e=g.getExtension('WEBGL_debug_renderer_info'); return {renderer:e?g.getParameter(e.UNMASKED_RENDERER_WEBGL):g.getParameter(g.RENDERER),version:g.getParameter(g.VERSION),drawingBuffer:[g.drawingBufferWidth,g.drawingBufferHeight]}; })()`)
  await key('s', true)
  const walk = await waitFor((s) => s?.position[2] > .8 && s.animation?.clip === 'walk', 'walk')
  await shot('headless-walk'); await key('s', false)
  await waitFor((s) => s?.animation?.clip === 'idle', 'stop idle')
  check('walk then idle transition', walk)
  await key('Shift', true); await key('s', true)
  const run = await waitFor((s) => s?.position[2] > walk.position[2] + 1.2 && s.animation?.clip === 'run', 'run')
  await shot('headless-run'); await key('s', false); await key('Shift', false)
  await waitFor((s) => s?.animation?.clip === 'idle', 'run stop idle')
  check('run then idle transition', run)
  // Focus exclusion and blur release prevent stuck movement while using controls.
  await key('s', true)
  await waitFor((s) => s?.animation?.clip === 'walk', 'walk before blur')
  await evaluate("window.dispatchEvent(new Event('blur'))")
  await waitFor((s) => s?.animation?.clip === 'idle', 'idle after blur')
  const before = await snapshot(); await sleep(250); const after = await snapshot()
  assert(Math.hypot(before.position[0]-after.position[0],before.position[2]-after.position[2]) < .01)
  await key('s', false)
  check('blur clears movement', after)
  await evaluate("const field=document.createElement('input');field.id='qa-focus';document.body.append(field);field.focus()")
  await key('w', true); await sleep(250); await key('w', false)
  const focused = await snapshot()
  assert(Math.hypot(after.position[0]-focused.position[0],after.position[2]-focused.position[2]) < .01)
  await evaluate("document.querySelector('#qa-focus').remove()")
  check('focused input blocks game movement', focused)
  await key('Shift', true)
  await travel('s', (s) => s?.position[2] > 6.5, 'approach south of workshop')
  await travel('a', (s) => s?.position[0] < -7.8, 'approach workshop front')
  await key('w', true); await sleep(1500)
  const wall = await waitFor((s) => s?.position[2] < 5.5 && s.motion === 'idle', 'workshop collision')
  await shot('headless-workshop-collision'); await key('w', false); await key('Shift', false)
  assert(wall.position[2] > 5.4)
  check('workshop blocks movement and returns idle', wall)
  await key('Shift', true)
  await travel('d', (s) => s?.position[0] > 0, 'return to path')
  await travel('w', (s) => s?.position[2] < -5, 'pond approach')
  await key('d', true); await sleep(1500)
  const shore = await waitFor((s) => s?.position[0] > 1.5 && s.motion === 'idle', 'water collision')
  await shot('headless-pond-collision'); await key('d', false); await key('Shift', false)
  assert(Math.hypot(shore.position[0]-6,shore.position[2]+5) >= 4.329)
  check('pond blocks entry', shore)
  // Fixed camera after warm-up; RAF cadence is not GPU render time or a cross-device guarantee.
  await sleep(2000)
  report.cadence = await evaluate(`new Promise(resolve => {
    const samples=[]; let first, previous;
    function tick(t) {
      if(first===undefined) first=t;
      if(previous!==undefined) samples.push(t-previous);
      previous=t;
      if(t-first<30000) requestAnimationFrame(tick);
      else { samples.sort((a,b)=>a-b); const mean=samples.reduce((a,b)=>a+b,0)/samples.length;
        resolve({durationMs:t-first,frames:samples.length,meanFrameMs:mean,meanFps:1000/mean,p95FrameMs:samples[Math.floor(samples.length*.95)],maxFrameMs:samples.at(-1),visibility:document.visibilityState}); }
    } requestAnimationFrame(tick);
  })`)
  await key('Shift', true)
  await travel('w', (s) => s?.position[2] < -9.8, 'north shore')
  await travel('d', (s) => s?.position[0] > 10.1, 'dock approach')
  await travel('s', (s) => s?.position[2] > -8.2, 'step onto dock')
  await key('Shift', false)
  const deck = await snapshot()
  assert.equal(deck.position[1], .12)
  await sleep(400); await shot('headless-dock')
  check('dock deck supports feet', deck)
  await key('Shift', true)
  await travel('w', (s) => s?.position[2] < -9.8, 'leave dock')
  await travel('a', (s) => s?.position[0] < .1, 'planting path')
  await travel('s', (s) => s?.position[2] > 7.9, 'planting point')
  await key('Shift', false)
  await key('f', true); await key('f', false); await sleep(150)
  assert.equal(await evaluate("localStorage.getItem('forest-moments:seedling:v1')"), 'true')
  await shot('headless-seedling')
  await cmd('Page.reload')
  await waitFor((s) => s?.ready && s.models.length === 4, 'reload')
  assert(await evaluate("document.querySelector('.landmarks').textContent.includes('已种植')"))
  check('seedling interaction persists after reload', { saved: true })
  assert.equal(report.errors.length, 0, report.errors.join('\n'))
  report.status = 'PASS: scoped runtime smoke checks; not complete visual or gameplay acceptance'
} catch (error) {
  report.status = 'FAIL'; report.failure = String(error); process.exitCode = 1
  if (socket?.readyState === 1) { try { await shot('headless-failure') } catch { /* Original error stays in report. */ } }
} finally {
  await writeFile(`${out}/headless-validation.json`, JSON.stringify(report, null, 2) + '\n')
  if (socket?.readyState === 1) { try { await cmd('Browser.close') } catch { /* Closing the socket can precede the response. */ } socket.close() }
  edge.kill()
  console.log(report.status)
}
