import {expect,it} from 'vitest'
import {coastPieces,coastKits,tideShorePieces,tidePoolPieces,autumnRimPieces,mistRimPieces} from './coastalLayout'
import {tideHeight,tidePathDistance,tideBerth,tideObservation} from './tideIsland'
import {isNavigableSea} from '../game/rowing'
import baseline from '../../docs/evidence/2026-10-30-tide-rock-coast/before/coast-snapshot.json'

it('preserves every adopted old coast placement while adding a bounded tide shore and pool dressing',()=>{
 // Browser and Node trigonometric results can differ at the last binary digit.
 // 2026-11-03: the main island's coast was re-laid at the user's request and its rocks are generated afresh; the
 // neighbouring islands' adopted placements are still unchanged and in order.
 const kept=baseline.filter(p=>p.x>72),pieces=coastPieces.filter(p=>p.x>72&&!tideShorePieces.includes(p)&&!tidePoolPieces.includes(p)&&!autumnRimPieces.includes(p)&&!mistRimPieces.includes(p))
 expect(kept.length).toBeGreaterThan(30)
 for(const [i,p] of kept.entries()){
  expect(pieces[i].kit).toBe(p.kit);expect(pieces[i].role).toBe(p.role)
  for(const key of ['x','y','z','yaw','scale'] as const)expect(Math.abs(pieces[i][key]-p[key])).toBeLessThan(1e-10)
 }
 expect(pieces.length).toBe(kept.length)
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
