// Real keyboard and mouse island roundtrip, using the project isolated browser helper.
import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createHeadlessBrowser } from './browser-session.mjs'

// Each run writes a separate evidence directory; user browser profiles and saves are untouched.
const out = resolve(process.env.FOREST_QA_OUT ?? 'docs/evidence/2026-10-29-berth-docking/final')
await mkdir(out, { recursive: true })
const { profile, cleanup } = await createHeadlessBrowser([
  '--headless=new', '--disable-features=CalculateNativeWinOcclusion', '--disable-frame-rate-limit', '--disable-gpu-vsync', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--remote-debugging-port=0', '--no-first-run', '--no-default-browser-check', 'about:blank',
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
const snapshot = async () => {
  try { return await evaluate("(()=>{const s=JSON.parse(document.querySelector('canvas')?.dataset.forestQa || 'null');return s?{...s,documentId:performance.timeOrigin}:null})()") }
  catch(e){if(/Execution context was destroyed|Cannot find context/.test(String(e)))return null;throw e}
}
async function waitFor(predicate, label, limit = 45000) {
  const start = Date.now()
  while (Date.now() - start < limit) { const value = await snapshot(); if (predicate(value)) return value; await sleep(100) }
  throw Error(`Timeout: ${label}; state=${JSON.stringify(await snapshot())}`)
}
async function shot(name) {
  const result = await cmd('Page.captureScreenshot', { format: 'png' })
  await writeFile(`${out}/${name}.png`, Buffer.from(result.data, 'base64'))
  report.screenshots.push(`${name}.png`)
}
function check(name, data) { report.checks.push({ name, data }); console.log(`PASS ${name}`) }
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
  await cmd('Page.enable'); await cmd('Runtime.enable'); await cmd('Page.bringToFront'); await cmd('Emulation.setFocusEmulationEnabled', {enabled:true})
  await cmd('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })

  await cmd('Page.navigate',{url:'http://127.0.0.1:5176/?qa'})
  await waitFor(s=>s?.ready&&s.models.length===4&&s.boatReady&&s.dockReady,'ready',90000)

  const codes={w:'KeyW',s:'KeyS',a:'KeyA',d:'KeyD',f:'KeyF',p:'KeyP',Shift:'ShiftLeft'}
  const pressed=new Set()
  async function key(k,on){if(pressed.has(k)===on)return;await cmd('Input.dispatchKeyEvent',{type:on?'keyDown':'keyUp',key:k,code:codes[k],windowsVirtualKeyCode:k==='Shift'?16:k.toUpperCase().charCodeAt(0)});if(on)pressed.add(k);else pressed.delete(k)}
  async function stop(){for(const k of [...pressed])await key(k,false)}
  async function press(k){await key(k,true);await key(k,false)}
  async function modules(){await evaluate(`(async()=>{const r=p=>performance.getEntriesByType('resource').find(e=>new URL(e.name).pathname===p)?.name??p;window.qa={S:(await import(r('/src/game/store.ts'))).useForestStore,C:await import(r('/src/world/worldConfig.ts')),R:await import(r('/src/game/rowing.ts')),M:await import(r('/src/game/movement.ts')),I:await import(r('/src/world/mistIsland.ts')),T:await import(r('/src/game/islandTravel.ts')),U:(await import(r('/src/game/uiStore.ts'))).useUiStore,P:(await import(r('/src/game/photoStore.ts'))).usePhotoStore};qa.U.setState({guideSeen:true,panel:null})})()`)}
  await modules()
  const baseline=process.env.FOREST_QA_BASELINE==='1'
  for(const id of ['mist','main']){
    const b=await evaluate(`qa.C.berths.${id}`),side=Math.sign(b.mooring.z-b.landing.z)
    const edge=side<0?b.dock.minZ:b.dock.maxZ
    const cases=[{name:'bow-on',x:b.mooring.x,z:edge+side*3.2,heading:side*Math.PI/2},
      {name:'offset',x:b.mooring.x+(id==='mist'?-2:2),z:edge+side*1.8,heading:id==='mist'?0:Math.PI},
      {name:'oblique',x:b.mooring.x,z:edge+side*2.7,heading:side*Math.PI/4}]
    for(const c of cases){
      await evaluate(`history.replaceState(null,'','/?qa&view=${id==='mist'?'mistBerth':'dock'}');qa.S.setState({mode:'rowing',menuPaused:false,boatTransfer:null,boat:{...qa.R.initialBoat,...${JSON.stringify(c)},speed:0},message:''})`)
      assert(await evaluate('qa.R.boatFits(qa.S.getState().boat.x,qa.S.getState().boat.z,qa.S.getState().boat.heading)'))
      await key('w',true);await sleep(c.name==='bow-on'?1150:450);await stop()
      await sleep(1000)
      const approach=await snapshot()
      await shot(`${id}-${c.name}-approach`)
      await press('f');await sleep(1100)
      if(baseline){check(`${id} ${c.name} old behaviour`,{approach:approach.boat,canLand:approach.canLand,mode:(await snapshot()).mode});continue}
      assert.equal((await snapshot()).mode,'walking',`${id} ${c.name} landing`)
      assert.equal((await snapshot()).travel.checkpoint,id)
      assert((await snapshot()).canBoard)
      const moored=(await snapshot()).boat
      assert.equal(moored.x,b.mooring.x);assert.equal(moored.z,b.mooring.z);assert.equal(moored.heading,b.mooring.heading)
      await shot(`${id}-${c.name}-landed`)
      await press('f');await waitFor(s=>s.mode==='rowing'&&!s.boatTransfer,'reboard')
      await key('w',true);await sleep(1300);await stop();await sleep(300)
      const departed=(await snapshot()).boat
      assert(Math.hypot(departed.x-moored.x,departed.z-moored.z)>.6,'forward departure unobstructed')
      check(`${id} ${c.name}: real W approach, F land, F reboard, W depart`,{approach:approach.boat,departed})
    }
  }
  if(!baseline){
    const doc=(await snapshot()).documentId
    await cmd('Page.reload');await waitFor(s=>s?.documentId!==doc&&s?.ready&&s.boatReady&&s.dockReady,'reload',90000)
    assert((await snapshot()).canBoard);check('reload restores a boardable canonical berth',true)
  }
  assert.deepEqual(report.errors,[]);report.status='PASS'
}catch(e){report.status='FAIL';report.failure=e.stack??String(e);console.error(e);process.exitCode=1}
finally{try{await writeFile(`${out}/report.json`,JSON.stringify(report,null,2))}finally{if(socket?.readyState===1){try{await cmd('Browser.close')}catch{/* Socket may close first. */}}socket?.close();await cleanup()}}
