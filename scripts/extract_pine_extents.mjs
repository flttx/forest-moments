// Measures how far the pine's foliage reaches from the trunk, per direction and height, and writes src/world/pine-extents.json.
// Reads the instanced pine geometry from the running dev scene (the GLB is meshopt-compressed). Run against the dev server on 5176.
import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createHeadlessBrowser } from './browser-session.mjs'

const out = resolve(process.env.FOREST_QA_OUT ?? '.tmp/pine-extents')
const base = process.env.FOREST_URL ?? 'http://127.0.0.1:5176/'
await mkdir(out, { recursive: true })
const { profile, cleanup } = await createHeadlessBrowser([
  '--headless=new', '--disable-features=CalculateNativeWinOcclusion', '--disable-frame-rate-limit', '--disable-gpu-vsync', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--remote-debugging-port=0', '--no-first-run', '--no-default-browser-check', 'about:blank',
])
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const report = { date: new Date().toISOString(), checks: [], errors: [], screenshots: [], status: 'RUNNING' }
let socket, seq = 0
const pending = new Map()
const cmd = (method, params = {}) => new Promise((ok, fail) => {
  const id = ++seq, timer = setTimeout(() => { pending.delete(id); fail(Error('CDP timeout ' + method)) }, 45000)
  pending.set(id, (m) => { clearTimeout(timer); if (m.error) fail(Error(JSON.stringify(m.error))); else ok(m.result) })
  socket.send(JSON.stringify({ id, method, params }))
})
const evaluate = async (expression) => {
  const r = await cmd('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  if (r.exceptionDetails) throw Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text)
  return r.result?.value
}
const ready = "!!document.querySelector('canvas')&&!document.querySelector('.asset-loading')&&!document.querySelector('.world-error')"
const waitFor = async (expression, label, tries = 200) => { for (let i = 0; i < tries; i++) { if (await evaluate(expression)) return; await sleep(100) } throw Error('Timed out: ' + label) }
async function boot(width, height, fresh = false) {
  await cmd('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false })
  if (fresh) await evaluate('localStorage.clear()').catch(() => {})
  await cmd('Page.navigate', { url: `${base}?qa` })
  await sleep(500); await waitFor(ready, 'scene ready', 400); await sleep(1500)
  await evaluate(`(async()=>{const r=p=>performance.getEntriesByType('resource').find(e=>new URL(e.name).pathname===p).name;window.forestStore=(await import(r('/src/game/store.ts'))).useForestStore;window.uiStore=(await import(r('/src/game/uiStore.ts'))).useUiStore;window.photoStore=(await import(r('/src/game/photoStore.ts'))).usePhotoStore;window.journalStore=(await import(r('/src/game/journalStore.ts'))).useJournalStore;window.photoAlbum=await import(r('/src/game/photoAlbum.ts'))})()`)
}

try {
  let port
  for (let i = 0; i < 100 && !port; i++) { try { port = (await readFile(`${profile}/DevToolsActivePort`, 'utf8')).split('\n')[0] } catch { await sleep(200) } }
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
  await cmd('Page.navigate', { url: base }); await sleep(800)

  await boot(1440, 900, true)
  const sectors = 32, binHeight = 0.05
  const table = await evaluate(`(()=>{
    const S=${sectors},H=${binHeight};let mesh
    window.forestScene.traverse(o=>{if(!mesh&&o.isInstancedMesh&&o.name.startsWith('normal-pine-b')&&o.geometry.getAttribute('position').count===8273)mesh=o})
    if(!mesh)return null
    const g=mesh.geometry,pos=g.getAttribute('position'),idx=g.index,v=i=>[pos.getX(i),pos.getY(i),pos.getZ(i)]
    let top=0;for(let i=0;i<pos.count;i++)top=Math.max(top,pos.getY(i))
    const bins=Math.ceil(top/H)+1,t=Array.from({length:bins},()=>new Array(S).fill(0))
    const put=p=>{const y=Math.floor(p[1]/H);if(y<0||y>=bins)return;const r=Math.hypot(p[0],p[2]),s=Math.floor(((Math.atan2(p[2],p[0])+Math.PI)/(2*Math.PI))*S)%S;if(r>t[y][s])t[y][s]=r}
    for(let k=0;k<idx.count;k+=3){
      const A=v(idx.getX(k)),B=v(idx.getX(k+1)),C=v(idx.getX(k+2))
      const long=Math.max(Math.hypot(A[0]-B[0],A[1]-B[1],A[2]-B[2]),Math.hypot(A[0]-C[0],A[1]-C[1],A[2]-C[2]),Math.hypot(B[0]-C[0],B[1]-C[1],B[2]-C[2]))
      const n=Math.min(40,Math.max(1,Math.ceil(long/0.02)))
      for(let i=0;i<=n;i++)for(let j=0;j<=n-i;j++){const a=i/n,b=j/n,c=1-a-b;put([A[0]*c+B[0]*a+C[0]*b,A[1]*c+B[1]*a+C[1]*b,A[2]*c+B[2]*a+C[2]*b])}
    }
    return{top,t:t.map(row=>row.map(x=>+x.toFixed(3)))}
  })()`)
  assert(table, 'pine mesh not found')
  const file = { note: 'Generated by scripts/extract_pine_extents.mjs from the normal-pine-b mesh: max distance from the trunk axis, per height bin (kit space) and direction sector.', sectors, binHeight, extents: table.t }
  await writeFile('src/world/pine-extents.json', JSON.stringify(file))
  console.log('bins', table.t.length, 'top', table.top)
  report.status = 'PASS'
} catch (e) {
  report.status = 'FAIL'; report.failure = e.stack ?? String(e); console.error(e); process.exitCode = 1
} finally {
  try { await writeFile(`${out}/report.json`, JSON.stringify(report, null, 2)) } finally { socket?.close(); await cleanup() }
}
