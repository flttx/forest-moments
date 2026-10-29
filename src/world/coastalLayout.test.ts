import {expect,it} from 'vitest'
import {coastPieces,coastKits,seawardClear,mistRidgePieces,mistShorePieces} from './coastalLayout'
import {mistPathDistance,mistHeight} from './mistIsland'
import {canStandAt} from '../game/movement'
import {isNavigableSea} from '../game/rowing'
import {coastalDock,landing,mooring,berths,seaLevel} from './worldConfig'
import {creekDistance} from '../game/expansion'

it('keeps the neighbour ridge solids clear of the forest trail and navigable water',()=>{
 expect(mistRidgePieces.length).toBeGreaterThan(0)
 for(const p of mistRidgePieces){
  const reach=coastKits[p.kit].half*p.scale
  expect(mistPathDistance(p.x,p.z)-reach).toBeGreaterThan(1)
  for(let i=0;i<16;i++)expect(isNavigableSea(p.x+Math.cos(i*Math.PI/8)*reach,p.z+Math.sin(i*Math.PI/8)*reach)).toBe(false)
 }
})

it('embeds shore outcrops without closing the trail, landing or boat water',()=>{
 expect(mistShorePieces.length).toBeGreaterThan(8)
 for(const p of mistShorePieces){
  const reach=coastKits[p.kit].half*p.scale
  expect(mistPathDistance(p.x,p.z)-reach).toBeGreaterThan(1.1)
  expect(Math.hypot(p.x-berths.mist.landing.x,p.z-berths.mist.landing.z)-reach).toBeGreaterThan(4)
  expect(p.y).toBeLessThan(mistHeight(p.x,p.z))
  for(let i=0;i<64;i++){
   const x=p.x+Math.cos(i*Math.PI/32)*reach,z=p.z+Math.sin(i*Math.PI/32)*reach
   expect(isNavigableSea(x,z)).toBe(false)
   expect(mistHeight(x,z)).toBeGreaterThan(seaLevel+.08)
  }
 }
})

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
  // The main dock has a finite footprint; distant neighbour shores are not its approach.
  expect(p.x>coastalDock.minX-2&&p.x<coastalDock.maxX+2&&Math.abs(p.z)<coastalDock.maxZ+2).toBe(false)
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
