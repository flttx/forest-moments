// Isolated headless Edge only. CDP pattern reused from my-blog/scripts/t10-gait-check.mjs.
import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createHeadlessBrowser } from './browser-session.mjs'

const out = resolve(process.env.FOREST_QA_OUT ?? 'docs/evidence/2026-10-24-workshop/production-final')
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
const keys = { w: ['KeyW', 87], s: ['KeyS', 83], a: ['KeyA', 65], d: ['KeyD', 68], Shift: ['ShiftLeft', 16], f: ['KeyF', 70], Escape:['Escape',27] }
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
  assert.equal(await snapshot(),null,'No dev telemetry in production')
  async function hold(name, ms) { await key(name,true); await evaluate(`new Promise(resolve=>{let last=performance.now(),elapsed=0;function frame(t){elapsed+=Math.min(t-last,50);last=t;if(elapsed>=${ms})resolve();else requestAnimationFrame(frame)}requestAnimationFrame(frame)})`); await key(name,false) }
  const press=async k=>{await key(k,true);await key(k,false)}
  const route=JSON.parse(await readFile(resolve(process.env.FOREST_WORKSHOP_ROUTE??'docs/evidence/2026-10-24-workshop/keyboard-route.json'),'utf8'))
  async function waitUi(expression,label){for(let i=0;i<400;i++){if(await evaluate(expression))return;await sleep(50)}throw Error('Timeout '+label)}
  const phase=()=>evaluate("JSON.parse(localStorage.getItem('forest-moments:workshop:v1')||'null')?.phase")
  const inside="document.querySelector('.controls strong')?.textContent==='工坊室内'"
  async function walk(segments){for(const s of segments)await hold(s.key,s.distance/1.1*1000)}
  await shot('01-spawn');await walk(route.wood);await sleep(500)
  assert(await evaluate("document.querySelector('.interaction button')?.textContent.includes('收好旧木墩')"))
  await press('f');await waitUi("JSON.parse(localStorage.getItem('forest-moments:workshop:v1')||'null')?.phase==='carrying'",'collect');await shot('02-collected')
  await walk(route.door);await sleep(500);assert(await evaluate("document.querySelector('.interaction button')?.textContent.includes('进入工坊')"))
  await press('f');await waitUi(inside,'enter');await sleep(1200);await shot('03-indoor')
  await hold('a',.6/1.1*1000);await hold('w',2.25/1.1*1000);await press('f');await waitUi("!!document.querySelector('.craft-hud')",'craft')
  await press('Escape');assert.equal(await phase(),'carrying');await press('f');await waitUi("!!document.querySelector('.craft-hud')",'restart')
  for(let i=0;i<3;i++){
    await waitUi("(()=>{const m=document.querySelector('[role=meter]'),b=document.querySelector('.craft-hud button');const v=Number(m?.getAttribute('aria-valuenow'));return m&&!b.disabled&&v>.41&&v<.59})()",'green range')
    await press('f');if(i===0){await sleep(200);await shot('04-sanding')}await sleep(1400)
  }
  await waitUi("JSON.parse(localStorage.getItem('forest-moments:workshop:v1')||'null')?.phase==='finished'",'finished');await shot('05-finished')
  await hold('s',3.15/1.1*1000);await hold('d',.6/1.1*1000);await sleep(700)
  assert(await evaluate("document.querySelector('.interaction button')?.textContent.includes('回到小岛')"));await press('f');await waitUi("document.querySelector('.interaction button')?.textContent.includes('进入工坊')",'return');await sleep(1200);await shot('06-return')
  await press('f');await waitUi(inside,'reenter');await sleep(800);await cmd('Page.reload');await sleep(800)
  await waitUi("!!document.querySelector('canvas')&&!document.querySelector('.asset-loading')&&!document.querySelector('.world-error')",'reload');assert(!await evaluate(inside));assert.equal(await phase(),'finished');await shot('07-reload')
  check('production real-key route, indoor crafting, cancel, exit, reenter and persistent reload',{noDevTelemetry:await snapshot()===null})
  report.assets=await evaluate("performance.getEntriesByType('resource').filter(e=>/assets\\/interiors/.test(e.name)).map(e=>({url:new URL(e.name).pathname,bytes:e.decodedBodySize}))")
  assert.equal(report.assets.length,7);assert.equal(report.errors.length,0,report.errors.join('\n'));report.status='PASS'
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
