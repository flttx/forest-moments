import {pathDistance,terrainHeight} from '../world/terrain'
import {workshopAction,woodSpot} from './workshop'
import {workshopDoor} from './workshop'
import { describe, expect, it } from 'vitest'
import { canStandAt, groundHeightAt, moveOnGround, standBlocker, pathStones } from './movement'
import {bridge,cabin} from './expansion'
import {hayBales,logPile} from '../world/settlement'
import {pondStoneColliders} from '../world/pondLayout'
import {lampPositions,instanceCircles,vegetationPositions} from '../world/vegetationLayout'

describe('ground movement around imported assets', () => {
  it('keeps spawn and shore interactions accessible while blocking water and structures', () => {
    for (const [x, z] of [[0, 0], [1.5, -5], [0, 8], [workshopDoor.x, workshopDoor.z], [13, -4.7], [42.6,.8], [8,3.2], [8,4.2]]) expect(canStandAt(x, z),`${x},${z}`).toBe(true)
    for (const [x, z] of [[6, -5], [-12, 8], [13, -8], [5.7, 7.55], [10,3.2], [9.7,3.95], [44, 5]]) expect(canStandAt(x, z)).toBe(false)
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
    expect(canStandAt(42.6, .8)).toBe(true)
    expect(groundHeightAt(42.6, .8)).toBe(.12)
    expect(canStandAt(42.6,1.3)).toBe(false)
    expect(canStandAt(43.8,.7)).toBe(false) // Generated corner post.
    const stopped = moveOnGround({ x: 42.6, z: 0 }, 0, 3)
    expect(stopped.z).toBeLessThanOrEqual(.82)
    for(let x=33;x<43;x+=.1)expect(canStandAt(x,0)).toBe(true)
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

it('stops the body at drawn props and keeps their gaps open (measured by scripts/audit_collisions.mjs)',()=>{
 // Props that used to be walk-through: hay, the log pile, path stones, raised pond stones.
 for(const b of hayBales)expect(standBlocker(b.x,b.z),`hay ${b.x}`).toBe('hay bale')
 expect(standBlocker(logPile.x,logPile.z)).toBe('log pile')
 for(const [x,z] of pathStones)expect(standBlocker(x,z)).toBe('path stone')
 for(const s of pondStoneColliders)expect(canStandAt(s.x,s.z)).toBe(false)
 // Bridge: the deck lane stays open, the railings and end posts do not.
 expect(canStandAt(bridge.x,bridge.z)).toBe(true);expect(canStandAt(bridge.x+.75,bridge.z)).toBe(false)
 expect(standBlocker(bridge.x-1.4,bridge.z+bridge.halfZ-.1)).toBe('box:bridge railing')
 // Street lamps: the hanging lantern is solid at head height, not only the post.
 const lamp=lampPositions[0],post=instanceCircles(lamp)[0],n=Math.hypot(lamp.x-post.x,lamp.z-post.z)
 expect(standBlocker(post.x+(lamp.x-post.x)/n*.9,post.z+(lamp.z-post.z)/n*.9)).toBe('lamp head')
 // Buildings stop at their walls: beside the cabin's side wall and in front of the workshop's open porch.
 expect(canStandAt(cabin.x-3.15-.32,cabin.z)).toBe(true);expect(canStandAt(cabin.x-3.15-.2,cabin.z)).toBe(false)
 expect(canStandAt(-14.5,8+2.1)).toBe(true)
 // Bushes and pine skirts: blocked at the outer leaves, not only at the trunk.
 const bush=vegetationPositions.find(p=>p.kit==='bush-a')!,pine=vegetationPositions.find(p=>p.kit==='normal-pine-b')!
 expect(standBlocker(bush.x+.74*bush.scale,bush.z)).toMatch(/^plant:bush-a/)
 expect(standBlocker(pine.x+1.2*pine.scale,pine.z)).toMatch(/^plant:normal-pine-b/)
})
