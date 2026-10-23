import { create } from 'zustand'
import { findNearestLandmark, landmarks, type LandmarkId } from './landmarks'
import { canBoard, canLand, initialBoat, landing, type BoatState } from './rowing'
import { beginFishing, catchStorageKey, decodeCatchBook, emptyBook, fishingSpot, stepFishing, strikeFish, type CatchBook, type FishingState } from './fishing'

const STORAGE_KEY = 'forest-moments:seedling:v1'

function loadSeedling(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

type ForestState = {
  mode: 'walking' | 'rowing' | 'fishing'
  fishing: FishingState | null
  fishBook: CatchBook
  fishingReady: boolean
  setFishingReady: (ready: boolean) => void
  tickFishing: (delta: number) => void
  reel: (held: boolean) => void
  pauseFishing: () => void
  cancelFishing: () => void
  position: { x: number; z: number }
  boat: BoatState
  boatReady: boolean
  setBoatReady: (ready: boolean) => void
  updateBoat: (boat: BoatState) => void
  nearby: LandmarkId | null
  planted: boolean
  message: string
  updatePosition: (x: number, z: number) => void
  interact: () => void
  dismiss: () => void
}

export const useForestStore = create<ForestState>((set, get) => ({
  mode: 'walking',
  fishing: null,
  fishBook: (() => { try { return decodeCatchBook(window.localStorage.getItem(catchStorageKey)) } catch { return emptyBook() } })(),
  fishingReady: false,
  setFishingReady: (fishingReady) => set({ fishingReady }),
  reel: (held) => { const f = get().fishing; if (f && f.phase === 'reeling' && !f.paused) set({ fishing: { ...f, held } }) },
  pauseFishing: () => { const f = get().fishing; if (f && !['caught', 'escaped'].includes(f.phase)) set({ fishing: { ...f, paused: true, held: false } }) },
  cancelFishing: () => { if (get().mode === 'fishing') set({ mode: 'walking', fishing: null, message: '' }) },
  tickFishing: (delta) => {
    const current = get().fishing
    if (!current || get().mode !== 'fishing') return
    const fishing = stepFishing(current, delta)
    if (fishing === current) return
    if (fishing.phase === 'caught' && current.phase !== 'caught') {
      const book = get().fishBook
      const fishBook = { count: book.count + 1, bestCm: Math.max(book.bestCm, fishing.sizeCm), recent: [{ sizeCm: fishing.sizeCm, at: new Date().toISOString() }, ...book.recent].slice(0, 20) }
      let saved = true
      try { window.localStorage.setItem(catchStorageKey, JSON.stringify(fishBook)) } catch { saved = false }
      set({ fishing, fishBook, message: saved ? `钓到 ${fishing.sizeCm} cm 锦鲤，已存入鱼簿。` : '钓到锦鲤！浏览器不允许存档，渔获仅在本次会话保留。' })
    } else set({ fishing })
  },
  position: { x: 0, z: 0 },
  boat: { ...initialBoat },
  boatReady: false,
  setBoatReady: (boatReady) => set({ boatReady }),
  updateBoat: (boat) => set({ boat }),
  nearby: null,
  planted: typeof window !== 'undefined' ? loadSeedling() : false,
  message: '',
  updatePosition: (x, z) => {
    const nearby = findNearestLandmark(x, z)
    const previous = get()
    if (x !== previous.position.x || z !== previous.position.z || nearby !== previous.nearby) set({ nearby, position: { x, z } })
  },
  interact: () => {
    const { nearby, planted, mode, position, boat, boatReady } = get()
    if (mode === 'fishing') {
      const f = get().fishing
      if (f) set({ fishing: ['caught', 'escaped'].includes(f.phase) ? beginFishing() : strikeFish(f), message: '' })
      return
    }
    if (mode === 'rowing') {
      if (!canLand(boat)) { set({ message: '回到码头旁，松开方向键停稳后按 F 下船。' }); return }
      set({ mode: 'walking', position: { ...landing }, nearby: 'dock', boat: { ...boat, speed: 0, effort: 0 }, message: '已回到码头，可以继续漫步，也可以再次上船。' })
      return
    }
    if (!nearby) return
    if (nearby === 'pond') {
      if (!get().fishingReady) { set({ message: '钓具正在准备，请稍候。' }); return }
      if (Math.hypot(position.x - fishingSpot.x, position.z - fishingSpot.z) > .85) { set({ message: '走到池塘西岸的钓点，再按 F 抛竿。' }); return }
      set({ mode: 'fishing', position: { ...fishingSpot }, fishing: beginFishing(), message: '' })
      return
    }
    if (nearby === 'dock') {
      if (!boatReady) { set({ message: '木船正在准备，请稍候。' }); return }
      if (!canBoard(position.x, position.z, boat)) { set({ message: '走到木码头靠水的一端，再按 F 上船。' }); return }
      set({ mode: 'rowing', message: 'W 前划、S 后划，A / D 转向；回到码头停稳后按 F 下船。' })
      return
    }
    if (nearby === 'grove') {
      if (!planted) {
        try { window.localStorage.setItem(STORAGE_KEY, 'true') } catch { /* still works in memory */ }
        set({ planted: true, message: '种下了一棵树苗！森林记住了你的第一份心意。' })
      } else set({ message: '树苗已经扎根，成长玩法将在后续开发。' })
      return
    }
    const point = landmarks.find((item) => item.id === nearby)
    set({ message: point?.hint ?? '' })
  },
  dismiss: () => set({ message: '' }),
}))
