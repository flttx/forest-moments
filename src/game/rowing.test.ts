import { beforeEach, describe, expect, it } from 'vitest'
import { boatFits, canLand, initialBoat, landing, stepBoat } from './rowing'
import { canStandAt } from './movement'
import { useForestStore } from './store'

describe('pond rowing', () => {
  beforeEach(() => useForestStore.setState({ mode: 'walking', boat: { ...initialBoat }, boatReady: true, nearby: null, position: { x: 0, z: 0 }, message: '' }))

  it('requires the loaded boat and the dock edge, and completes repeatable boarding/landing', () => {
    const store = useForestStore.getState
    store().updatePosition(11, -8)
    store().interact()
    expect(store().mode).toBe('walking')
    store().updatePosition(landing.x, landing.z)
    store().setBoatReady(false)
    store().interact()
    expect(store().mode).toBe('walking')
    store().setBoatReady(true)
    for (let i = 0; i < 2; i++) {
      store().interact()
      expect(store().mode).toBe('rowing')
      store().interact()
      expect(store().mode).toBe('walking')
      expect(canStandAt(store().position.x, store().position.z)).toBe(true)
    }
  })

  it('blocks landing away from the dock or before the boat stops', () => {
    useForestStore.setState({ mode: 'rowing', boat: { ...initialBoat, x: 6 } })
    useForestStore.getState().interact()
    expect(useForestStore.getState().mode).toBe('rowing')
    expect(canLand({ ...initialBoat, speed: .5 })).toBe(false)
  })

  it('moves forward/backward and keeps the complete hull in water through turns and long input', () => {
    expect(boatFits(initialBoat.x, initialBoat.z, initialBoat.heading)).toBe(true)
    expect(boatFits(8.1, -6.1, -1.64)).toBe(false) // Stern would turn underneath the dock.
    const forward = stepBoat(initialBoat, 1, 0, .05)
    const backward = stepBoat(initialBoat, -1, 0, .05)
    expect(forward.z).toBeGreaterThan(initialBoat.z)
    expect(backward.z).toBeLessThan(initialBoat.z)
    let boat = { ...initialBoat }
    for (let i = 0; i < 6000; i++) {
      boat = stepBoat(boat, i % 700 < 500 ? 1 : -1, Math.sin(i / 170), .05)
      expect(boatFits(boat.x, boat.z, boat.heading)).toBe(true)
      expect(boat.phase).toBeGreaterThanOrEqual(0)
      expect(boat.phase).toBeLessThan(7.2)
    }
    expect(stepBoat(boat, NaN, 0, 1)).toBe(boat)
  })

  it('brakes on release, allowing safe docking without resetting the pose', () => {
    let boat = { ...initialBoat, speed: .8, phase: 2 }
    for (let i = 0; i < 60; i++) boat = stepBoat(boat, 0, 0, 1 / 60)
    expect(boat.speed).toBeLessThan(.02)
    expect(boat.phase).toBeGreaterThan(2)
    expect(canLand(boat)).toBe(true)
  })
})
