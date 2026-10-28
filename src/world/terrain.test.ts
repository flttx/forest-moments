import {onBridge,bridgeHeight} from '../game/expansion'
import { expect, it } from 'vitest'
import { canStandAt, groundHeightAt, dockDeckHeight } from '../game/movement'
import { pond } from '../game/rowing'
import { coastRadius, seaLevel, terrainHeight, pathRelief, pathDistance } from './terrain'
import {pondRadiusAt,pondWaterInset} from './pondShape'

it('keeps the trail passable beside each planted trunk radius',()=>{
  for(const r of [.06,.11,.19,.32]){
    expect(canStandAt(0,8,[{x:0,z:8,r}])).toBe(false)
    expect(canStandAt(-1,8,[{x:0,z:8,r}])).toBe(true)
    expect(canStandAt(0,6.6,[{x:0,z:8,r}])).toBe(true)
  }
})

it('keeps the irregular pond waterline on its bank and the west fishing spot accessible',()=>{
  const radii=[]
  for(let a=0;a<Math.PI*2;a+=.05){
    const r=pondRadiusAt(a);radii.push(r)
    const x=pond.x+Math.cos(a)*(r-pondWaterInset),z=pond.z+Math.sin(a)*(r-pondWaterInset)
    expect(terrainHeight(x,z)).toBeCloseTo(pond.waterY,6)
    expect(canStandAt(x,z)).toBe(false)
    expect(terrainHeight(pond.x+Math.cos(a)*(r+.3),pond.z+Math.sin(a)*(r+.3))).toBe(0)
  }
  expect(Math.max(...radii)-Math.min(...radii)).toBeGreaterThan(.6)
  expect(pondRadiusAt(Math.PI)).toBe(pond.radius)
  expect(canStandAt(1.5,-5)).toBe(true)
})

it('matches walkable relief and preserves the dock while placing the coast and basin below water',()=>{
  for(let x=-23;x<=23;x+=.2) for(let z=-23;z<=23;z+=.2) {
    if(canStandAt(x,z)&&groundHeightAt(x,z)!==dockDeckHeight)expect(groundHeightAt(x,z)).toBe(onBridge(x,z)?bridgeHeight(z):terrainHeight(x,z))
  }
  expect(terrainHeight(pond.x,pond.z)).toBeLessThan(pond.waterY-.5)
  for(let a=0;a<Math.PI*2;a+=.1) {
    const r=coastRadius(a)+1.8
    expect(terrainHeight(Math.cos(a)*r,Math.sin(a)*r)).toBeLessThan(seaLevel)
  }
})

it('gives trails bounded continuous relief without moving foundations or interaction pads',()=>{
  let minimum=0,maximum=0
  for(let x=-22;x<=22;x+=.3)for(let z=-22;z<=22;z+=.3){
    const h=pathRelief(x,z);minimum=Math.min(minimum,h);maximum=Math.max(maximum,h)
    expect(Math.abs(h)).toBeLessThan(.126)
    expect(Math.abs(h-pathRelief(x+.1,z))).toBeLessThan(.06)
    expect(Math.abs(h-pathRelief(x,z+.1))).toBeLessThan(.06)
  }
  expect(maximum-minimum).toBeGreaterThan(.1)
  for(const [x,z] of [[0,0],[-12,8],[13,-8],[8,6],[1.5,-5],[23,0],[0,8]])expect(pathRelief(x,z)).toBe(0)
})

it('keeps every drawn trail surface within the walking slope limit',()=>{
  const steep=[]
  for(let x=-35;x<=35;x+=.5)for(let z=-35;z<=35;z+=.5){
    if(pathDistance(x,z)>.8||onBridge(x,z)||Math.hypot(x,z)>35)continue
    const slope=Math.hypot(terrainHeight(x+.15,z)-terrainHeight(x-.15,z),terrainHeight(x,z+.15)-terrainHeight(x,z-.15))/.3
    if(slope>.85)steep.push([x,z,slope])
  }
  expect(steep).toEqual([])
})
