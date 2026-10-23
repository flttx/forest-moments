import { beforeEach, describe, expect, it, vi } from 'vitest'
import { beginFishing, catchStorageKey, decodeCatchBook, emptyBook, stepFishing, strikeFish } from './fishing'
import type { FishingState } from './fishing'
import { useForestStore } from './store'

function advance(s: FishingState, seconds: number) {
  for (let i = 0; i < Math.ceil(seconds * 60); i++) s = stepFishing(s, 1 / 60)
  return s
}
describe('fishing decisions and records', () => {
  beforeEach(() => { vi.unstubAllGlobals(); useForestStore.setState({ mode: 'walking', fishing: null, fishBook: emptyBook(), fishingReady: true, nearby: 'pond', position: { x: 1.5, z: -5 }, message: '' }) })
  it('requires the fishing spot and loaded tools and exits safely without a catch', () => {
    const get = useForestStore.getState
    get().setFishingReady(false); get().interact(); expect(get().mode).toBe('walking')
    get().setFishingReady(true); get().updatePosition(0, -5); get().interact(); expect(get().mode).toBe('walking')
    get().updatePosition(1.5, -5); get().interact(); expect(get().mode).toBe('fishing')
    get().cancelFishing(); expect(get().mode).toBe('walking'); expect(get().fishBook.count).toBe(0)
  })
  it('supports early, late, and overloaded failures without rewarding them', () => {
    const waiting = advance(beginFishing(() => 0), 3.25)
    expect(waiting.phase).toBe('waiting')
    expect(strikeFish(waiting).phase).toBe('escaped')
    expect(advance(waiting, 6).phase).toBe('escaped')
    const reeling = strikeFish({ ...waiting, phase: 'bite' })
    expect(advance({ ...reeling, held: true }, 6).phase).toBe('escaped')
  })
  it('requires releasing tension to land a fish; pause freezes the encounter', () => {
    let s = strikeFish({ ...beginFishing(() => .5), phase: 'bite' })
    s = advance({ ...s, paused: true }, 20)
    expect(s.elapsed).toBe(0)
    s = strikeFish(s)
    for (let i = 0; i < 1200 && s.phase !== 'caught'; i++) {
      s = stepFishing({ ...s, held: s.tension < .65 }, 1 / 60)
    }
    expect(s.phase).toBe('caught'); expect(s.progress).toBe(1)
  })
  it('records each landing once, persists the book and handles unavailable storage', () => {
    const memory = new Map<string, string>()
    vi.stubGlobal('window', { localStorage: { setItem: (k: string, v: string) => memory.set(k, v) } })
    const get = useForestStore.getState
    useForestStore.setState({ mode: 'fishing', fishing: { ...beginFishing(() => .5), phase: 'landing', elapsed: 1.16 } })
    get().tickFishing(.03); get().tickFishing(.03)
    expect(get().fishBook.count).toBe(1)
    expect(decodeCatchBook(memory.get(catchStorageKey) ?? null).count).toBe(1)
    get().interact(); expect(get().fishing?.phase).toBe('casting')
    vi.stubGlobal('window', { localStorage: { setItem: () => { throw Error('disabled') } } })
    useForestStore.setState({ fishing: { ...beginFishing(() => 0), phase: 'landing', elapsed: 1.16 } })
    get().tickFishing(.03)
    expect(get().fishBook.count).toBe(2); expect(get().message).toContain('本次会话')
    vi.unstubAllGlobals()
  })
  it('rejects damaged or invalid saved records', () => {
    for (const raw of ['{', 'null', '{"count":-1}', JSON.stringify({ count: 1, bestCm: 900, recent: [] }), JSON.stringify({ count: 1, bestCm: 20, recent: [{ sizeCm: 20, at: 'invalid' }] })]) expect(decodeCatchBook(raw)).toEqual(emptyBook())
  })
})
