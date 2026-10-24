// Isolated headless Edge only. CDP pattern reused from my-blog/scripts/t10-gait-check.mjs.
import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createHeadlessBrowser } from './browser-session.mjs'

const stage = process.env.FOREST_RENDER_STAGE ?? 'browser-development'
const out = resolve(`docs/evidence/assets/2026-10-24-farm/${stage}`)
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
  await waitFor(s=>s?.ready&&s.models.length===4&&s.boatReady&&s.growthReady&&s.farmReady,'ready',90000)
  await sleep(1500)

  const codes={w:'KeyW',s:'KeyS',a:'KeyA',d:'KeyD',Shift:'ShiftLeft',f:'KeyF',Escape:'Escape'}
  const pressed=new Set()
  async function key(k,on){if(pressed.has(k)===on)return;await cmd('Input.dispatchKeyEvent',{type:on?'keyDown':'keyUp',key:k,code:codes[k],windowsVirtualKeyCode:k==='Shift'?16:k==='Escape'?27:k.toUpperCase().charCodeAt(0)});if(on)pressed.add(k);else pressed.delete(k)}
  async function press(k){await key(k,true);await key(k,false)}
  async function go(x,z){
    await key('Shift',true);const start=Date.now()
    for(;;){const s=await snapshot(),dx=x-s.position[0],dz=z-s.position[2];if(Math.hypot(dx,dz)<.15)break;if(Date.now()-start>25000)throw Error('Travel blocked '+JSON.stringify(s.position));await key('d',dx>.08);await key('a',dx<-.08);await key('s',dz>.08);await key('w',dz<-.08);await sleep(45)}
    for(const k of ['w','s','a','d','Shift'])await key(k,false)
  }
  async function reload(){const previous=await evaluate('performance.timeOrigin');await cmd('Page.reload');for(let i=0;i<100;i++){await sleep(100);try{if(await evaluate('performance.timeOrigin')!==previous)break}catch{}}await waitFor(s=>s?.ready&&s.growthReady&&s.farmReady,'reload ready',90000)}
  await go(8,1.8);await press('f');assert.equal((await snapshot()).mode,'walking');check('cannot feed outside range',true)
  await go(8,4.2);await shot('01-entered-through-gate')
  await press('f');await waitFor(s=>s?.mode==='feeding','feeding');await press('Escape');assert.equal((await snapshot()).mealActive,false);assert.equal((await snapshot()).farmBook.meals,0);check('cancel without reward or food',true)
  await press('f');await waitFor(s=>s?.feedingElapsed>.95,'grain release');report.release=await snapshot();assert(report.release.farmVisual.visibleGrains>0);assert(report.release.farmVisual.grainPositions.every(([x,y,z])=>x>7&&x<10.2&&y>0&&y<1.8&&z>3&&z<5.5),'grain must launch from walking actor, not hidden boat actor');await shot('02a-grain-release');await waitFor(s=>s?.mealActive,'food added');await shot('02-food-added');await press('f');assert.equal((await snapshot()).mode,'walking');check('duplicate feeding blocked',true)
  await waitFor(s=>s?.farmVisual?.animals.some(a=>a.state==='eat'),'actual eating',60000);await shot('03-eating')
  report.eating=await snapshot();await evaluate("history.replaceState(null,'','?qa&view=farmFeed')");await waitFor(s=>s?.farmVisual?.animals.every(a=>a.eaten>0),'both arrived',60000);await sleep(700);await shot('03a-both-eating');await sleep(650);await shot('03b-eating-cycle');await evaluate("history.replaceState(null,'','?qa')");await waitFor(s=>s?.farmBook.meals===1,'completed meal',60000);await shot('04-finished')
  assert.equal((await snapshot()).farmVisual.foodVisible,false);check('actual arrival and eating complete once',await snapshot())
  await reload();assert.equal((await snapshot()).farmBook.meals,1);assert.equal((await snapshot()).mealActive,false);check('completed meal persists',true)
  await go(8,1.8);await go(8,4.2)
  await cmd('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]})
  await press('f');await waitFor(s=>s?.mealActive,'reduced food');await waitFor(s=>s?.farmBook.meals===2,'reduced meal',60000);await shot('05-reduced-motion');check('reduced motion remains playable',true)
  await evaluate("Storage.prototype.setItem=function(){throw new Error('test storage unavailable')}")
  await press('f');await waitFor(s=>s?.mealActive,'third food');await waitFor(s=>s?.farmBook.meals===3,'third meal',60000);await shot('06-storage-denied')
  assert(await evaluate("document.querySelector('.notice')?.textContent.includes('无法保存')"));check('storage failure visible and session playable',true)
  assert.equal(report.errors.length,0,report.errors.join('\n'));report.status='PASS'
} catch(error){report.status='FAIL';report.failure=String(error);process.exitCode=1;if(socket?.readyState===1){try{await shot('headless-failure')}catch{}}}
finally{
  try {
    await writeFile(`${out}/headless-validation.json`,JSON.stringify(report,null,2)+'\n');if(socket?.readyState===1){try{await cmd('Browser.close')}catch{}socket.close()}console.log(report.status)
  } finally {
    await cleanup()
  }
}
