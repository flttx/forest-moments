// Isolated headless Edge only. CDP pattern reused from my-blog/scripts/t10-gait-check.mjs.
// Audio: unlock on the first key press, every sound decodes, gameplay and menus trigger their cues, M and the panel work.

import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createHeadlessBrowser } from './browser-session.mjs'


const out = resolve(process.env.FOREST_QA_OUT ?? 'docs/evidence/2026-10-26-audio')
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
async function shot(name) {
  const result = await cmd('Page.captureScreenshot', { format: 'png' })
  await writeFile(`${out}/${name}.png`, Buffer.from(result.data, 'base64'))
  report.screenshots.push(`${name}.png`)
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
  await cmd('Page.enable'); await cmd('Runtime.enable'); await cmd('Page.bringToFront'); await cmd('Emulation.setFocusEmulationEnabled', { enabled: true })
  await cmd('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })
  await cmd('Page.navigate', { url: 'http://127.0.0.1:5176/?qa' })
  for (let i = 0; i < 400; i++) {
    const loaded = await evaluate("!!document.querySelector('canvas')&&!document.querySelector('.asset-loading')&&!document.querySelector('.world-error')")
    if (loaded && i > 10) break
    if (i === 399) throw Error('Assets failed to load')
    await sleep(200)
  }
  const load = (p) => `(await import(performance.getEntriesByType('resource').find(e=>new URL(e.name).pathname==='${p}').name))`
  await evaluate(`(async()=>{window.forestStore=${load('/src/game/store.ts')}.useForestStore;window.uiStore=${load('/src/game/uiStore.ts')}.useUiStore;window.audio=${load('/src/audio/audioStore.ts')};window.fishing=${load('/src/game/fishing.ts')};window.workshop=${load('/src/game/workshop.ts')}})()`)
  const press = (type, code, key) => cmd('Input.dispatchKeyEvent', { type, code, key })
  const key = async (code, key) => { await press('keyDown', code, key); await press('keyUp', code, key) }
  const hold = async (code, key, ms) => { await press('keyDown', code, key); await sleep(ms); await press('keyUp', code, key) }
  const waitFor = async (expression) => { for (let i = 0; i < 200; i++) { if (await evaluate(expression)) return; await sleep(100) } throw Error('Condition timed out: ' + expression) }
  const log = () => evaluate('window.forestAudioLog.splice(0)')
  const results = {}
  const check = (name, ok, detail) => { report.checks.push({ name, ok, detail }); console.log(ok ? 'PASS' : 'FAIL', name, JSON.stringify(detail)); if (!ok) results.failed = true }

  check('locked before any input', !(await evaluate('!!window.audio.audioEngine()')), null)
  // Shift alone is not a user activation in Chromium: the context starts suspended and the next real key must resume it.
  await key('ShiftLeft', 'Shift')
  await waitFor('window.audio.audioEngine()?.ready'); await sleep(300)
  const first = await evaluate('window.audio.audioEngine().ctx.state')
  await key('KeyQ', 'q'); await sleep(500)
  const engine = { afterShift: first, ...(await evaluate("(()=>{const e=window.audio.audioEngine();return{state:e.ctx.state,rate:e.ctx.sampleRate}})()")) }
  check('running after the first real key press, even if a modifier came first', engine.state === 'running', engine)
  // Every listed file fetches and decodes in this browser.
  const decoded = await evaluate(`(async()=>{const list=await (await fetch('/assets/audio/audio.json')).json(),ctx=window.audio.audioEngine().ctx,bad=[];let ok=0
    for(const [name,e] of Object.entries(list.sounds)){try{const b=await ctx.decodeAudioData(await (await fetch(e.file)).arrayBuffer());if(b.duration>0)ok++;else bad.push(name)}catch{bad.push(name)}}
    return{total:Object.keys(list.sounds).length,ok,bad}})()`)
  check('all sounds decode', decoded.ok === decoded.total && decoded.total === 46, decoded)

  await log()
  await evaluate("forestStore.setState({location:'island',mode:'walking',position:{x:0,z:2}})"); await sleep(300)
  await hold('KeyW', 'w', 1800)
  const steps = (await log()).filter((n) => n.startsWith('step-grass'))
  check('footsteps on grass while walking', steps.length >= 3, { steps: steps.length })

  await evaluate(`forestStore.setState({position:{...fishing.fishingSpot},nearby:'pond',fishingReady:true})`); await sleep(300); await log()
  await key('KeyF', 'f'); await waitFor("forestStore.getState().fishing?.phase==='waiting'")
  await evaluate("forestStore.setState({fishing:{...forestStore.getState().fishing,phase:'bite',elapsed:0}})"); await sleep(200)
  await key('KeyF', 'f'); await sleep(200); await press('keyDown', 'Space', ' '); await sleep(2600); await press('keyUp', 'Space', ' ')
  const fishingCues = await log()
  check('fishing: cast, landing, bite, strike, reel', ['cast', 'splash-tiny', 'bite', 'splash', 'reel'].every((n) => fishingCues.includes(n)), fishingCues)
  await key('Escape', 'Escape'); await sleep(300)

  await evaluate("forestStore.setState({mode:'walking',fishing:null,position:{...workshop.workshopDoor},nearby:'workshop',workshopReady:true})"); await sleep(300); await log()
  await key('KeyF', 'f'); await waitFor("forestStore.getState().location==='workshop'&&!forestStore.getState().workshopTransfer")
  check('workshop door opens and closes', JSON.stringify(await log()).includes('door-open') , null)
  await hold('KeyW', 'w', 1200)
  check('wooden footsteps indoors', (await log()).some((n) => n.startsWith('step-wood')), null)
  await evaluate("forestStore.setState({location:'island',position:{x:0,z:2},workshopTransfer:null})"); await sleep(400); await log()

  await evaluate("uiStore.getState().openPanel('help')"); await sleep(150); await evaluate("uiStore.getState().openPanel('places')"); await sleep(150); await evaluate('uiStore.getState().closePanel()'); await sleep(150)
  const ui = (await log()).filter((n) => /^ui-|^page$/.test(n))
  check('menu panels open, page and close', JSON.stringify(ui) === JSON.stringify(['ui-open', 'page', 'ui-close']), ui)

  // M mutes and unmutes; the toolbar panel shows the four volumes.
  await key('KeyM', 'm'); const muted = await evaluate('window.audio.useAudioStore.getState().settings.muted')
  await key('KeyM', 'm'); const unmuted = !(await evaluate('window.audio.useAudioStore.getState().settings.muted'))
  check('M toggles mute', muted && unmuted, { muted, unmuted })
  await evaluate("document.querySelector('.sound-control button').click()"); await sleep(300)
  const panel = await evaluate("(()=>{const p=document.querySelector('.sound-panel');return p?{sliders:p.querySelectorAll('input[type=range]').length,focused:document.activeElement?.type}:null})()")
  check('sound panel has mute and four volumes', panel?.sliders === 4, panel)
  await shot('sound-panel')
  await key('Escape', 'Escape'); await sleep(200)
  check('Escape closes the sound panel', !(await evaluate("!!document.querySelector('.sound-panel')")), null)

  // The farm calls from where the animals are; wait long enough for both timers.
  await evaluate("forestStore.setState({position:{x:8,z:3}})"); await sleep(20000)
  const farm = await log()
  check('hens and sheep call near the farm', farm.some((n) => n.startsWith('hen-')) && farm.some((n) => n.startsWith('sheep-')), farm.filter((n) => /hen|sheep/.test(n)))

  report.results = results
  assert.equal(report.errors.length, 0, report.errors.join('\n'))
  assert.ok(!results.failed, 'some audio checks failed')
  report.status = 'PASS'
} finally { try { await writeFile(`${out}/headless-validation.json`, JSON.stringify(report, null, 2)) } finally { socket?.close(); await cleanup() } }
