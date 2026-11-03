// Isolated headless Edge only (muted by browser-session). Archipelago plan stage 5: walk the west loop through the west
// woods with a real right-drag to turn the camera and W to walk, and after each step cast rays from the camera to the
// raccoon's chest and head to count how often a tree hides it. FOREST_QA_OUT picks the folder (before / after).
import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createHeadlessBrowser } from './browser-session.mjs'

const out = resolve(process.env.FOREST_QA_OUT ?? 'docs/evidence/2026-11-03-archipelago/phase5/before')
const base = process.env.FOREST_URL ?? 'http://127.0.0.1:5176/'
await mkdir(out, { recursive: true })
const { profile, cleanup } = await createHeadlessBrowser([
  '--headless=new', '--disable-features=CalculateNativeWinOcclusion', '--disable-frame-rate-limit', '--disable-gpu-vsync', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--remote-debugging-port=0', '--no-first-run', '--no-default-browser-check', 'about:blank',
])
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const report = { date: new Date().toISOString(), mode: 'isolated muted headless Edge', viewport: [1440, 900], samples: [], errors: [], screenshots: [], status: 'RUNNING' }
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
async function waitFor(expression, label, tries = 300) { for (let i = 0; i < tries; i++) { if (await evaluate(expression)) return; await sleep(100) } throw Error('Timed out: ' + label) }
async function shot(name) {
  const result = await cmd('Page.captureScreenshot', { format: 'png' })
  await writeFile(`${out}/${name}.png`, Buffer.from(result.data, 'base64'))
  report.screenshots.push(`${name}.png`)
}
const qa = () => evaluate("JSON.parse(document.querySelector('canvas').dataset.forestQa)")
// Rays from the camera to the raccoon's chest and head; the first thing hit that is not the raccoon (or the grass at
// its feet) names what hides it. Trees: the main kit chunks, their LOD twins and the island tree instances.
const sight = `(()=>{const T=window.__three,q=JSON.parse(document.querySelector('canvas').dataset.forestQa)
 const eye=new T.Vector3(...q.cameraPosition),raccoon=forestScene.getObjectByName('asset-raccoon'),ray=new T.Raycaster(),hits={}
 for(const [part,lift] of [['chest',.55],['head',.95]]){const to=new T.Vector3(q.position[0],q.position[1]+lift,q.position[2]),d=to.clone().sub(eye),len=d.length();ray.set(eye,d.normalize());ray.far=len-.15
  const hit=ray.intersectObjects(forestScene.children,true).find(h=>{let o=h.object;while(o){if(o===raccoon)return false;o=o.parent}return h.object.visible&&h.object.isMesh&&!/grass|ground-cover|flower/i.test(h.object.name)})
  hits[part]=hit?hit.object.name||hit.object.parent?.name||'unnamed':null}
 return{position:q.position,camera:q.cameraPosition,hits}})()`
const isTree = (name) => !!name && /pine|tree|bush|spruce|birch|maple|^lod-|^ie-|island-tree/i.test(name)

