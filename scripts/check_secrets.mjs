// Hidden corners (plan X3 §2.9): the bottle read with F, the jellyfish and the raccoon constellation found by night photos; the field guide lists them. Isolated headless Edge.
import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createHeadlessBrowser } from './browser-session.mjs'

const out = resolve(process.env.FOREST_QA_OUT ?? 'docs/evidence/2026-10-27-expansion/x3-secrets')
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
  await evaluate(`(async()=>{const r=p=>performance.getEntriesByType('resource').find(e=>new URL(e.name).pathname===p).name;window.forestStore=(await import(r('/src/game/store.ts'))).useForestStore;window.uiStore=(await import(r('/src/game/uiStore.ts'))).useUiStore;window.photoStore=(await import(r('/src/game/photoStore.ts'))).usePhotoStore;window.journalStore=(await import(r('/src/game/journalStore.ts'))).useJournalStore;window.photoStore=(await import(r('/src/game/photoStore.ts'))).usePhotoStore;window.photoMod=await import(r('/src/game/photoStore.ts'));window.forage=await import(r('/src/game/forage.ts'));window.farm=await import(r('/src/game/farm.ts'));window.inventoryStore=(await import(r('/src/game/inventoryStore.ts'))).useInventoryStore;window.settlement=await import(r('/src/world/settlement.ts'));window.workshop=await import(r('/src/game/workshop.ts'));window.movement=await import(r('/src/game/movement.ts'));window.furniture=await import(r('/src/game/furniture.ts'));window.secrets=await import(r('/src/game/secrets.ts'));window.expansion=await import(r('/src/game/expansion.ts'))})()`)
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
  const found = () => evaluate("Object.keys(forestStore.getState().secretsBook.found)")
  // 1. The bottle on the south crescent: on the sand, F reads it and records it.
  const b = await evaluate('secrets.bottleSpot')
  await evaluate(`forestStore.getState().updatePosition(${b.x}+.5,${b.z})`); await sleep(1500)
  const bottle = await evaluate(`(()=>{const o=forestScene.getObjectByName('secret-bottle');if(!o)return null;let meshes=0;o.traverse(m=>{if(m.isMesh)meshes++});return{meshes}})()`)
  assert(bottle?.meshes > 0, 'bottle model missing')
  assert((await evaluate("document.querySelector('.interaction .action-button')?.textContent??''")).includes('漂流瓶'))
  await press('KeyP', 'p'); await sleep(300); await click('.photo-bar button', '自由取景'); await sleep(200); await click('.photo-bar button', '隐藏浣熊')
  await evaluate(`photoMod.freeCam.view={x:${b.x}+.9,y:movement.groundHeightAt(${b.x},${b.z})+.55,z:${b.z}+.6,yaw:Math.atan2(-.9,-.6),pitch:-.45}`); await sleep(1300); await shot('01-bottle')
  await press('Escape', 'Escape'); await sleep(300)
  await press('KeyF', 'f'); await sleep(400)
  assert.deepEqual(await found(), ['bottle']); assert((await evaluate("document.querySelector('.notice')?.textContent??''")).includes('纸条'))
  check('the bottle lies on the sand; F reads the note and finds it')
  // 2. Night on the jetty: photograph the glowing jellyfish.
  await evaluate("forestStore.setState({timeOfDay:'night'})"); await sleep(800)
  const j = await evaluate('secrets.jellyfishSpot')
  await evaluate(`forestStore.getState().updatePosition(${j.x},0)`); await sleep(1500)
  await press('KeyP', 'p'); await sleep(300); await click('.photo-bar button', '自由取景'); await sleep(200)
  await evaluate(`photoMod.freeCam.view={x:${j.x}-1.5,y:1.6,z:-.2,yaw:Math.atan2(1.5,-2.0),pitch:Math.atan2(${j.y}+.25-1.6,2.5)}`); await sleep(2500)
  await evaluate("photoStore.setState({last:null})"); await press('Space', ' '); await waitFor('!!photoStore.getState().last', 'jelly shot', 100); await sleep(500)
  const jellyShot = await evaluate('photoStore.getState().last.subjects'); await shot('02-jellyfish-night')
  assert(jellyShot.includes('jellyfish'), JSON.stringify(jellyShot)); assert((await found()).includes('jellyfish'))
  check('a night photo of the glowing jellyfish by the jetty finds it', { jellyShot })
  await press('Escape', 'Escape'); await sleep(300)
  // 3. Stargazing from the west seat by the fire: the constellation is in the natural view; a photo of it finds it.
  const seat = await evaluate("(()=>{const s=expansion.seats.find(v=>v.id==='camp-west');return expansion.seatOrigin(s)})()")
  await evaluate(`forestStore.getState().updatePosition(${seat.x},${seat.z})`); await sleep(800)
  await press('KeyF', 'f'); await waitFor("forestStore.getState().sitting?.phase==='idle'", 'seated', 120)
  await press('KeyV', 'v'); await sleep(4000); await shot('03-stargazing-west-seat')
  await press('KeyV', 'v'); await sleep(800)
  await press('KeyP', 'p'); await sleep(300); await click('.photo-bar button', '自由取景'); await sleep(200)
  const c = await evaluate('secrets.constellation.centre')
  await evaluate(`photoMod.freeCam.view={...photoMod.freeCam.view,yaw:Math.atan2(${c[0]},${c[2]}),pitch:Math.asin(${c[1]})-.1}`); await sleep(2000)
  await evaluate("photoStore.setState({last:null})"); await press('Space', ' '); await waitFor('!!photoStore.getState().last', 'sky shot', 100); await sleep(500)
  const skyShot = await evaluate('photoStore.getState().last.subjects'); await shot('04-constellation')
  assert(skyShot.includes('constellation'), JSON.stringify(skyShot)); assert((await found()).includes('constellation'))
  check('a night photo of the raccoon constellation finds it', { skyShot })
  await press('Escape', 'Escape'); await sleep(300); await press('KeyF', 'f'); await sleep(2600)
  // 4. The field guide lists all three.
  await click('.menu button', '图鉴'); await sleep(300); await click('.catalog-tabs button', '隐藏角落'); await sleep(300)
  const page = await evaluate("[...document.querySelectorAll('#catalog-page li')].map(li=>li.className+':'+li.querySelector('strong').textContent)")
  assert.deepEqual(page, ['found:漂流瓶', 'found:夜光水母', 'found:浣熊星座']); await shot('05-field-guide')
  check('the field guide lists the three hidden corners', { page })
  assert.deepEqual(report.errors, [])
  report.status = 'PASS'
} catch (e) {
  report.status = 'FAIL'; report.failure = e.stack ?? String(e); console.error(e); process.exitCode = 1
} finally {
  try { await writeFile(`${out}/report.json`, JSON.stringify(report, null, 2)) } finally { socket?.close(); await cleanup() }
}
