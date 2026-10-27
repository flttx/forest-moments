// Workshop pieces at their fixed places (plan X3 §2.5): models stand on the ground (the birdhouse on its tree), block walking, and leave paths clear. Isolated headless Edge.
import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createHeadlessBrowser } from './browser-session.mjs'

const out = resolve(process.env.FOREST_QA_OUT ?? 'docs/evidence/2026-10-27-expansion/x3-furniture')
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
  await evaluate(`(async()=>{const r=p=>performance.getEntriesByType('resource').find(e=>new URL(e.name).pathname===p).name;window.forestStore=(await import(r('/src/game/store.ts'))).useForestStore;window.uiStore=(await import(r('/src/game/uiStore.ts'))).useUiStore;window.photoStore=(await import(r('/src/game/photoStore.ts'))).usePhotoStore;window.journalStore=(await import(r('/src/game/journalStore.ts'))).useJournalStore;window.photoStore=(await import(r('/src/game/photoStore.ts'))).usePhotoStore;window.photoMod=await import(r('/src/game/photoStore.ts'));window.forage=await import(r('/src/game/forage.ts'));window.farm=await import(r('/src/game/farm.ts'));window.inventoryStore=(await import(r('/src/game/inventoryStore.ts'))).useInventoryStore;window.settlement=await import(r('/src/world/settlement.ts'));window.workshop=await import(r('/src/game/workshop.ts'));window.movement=await import(r('/src/game/movement.ts'));window.furniture=await import(r('/src/game/furniture.ts'))})()`)
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
  await evaluate("forestStore.setState(s=>({workshopBook:{...s.workshopBook,phase:'finished',made:['table','birdhouse','rodRack','signpost']}}))"); await sleep(2500)
  const measure = (name) => evaluate(`(()=>{const o=forestScene.getObjectByName(${JSON.stringify(name)});if(!o)return null;let meshes=0,lo=[1e9,1e9,1e9],hi=[-1e9,-1e9,-1e9];o.updateMatrixWorld(true);o.traverse(m=>{if(!m.isMesh)return;meshes++;const p=m.geometry.attributes.position,v=m.matrixWorld.elements;for(let i=0;i<p.count;i+=5){const x=p.getX(i),y=p.getY(i),z=p.getZ(i);const w=[v[0]*x+v[4]*y+v[8]*z+v[12],v[1]*x+v[5]*y+v[9]*z+v[13],v[2]*x+v[6]*y+v[10]*z+v[14]];for(let k=0;k<3;k++){lo[k]=Math.min(lo[k],w[k]);hi[k]=Math.max(hi[k],w[k])}}});const g=o.parent?.name==='bedroom-interior'||${JSON.stringify(name)}==='furniture-table'?0:movement.groundHeightAt(o.position.x,o.position.z);return{meshes,bottom:+(lo[1]-g).toFixed(3),top:+(hi[1]-g).toFixed(3),w:+(hi[0]-lo[0]).toFixed(2),d:+(hi[2]-lo[2]).toFixed(2)}})()`)
  const frame = async (x, y, z, yaw, pitch, label) => { await evaluate(`photoMod.freeCam.view={x:${x},y:${y},z:${z},yaw:${yaw},pitch:${pitch}}`); await sleep(1300); await shot(label) }
  const stats = {}
  // Island pieces: stand near each, frame it with the free camera.
  for (const [id, cam] of [['signpost', [3.6, 1.6, 5.4]], ['rodRack', [-2.6, 1.3, -6.4]], ['birdhouse', [22.4, 1.7, 21.8]]]) {
    const f = await evaluate(`furniture.furniturePlaces['${id}']`)
    await evaluate(`forestStore.getState().updatePosition(${cam[0]},${cam[2]})`); await sleep(1500)
    stats[id] = await measure(`furniture-${id}`); assert(stats[id]?.meshes > 0, `${id} missing`)
    await press('KeyP', 'p'); await sleep(300); await click('.photo-bar button', '自由取景'); await sleep(200); await click('.photo-bar button', '隐藏浣熊'); await sleep(200)
    const g = await evaluate(`movement.groundHeightAt(${cam[0]},${cam[2]})`)
    const tx = f.x - cam[0], tz = f.z - cam[2], ty = (f.y ?? 0) + .5 - cam[1]
    await frame(cam[0], g + cam[1], cam[2], Math.atan2(tx, tz), Math.atan2(ty, Math.hypot(tx, tz)), `01-${id}`)
    await press('Escape', 'Escape'); await sleep(300)
  }
  assert(Math.abs(stats.signpost.bottom) < .05 && stats.signpost.top > 1.2, JSON.stringify(stats.signpost))
  assert(Math.abs(stats.rodRack.bottom) < .05, JSON.stringify(stats.rodRack))
  assert(stats.birdhouse.bottom > 1.3 && stats.birdhouse.bottom < 1.6, JSON.stringify(stats.birdhouse))
  check('island pieces stand at their places at real size; the birdhouse hangs on its tree', stats)
  // Walk into the rack with real keys: the raccoon stops at its edge.
  const rack = await evaluate("furniture.furniturePlaces.rodRack")
  await evaluate(`forestStore.getState().updatePosition(${rack.x - 1.4},${rack.z})`); await sleep(500)
  const before = (await evaluate("JSON.parse(document.querySelector('canvas').dataset.forestQa).position"))
  // Face +x by walking: the camera-relative input is turned with the live orbit yaw.
  const yaw = await evaluate("JSON.parse(document.querySelector('canvas').dataset.forestQa).orbit.yaw")
  const ix = Math.cos(yaw), iz = Math.sin(yaw), keys = [ix > .3 ? ['KeyD', 'd'] : ix < -.3 ? ['KeyA', 'a'] : null, iz > .3 ? ['KeyS', 's'] : iz < -.3 ? ['KeyW', 'w'] : null].filter(Boolean)
  for (const [code, k] of keys) await cmd('Input.dispatchKeyEvent', { type: 'keyDown', code, key: k, windowsVirtualKeyCode: k.toUpperCase().charCodeAt(0) })
  await sleep(2600)
  for (const [code, k] of keys) await cmd('Input.dispatchKeyEvent', { type: 'keyUp', code, key: k, windowsVirtualKeyCode: k.toUpperCase().charCodeAt(0) })
  const after = (await evaluate("JSON.parse(document.querySelector('canvas').dataset.forestQa).position"))
  assert(after[0] > before[0] + .4, `walked ${JSON.stringify([before, after])}`)
  assert(after[0] < rack.x - .27, `stopped at the rack: ${after[0]} vs rack ${rack.x}`)
  check('walking into the rod rack stops at its edge', { before, after, rackX: rack.x })
  // Bedroom table.
  await evaluate("forestStore.setState({location:'bedroom',position:{x:0,z:1.1},mode:'walking'})"); await sleep(1800)
  stats.table = await measure('furniture-table'); assert(stats.table?.meshes > 0 && Math.abs(stats.table.bottom) < .05, JSON.stringify(stats.table))
  await press('KeyP', 'p'); await sleep(300); await click('.photo-bar button', '自由取景'); await sleep(200); await click('.photo-bar button', '隐藏浣熊')
  await frame(.4, 1.6, .2, Math.atan2(2.45, 1.65), -.35, '02-table')
  check('the table stands in the bedroom corner', stats.table)
  assert.deepEqual(report.errors, [])
  report.status = 'PASS'
} catch (e) {
  report.status = 'FAIL'; report.failure = e.stack ?? String(e); console.error(e); process.exitCode = 1
} finally {
  try { await writeFile(`${out}/report.json`, JSON.stringify(report, null, 2)) } finally { socket?.close(); await cleanup() }
}
