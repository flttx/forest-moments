// Assembles the demo video from the frame folders written by record_demo.mjs: per-segment speed changes and fades,
// bilingual ASS captions, an end card, and an audio mix from the game's own CC0 sound files (public/assets/audio).
// Usage: node scripts/demo/build_demo.mjs   (env DEMO_OUT, DEMO_NIGHT_OUT for the night clip, DEMO_VIDEO for the output file)
import { spawn } from 'node:child_process'
import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const root = resolve(process.env.DEMO_OUT ?? '.tmp/demo')
const nightRoot = resolve(process.env.DEMO_NIGHT_OUT ?? '.tmp/demo2')
const work = resolve('.tmp/demo-build')
const outFile = resolve(process.env.DEMO_VIDEO ?? 'docs/report/export/forest-moments-demo.mp4')
const audioDir = resolve('public/assets/audio')
const FPS = 30, FADE = 0.3, SR = 44100

// ---------- storyboard (clip-relative seconds; speed > 1 is faster) ----------
const groups = [
  { id: 'title', clip: 'title', root, segs: [[1.0, 3.1, 1], [4.4, 8.9, 1]], ambience: 'birds',
    caption: null },
  { id: 'walkfish', clip: 'walkfish', root, ambience: 'birds',
    segs: [[2.0, 14.2, 1.8, 'walk'], [14.6, 17.6, 1, 'cast'], [21.6, 23.2, 1, 'bite'], [23.2, 31.5, 1.5, 'reel'], [31.5, 34.7, 1, 'caught']],
    caption: ['漫步与钓鱼：真实抛竿、咬钩、拉力收线', 'Walk and fish: cast, wait for a bite, reel against line tension'] },
  { id: 'falls', clip: 'falls', root, ambience: 'sea',
    segs: [[0.5, 5.0, 1], [6.9, 11.2, 1]],
    caption: ['瀑布与水潭：溪流跌落成瀑，落入潭中', 'A creek tumbles over a ledge into a pool'] },
  { id: 'sand', clip: 'sand', root, ambience: 'sea',
    segs: [[1.8, 4.8, 1.3, 'prints'], [5.4, 9.2, 1.3, 'castle'], [11.6, 15.0, 1.3, 'pit'], [17.0, 21.2, 1.4, 'river']],
    caption: ['玩沙：脚印、沙堡、沙坑，再挖一条引海水的小河', 'Beach play: paw prints, castles, pits, and a stream that lets the sea in'] },
  { id: 'sail', clip: 'sail', root, ambience: 'sea',
    segs: [[0.8, 6.0, 1, 'row'], [6.0, 38.8, 6, 'row'], [38.8, 48.0, 1.3, 'row']],
    caption: ['划船出海，前往三座邻岛', 'Row out to the neighbouring islands'] },
  { id: 'autumn', clip: 'autumn', root, ambience: 'birds',
    segs: [[7.0, 14.0, 2, 'steps'], [14.0, 41.0, 4.5, 'steps'], [41.0, 46.9, 1.5]],
    caption: ['邻岛秋岚：叶色随季节变化', 'Autumn Isle: foliage follows the seasons'] },
  { id: 'night', clip: 'night', root: nightRoot, ambience: 'crickets', night: true,
    segs: [[9.3, 17.3, 1]],
    caption: ['夜晚的营地：篝火、长椅与路灯', 'Night at the camp: fire, bench and lantern light'] },
]
const END_SECONDS = 6
const TITLE = { zh: '森林拾光', en: 'Forest Moments', zhSub: '一座可以留下生活痕迹的海上森林小岛', enSub: 'A seaside forest island where daily life leaves its mark' }
const LINKS = ['https://flttxq-forest-moments.ms.fun', 'https://www.modelscope.ai/studios/flttxq/forest-moments']

const run = (cmd, args, { cwd, input } = {}) => new Promise((res, rej) => {
  const p = spawn(cmd, args, { cwd, stdio: ['pipe', 'pipe', 'pipe'] })
  const out = []; let err = ''
  p.stdout.on('data', (d) => out.push(d)); p.stderr.on('data', (d) => { err += d })
  p.on('error', rej)
  p.on('close', (c) => c === 0 ? res(Buffer.concat(out)) : rej(Error(`${cmd} exited ${c}\n${err.slice(-1500)}`)))
  if (input) p.stdin.end(input); else p.stdin.end()
})
const ff = (args, o) => run('ffmpeg', ['-v', 'error', '-y', ...args], o)

