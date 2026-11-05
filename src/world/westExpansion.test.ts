import before from '../../docs/evidence/2026-10-29-west-expansion/before/world-snapshot.json'
import {expect,it} from 'vitest'
import {terrainHeight} from './terrain'
import {westPlants} from './vegetationLayout'
import {canStandAt,moveOnGround,groundHeightAt,standBlocker} from '../game/movement'
import {westTrailPoints,westWetland,westBoardwalk,onWestBoardwalk,westWetlandRadius,westCove} from './westExpansion'
import {seaLevel,landing,mooring} from './worldConfig'
import {inCreekRework} from '../game/expansion'

it('keeps the berth and the old high ground after the main island was re-laid',()=>{
 // 2026-11-03: the user approved re-laying the main island (coast, relief, bending paths, plants), so exact terrain and
 // plant positions are no longer frozen. Saves need no migration: the berth is where it was,
 // and the old island's ground still stands above the sea where it did.
 expect(landing).toEqual(before.landing);expect(mooring).toEqual(before.mooring)
 for(const [x,z,y] of before.terrainSamples)if(y>seaLevel+.5&&Math.hypot(x,z)<30&&!inCreekRework(x,z))expect(terrainHeight(x,z),`${x},${z}`).toBeGreaterThan(seaLevel+.16)
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
 expect(groundHeightAt(westBoardwalk.points[2][0],westBoardwalk.points[2][1])).toBe(westBoardwalk.y)
 // Open water beside the deck, inside the middle pocket.
 expect(canStandAt(-59.4,-1.2)).toBe(false)
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

it('keeps the zigzag deck continuous edge to edge and rejects the wetland shallows around it',()=>{
 const p=westBoardwalk.points
 for(let i=0;i<p.length-1;i++){
  const [ax,az]=p[i],[bx,bz]=p[i+1],length=Math.hypot(bx-ax,bz-az),nx=-(bz-az)/length,nz=(bx-ax)/length
  for(let t=0;t<=1;t+=.02)for(const side of [-.4,0,.4]){
   const x=ax+(bx-ax)*t+nx*side,z=az+(bz-az)*t+nz*side
   expect(canStandAt(x,z),`deck ${x.toFixed(2)},${z.toFixed(2)}`).toBe(true)
   expect(groundHeightAt(x,z)).toBeCloseTo(westBoardwalk.y,8)
  }
 }
 // The deck crosses water: most of its length stands over the marsh, a hand above the surface.
 let over=0,total=0
 for(let i=0;i<p.length-1;i++)for(let t=0;t<=1;t+=.05){const x=p[i][0]+(p[i+1][0]-p[i][0])*t,z=p[i][1]+(p[i+1][1]-p[i][1])*t;total++;if(westWetlandRadius(x,z)<1)over++}
 expect(over/total).toBeGreaterThan(.55)
 expect(westBoardwalk.y-westWetland.waterY).toBeGreaterThan(.2);expect(westBoardwalk.y-westWetland.waterY).toBeLessThan(.45)
 let wetSamples=0
 for(let x=-68;x<=-50;x+=.2)for(let z=-10;z<=2;z+=.2){
  if(westWetlandRadius(x,z)<1.25&&!onWestBoardwalk(x,z)&&terrainHeight(x,z)<westWetland.waterY){
   wetSamples++;expect(canStandAt(x,z),`water ${x},${z}`).toBe(false)
  }
 }
 expect(wetSamples).toBeGreaterThan(600)
 // Every pocket keeps a dry shoulder where it does not run into a neighbour, including the lower sea-facing edge.
 for(const [cx,cz,rx,rz,phase] of westWetland.lobes)for(let i=0;i<72;i++){
  const a=i*Math.PI/36,shape=1+.09*Math.sin(a*3+phase)+.05*Math.cos(a*5-phase*1.7)
  const x=cx+Math.cos(a)*rx*shape*1.2,z=cz+Math.sin(a)*rz*shape*1.2
  if(westWetlandRadius(x,z)>1.15)expect(terrainHeight(x,z),`shoulder ${x.toFixed(1)},${z.toFixed(1)}`).toBeGreaterThan(westWetland.waterY+.16)
 }
 // The neighbouring dry coastal slope is not classified as freshwater (slope can still block walking).
 expect(westWetlandRadius(-64,-7.6)).toBeGreaterThan(1.35)
 expect(standBlocker(-64,-7.6)).not.toBe('terrain:water')
})

it('scatters the western forest off its 3.2 m sampling grid without crowding trunks',()=>{
 // grid trees (companion young trees and bushes sit at a fixed offset from them)
 const trees=westPlants.filter(p=>p.kit==='ie-spruce'||p.kit==='ie-old-pine')
 const onGrid=(v:number,origin:number)=>{const r=((v-origin)%3.2+3.2)%3.2;return Math.min(r,3.2-r)<.36}
 // the old layout kept every tree within ±0.35 m of a grid node, which read as diagonal rows from the overview;
 // blocked spots fall back to that near-grid position, so a minority may stay on it
 expect(trees.filter(p=>onGrid(p.x,-76)&&onGrid(p.z,-10)).length/trees.length).toBeLessThan(.35)
 for(const [i,a] of trees.entries())for(const b of trees.slice(i+1))expect(Math.hypot(a.x-b.x,a.z-b.z)).toBeGreaterThanOrEqual(1.9)
})
it('opens the old south slot into a small cove: dry sand at its head, water reaching in, no sand mound',()=>{
 const [ax,az]=westCove.a,[bx,bz]=westCove.b,at=(t:number)=>[ax+(bx-ax)*t,az+(bz-az)*t] as const
 // a dry beach at the head the raccoon can walk down onto, and water in the cove beyond it
 expect(terrainHeight(...at(.05))).toBeGreaterThan(seaLevel)
 expect(canStandAt(...at(.05))).toBe(true)
 for(const t of [.45,.7,.95])expect(terrainHeight(...at(t))).toBeLessThan(seaLevel)
 // the old fill was a flat-topped mound 0.6 m high; nothing along the cove stands that proud again
 for(let t=0;t<=1;t+=.05)expect(terrainHeight(...at(t))).toBeLessThan(0)
})