try {
  let port
  for (let i = 0; i < 100 && !port; i++) { try { port = (await readFile(`${profile}/DevToolsActivePort`, 'utf8')).split('\n')[0] } catch { await sleep(200) } }
  assert(port, 'Headless Edge did not expose its isolated debug port')
  const target = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json()
  socket = new WebSocket(target.webSocketDebuggerUrl)
  socket.onmessage = ({ data }) => {
    const m = JSON.parse(data)
    if (pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) }
    if (m.method === 'Runtime.exceptionThrown') report.errors.push(m.params.exceptionDetails?.exception?.description ?? m.params.exceptionDetails?.text)
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') report.errors.push(m.params.args.map((a) => a.value ?? a.description).join(' '))
  }
  await new Promise((r, j) => { socket.addEventListener('open', r, { once: true }); socket.addEventListener('error', j, { once: true }) })
  report.browser = (await cmd('Browser.getVersion')).product
  await cmd('Page.enable'); await cmd('Runtime.enable'); await cmd('Page.bringToFront'); await cmd('Emulation.setFocusEmulationEnabled', { enabled: true })
  await cmd('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })
  await cmd('Page.navigate', { url: base + 'fonts/LXGW-WenKai-OFL.txt' }); await sleep(500)
  await evaluate('localStorage.clear()')
  await cmd('Page.navigate', { url: `${base}?qa` })
  await waitFor("!!document.querySelector('canvas')&&!document.querySelector('.asset-loading')", 'scene', 1200)
  await waitFor("JSON.parse(document.querySelector('canvas').dataset.forestQa||'null')?.ready===true", 'raccoon', 1200)
  await evaluate(`(async()=>{const r=p=>performance.getEntriesByType('resource').find(e=>new URL(e.name).pathname===p).name
   window.forestStore=(await import(r('/src/game/store.ts'))).useForestStore
   window.uiStore=(await import(r('/src/game/uiStore.ts'))).useUiStore
   window.west=await import(r('/src/world/westExpansion.ts'))
   window.__three=await import(r('/node_modules/.vite/deps/three.js')).catch(()=>null)})()`)
  if (!await evaluate('!!window.__three')) await evaluate(`(async()=>{const e=performance.getEntriesByType('resource').find(e=>/\\/three\\.js/.test(new URL(e.name).pathname));window.__three=await import(e.name)})()`)
  assert(await evaluate('!!window.__three?.Raycaster'), 'three not reachable for raycasts')
  await waitFor("!document.querySelector('.guide')", 'guide', 150)
  // From the end of the wetland deck round the west loop through the woods to where it rejoins the old island.
  const points = await evaluate('west.westTrailPoints')
  const start = points.findIndex(([x, z]) => x === -67.4 && z === -3.4), route = points.slice(start, points.findIndex(([x, z]) => x === -33 && z === 14) + 1)
  assert(route.length >= 4, JSON.stringify(route))
  await evaluate(`forestStore.setState({position:{x:${route[0][0]},z:${route[0][1]}},mode:'walking',timeOfDay:'day',location:'island'});uiStore.setState({panel:null,guideSeen:true})`)
  await sleep(1200)
  let index = 0, closeShots = 0
  for (const [tx, tz] of route.slice(1)) {
    for (let burst = 0; burst < 60; burst++) {
      const q = await qa(), [px, , pz] = q.position
      const s = await evaluate(sight); report.samples.push(s)
      if ((s.hits.chest && isTree(s.hits.chest)) || (s.hits.head && isTree(s.hits.head))) { if (report.screenshots.length < 12) await shot(`hidden-${String(index++).padStart(2, '0')}`) }
      // and the views where the canopy has pulled the camera in close, to judge how they read
      const arm = Math.hypot(s.camera[0] - s.position[0], s.camera[1] - s.position[1] - .9, s.camera[2] - s.position[2])
      if (arm < 4 && closeShots < 6) await shot(`close-${String(closeShots++).padStart(2, '0')}-${arm.toFixed(1)}m`)
      if (Math.hypot(tx - px, tz - pz) < .6) break
      let d = Math.atan2(-(tx - px), -(tz - pz)) - q.orbit.yaw; d = Math.atan2(Math.sin(d), Math.cos(d))
      if (Math.abs(d) > .05) {
        await cmd('Input.dispatchMouseEvent', { type: 'mousePressed', x: 720, y: 450, button: 'right', buttons: 2, clickCount: 1 })
        await cmd('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 720 + d / .004, y: 450, button: 'right', buttons: 2 })
        await cmd('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 720 + d / .004, y: 450, button: 'right', buttons: 0, clickCount: 1 })
        await sleep(300)
      }
      await cmd('Input.dispatchKeyEvent', { type: 'keyDown', code: 'KeyW', key: 'w', windowsVirtualKeyCode: 87 })
      await sleep(Math.min(500, 150 + 160 * Math.hypot(tx - px, tz - pz)))
      await cmd('Input.dispatchKeyEvent', { type: 'keyUp', code: 'KeyW', key: 'w', windowsVirtualKeyCode: 87 })
      await sleep(250)
    }
  }
  const last = report.samples.at(-1).position, end = route.at(-1)
  assert(Math.hypot(last[0] - end[0], last[2] - end[1]) < 1.2, `did not reach the end: ${JSON.stringify(last)}`)
  const hidden = report.samples.filter(s => isTree(s.hits.chest) || isTree(s.hits.head)), chestHidden = report.samples.filter(s => isTree(s.hits.chest))
  report.summary = {
    samples: report.samples.length, hiddenAny: hidden.length, hiddenChest: chestHidden.length,
    hiddenShare: +(hidden.length / report.samples.length).toFixed(3),
    by: Object.fromEntries(Object.entries(hidden.reduce((m, s) => { const k = (isTree(s.hits.chest) ? s.hits.chest : s.hits.head).replace(/-\d+,-?\d+$/, ''); m[k] = (m[k] ?? 0) + 1; return m }, {}))),
    other: [...new Set(report.samples.flatMap(s => Object.values(s.hits)).filter(n => n && !isTree(n)))],
  }
  console.log(JSON.stringify(report.summary))
  assert.deepEqual(report.errors, []); report.status = 'PASS'
} catch (error) {
  report.status = 'FAIL'; report.failure = String(error); process.exitCode = 1
  if (socket?.readyState === 1) { try { await shot('failure') } catch { /* Original error stays in report. */ } }
} finally {
  try {
    await writeFile(`${out}/report.json`, JSON.stringify(report, null, 2) + '\n')
    if (socket?.readyState === 1) { try { await cmd('Browser.close') } catch { /* Closing the socket can precede the response. */ } socket.close() }
    console.log(report.status, report.failure ?? '')
  } finally {
    await cleanup()
  }
}
