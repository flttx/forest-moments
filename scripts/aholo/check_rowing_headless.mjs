// Isolated headless Edge only. CDP pattern reused from my-blog/scripts/t10-gait-check.mjs.
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { tmpdir } from 'node:os'

const out = resolve(process.env.FOREST_QA_OUT ?? 'docs/evidence/assets/2026-10-23-rowing-gameplay')
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

  const ready = await waitFor(s => s?.ready && s.boatReady && s.models.length === 4, 'all models ready', 90000)
  check('models loaded', ready)
  await shot('01-spawn')
  await key('Shift', true)
  await travel('d', s => s?.position[0] > 11.2, 'east path')
  await travel('w', s => s?.position[2] < -8.1, 'dock access')
  await key('Shift', false)
  await travel('a', s => s?.position[0] < 9.45, 'dock edge')
  const dock = await snapshot()
  assert(dock.canBoard && dock.position[1] === .12)
  await sleep(700); await shot('02-dock-before-boarding')
  await key('f', true); await key('f', false)
  await waitFor(s => s?.mode === 'rowing', 'board')
  await evaluate("document.querySelector('.notice button')?.click()")
  await sleep(1000); await shot('03-central-seat')
  const start = await snapshot()
  const atMooring = s => s && Math.hypot(s.boat.x-start.boat.x,s.boat.z-start.boat.z) < .5
  await key('a', true)
  report.cycles = await evaluate(`new Promise(resolve => {
    const samples=[]; const start=performance.now();
    function tick(){const s=JSON.parse(document.querySelector('canvas').dataset.forestQa);
      samples.push({phase:s.boat.phase,clipTime:s.boatAnimation.time});
      if(performance.now()-start<23500)requestAnimationFrame(tick);else resolve(samples)
    } requestAnimationFrame(tick)
  })`)
  await key('a', false)
  const wraps=report.cycles.filter((v,i,a)=>i&&v.phase<a[i-1].phase).length
  const maxClockError=Math.max(...report.cycles.map(s=>Math.abs(s.phase-s.clipTime)))
  assert(wraps>=2 && maxClockError<.000001)
  check('two original playback loops with synchronized prop clock', {wraps,maxClockError})
  await shot('03b-full-loop')
  await travel('d', s => s?.boat.heading <= start.boat.heading, 'heading after cycles')
  await travel('w', s => s?.boat.z > -4.8, 'forward stroke')
  await sleep(900)
  const away = await snapshot()
  assert(away.boat.phase > start.boat.phase && away.boatAnimation.clip === 'paddle')
  check('forward original animation', away)
  await shot('04-rowing-away')
  await key('f', true); await key('f', false)
  assert.equal((await snapshot()).mode, 'rowing')
  await evaluate("document.querySelector('.notice button')?.click()")
  check('cannot disembark in water', await snapshot())
  await key('a', true); await sleep(600); await key('a', false)
  const left = await snapshot()
  assert(left.boat.heading > away.boat.heading + .15)
  await shot('05-turn-left')
  await travel('d', s => s?.boat.heading <= start.boat.heading, 'turn back')
  const right = await snapshot()
  assert(right.boat.heading < left.boat.heading - .15)
  check('both steering directions', {left:left.boat,right:right.boat})
  // Reach a bank under held input and show that position stops changing.
  await key('w', true); await sleep(5500)
  const bank1 = await snapshot(); await sleep(1000); const bank2 = await snapshot()
  assert(Math.hypot(bank2.boat.x-bank1.boat.x,bank2.boat.z-bank1.boat.z) < .025)
  await key('w', false)
  await shot('06-shore-limit')
  check('boat cannot sail onto land', bank2)
  // The held source pose and prop remain synchronized on reverse playback.
  await travel('s', atMooring, 'reverse to dock')
  await sleep(1300)
  const returned = await snapshot()
  assert(returned.canLand)
  await shot('07-returned-to-dock')
  check('reverse and stop at dock', returned)
  // Native button focus must not swallow the next movement keys.
  await evaluate("document.querySelector('.interaction button').click()")
  await waitFor(s => s?.mode === 'walking', 'button disembark')
  const landed = await snapshot()
  assert.equal(landed.position[1], .12)
  await evaluate("document.querySelector('.notice button')?.click()")
  await sleep(700); await shot('08-back-on-dock')
  await key('f', true); await key('f', false)
  await waitFor(s => s?.mode === 'rowing', 'repeat boarding')
  await key('w', true); await sleep(500)
  await evaluate("window.dispatchEvent(new Event('blur'))")
  await key('w', false); await sleep(1500)
  const blurred = await snapshot(); await sleep(300); const stopped = await snapshot()
  assert(Math.abs(stopped.boat.speed) < .01)
  assert(Math.hypot(stopped.boat.x-blurred.boat.x, stopped.boat.z-blurred.boat.z) < .01)
  check('blur clears rowing and brakes', stopped)
  // Return the short second trip, then exit via F and prove walking resumes.
  if(!stopped.canLand) {
    await travel('s', atMooring, 'second return'); await sleep(1200)
  }
  await key('f', true); await key('f', false)
  await waitFor(s => s?.mode === 'walking', 'keyboard disembark')
  await travel('d', s => s?.position[0] > 10.4 && s.animation?.clip === 'walk', 'walk after disembark')
  await shot('09-walking-again')
  check('repeatable round trip and walking restored', await snapshot())
  assert.equal(report.errors.length, 0, report.errors.join('\n'))
  report.status='PASS: keyboard/button boarding, forward/reverse, steering, bank boundary, safe repeat landing, blur and walking'
} catch (error) {
  report.status = 'FAIL'; report.failure = String(error); process.exitCode = 1
  if (socket?.readyState === 1) { try { await shot('headless-failure') } catch { /* Original error stays in report. */ } }
} finally {
  await writeFile(`${out}/headless-validation.json`, JSON.stringify(report, null, 2) + '\n')
  if (socket?.readyState === 1) { try { await cmd('Browser.close') } catch { /* Closing the socket can precede the response. */ } socket.close() }
  edge.kill()
  console.log(report.status)
}
