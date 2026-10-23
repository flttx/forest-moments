export const fishingSpot = { x: 1.5, z: -5 }
export const catchStorageKey = 'forest-moments:fish-book:v1'
export type FishingPhase = 'casting' | 'waiting' | 'bite' | 'reeling' | 'landing' | 'caught' | 'escaped'
export interface FishingState {
  phase: FishingPhase
  elapsed: number
  wait: number
  sizeCm: number
  progress: number
  tension: number
  held: boolean
  paused: boolean
  reason: string
}
export interface CatchBook { count: number; bestCm: number; recent: { sizeCm: number; at: string }[] }
export const emptyBook = (): CatchBook => ({ count: 0, bestCm: 0, recent: [] })
export function decodeCatchBook(raw: string | null): CatchBook {
  try {
    const value: unknown = JSON.parse(raw ?? 'null')
    if (!value || typeof value !== 'object') return emptyBook()
    const b = value as CatchBook
    if (!Number.isSafeInteger(b.count) || b.count < 0 || !Number.isFinite(b.bestCm) || b.bestCm < 0 || b.bestCm > 36 || !Array.isArray(b.recent)) return emptyBook()
    if (b.recent.length > 20 || b.recent.some(r => !r || !Number.isFinite(r.sizeCm) || r.sizeCm < 18 || r.sizeCm > 36 || typeof r.at !== 'string' || !Number.isFinite(Date.parse(r.at)))) return emptyBook()
    return { count: b.count, bestCm: b.bestCm, recent: b.recent }
  } catch { return emptyBook() }
}
export function beginFishing(random = Math.random): FishingState {
  return { phase: 'casting', elapsed: 0, wait: 3 + random() * 3, sizeCm: Math.round(18 + random() * 18), progress: 0, tension: .22, held: false, paused: false, reason: '' }
}
export function strikeFish(s: FishingState): FishingState {
  if (s.paused) return { ...s, paused: false, held: false }
  if (s.phase === 'bite') return { ...s, phase: 'reeling', elapsed: 0 }
  if (s.phase === 'waiting') return { ...s, phase: 'escaped', elapsed: 0, reason: '提竿太早，鱼还没有咬钩。' }
  return s
}
export function stepFishing(s: FishingState, delta: number): FishingState {
  if (s.paused || s.phase === 'caught' || s.phase === 'escaped' || !Number.isFinite(delta)) return s
  const dt = Math.max(0, Math.min(delta, .05)), elapsed = s.elapsed + dt
  const next = { ...s, elapsed }
  if (s.phase === 'casting' && elapsed >= 3.2) return { ...next, phase: 'waiting', elapsed: 0 }
  if (s.phase === 'waiting' && elapsed >= s.wait) return { ...next, phase: 'bite', elapsed: 0 }
  if (s.phase === 'bite' && elapsed >= 2.4) return { ...next, phase: 'escaped', reason: '错过了咬钩，鱼游走了。', held: false }
  if (s.phase === 'landing' && elapsed >= 7 / 6) return { ...next, phase: 'caught', held: false }
  if (s.phase !== 'reeling') return next
  const tension = Math.max(0, s.tension + (s.held ? .25 + .07 * Math.sin(elapsed * 2) : -.38) * dt)
  const progress = Math.max(0, Math.min(1, s.progress + (s.held ? .21 : -.025) * dt))
  if (tension >= 1 || elapsed >= 30) return { ...next, tension: Math.min(tension, 1), phase: 'escaped', held: false, reason: tension >= 1 ? '鱼线绷得太紧，鱼挣脱了。下次张力高时松开收线。' : '收线太久，鱼挣脱了。' }
  if (progress >= 1) return { ...next, phase: 'landing', elapsed: 0, progress: 1, tension, held: false }
  return { ...next, progress, tension }
}
export const fishingClips = { casting: 'fish_cast', waiting: 'fish_hold', bite: 'fish_hold', reeling: 'fish_reel', landing: 'fish_land', caught: 'fish_land', escaped: 'fish_hold' } as const
