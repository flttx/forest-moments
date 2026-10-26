// Isolated headless Edge only. Compares what is drawn with where the raccoon may stand.
// Every visible mesh is sampled within the raccoon's body band (0.15-1.1 m above the ground) onto a
// 10 cm grid, then checked against the game's own stand rules:
//   - penetration: a standable cell with drawn geometry within 0.2 m (the body would pass through it);
//   - invisible wall: a blocked cell with nothing drawn within 0.5 m, on otherwise walkable ground.
// Run against the dev server on 5176 (needs ?qa, which exposes window.forestScene).
import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createHeadlessBrowser } from './browser-session.mjs'

const out = resolve(process.env.FOREST_QA_OUT ?? 'docs/evidence/2026-10-26-collision-audit/before')
await mkdir(out, { recursive: true })
const { profile, cleanup } = await createHeadlessBrowser([
  '--headless=new', '--disable-features=CalculateNativeWinOcclusion', '--disable-frame-rate-limit', '--disable-gpu-vsync', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--remote-debugging-port=0', '--no-first-run', '--no-default-browser-check', 'about:blank',
])
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const report = { date: new Date().toISOString(), mode: 'isolated headless Edge', audits: {}, errors: [], status: 'RUNNING' }
let socket, sequence = 0
const pending = new Map()
function cmd(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++sequence
    const timer = setTimeout(() => { pending.delete(id); reject(Error(`CDP timeout: ${method}`)) }, 300000)
    pending.set(id, (m) => { clearTimeout(timer); if (m.error) reject(Error(JSON.stringify(m.error))); else resolve(m.result) })
    socket.send(JSON.stringify({ id, method, params }))
  })
}
async function evaluate(expression) {
  const r = await cmd('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  if (r.exceptionDetails) throw Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text)
  return r.result?.value
}

/** Runs in the page. Returns per-object penetration and per-rule invisible-wall summaries plus a map image. */
function auditInPage({ root, bounds, kind, cell }) {
  const { M, E, WI, S, C, P, T } = window.audit
  const scene = window.forestScene, state = S.useForestStore.getState()
  const [minX, maxX, minZ, maxZ] = bounds, nx = Math.round((maxX - minX) / cell), nz = Math.round((maxZ - minZ) / cell)
  const index = (x, z) => { const i = Math.floor((x - minX) / cell), k = Math.floor((z - minZ) / cell); return i < 0 || k < 0 || i >= nx || k >= nz ? -1 : k * nx + i }
  const centre = (c) => [minX + (c % nx + .5) * cell, minZ + (Math.floor(c / nx) + .5) * cell]
  const groundCache = new Float32Array(nx * nz).fill(NaN)
  const ground = (c) => { if (Number.isNaN(groundCache[c])) { const [x, z] = centre(c); groundCache[c] = kind === 'island' ? M.groundHeightAt(x, z) : 0 } return groundCache[c] }
  const treeRadius = state.tree ? [.06, .11, .19, .32][state.tree.stage] : 0
  const stand = kind === 'island' ? (x, z) => M.canStandAt(x, z, treeRadius, state.workshopBook.phase)
    : kind === 'workshop' ? (x, z) => WI.canStandInWorkshop(x, z, state.workshopBook.phase === 'finished') : (x, z) => E.canStandInBedroom(x, z)
  // Not solid by design: ground, water, sky, effects, and grass and reeds the raccoon wades through.
  const skip = /island-terrain|painted-sky|^ocean|fresh-water|woodland-creek|ambient-life|boat-water-feedback|fishing-tools|campfire-embers|pond-lily-pads|GroundCover|pond-reeds/
  const labels = [], labelOf = new Map(), occ = new Int32Array(nx * nz).fill(-1)
  const rootObject = scene.getObjectByName(root)
  const v = new rootObject.position.constructor(), m = new rootObject.matrixWorld.constructor(), im = new rootObject.matrixWorld.constructor()
  let triangles = 0, samples = 0
  rootObject.updateWorldMatrix(true, true)
  // Trees swap to a coarse LOD mesh far from the camera; up close, where the raccoon actually meets them,
  // the full mesh is drawn. Always measure the full mesh and skip the LOD stand-ins.
  const shown = (o) => { for (let p = o; p && p !== rootObject; p = p.parent) if (!p.visible && !(p === o && /^(?!lod-).+-[-0-9]+,[-0-9]+$/.test(o.name))) return false; return true }
  rootObject.traverse((o) => {
    if (!o.isMesh || o.isSkinnedMesh || !o.geometry?.attributes?.position || /^lod-/.test(o.name) || !shown(o)) return
    const chain = []; for (let p = o; p && p !== rootObject; p = p.parent) if (p.name) chain.unshift(p.name)
    let label = chain.length ? (chain.length > 1 ? `${chain[0]} › ${chain[chain.length - 1]}` : chain[0]) : '(unnamed)'
    // Generic export names (geometry_0, unnamed meshes) are told apart by where the object stands.
    if (!chain.length || /geometry_\d+$/.test(label)) { const w = new rootObject.position.constructor().setFromMatrixPosition(o.matrixWorld); label += ` @${w.x.toFixed(0)},${w.z.toFixed(0)} ${o.geometry.type}` }
    if (skip.test(label) || chain.some((n) => skip.test(n))) return
    if (!labelOf.has(label)) { labelOf.set(label, labels.length); labels.push(label) }
    const id = labelOf.get(label), pos = o.geometry.attributes.position, idx = o.geometry.index
    const count = o.isInstancedMesh ? o.count : 1
    const world = new Float32Array(pos.count * 3)
    for (let n = 0; n < count; n++) {
      m.copy(o.matrixWorld); if (o.isInstancedMesh) { o.getMatrixAt(n, im); m.multiply(im) }
      for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i).applyMatrix4(m); world[i * 3] = v.x; world[i * 3 + 1] = v.y; world[i * 3 + 2] = v.z }
      const tris = idx ? idx.count / 3 : pos.count / 3
      for (let t = 0; t < tris; t++) {
        const a = idx ? idx.getX(t * 3) : t * 3, b = idx ? idx.getX(t * 3 + 1) : t * 3 + 1, c = idx ? idx.getX(t * 3 + 2) : t * 3 + 2
        const ax = world[a * 3], ay = world[a * 3 + 1], az = world[a * 3 + 2], bx = world[b * 3], by = world[b * 3 + 1], bz = world[b * 3 + 2], cx = world[c * 3], cy = world[c * 3 + 1], cz = world[c * 3 + 2]
        const cc = index((ax + bx + cx) / 3, (az + bz + cz) / 3); if (cc < 0) continue
        const g = ground(cc)
        if (Math.max(ay, by, cy) < g - .2 || Math.min(ay, by, cy) > g + 1.6) continue
        triangles++
        const n2 = Math.min(300, Math.ceil(Math.max(Math.hypot(bx - ax, bz - az, by - ay), Math.hypot(cx - ax, cz - az, cy - ay), Math.hypot(cx - bx, cz - bz, cy - by)) / (cell / 2)))
        for (let i = 0; i <= n2; i++) for (let j = 0; j <= n2 - i; j++) {
          const u = i / n2, w = j / n2, x = ax + (bx - ax) * u + (cx - ax) * w, y = ay + (by - ay) * u + (cy - ay) * w, z = az + (bz - az) * u + (cz - az) * w
          const k = index(x, z); if (k < 0) continue
          const h = y - ground(k); samples++
          if (h >= .15 && h <= 1.1 && occ[k] < 0) occ[k] = id
        }
      }
    }
  })
  // Stand grid and per-rule reasons for blocked cells (island mirrors canStandAt's order).
  const free = new Uint8Array(nx * nz)
  for (let c = 0; c < nx * nz; c++) { const [x, z] = centre(c); free[c] = stand(x, z) ? 1 : 0 }
  const r = .28
  // Island reasons come from the game itself (movement.standBlocker), so the audit never drifts from the rules.
  const reason = (x, z) => {
    if (kind === 'workshop') { const b = window.audit.workshopBoxes.find((b) => Math.hypot(Math.max(b.minX - x, 0, x - b.maxX), Math.max(b.minZ - z, 0, z - b.maxZ)) < r); return b ? b.name : 'room/piece' }
    if (kind === 'bedroom') return 'bedroom box'
    if (M.standBlocker) return M.standBlocker(x, z, treeRadius, state.workshopBook.phase) ?? 'unknown'
    // Builds before standBlocker existed: tell ground limits (same formulas as canStandAt) from object colliders.
    if (E.creekDistance(x, z) < 1.45 && !E.onBridge(x, z, r)) return 'terrain:creek'
    if (!C.isDockSurface(x, z, r) && !E.onBridge(x, z)) {
      const h = T.terrainHeight(x, z); if (h < C.seaLevel + .16 || Math.hypot(x, z) > C.islandShape.coastRadius + 2) return 'terrain:water'
      if (Math.hypot(T.terrainHeight(x + .15, z) - T.terrainHeight(x - .15, z), T.terrainHeight(x, z + .15) - T.terrainHeight(x, z - .15)) / .3 > .85) return 'terrain:slope'
      if (P.pondEdgeDistance(x, z) < r) return 'terrain:pond'
    }
    return 'object (unlabelled build)'
  }
  const near = (c, radius) => { const found = new Map(), [x, z] = centre(c), k = Math.ceil(radius / cell); for (let dz = -k; dz <= k; dz++) for (let dx = -k; dx <= k; dx++) { if (Math.hypot(dx, dz) * cell > radius) continue; const q = index(x + dx * cell, z + dz * cell); if (q >= 0 && occ[q] >= 0) { const d = Math.hypot(dx, dz) * cell; if (!found.has(occ[q]) || found.get(occ[q]) > d) found.set(occ[q], d) } } return found }
  const pen = new Map(), walls = new Map(), image = new Uint8ClampedArray(nx * nz * 4)
  for (let c = 0; c < nx * nz; c++) {
    let colour = occ[c] >= 0 ? [90, 90, 90] : free[c] ? [235, 232, 220] : [170, 190, 170]
    const [x, z] = centre(c)
    if (free[c]) {
      // Within 0.1 m the body clearly passes through; 0.1-0.2 m it only brushes the surface.
      for (const [id, d] of near(c, .2)) { const e = pen.get(id) ?? { cells: 0, deep: 0, min: 9, at: [] }; e.cells++; if (d <= .1) e.deep++; e.min = Math.min(e.min, d); if (d <= .1 && e.deep % 25 === 1 && e.at.length < 6) e.at.push(centre(c).map((n) => +n.toFixed(2))); pen.set(id, e); colour = d <= .1 ? [220, 40, 40] : [240, 150, 60] }
    } else if (occ[c] < 0) {
      const why = reason(x, z)
      // Only the edge the raccoon can actually bump into: a standable cell right next to this one.
      const edge = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => { const q = index(x + dx * cell, z + dz * cell); return q >= 0 && free[q] })
      if (edge && !why.startsWith('terrain:') && near(c, .5).size === 0) { const e = walls.get(why) ?? { cells: 0, at: [] }; e.cells++; if (e.cells % 25 === 1 && e.at.length < 6) e.at.push([+x.toFixed(2), +z.toFixed(2)]); walls.set(why, e); colour = [40, 90, 230] }
    }
    const row = nz - 1 - Math.floor(c / nx), o = (row * nx + c % nx) * 4; image.set([...colour, 255], o)
  }
  const canvas = document.createElement('canvas'); canvas.width = nx; canvas.height = nz
  canvas.getContext('2d').putImageData(new ImageData(image, nx, nz), 0, 0)
  return {
    bounds, cell, triangles, samples, labels: labels.length,
    penetration: [...pen].map(([id, e]) => ({ label: labels[id], cells: e.cells, deepM2: +(e.deep * cell * cell).toFixed(2), brushM2: +((e.cells - e.deep) * cell * cell).toFixed(2), closest: +e.min.toFixed(2), at: e.at })).sort((a, b) => b.deepM2 - a.deepM2 || b.cells - a.cells),
    invisibleWalls: [...walls].map(([why, e]) => ({ rule: why, cells: e.cells, edgeM: +(e.cells * cell).toFixed(1), at: e.at })).sort((a, b) => b.cells - a.cells),
    map: canvas.toDataURL('image/png'),
  }
}

