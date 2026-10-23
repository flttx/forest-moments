import { describe, expect, it } from 'vitest'
import { canStandAt, groundHeightAt, moveOnGround } from './movement'

describe('ground movement around imported assets', () => {
  it('keeps spawn and shore interactions accessible while blocking water and structures', () => {
    for (const [x, z] of [[0, 0], [1.5, -5], [0, 8], [-8, 6], [-8, -4.9], [11, -8]]) expect(canStandAt(x, z)).toBe(true)
    for (const [x, z] of [[6, -5], [-8, 3], [-8, -8], [8, 6], [17, 0]]) expect(canStandAt(x, z)).toBe(false)
  })
  it('prevents a long step crossing the workshop and slides along its front', () => {
    const stopped = moveOnGround({ x: -8, z: 7 }, 0, -8)
    expect(stopped.z).toBeGreaterThan(5.4)
    expect(canStandAt(stopped.x, stopped.z)).toBe(true)
    const sliding = moveOnGround(stopped, 1, -1)
    expect(sliding.x).toBeGreaterThan(stopped.x + .8)
    expect(sliding.z).toBeGreaterThan(5.4)
  })
  it('allows the dock deck over water but not a step off its water-facing edge', () => {
    expect(canStandAt(9.1, -7.9)).toBe(true)
    expect(groundHeightAt(9.1, -7.9)).toBe(.12)
    expect(groundHeightAt(12, -7.9)).toBe(0)
    expect(canStandAt(8.7, -7.9)).toBe(false)
    const stopped = moveOnGround({ x: 9.1, z: -7.9 }, -1, 0)
    expect(stopped.x).toBeGreaterThanOrEqual(9.03)
  })
})
