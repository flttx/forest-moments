import {pathDistance,terrainHeight} from '../world/terrain'
import {workshopAction,woodSpot} from './workshop'
import {workshopDoor} from './workshop'
import { describe, expect, it } from 'vitest'
import { canStandAt, groundHeightAt, moveOnGround } from './movement'

describe('ground movement around imported assets', () => {
  it('keeps spawn and shore interactions accessible while blocking water and structures', () => {
    for (const [x, z] of [[0, 0], [1.5, -5], [0, 8], [workshopDoor.x, workshopDoor.z], [13, -4.7], [30.6,.8], [8,3.2], [8,4.2]]) expect(canStandAt(x, z),`${x},${z}`).toBe(true)
    for (const [x, z] of [[6, -5], [-12, 8], [13, -8], [5.7, 7.55], [10,3.2], [9.7,3.95], [32, 5]]) expect(canStandAt(x, z)).toBe(false)
  })
  it('prevents a long step crossing the workshop and slides along its front', () => {
    const stopped = moveOnGround({ x: -12, z: 12 }, 0, -8)
    expect(stopped.z).toBeGreaterThan(11.49)
    expect(canStandAt(stopped.x, stopped.z)).toBe(true)
    const sliding = moveOnGround(stopped, 1, -1)
    expect(sliding.x).toBeGreaterThan(stopped.x + .8)
    expect(sliding.z).toBeGreaterThan(11.49)
  })
  it('allows the dock deck over water but not a step off its water-facing edge', () => {
    expect(canStandAt(30.6, .8)).toBe(true)
    expect(groundHeightAt(30.6, .8)).toBe(.12)
    expect(canStandAt(30.6,1.3)).toBe(false)
    expect(canStandAt(31.8,.7)).toBe(false) // Generated corner post.
    const stopped = moveOnGround({ x: 30.6, z: 0 }, 0, 3)
    expect(stopped.z).toBeLessThanOrEqual(.82)
    for(let x=21;x<31;x+=.1)expect(canStandAt(x,0)).toBe(true)
  })
})

it('keeps the enlarged workshop entrance on flat accessible ground with room for the player',()=>{
 expect(workshopAction(workshopDoor,{version:1,phase:'carrying'})).toBe('enter')
 expect(pathDistance(workshopDoor.x,workshopDoor.z)).toBeLessThan(.8)
 for(const dx of [-.3,0,.3])for(const dz of [-.2,0,.2]){
  expect(canStandAt(workshopDoor.x+dx,workshopDoor.z+dz)).toBe(true)
  expect(terrainHeight(workshopDoor.x+dx,workshopDoor.z+dz)).toBe(0)
 }
 expect(canStandAt(-12,11)).toBe(false) // Old trigger now lies inside the enlarged footprint.
 expect(canStandAt(woodSpot.x,woodSpot.z+1)).toBe(true)
})
