import {expect,it} from 'vitest'
import {tideDriftwood} from './tideDetailsLayout'
import {tidePlants} from './vegetationLayout'
import {tideShorePieces,tidePoolPieces,coastKits} from './coastalLayout'
import {tideHeight,tidePathDistance,tidePools,poolRadius,tideTurf} from './tideIsland'
import {standBlocker} from '../game/movement'

it('adds a windswept pine stand, shrubs and driftwood that stay off the loop, pools and rocks',()=>{
 const pines=tidePlants.filter(p=>p.kit.startsWith('ie-windswept-pine')),shrubs=tidePlants.filter(p=>p.kit==='bush-a')
 expect(pines.length).toBeGreaterThanOrEqual(4);expect(pines.length).toBeLessThanOrEqual(6)
 // Two windswept forms, so the stand is not one tree repeated.
 expect(new Set(pines.map(p=>p.kit)).size).toBe(2)
 expect(shrubs.length).toBeGreaterThanOrEqual(6)
 expect(tideDriftwood.length).toBeGreaterThanOrEqual(3)
 // Most pines group on the northern rim, as in the reference silhouette.
 expect(pines.filter(p=>p.z<101).length).toBeGreaterThanOrEqual(pines.length-1)
 const rocks=[...tideShorePieces,...tidePoolPieces]
 for(const p of [...tidePlants,...tideDriftwood]){
  expect(tideHeight(p.x,p.z)).toBeGreaterThan(.1)
  expect(tidePathDistance(p.x,p.z)).toBeGreaterThan(1)
  expect(tidePools.every(q=>poolRadius(p.x,p.z,q)>1)).toBe(true)
  expect(rocks.every(r=>Math.hypot(p.x-r.x,p.z-r.z)>coastKits[r.kit].half*r.scale)).toBe(true)
 }
 for(const p of tidePlants)expect(standBlocker(p.x,p.z)).toBe(`plant:${p.kit}`)
 expect(tideTurf(91,96)).toBe(0)
})
