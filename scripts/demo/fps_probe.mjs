// Probe: how many frames per second the CDP screencast delivers at 1920x1080 while the raccoon walks.
import { resolve } from 'node:path'
import { openSession } from './session.mjs'

const out = resolve(process.env.DEMO_OUT ?? '.tmp/demo-probe')
const s = await openSession()
try {
  await s.boot()
  await s.waitFor("!document.querySelector('.guide')", 'guide folds away', 150).catch(() => {})
  const stop = await s.record(out)
  const t0 = Date.now()
  await s.hold(['w'], 6000)
  const stamps = await stop()
  const secs = (Date.now() - t0) / 1000
  const span = stamps.at(-1).t - stamps[0].t
  console.log(JSON.stringify({ frames: stamps.length, wallSeconds: +secs.toFixed(1), screencastSpan: +span.toFixed(1), fps: +(stamps.length / span).toFixed(1), errors: s.errors.length }))
} finally {
  await s.close()
}
