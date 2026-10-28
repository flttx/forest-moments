// Isolated headless Edge only. CDP pattern reused from my-blog/scripts/t10-gait-check.mjs.
import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createHeadlessBrowser } from './browser-session.mjs'

const out = resolve(process.env.FOREST_QA_OUT ?? 'docs/evidence/assets/2026-10-24-tree-growth/browser-production')
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

  async function press(k){await key(k,true);await key(k,false)}
  async function hold(k,ms){await key(k,true);await evaluate(`new Promise(resolve=>{let last=performance.now(),elapsed=0;function frame(t){elapsed+=Math.min(t-last,50);last=t;if(elapsed>=${ms})resolve();else requestAnimationFrame(frame)}requestAnimationFrame(frame)})`);await key(k,false)}
  async function waitUi(expression,label,limit=90000){const start=Date.now();while(Date.now()-start<limit){if(await evaluate(expression))return;await sleep(100)}throw Error('UI timeout '+label)}
  async function goPlot(){
    // From the spawn the opening camera looks along yaw 3π/4, so W+A walks straight toward the corner at (0, 8).
    for(let i=0;i<60;i++){
      if(await evaluate("Array.from(document.querySelectorAll('.interaction .action-button')).some(b=>/种一棵树|看看小树/.test(b.textContent))"))return
      await key('w',true);await hold('a',180);await key('w',false)
    }
    throw Error('Planting corner was not reached through visible UI')
  }
  async function reload(){const time=await evaluate('performance.timeOrigin');await cmd('Page.reload');await sleep(500);await waitUi(`performance.timeOrigin!==${time}&&!document.querySelector('.asset-loading')&&!document.querySelector('.world-error')`,'reload');await sleep(1000)}
  await goPlot();await press('f');await waitUi("document.querySelector('[data-growth-stage]')?.dataset.growthStage==='sprout'",'plant sprout');await sleep(1300);await shot('01-production-sprout')
  const initial=await evaluate("JSON.parse(localStorage.getItem('forest-moments:tree:v3')).trees[0]");assert.equal(initial.stage,0)
  await waitUi("document.querySelector('[data-growth-stage]')?.dataset.growthStage==='seedling'",'real seedling',65000);await sleep(1000);await shot('02-production-seedling');check('real production planting and first growth',{elapsedMs:Date.now()-initial.plantedAt})
  await reload();assert.equal(await snapshot(),null);await goPlot();await press('f');await sleep(1300);await shot('03-production-reload');assert.equal(await evaluate("JSON.parse(localStorage.getItem('forest-moments:tree:v3')).trees[0].stage"),1)
  await evaluate("localStorage.setItem('forest-moments:tree:v3',JSON.stringify({version:3,trees:[{spot:0,plantedAt:Date.now()-300000,stage:1,day:0}]}))")
  await reload();await goPlot();await press('f');await sleep(1300);await shot('04-production-offline-mature');assert.equal(await evaluate("document.querySelector('[data-growth-stage]').dataset.growthStage"),'mature');check('production offline fixture and inspection',true)
  await press('f');await hold('w',400);assert.equal(await snapshot(),null)
  report.assets=await evaluate("performance.getEntriesByType('resource').filter(e=>/assets\\/models/.test(e.name)).map(e=>new URL(e.name).pathname)")
  assert.equal(report.assets.filter(s=>s.includes('/tree-')).length,4)
  assert.equal(report.errors.length,0,report.errors.join('\n'));report.status='PASS'
}catch(error){report.status='FAIL';report.failure=String(error);process.exitCode=1;if(socket?.readyState===1){try{await shot('headless-failure')}catch{}}}
finally{
  try {
    await writeFile(`${out}/headless-validation.json`,JSON.stringify(report,null,2)+'\n');if(socket?.readyState===1){try{await cmd('Browser.close')}catch{}socket.close()}console.log(report.status)
  } finally {
    await cleanup()
  }
}
