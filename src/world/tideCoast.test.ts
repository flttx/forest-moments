import {expect,it} from 'vitest'
import {coastPieces,coastKits,tideShorePieces,tidePoolPieces,autumnRimPieces,mistRimPieces} from './coastalLayout'
import {tideHeight,tidePathDistance,tideBerth,tideObservation} from './tideIsland'
import {isNavigableSea} from '../game/rowing'
import baseline from '../../docs/evidence/2026-10-30-tide-rock-coast/before/coast-snapshot.json'

it('preserves every adopted old coast placement while adding a bounded tide shore and pool dressing',()=>{
 // Browser and Node trigonometric results can differ at the last binary digit.
 for(const [i,p] of baseline.entries()){
  expect(coastPieces[i].kit).toBe(p.kit);expect(coastPieces[i].role).toBe(p.role)
  for(const key of ['x','y','z','yaw','scale'] as const)expect(Math.abs(coastPieces[i][key]-p[key])).toBeLessThan(1e-10)
 }
 expect(coastPieces.length).toBe(baseline.length+tideShorePieces.length+tidePoolPieces.length+autumnRimPieces.length+mistRimPieces.length)
 expect(tideShorePieces.length).toBeGreaterThan(8);expect(tideShorePieces.length).toBeLessThan(60)
 expect(tidePoolPieces.length).toBeGreaterThan(5);expect(tidePoolPieces.length).toBeLessThan(30)
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
 expect(autumnRimPieces.length).toBeGreaterThan(12);expect(mistRimPieces.length).toBeGreaterThan(12)
 expect(autumnRimPieces.length).toBeLessThan(60);expect(mistRimPieces.length).toBeLessThan(60)
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
