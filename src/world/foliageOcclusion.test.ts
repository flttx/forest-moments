import {expect,it} from 'vitest'
import {updateFoliageOcclusion} from './foliageOcclusion'
import type {FoliageOccluder} from './foliageOcclusion'
const camera={x:0,y:1,z:10},focus={x:0,y:1,z:0}
const tree=():FoliageOccluder=>({center:{x:0,y:1,z:5},radius:{x:1,y:2,z:1},hidden:false,visibility:1})

it('conceals the complete foreground crown and restores it in a bounded transition',()=>{
  const t=tree()
  for(let i=0;i<12;i++)updateFoliageOcclusion(t,camera,focus,1/60)
  expect(t.visibility).toBe(0)
  t.center.x=3
  for(let i=0;i<12;i++)updateFoliageOcclusion(t,camera,focus,1/60)
  expect(t.visibility).toBe(1)
  t.center={x:0,y:1,z:-5}
  updateFoliageOcclusion(t,camera,focus,.05)
  expect(t.hidden).toBe(false)
})

it('keeps the previous state near a crown edge rather than alternating each frame',()=>{
  const t=tree();t.center.x=.99
  updateFoliageOcclusion(t,camera,focus,.016)
  expect(t.hidden).toBe(true)
  t.center.x=1.08
  updateFoliageOcclusion(t,camera,focus,.016)
  expect(t.hidden).toBe(true)
  t.center.x=1.16
  updateFoliageOcclusion(t,camera,focus,.016)
  expect(t.hidden).toBe(false)
  t.center.x=1.08
  updateFoliageOcclusion(t,camera,focus,.016)
  expect(t.hidden).toBe(false)
})
