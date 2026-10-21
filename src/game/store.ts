import { create } from 'zustand'
import { findNearestLandmark, landmarks, type LandmarkId } from './landmarks'

const STORAGE_KEY = 'forest-moments:seedling:v1'

function loadSeedling(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

type ForestState = {
  nearby: LandmarkId | null
  planted: boolean
  message: string
  updatePosition: (x: number, z: number) => void
  interact: () => void
  dismiss: () => void
}

export const useForestStore = create<ForestState>((set, get) => ({
  nearby: null,
  planted: typeof window !== 'undefined' ? loadSeedling() : false,
  message: '',
  updatePosition: (x, z) => {
    const nearby = findNearestLandmark(x, z)
    if (nearby !== get().nearby) set({ nearby })
  },
  interact: () => {
    const { nearby, planted } = get()
    if (!nearby) return
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
