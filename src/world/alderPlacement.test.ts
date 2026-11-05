import {expect,it} from 'vitest'
import {alderPlants,canopySpheres} from './vegetationLayout'
import {westWetlandRadius,westBoardwalkDistance,westWetland} from './westExpansion'
import {creekDistance,creekWaterY} from '../game/expansion'
import {standBlocker} from '../game/movement'
import {terrainHeight} from './terrain'

it('stands the alders on dry ground at the wetland pools and the creek bank, clear of the boardwalk',()=>{
 expect(alderPlants.some(p=>westWetlandRadius(p.x,p.z)<3.2)).toBe(true)
 expect(alderPlants.some(p=>creekDistance(p.x,p.z)<4.5)).toBe(true)
 for(const p of alderPlants){
  expect(standBlocker(p.x,p.z)).toBe('plant:ie-alder')
  expect(canopySpheres.some(c=>Math.hypot(c.x-p.x,c.z-p.z)<.01)).toBe(true)
  // roots on land above the water beside them, low boughs off the deck
  expect(westWetlandRadius(p.x,p.z)).toBeGreaterThan(1.75)
  expect(terrainHeight(p.x,p.z)).toBeGreaterThan(westWetland.waterY)
  expect(creekDistance(p.x,p.z)).toBeGreaterThan(3)
  expect(westBoardwalkDistance(p.x,p.z)).toBeGreaterThanOrEqual(3.2)
  if(creekDistance(p.x,p.z)<4.5)expect(terrainHeight(p.x,p.z)-creekWaterY(p.x)).toBeLessThan(1.2)
 }
})
