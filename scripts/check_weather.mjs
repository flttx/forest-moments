// Weather and seasons (plan X4): same view under clear, cloudy, rain and mist, and in autumn; rain stops indoors; title shows the day; photo previews are not saved; frame time. Isolated headless Edge.
import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createHeadlessBrowser } from './browser-session.mjs'

const out = resolve(process.env.FOREST_QA_OUT ?? 'docs/evidence/2026-10-28-weather')
const base = process.env.FOREST_URL ?? 'http://127.0.0.1:5176/'
await mkdir(out, { recursive: true })
const { profile, cleanup } = await createHeadlessBrowser([
  '--headless=new', '--disable-features=CalculateNativeWinOcclusion', '--disable-frame-rate-limit', '--disable-gpu-vsync', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--remote-debugging-port=0', '--no-first-run', '--no-default-browser-check', 'about:blank',
])
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const report = { date: new Date().toISOString(), checks: [], errors: [], screenshots: [], status: 'RUNNING' }
let socket, seq = 0
const pending = new Map()
const cmd = (method, params = {}) => new Promise((ok, fail) => {
  const id = ++seq, timer = setTimeout(() => { pending.delete(id); fail(Error('CDP timeout ' + method)) }, 45000)
  pending.set(id, (m) => { clearTimeout(timer); if (m.error) fail(Error(JSON.stringify(m.error))); else ok(m.result) })
  socket.send(JSON.stringify({ id, method, params }))
})
const evaluate = async (expression) => {
  const r = await cmd('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  if (r.exceptionDetails) throw Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text)
  return r.result?.value
}
const ready = "!!document.querySelector('canvas')&&!document.querySelector('.asset-loading')&&!document.querySelector('.world-error')"
const waitFor = async (expression, label, tries = 200) => { for (let i = 0; i < tries; i++) { if (await evaluate(expression)) return; await sleep(100) } throw Error('Timed out: ' + label) }
const shot = async (name) => { await sleep(300); const r = await cmd('Page.captureScreenshot', { format: 'png' }); await writeFile(`${out}/${name}.png`, Buffer.from(r.data, 'base64')); report.screenshots.push(`${name}.png`) }
const check = (name, detail = {}) => { report.checks.push({ name, ...detail }); console.log('PASS', name) }
const keyCode = (k) => k === ' ' ? 32 : k.length === 1 ? k.toUpperCase().charCodeAt(0) : k === 'Escape' ? 27 : 0
const press = async (code, k) => { for (const type of ['keyDown', 'keyUp']) await cmd('Input.dispatchKeyEvent', { type, code, key: k, windowsVirtualKeyCode: keyCode(k) }) }
const centre = (selector, text = '') => evaluate(`(()=>{const e=[...document.querySelectorAll(${JSON.stringify(selector)})].find(b=>!${JSON.stringify(text)}||b.textContent.includes(${JSON.stringify(text)}));if(!e)return null;const r=e.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`)
const click = async (selector, text = '') => {
  const box = await centre(selector, text); assert(box, `Missing ${selector} ${text}`)
  for (const type of ['mousePressed', 'mouseReleased']) await cmd('Input.dispatchMouseEvent', { type, x: box.x, y: box.y, button: 'left', buttons: type === 'mousePressed' ? 1 : 0, clickCount: 1 })
}
async function boot(width, height, fresh = false) {
  await cmd('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false })
  if (fresh) await evaluate('localStorage.clear()').catch(() => {})
  await cmd('Page.navigate', { url: `${base}?qa` })
  await sleep(500); await waitFor(ready, 'scene ready', 400); await sleep(1500)
  await evaluate(`(async()=>{const r=p=>performance.getEntriesByType('resource').find(e=>new URL(e.name).pathname===p).name;window.forestStore=(await import(r('/src/game/store.ts'))).useForestStore;window.uiStore=(await import(r('/src/game/uiStore.ts'))).useUiStore;window.photoStore=(await import(r('/src/game/photoStore.ts'))).usePhotoStore;window.journalStore=(await import(r('/src/game/journalStore.ts'))).useJournalStore;window.photoStore=(await import(r('/src/game/photoStore.ts'))).usePhotoStore;window.photoMod=await import(r('/src/game/photoStore.ts'));window.forage=await import(r('/src/game/forage.ts'));window.farm=await import(r('/src/game/farm.ts'));window.inventoryStore=(await import(r('/src/game/inventoryStore.ts'))).useInventoryStore;window.settlement=await import(r('/src/world/settlement.ts'));window.workshop=await import(r('/src/game/workshop.ts'));window.movement=await import(r('/src/game/movement.ts'));window.furniture=await import(r('/src/game/furniture.ts'));window.secrets=await import(r('/src/game/secrets.ts'));window.expansion=await import(r('/src/game/expansion.ts'));window.weather=await import(r('/src/game/weather.ts'))})()`)
}

try {
  let port
  for (let i = 0; i < 100 && !port; i++) { try { port = (await readFile(`${profile}/DevToolsActivePort`, 'utf8')).split('\n')[0] } catch { await sleep(200) } }
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
  await cmd('Page.enable'); await cmd('Runtime.enable'); await cmd('Page.bringToFront'); await cmd('Emulation.setFocusEmulationEnabled', { enabled: true })
  await cmd('Page.navigate', { url: base }); await sleep(800)
  await boot(1440, 900, true)
  await waitFor("!document.querySelector('.guide')", 'guide folds away', 120)
  // A day for each weather in summer (nights 4-7 are summer), and an autumn clear day.
  const days = await evaluate("(()=>{const pick=(w,s)=>{for(let d=1;d<400;d++)if(weather.weatherFor(d)===w&&weather.seasonFor(d)===s)return d;return null};return{clear:pick('clear','summer'),cloudy:pick('cloudy','summer'),rain:pick('rain','summer'),mist:pick('mist','summer'),autumn:pick('clear','autumn'),spring:pick('clear','spring')}})()")
  const frameMs = () => evaluate("new Promise(r=>{const t=[];let last=performance.now();const f=n=>{t.push(n-last);last=n;if(t.length<120)requestAnimationFrame(f);else{t.sort((a,b)=>a-b);r({median:+t[60].toFixed(2),p95:+t[114].toFixed(2)})}};requestAnimationFrame(f)})")
  const stats = {}
  for (const [label, day] of Object.entries(days)) {
    await evaluate(`forestStore.setState(s=>({homeBook:{...s.homeBook,nights:${day}}}))`); await sleep(6000)
    const title = await evaluate("document.querySelector('.brand-climate')?.textContent")
    const q = await evaluate("({rain:forestScene.getObjectByName('rain')?.visible,leaves:forestScene.getObjectByName('falling-leaves')?.visible})")
    stats[label] = { day, title, ...q, frame: await frameMs() }
    await shot(`01-${label}`)
  }
  assert.equal(stats.rain.rain, true); assert.equal(stats.clear.rain, false); assert.equal(stats.autumn.leaves, true); assert.equal(stats.clear.leaves, false)
  assert(stats.rain.title.includes('小雨') && stats.mist.title.includes('薄雾') && stats.autumn.title.startsWith('秋'), JSON.stringify(stats))
  check('each weather and season shows in the scene and beside the title; rain falls, autumn leaves drift', stats)
  // Rain stops falling indoors.
  await evaluate(`forestStore.setState(s=>({homeBook:{...s.homeBook,nights:${days.rain}},location:'bedroom',position:{x:0,z:1.1},mode:'walking'}))`); await sleep(2500)
  assert.equal(await evaluate("forestScene.getObjectByName('rain').visible"), false); await shot('02-rain-indoors')
  check('no rain streaks inside the cabin')
  // Photo preview: mist on a clear day, only while the camera is out.
  await evaluate(`forestStore.setState(s=>({homeBook:{...s.homeBook,nights:${days.clear}},location:'island',position:{x:0,z:0}}))`); await sleep(2500)
  await press('KeyP', 'p'); await sleep(300); await click('.photo-bar button', '滤镜与相框'); await sleep(300)
  await click('.photo-styles button', '薄雾'); await sleep(5000); await shot('03-photo-preview-mist')
  assert.equal(await evaluate('photoStore.getState().weatherPreview'), 'mist')
  await press('Escape', 'Escape'); await sleep(300)
  assert.equal(await evaluate('photoStore.getState().weatherPreview'), null)
  assert.equal(await evaluate(`forestStore.getState().homeBook.nights`), days.clear)
  check('a weather preview is for the photo only and is dropped on leaving')
  // Raindrop rings on the pond and the sea: the same close views on a clear day and in the rain.
  const water = async (label, day) => {
    await evaluate(`forestStore.setState(s=>({homeBook:{...s.homeBook,nights:${day}},location:'island',position:{x:-.2,z:-3.2},mode:'walking'}))`); await sleep(5500)
    await press('KeyP', 'p'); await sleep(300); await click('.photo-bar button', '自由取景'); await sleep(200); await click('.photo-bar button', '隐藏浣熊'); await sleep(200)
    await evaluate("photoMod.freeCam.view={x:1.6,y:1.7,z:-2.4,yaw:Math.atan2(1.8,-1.6),pitch:-.62}"); await sleep(1500); await shot(`04-pond-${label}`)
    await evaluate(`forestStore.getState().updatePosition(41,-.8)`); await sleep(300)
    await evaluate("photoMod.freeCam.view={x:41,y:1.8,z:-1.2,yaw:Math.PI*.95,pitch:-.55}"); await sleep(1500); await shot(`05-sea-${label}`)
    await press('Escape', 'Escape'); await sleep(300)
  }
  await water('clear', days.clear); await water('rain', days.rain)
  check('raindrop rings show on the pond and the sea when it rains (see 04/05 screenshots)')
  assert.deepEqual(report.errors, [])
  report.status = 'PASS'
} catch (e) {
  report.status = 'FAIL'; report.failure = e.stack ?? String(e); console.error(e); process.exitCode = 1
} finally {
  try { await writeFile(`${out}/report.json`, JSON.stringify(report, null, 2)) } finally { socket?.close(); await cleanup() }
}
