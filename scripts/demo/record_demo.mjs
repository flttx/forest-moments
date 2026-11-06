// Records the demo-video scenes from the real game: isolated muted headless Edge, real key presses (W/A/S/D/F/Space/Shift, B and digits),
// teleports only to place the raccoon at each scene's starting spot. Each scene becomes a frame folder under DEMO_OUT with stamps.json
// (frame timestamps) and marks.json (named events) for build_demo.mjs to assemble.
// ONLY=title,walkfish,... runs a subset. Dev server must be running (default http://127.0.0.1:5176/).
import { resolve } from 'node:path'
import { openSession, sleep } from './session.mjs'

const out = resolve(process.env.DEMO_OUT ?? '.tmp/demo')
const only = (process.env.ONLY ?? 'title,walkfish,falls,sand,sail,autumn,night').split(',')
const s = await openSession()
const place = (x, z, extra = {}) => s.evaluate(`forestStore.setState(${JSON.stringify({ location: 'island', mode: 'walking', nearby: null, menuPaused: false, position: { x, z }, ...extra })})`)

async function scene(name, body, warm, after) {
  if (!only.includes(name)) return
  console.log('scene', name)
  // Off the record: visit the area first so shader compiles and asset uploads do not stutter the footage.
  if (warm) await warm()
  const stop = await s.record(`${out}/${name}`)
  try { await body() } finally {
    const stamps = await stop()
    console.log(`  ${name}: ${stamps.length} frames, ${(stamps.at(-1).t - stamps[0].t).toFixed(1)} s`)
    if (after) await after()
  }
}

