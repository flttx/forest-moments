// Jetty fishing (plan X2 §2.1): real F on the jetty's south edge casts into the sea; the float lands on open water; sea kinds bite. Isolated headless Edge.
import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createHeadlessBrowser } from './browser-session.mjs'

const out = resolve(process.env.FOREST_QA_OUT ?? 'docs/evidence/2026-10-27-expansion/x2-sea-fishing')
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
  await evaluate("journalStore.setState(s=>({book:{...s.book,page:{...s.book.page,tasks:[{id:'seaCatch',progress:0,doneAt:null},{id:'newKind',progress:0,doneAt:null},{id:'tree',progress:0,doneAt:null}]}}}))")
  const site = await evaluate('fishing.fishingSites.sea')
  // Walk onto the jetty's south edge; the prompt offers a cast (not boarding).
  await evaluate(`forestStore.getState().updatePosition(${site.stand.x}+.3,${site.stand.z})`); await sleep(1200)
  const prompt = await evaluate("document.querySelector('.interaction .action-button')?.textContent??''")
  assert(prompt.includes('码头抛竿'), prompt)
  await press('KeyF', 'f'); await waitFor("forestStore.getState().mode==='fishing'", 'fishing', 60)
  assert.equal(await state('s.fishing.site'), 'sea')
  await waitFor("forestStore.getState().fishing?.phase==='waiting'", 'float settles', 120); await sleep(800)
  // The float sits on the sea near the site's float point, not on the jetty or the pond.
  const float = await evaluate(`(()=>{const g=forestScene.getObjectByName('fishing-tools');let best=null;g.traverse(o=>{if(o.isGroup&&o.children.length===2&&o.children.every(c=>c.isMesh)){const p=o.getWorldPosition(o.position.clone());best=[+p.x.toFixed(2),+p.y.toFixed(2),+p.z.toFixed(2)]}});return best})()`)
  assert(float && Math.hypot(float[0] - site.float.x, float[2] - site.float.z) < .6 && Math.abs(float[1] - site.waterY) < .2, JSON.stringify({ float, site }))
  await shot('01-sea-waiting')
  check('real F on the jetty edge casts into the sea; the float rides on open water', { prompt, float })
  // Land a sea bass (the bite and reel minigame is the same as at the pond).
  await evaluate("forestStore.setState(s=>({fishing:{...s.fishing,phase:'landing',elapsed:1.1,sizeCm:31,species:'seaBass'}}))")
  await waitFor("forestStore.getState().fishing?.phase==='caught'", 'caught', 60); await sleep(600)
  const card = await evaluate("document.querySelector('.fishing-hud').textContent")
  assert(card.includes('海鲈') && card.includes('放回海里'), card); await shot('02-sea-bass')
  const done = await evaluate("journalStore.getState().book.page.tasks.map(t=>t.id+':'+(t.doneAt?1:0))")
  assert.deepEqual(done, ['seaCatch:1', 'newKind:1', 'tree:0'])
  check('a sea bass from the jetty: named on the card, let go into the sea, jetty and new-kind tasks done', { card, done })
  await click('.fishing-hud button', '放回海里'); await sleep(800); await press('Escape', 'Escape'); await sleep(500)
  // Boarding still works from the mooring side.
  const mooring = await evaluate("({x:42.6,z:1.1})")
  await evaluate(`forestStore.getState().updatePosition(${mooring.x},${mooring.z})`); await sleep(800)
  const boardPrompt = await evaluate("document.querySelector('.interaction .action-button')?.textContent??''")
  assert(boardPrompt.includes('上船'), boardPrompt); check('boarding is still offered at the mooring', { boardPrompt })
  assert.deepEqual(report.errors, [])
  report.status = 'PASS'
} catch (e) {
  report.status = 'FAIL'; report.failure = e.stack ?? String(e); console.error(e); process.exitCode = 1
} finally {
  try { await writeFile(`${out}/report.json`, JSON.stringify(report, null, 2)) } finally { socket?.close(); await cleanup() }
}
