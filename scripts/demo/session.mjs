// Shared driver for the demo-video recording scripts: isolated muted headless Edge (browser-session.mjs),
// real key events over CDP, and a screencast recorder that writes JPEG frames with their timestamps.
import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createHeadlessBrowser } from '../browser-session.mjs'

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

export async function openSession({ width = 1920, height = 1080, base = process.env.FOREST_URL ?? 'http://127.0.0.1:5176/' } = {}) {
  const { profile, cleanup } = await createHeadlessBrowser([
    '--headless=new', '--disable-features=CalculateNativeWinOcclusion', '--disable-gpu-vsync', '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding', '--remote-debugging-port=0', '--no-first-run', '--no-default-browser-check', 'about:blank',
  ])
  let socket, sequence = 0
  const pending = new Map()
  const errors = []
  const frameListeners = new Set()
  const cmd = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++sequence
    const timer = setTimeout(() => { pending.delete(id); reject(Error(`CDP timeout: ${method}`)) }, 60000)
    pending.set(id, (m) => { clearTimeout(timer); if (m.error) reject(Error(JSON.stringify(m.error))); else resolve(m.result) })
    socket.send(JSON.stringify({ id, method, params }))
  })
  try {
    let port
    for (let i = 0; i < 100 && !port; i++) { try { port = (await readFile(`${profile}/DevToolsActivePort`, 'utf8')).split('\n')[0] } catch { await sleep(200) } }
    assert(port, 'Headless Edge did not expose its isolated debug port')
    const target = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json()
    socket = new WebSocket(target.webSocketDebuggerUrl)
    socket.onmessage = ({ data }) => {
      const m = JSON.parse(data)
      if (pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) }
      if (m.method === 'Page.screencastFrame') for (const f of frameListeners) f(m.params)
      if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails?.exception?.description ?? m.params.exceptionDetails?.text)
      if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push(m.params.args.map((a) => a.value ?? a.description).join(' '))
    }
    await new Promise((r, j) => { socket.addEventListener('open', r, { once: true }); socket.addEventListener('error', j, { once: true }) })
    await cmd('Page.enable'); await cmd('Runtime.enable'); await cmd('Page.bringToFront'); await cmd('Emulation.setFocusEmulationEnabled', { enabled: true })
    await cmd('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false })
  } catch (error) { await cleanup(); throw error }

  const evaluate = async (expression) => {
    const r = await cmd('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
    if (r.exceptionDetails) throw Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text)
    return r.result?.value
  }
  const keys = { w: ['KeyW', 87], s: ['KeyS', 83], a: ['KeyA', 65], d: ['KeyD', 68], f: ['KeyF', 70], r: ['KeyR', 82], b: ['KeyB', 66], p: ['KeyP', 80], q: ['KeyQ', 81], e: ['KeyE', 69], v: ['KeyV', 86], Shift: ['ShiftLeft', 16], ' ': ['Space', 32], Escape: ['Escape', 27], 1: ['Digit1', 49], 2: ['Digit2', 50], 3: ['Digit3', 51], 4: ['Digit4', 52] }
  const key = (name, down) => cmd('Input.dispatchKeyEvent', { type: down ? 'keyDown' : 'keyUp', key: name === ' ' ? ' ' : name, code: keys[name][0], windowsVirtualKeyCode: keys[name][1] })
  const press = async (k) => { await key(k, true); await sleep(60); await key(k, false) }
  // Waits on game time (requestAnimationFrame), not wall time, so a slow frame cannot shorten a key hold.
  const frames = (ms) => evaluate(`new Promise(resolve=>{let last=performance.now(),elapsed=0;function frame(t){elapsed+=Math.min(t-last,50);last=t;if(elapsed>=${ms})resolve();else requestAnimationFrame(frame)}requestAnimationFrame(frame)})`)
  const hold = async (names, ms) => { const list = [].concat(names); for (const n of list) await key(n, true); await frames(ms); for (const n of list) await key(n, false) }
  const snapshot = () => evaluate("JSON.parse(document.querySelector('canvas')?.dataset.forestQa || 'null')")
  const waitFor = async (expression, label, tries = 400) => { for (let i = 0; i < tries; i++) { if (await evaluate(expression)) return; await sleep(100) } throw Error('Timed out: ' + label) }
  const waitState = async (predicate, label, tries = 400) => { for (let i = 0; i < tries; i++) { const s = await snapshot(); if (s && predicate(s)) return s; await sleep(50) } throw Error('Timed out: ' + label) }
  const click = async (selector, text = '') => {
    const box = await evaluate(`(()=>{const e=[...document.querySelectorAll(${JSON.stringify(selector)})].find(b=>!${JSON.stringify(text)}||b.textContent.includes(${JSON.stringify(text)}));if(!e)return null;const r=e.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`)
    assert(box, `Missing ${selector} ${text}`)
    for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) await cmd('Input.dispatchMouseEvent', { type, x: box.x, y: box.y, button: 'left', buttons: type === 'mousePressed' ? 1 : 0, clickCount: 1 })
  }
  const boot = async (query = '?qa') => {
    await cmd('Page.navigate', { url: `${base}${query}` })
    await sleep(500)
    await waitFor("!!document.querySelector('canvas')&&!document.querySelector('.asset-loading')&&!document.querySelector('.world-error')", 'scene ready', 1800)
    await waitFor("JSON.parse(document.querySelector('canvas')?.dataset.forestQa||'null')?.ready===true", 'raccoon ready', 1800)
    await sleep(1500)
    await evaluate(`(async()=>{const r=p=>performance.getEntriesByType('resource').find(e=>new URL(e.name).pathname===p).name
      window.forestStore=(await import(r('/src/game/store.ts'))).useForestStore
      window.uiStore=(await import(r('/src/game/uiStore.ts'))).useUiStore
      window.expansion=await import(r('/src/game/expansion.ts'))
      window.worldConfig=await import(r('/src/world/worldConfig.ts'))
      window.rowingMod=await import(r('/src/game/rowing.ts'))
      window.travelMod=await import(r('/src/game/islandTravel.ts'))})()`)
    await evaluate("uiStore.setState({guideSeen:true,panel:null})")
  }

  // Screencast recorder: frames land in dir/NNNNNN.jpg, timestamps (seconds) are returned for ffmpeg's concat list.
  async function record(dir, { quality = 92 } = {}) {
    await mkdir(dir, { recursive: true })
    const stamps = []
    let writing = Promise.resolve(), n = 0
    const listener = (p) => {
      const name = `${String(n++).padStart(6, '0')}.jpg`
      stamps.push({ name, t: p.metadata.timestamp })
      writing = writing.then(() => writeFile(`${dir}/${name}`, Buffer.from(p.data, 'base64')))
      cmd('Page.screencastFrameAck', { sessionId: p.sessionId }).catch(() => {})
    }
    frameListeners.add(listener)
    await cmd('Page.startScreencast', { format: 'jpeg', quality, maxWidth: width, maxHeight: height, everyNthFrame: 1 })
    const markFrom = marks.length
    return async () => {
      await cmd('Page.stopScreencast'); frameListeners.delete(listener); await writing
      await writeFile(`${dir}/stamps.json`, JSON.stringify(stamps))
      await writeFile(`${dir}/marks.json`, JSON.stringify(marks.slice(markFrom)))
      return stamps
    }
  }
  // Event markers (seconds, same wall clock as screencast timestamps) so SFX and captions can be placed afterwards.
  const marks = []
  const mark = (name) => { marks.push({ name, t: Date.now() / 1000 }) }
  const angleDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b))
  const mouse = (type, x, y, buttons = 2) => cmd('Input.dispatchMouseEvent', { type, x, y, button: 'right', buttons, clickCount: 1 })
  // Smooth walking: W held the whole way, the camera swings toward each waypoint with a right-button drag in small steps
  // (the game moves relative to the camera, so steering the camera is how a player turns).
  async function walkPath(points, { run = false, radius = 0.7, finalRadius = 0.3, limit = 40000 } = {}) {
    // The game ignores W while the right button is held, so each correction is a press-nudge-release.
    const cx = width / 2, cy = height / 2
    if (run) await key('Shift', true)
    await key('w', true)
    try {
      for (let i = 0; i < points.length; i++) {
        const [x, z] = points[i], last = i === points.length - 1, t0 = Date.now()
        for (;;) {
          const q = await snapshot(), dx = x - q.position[0], dz = z - q.position[2], dist = Math.hypot(dx, dz)
          if (dist < (last ? finalRadius : radius)) break
          if (Date.now() - t0 > limit) throw Error(`walkPath stuck near ${JSON.stringify({ x, z, at: q.position })}`)
          const err = angleDiff(Math.atan2(-dx, -dz), q.orbit.targetYaw ?? q.orbit.yaw)
          if (Math.abs(err) > 0.03) {
            const step = Math.max(-60, Math.min(60, (err / 0.004) * 0.3))
            await mouse('mousePressed', cx, cy); await mouse('mouseMoved', cx + step, cy); await mouse('mouseReleased', cx + step, cy, 0)
          }
          await sleep(40)
        }
      }
    } finally {
      await key('w', false); if (run) await key('Shift', false)
    }
  }
  // Swing the camera to a heading with small right-button nudges (same trick as walkPath).
  async function faceCamera(yaw, { tolerance = 0.05, limit = 15000 } = {}) {
    const cx = width / 2, cy = height / 2, t0 = Date.now()
    for (;;) {
      const q = await snapshot(), err = angleDiff(yaw, q.orbit.targetYaw ?? q.orbit.yaw)
      if (Math.abs(err) < tolerance || Date.now() - t0 > limit) return
      const step = Math.max(-40, Math.min(40, (err / 0.004) * 0.12))
      await mouse('mousePressed', cx, cy); await mouse('mouseMoved', cx + step, cy); await mouse('mouseReleased', cx + step, cy, 0)
      await sleep(45)
    }
  }
  const wheel = (deltaY) => cmd('Input.dispatchMouseEvent', { type: 'mouseWheel', x: width / 2, y: height / 2, deltaX: 0, deltaY })
  const close = async () => {
    try {
      if (socket?.readyState === 1) { try { await cmd('Browser.close') } catch { /* closing can precede the response */ } socket.close() }
    } finally { await cleanup() }
  }
  return { cmd, evaluate, key, press, frames, hold, snapshot, waitFor, waitState, click, boot, record, close, errors, sleep, mark, walkPath, faceCamera, wheel, angleDiff, width, height }
}
