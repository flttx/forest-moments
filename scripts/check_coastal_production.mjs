// Isolated headless Edge only. CDP pattern reused from my-blog/scripts/t10-gait-check.mjs.
import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createHeadlessBrowser } from './browser-session.mjs'

const out = resolve(process.env.FOREST_QA_OUT ?? 'docs/evidence/vegetation-expansion/2026-10-24/coastal-production')
await mkdir(out, { recursive: true })
const { profile, cleanup } = await createHeadlessBrowser([
  '--headless=new', '--disable-features=CalculateNativeWinOcclusion', '--disable-frame-rate-limit', '--disable-gpu-vsync', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--remote-debugging-port=0', '--no-first-run', '--no-default-browser-check', 'about:blank',
])
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
const keys = { w: ['KeyW', 87], s: ['KeyS', 83], a: ['KeyA', 65], d: ['KeyD', 68], Shift: ['ShiftLeft', 16], f: ['KeyF', 70] }
const key = (name, down) => cmd('Input.dispatchKeyEvent', { type: down ? 'keyDown' : 'keyUp', key: name, code: keys[name][0], windowsVirtualKeyCode: keys[name][1] })
async function shot(name) {
  const result = await cmd('Page.captureScreenshot', { format: 'png' })
  await writeFile(`${out}/${name}.png`, Buffer.from(result.data, 'base64'))
  report.screenshots.push(`${name}.png`)
}
function check(name, data) { report.checks.push({ name, data }); console.log(`PASS ${name}`) }
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
  await cmd('Page.enable'); await cmd('Runtime.enable'); await cmd('Page.bringToFront'); await cmd('Emulation.setFocusEmulationEnabled',{enabled:true})
  await cmd('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })
  await cmd('Page.navigate', { url: 'http://127.0.0.1:5178/?qa' })

  for(let i=0;i<400;i++) {
    const loaded=await evaluate("!!document.querySelector('canvas')&&!document.querySelector('.asset-loading')&&!document.querySelector('.world-error')")
    if(loaded && i>10)break
    if(i===399)throw Error('Production assets failed to load')
    await sleep(200)
  }
  assert.equal(await snapshot(),null,'Development telemetry must not ship')
  await sleep(1000); await shot('01-built-spawn')
  async function hold(name, ms) { await key(name,true); await evaluate(`new Promise(resolve=>{let last=performance.now(),elapsed=0;function frame(t){elapsed+=Math.min(t-last,50);last=t;if(elapsed>=${ms})resolve();else requestAnimationFrame(frame)}requestAnimationFrame(frame)})`); await key(name,false) }
  await key('Shift',true)
  await hold('s',450);await hold('d',6500);await hold('w',450);await hold('d',3400)
  await key('Shift',false)
  await hold('s',500)
  // Timed travel can stop short under load. Continue real keys until the visible control changes.
  report.boardingApproachSteps=0
  for(let i=0;i<12;i++){
    if(await evaluate("document.querySelector('.interaction button')?.textContent.startsWith('上船')"))break
    await hold('d',200);await sleep(50);report.boardingApproachSteps++
  }
  assert(await evaluate("document.querySelector('.interaction button')?.textContent.startsWith('上船')"),'Built dock boarding control inaccessible')
  await key('f',true); await key('f',false)
  for(let i=0;i<100;i++){await sleep(50);if(await evaluate("!document.querySelector('[data-boat-transfer]')&&document.querySelector('.controls')?.textContent.includes('沿岛泛舟')"))break}
  assert(await evaluate("document.querySelector('.controls')?.textContent.includes('沿岛泛舟')"))
  await evaluate("document.querySelector('.notice button')?.click()")
  await hold('w',1400);await shot('02-built-rowing-water')
  // Use the player's visible landing control instead of assuming a screenshot takes zero time.
  for(let i=0;i<30;i++){
    await sleep(650)
    if(await evaluate("document.querySelector('.interaction button')?.disabled===false"))break
    await hold('s',250)
  }
  assert(await evaluate("document.querySelector('.interaction button')?.disabled===false"),'Production return did not reach the visible landing control')
  await key('f',true);await key('f',false)
  for(let i=0;i<100;i++){await sleep(50);if(await evaluate("!document.querySelector('[data-boat-transfer]')&&document.querySelector('.controls')?.textContent.includes('漫步森林')"))break}
  assert(await evaluate("document.querySelector('.controls')?.textContent.includes('漫步森林')"),'Production landing failed')
  await shot('03-built-landed')
  check('built scene loads and keyboard boarding/rowing works', {qaTelemetryRemoved:true})
  report.assets=await evaluate("performance.getEntriesByType('resource').filter(e=>/assets\\/models/.test(e.name)).map(e=>({url:new URL(e.name).pathname,bytes:e.decodedBodySize}))")
  assert.equal(report.assets.length,16)
  assert(report.assets.some(a=>a.url==='/assets/models/paddle.glb'&&a.bytes<16384),'Production must load the standalone original paddle')
  assert(!report.assets.some(a=>a.url==='/assets/models/canoe.glb'),'Do not download a second full canoe just for its paddle')
  report.modelTrackBytes=report.assets.reduce((sum,a)=>sum+a.bytes,0)
  assert.equal(report.errors.length,0,report.errors.join('\n'))
  report.status='PASS: static build load, sixteen model/track resources, boarding/rowing HUD, development telemetry absent'
} catch (error) {
  report.status = 'FAIL'; report.failure = String(error); process.exitCode = 1
  if (socket?.readyState === 1) { try { await shot('headless-failure') } catch { /* Original error stays in report. */ } }
} finally {
  try {
    await writeFile(`${out}/headless-validation.json`, JSON.stringify(report, null, 2) + '\n')
    if (socket?.readyState === 1) { try { await cmd('Browser.close') } catch { /* Closing the socket can precede the response. */ } socket.close() }
    console.log(report.status)
  } finally {
    await cleanup()
  }
}
