import {expect,it} from 'vitest'
import {coastPieces,coastKits,seawardClear} from './coastalLayout'
import {canStandAt} from '../game/movement'
import {isNavigableSea} from '../game/rowing'
import {coastalDock,landing,mooring} from './worldConfig'
import {creekDistance} from '../game/expansion'

it('dresses cliffs, the creek mouth and the tide line with a bounded number of pieces',()=>{
 const count=(role:string)=>coastPieces.filter(p=>p.role===role).length
 expect(count('cliff')).toBeGreaterThan(60);expect(count('creek')).toBeGreaterThan(8);expect(count('tideline')).toBeGreaterThan(30)
 expect(coastPieces.length).toBeLessThan(420)
 expect(coastPieces.some(p=>p.kit.startsWith('Driftwood'))).toBe(true)
 for(const p of coastPieces)expect([p.x,p.y,p.z,p.yaw,p.scale].every(Number.isFinite)).toBe(true)
})

it('keeps every piece out of rowable water, the dock approach and the walkable creek path',()=>{
 for(const p of coastPieces){
  expect(seawardClear(p)).toBe(true)
  expect(isNavigableSea(p.x,p.z)).toBe(false)
  expect(p.x>coastalDock.minX-2&&Math.abs(p.z)<coastalDock.maxZ+2).toBe(false)
  expect(Math.hypot(p.x-landing.x,p.z-landing.z)).toBeGreaterThan(3)
  expect(Math.hypot(p.x-mooring.x,p.z-mooring.z)).toBeGreaterThan(3)
  // Pieces stay off ground the raccoon can walk on, so walking and collision are unchanged.
  if(p.role!=='cliff')expect(canStandAt(p.x,p.z)).toBe(false)
  expect(creekDistance(p.x,p.z)).toBeGreaterThan(1.2)
 }
})

it('fits cliff pieces to the face: no floating crowns, sizes within the kit range',()=>{
 for(const p of coastPieces.filter(p=>p.role==='cliff')){
  expect(p.scale).toBeGreaterThanOrEqual(.7);expect(p.scale).toBeLessThanOrEqual(1.7)
  expect(p.y+coastKits[p.kit].height*p.scale).toBeLessThan(12)
 }
})