await rm(work, { recursive: true, force: true }); await mkdir(`${work}/seg`, { recursive: true }); await mkdir(`${work}/fonts`, { recursive: true })
for (const f of ['msyh.ttc', 'msyhbd.ttc']) await copyFile(`C:/Windows/Fonts/${f}`, `${work}/fonts/${f}`).catch(() => {})

// ---------- video segments ----------
const timeline = [] // { group, kind, start, dur }
let cursor = 0
const segFiles = []
for (const g of groups) {
  const stamps = JSON.parse(await readFile(`${g.root}/${g.clip}/stamps.json`, 'utf8'))
  const t0 = stamps[0].t, ts = stamps.map((s) => s.t - t0)
  const marks = JSON.parse(await readFile(`${g.root}/${g.clip}/marks.json`, 'utf8')).map((m) => ({ ...m, t: m.t - t0 }))
  g.marks = marks; g.out = []
  for (let i = 0; i < g.segs.length; i++) {
    const [a, b, speed, tag] = g.segs[i]
    let i0 = 0; while (i0 + 1 < ts.length && ts[i0 + 1] <= a) i0++
    let i1 = i0; while (i1 < ts.length && ts[i1] < b + 0.1) i1++
    const lines = []
    for (let k = i0; k < Math.min(i1 + 1, ts.length); k++) {
      const next = ts[k + 1] ?? ts[k] + 1 / FPS
      lines.push(`file '${g.root.replace(/\\/g, '/')}/${g.clip}/${stamps[k].name}'`, `duration ${Math.max(0.001, next - ts[k]).toFixed(4)}`)
    }
    const list = `${work}/seg/${g.id}-${i}.txt`; await writeFile(list, lines.join('\n'))
    const dur = (b - a) / speed
    const fades = []
    if (i === 0) fades.push(`fade=t=in:st=0:d=${FADE}`)
    if (i === g.segs.length - 1) fades.push(`fade=t=out:st=${(dur - FADE).toFixed(3)}:d=${FADE}`)
    const night = g.night ? ',eq=gamma=1.12:brightness=0.03' : ''
    const vf = [`trim=start=${(a - ts[i0]).toFixed(4)}:end=${(b - ts[i0]).toFixed(4)}`, `setpts=(PTS-STARTPTS)/${speed}`, `fps=${FPS}`, 'scale=1920:1080:flags=lanczos', 'format=yuv420p', ...fades].join(',') + night
    const file = `${work}/seg/${g.id}-${i}.mp4`
    await ff(['-f', 'concat', '-safe', '0', '-i', list, '-vf', vf, '-t', dur.toFixed(3), '-c:v', 'libx264', '-crf', '17', '-preset', 'medium', '-r', String(FPS), '-an', file])
    g.out.push({ a, b, speed, tag, start: cursor, dur })
    timeline.push({ group: g.id, tag, start: cursor, dur })
    segFiles.push(file); cursor += dur
    console.log(`seg ${g.id}-${i} ${dur.toFixed(2)} s`)
  }
  g.start = g.out[0].start; g.end = cursor
}

// End card: darkened, blurred last frame of the night clip with the links.
{
  const g = groups.at(-1), stamps = JSON.parse(await readFile(`${g.root}/${g.clip}/stamps.json`, 'utf8'))
  const last = `${g.root}/${g.clip}/${stamps.at(-1).name}`
  const file = `${work}/seg/end.mp4`
  await ff(['-loop', '1', '-framerate', String(FPS), '-i', last, '-t', String(END_SECONDS), '-vf',
    `scale=1920:1080,eq=brightness=-0.32:saturation=0.8,gblur=sigma=10,fade=t=in:st=0:d=${FADE},fade=t=out:st=${END_SECONDS - 0.5}:d=0.5,format=yuv420p`,
    '-c:v', 'libx264', '-crf', '17', '-r', String(FPS), file])
  segFiles.push(file); g.endStart = cursor; cursor += END_SECONDS
}
const total = cursor
console.log('total', total.toFixed(1), 's')
await writeFile(`${work}/concat.txt`, segFiles.map((f) => `file '${f.replace(/\\/g, '/')}'`).join('\n'))

