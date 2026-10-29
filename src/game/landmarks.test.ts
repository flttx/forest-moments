import { describe, expect, it } from 'vitest'
import { findNearestLandmark, landmarks } from './landmarks'

describe('forest landmark interactions', () => {
  it('keeps landmarks unique and includes the neighbouring berth and clearing', () => {
    expect(new Set(landmarks.map((point) => point.id)).size).toBe(landmarks.length)
    expect(landmarks.map(p=>p.id)).toEqual(expect.arrayContaining(['dock','mist','mistPine']))
  })

  it('finds the planting location and rejects distant positions', () => {
    expect(findNearestLandmark(0, 8)).toBe('grove')
    expect(findNearestLandmark(50, 50)).toBeNull()
  })

  it('pond interaction is on the reachable shore rather than underwater', () => {
    expect(findNearestLandmark(1.5, -5)).toBe('pond')
    expect(Math.hypot(1.5 - 6, -5 + 5)).toBeGreaterThan(4.35)
  })
})
