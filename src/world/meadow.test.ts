import { describe, expect, it } from 'vitest'
import { canStandAt } from '../game/movement'
import { canopyDensityAt } from './canopyMap'
import { pathDistance } from './terrain'
import { hayBales, logPile } from './settlement'
import { clearings, meadowWeight } from './worldConfig'
import { vegetationPositions } from './vegetationLayout'

describe('V4/V5 meadows and settlement props', () => {
  it('keeps trees out of every meadow clearing and leaves them open to walk', () => {
    for (const c of clearings) {
      expect(vegetationPositions.filter(p => p.kit !== 'bush-a' && Math.hypot(p.x - c.x, p.z - c.z) < c.r)).toEqual([])
      expect(canStandAt(c.x, c.z), `clearing ${c.x},${c.z}`).toBe(true)
      expect(meadowWeight(c.x, c.z)).toBe(1)
      expect(canopyDensityAt(c.x, c.z)).toBeLessThan(0.2)
    }
  })
  it('shades the ground under tree crowns and not in open ground', () => {
    const tree = vegetationPositions.find(p => p.kit === 'normal-pine-b')!
    expect(canopyDensityAt(tree.x, tree.z)).toBeGreaterThan(0.5)
    expect(canopyDensityAt(200, 200)).toBe(0)
  })
  it('places hay and logs clear of walking routes', () => {
    for (const p of [...hayBales, logPile]) expect(pathDistance(p.x, p.z), `prop ${p.x},${p.z}`).toBeGreaterThan(1.5)
  })
})
