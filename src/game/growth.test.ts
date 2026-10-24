import {expect,it} from 'vitest'
import {advanceTree,decodeTree,growthRemaining,growthStages} from './growth'
it('grows through four distinct stages at the boundaries, including time away',()=>{
 const t={version:2 as const,plantedAt:100000,stage:0}
 for(let i=1;i<4;i++){
  expect(advanceTree(t,100000+growthStages[i].at-1).stage).toBe(i-1)
  expect(advanceTree(t,100000+growthStages[i].at).stage).toBe(i)
 }
 expect(decodeTree(JSON.stringify(t),null,999999)?.stage).toBe(3)
 expect(growthRemaining(t,100000)).toBe(45)
})
it('migrates existing plantings and never regresses an attained stage after clock rollback',()=>{
 const migrated=decodeTree(null,'true',500000)!
 expect(migrated.stage).toBe(1)
 expect(advanceTree({...migrated,stage:3},1).stage).toBe(3)
 expect(decodeTree('{broken','true',500000)?.stage).toBe(1)
 expect(decodeTree('{broken',null,500000)).toBeNull()
 for(const bad of [NaN,-1,Infinity])expect(decodeTree(JSON.stringify({version:2,plantedAt:bad,stage:0}),null,500000)).toBeNull()
})
