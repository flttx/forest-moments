// UI upgrade acceptance: real key/mouse input in isolated headless Edge (project .tmp profile, cleaned in finally).
import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createHeadlessBrowser } from './browser-session.mjs'

const out = resolve(process.env.FOREST_QA_OUT ?? 'docs/evidence/2026-10-25-ui-upgrade/after')
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
const shot = async (name) => { await sleep(250); const r = await cmd('Page.captureScreenshot', { format: 'png' }); await writeFile(`${out}/${name}.png`, Buffer.from(r.data, 'base64')); report.screenshots.push(`${name}.png`) }
const check = (name, detail = {}) => { report.checks.push({ name, ...detail }); console.log('PASS', name) }
const key = async (code, k, type) => cmd('Input.dispatchKeyEvent', { type, code, key: k, windowsVirtualKeyCode: k.length === 1 ? k.toUpperCase().charCodeAt(0) : k === 'Escape' ? 27 : 0 })
const press = async (code, k) => { await key(code, k, 'keyDown'); await key(code, k, 'keyUp') }
const click = async (selector) => {
  const box = await evaluate(`(()=>{const e=[...document.querySelectorAll(${JSON.stringify(selector.split('|')[0])})].find(b=>!${JSON.stringify(selector.split('|')[1] ?? '')}||b.textContent.includes(${JSON.stringify(selector.split('|')[1] ?? '')}));if(!e)return null;const r=e.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`)
  assert(box, 'Missing ' + selector)
  for (const type of ['mousePressed', 'mouseReleased']) await cmd('Input.dispatchMouseEvent', { type, x: box.x, y: box.y, button: 'left', buttons: type === 'mousePressed' ? 1 : 0, clickCount: 1 })
}
const state = (expr) => evaluate(`(()=>{const s=forestStore.getState();return ${expr}})()`)
const setState = (value) => evaluate(`forestStore.setState(${JSON.stringify(value)})`)
async function boot(width, height, fresh = false) {
  await cmd('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false })
  if (fresh) await evaluate('localStorage.clear()').catch(() => {})
  await cmd('Page.navigate', { url: `${base}?qa` })
  await sleep(500); await waitFor(ready, 'scene ready', 400); await sleep(1500)
  await evaluate(`(async()=>{const r=p=>performance.getEntriesByType('resource').find(e=>new URL(e.name).pathname===p).name;window.forestStore=(await import(r('/src/game/store.ts'))).useForestStore;window.uiStore=(await import(r('/src/game/uiStore.ts'))).useUiStore})()`)
}
/** Visible HUD rectangles must stay inside the viewport and not overlap each other. */
const layout = () => evaluate(`(()=>{const sel=['.brand','.menu','.paper-panel','.guide','.notice','.mode-hint','.interaction','.paper-card','.sleep-panel'];const rects=sel.flatMap(s=>[...document.querySelectorAll(s)].map(e=>({s,r:e.getBoundingClientRect()}))).filter(x=>x.r.width>0);const W=innerWidth,H=innerHeight,issues=[];
 for(const a of rects){if(a.r.left<0||a.r.top<0||a.r.right>W+.5||a.r.bottom>H+.5)issues.push('outside '+a.s)}
 for(let i=0;i<rects.length;i++)for(let j=i+1;j<rects.length;j++){const a=rects[i].r,b=rects[j].r;if(a.left<b.right&&b.left<a.right&&a.top<b.bottom&&b.top<a.bottom)issues.push(rects[i].s+' x '+rects[j].s)}
 const small=[...document.querySelectorAll('.hud button')].filter(b=>b.getBoundingClientRect().height>0&&b.getBoundingClientRect().height<35.5).length
 const tiny=[...document.querySelectorAll('.hud *')].filter(e=>e.childNodes.length&&[...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim())&&parseFloat(getComputedStyle(e).fontSize)<14&&e.tagName!=='KBD').map(e=>e.className||e.tagName)
 return{issues,small,tiny,count:rects.length}})()`)

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

  // FOREST_UI_PART=layout runs only the resolution/light layout sweep; repeated reloads in one tab can stall headless capture.
  const part = process.env.FOREST_UI_PART ?? 'interaction'
  if (part === 'interaction') {
  // 1. First visit: the guide appears once the scene is ready, folds away after 8 s, and stays away after reload.
  await boot(1440, 900, true)
  await waitFor("!!document.querySelector('.guide')", 'first-run guide visible after models report ready', 100)
  assert(await evaluate("!document.querySelector('.controls')&&!document.querySelector('.landmarks')&&!document.querySelector('.draft-flag')"), 'old standing panels removed')
  await shot('01-first-guide')
  await waitFor("!document.querySelector('.guide')", 'guide folds away', 120)
  assert.equal(await evaluate("localStorage.getItem('forest-moments:guide:v1')"), 'seen')
  await boot(1440, 900); assert(await evaluate("!document.querySelector('.guide')"), 'guide not repeated'); await shot('02-default')
  check('first-run guide shows once and folds away')

  // 2. Holding W while opening a menu: the raccoon stops, focus moves into the panel, Esc returns focus; W is not re-held.
  await key('KeyW', 'w', 'keyDown'); await sleep(600)
  const moving = await state('s.position'); await click('.menu button|地点'); await sleep(200)
  const a = await state('s.position'); await sleep(900); const b = await state('s.position')
  assert(Math.hypot(moving.x - a.x, moving.z - a.z) < 1, 'was walking'); assert(Math.hypot(a.x - b.x, a.z - b.z) < 1e-6, 'held W does not move behind panel')
  assert(await evaluate("document.querySelector('#menu-panel').contains(document.activeElement)"), 'focus inside panel')
  await shot('03-places-panel')
  await key('KeyW', 'w', 'keyUp'); await press('Escape', 'Escape'); await sleep(200)
  assert(await evaluate("!document.querySelector('#menu-panel')&&document.activeElement.textContent==='地点'"), 'Esc closes and returns focus')
  const c = await state('s.position'); await sleep(700); const d = await state('s.position')
  assert(Math.hypot(c.x - d.x, c.z - d.z) < 1e-6, 'W not re-held after close')
  check('held W + menu: pause, focus trap target, Esc restores focus without resuming movement')
  await click('.menu button|图鉴'); await sleep(200); assert(await evaluate("document.querySelector('#menu-panel').textContent.includes('已发现 0 / 5 种')")); await shot('04-fishbook-empty')
  await click('.menu button|帮助'); await sleep(200); await shot('05-help'); await press('Escape', 'Escape'); await sleep(150)
  check('fish book empty state and help panel')

  // 3. Prompt: a hint until the fishing spot, then F; a bite cannot expire behind the help panel; Esc there does not stow the rod.
  const spot = await evaluate("(async()=>(await import(performance.getEntriesByType('resource').find(e=>new URL(e.name).pathname==='/src/game/fishing.ts').name)).fishingSpot)()")
  await setState({ mode: 'walking', location: 'island', nearby: 'pond', position: { x: spot.x + 2.5, z: spot.z } }); await sleep(300)
  assert(await evaluate("document.querySelector('.interaction').textContent.includes('钓点')&&!document.querySelector('.interaction button')"), 'hint without a misleading button')
  await shot('06-prompt-hint'); await press('KeyF', 'f'); await sleep(200); assert.equal(await state('s.message'), '', 'F on a hint stays quiet')
  await setState({ position: spot }); await sleep(300)
  assert(await evaluate("document.querySelector('.interaction button').textContent.includes('抛竿钓鱼')")); await shot('07-prompt-action')
  await press('KeyF', 'f'); await waitFor("forestStore.getState().mode==='fishing'", 'fishing')
  await evaluate("forestStore.setState({fishing:{...forestStore.getState().fishing,phase:'bite',elapsed:0}})"); await sleep(300); await shot('08-fishing-bite')
  await click('.menu button|帮助'); await sleep(3200)
  assert.equal(await state('s.fishing.phase'), 'bite', 'bite frozen behind help'); await press('Escape', 'Escape'); await sleep(200)
  assert.equal(await state('s.mode'), 'fishing', 'Esc closed only the panel'); await press('KeyF', 'f'); await sleep(200)
  assert.equal(await state('s.fishing.phase'), 'reeling'); await shot('09-fishing-reeling')
  await press('Escape', 'Escape'); await sleep(200); assert.equal(await state('s.mode'), 'walking')
  check('fishing prompt, bite paused behind help, Esc closes only the top panel')

  // 4. Aquarium and menu panels replace each other; ordinary notices fade; errors wait to be closed.
  const tank = await evaluate("(async()=>(await import(performance.getEntriesByType('resource').find(e=>new URL(e.name).pathname==='/src/game/expansion.ts').name)).tankSpot)()")
  await setState({ location: 'bedroom', nearby: 'bedroom', position: { x: 0, z: 0 }, homeReady: true }); await sleep(400)
  assert(await evaluate("!document.querySelector('.interaction')"), 'no standing bedroom guidance away from furniture')
  await setState({ location: 'bedroom', nearby: 'bedroom', position: tank, homeReady: true }); await sleep(400); await press('KeyF', 'f'); await sleep(300)
  assert(await evaluate("!!document.querySelector('[aria-label=卧室鱼缸]')")); await shot('10-aquarium')
  await click('.menu button|帮助'); await sleep(200); assert.equal(await state('s.aquariumOpen'), false); assert(await evaluate("!!document.querySelector('#menu-panel')"))
  await press('Escape', 'Escape'); await sleep(200); assert(await evaluate("!document.querySelector('#menu-panel')"))
  check('aquarium and menu are mutually exclusive')
  await setState({ location: 'island', nearby: 'campfire', position: { x: 20, z: 23 } }); await sleep(300); await press('KeyF', 'f'); await sleep(300)
  assert(await evaluate("!!document.querySelector('.notice:not(.notice-error)')")); await shot('11-notice'); await sleep(4400)
  assert(await evaluate("!document.querySelector('.notice')"), 'ordinary notice fades after 4 s')
  await evaluate("Storage.prototype.setItem=()=>{throw Error('blocked')}"); await press('KeyF', 'f'); await sleep(5000)
  assert(await evaluate("!!document.querySelector('.notice-error')"), 'error stays'); await shot('12-notice-error')
  await click('.notice button'); await sleep(200); assert(await evaluate("!document.querySelector('.notice')"))
  check('notice lifetime: info fades, error stays until closed')

  // 5. Sleep: only the period title and skip.
  await boot(1440, 900)
  const bed = await evaluate("(async()=>(await import(performance.getEntriesByType('resource').find(e=>new URL(e.name).pathname==='/src/game/expansion.ts').name)).bedSpot)()")
  await setState({ location: 'bedroom', nearby: 'bedroom', position: bed, homeReady: true, timeOfDay: 'day' }); await sleep(300); await press('KeyF', 'f'); await sleep(1500)
  assert(await evaluate("document.querySelector('.sleep-panel').textContent==='日落跳过'&&!document.querySelector('.menu')")); await shot('13-sleep')
  await click('.sleep-panel button'); await sleep(400); assert.equal(await state('s.mode'), 'walking')
  check('sleep panel shows only title and skip; menu hidden')

  }
  if (part === 'layout') {
  let spot
  // 6. Layout at three resolutions, three lights, and the island overview.
  const layouts = {}
  for (const [w, h] of [[1920, 1080], [1280, 720], [1024, 768]]) {
    await boot(w, h)
    spot ??= await evaluate("(async()=>(await import(performance.getEntriesByType('resource').find(e=>new URL(e.name).pathname==='/src/game/fishing.ts').name)).fishingSpot)()")
    for (const light of ['day', 'dusk', 'night']) { await setState({ timeOfDay: light }); await sleep(900); layouts[`${w}x${h}-${light}`] = await layout(); await shot(`20-${w}x${h}-${light}`) }
    await click('.menu button|地点'); await sleep(300); layouts[`${w}x${h}-panel`] = await layout(); await shot(`21-${w}x${h}-places`); await press('Escape', 'Escape')
    await setState({ mode: 'fishing', nearby: 'pond', position: spot, fishing: { phase: 'reeling', elapsed: 0, wait: 3, sizeCm: 24, progress: .4, tension: .8, held: false, paused: false, reason: '' } }); await sleep(400)
    layouts[`${w}x${h}-fishing`] = await layout(); await shot(`22-${w}x${h}-fishing`); await press('Escape', 'Escape')
  }
  await boot(1440, 900); for (let i = 0; i < 24; i++) await cmd('Input.dispatchMouseEvent', { type: 'mouseWheel', x: 720, y: 450, deltaX: 0, deltaY: 300 })
  await sleep(1800); layouts.overview = await layout(); await shot('23-overview')
  for (const [name, l] of Object.entries(layouts)) { assert.deepEqual(l.issues, [], name + ' ' + l.issues.join(', ')); assert.equal(l.small, 0, name + ' buttons under 36px'); assert.deepEqual(l.tiny, [], name + ' text under 14px') }
  check('no overlap or overflow; buttons >= 36 px; text >= 14 px', { layouts })
  }

  assert.equal(report.errors.length, 0, report.errors.join('\n'))
  report.status = 'PASS'
} catch (error) { report.status = 'FAIL'; report.failure = String(error); process.exitCode = 1; console.error(error) }
finally { try { await writeFile(`${out}/headless-validation.json`, JSON.stringify(report, null, 2)); console.log(report.status) } finally { socket?.close(); await cleanup() } }
