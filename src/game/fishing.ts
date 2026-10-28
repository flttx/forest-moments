import { isSpecies, pickCatch, type FishingSite, type Light, type SpeciesId } from './fishSpecies'
import { pond, seaLevel } from '../world/worldConfig'
import type { Weather } from './weather'

/**
 * Where the raccoon can fish: where it stands, which way it faces (the actor's rotation.y; forward is
 * (-sin, -cos)), where the float lands (`float`), where a hooked fish is drawn in to the bank (`cast`) and the
 * water height. The pond bank, and the south edge of the jetty
 * (deep water, away from the boat's mooring on the north side).
 */
export const fishingSites: Record<FishingSite, { stand: { x: number; z: number }; facing: number; float: { x: number; z: number }; cast: { x: number; z: number }; waterY: number }> = {
  pond: { stand: { x: 1.5, z: -5 }, facing: -Math.PI / 2, float: { x: 4.2, z: -5 }, cast: { x: 2.45, z: -5 }, waterY: pond.waterY },
  sea: { stand: { x: 41, z: -.8 }, facing: 0, float: { x: 41, z: -3.5 }, cast: { x: 41, z: -1.75 }, waterY: seaLevel },
}
export const fishingSpot = fishingSites.pond.stand
export const catchStorageKey = 'forest-moments:fish-book:v1'
export type FishingPhase = 'casting' | 'waiting' | 'bite' | 'reeling' | 'landing' | 'caught' | 'escaped'
export type FishingReason = '' | 'early' | 'missed' | 'snapped' | 'tooLong'
export interface FishingState {
  phase: FishingPhase
  elapsed: number
  wait: number
  sizeCm: number
  species: SpeciesId
  site: FishingSite
  progress: number
  tension: number
  held: boolean
  paused: boolean
  /** Why the fish got away; translated as `fishing.<reason>` when shown. */
  reason: FishingReason
}
export interface CatchRecord { sizeCm: number; at: string; species?: SpeciesId }
export type { FishingSite }
/** Per kind: how many and the largest. Older books (koi only) are read as koi. */
export type KindTally = Partial<Record<SpeciesId, { count: number; bestCm: number }>>
export interface CatchBook { count: number; bestCm: number; recent: CatchRecord[]; kinds: KindTally }
export const emptyBook = (): CatchBook => ({ count: 0, bestCm: 0, recent: [], kinds: {} })
export const kindOf = (f: { species?: SpeciesId }): SpeciesId => f.species ?? 'koi'
/** The book after one more fish. */
export function recordCatch(book: CatchBook, fish: CatchRecord): CatchBook {
  const kind = kindOf(fish), was = book.kinds[kind]
  return { count: book.count + 1, bestCm: Math.max(book.bestCm, fish.sizeCm), recent: [fish, ...book.recent].slice(0, 20),
    kinds: { ...book.kinds, [kind]: { count: (was?.count ?? 0) + 1, bestCm: Math.max(was?.bestCm ?? 0, fish.sizeCm) } } }
}
export function decodeCatchBook(raw: string | null): CatchBook {
  try {
    const value: unknown = JSON.parse(raw ?? 'null')
    if (!value || typeof value !== 'object') return emptyBook()
    const b = value as CatchBook
    if (!Number.isSafeInteger(b.count) || b.count < 0 || !Number.isFinite(b.bestCm) || b.bestCm < 0 || b.bestCm > 36 || !Array.isArray(b.recent)) return emptyBook()
    if (b.recent.length > 20 || b.recent.some(r => !r || !Number.isFinite(r.sizeCm) || r.sizeCm < 18 || r.sizeCm > 36 || typeof r.at !== 'string' || !Number.isFinite(Date.parse(r.at)) || (r.species !== undefined && !isSpecies(r.species)))) return emptyBook()
    let kinds: KindTally = {}
    if (b.kinds === undefined) { if (b.count) kinds = { koi: { count: b.count, bestCm: b.bestCm } } }
    else if (!b.kinds || typeof b.kinds !== 'object' || Object.entries(b.kinds).some(([id, k]) => !isSpecies(id) || !k || !Number.isSafeInteger(k.count) || k.count < 1 || !Number.isFinite(k.bestCm) || k.bestCm < 18 || k.bestCm > 36)) return emptyBook()
    else kinds = b.kinds
    return { count: b.count, bestCm: b.bestCm, recent: b.recent, kinds }
  } catch { return emptyBook() }
}
export function beginFishing(random = Math.random, light: Light = 'day', site: FishingSite = 'pond', weather: Weather = 'clear'): FishingState {
  const wait = 3 + random() * 3, fish = pickCatch(light, random, site, weather)
  return { phase: 'casting', elapsed: 0, wait, sizeCm: fish.sizeCm, species: fish.species, site, progress: 0, tension: .22, held: false, paused: false, reason: '' }
}
export function strikeFish(s: FishingState): FishingState {
  if (s.paused) return { ...s, paused: false, held: false }
  if (s.phase === 'bite') return { ...s, phase: 'reeling', elapsed: 0 }
  if (s.phase === 'waiting') return { ...s, phase: 'escaped', elapsed: 0, reason: 'early' }
  return s
}
export function stepFishing(s: FishingState, delta: number): FishingState {
  if (s.paused || s.phase === 'caught' || s.phase === 'escaped' || !Number.isFinite(delta)) return s
  const dt = Math.max(0, Math.min(delta, .05)), elapsed = s.elapsed + dt
  const next = { ...s, elapsed }
  if (s.phase === 'casting' && elapsed >= 3.2) return { ...next, phase: 'waiting', elapsed: 0 }
  if (s.phase === 'waiting' && elapsed >= s.wait) return { ...next, phase: 'bite', elapsed: 0 }
  if (s.phase === 'bite' && elapsed >= 2.4) return { ...next, phase: 'escaped', reason: 'missed', held: false }
  if (s.phase === 'landing' && elapsed >= 7 / 6) return { ...next, phase: 'caught', held: false }
  if (s.phase !== 'reeling') return next
  const tension = Math.max(0, s.tension + (s.held ? .25 + .07 * Math.sin(elapsed * 2) : -.38) * dt)
  const progress = Math.max(0, Math.min(1, s.progress + (s.held ? .21 : -.025) * dt))
  if (tension >= 1 || elapsed >= 30) return { ...next, tension: Math.min(tension, 1), phase: 'escaped', held: false, reason: tension >= 1 ? 'snapped' : 'tooLong' }
  if (progress >= 1) return { ...next, phase: 'landing', elapsed: 0, progress: 1, tension, held: false }
  return { ...next, progress, tension }
}
export const fishingClips = { casting: 'fish_cast', waiting: 'fish_hold', bite: 'fish_hold', reeling: 'fish_reel', landing: 'fish_land', caught: 'fish_land', escaped: 'fish_hold' } as const
