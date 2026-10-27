// Isolated headless Edge only. CDP pattern reused from my-blog/scripts/t10-gait-check.mjs.
import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createHeadlessBrowser } from './browser-session.mjs'

const stage = process.env.FOREST_RENDER_STAGE ?? 'browser-development'
const out = resolve(`docs/evidence/assets/2026-10-24-tree-growth/${stage}`)
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
const snapshot = () => evaluate("JSON.parse(document.querySelector('canvas')?.dataset.forestQa || 'null')")
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
  await waitFor(s=>s?.ready&&s.models.length===4&&s.boatReady&&s.growthReady,'ready',90000)
  await sleep(1500)

  const codes={w:'KeyW',s:'KeyS',a:'KeyA',d:'KeyD',Shift:'ShiftLeft',f:'KeyF',Escape:'Escape'}
  const pressed=new Set()
  async function key(k,on){if(pressed.has(k)===on)return;await cmd('Input.dispatchKeyEvent',{type:on?'keyDown':'keyUp',key:k,code:codes[k],windowsVirtualKeyCode:k==='Shift'?16:k==='Escape'?27:k.toUpperCase().charCodeAt(0)});if(on)pressed.add(k);else pressed.delete(k)}
  async function press(k){await key(k,true);await key(k,false)}
  async function go(x,z){
    await key('Shift',true);const start=Date.now()
    for(;;){const s=await snapshot(),dx=x-s.position[0],dz=z-s.position[2];if(Math.hypot(dx,dz)<.15)break;if(Date.now()-start>25000)throw Error('Travel blocked '+JSON.stringify(s.position));const yaw=s.orbit?.yaw??0,c=Math.cos(yaw),n=Math.sin(yaw),ix=dx*c-dz*n,iz=dx*n+dz*c;await key('d',ix>.08);await key('a',ix<-.08);await key('s',iz>.08);await key('w',iz<-.08);await sleep(45)}
    for(const k of ['w','s','a','d','Shift'])await key(k,false)
  }
  async function reload(){const previous=await evaluate('performance.timeOrigin');await cmd('Page.reload');for(let i=0;i<100;i++){await sleep(100);try{if(await evaluate('performance.timeOrigin')!==previous)break}catch{}}await waitFor(s=>s?.ready&&s.growthReady,'reload ready',90000)}
  await go(0,6.6);await shot('01-empty-plot')
  await press('f');await waitFor(s=>s?.mode==='planting','planting');await press('Escape');assert.equal((await snapshot()).tree,null);assert.equal((await snapshot()).mode,'walking');check('cancel planting without save',true)
  await press('f');await waitFor(s=>s?.tree?.stage===0&&s.mode==='walking','planted');await sleep(1400);await shot('02-sprout-inspection')
  const plantedAt=(await snapshot()).tree.plantedAt;report.plantedAt=plantedAt
  await press('f');await shot('03-sprout-walking');await go(-1,6.6);await go(0,6.6);await press('f')
  report.realGrowth=[]
  for(let stage=1;stage<=3;stage++){
    const state=await waitFor(s=>s?.tree?.stage===stage,'real growth stage '+stage,150000)
    await sleep(1200);await shot('04-stage-'+stage)
    report.realGrowth.push({stage,elapsedMs:Date.now()-plantedAt,state})
    check('real elapsed growth stage '+stage,{elapsedMs:Date.now()-plantedAt})
    if(stage===1){await reload();assert.equal((await snapshot()).tree.stage,1);await go(0,6.6);await press('f');await sleep(800);await shot('05-seedling-after-reload')}
  }
  await press('f');await go(0,7.1)
  await key('s',true);await sleep(1000);await key('s',false)
  const blocked=await snapshot();assert(Math.hypot(blocked.position[0],blocked.position[2]-8)>=.59);check('mature trunk blocks walking',blocked.position)
  await shot('06-mature-collision')
  await reload();assert.equal((await snapshot()).tree.stage,3);check('mature persists',true)
  await evaluate("localStorage.removeItem('forest-moments:tree:v2');localStorage.setItem('forest-moments:seedling:v1','true')")
  await reload();assert.equal((await snapshot()).tree.stage,1);await go(0,6.6);await press('f');await sleep(800);await shot('07-legacy-migration');check('legacy planting migrated',true)
  await evaluate("localStorage.setItem('forest-moments:tree:v2',JSON.stringify({version:2,plantedAt:Date.now()-300000,stage:0}));localStorage.removeItem('forest-moments:seedling:v1')")
  await reload();assert.equal((await snapshot()).tree.stage,3);check('offline age fixture matures on load',true)
  await evaluate("localStorage.setItem('forest-moments:tree:v2','broken')")
  await reload();assert.equal((await snapshot()).tree,null);check('malformed save ignored',true)
  await evaluate("localStorage.clear();Storage.prototype.setItem=function(){throw new Error('test storage unavailable')}")
  await go(0,6.6);await press('f');await waitFor(s=>s?.tree?.stage===0,'in-memory planting');await sleep(1000);await shot('08-storage-denied')
  assert(await evaluate("document.querySelector('.notice')?.textContent.includes('无法保存')"));check('storage unavailable remains playable and visible',true)
  assert.equal(report.errors.length,0,report.errors.join('\n'));report.status='PASS'
} catch(error){report.status='FAIL';report.failure=String(error);process.exitCode=1;if(socket?.readyState===1){try{await shot('headless-failure')}catch{}}}
finally{
  try {
    await writeFile(`${out}/headless-validation.json`,JSON.stringify(report,null,2)+'\n');if(socket?.readyState===1){try{await cmd('Browser.close')}catch{}socket.close()}console.log(report.status)
  } finally {
    await cleanup()
  }
}
