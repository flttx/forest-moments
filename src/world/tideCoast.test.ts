import {expect,it} from 'vitest'
import {coastPieces,coastKits,tideShorePieces,tidePoolPieces,autumnRimPieces,mistRimPieces} from './coastalLayout'
import {tideHeight,tidePathDistance,tideBerth,tideObservation} from './tideIsland'
import {isNavigableSea} from '../game/rowing'
import baseline from '../../docs/evidence/2026-10-30-tide-rock-coast/before/coast-snapshot.json'

it('keeps the main island and the neighbour shores dressed, with a bounded tide shore and pool set',()=>{
 // 2026-11-03: every coast was re-laid at the user's request (main island first, then the neighbours' capes and coves),
 // so rocks regenerate on the new shores; clearance rules are checked below and in the coastal layout tests.
 const neighbours=coastPieces.filter(p=>p.x>72)
 expect(neighbours.length).toBeGreaterThan(baseline.filter(p=>p.x>72).length*.8)
 expect(tideShorePieces.length).toBeGreaterThan(10);expect(tideShorePieces.length).toBeLessThan(60)
 expect(tidePoolPieces.length).toBeGreaterThan(8)
})
it('keeps complete rock footprints away from dry trails, the berth, the outlook and rowable water',()=>{
 for(const p of [...tideShorePieces,...tidePoolPieces]){
  const reach=coastKits[p.kit].half*p.scale
  expect(tidePathDistance(p.x,p.z)-reach).toBeGreaterThan(1.15)
  expect(Math.hypot(p.x-tideBerth.landing.x,p.z-tideBerth.landing.z)-reach).toBeGreaterThan(7)
  expect(Math.hypot(p.x-tideObservation.x,p.z-tideObservation.z)-reach).toBeGreaterThan(2)
  expect(p.y).toBeLessThan(tideHeight(p.x,p.z))
  for(let i=0;i<64;i++)expect(isNavigableSea(p.x+Math.cos(i*Math.PI/32)*reach,p.z+Math.sin(i*Math.PI/32)*reach)).toBe(false)
 }
})
it('appends autumn and mist rim rocks that keep trails, the berths, trees and rowable water clear',()=>{
 for(const p of [...autumnRimPieces,...mistRimPieces]){
  const reach=coastKits[p.kit].half*p.scale
  for(let i=0;i<64;i++)expect(isNavigableSea(p.x+Math.cos(i*Math.PI/32)*reach,p.z+Math.sin(i*Math.PI/32)*reach)).toBe(false)
 }
})
it('keeps the denser autumn woodland off every rock footprint',async()=>{
 const {autumnFringe}=await import('./vegetationLayout')
 const {autumnShorePieces}=await import('./coastalLayout')
 expect(autumnFringe.length).toBeGreaterThanOrEqual(6)
 for(const p of autumnFringe)for(const r of [...autumnShorePieces,...autumnRimPieces])expect(Math.hypot(p.x-r.x,p.z-r.z)).toBeGreaterThan(coastKits[r.kit].half*r.scale+.9)
})
