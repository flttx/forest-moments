// Isolated headless Edge only. CDP pattern reused from my-blog/scripts/t10-gait-check.mjs.
import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createHeadlessBrowser } from './browser-session.mjs'

const out = resolve(process.env.FOREST_QA_OUT ?? 'docs/evidence/2026-10-25-wide-zoom/before')
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
  let stable=0
  for(let i=0;i<200&&stable<15;i++){
    const clear=await evaluate("!!document.querySelector('canvas')&&!document.querySelector('.asset-loading')&&!document.querySelector('.world-error')")
    stable=clear?stable+1:0;await sleep(100)
  }
  assert.equal(stable,15,'Assets must remain ready before capture')
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
  const wheel=async(delta)=>{await cmd('Input.dispatchMouseEvent',{type:'mouseWheel',x:700,y:450,deltaX:0,deltaY:delta});await sleep(70)}
  await sleep(1800);await shot('01-default')
  for(let i=0;i<20;i++)await wheel(300)
  await sleep(1600);await shot('02-max-distance');report.checks.push({name:'wheel-max',qa:await qa()})
  assert(Math.abs((await qa()).orbit.zoom-14)<.01)
  assert(await evaluate("getComputedStyle(document.querySelector('.landmarks')).display==='none'"))
  const key=async(code,key)=>{await cmd('Input.dispatchKeyEvent',{type:'keyDown',code,key});await cmd('Input.dispatchKeyEvent',{type:'keyUp',code,key})}
  const waitFor=async(expression)=>{for(let i=0;i<150;i++){if(await evaluate(expression))return;await sleep(100)}throw Error('Condition timed out: '+expression)}
  for(const light of ['dusk','night']){await evaluate(`forestStore.setState({timeOfDay:'${light}'})`);await shot(`03-${light}-wide`)}
  await evaluate("forestStore.setState({timeOfDay:'day',position:{x:42.6,z:.8}})");await sleep(1200);await shot('04-coast-position-wide')
  await cmd('Input.dispatchMouseEvent',{type:'mousePressed',button:'right',buttons:2,x:700,y:430,clickCount:1})
  await cmd('Input.dispatchMouseEvent',{type:'mouseMoved',button:'right',buttons:2,x:930,y:750})
  await cmd('Input.dispatchMouseEvent',{type:'mouseReleased',button:'right',buttons:0,x:930,y:750,clickCount:1})
  await sleep(1400);await shot('05-orbit-low-angle-wide');assert((await qa()).cameraPosition[1]>60)
  await cmd('Emulation.setDeviceMetricsOverride',{width:1024,height:768,deviceScaleFactor:1,mobile:false});await shot('06-four-three-wide')
  await cmd('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false})
  for(let i=0;i<20;i++)await wheel(-300)
  await sleep(1000);assert(Math.abs((await qa()).orbit.zoom-.55)<.01);await shot('07-close-restored');assert(await evaluate("getComputedStyle(document.querySelector('.landmarks')).display!=='none'"))
  await evaluate("forestStore.setState({position:{x:-15,z:-24.5},nearby:'bedroom'})");await key('KeyF','f');await waitFor("forestStore.getState().location==='bedroom'&&!forestStore.getState().homeTransfer")
  for(let i=0;i<20;i++)await wheel(300)
  await sleep(1000);const room=await qa();assert(Math.abs(room.orbit.zoom-1.6)<.01);assert(room.cameraPosition[1]<=3.05);await shot('08-indoor-limit');report.checks.push({name:'indoor',qa:room})
  await evaluate("forestStore.setState({position:{x:0,z:2.5}})");await key('KeyF','f');await waitFor("forestStore.getState().location==='island'&&!forestStore.getState().homeTransfer")
  await evaluate("forestStore.setState({position:{x:42.6,z:.8},nearby:'dock'})");await key('KeyF','f');await waitFor("forestStore.getState().mode==='rowing'&&!forestStore.getState().boatTransfer")
  for(let i=0;i<20;i++)await wheel(300)
  await sleep(1800);const boat=await qa();assert(Math.abs(boat.orbit.zoom-14)<.01);assert(boat.cameraPosition[1]>60);await shot('09-boat-wide');report.checks.push({name:'boat',qa:boat})
  assert.equal(report.errors.length,0,report.errors.join('\n'));report.status='PASS'
}finally{try{await writeFile(`${out}/headless-validation.json`,JSON.stringify(report,null,2))}finally{socket?.close();await cleanup()}}
