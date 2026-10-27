// Isolated headless Edge only. CDP pattern reused from my-blog/scripts/t10-gait-check.mjs.
import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createHeadlessBrowser } from './browser-session.mjs'

const out = resolve(process.env.FOREST_QA_OUT ?? 'docs/evidence/2026-10-24-workshop/development-v1')
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
const snapshot = () => evaluate("JSON.parse(document.querySelector('canvas')?.dataset.forestQa || 'null')")
const keys = { w: ['KeyW', 87], s: ['KeyS', 83], a: ['KeyA', 65], d: ['KeyD', 68], Shift: ['ShiftLeft', 16], f: ['KeyF', 70], Escape:['Escape',27] }
const key = (name, down) => cmd('Input.dispatchKeyEvent', { type: down ? 'keyDown' : 'keyUp', key: name, code: keys[name][0], windowsVirtualKeyCode: keys[name][1] })
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
  await cmd('Page.enable'); await cmd('Runtime.enable'); await cmd('Page.bringToFront'); await cmd('Emulation.setFocusEmulationEnabled',{enabled:true})
  await cmd('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })
  await cmd('Page.navigate', { url: 'http://127.0.0.1:5176/?qa' })

  for(let i=0;i<400;i++) {
    const loaded=await evaluate("!!document.querySelector('canvas')&&!document.querySelector('.asset-loading')&&!document.querySelector('.world-error')")
    if(loaded && i>10)break
    if(i===399)throw Error('Production assets failed to load')
    await sleep(200)
  }
  async function wait(predicate,label){for(let i=0;i<400;i++){const s=await snapshot();if(predicate(s))return s;await sleep(50)}throw Error('Timeout '+label+JSON.stringify(await snapshot()))}
  await wait(s=>s?.workshopReady&&s.ready,'all assets')
  async function hold(name, ms) { await key(name,true); await evaluate(`new Promise(resolve=>{let last=performance.now(),elapsed=0;function frame(t){elapsed+=Math.min(t-last,50);last=t;if(elapsed>=${ms})resolve();else requestAnimationFrame(frame)}requestAnimationFrame(frame)})`); await key(name,false) }
  const press=async k=>{await key(k,true);await key(k,false)}
  // Development-only route planning uses actual ground collision. Input and gameplay below are real keys.
  const route=await evaluate(`(async()=>{
    const {canStandAt}=await import(performance.getEntriesByType('resource').find(e=>new URL(e.name).pathname==='/src/game/movement.ts').name)
    function path(start,end,phase){
      const q=[start],seen=new Map([[start.join(','),null]]);let found
      for(let n=0;n<q.length;n++){const p=q[n];if(p[0]===end[0]&&p[1]===end[1]){found=p;break}
        for(const d of [[1,0],[-1,0],[0,1],[0,-1]]){const a=[p[0]+d[0],p[1]+d[1]],k=a.join(',');if(Math.abs(a[0])>60||Math.abs(a[1])>60||seen.has(k)||!canStandAt(a[0]/4,a[1]/4,0,phase))continue;seen.set(k,p);q.push(a)}
      }
      if(!found)throw Error('No ground route');const points=[];for(let p=found;p;p=seen.get(p.join(',')))points.push(p);points.reverse()
      const segments=[];for(let i=1;i<points.length;i++){const dx=points[i][0]-points[i-1][0],dz=points[i][1]-points[i-1][1],key=dx>0?'d':dx<0?'a':dz>0?'s':'w';const last=segments.at(-1);if(last?.key===key)last.distance+=.25;else segments.push({key,distance:.25})}return segments
    }
    const {workshopDoor}=await import('/src/game/workshop.ts');return{wood:path([0,0],[-30,41],'available'),door:path([-30,41],[Math.round(workshopDoor.x*4),Math.round(workshopDoor.z*4)],'carrying')}
  })()`)
  report.route=route
  await writeFile(resolve(process.env.FOREST_WORKSHOP_ROUTE??'docs/evidence/2026-10-24-workshop/keyboard-route.json'),JSON.stringify(route,null,2)+'\n')
  // Movement is camera-relative: turn each world-axis segment into the key pair for the live orbit yaw.
  async function holdWorld(dir, ms) {
    const yaw=(await snapshot()).orbit?.yaw??0,c=Math.cos(yaw),n=Math.sin(yaw)
    const dx=dir==='d'?1:dir==='a'?-1:0,dz=dir==='s'?1:dir==='w'?-1:0,ix=dx*c-dz*n,iz=dx*n+dz*c
    const names=[ix>.3?'d':ix<-.3?'a':null,iz>.3?'s':iz<-.3?'w':null].filter(Boolean)
    for(const k of names)await key(k,true)
    await evaluate(`new Promise(resolve=>{let last=performance.now(),elapsed=0;function frame(t){elapsed+=Math.min(t-last,50);last=t;if(elapsed>=${ms})resolve();else requestAnimationFrame(frame)}requestAnimationFrame(frame)})`)
    for(const k of names)await key(k,false)
  }
  async function walk(segments){for(const s of segments)await holdWorld(s.key,s.distance/1.1*1000)}
  await shot('01-spawn');await walk(route.wood);await sleep(500);await shot('02-wood')
  assert(await evaluate("document.querySelector('.interaction button')?.textContent.includes('收好旧木墩')"),'Reach collectible with real keyboard')
  await press('f');await press('Escape');assert.equal((await snapshot()).workshopBook.phase,'available')
  await press('f');await wait(s=>s.workshopBook.phase==='carrying','collection');await shot('03-collected')
  await walk(route.door);await sleep(500);await shot('04-door');assert(await evaluate("document.querySelector('.interaction button')?.textContent.includes('进入工坊')"))
  const outside=(await snapshot()).position
  await press('f');await press('f');await wait(s=>s.location==='workshop'&&!s.workshopTransfer,'enter');await sleep(700);await shot('05-indoor-spawn')
  assert((await snapshot()).playerVisible);assert(!(await snapshot()).workshopVisual.rawVisible)
  await hold('a',.6/1.1*1000);await hold('w',2.25/1.1*1000);await sleep(800);await shot('06-station')
  await press('f');await wait(s=>s.mode==='crafting','crafting');await press('Escape');assert.equal((await snapshot()).workshopBook.phase,'carrying')
  await press('f');await wait(s=>s.mode==='crafting','restart')
  for(let i=0;i<3;i++){
    for(let j=0;j<400;j++){if(await evaluate("(()=>{const m=document.querySelector('[role=meter]'),b=document.querySelector('.craft-hud button');const v=Number(m?.getAttribute('aria-valuenow'));return m&&!b.disabled&&v>.43&&v<.57})()"))break;await sleep(25)}
    await press('f');await wait(s=>s.craft?.steps===i+1,'stroke '+i)
    if(i===0){await sleep(250);await shot('07-sanding')}
    await wait(s=>!s.craft||s.craft.stroke===0,'stroke completion')
  }
  await wait(s=>s.workshopBook.phase==='finished','finished');await sleep(500);await shot('08-finished')
  await hold('w',1800);const blocked=await snapshot();assert(blocked.position[2]>-1,'Stool blocks walking through it');check('furniture collision',blocked.position)
  await hold('s',3.15/1.1*1000);await hold('d',.6/1.1*1000);await sleep(700);await shot('09-exit')
  assert(await evaluate("document.querySelector('.interaction button')?.textContent.includes('回到小岛')"));await press('f');await wait(s=>s.location==='island'&&!s.workshopTransfer,'exit');await sleep(600);await shot('10-return')
  const returned=(await snapshot()).position;assert(Math.hypot(returned[0]-outside[0],returned[2]-outside[2])<.02)
  await press('f');await wait(s=>s.location==='workshop'&&!s.workshopTransfer,'reenter');assert((await snapshot()).workshopVisual.pieceVisible)
  await cmd('Page.reload');await sleep(500);await wait(s=>s?.ready&&s.workshopReady,'reload');assert.equal((await snapshot()).location,'island');assert.equal((await snapshot()).workshopBook.phase,'finished');await shot('11-reload')
  check('real keyboard collection, cancellation, interior entry, three strokes, finished furniture, return and reload',await snapshot())
  report.assets=await evaluate("performance.getEntriesByType('resource').filter(e=>/assets\\/interiors/.test(e.name)).map(e=>({url:new URL(e.name).pathname,bytes:e.decodedBodySize}))")
  assert.equal(report.assets.length,7);assert.equal(report.errors.length,0,report.errors.join('\n'));report.status='PASS'
} catch (error) {
  report.status = 'FAIL'; report.failure = String(error); process.exitCode = 1
  if (socket?.readyState === 1) { try { await shot('headless-failure') } catch { /* Original error stays in report. */ } }
} finally {
  try {
    await writeFile(`${out}/headless-validation.json`, JSON.stringify(report, null, 2) + '\n')
    if (socket?.readyState === 1) { try { await cmd('Browser.close') } catch { /* Closing the socket can precede the response. */ } socket.close() }
    console.log(report.status)
  } finally {
    await cleanup()
  }
}
