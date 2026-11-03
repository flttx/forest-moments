import {expect,it} from 'vitest'
import {reefStacks,reefClusters,buoys,channels,channelDistance,reefBlocks,buoyBlocks,shelfDistance} from './archipelago'
import {coastKits} from './coastalLayout'
import {boatFits,isNavigableSea} from '../game/rowing'
import {landformHeight,seaRangeRadius} from './worldConfig'

it('rows every channel between the berths past the buoys and reefs',()=>{
 for(const [a,b] of channels){
  const heading=Math.atan2(-(b.z-a.z),b.x-a.x),steps=Math.ceil(Math.hypot(b.x-a.x,b.z-a.z))
  for(let i=0;i<=steps;i++){const x=a.x+(b.x-a.x)*i/steps,z=a.z+(b.z-a.z)*i/steps;if(landformHeight(x,z)<-2)expect(boatFits(x,z,heading),`${x},${z}`).toBe(true)}
 }
})

it('stands a few large reef clusters on open seabed along the shelf rim, clear of channels and the outer ring',()=>{
 expect(reefClusters.length).toBeGreaterThanOrEqual(6)
 for(const c of reefClusters){
  expect(channelDistance(c.x,c.z)).toBeGreaterThanOrEqual(9+c.r)
  expect(Math.hypot(c.x,c.z)).toBeLessThan(seaRangeRadius(Math.atan2(c.z,c.x))-14)
  expect(shelfDistance(c.x,c.z)).toBeGreaterThan(7)
 }
 for(const s of reefStacks){
  const reach=coastKits[s.kit].half*s.scale
  for(let i=0;i<12;i++)expect(landformHeight(s.x+Math.cos(i*Math.PI/6)*reach,s.z+Math.sin(i*Math.PI/6)*reach)).toBeLessThan(-2)
  // the rock breaks the surface, and the boat cannot pass through it
  expect(s.y+coastKits[s.kit].height*s.scale).toBeGreaterThan(-.85)
  expect(reefBlocks(s.x,s.z)).toBe(true);expect(isNavigableSea(s.x,s.z)).toBe(false)
 }
})

it('marks each channel with buoys the hull bumps but the lane leaves room for',()=>{
 expect(buoys.length).toBe(channels.length*2)
 for(const b of buoys){
  expect(buoyBlocks(b.x,b.z)).toBe(true);expect(isNavigableSea(b.x,b.z)).toBe(false)
  expect(channelDistance(b.x,b.z)).toBeGreaterThan(6)
 }
})
