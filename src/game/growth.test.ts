import {expect,it} from 'vitest'
import {advanceGarden,advanceTree,decodeGarden,growthRemaining,growthStages,plant,plantedToday,plantingSpots,plantingStand,plotNear,treeAt,trunks,type Garden} from './growth'
import {canStandAt,standBlocker} from './movement'
import {pathEdgeDistance} from '../world/terrain'
import {forageSpots} from './forage'
import {vegetationPositions} from '../world/vegetationLayout'

it('grows through four distinct stages at the boundaries, including time away',()=>{
 const t={spot:0,plantedAt:100000,stage:0,day:0}
 for(let i=1;i<4;i++){
  expect(advanceTree(t,100000+growthStages[i].at-1).stage).toBe(i-1)
  expect(advanceTree(t,100000+growthStages[i].at).stage).toBe(i)
 }
 expect(decodeGarden(JSON.stringify({version:3,trees:[t]}),null,null,999999).trees[0].stage).toBe(3)
 expect(growthRemaining(t,100000)).toBe(45)
})

it('migrates the single v2 tree and the v1 seedling to the first plot, and never regresses a stage',()=>{
 const v2=decodeGarden(null,JSON.stringify({version:2,plantedAt:100000,stage:2}),null,500000)
 expect(v2.trees).toEqual([{spot:0,plantedAt:100000,stage:3,day:0}])
 const migrated=decodeGarden(null,null,'true',500000).trees[0]
 expect(migrated).toMatchObject({spot:0,stage:1})
 expect(advanceTree({...migrated,stage:3},1).stage).toBe(3)
 expect(decodeGarden('{broken',null,'true',500000).trees[0].stage).toBe(1)
 expect(decodeGarden('{broken',null,null,500000).trees).toEqual([])
 for(const bad of [NaN,-1,Infinity])expect(decodeGarden(null,JSON.stringify({version:2,plantedAt:bad,stage:0}),null,500000).trees).toEqual([])
 // A v3 save wins over the older ones; two trees on one plot or an unknown plot is broken.
 const one={spot:2,plantedAt:1000,stage:0,day:3}
 expect(decodeGarden(JSON.stringify({version:3,trees:[one]}),JSON.stringify({version:2,plantedAt:0,stage:0}),null,2000).trees.map(t=>t.spot)).toEqual([2])
 for(const trees of [[one,one],[{...one,spot:9}],[{...one,day:-1}],[{...one,stage:4}]])
  expect(decodeGarden(JSON.stringify({version:3,trees}),null,null,2000).trees).toEqual([])
})

it('plants one new tree a day, never two on one plot, and advances only what grew',()=>{
 let g:Garden={version:3,trees:[]}
 g=plant(g,0,1000,2)
 expect(plantedToday(g,2)).toBe(true)
 expect(plant(g,1,1000,2)).toBe(g)
 expect(plant(g,0,1000,3)).toBe(g)
 g=plant(g,1,5000,3)
 expect(g.trees.map(t=>[t.spot,t.day])).toEqual([[0,2],[1,3]])
 expect(advanceGarden(g,5000)).toBe(g)
 const later=advanceGarden(g,1000+growthStages[1].at)
 expect(later.trees[0].stage).toBe(1);expect(later.trees[1]).toBe(g.trees[1])
 expect(treeAt(later,1)?.plantedAt).toBe(5000)
 expect(trunks(later)).toEqual([{x:0,z:8,r:.11},{x:-10,z:14.5,r:.06}])
})

it('finds the nearest plot within reach and stands the raccoon clear of the sapling',()=>{
 expect(plotNear({x:0,z:9})).toBe(0)
 expect(plotNear({x:12.5,z:12})).toBe(2)
 expect(plotNear({x:0,z:11})).toBeNull()
 const stand=plantingStand({x:0,z:8.1},0)
 expect(Math.hypot(stand.x,stand.z-8)).toBeCloseTo(.8)
 expect(plantingStand({x:1,z:8},0)).toEqual({x:1,z:8})
})

it('puts every plot on open, flat ground: off paths, apart from plants, finds and each other, with room to walk round a grown tree',()=>{
 plantingSpots.forEach((s,i)=>{
  expect(canStandAt(s.x,s.z),`plot ${i}`).toBe(true)
  // Plot 0 is the original sapling corner beside the trail; the new five keep off paths and plants.
  if(i>0){
   expect(pathEdgeDistance(s.x,s.z),`plot ${i} path`).toBeGreaterThan(1.2)
   expect(Math.min(...vegetationPositions.map(p=>Math.hypot(p.x-s.x,p.z-s.z))),`plot ${i} plants`).toBeGreaterThan(3)
  }
  expect(Math.min(...forageSpots.map(p=>Math.hypot(p.x-s.x,p.z-s.z))),`plot ${i} finds`).toBeGreaterThan(1.6)
  for(let a=0;a<8;a++)for(const r of [.7,1.3])expect(canStandAt(s.x+Math.cos(a*Math.PI/4)*r,s.z+Math.sin(a*Math.PI/4)*r),`plot ${i} ring ${a}/${r}`).toBe(true)
  plantingSpots.forEach((o,j)=>{if(j>i)expect(Math.hypot(o.x-s.x,o.z-s.z)).toBeGreaterThan(6)})
 })
 const grown=trunks({version:3,trees:plantingSpots.map((_,spot)=>({spot,plantedAt:0,stage:3,day:spot}))})
 plantingSpots.forEach(s=>expect(standBlocker(s.x,s.z,grown)).toBe('planted tree'))
})