// ---------- captions (ASS) ----------
const ts2 = (t) => { const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t - h * 3600 - m * 60; return `${h}:${String(m).padStart(2, '0')}:${s.toFixed(2).padStart(5, '0')}` }
const dlg = (a, b, style, text) => `Dialogue: 0,${ts2(a)},${ts2(b)},${style},,0,0,0,,${text}`
const ass = [
  '[Script Info]', 'ScriptType: v4.00+', 'PlayResX: 1920', 'PlayResY: 1080', 'WrapStyle: 0', 'ScaledBorderAndShadow: yes', '',
  '[V4+ Styles]', 'Format: Name,Fontname,Fontsize,PrimaryColour,SecondaryColour,OutlineColour,BackColour,Bold,Italic,Underline,StrikeOut,ScaleX,ScaleY,Spacing,Angle,BorderStyle,Outline,Shadow,Alignment,MarginL,MarginR,MarginV,Encoding',
  'Style: Cap,Microsoft YaHei,50,&H00FFFFFF,&H00FFFFFF,&H00241E18,&H99241E18,-1,0,0,0,100,100,0,0,3,16,0,2,60,60,64,1',
  'Style: Big,Microsoft YaHei,64,&H00FFFFFF,&H00FFFFFF,&H00241E18,&H00000000,-1,0,0,0,100,100,2,0,1,5,2,5,60,60,40,1',
  'Style: Card,Microsoft YaHei,40,&H00FFFFFF,&H00FFFFFF,&H00241E18,&H00000000,0,0,0,0,100,100,1,0,1,3,1,5,60,60,40,1',
  '', '[Events]', 'Format: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text',
]
ass.push(dlg(0.4, 5.6, 'Big', `{\\an5\\pos(960,455)\\fad(600,700)\\fs150}${TITLE.zh}\\N{\\fs76\\fsp6}${TITLE.en}\\N{\\fs42\\b0\\fsp0}${TITLE.zhSub}\\N${TITLE.enSub}`))
for (const g of groups) if (g.caption) ass.push(dlg(g.start + 0.5, g.end - 0.4, 'Cap', `{\\fad(350,350)}${g.caption[0]}\\N{\\fs34\\b0}${g.caption[1]}`))
const e0 = groups.at(-1).endStart
ass.push(dlg(e0 + 0.3, e0 + END_SECONDS - 0.4, 'Card', `{\\an5\\pos(960,300)\\fad(500,400)\\fs110\\b1}${TITLE.zh}\\N{\\fs60\\fsp5}${TITLE.en}`))
ass.push(dlg(e0 + 0.8, e0 + END_SECONDS - 0.4, 'Card', `{\\an5\\pos(960,560)\\fad(500,400)\\fs44}在线体验 Play now\\N{\\fs46\\b1}${LINKS[0]}\\N{\\fs34\\b0}${LINKS[1]}`))
ass.push(dlg(e0 + 1.2, e0 + END_SECONDS - 0.4, 'Card', `{\\an5\\pos(960,800)\\fad(500,400)\\fs34}核心 3D 资产由 Lux3D 生成，经 Blender 整理 · Core 3D assets generated with Lux3D, refined in Blender\\N{\\fs30}React · Three.js · 仅 PC 浏览器 PC browsers only · 音效 CC0 (Kenney, Freesound)`))
await writeFile(`${work}/captions.ass`, ass.join('\n'))

