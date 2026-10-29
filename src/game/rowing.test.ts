import { beforeEach, describe, expect, it } from 'vitest'
import { boatFits, canLand, initialBoat, landing, stepBoat } from './rowing'
import { canStandAt } from './movement'
import { useForestStore } from './store'
import {seaRangeRadius,shorelineRadius} from '../world/worldConfig'
import {boatSurfacePose,transferOpacity} from './boatPresentation'

describe('coastal rowing', () => {
  beforeEach(() => useForestStore.setState({ mode: 'walking',boatTransfer:null, boat: { ...initialBoat }, boatReady: true, nearby: null, position: { x: 0, z: 0 }, message: '' }))

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
      expect(store().mode).toBe('walking')
      for(let frame=0;frame<18;frame++)store().tickBoatTransfer(.05)
      expect(store().mode).toBe('rowing')
      store().interact()
      for(let frame=0;frame<18;frame++)store().tickBoatTransfer(.05)
      expect(store().mode).toBe('walking')
      expect(canStandAt(store().position.x, store().position.z)).toBe(true)
    }
  })

  it('commits only under an opaque cover, ignores repeat input and recovers from a long frame',()=>{
    const store=useForestStore.getState
    store().updatePosition(landing.x,landing.z);store().interact()
    store().tickBoatTransfer(NaN);expect(store().boatTransfer?.elapsed).toBe(0)
    store().tickBoatTransfer(20);expect(store().mode).toBe('walking')
    for(let frame=0;frame<18;frame++){
      const before=store().boatTransfer
      store().interact();expect(store().boatTransfer).toBe(before)
      if(store().tickBoatTransfer(.05))expect(transferOpacity(store().boatTransfer!.elapsed)).toBe(1)
      if(!store().boatTransfer)break
    }
    expect(store().mode).toBe('rowing');expect(store().boatTransfer).toBeNull()
    expect(transferOpacity(0)).toBe(0);expect(transferOpacity(.85)).toBe(0)
  })

  it('pins the boat at its berth and limits offshore presentation movement without altering navigation',()=>{
    const offshore={...initialBoat,x:47}
    for(let time=0;time<30;time+=.1){
      expect(boatSurfacePose(initialBoat,time,false)).toEqual({heave:0,pitch:0,roll:0})
      expect(boatSurfacePose(offshore,time,true)).toEqual({heave:0,pitch:0,roll:0})
      const pose=boatSurfacePose(offshore,time,false)
      expect(Math.abs(pose.heave)).toBeLessThanOrEqual(.020001)
      expect(Math.abs(pose.pitch)).toBeLessThanOrEqual(.009001)
      expect(Math.abs(pose.roll)).toBeLessThanOrEqual(.012001)
      expect(boatFits(offshore.x,offshore.z,offshore.heading)).toBe(true)
    }
  })

  it('blocks landing away from the dock or before the boat stops', () => {
    useForestStore.setState({ mode: 'rowing', boat: { ...initialBoat, x: 6 } })
    useForestStore.getState().interact()
    expect(useForestStore.getState().mode).toBe('rowing')
    expect(canLand({ ...initialBoat, speed: .5 })).toBe(false)
  })

  it('moves forward/backward and keeps the complete hull in water through turns and long input', { timeout: 20000 }, () => {
    expect(boatFits(initialBoat.x, initialBoat.z, initialBoat.heading)).toBe(true)
    expect(boatFits(initialBoat.x, initialBoat.z, Math.PI / 2)).toBe(false) // A turn in the berth would put the stern under the jetty.
    const forward = stepBoat(initialBoat, 1, 0, .05)
    const backward = stepBoat(initialBoat, -1, 0, .05)
    expect(forward.x).toBeGreaterThan(initialBoat.x)
    expect(backward.x).toBeLessThan(initialBoat.x)
    let boat = { ...initialBoat }
    for (let i = 0; i < 6000; i++) {
      boat = stepBoat(boat, i % 700 < 500 ? 1 : -1, Math.sin(i / 170), .05)
      expect(boatFits(boat.x, boat.z, boat.heading)).toBe(true)
      expect(boat.phase).toBeGreaterThanOrEqual(0)
      expect(boat.phase).toBeLessThan(7.2)
    }
    expect(stepBoat(boat, NaN, 0, 1)).toBe(boat)
  })

  it('allows an entire island circuit and rejects the shore, dock and outer limit at every angle',()=>{
    for(let a=0;a<Math.PI*2;a+=.025){
      const r=seaRangeRadius(a)-3,c=Math.cos(a),s=Math.sin(a),heading=-a-Math.PI/2
      expect(boatFits(r*c,r*s,heading),`circuit ${a}`).toBe(true)
      const outside=seaRangeRadius(a)+.2
      expect(boatFits(outside*c,outside*s,heading)).toBe(false)
      const inside=shorelineRadius(a)-.5
      expect(boatFits(inside*c,inside*s,heading)).toBe(false)
    }
    expect(boatFits(30,0,0)).toBe(false)
    expect(boatFits(6,-5,0)).toBe(false)
    expect(canLand({...initialBoat,heading:Math.PI/2})).toBe(false)
  })

  it('brakes on release, allowing safe docking without resetting the pose', () => {
    let boat = { ...initialBoat, speed: .8, phase: 2 }
    for (let i = 0; i < 60; i++) boat = stepBoat(boat, 0, 0, 1 / 60)
    expect(boat.speed).toBeLessThan(.02)
    expect(boat.phase).toBeGreaterThan(2)
    expect(canLand(boat)).toBe(true)
  })
})
