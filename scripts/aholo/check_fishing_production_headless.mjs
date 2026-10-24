// Isolated headless Edge only. CDP pattern reused from my-blog/scripts/t10-gait-check.mjs.
import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createHeadlessBrowser } from '../browser-session.mjs'

const out = resolve(process.env.FOREST_QA_OUT ?? 'docs/evidence/assets/2026-10-23-fishing-gameplay/production')
await mkdir(out, { recursive: true })
const { profile, cleanup } = await createHeadlessBrowser([
  '--headless=new', '--remote-debugging-port=0', '--no-first-run', '--no-default-browser-check', 'about:blank',
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
const keys = { w: ['KeyW', 87], s: ['KeyS', 83], a: ['KeyA', 65], d: ['KeyD', 68], Shift: ['ShiftLeft', 16], f: ['KeyF', 70], Space: ['Space', 32], Escape: ['Escape', 27] }
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
  await cmd('Page.enable'); await cmd('Runtime.enable')
  await cmd('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })
  await cmd('Page.navigate', { url: 'http://127.0.0.1:5178/?qa' })



  async function waitText(text, limit=20000) {
    const start=Date.now()
    while(Date.now()-start<limit){if(await evaluate(`document.querySelector('.fishing-hud strong')?.textContent.includes(${JSON.stringify(text)})`))return;await sleep(80)}
    throw Error(`Missing fishing phase: ${text}`)
  }
  for(let i=0;i<400;i++) {
    if(i>10 && await evaluate("!!document.querySelector('canvas')&&!document.querySelector('.asset-loading')&&!document.querySelector('.world-error')")) break
    if(i===399)throw Error('Build load timeout')
    await sleep(200)
  }
  assert.equal(await snapshot(),null)
  async function press(name) {await key(name,true);await key(name,false)}
  async function hold(name,ms) {await key(name,true);await sleep(ms);await key(name,false)}
  await key('Shift',true);await hold('w',1640);await key('Shift',false);await hold('d',1280)
  await press('f');await waitText('正在抛竿');await sleep(1900);await shot('01-cast')
  await waitText('静候');await shot('02-waiting');await waitText('咬钩');await shot('03-bite');await press('f')
  await waitText('慢慢收线')
  let held=false, shotTaken=false;const start=Date.now()
  while(Date.now()-start<20000){
    const state=await evaluate("({title:document.querySelector('.fishing-hud strong')?.textContent,tension:document.querySelector('.fishing-hud meter')?.value})")
    if(!state.title?.includes('慢慢收线'))break
    const next=held?state.tension<.72:state.tension<.3
    if(next!==held){held=next;await key('Space',held)}
    if(!shotTaken && state.tension>.7){await shot('04-tension-panel');shotTaken=true}
    await sleep(50)
  }
  await key('Space',false);await waitText('cm 锦鲤');await sleep(450);await shot('05-visible-catch')
  const saved=await evaluate("JSON.parse(localStorage.getItem('forest-moments:fish-book:v1'))")
  assert.equal(saved.count,1)
  check('built fishing with real keyboard and DOM meters',saved)
  await press('Escape');await cmd('Page.reload');await sleep(1800)
  await evaluate("document.querySelector('.fish-book').open=true")
  await shot('06-saved-book')
  assert(await evaluate("document.querySelector('.fish-book').textContent.includes('1 尾')"))
  assert.equal(await snapshot(),null)
  report.assets=await evaluate("performance.getEntriesByType('resource').filter(e=>/assets\\/models/.test(e.name)).map(e=>({url:new URL(e.name).pathname,bytes:e.decodedBodySize}))")
  assert(report.assets.some(a=>a.url.endsWith('fishing-rod.glb')) && report.assets.some(a=>a.url.endsWith('fish-koi.glb')))
  assert.equal(report.errors.length,0,report.errors.join('\n'))
  report.status='PASS: built casting, bite, DOM-meter tension control, visible catch, saved book, no development telemetry'
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
