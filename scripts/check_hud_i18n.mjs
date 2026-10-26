// HUD hide toggle, zh/en switch and restyled HUD: real key/mouse input in isolated headless Edge (project .tmp profile, cleaned in finally).
import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createHeadlessBrowser } from './browser-session.mjs'

const out = resolve(process.env.FOREST_QA_OUT ?? 'docs/evidence/2026-10-26-hud-i18n/after')
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
const keyCode = (k) => k.length === 1 ? k.toUpperCase().charCodeAt(0) : k === 'Escape' ? 27 : 0
const press = async (code, k) => { for (const type of ['keyDown', 'keyUp']) await cmd('Input.dispatchKeyEvent', { type, code, key: k, windowsVirtualKeyCode: keyCode(k) }) }
const centre = (selector, text = '') => evaluate(`(()=>{const e=[...document.querySelectorAll(${JSON.stringify(selector)})].find(b=>!${JSON.stringify(text)}||b.textContent.includes(${JSON.stringify(text)}));if(!e)return null;const r=e.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`)
const click = async (selector, text = '') => {
  const box = await centre(selector, text); assert(box, `Missing ${selector} ${text}`)
  for (const type of ['mousePressed', 'mouseReleased']) await cmd('Input.dispatchMouseEvent', { type, x: box.x, y: box.y, button: 'left', buttons: type === 'mousePressed' ? 1 : 0, clickCount: 1 })
}
const hover = async (selector, text = '') => { const box = await centre(selector, text); assert(box, `Missing ${selector} ${text}`); await cmd('Input.dispatchMouseEvent', { type: 'mouseMoved', x: box.x, y: box.y }) }
const state = (expr) => evaluate(`(()=>{const s=forestStore.getState(),u=uiStore.getState();return ${expr}})()`)
const setState = (value) => evaluate(`forestStore.setState(${JSON.stringify(value)})`)
const text = (selector) => evaluate(`document.querySelector(${JSON.stringify(selector)})?.textContent??null`)
async function boot(width, height, fresh = false) {
  await cmd('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false })
  if (fresh) await evaluate('localStorage.clear()').catch(() => {})
  await cmd('Page.navigate', { url: `${base}?qa` })
  await sleep(500); await waitFor(ready, 'scene ready', 400); await sleep(1500)
  await evaluate(`(async()=>{const r=p=>performance.getEntriesByType('resource').find(e=>new URL(e.name).pathname===p).name;window.forestStore=(await import(r('/src/game/store.ts'))).useForestStore;window.uiStore=(await import(r('/src/game/uiStore.ts'))).useUiStore;window.fishingSpot=(await import(r('/src/game/fishing.ts'))).fishingSpot})()`)
}
/** Visible HUD rectangles stay inside the viewport and apart; buttons keep a 36 px target and text stays at 14 px or more. */
const layout = () => evaluate(`(()=>{const sel=['.brand','.menu','.show-hud','.paper-panel','.guide','.notice','.mode-hint','.interaction','.paper-card','.sleep-panel'];const rects=sel.flatMap(s=>[...document.querySelectorAll(s)].map(e=>({s,r:e.getBoundingClientRect()}))).filter(x=>x.r.width>0&&getComputedStyle(document.querySelector(x.s)).display!=='none');const W=innerWidth,H=innerHeight,issues=[];
 for(const a of rects){if(a.r.left<0||a.r.top<0||a.r.right>W+.5||a.r.bottom>H+.5)issues.push('outside '+a.s)}
 for(let i=0;i<rects.length;i++)for(let j=i+1;j<rects.length;j++){const a=rects[i].r,b=rects[j].r;if(a.left<b.right&&b.left<a.right&&a.top<b.bottom&&b.top<a.bottom)issues.push(rects[i].s+' x '+rects[j].s)}
 const small=[...document.querySelectorAll('.hud button')].filter(b=>b.getBoundingClientRect().height>0&&b.getBoundingClientRect().height<35.5).map(b=>b.className)
 const tiny=[...document.querySelectorAll('.hud *')].filter(e=>e.childNodes.length&&[...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim())&&parseFloat(getComputedStyle(e).fontSize)<14&&e.tagName!=='KBD').map(e=>e.className||e.tagName)
 return{issues,small,tiny,count:rects.length}})()`)
const assertLayout = async (label) => { const l = await layout(); assert.deepEqual([l.issues, l.small, l.tiny], [[], [], []], `${label}: ${JSON.stringify(l)}`); check(`layout ${label}`, l) }

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

  // 1. Fresh visit: Chinese by default, the title is lettering in the display face with no card behind it.
  await boot(1440, 900, true)
  assert.equal(await evaluate('document.documentElement.lang'), 'zh-CN'); assert.equal(await text('.brand'), '森林拾光')
  await evaluate('document.fonts.ready')
  const brand = await evaluate(`(()=>{const c=getComputedStyle(document.querySelector('.brand'));return{bg:c.backgroundColor,border:c.borderTopStyle,family:c.fontFamily,loaded:document.fonts.check('500 27px "LXGW WenKai UI"','森林拾光')}})()`)
  assert.equal(brand.bg, 'rgba(0, 0, 0, 0)'); assert.equal(brand.border, 'none'); assert(brand.family.startsWith('"LXGW WenKai UI"')); assert(brand.loaded)
  check('Chinese default; title uses the subset display face without a box', brand)
  await shot('01-default-zh')
  await waitFor("!document.querySelector('.guide')", 'guide folds away', 120)
  await hover('.menu button', '鱼簿'); await shot('02-hover-zh')
  await click('.menu button', '地点'); await sleep(250)
  assert(await evaluate("!!document.querySelector('#menu-panel')&&document.querySelector('.menu button[aria-expanded=true]').textContent==='地点'"))
  assert.equal(await state('s.menuPaused'), true)
  await assertLayout('1440 places zh'); await shot('03-places-zh')
  await press('Escape', 'Escape'); await sleep(150)

  // 2. Switch to English: every visible label, the page language and title change together.
  await click('.menu .lang-switch'); await sleep(250)
  assert.equal(await evaluate('document.documentElement.lang'), 'en'); assert.equal(await text('.brand'), 'Forest Moments')
  assert.deepEqual(await evaluate("[...document.querySelectorAll('.menu .tool-label')].map(e=>e.textContent)"), ['Places', 'Fish log', 'Help'])
  assert.equal(await evaluate('document.title'), 'Forest Moments · 森林拾光')
  check('switches to English and updates page language and title')
  await shot('04-default-en')
  await click('.menu button', 'Places'); await sleep(250); await assertLayout('1440 places en'); await shot('05-places-en'); await press('Escape', 'Escape')
  await click('.menu button', 'Help'); await sleep(250); assert(await evaluate("document.querySelector('#menu-panel').textContent.includes('Hide / show interface')")); await shot('06-help-en'); await press('Escape', 'Escape')

  // 3. H hides everything but a restore button; errors still surface; H again restores.
  await press('KeyH', 'h'); await sleep(200)
  assert(await evaluate("!document.querySelector('.menu')&&!document.querySelector('.brand')&&!!document.querySelector('.show-hud')"))
  await shot('07-hidden')
  await setState({ message: 'info while hidden', messageKind: 'info' }); await sleep(100); assert(await evaluate("!document.querySelector('.notice')"))
  await setState({ message: 'Saving failed (test)', messageKind: 'error' }); await sleep(100); assert(await evaluate("!!document.querySelector('.notice-error')"))
  await shot('08-hidden-error'); await click('.notice button'); await sleep(100)
  await click('.show-hud'); await sleep(200); assert(await evaluate("!!document.querySelector('.menu')&&!document.querySelector('.show-hud')"))
  check('H and the restore button toggle the photo view; errors stay visible while hidden')

  // 4. The prompt and a running game's card, in English; the card stays when the HUD is hidden.
  await evaluate('forestStore.setState({nearby:"pond",position:{...fishingSpot}})'); await sleep(300)
  assert.equal(await evaluate("document.querySelector('.interaction .action-button')?.textContent"), 'FCast a line')
  await shot('09-prompt-en')
  await press('KeyF', 'f'); await waitFor("!!document.querySelector('.fishing-hud')", 'fishing card', 60)
  await sleep(600); await shot('10-fishing-en')
  await press('KeyH', 'h'); await sleep(200); assert(await evaluate("!!document.querySelector('.fishing-hud')&&!document.querySelector('.menu')"))
  await shot('11-hidden-fishing'); await press('KeyH', 'h'); await press('Escape', 'Escape'); await sleep(200)
  check('prompt and fishing card translated; the card survives the photo view')

  // 5. The choice survives a reload; night contrast; back to Chinese.
  await boot(1440, 900); assert.equal(await text('.brand'), 'Forest Moments'); check('language remembered after reload')
  await setState({ timeOfDay: 'night' }); await sleep(1500); await shot('12-night-en')
  await click('.menu .lang-switch'); await sleep(250); assert.equal(await text('.brand'), '森林拾光')
  await shot('13-night-zh'); await setState({ timeOfDay: 'day' })

  // 6. Phone width: icons only in the toolbar, nothing overlaps.
  await boot(390, 844)
  await assertLayout('390 default'); await shot('14-mobile-zh')
  await click('.menu button[aria-controls]'); await sleep(250); await assertLayout('390 places'); await shot('15-mobile-places'); await press('Escape', 'Escape')

  assert.deepEqual(report.errors, [])
  report.status = 'PASS'
} catch (e) {
  report.status = 'FAIL'; report.failure = e.stack ?? String(e); console.error(e); process.exitCode = 1
} finally {
  try { await writeFile(`${out}/report.json`, JSON.stringify(report, null, 2)) } finally { socket?.close(); await cleanup() }
}
