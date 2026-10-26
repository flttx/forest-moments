// Isolated headless Edge only. CDP pattern reused from my-blog/scripts/t10-gait-check.mjs.
// Campfire before/after views, live/reduced-motion shader checks and real fire interaction.

import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createHeadlessBrowser } from './browser-session.mjs'


const out = resolve(process.env.FOREST_QA_OUT ?? 'docs/evidence/2026-10-26-campfire/after')
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
  await cmd('Page.captureScreenshot', { format: 'png' });await sleep(250)
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
  await cmd('Page.navigate', { url: process.env.FOREST_URL??'http://127.0.0.1:5176/?qa&view=fireClose' })
  for (let i = 0; i < 400; i++) {
    const loaded = await evaluate("!!document.querySelector('canvas')&&!document.querySelector('.asset-loading')&&!document.querySelector('.world-error')")
    if (loaded && i > 10) break
    if (i === 399) throw Error('Assets failed to load')
    await sleep(200)
  }
  await evaluate("(async()=>{window.forestStore=(await import(performance.getEntriesByType('resource').find(e=>new URL(e.name).pathname==='/src/game/store.ts').name)).useForestStore})()")
  const press=async(code,key)=>{await cmd('Input.dispatchKeyEvent',{type:'keyDown',code,key});await cmd('Input.dispatchKeyEvent',{type:'keyUp',code,key})}
  await evaluate("forestStore.setState({position:{x:20,z:21.2},mode:'walking',location:'island'})");await sleep(250);await press('KeyF','f')
  assert.equal(await evaluate('forestStore.getState().homeBook.fireLit'),true)
  await evaluate("document.head.append(Object.assign(document.createElement('style'),{textContent:'.hud{display:none!important}'}))")
  for(const light of ['day','dusk','night'])for(const view of ['fireClose','fireSide','fireHigh','camp']){
    await evaluate(`history.replaceState(null,'','/?qa&view=${view}');forestStore.setState({timeOfDay:'${light}'})`);await sleep(750);await shot(`${light}-${view}`)
  }
  await evaluate("history.replaceState(null,'','/?qa&view=fireClose');forestStore.setState({timeOfDay:'night'})")
  for(let i=0;i<4;i++){await sleep(300);await shot(`motion-${i}`)}
  await press('KeyF','f');assert.equal(await evaluate('forestStore.getState().homeBook.fireLit'),false);await shot('night-off')
  await press('KeyF','f');assert.equal(await evaluate('forestStore.getState().homeBook.fireLit'),true)
  await cmd('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});await sleep(400);await shot('night-reduced')
  if(process.env.FOREST_FIRE_ASSERT==='1'){
    const get=()=>evaluate("(()=>{const g=forestScene.getObjectByName('Campfire_Effect'),f=g.getObjectByName('Campfire_Flame'),e=g.getObjectByName('Campfire_Embers'),l=g.children.find(x=>x.isPointLight);return{visible:g.visible,time:f.material.uniforms.time.value,sparks:e.visible,power:l.intensity,vertices:f.geometry.attributes.position.count,emberCount:e.geometry.attributes.position.count,raycast:f.raycast.toString()}})()")
    const still=await get();await sleep(600);const still2=await get();assert.equal(still.time,still2.time);assert.equal(still.power,still2.power);assert.equal(still.sparks,false)
    await cmd('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});await sleep(300)
    const a=await get();await sleep(700);const b=await get();assert(b.time>a.time);assert(b.sparks);assert.equal(b.vertices,12);assert.equal(b.emberCount,28)
    await press('KeyF','f');await sleep(200);assert.equal((await get()).visible,false)
    report.checks.push({name:'real F toggle, live shader, reduced-motion freeze and ember suppression',ok:true,still,live:b})
    await evaluate("(async()=>{window.journal=(await import(performance.getEntriesByType('resource').find(e=>new URL(e.name).pathname==='/src/game/journalStore.ts').name)).useJournalStore;journal.setState({book:{version:1,page:{number:1,tasks:['fireside','lookout','tree'].map(id=>({id,progress:0,doneAt:null}))},stamps:[]}})})()")
    await press('KeyF','f')
    await evaluate("(async()=>{const e=await import('/src/game/expansion.ts');forestStore.setState({position:e.seatOrigin(e.seats.find(s=>s.id==='camp-west'))})})()");await sleep(250);await press('KeyF','f')
    for(let i=0;i<200;i++){if(await evaluate('!!journal.getState().book.page.tasks[0].doneAt'))break;await sleep(100)}
    assert(await evaluate('!!journal.getState().book.page.tasks[0].doneAt'));await shot('fireside-journal-verified')
    await press('KeyF','f');await sleep(2600)
    await evaluate("forestStore.setState({position:{x:20,z:21.2}})");await sleep(200);await press('KeyF','f');assert.equal(await evaluate('forestStore.getState().homeBook.fireLit'),false)
    report.checks.push({name:'real fire lighting, seated eight seconds, journal completion, get up and extinguish',ok:true})
  }
  assert.deepEqual(report.errors,[]);report.status='PASS';console.log('PASS campfire captures and interaction',report.screenshots.length)
} catch(error){report.status='FAIL';report.failure=error.stack;console.error(error);process.exitCode=1} finally {try{await writeFile(`${out}/headless-validation.json`,JSON.stringify(report,null,2))}finally{socket?.close();await cleanup()}}