try {
  let port
  for (let i = 0; i < 100; i++) { try { port = (await readFile(`${profile}/DevToolsActivePort`, 'utf8')).split('\n')[0]; break } catch { await sleep(200) } }
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
  await cmd('Page.enable'); await cmd('Runtime.enable')
  await cmd('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false })
  await cmd('Page.navigate', { url: 'http://127.0.0.1:5176/?qa' })
  for (let i = 0; i < 400; i++) {
    if (await evaluate("!!window.forestScene&&!document.querySelector('.asset-loading')&&!document.querySelector('.world-error')") && i > 10) break
    if (i === 399) throw Error('Scene did not load'); await sleep(200)
  }
  const load = (p) => `(await import(performance.getEntriesByType('resource').find(e=>new URL(e.name).pathname==='${p}').name))`
  const modules = { M: '/src/game/movement.ts', E: '/src/game/expansion.ts', V: '/src/world/vegetationLayout.ts', F: '/src/game/farm.ts', W: '/src/game/workshop.ts', WI: '/src/game/workshopInterior.ts', G: '/src/game/growth.ts', C: '/src/world/worldConfig.ts', P: '/src/world/pondShape.ts', T: '/src/world/terrain.ts', A: '/src/world/assets.ts', S: '/src/game/store.ts' }
  await evaluate(`(async()=>{window.audit={${Object.entries(modules).map(([k, p]) => `${k}:${load(p)}`).join(',')}};window.audit.workshopBoxes=${load('/src/game/workshopColliders.json')}.default})()`)
  const run = async (name, setup, options) => {
    await evaluate(`window.audit.S.useForestStore.setState(${JSON.stringify({ mode: 'walking', fishing: null, sitting: null, workshopTransfer: null, homeTransfer: null, ...setup })})`)
    await sleep(1500)
    const started = Date.now(), result = await evaluate(`(${auditInPage.toString()})(${JSON.stringify(options)})`)
    await writeFile(`${out}/${name}-map.png`, Buffer.from(result.map.split(',')[1], 'base64')); delete result.map
    result.seconds = (Date.now() - started) / 1000; report.audits[name] = result
    console.log(`\n== ${name}: ${result.labels} objects, ${result.triangles} triangles in band, ${result.seconds}s`)
    for (const p of result.penetration) if (p.deepM2 > 0) console.log(`  penetration ${p.label}: ${p.deepM2} m² (+${p.brushM2} m² brushing), closest ${p.closest} m, e.g. ${JSON.stringify(p.at.slice(0, 3))}`)
    console.log(`  brushing only: ${result.penetration.filter((p) => !p.deepM2).map((p) => p.label).join('; ') || 'none'}`)
    for (const w of result.invisibleWalls) console.log(`  invisible wall ${w.rule}: ~${w.edgeM} m of edge, e.g. ${JSON.stringify(w.at.slice(0, 3))}`)
  }
  await run('island', { location: 'island', position: { x: 0, z: 0 } }, { root: 'island-exterior', bounds: [-46, 46, -46, 46], kind: 'island', cell: .1 })
  await run('workshop', { location: 'workshop', position: { x: 0, z: 1 } }, { root: 'workshop-interior', bounds: [-4.6, 4.6, -3.6, 3.6], kind: 'workshop', cell: .05 })
  await run('bedroom', { location: 'bedroom', position: { x: 0, z: 1.1 } }, { root: 'bedroom-interior', bounds: [-4.2, 4.2, -3.2, 3.2], kind: 'bedroom', cell: .05 })
  assert.equal(report.errors.length, 0, report.errors.join('\n'))
  report.status = 'DONE'
} finally { try { await writeFile(`${out}/audit.json`, JSON.stringify(report, null, 2)) } finally { socket?.close(); await cleanup() } }
