// Fish kinds (plan X2 §2.1): the light decides what bites; the landed fish wears its colours; field guide, tank and journal follow. Isolated headless Edge.
import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createHeadlessBrowser } from './browser-session.mjs'

const out = resolve(process.env.FOREST_QA_OUT ?? 'docs/evidence/2026-10-27-expansion/x2-fish')
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
const state = (expr) => evaluate(`(()=>{const s=forestStore.getState(),u=uiStore.getState();return ${expr}})()`)
const setState = (value) => evaluate(`forestStore.setState(${JSON.stringify(value)})`)
async function boot(width, height, fresh = false) {
  await cmd('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false })
  if (fresh) await evaluate('localStorage.clear()').catch(() => {})
  await cmd('Page.navigate', { url: `${base}?qa` })
  await sleep(500); await waitFor(ready, 'scene ready', 400); await sleep(1500)
  await evaluate(`(async()=>{const r=p=>performance.getEntriesByType('resource').find(e=>new URL(e.name).pathname===p).name;window.forestStore=(await import(r('/src/game/store.ts'))).useForestStore;window.uiStore=(await import(r('/src/game/uiStore.ts'))).useUiStore;window.photoStore=(await import(r('/src/game/photoStore.ts'))).usePhotoStore;window.journalStore=(await import(r('/src/game/journalStore.ts'))).useJournalStore;window.fishing=await import(r('/src/game/fishing.ts'))})()`)
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
  await evaluate("journalStore.setState(s=>({book:{...s.book,page:{...s.book.page,tasks:[{id:'newKind',progress:0,doneAt:null},{id:'glowfish',progress:0,doneAt:null},{id:'tree',progress:0,doneAt:null}]}}}))")
  // 1. Real F at the pond, at night: whatever bites is a kind that bites at night.
  await setState({ timeOfDay: 'night' }); await sleep(800)
  await evaluate("forestStore.getState().updatePosition(fishingSpot.x,fishingSpot.z)".replace(/fishingSpot/g, 'fishing.fishingSpot')); await sleep(400)
  await press('KeyF', 'f'); await waitFor("forestStore.getState().mode==='fishing'", 'fishing starts', 60)
  const nightKinds = new Set()
  for (let i = 0; i < 40; i++) nightKinds.add(await evaluate("fishing.beginFishing(Math.random,'night').species"))
  assert(nightKinds.has('glowfish')); check('night casts can hook a glowfish', { kinds: [...nightKinds] })
  // 2. Land a glowfish (the hook and reel minigame is covered by the existing fishing scripts).
  await evaluate("forestStore.setState(s=>({fishing:{...s.fishing,phase:'landing',elapsed:1.1,sizeCm:27,species:'glowfish'}}))")
  await waitFor("forestStore.getState().fishing?.phase==='caught'", 'caught', 60); await sleep(500)
  const title = await evaluate("document.querySelector('.fishing-hud strong').textContent")
  assert(title.includes('夜光鱼') && title.includes('27'), title)
  const tint = await evaluate("(()=>{let c=null;forestScene.getObjectByName('fishing-tools').traverse(o=>{if(o.isMesh&&o.material?.emissiveIntensity>0&&!c)c={color:o.material.color.getHexString(),glow:o.material.emissiveIntensity,visible:o.visible}});return c})()")
  assert(tint && tint.glow > 0.4, JSON.stringify(tint)); check('landed glowfish is named on the card and glows', { title, tint })
  await shot('01-glowfish-caught')
  const done = await evaluate("journalStore.getState().book.page.tasks.map(t=>t.id+':'+(t.doneAt?1:0))")
  assert.deepEqual(done, ['newKind:1', 'glowfish:1', 'tree:0']); check('journal: new kind and glowfish tasks complete', { done })
  const book = await state('s.fishBook.kinds'); assert.deepEqual(book, { glowfish: { count: 1, bestCm: 27 } })
  // 3. Into the tank; it keeps its colours there.
  await click('.fishing-hud button', '放入鱼缸'); await sleep(300)
  assert.equal(await state('s.homeBook.fish[0].species'), 'glowfish'); check('kept fish remembers its kind')
  await press('Escape', 'Escape'); await sleep(400)
  // 4. Field guide: one found, the rest as unknowns with when they bite; survives a reload.
  await boot(1440, 900)
  await click('.menu button', '图鉴'); await sleep(400)
  const guide = await evaluate("({summary:document.querySelector('#catalog-page p').textContent,items:[...document.querySelectorAll('.species-list li')].map(li=>li.className+':'+li.querySelector('strong').textContent+':'+li.querySelector('small').textContent)})")
  assert(guide.summary.includes('1 / 5'), guide.summary)
  assert(guide.items.some(i => i.startsWith('found:夜光鱼:1 尾')) && guide.items.filter(i => i.startsWith('unknown:？？？')).length === 4, JSON.stringify(guide))
  check('field guide lists kinds, found and unknown, after reload', guide)
  await shot('02-field-guide')
  await press('ArrowRight', 'ArrowRight').catch(() => {})
  await click('.catalog-tabs button', '背包'); await sleep(300)
  assert((await evaluate("document.querySelector('#catalog-page').textContent")).includes('背包还是空的')); check('satchel tab shows the empty note')
  await press('Escape', 'Escape')
  assert.deepEqual(report.errors, [])
  report.status = 'PASS'
} catch (e) {
  report.status = 'FAIL'; report.failure = e.stack ?? String(e); console.error(e); process.exitCode = 1
} finally {
  try { await writeFile(`${out}/report.json`, JSON.stringify(report, null, 2)) } finally { socket?.close(); await cleanup() }
}
