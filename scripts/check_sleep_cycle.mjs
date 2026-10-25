// Isolated headless Edge only. CDP pattern reused from my-blog/scripts/t10-gait-check.mjs.
import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createHeadlessBrowser } from './browser-session.mjs'

const out = resolve(process.env.FOREST_QA_OUT ?? 'docs/evidence/2026-10-25-sleep-cycle/initial')
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
  const env=()=>evaluate("JSON.parse(document.querySelector('canvas').dataset.environmentQa)")
  const fixture=async(timeOfDay)=>{await evaluate(`history.replaceState(null,'','/?qa');forestStore.setState(${JSON.stringify({mode:'walking',location:'bedroom',position:{x:-1,z:-.5},sitting:null,homeTransfer:null,workshopTransfer:null,sleepJourney:null,sleepElapsed:0,aquariumOpen:false,timeOfDay,homeReady:true})})`);await sleep(500)}
  for(const from of ['day','night','dusk']){
    await fixture(from)
    await shot(`${from}-bedroom-before`)
    const nights=(await qa()).homeBook.nights,target=from==='night'?'day':'night'
    await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent.includes('上床休息')).click()")
    await waitFor("forestStore.getState().mode==='sleeping'")
    const samples=[],milestones=[.5,5,9,12,16.8];let milestone=0
    let startPosition
    for(let frame=0;frame<500;frame++){
      const q=await qa(),e=await env()
      if(q.mode!=='sleeping')break
      assert.equal(q.playerVisible,false)
      assert(Math.abs(e.renderedNight-e.moonPower/.65)<.000001,'rendered night uniform matches lighting')
      if(e.sunPosition[1]<-1.8)assert.equal(e.renderedDisc,0,'sun disc disappears below the horizon')
      assert(q.cameraPosition[1]>50)
      startPosition??=q.cameraPosition
      assert.deepEqual(q.cameraPosition,startPosition,'panorama camera must remain fixed')
      samples.push({elapsed:q.sleepElapsed,...e})
      if(milestone<milestones.length&&q.sleepElapsed>=milestones[milestone]){await shot(`${from}-${milestone}`);milestone++}
      await sleep(100)
    }
    assert.equal(milestone,5)
    const end=await qa()
    assert.equal(end.mode,'walking');assert.equal(end.timeOfDay,target);assert.equal(end.location,'bedroom');assert.equal(end.homeBook.nights,nights+1);assert(end.cameraPosition[1]<4);assert(end.playerVisible)
    for(let i=1;i<samples.length;i++)assert(target==='day'?samples[i].daylight>=samples[i-1].daylight:samples[i].daylight<=samples[i-1].daylight)
    assert(samples.some(s=>s.sunPosition[1]<0)&&samples.some(s=>s.sunPosition[1]>0))
    await shot(`${from}-returned`)
    report.checks.push({name:`${from}-to-${target}`,samples,end})
  }
  for(const [from,code,keyName] of [['day','KeyF','f'],['night','Escape','Escape']]){
    await fixture(from);await key('KeyF','f');await waitFor("forestStore.getState().mode==='sleeping'");await key(code,keyName);await sleep(200)
    const q=await qa();assert.equal(q.mode,'walking');assert.equal(q.timeOfDay,from==='day'?'night':'day');report.checks.push({name:`skip-${code}`,qa:q})
  }
  await cmd('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]})
  await fixture('night');await key('KeyF','f');await waitFor("forestStore.getState().sleepElapsed>8")
  const reduced=await env();assert(reduced.reduced);assert(reduced.daylight>0&&reduced.daylight<1);await shot('reduced-motion');report.checks.push({name:'reduced-motion',env:reduced})
  await evaluate("document.querySelector('.sleep-panel button').click()");await sleep(200);assert.equal((await qa()).timeOfDay,'day')
  await fixture('day');await key('KeyF','f');await waitFor("forestStore.getState().mode==='sleeping'");await key('Escape','Escape');await cmd('Page.reload');await sleep(4500)
  assert.equal((await qa()).timeOfDay,'night');report.checks.push({name:'persist-reload',qa:await qa()})
  assert.equal(report.errors.length,0,report.errors.join('\n'));report.status='PASS'
}finally{try{await writeFile(`${out}/headless-validation.json`,JSON.stringify(report,null,2))}finally{socket?.close();await cleanup()}}
