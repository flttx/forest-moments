// Photo mode (plan P2): filters and frames, unlocks by journal pages, frame composition, low-quality depth. Real keys/mouse in isolated headless Edge.
import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createHeadlessBrowser } from './browser-session.mjs'

const out = resolve(process.env.FOREST_QA_OUT ?? 'docs/evidence/2026-10-27-photo/looks')
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
  await evaluate(`(async()=>{const r=p=>performance.getEntriesByType('resource').find(e=>new URL(e.name).pathname===p).name;window.forestStore=(await import(r('/src/game/store.ts'))).useForestStore;window.uiStore=(await import(r('/src/game/uiStore.ts'))).useUiStore;window.photoStore=(await import(r('/src/game/photoStore.ts'))).usePhotoStore;window.journalStore=(await import(r('/src/game/journalStore.ts'))).useJournalStore;window.photoAlbum=await import(r('/src/game/photoAlbum.ts'))})()`)
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
  const photo = (expr) => evaluate(`(()=>{const p=photoStore.getState(),s=forestStore.getState();return ${expr}})()`)
  // Mean luminance, saturation and local contrast of the last photo; frames are measured separately.
  const measure = () => evaluate(`(async()=>{const img=document.querySelector('.photo-last img');const b=await (await fetch(img.src)).blob();const bm=await createImageBitmap(b);const c=document.createElement('canvas');c.width=bm.width;c.height=bm.height;const g=c.getContext('2d');g.drawImage(bm,0,0);const d=g.getImageData(0,0,c.width,c.height).data;let l=0,sat=0,n=0,grain=0;for(let i=0;i<d.length-8;i+=4*13){const r=d[i],gg=d[i+1],bb=d[i+2],mx=Math.max(r,gg,bb),mn=Math.min(r,gg,bb);l+=(r+gg+bb)/3;sat+=mx?(mx-mn)/mx:0;grain+=Math.abs(d[i]-d[i+4]);n++}return{w:bm.width,h:bm.height,lum:l/n,sat:sat/n,grain:grain/n}})()`)
  // Clear the previous preview first, so the measurement waits for this shot rather than reading the last one.
  const snap = async () => { await evaluate("photoStore.setState({last:null})"); await press('Space', ' '); await waitFor("!!document.querySelector('.photo-last img')", 'preview', 100); await sleep(900); return measure() }
  const setPages = (n) => evaluate(`journalStore.setState(s=>({book:{...s.book,stamps:Array.from({length:${n}},(_,i)=>({page:i+1,stamp:['pine','koi','flame','feather','boat','moon'][i%6],doneAt:new Date().toISOString()}))}}))`)

  await boot(1440, 900, true)
  await evaluate('indexedDB.deleteDatabase("forest-moments:photos:v1")'); await sleep(300)
  await waitFor("!document.querySelector('.guide')", 'guide folds away', 120)
  // Filters and frames fold away behind one button in the strip.
  await press('KeyP', 'p'); await sleep(600); await click('.photo-bar button', '滤镜与相框'); await sleep(300)

  // 1. Locks: with no pages only natural, warm and no frame are open; clicking a locked look changes nothing.
  const lock = () => evaluate("[...document.querySelectorAll('.photo-styles button')].map(b=>b.textContent+':'+(b.getAttribute('aria-disabled')==='true'?'L':'o'))")
  assert.deepEqual(await lock(), ['原色:o', '暖阳:o', '景深:L', '胶片:L', '黑白:L', '夜灯:L', '无相框:o', '纸边:L', '印章:L'])
  await click('.photo-styles button', '黑白'); await sleep(200); assert.equal(await photo('p.filter'), 'plain')
  assert(await evaluate("document.querySelector('.photo-styles button[aria-disabled=true]').title.includes('手账写满')"))
  check('locked looks are marked, explain how to unlock, and cannot be selected', { locks: await lock() }); await shot('01-locked')

  // 2. Unlock thresholds follow the plan: 2 depth, 4 film, 6 paper, 8 mono, 10 lamp, 12 stamps.
  for (const [pages, open] of [[2, ['原色', '暖阳', '景深', '无相框']], [4, ['原色', '暖阳', '景深', '胶片', '无相框']], [6, ['原色', '暖阳', '景深', '胶片', '无相框', '纸边']], [8, ['原色', '暖阳', '景深', '胶片', '黑白', '无相框', '纸边']], [10, ['原色', '暖阳', '景深', '胶片', '黑白', '夜灯', '无相框', '纸边']], [12, ['原色', '暖阳', '景深', '胶片', '黑白', '夜灯', '无相框', '纸边', '印章']]]) {
    await setPages(pages); await sleep(250)
    const got = (await lock()).filter((x) => x.endsWith(':o')).map((x) => x.split(':')[0])
    // On the low tier depth stays greyed out even when unlocked.
    const low = await evaluate('photoStore.getState().lowQuality')
    assert.deepEqual(got, low ? open.filter((x) => x !== '景深') : open, `pages ${pages}`)
  }
  check('unlock thresholds: 2 depth, 4 film, 6 paper frame, 8 mono, 10 lamplight, 12 stamp frame')

  // 3. Each filter changes the picture the way it says (same camera, same light).
  const stats = {}
  const lowTier = await evaluate('photoStore.getState().lowQuality')
  for (const [id, label] of [['plain', '原色'], ['warm', '暖阳'], ['depth', '景深'], ['film', '胶片'], ['mono', '黑白']]) {
    if (id === 'depth' && lowTier) continue
    await click('.photo-styles button', label); await sleep(900); assert.equal(await photo('p.filter'), id)
    stats[id] = await snap(); await shot(`02-filter-${id}`); await sleep(1100)
  }
  await click('.photo-bar button', '夜晚'); await sleep(1200)
  await click('.photo-styles button', '原色'); await sleep(700); stats.nightPlain = await snap(); await sleep(1100)
  await click('.photo-styles button', '夜灯'); await sleep(900); stats.lamp = await snap(); await shot('02-filter-lamp'); await sleep(1100)
  await click('.photo-bar button', '白天'); await sleep(1000)
  assert(stats.mono.sat < 0.02, 'mono is grey: ' + stats.mono.sat)
  assert(stats.warm.sat !== stats.plain.sat && stats.warm.lum !== stats.plain.lum, 'warm differs')
  assert(stats.film.grain > stats.plain.grain * 1.05, `film grain ${stats.film.grain} vs ${stats.plain.grain}`)
  assert(stats.film.sat < stats.plain.sat, 'film is slightly desaturated')
  // On a busy machine the renderer may drop to its low tier, where depth of field is off by design.
  if (lowTier) report.notes = ['renderer on low tier during this run: depth of field off, not measured']
  else assert(stats.depth.grain < stats.plain.grain, `depth softens ${stats.depth.grain} vs ${stats.plain.grain}`)
  assert(stats.lamp.lum > stats.nightPlain.lum, `lamplight brightens night ${stats.lamp.lum} vs ${stats.nightPlain.lum}`)
  check('filters measurably change the picture', stats)

  // 4. Frames: paper mount is larger than the canvas with a footer; stamp frame draws earned stamps.
  await click('.photo-styles button', '原色'); await click('.photo-styles button', '纸边'); await sleep(300)
  const framed = await snap(); const canvasSize = await evaluate("(()=>{const c=document.querySelector('canvas');return[c.width,c.height]})()")
  assert(framed.w === canvasSize[0] + 2 * Math.round(Math.min(...canvasSize) * 0.04) && framed.h > canvasSize[1], JSON.stringify({ framed, canvasSize }))
  await shot('03-frame-paper'); await sleep(1100)
  const dl = await evaluate("document.querySelector('.photo-last a').download"); assert(/\.png$/.test(dl))
  await click('.photo-styles button', '印章'); await sleep(300)
  const stamped = await snap(); assert.equal(stamped.w, framed.w)
  await evaluate("document.querySelector('.photo-last img').scrollIntoView()"); await shot('04-frame-stamps')
  const stored = await evaluate("photoAlbum.listPhotos().then(l=>l.map(r=>r.width+'x'+r.height))"); assert(stored.length >= 2)
  check('paper and stamp frames mount the saved photo with a caption footer; album keeps the framed image', { framed, stamped, canvasSize })

  // 5. Leaving resets looks; low quality never renders depth of field.
  await press('Escape', 'Escape'); await sleep(400)
  assert.deepEqual(await photo('[p.filter,p.frame]'), ['plain', 'none']); check('leaving the camera resets filter and frame')
  await cmd('Page.navigate', { url: `${base}?qa&quality=low` }); await sleep(800); await waitFor(ready, 'scene ready', 400); await sleep(1500)
  await evaluate(`(async()=>{const r=p=>performance.getEntriesByType('resource').find(e=>new URL(e.name).pathname===p).name;window.photoStore=(await import(r('/src/game/photoStore.ts'))).usePhotoStore;window.journalStore=(await import(r('/src/game/journalStore.ts'))).useJournalStore})()`)
  await setPages(2); await press('KeyP', 'p'); await sleep(500); await click('.photo-bar button', '滤镜与相框'); await sleep(300); await click('.photo-styles button', '景深'); await sleep(900)
  const pass = await evaluate("({filter:photoStore.getState().filter,low:photoStore.getState().lowQuality,title:[...document.querySelectorAll('.photo-styles button')].find(b=>b.textContent==='景深')?.title,disabled:[...document.querySelectorAll('.photo-styles button')].find(b=>b.textContent==='景深')?.getAttribute('aria-disabled')})")
  assert.deepEqual([pass.filter, pass.low, pass.disabled], ['plain', true, 'true']); assert(pass.title.includes('低画质'), JSON.stringify(pass)); await shot('05-low-quality-depth')
  check('on low quality the depth chip is greyed out with the reason and cannot be chosen', pass)

  assert.deepEqual(report.errors, [])
  report.status = 'PASS'
} catch (e) {
  report.status = 'FAIL'; report.failure = e.stack ?? String(e); console.error(e); process.exitCode = 1
} finally {
  try { await writeFile(`${out}/report.json`, JSON.stringify(report, null, 2)) } finally { socket?.close(); await cleanup() }
}