try {
  await s.boot()

  // Opening: close on the raccoon, then the camera backs out over the island (wheel = the game's own zoom).
  await scene('title', async () => {
    await place(-2, -2); await s.frames(1200)
    for (let i = 0; i < 62; i++) { await s.wheel(60); await sleep(105) }
    await s.frames(900)
  }, async () => {
    // Off the record: the first pull-back to the whole-island view compiles shaders and swaps in the distant tree models.
    for (let i = 0; i < 40; i++) { await s.wheel(110); await sleep(120) }
    await s.frames(2500)
    for (let i = 0; i < 60; i++) { await s.wheel(-400); await sleep(40) }
    await sleep(1500)
  }, async () => { for (let i = 0; i < 60; i++) { await s.wheel(-400); await sleep(40) } await sleep(1500) })

  // Walk from the workshop meadow to the pond, then a real catch: cast, bite, hook, tension, card.
  await scene('walkfish', async () => {
    await place(-6, 4); await s.frames(900)
    s.mark('walk')
    await s.walkPath([[-2.5, 0], [1.5, -5]], { radius: 0.9, finalRadius: 0.35 })
    await s.frames(500)
    s.mark('cast')
    await s.press('f')
    await s.waitState((q) => q.fishing?.phase === 'bite', 'bite', 600); s.mark('bite')
    await s.frames(350); await s.press('f')
    await s.waitState((q) => q.fishing?.phase === 'reeling', 'hook', 100); s.mark('reel')
    let held = false
    for (let i = 0; i < 600; i++) {
      const q = await s.snapshot()
      if (q.fishing.phase !== 'reeling') break
      const next = held ? q.fishing.tension < 0.72 : q.fishing.tension < 0.3
      if (next !== held) { held = next; await s.key(' ', held) }
      await sleep(50)
    }
    await s.key(' ', false)
    await s.waitState((q) => q.fishing?.phase === 'caught', 'catch', 100); s.mark('caught')
    await s.frames(2600)
    await s.press('Escape')
    await s.frames(500)
  }, async () => {
    for (const [x, z] of [[-6, 4], [1.5, -5], [-6, 4]]) { await place(x, z); await s.frames(2200) }
  })

  // Creek falls: the game's own observation cameras (the narrow gorge pushes the follow camera against the raccoon,
  // so a walk through it does not film well). Water, spray and light are live.
  const viewOf = (v) => s.evaluate(`history.replaceState(null,'','/?qa${v ? '&view=' + v : ''}');forestStore.setState({mode:'walking',location:'island',position:{x:0,z:0},nearby:null,menuPaused:false})`)
  await scene('falls', async () => {
    await viewOf('creekFalls'); await s.frames(300); s.mark('falls')
    await s.frames(6200)
    await viewOf('creekRim'); s.mark('rim')
    await s.frames(5200)
    await viewOf('')
  }, async () => { for (const v of ['creekFalls', 'creekRim', 'creekFalls']) { await viewOf(v); await s.frames(2500) } })

  // Sand play: paw prints, castle, pit, and a stream that lets the sea in.
  await scene('sand', async () => {
    await s.evaluate(`(async()=>{const r=p=>performance.getEntriesByType('resource').find(e=>new URL(e.name).pathname===p).name
      window.sandMod=await import(r('/src/game/sandStore.ts')); window.sandStore=sandMod.useSandStore})()`)
    const taps = { w: 'w', a: 'a', s: 's', d: 'd' }
    let seaward = 's', best = -Infinity
    for (const k of Object.keys(taps)) { await place(0, 30); await s.hold([k], 200); const z = await s.evaluate('forestStore.getState().position.z'); if (z > best) { best = z; seaward = k } }
    await place(-2.5, 28.5); await s.frames(800)
    s.mark('prints'); await s.hold([seaward], 1600)
    await s.press('b'); await s.frames(500)
    const reach = { castle: 1.25, river: 0.9, pit: 1.2 }
    const aim = async (kind, x, z) => { await s.hold([seaward], 120); await s.frames(100); const f = await s.evaluate('sandMod.sandAim.facing'); await place(x + Math.sin(f) * reach[kind], z + Math.cos(f) * reach[kind]); await s.frames(300) }
    const done = (n) => s.waitFor(`sandStore.getState().book.works.length===${n}&&!sandStore.getState().build`, 'work done', 100)
    await aim('castle', -4, 30); await s.press('1'); await s.frames(900)
    s.mark('castle'); await s.press('f'); await done(1); await s.frames(900)
    await aim('pit', 4, 30); await s.press('3'); await s.frames(700)
    s.mark('pit'); await s.press('f'); await done(2); await s.frames(700)
    await aim('river', 1, 33.2); await s.press('2'); await s.frames(700)
    s.mark('river'); await s.press('f'); await done(3); await s.frames(2800)
    s.mark('end')
    await s.press('Escape'); await s.frames(300)
    if (await s.evaluate('sandStore.getState().active')) await s.evaluate('sandStore.setState({active:false})')
  }, async () => { await place(-2.5, 28.5); await s.frames(3000) })

  // Row from the main jetty to Mist Isle with real W/A/D steering.
  await scene('sail', async () => {
    await place(0, 0)
    await s.evaluate("forestStore.setState({position:{...worldConfig.berths.main.landing},nearby:'dock',menuPaused:false})")
    await s.frames(900)
    s.mark('board'); await s.press('f')
    await s.waitState((q) => q.mode === 'rowing' && !q.boatTransfer, 'board main', 200)
    const sail = async (x, z, label) => {
      const t0 = Date.now()
      for (;;) {
        const q = await s.snapshot(), b = q.boat, dx = x - b.x, dz = z - b.z
        if (Math.hypot(dx, dz) < 0.27) break
        if (Date.now() - t0 > 65000) throw Error('Sailing blocked ' + label + JSON.stringify(b))
        const d = s.angleDiff(Math.atan2(-dz, dx), b.heading)
        await s.key('a', d > 0.025); await s.key('d', d < -0.025); await s.key('w', Math.abs(d) < 0.3)
        await sleep(35)
      }
      for (const k of ['w', 'a', 'd']) await s.key(k, false)
      await sleep(400)
    }
    const align = async (heading) => {
      const t0 = Date.now()
      for (;;) { const b = (await s.snapshot()).boat, d = s.angleDiff(heading, b.heading); if (Math.abs(d) < 0.025 || Date.now() - t0 > 16000) break; await s.key('a', d > 0); await s.key('d', d < 0); await sleep(35) }
      for (const k of ['a', 'd']) await s.key(k, false)
    }
    await sail(48, 2.15, 'leave jetty'); s.mark('channel'); await sail(56, -7, 'channel'); await sail(74, -12.15, 'approach')
    s.mark('approach'); await align(0); await sail(80.6, -12.15, 'berth'); await align(0)
    s.mark('berth'); await s.waitState((q) => q.canLand, 'can land', 200); await s.press('f')
    await s.waitState((q) => q.mode === 'walking' && !q.boatTransfer, 'land mist', 200)
    s.mark('landed'); await s.frames(2200)
  }, async () => {
    // Off the record: board and row a little so the boat, wake and water effects are compiled, then put everything back.
    await place(0, 0)
    await s.evaluate("forestStore.setState({position:{...worldConfig.berths.main.landing},nearby:'dock',menuPaused:false})"); await s.frames(500)
    await s.press('f'); await s.waitState((q) => q.mode === 'rowing' && !q.boatTransfer, 'warm board', 200)
    await s.hold(['w'], 3500); await s.hold(['a'], 1200)
    await s.evaluate("forestStore.setState({mode:'walking',boatTransfer:null,nearby:null,boat:{...rowingMod.initialBoat,...worldConfig.berths.main.mooring},position:{...worldConfig.berths.main.landing}})")
    await s.frames(1800)
  })

  // Autumn Isle in autumn colours: the real walk up to the maple hill.
  await scene('autumn', async () => {
    await s.evaluate(`(async()=>{const r=p=>performance.getEntriesByType('resource').find(e=>new URL(e.name).pathname===p).name
      window.autumnMod=await import(r('/src/world/autumnIsland.ts'))})()`)
    await s.evaluate("forestStore.setState(s=>({homeBook:{...s.homeBook,nights:9}}))"); await sleep(2500)
    await s.evaluate("uiStore.setState({panel:null})")
    const off = await s.evaluate('autumnMod.autumnOffset')
    await s.evaluate("forestStore.setState({location:'island',mode:'walking',menuPaused:false,nearby:null,travel:{...travelMod.emptyTravel(),checkpoint:'autumn',visitedMist:true,visitedAutumn:true},position:{...worldConfig.berths.autumn.landing}})")
    await sleep(3500); await s.frames(1200)
    s.mark('walk')
    await s.walkPath([[91.2, 33.1], [97, 33], [101, 24], [110, 20], [117, 24]].map(([x, z]) => [x + off.x, z + off.z]), { radius: 0.9, finalRadius: 0.4 })
    s.mark('vista'); await s.frames(2400)
  }, async () => {
    await s.evaluate(`(async()=>{const r=p=>performance.getEntriesByType('resource').find(e=>new URL(e.name).pathname===p).name
      window.autumnMod=await import(r('/src/world/autumnIsland.ts'))})()`)
    await s.evaluate("forestStore.setState(s=>({homeBook:{...s.homeBook,nights:9}}))"); await sleep(3500)
    await s.evaluate("uiStore.setState({panel:null})")
    const o = await s.evaluate('autumnMod.autumnOffset')
    for (const [x, z] of [[117, 24], [97, 33]]) { await place(x + o.x, z + o.z); await s.frames(3500) }
  })

  // Night at the camp: the fire is lit (fixture), the raccoon walks to the west bench, sits with F, and looks up with V.
  await scene('night', async () => {
    await s.evaluate("forestStore.setState({timeOfDay:'night'})"); await sleep(2500)
    await place(16, 20.5); await s.frames(1200)
    s.mark('walk'); await s.walkPath([[17.1, 22.4]], { radius: 0.5, finalRadius: 0.5 })
    await s.frames(400); s.mark('sit'); await s.press('f')
    await s.frames(2300); s.mark('turn'); await s.faceCamera(-Math.PI / 2); await s.frames(6200); s.mark('end')
  }, async () => {
    await s.evaluate("forestStore.setState(s=>({timeOfDay:'night',homeBook:{...s.homeBook,fireLit:true}}))"); await place(17, 22.8); await s.frames(4000)
  })
} finally {
  console.log('errors', s.errors.length, s.errors.slice(0, 3))
  await s.close()
}