// ---------- audio mix ----------
const decode = async (name) => { const buf = await run('ffmpeg', ['-v', 'error', '-i', `${audioDir}/${name}.mp3`, '-f', 'f32le', '-ac', '2', '-ar', String(SR), '-']); return new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4) }
const N = Math.ceil(total * SR) * 2, mix = new Float32Array(N)
const cache = new Map(); const load = async (n) => { if (!cache.has(n)) cache.set(n, await decode(n)); return cache.get(n) }
let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647
function put(buf, at, gain = 1, { fadeIn = 0, fadeOut = 0, until = Infinity } = {}) {
  const start = Math.round(at * SR) * 2, frames = buf.length / 2, endAt = Math.min(until, total)
  for (let i = 0; i < frames; i++) {
    const t = i / SR, abs = at + t
    if (abs >= endAt) break
    let g = gain
    if (fadeIn && t < fadeIn) g *= t / fadeIn
    if (fadeOut && t > frames / SR - fadeOut) g *= Math.max(0, (frames / SR - t) / fadeOut)
    const k = start + i * 2; if (k < 0 || k + 1 >= N) continue
    mix[k] += buf[i * 2] * g; mix[k + 1] += buf[i * 2 + 1] * g
  }
}
// A looped bed with overlapping cross-faded repeats, between from and to.
async function bed(name, from, to, gain, xf = 1.5) {
  const buf = await load(name), len = buf.length / 2 / SR
  for (let at = from; at < to; at += len - xf) put(buf, at, gain, { fadeIn: at === from ? 1.2 : xf, fadeOut: xf, until: to })
}
const nightStart = groups.find((g) => g.night).start
await bed('music-day', 0, nightStart + 1.5, 0.5, 2.5)
await bed('music-night', nightStart - 1.5, total, 0.5, 2.5)
await bed('amb-sea', 0, total, 0.28)
for (const g of groups) {
  if (g.ambience === 'birds') await bed('amb-birds', g.start, g.end, 0.4, 0.8)
  if (g.ambience === 'crickets') await bed('amb-crickets', g.start - 0.5, total, 0.5, 1)
}
const steps = await Promise.all([0, 1, 2, 3, 4].map((i) => load(`step-grass-${i}`)))
const stepsOver = (from, to, hz) => { for (let t = from; t < to; t += 1 / hz * (0.9 + rnd() * 0.2)) put(steps[Math.floor(rnd() * 5)], t, 0.45 + rnd() * 0.15) }
const find = (gid, tag) => timeline.filter((s) => s.group === gid && s.tag === tag)
const sfx = async (name, at, gain = 0.7, opts) => put(await load(name), at, gain, opts)
for (const s of find('walkfish', 'walk')) stepsOver(s.start, s.start + s.dur, 3.4)
for (const s of find('autumn', 'steps')) stepsOver(s.start, s.start + s.dur, 3.6)
// Place a sound where a recorded event happens: output time of mark `name` inside the segment tagged `tag`.
const at = (gid, tag, mark) => { const g = groups.find((x) => x.id === gid), seg = g.out.find((o) => o.tag === tag), m = g.marks.find((x) => x.name === mark); return seg.start + (m.t - seg.a) / seg.speed }
await sfx('cast', at('walkfish', 'cast', 'cast') + 0.1, 0.8)
await sfx('bite', at('walkfish', 'bite', 'bite'), 0.9); await sfx('splash', at('walkfish', 'bite', 'bite') + 0.5, 0.5)
for (const s of find('walkfish', 'reel')) { const reel = await load('reel'); for (let t = s.start; t < s.start + s.dur; t += 2.1) put(reel, t, 0.5) }
for (const s of find('walkfish', 'caught')) { await sfx('splash', s.start, 0.8); await sfx('task-done', s.start + 0.8, 0.8) }
for (const s of timeline.filter((x) => x.group === 'sail')) { const pad = await load('paddle'); const gap = s.dur > 6 ? 0.55 : 1.25; for (let t = s.start + 0.4; t < s.start + s.dur - 0.3; t += gap) put(pad, t, 0.5) }
await sfx('splash', find('sail', 'row')[0].start + 0.9, 0.6)
for (const tag of ['castle', 'pit', 'river']) for (const s of find('sand', tag)) { await sfx('pour', s.start + 0.8, 0.6); await sfx('drop', s.start + Math.min(s.dur - 0.4, 2.8), 0.7) }
for (const s of find('sand', 'prints')) stepsOver(s.start, s.start + s.dur, 3.0)
await sfx('gull-1', 1.8, 0.35); await sfx('gull-2', 5.8, 0.3)
let peak = 0; for (let i = 0; i < N; i++) peak = Math.max(peak, Math.abs(mix[i]))
const norm = 0.85 / peak
for (let i = 0; i < N; i++) mix[i] *= norm
// Final fades.
for (let i = 0; i < N / 2; i++) { const t = i / SR; const g = Math.min(1, t / 1.0, (total - t) / 2.0); mix[i * 2] *= Math.max(0, g); mix[i * 2 + 1] *= Math.max(0, g) }
console.log('audio peak', peak.toFixed(2), 'norm', norm.toFixed(2))
await writeFile(`${work}/mix.f32`, Buffer.from(mix.buffer))

// ---------- final encode ----------
await mkdir(resolve(outFile, '..'), { recursive: true })
await ff(['-f', 'concat', '-safe', '0', '-i', 'concat.txt', '-f', 'f32le', '-ar', String(SR), '-ac', '2', '-i', 'mix.f32',
  '-vf', `eq=brightness=-0.14:enable='lt(t,5.6)',subtitles=captions.ass:fontsdir=fonts,scale=in_range=pc:out_range=tv:in_color_matrix=bt470bg:out_color_matrix=bt709,format=yuv420p`,
  '-c:v', 'libx264', '-crf', '23', '-maxrate', '6M', '-bufsize', '12M', '-preset', 'slow', '-pix_fmt', 'yuv420p', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv', '-r', String(FPS), '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', '-shortest', outFile], { cwd: work })
console.log('wrote', outFile)
await writeFile(`${work}/timeline.json`, JSON.stringify({ total, groups: groups.map((g) => ({ id: g.id, start: g.start, end: g.end })), timeline }, null, 2))
