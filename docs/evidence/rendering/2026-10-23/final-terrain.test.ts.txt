import { expect, it } from 'vitest'
import { canStandAt, groundHeightAt } from '../game/movement'
import { pond } from '../game/rowing'
import { coastRadius, seaLevel, terrainHeight } from './terrain'

it('preserves the collision plateau and dock while placing the coast and basin below water',()=>{
  for(let x=-16.4;x<=16.4;x+=.2) for(let z=-16.4;z<=16.4;z+=.2) {
    if(canStandAt(x,z)&&groundHeightAt(x,z)===0)expect(Math.abs(terrainHeight(x,z))).toBe(0)
  }
  expect(terrainHeight(pond.x,pond.z)).toBeLessThan(pond.waterY-.5)
  for(let a=0;a<Math.PI*2;a+=.1) {
    const r=coastRadius(a)+1.8
    expect(terrainHeight(Math.cos(a)*r,Math.sin(a)*r)).toBeLessThan(seaLevel)
  }
})
