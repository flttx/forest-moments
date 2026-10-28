// Isolated headless Edge only. CDP pattern reused from my-blog/scripts/t10-gait-check.mjs.
// Journal integration: real input, seeded task pages, persistence and layout. Capture mode preserves the pre-change UI.

import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createHeadlessBrowser } from './browser-session.mjs'


const out = resolve(process.env.FOREST_QA_OUT ?? 'docs/evidence/2026-10-26-journal/after')
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
  await cmd('Page.captureScreenshot', { format: 'png' }); await sleep(250)
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
  if(process.env.FOREST_JOURNAL_CAPTURE==='1')await cmd('Page.addScriptToEvaluateOnNewDocument',{source:`try{localStorage.setItem('forest-moments:journal:v1',JSON.stringify({version:1,page:{number:1,tasks:['lookout','seaside','tree'].map(id=>({id,progress:0,doneAt:null}))},stamps:[]}));localStorage.setItem('forest-moments:guide:v1','seen')}catch{}`})
  await cmd('Page.navigate', { url: process.env.FOREST_QA_URL??'http://127.0.0.1:5176/?qa' })
  for (let i = 0; i < 400; i++) {
    const loaded = await evaluate("!!document.querySelector('canvas')&&!document.querySelector('.asset-loading')&&!document.querySelector('.world-error')")
    if (loaded && i > 10) break
    if (i === 399) throw Error('Assets failed to load')
    await sleep(200)
  }
  if(process.env.FOREST_JOURNAL_CAPTURE==='1'){
    await evaluate("document.querySelector('.menu button[aria-controls]').click()")
    await sleep(1500);await shot('journal-production');report.status='CAPTURED'
  }else{
  const load = (p) => `(await import(performance.getEntriesByType('resource').find(e=>new URL(e.name).pathname==='${p}').name))`
  await evaluate(`(async()=>{window.forestStore=${load('/src/game/store.ts')}.useForestStore;window.uiStore=${load('/src/game/uiStore.ts')}.useUiStore;window.audio=${load('/src/audio/audioStore.ts')};window.fishing=${load('/src/game/fishing.ts')};window.workshop=${load('/src/game/workshop.ts')}})()`)
  const press = (type, code, key) => cmd('Input.dispatchKeyEvent', { type, code, key })
  const key = async (code, key) => { await press('keyDown', code, key); await press('keyUp', code, key) }
  const hold = async (code, key, ms) => { await press('keyDown', code, key); await sleep(ms); await press('keyUp', code, key) }
  const waitFor = async (expression) => { for (let i = 0; i < 700; i++) { if (await evaluate(expression)) return; await sleep(100) } throw Error('Condition timed out: ' + expression) }
  const results = {}
  const check = (name, ok, detail) => { report.checks.push({ name, ok, detail }); console.log(ok ? 'PASS' : 'FAIL', name, JSON.stringify(detail)); if (!ok) results.failed = true }

  await evaluate(`(async()=>{window.journal=${load('/src/game/journalStore.ts')}.useJournalStore;window.journalRules=${load('/src/game/journal.ts')};window.lang=${load('/src/i18n.ts')}.useLang})()`)
  await evaluate("forestStore.setState({position:{x:0,z:2},mode:'walking',timeOfDay:'day'});uiStore.getState().finishGuide();journal.setState({book:{version:1,page:{number:1,tasks:['lookout','seaside','tree'].map(id=>({id,progress:0,doneAt:null}))},stamps:[]}});uiStore.getState().openPanel('journal')")
  await sleep(1000);await shot('journal-current')
  {

    const click=async selector=>{
      const p=await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('Missing button');e.scrollIntoView({block:'nearest'});const r=e.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`)
      await cmd('Input.dispatchMouseEvent',{type:'mousePressed',...p,button:'left',clickCount:1});await cmd('Input.dispatchMouseEvent',{type:'mouseReleased',...p,button:'left',clickCount:1});await sleep(150)
    }
    const book=()=>evaluate('journal.getState().book')
    const done=id=>waitFor(`!!journal.getState().book.page.tasks.find(t=>t.id==='${id}')?.doneAt`)
    const point=async(x,z,location='island')=>{await evaluate(`forestStore.setState({position:{x:${x},z:${z}},location:'${location}'})`);await sleep(250)}
    const page=async ids=>{await evaluate(`journal.setState({book:{...journal.getState().book,page:{...journal.getState().book.page,tasks:${JSON.stringify(ids)}.map(id=>({id,progress:0,doneAt:null}))}}})`)}
    await evaluate(`(async()=>{window.expansion=await import('/src/game/expansion.ts');window.growth=await import('/src/game/growth.ts');window.journalWrites=0;const original=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k===journalRules.journalStorageKey)window.journalWrites++;return original.call(this,k,v)}})()`)
    await waitFor('forestStore.getState().lookoutReady&&forestStore.getState().growthReady&&forestStore.getState().homeReady&&forestStore.getState().boatReady')
    await key('Escape','Escape')
    await point(9.05,-29.85);await key('KeyF','f');await done('lookout')
    await waitFor("!forestStore.getState().lookoutTransfer");await shot('task-lookout');await key('Escape','Escape');await waitFor("forestStore.getState().mode==='walking'&&!forestStore.getState().lookoutTransfer")
    check('lookout task from F-key entry',true,null)
    await evaluate("forestStore.setState({position:expansion.seatOrigin(expansion.seats[0])})");await sleep(250);await key('KeyF','f');await done('seaside');await shot('task-seaside')
    await key('KeyF','f');await waitFor("forestStore.getState().mode==='walking'")
    check('seaside task after sitting animation',true,null)
    await point(0,8.9);await key('KeyF','f');await done('tree')
    check('tree task from actual planting',true,await book())
    await click('.menu button[aria-controls="menu-panel"]');await shot('first-page-full')
    await click('.journal-full .primary');assert.equal((await book()).page.number,2)
    await page(['fireside','sleep','row']);await key('Escape','Escape')
    // Begin a real fireside session, pause it in the journal, leave, then complete a fresh sitting.
    await point(20,21.2);await key('KeyF','f');assert.equal(await evaluate('forestStore.getState().homeBook.fireLit'),true)
    await evaluate("forestStore.setState({position:expansion.seatOrigin(expansion.seats.find(s=>s.id==='camp-west'))})");await sleep(250);await key('KeyF','f')
    await waitFor("journal.getState().book.page.tasks[0].progress>1")
    const writes=await evaluate('journalWrites')
    await click('.menu button[aria-controls="menu-panel"]');const paused=(await book()).page.tasks[0].progress
    await sleep(1200);assert.equal((await book()).page.tasks[0].progress,paused)
    await shot('fireside-paused');await key('Escape','Escape')
    assert.equal(await evaluate('forestStore.getState().mode'),'sitting')
    await key('KeyF','f');await waitFor("forestStore.getState().mode==='walking'")
    assert.equal((await book()).page.tasks[0].progress,0);assert.equal(await evaluate('journalWrites'),writes)
    await key('KeyF','f');await done('fireside');assert.equal(await evaluate('journalWrites'),writes+1)
    await shot('task-fireside');await key('KeyF','f');await waitFor("forestStore.getState().mode==='walking'")
    check('continuous fire task: pause, reset on leaving, no per-frame saves, complete on second sitting',true,{paused,writesBefore:writes,writesAfter:await evaluate('journalWrites')})
    await point(-15,-24.5);await key('KeyF','f');await waitFor("forestStore.getState().location==='bedroom'&&!forestStore.getState().homeTransfer")
    await point(-1,-.5,'bedroom');await key('KeyF','f');await waitFor("forestStore.getState().mode==='sleeping'");await shot('task-sleep');await key('Escape','Escape');await done('sleep')
    await point(0,2.5,'bedroom');await key('KeyF','f');await waitFor("forestStore.getState().location==='island'&&!forestStore.getState().homeTransfer")
    check('sleep task from bedroom rest and skip',true,null)
    // A short outing must not be combined with the next outing.
    await point(42.6,.8);await key('KeyF','f');await waitFor("forestStore.getState().mode==='rowing'&&!forestStore.getState().boatTransfer")
    await hold('KeyW','w',1400);assert((await book()).page.tasks[2].progress>0)
    await press('keyDown','KeyS','s');await waitFor('forestStore.getState().boat.x<42.7');await press('keyUp','KeyS','s')
    await waitFor("JSON.parse(document.querySelector('canvas').dataset.forestQa).canLand")
    await key('KeyF','f');await waitFor("forestStore.getState().mode==='walking'&&!forestStore.getState().boatTransfer")
    assert.equal((await book()).page.tasks[2].progress,0)
    await key('KeyF','f');await waitFor("forestStore.getState().mode==='rowing'&&!forestStore.getState().boatTransfer")
    await hold('KeyW','w',5000);await press('keyDown','KeyW','w');await press('keyDown','KeyD','d');await done('row');await press('keyUp','KeyW','w');await press('keyUp','KeyD','d')
    await shot('task-row');check('rowing 40 m in a single outing; prior outing reset',true,await book())
    await click('.menu button[aria-controls="menu-panel"]');await shot('second-page-full')
    await click('.journal-nav button:first-child');assert.equal(await evaluate("document.querySelector('.journal-page').textContent"),'第 1 页')
    assert.equal(await evaluate("document.querySelectorAll('.journal-tasks li.done').length"),3)
    assert.equal(await evaluate("document.activeElement.className"),'journal-page');await shot('history-page-one')
    await click('.journal-return');await click('.journal-full .primary');await page(['catch','keep','seaside']);await key('Escape','Escape')
    // Position setup is explicit; catch and tank credit are generated by real gameplay and UI clicks, never manual journal events.
    await evaluate("forestStore.setState({mode:'walking',boatTransfer:null,position:{...fishing.fishingSpot},location:'island',timeOfDay:'day'})");await sleep(250)
    await key('KeyF','f');await waitFor("forestStore.getState().fishing?.phase==='bite'");await key('KeyF','f');await waitFor("forestStore.getState().fishing?.phase==='reeling'")
    let held=false
    for(let i=0;i<600;i++){
      const f=await evaluate('forestStore.getState().fishing');if(f.phase!=='reeling')break
      const next=held?f.tension<.72:f.tension<.3
      if(next!==held){held=next;await press(held?'keyDown':'keyUp','Space',' ')}await sleep(50)
    }
    await press('keyUp','Space',' ');await done('catch');await shot('task-catch')
    const keep=await evaluate("[...document.querySelectorAll('.fishing-hud button')].find(b=>b.textContent==='放入鱼缸')?.outerHTML")
    assert(keep,'Catch result must offer keeping the fish')
    await evaluate("[...document.querySelectorAll('.fishing-hud button')].find(b=>b.textContent==='放入鱼缸').setAttribute('data-journal-keep','')")
    await click('[data-journal-keep]');await done('keep');await key('Escape','Escape')
    check('real catch and keep-in-tank tasks',true,{fish:await evaluate('forestStore.getState().homeBook.fish'),page:await book()})
    const saved=await evaluate('localStorage.getItem(journalRules.journalStorageKey)')
    await cmd('Page.reload');await sleep(1800);await waitFor("!!document.querySelector('.menu')&&!document.querySelector('.asset-loading')")
    await evaluate(`(async()=>{window.forestStore=${load('/src/game/store.ts')}.useForestStore;window.uiStore=${load('/src/game/uiStore.ts')}.useUiStore;window.journal=${load('/src/game/journalStore.ts')}.useJournalStore;window.lang=${load('/src/i18n.ts')}.useLang})()`)
    assert.deepEqual(await book(),JSON.parse(saved));check('reload preserves page, completions and full history',true,null)
    await click('.menu button[aria-controls="menu-panel"]')
    // Both languages, three sizes and three times of day; bounds and task text checked separately from screenshots.
    const layouts=[]
    for(const [width,height] of [[1920,1080],[1280,720],[1024,768]])for(const language of ['zh','en'])for(const light of ['day','dusk','night']){
      await cmd('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false})
      await evaluate(`lang.getState().setLang('${language}');forestStore.setState({timeOfDay:'${light}'})`);await sleep(400)
      const bounds=await evaluate(`(()=>{const names=['.brand','.menu','.menu-panel'],rects=names.map(n=>{const r=document.querySelector(n).getBoundingClientRect();return{x:r.x,y:r.y,right:r.right,bottom:r.bottom}});return{rects,overflow:document.querySelector('.panel-body').scrollWidth>document.querySelector('.panel-body').clientWidth+1}})()`)
      assert(bounds.rects.every(r=>r.x>=0&&r.y>=0&&r.right<=width+1&&r.bottom<=height+1),JSON.stringify(bounds))
      assert(bounds.rects[0].right<bounds.rects[1].x,'Title and toolbar overlap');assert(!bounds.overflow,'Horizontal panel overflow')
      layouts.push({width,height,language,light,...bounds});await shot(`layout-${width}-${language}-${light}`)
    }
    check('18 layouts: three sizes, two languages, three lighting states',true,layouts)
    await cmd('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false})
    for(const language of ['zh','en']){
      await evaluate(`uiStore.getState().closePanel();lang.getState().setLang('${language}');uiStore.setState({guideSeen:false});forestStore.setState({timeOfDay:'day'})`);await sleep(200)
      const overlap=await evaluate("(()=>{const a=document.querySelector('.guide').getBoundingClientRect(),b=document.querySelector('.menu').getBoundingClientRect();return a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top})()")
      assert(!overlap);await shot(`guide-${language}`)
    }
    check('first-run guide clears the expanded toolbar in both languages',true,null)
    await evaluate("uiStore.getState().finishGuide();lang.getState().setLang('zh')");await click('.menu button[aria-controls="menu-panel"]')
    // Legacy archive has only stamps. Exercise migration in the browser without fabricating history.
    await evaluate(`journal.setState({book:{...journal.getState().book,stamps:journal.getState().book.stamps.map(({page,stamp,doneAt})=>({page,stamp,doneAt}))}})`)
    await click('.stamp-row button:first-child');assert.equal(await evaluate("document.querySelectorAll('.journal-tasks li').length"),0)
    assert(await evaluate("!!document.querySelector('.journal-legacy')"));await shot('legacy-history')
    await click('.journal-return');await key('Escape','Escape')
    // A genuine seaside action must still finish after storage is denied, with a persistent error notice.
    await evaluate("Storage.prototype.setItem=function(){throw Error('blocked for journal QA')}")
    await point(-29,-10);await evaluate("(async()=>{const e=await import('/src/game/expansion.ts');forestStore.setState({position:e.seatOrigin(e.seats[0])})})()");await sleep(200)
    await key('KeyF','f');await done('seaside');assert.equal(await evaluate('forestStore.getState().messageKind'),'error')
    await sleep(4500);assert(await evaluate("!!document.querySelector('.notice-error')"));await shot('storage-failure')
    check('legacy stamps remain readable; denied storage keeps gameplay and persistent error',true,null)
    assert.ok(!results.failed,'Journal checks failed')

    report.status='PASS'
  }
  }
  assert.equal(report.errors.length,0,report.errors.join('\n'))
} catch(error){report.status='FAIL';report.failure=error.stack;console.error(error);process.exitCode=1} finally { try { await writeFile(`${out}/headless-validation.json`, JSON.stringify(report, null, 2)) } finally { socket?.close(); await cleanup() } }
