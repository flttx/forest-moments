import {afterEach,expect,it} from 'vitest'
import {furnitureAt,furniturePlaces,setMadeFurniture} from './furniture'
import {canStandAt,standBlocker} from './movement'
import {canStandInBedroom,bedroomSpawn} from './expansion'
import {fishingSpot} from './fishing'
import {pathEdgeDistance} from '../world/terrain'

afterEach(()=>setMadeFurniture([]))
it('each place is open ground until the piece is made, then blocks there',()=>{
 for(const [id,f] of Object.entries(furniturePlaces)){
  if(!f.rect)continue
  expect(f.place==='bedroom'?canStandInBedroom(f.x,f.z):canStandAt(f.x,f.z)).toBe(true)
  setMadeFurniture([id as keyof typeof furniturePlaces])
  expect(f.place==='bedroom'?canStandInBedroom(f.x,f.z):canStandAt(f.x,f.z)).toBe(false)
  if(f.place==='island')expect(standBlocker(f.x,f.z)).toBe(`furniture:${id}`)
  setMadeFurniture([])
 }
})
it('made pieces leave the spawn, the angler, the path and the bedroom door free',()=>{
 setMadeFurniture(['table','birdhouse','rodRack','signpost'])
 expect(canStandAt(0,0)).toBe(true)
 expect(canStandAt(fishingSpot.x,fishingSpot.z)).toBe(true)
 expect(canStandInBedroom(0,2.4)).toBe(true);expect(canStandInBedroom(bedroomSpawn.x,bedroomSpawn.z)).toBe(true)
 // The signpost stands beside the fork, not on the track.
 const s=furniturePlaces.signpost;expect(pathEdgeDistance(s.x,s.z)).toBeGreaterThan(.3)
 // The birdhouse hangs above head height and blocks nothing.
 expect(furnitureAt('island',furniturePlaces.birdhouse.x,furniturePlaces.birdhouse.z,.28)).toBeNull()
})
it('the rack footprint turns with its yaw',()=>{
 setMadeFurniture(['rodRack'])
 const r=furniturePlaces.rodRack
 // Long side runs along z (yaw 90°): 0.4 m along z is inside, 0.4 m along x is not.
 expect(furnitureAt('island',r.x,r.z+.4,.01)).toBe('rodRack')
 expect(furnitureAt('island',r.x+.4,r.z,.01)).toBeNull()
})
