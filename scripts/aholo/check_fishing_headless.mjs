// Isolated headless Edge only. CDP pattern reused from my-blog/scripts/t10-gait-check.mjs.
import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createHeadlessBrowser } from '../browser-session.mjs'

const out = resolve('docs/evidence/assets/2026-10-23-fishing-gameplay')
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
async function waitFor(predicate, label, limit = 45000) {
  const start = Date.now()
  while (Date.now() - start < limit) { const value = await snapshot(); if (predicate(value)) return value; await sleep(100) }
  throw Error(`Timeout: ${label}`)
}
const keys = { w: ['KeyW', 87], s: ['KeyS', 83], a: ['KeyA', 65], d: ['KeyD', 68], Shift: ['ShiftLeft', 16], f: ['KeyF', 70], Space: ['Space', 32], Escape: ['Escape', 27] }
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


  await waitFor(s => s?.ready && s.fishingReady && s.boatReady, 'ready', 90000)
  await shot('01-before-fishing')
  await key('Shift',true); await travel('w',s => s?.position[2] < -5, 'pond west'); await key('Shift',false)
  await travel('d',s => s?.position[0] > 1.35, 'fishing spot')
  const press = async name => {await key(name,true); await key(name,false)}
  const phase = value => waitFor(s => s?.fishing?.phase === value, value, 20000)
  await press('f'); await phase('casting'); await sleep(400); await shot('02-casting-start')
  await sleep(1300); await shot('03-casting-release')
  await press('Escape'); await waitFor(s => s?.mode === 'walking', 'cancel cast')
  assert.equal((await snapshot()).fishBook.count,0)
  check('cancel casting returns to walking without catch',await snapshot())
  await press('f'); await phase('waiting'); await shot('04-waiting')
  await press('f'); await phase('escaped'); await shot('05-too-early')
  check('early strike fails',await snapshot())
  await press('f'); await phase('bite'); await shot('06-bite')
  await phase('escaped'); assert.equal((await snapshot()).fishBook.count,0)
  check('missed bite fails without reward',await snapshot())
  await press('f'); await phase('waiting')
  await evaluate("window.dispatchEvent(new Event('blur'))")
  const paused=await snapshot(); await sleep(700);const still=await snapshot()
  assert(still.fishing.paused && Math.abs(still.fishing.elapsed-paused.fishing.elapsed)<.001)
  await shot('07-paused'); await press('f'); await phase('bite'); await press('f'); await phase('reeling')
  check('blur freezes timers and F resumes',paused)
  await key('Space',true)
  await waitFor(s=>s?.fishing?.tension > .72,'high tension')
  await shot('08-high-tension');await key('Space',false)
  await waitFor(s=>s?.fishing?.tension < .3,'release tension')
  await shot('09-release-tension')
  const fightStart=Date.now();let held=false
  while(Date.now()-fightStart<20000){
    const s=await snapshot();if(s.fishing.phase!=='reeling')break
    const next=held?s.fishing.tension<.72:s.fishing.tension<.3
    if(next!==held){held=next;await key('Space',held)}
    await sleep(50)
  }
  await key('Space',false); await phase('landing');await shot('10-landing')
  await phase('caught');await sleep(500);await shot('11-caught')
  const caught=await snapshot();assert.equal(caught.fishBook.count,1);assert(caught.fishingVisual.fishVisible)
  assert.equal(caught.animation.clip,'fish_land')
  assert(Math.hypot(...caught.fishingVisual.grip.map((v,i)=>v-caught.fishingVisual.rod[i]))<.000001)
  check('catch with release cycles and fish model',caught)
  await sleep(800);assert.equal((await snapshot()).fishBook.count,1)
  await press('f');await phase('bite');await press('f');await phase('reeling');await key('Space',true)
  await phase('escaped');await key('Space',false);await shot('12-line-overload')
  assert.equal((await snapshot()).fishBook.count,1)
  check('overload fails without extra reward',await snapshot())
  await press('Escape');await waitFor(s=>s?.mode==='walking','stop fishing')
  await travel('a',s=>s?.position[0]<.8 && s.animation?.clip==='walk','walk restored')
  await cmd('Page.reload');await waitFor(s=>s?.ready&&s.fishingReady,'reload')
  assert.equal((await snapshot()).fishBook.count,1)
  await evaluate("document.querySelector('.fish-book').open=true")
  await shot('13-book-after-reload');check('book persists and walking restored',await snapshot())
  assert.equal(report.errors.length,0,report.errors.join('\n'))
  report.status='PASS: casting, early/missed/overload failures, paused timers, tension control, catch once, repeat, cancel, persistence'
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
