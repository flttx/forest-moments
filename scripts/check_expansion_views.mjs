// Isolated headless Edge only. CDP pattern reused from my-blog/scripts/t10-gait-check.mjs.
import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createHeadlessBrowser } from './browser-session.mjs'

const out = resolve(process.env.FOREST_QA_OUT ?? 'docs/evidence/2026-10-25-expansion/final')
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
  await cmd('Page.enable'); await cmd('Runtime.enable'); await cmd('Page.bringToFront'); await cmd('Emulation.setFocusEmulationEnabled',{enabled:true})
  await cmd('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })
  await cmd('Page.navigate', { url: 'http://127.0.0.1:5176/?qa' })

  for(let i=0;i<400;i++) {
    const loaded=await evaluate("!!document.querySelector('canvas')&&!document.querySelector('.asset-loading')&&!document.querySelector('.world-error')")
    if(loaded && i>10)break
    if(i===399)throw Error('Production assets failed to load')
    await sleep(200)
  }


  await evaluate(`(async()=>{window.forestStore=(await import(performance.getEntriesByType('resource').find(e=>new URL(e.name).pathname==='/src/game/store.ts').name)).useForestStore})()`)
  const qa=()=>evaluate("JSON.parse(document.querySelector('canvas').dataset.forestQa)")
  const key=async(code,key)=>{await cmd('Input.dispatchKeyEvent',{type:'keyDown',code,key});await cmd('Input.dispatchKeyEvent',{type:'keyUp',code,key})}
  const waitFor=async(expression)=>{for(let i=0;i<240;i++){if(await evaluate(expression))return;await sleep(100)}throw Error('Condition timed out: '+expression)}
  const fixture=async(view,state)=>{await evaluate(`history.replaceState(null,'','/?qa&view=${view}');forestStore.setState(${JSON.stringify({mode:'walking',sitting:null,homeTransfer:null,workshopTransfer:null,craft:null,aquariumOpen:false,nearby:null,...state})})`);await sleep(1000)}
  const record=async(name)=>{await shot(name);report.checks.push({name,qa:await qa()})}
  for(const view of ['fullIsland','stream','cabin','camp','reef','bedroom','tank']){
    await fixture(view,{location:['bedroom','tank'].includes(view)?'bedroom':'island',position:{x:0,z:1.5}})
    await record(view)
  }
  await fixture('cabin',{location:'island',position:{x:-15,z:-24.5}});await key('KeyF','f');await waitFor("forestStore.getState().location==='bedroom'&&!forestStore.getState().homeTransfer");report.checks.push({name:'door-enter',qa:await qa()})
  await fixture('bedroom',{location:'bedroom',position:{x:-1,z:-.5},timeOfDay:'night'});await key('KeyF','f');await sleep(700);await record('sleeping');await waitFor("forestStore.getState().mode==='walking'");assert.equal((await qa()).homeBook.nights,1);assert.equal((await qa()).timeOfDay,'day')
  const fish={at:'2026-10-25T02:00:00Z',sizeCm:26}
  await fixture('tank',{location:'bedroom',position:{x:2,z:-.3},fishBook:{count:1,bestCm:26,recent:[fish]}});await key('KeyF','f')
  await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent==='放入鱼缸').click()");await sleep(1000);await record('tank-resident');assert.equal((await qa()).homeBook.fish.length,1)
  await key('Escape','Escape');await fixture('bedroom',{location:'bedroom',position:{x:0,z:2.5}});await key('KeyF','f');await waitFor("forestStore.getState().location==='island'&&!forestStore.getState().homeTransfer");report.checks.push({name:'door-exit',qa:await qa()})
  await fixture('camp',{location:'island',position:{x:20,z:21.5},timeOfDay:'dusk'});await key('KeyF','f');assert.equal((await qa()).homeBook.fireLit,true);await record('camp-lit')
  await fixture('camp',{location:'island',position:{x:20,z:24.707333333}});await key('KeyF','f');await waitFor("forestStore.getState().sitting?.phase==='idle'");await record('camp-seated');await key('KeyF','f');await waitFor("forestStore.getState().mode==='walking'")
  await fixture('craftContact',{location:'workshop',position:{x:-.6,z:-.65},nearby:'workshop',workshopBook:{version:1,phase:'carrying'},timeOfDay:'day'});await key('KeyF','f')
  const contact=[]
  for(let step=0;step<3;step++){
    await waitFor("(()=>{const c=forestStore.getState().craft;if(!c||c.stroke>0)return false;const t=(c.elapsed%2.4)/1.2;const v=t<=1?t:2-t;return v>.4&&v<.55})()")
    await key('KeyF','f');await sleep(150)
    for(let i=0;i<15;i++){const q=await qa();if(q.motion==='woodwork'&&q.woodwork)contact.push(q.woodwork);if(i===4&&step===0)await record('woodworking-contact');await sleep(45)}
  }
  await waitFor("forestStore.getState().workshopBook.phase==='finished'")
  assert(contact.length>15);const maximum=Math.max(...contact.filter(c=>c.pose.contact).flatMap(c=>c.hands.map(h=>h[3])));assert(maximum<.025,'Woodworking grip error '+maximum);report.contact={maximumGripErrorMetres:maximum,samples:contact}
  await evaluate("history.replaceState(null,'','/?qa&view=craft')");await key('KeyF','f');await waitFor("forestStore.getState().sitting?.phase==='idle'");await record('finished-stool');await key('Escape','Escape');await waitFor("forestStore.getState().mode==='walking'")
  for(const light of ['day','dusk','night'])for(const view of ['fullIsland','pond','farm','tower','player','cabin','camp','bedroom','beach']){
    await fixture(view,{location:view==='bedroom'?'bedroom':'island',position:{x:0,z:0},timeOfDay:light});await record(`${light}-${view}`)
  }
  assert.equal(report.errors.length,0,report.errors.join('\n'))
  report.status='PASS'
}finally{try{await writeFile(`${out}/headless-validation.json`,JSON.stringify(report,null,2))}finally{socket?.close();await cleanup()}}
