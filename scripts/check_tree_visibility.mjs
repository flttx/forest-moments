// Isolated headless Edge only. CDP pattern reused from my-blog/scripts/t10-gait-check.mjs.
import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createHeadlessBrowser } from './browser-session.mjs'

const out = resolve(process.env.FOREST_QA_OUT ?? 'docs/evidence/2026-10-25-tree-visibility/after')
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
  const vegetation=()=>evaluate("JSON.parse(document.querySelector('canvas').dataset.vegetationQa)")
  const fixture=await evaluate(`(async()=>{
    const resource=path=>performance.getEntriesByType('resource').find(e=>new URL(e.name).pathname===path).name;
    const {vegetationPositions,instanceCircles}=await import(resource('/src/world/vegetationLayout.ts'));
    const {canStandAt}=await import(resource('/src/game/movement.ts'));
    for(const p of [...vegetationPositions].filter(p=>p.kit==='normal-pine-b').sort((a,b)=>Math.hypot(a.x,a.z)-Math.hypot(b.x,b.z))){
      const c=instanceCircles(p)[0],start={x:c.x+3/Math.sqrt(2),z:c.z+3/Math.sqrt(2)};
      if(canStandAt(start.x,start.z)&&canStandAt(c.x+1.5/Math.sqrt(2),c.z+1.5/Math.sqrt(2))){window.treeFixture={p,c,start};forestStore.setState({position:start,mode:'walking',location:'island',timeOfDay:'day'});return window.treeFixture}
    }throw Error('No clear tree approach');
  })()`);
  report.fixture=fixture;await sleep(1800);await shot('01-approach');
  async function hold(ms){
    await cmd('Input.dispatchKeyEvent',{type:'keyDown',code:'KeyW',key:'w'});
    try{await evaluate(`new Promise(resolve=>{let last=performance.now(),elapsed=0;function frame(t){elapsed+=Math.min(t-last,50);last=t;if(elapsed>=${ms})resolve();else requestAnimationFrame(frame)}requestAnimationFrame(frame)})`)}
    finally{await cmd('Input.dispatchKeyEvent',{type:'keyUp',code:'KeyW',key:'w'})}
  }
  await hold(2600);await sleep(500);await shot('02-at-trunk');
  const blocked=await qa();await hold(700);const pushed=await qa();
  const movement=Math.hypot(pushed.position[0]-blocked.position[0],pushed.position[2]-blocked.position[2]);
  const distance=Math.hypot(pushed.position[0]-fixture.c.x,pushed.position[2]-fixture.c.z);
  report.checks.push({name:'actual-W-trunk-collision',blocked,pushed,movement,distance,vegetation:await vegetation()});
  assert(distance>=fixture.c.r+.28-.02,'Must stay outside trunk');
  assert(distance<1.5,'Must approach the trunk');assert(movement<.08,'Continued W must be blocked');
  for(const light of ['dusk','night']){await evaluate(`forestStore.setState({timeOfDay:'${light}'})`);await shot(`03-${light}-trunk`);report.checks.push({name:light,vegetation:await vegetation()})}
  await evaluate("forestStore.setState({timeOfDay:'day'})");
  await cmd('Input.dispatchMouseEvent',{type:'mousePressed',button:'right',buttons:2,x:700,y:430,clickCount:1});
  await cmd('Input.dispatchMouseEvent',{type:'mouseMoved',button:'right',buttons:2,x:1100,y:430});
  await cmd('Input.dispatchMouseEvent',{type:'mouseReleased',button:'right',buttons:0,x:1100,y:430,clickCount:1});
  await sleep(1000);await shot('04-orbit-trunk');report.checks.push({name:'orbit',vegetation:await vegetation()});
  for(let i=0;i<20;i++)await cmd('Input.dispatchMouseEvent',{type:'mouseWheel',x:700,y:450,deltaX:0,deltaY:300});
  await sleep(1500);await shot('05-whole-island');report.checks.push({name:'wide-LOD',vegetation:await vegetation()});
  if(process.env.FOREST_QA_EXPECT_VISIBLE!=='0')for(const check of report.checks){assert.equal(check.vegetation.rendering.missingChunks,0);assert.equal(check.vegetation.rendering.duplicateChunks,0);assert.equal(check.vegetation.rendering.coverageAttributes,0);assert.equal(check.vegetation.rendering.visibleInstances,check.vegetation.plants)}
  assert.equal(report.errors.length,0,report.errors.join('\n'));report.status='PASS'
}catch(error){report.status='FAIL';report.failure=String(error);process.exitCode=1;console.error(error)}
finally{try{await writeFile(`${out}/headless-validation.json`,JSON.stringify(report,null,2));console.log(report.status)}finally{socket?.close();await cleanup()}}
