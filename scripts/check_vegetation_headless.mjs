// Isolated headless Edge only. CDP pattern reused from my-blog/scripts/t10-gait-check.mjs.
import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createHeadlessBrowser } from './browser-session.mjs'

const stage = process.env.FOREST_RENDER_STAGE ?? 'after'
const out = resolve(`docs/evidence/vegetation-expansion/2026-10-24/${stage}`)
await mkdir(out, { recursive: true })
const { profile, cleanup } = await createHeadlessBrowser([
  '--headless=new', '--disable-features=CalculateNativeWinOcclusion', '--disable-frame-rate-limit', '--disable-gpu-vsync', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--remote-debugging-port=0', '--no-first-run', '--no-default-browser-check', 'about:blank',
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
  throw Error(`Timeout: ${label}; state=${JSON.stringify(await snapshot())}`)
}
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
  await cmd('Page.enable'); await cmd('Runtime.enable'); await cmd('Page.bringToFront'); await cmd('Emulation.setFocusEmulationEnabled', {enabled:true})
  await cmd('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })
  const base = process.env.FOREST_QA_URL ?? 'http://127.0.0.1:5176/'
  const views = process.env.FOREST_PERF_ONLY ? [] : (process.env.FOREST_QA_VIEWS?.split(',') ?? ['default', 'overview', 'coast', 'pond', 'workshop', 'tower', 'farm', 'player', 'fullIsland', 'flowers', 'lamp', 'trail','beach','dock'])
  for (const light of process.env.FOREST_QA_LIGHTS?.split(',') ?? ['day', 'dusk', 'night']) {
    for (const view of views) {
      if (stage.startsWith('before') && ['fullIsland','flowers','lamp','trail'].includes(view)) continue
      await cmd('Page.navigate', { url: `${base}?qa&light=${light}&view=${view}` })
      const state = await waitFor(s => s?.ready && s.models.length === 4 && s.fishingReady && s.boatReady, `${light}/${view}`, 90000)
      await sleep(1200)
      await shot(`${light}-${view}`)
      check(`${light}/${view}`, {...state, vegetation:await evaluate("JSON.parse(document.querySelector('canvas').dataset.vegetationQa||'null')"),grass:await evaluate("JSON.parse(document.querySelector('canvas').dataset.grassQa||'null')")})
    }
  }
  await cmd('Page.navigate', {url:`${base}?qa&view=pond`})
  await waitFor(s=>s?.ready && s.boatReady,'performance ready',90000)
  await sleep(1800)
  report.webgl = await evaluate(`(() => { const g=document.querySelector('canvas').getContext('webgl2'); const e=g.getExtension('WEBGL_debug_renderer_info'); return {renderer:e?g.getParameter(e.UNMASKED_RENDERER_WEBGL):g.getParameter(g.RENDERER),version:g.getParameter(g.VERSION)}; })()`)
  report.cadence = await evaluate(`new Promise(resolve => { const samples=[];const context=document.querySelector('canvas').getContext('webgl2');let first,prev;function tick(t){context.finish();if(first===undefined)first=t;if(prev!==undefined)samples.push(t-prev);prev=t;if(t-first<30000)requestAnimationFrame(tick);else{samples.sort((a,b)=>a-b);const mean=samples.reduce((a,b)=>a+b,0)/samples.length;resolve({durationMs:t-first,frames:samples.length,meanFps:1000/mean,p95FrameMs:samples[Math.floor(samples.length*.95)],maxFrameMs:samples.at(-1),meanFrameMs:mean});}}requestAnimationFrame(tick);})`)
  report.stableState=await snapshot()
  if (!stage.startsWith('before')) {
    report.layout=await evaluate("import('/src/world/vegetationLayout.ts').then(m=>({plants:m.vegetationPositions,lamps:m.lampPositions,colliders:m.vegetationColliders}))")
    const time = () => evaluate("JSON.parse(document.querySelector('canvas').dataset.environmentQa)")
    const a=await time(); await sleep(250); const b=await time()
    assert(b.time>a.time,'water and cloud clock should advance')
    await cmd('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]})
    await sleep(200); const c=await time(); await sleep(250); const d=await time()
    assert.equal(c.time,d.time,'reduced motion freezes environmental drift')
    assert(c.reduced && d.reduced)
    const grassA=await evaluate("JSON.parse(document.querySelector('canvas').dataset.grassQa)");await sleep(250);const grassB=await evaluate("JSON.parse(document.querySelector('canvas').dataset.grassQa)");assert(grassA.reduced&&grassB.reduced);assert.equal(grassA.time,grassB.time);check('grass reduced motion', {grassA,grassB})
    check('animated environment and reduced motion', {a,b,c,d})
  }
  assert.equal(report.errors.length,0,report.errors.join('\n'))
  if(!stage.startsWith('before')) {
    for(const [width,height] of [[1920,1080],[390,844]]) {
      await cmd('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false})
      await cmd('Page.navigate',{url:`${base}?qa`})
      await waitFor(s=>s?.ready && s.boatReady,'responsive render',90000)
      await sleep(800);await shot(`layout-${width}x${height}`)
    }
  }
  assert.equal(report.errors.length,0,report.errors.join('\n'))
  report.status='PASS: captures and scoped render checks; visual assessment recorded separately'
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
