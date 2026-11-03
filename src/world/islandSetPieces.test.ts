import {expect,it} from 'vitest'
import {canStandAt,moveOnGround} from '../game/movement'
import {seats,seatOrigin} from '../game/expansion'
import {skySeats} from '../game/campfire'
import {berths,dockAt} from './worldConfig'
import {terrainHeight} from './terrain'
import {instanceCircles,islandLampPositions,lampPositions,vegetationPositions} from './vegetationLayout'
import {islandSigns,signHalf} from './islandSetPieces'
import {mistPathDistance,mistLoop,mistRadius} from './mistIsland'
import {autumnPathDistance,autumnLoop,autumnRadius} from './autumnIsland'
import {tidePathDistance,tideLoop,tideRadius} from './tideIsland'

const islands={
 mist:{trail:mistPathDistance,loop:mistLoop,on:(x:number,z:number)=>mistRadius(x,z)<1.25,berth:berths.mist},
 autumn:{trail:autumnPathDistance,loop:autumnLoop,on:(x:number,z:number)=>autumnRadius(x,z)<1.25,berth:berths.autumn},
 tide:{trail:tidePathDistance,loop:tideLoop,on:(x:number,z:number)=>tideRadius(x,z)<1.25,berth:berths.tide},
} as const
const benches={mist:seats.find(s=>s.id==='mistBench')!,autumn:seats.find(s=>s.id==='autumnBench')!,tide:seats.find(s=>s.id==='tideBench')!}
const islandOf=(x:number,z:number)=>(Object.keys(islands) as (keyof typeof islands)[]).find(k=>islands[k].on(x,z))
/** Everywhere on the island (and its dock) reachable on foot from the landing, on a 0.25 m grid. */
function reach(from:{x:number;z:number},on:(x:number,z:number)=>boolean){
 const step=.25,key=(x:number,z:number)=>`${Math.round(x/step)},${Math.round(z/step)}`,seen=new Set([key(from.x,from.z)]),queue=[from],out:{x:number;z:number}[]=[]
 while(queue.length){
  const p=queue.pop()!;out.push(p)
  for(const [dx,dz] of [[step,0],[-step,0],[0,step],[0,-step]]){
   const nx=p.x+dx,nz=p.z+dz,k=key(nx,nz);if(seen.has(k)||!on(nx,nz)&&!dockAt(nx,nz))continue
   seen.add(k);if(!canStandAt(nx,nz))continue
   const end=moveOnGround(p,dx,dz);if(Math.hypot(end.x-nx,end.z-nz)>.001)continue
   queue.push({x:nx,z:nz})
  }
 }
 return out
}

it('puts one bench, five lamps and a signpost on each neighbour island, the main island keeping its own lamps',()=>{
 expect(lampPositions.length).toBeLessThanOrEqual(12)
 for(const k of Object.keys(islands) as (keyof typeof islands)[]){
  expect(islandOf(benches[k].x,benches[k].z)).toBe(k)
  // dock head, bench, and three spread round the loop at least 9 m apart
  const lamps=islandLampPositions.filter(l=>islandOf(l.x,l.z)===k)
  expect(lamps).toHaveLength(5)
  for(const a of lamps)for(const b of lamps)if(a!==b)expect(Math.hypot(a.x-b.x,a.z-b.z)).toBeGreaterThan(5)
  expect(islandSigns.filter(s=>islandOf(s.x,s.z)===k)).toHaveLength(1)
 }
 // the island benches are skies to look at too
 for(const s of Object.values(benches))expect((skySeats as readonly string[]).includes(s.id)).toBe(true)
})
it('keeps the set pieces off the trail, clear of the trees and on level ground',()=>{
 const trees=vegetationPositions.flatMap(instanceCircles)
 for(const lamp of islandLampPositions){
  const k=islandOf(lamp.x,lamp.z)!
  for(const c of instanceCircles(lamp)){
   expect(islands[k].trail(c.x,c.z)-c.r,`lamp post ${lamp.x},${lamp.z}`).toBeGreaterThan(1)
   expect(trees.every(t=>Math.hypot(t.x-c.x,t.z-c.z)>t.r+c.r+.3)).toBe(true)
  }
 }
 for(const s of islandSigns){
  expect(islands[s.island].trail(s.x,s.z)).toBeGreaterThan(.8)
  expect(trees.every(t=>Math.hypot(t.x-s.x,t.z-s.z)>t.r+signHalf.hx+.2)).toBe(true)
 }
 for(const [k,b] of Object.entries(benches) as [keyof typeof islands,typeof benches.mist][]){
  const corners=[[-1.2,-.53],[1.2,-.53],[-1.2,.53],[1.2,.53],[0,0]].map(([u,v])=>[b.x+u*Math.cos(b.yaw)+v*Math.sin(b.yaw),b.z-u*Math.sin(b.yaw)+v*Math.cos(b.yaw)])
  const h=corners.map(([x,z])=>terrainHeight(x,z));expect(Math.max(...h)-Math.min(...h),`${k} bench tilt`).toBeLessThan(.2)
  for(const [x,z] of corners){expect(islands[k].trail(x,z)).toBeGreaterThan(.5);expect(trees.every(t=>Math.hypot(t.x-x,t.z-z)>t.r+.25)).toBe(true)}
 }
})
it('leaves each island trail open and every bench reachable on foot from its landing',()=>{
 for(const [k,isle] of Object.entries(islands) as [keyof typeof islands,typeof islands.mist][]){
  // the trail centre line stays walkable past the new posts, heads and boards
  const blocked:string[]=[]
  for(let i=0;i<isle.loop.length-1;i++)for(let t=0;t<=1;t+=.05){const [ax,az]=isle.loop[i],[bx,bz]=isle.loop[i+1],x=ax+(bx-ax)*t,z=az+(bz-az)*t;if(isle.trail(x,z)<.3&&!canStandAt(x,z))blocked.push(`${x.toFixed(1)},${z.toFixed(1)}`)}
  expect(blocked,`${k} trail`).toEqual([])
  const area=reach(isle.berth.landing,isle.on),o=seatOrigin(benches[k])
  expect(canStandAt(o.x,o.z),`${k} bench front`).toBe(true)
  expect(area.some(p=>Math.hypot(p.x-o.x,p.z-o.z)<.36),`${k} bench reachable`).toBe(true)
 }
},30000)
