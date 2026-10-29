import before from '../../docs/evidence/2026-10-29-west-expansion/before/world-snapshot.json'
import {expect,it} from 'vitest'
import {terrainHeight} from './terrain'
import {originalVegetationPositions,lampPositions} from './vegetationLayout'
import {canStandAt,moveOnGround,groundHeightAt,standBlocker} from '../game/movement'
import {westTrailPoints,westWetland,westBoardwalk,onWestBoardwalk,westWetlandRadius} from './westExpansion'
import {seaLevel,landing,mooring} from './worldConfig'

it('preserves the captured original gameplay terrain, vegetation and berth without a save migration',()=>{
 for(const [x,z,y] of before.terrainSamples)expect(terrainHeight(x,z),`${x},${z}`).toBeCloseTo(y,9)
 const precise=(value:unknown)=>JSON.parse(JSON.stringify(value,(_,v:unknown)=>typeof v==='number'?Math.round(v*1e9)/1e9:v))
 expect(precise(originalVegetationPositions)).toEqual(precise(before.plants));expect(precise(lampPositions)).toEqual(precise(before.lamps))
 expect(landing).toEqual(before.landing);expect(mooring).toEqual(before.mooring)
})

it('walks the full western loop both ways, including the wetland deck, and rejects water',()=>{
 for(const points of [westTrailPoints,[...westTrailPoints].reverse()]){
  let position:{x:number;z:number}={x:points[0][0],z:points[0][1]}
  for(const [tx,tz] of points.slice(1)){
   const start={...position},steps=Math.ceil(Math.hypot(tx-start.x,tz-start.z)/.1)
   for(let i=1;i<=steps;i++){
    const x=start.x+(tx-start.x)*i/steps,z=start.z+(tz-start.z)*i/steps
    expect(standBlocker(x,z),`blocked at ${x},${z}`).toBeNull()
    position=moveOnGround(position,x-position.x,z-position.z)
    expect(Math.hypot(position.x-x,position.z-z)).toBeLessThan(.001)
   }
  }
 }
 expect(groundHeightAt(westWetland.x,westWetland.z)).toBe(westBoardwalk.y)
 expect(canStandAt(westWetland.x,westWetland.z+1.8)).toBe(false)
 expect(canStandAt(-85,8)).toBe(false)
})

it('adds usable land without counting the submerged seabed as expansion',()=>{
 let area=0
 for(let x=-86;x<=45;x+=.5)for(let z=-44;z<=44;z+=.5){
  const h=terrainHeight(x,z),slope=Math.hypot(terrainHeight(x+.15,z)-terrainHeight(x-.15,z),terrainHeight(x,z+.15)-terrainHeight(x,z-.15))/.3
  if(h>=seaLevel+.16&&slope<=.85)area+=.25
 }
 console.log('WEST_GROUND_AREA',area,'growth',area/before.groundArea-1)
 expect(area).toBeGreaterThan(before.groundArea*1.35)
 expect(area).toBeLessThan(before.groundArea*1.65)
})

it('keeps both deck edges continuous and rejects the irregular wetland shallows',()=>{
 for(let x=westBoardwalk.minX+.3;x<westBoardwalk.maxX-.3;x+=.12){
  for(const z of [westBoardwalk.z-.6,westBoardwalk.z+.6]){
   expect(canStandAt(x,z),`deck edge ${x},${z}`).toBe(true)
   expect(groundHeightAt(x,z)).toBeCloseTo(westBoardwalk.y,8)
  }
 }
 let wetSamples=0
 for(let x=westWetland.x-5;x<=westWetland.x+5;x+=.2)for(let z=westWetland.z-4;z<=westWetland.z+4;z+=.2){
  if(westWetlandRadius(x,z)<1.25&&!onWestBoardwalk(x,z)&&terrainHeight(x,z)<westWetland.waterY){
   wetSamples++;expect(canStandAt(x,z),`water ${x},${z}`).toBe(false)
  }
 }
 expect(wetSamples).toBeGreaterThan(200)
 // Every side has a dry shoulder, including the lower sea-facing edge.
 for(let i=0;i<72;i++){
  const a=i*Math.PI/36,shape=1+.075*Math.sin(a*3+.4)+.045*Math.cos(a*5-.7)
  const x=westWetland.x+Math.cos(a)*westWetland.rx*shape*1.15,z=westWetland.z+Math.sin(a)*westWetland.rz*shape*1.15
  expect(terrainHeight(x,z)).toBeGreaterThan(westWetland.waterY+.16)
 }
 // The neighbouring dry coastal slope is not classified as freshwater (slope can still block walking).
 expect(westWetlandRadius(-64,-7.6)).toBeGreaterThan(1.35)
 expect(standBlocker(-64,-7.6)).not.toBe('terrain:water')
})
