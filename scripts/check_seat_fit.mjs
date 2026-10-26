// Isolated headless Edge only. CDP pattern reused from my-blog/scripts/t10-gait-check.mjs.
// Real keyboard sit/stand, all five benches, repeatable contact views and measurements.

import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createHeadlessBrowser } from './browser-session.mjs'


const out = resolve(process.env.FOREST_QA_OUT ?? 'docs/evidence/2026-10-26-seat-fit/before')
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
  const waitFor=async(expression)=>{for(let i=0;i<250;i++){if(await evaluate(expression))return;await sleep(100)}throw Error('Timed out: '+expression)}
  await evaluate("(async()=>{window.expansion=await import('/src/game/expansion.ts');window.THREE=await import('/node_modules/.vite/deps/three.js');document.head.append(Object.assign(document.createElement('style'),{textContent:'.hud{display:none!important}'}))})()")
  for(const id of (process.env.SEAT_IDS??'camp-west,camp-south,camp-east,coast,reef').split(',')){
    await evaluate(`(()=>{const seat=expansion.seats.find(s=>s.id==='${id}');forestStore.setState({mode:'walking',sitting:null,location:'island',position:expansion.seatOrigin(seat),timeOfDay:'day'})})()`)
    await sleep(200);await press('KeyF','f')
    const contacts=[]
    const measure=async()=>evaluate(`(async()=>{const {auditSeatContact}=await import('/scripts/seat-contact-audit.js');return auditSeatContact(THREE,forestScene,expansion.seats.find(s=>s.id==='${id}'))})()`)
    if(process.env.SEAT_TRANSITIONS==='1'){
      await waitFor("forestStore.getState().sitting?.elapsed>.85")
      await evaluate("forestStore.setState({menuPaused:true});history.replaceState(null,'','/?qa&view=seatSide')");await sleep(150);await shot(`${id}-down`)
      contacts.push({phase:'down',elapsed:await evaluate('forestStore.getState().sitting.elapsed'),contact:await measure()});await evaluate('forestStore.setState({menuPaused:false})')
    }
    await waitFor("forestStore.getState().sitting?.phase==='idle'");await sleep(300)
    assert.equal(await evaluate('forestStore.getState().sitting?.id'),id)
    for(const view of ['seatFront','seatSide','seatRear']){await evaluate(`history.replaceState(null,'','/?qa&view=${view}')`);await sleep(400);await shot(`${id}-${view}`)}
    const measurement=await evaluate(`(()=>{
      const seat=expansion.seats.find(s=>s.id==='${id}'),r=forestScene.getObjectByName('asset-raccoon'),benches=[];
      forestScene.updateMatrixWorld(true);forestScene.traverse(o=>{if(o.name==='expansion-low-bench')benches.push(o)});
      const b=benches.find(o=>Math.hypot(o.position.x-seat.x,o.position.z-seat.z)<.1);
      const box=new THREE.Box3().setFromObject(b),bones=[],parts=[];
      r.traverse(o=>{if(o.isBone&&/Hips|UpLeg|Tail|Foot/i.test(o.name))bones.push({name:o.name,p:o.getWorldPosition(new THREE.Vector3()).toArray()});if(o.isSkinnedMesh)parts.push({name:o.name,vertices:o.geometry.attributes.position.count})});
      return{seat,root:r.parent.position.toArray(),benchBounds:{min:box.min.toArray(),max:box.max.toArray()},bones,parts};
    })()`)
    const contact=await measure();contacts.push({phase:'idle',contact})
    if(id==='camp-west'&&process.env.SEAT_TRANSITIONS==='1')for(const light of ['dusk','night']){await evaluate(`forestStore.setState({timeOfDay:'${light}'});history.replaceState(null,'','/?qa&view=seatFront')`);await sleep(350);await shot(`${id}-${light}`)}
    await press('KeyF','f')
    if(process.env.SEAT_TRANSITIONS==='1'){
      await waitFor("forestStore.getState().sitting?.elapsed>.85")
      await evaluate("forestStore.setState({menuPaused:true,timeOfDay:'day'});history.replaceState(null,'','/?qa&view=seatSide')");await sleep(150);await shot(`${id}-up`)
      contacts.push({phase:'up',elapsed:await evaluate('forestStore.getState().sitting.elapsed'),contact:await measure()});await evaluate('forestStore.setState({menuPaused:false})')
    }
    await waitFor("forestStore.getState().mode==='walking'")
    report.checks.push({id,measurement,contact,contacts,ok:true})
    if(process.env.SEAT_ASSERT==='1')for(const c of contacts){assert(c.contact.maxDepth<.01,`${id} ${c.phase}: penetration ${c.contact.maxDepth}`)}
  }
  assert.deepEqual(report.errors,[]);report.status='PASS';console.log('PASS seat captures',report.screenshots.length)
} catch(error){report.status='FAIL';report.failure=error.stack;console.error(error);process.exitCode=1} finally {try{await writeFile(`${out}/headless-validation.json`,JSON.stringify(report,null,2))}finally{socket?.close();await cleanup()}}
