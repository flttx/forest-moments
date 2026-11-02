import type {CoastKit,CoastPiece} from './coastalLayout'
import {tidePlants} from './vegetationLayout'
import {tideIsland,tideHeight,tidePathDistance,tidePools,tideBerth,tideObservation} from './tideIsland'

/** Reuse the authored Blender kit; reserve dry shoulders and the open observation apron. */
export function buildTideCoast(kits:Record<CoastKit,{height:number;half:number}>){
 let seed=301031
 const rand=()=>{seed=seed*16807%2147483647;return seed/2147483647}
 const shore:CoastPiece[]=[],pools:CoastPiece[]=[]
 const clear=(x:number,z:number,reach:number)=>tidePathDistance(x,z)>reach+1.15
  &&Math.hypot(x-tideBerth.landing.x,z-tideBerth.landing.z)>reach+7
  &&Math.hypot(x-tideObservation.x,z-tideObservation.z)>reach+2
  &&tidePlants.every(p=>Math.hypot(x-p.x,z-p.z)>reach+(p.kit==='bush-a'?.6:1.6))
 const footprint=(x:number,z:number,r:number)=>Array.from({length:32},(_,i)=>tideHeight(x+Math.cos(i*Math.PI/16)*r,z+Math.sin(i*Math.PI/16)*r))
 // Uneven clusters with open gaps: a big anchor stone, smaller companions, then bare shore.
 const sites:number[]=[]
 for(const [centre,count] of [[-2.75,5],[-2.3,8],[-1.85,4],[-1.45,6],[-.95,4],[-.55,7],[.1,4],[.5,3],[.85,7],[1.3,4],[1.7,6],[2.1,3],[2.45,6]]){
  let a=centre-count*.05
  for(let i=0;i<count;i++){a+=.04+rand()*.1;sites.push(a)}
 }
 for(const a of sites){
  const anchor=rand()<.3,first:CoastKit=rand()<.3?'Rock_Slab':'Rock_Boulder',jitter=rand(),sink=.86+rand()*.16
  // Where the dry rim is too narrow for the chosen stone, fall back to smaller ones instead of leaving a hole.
  for(const [kit,scale] of [[first,anchor?1.15+jitter*.45:.72+jitter*.38],['Rock_Boulder',.74],['Rock_Cobbles',.8]] as [CoastKit,number][]){
   const reach=kits[kit].half*scale
   let low=10,high=25
   for(let j=0;j<28;j++){const r=(low+high)/2;if(tideHeight(tideIsland.x+Math.cos(a)*r,tideIsland.z+Math.sin(a)*r)>.06)low=r;else high=r}
   let r=(low+high)/2-jitter*.5,x=tideIsland.x+Math.cos(a)*r,z=tideIsland.z+Math.sin(a)*r
   // Entire mesh footprint must stay above boat water, not just its anchor.
   for(let j=0;j<40&&Math.min(...footprint(x,z,reach))<-.72;j++){r-=.1;x=tideIsland.x+Math.cos(a)*r;z=tideIsland.z+Math.sin(a)*r}
   if(Math.min(...footprint(x,z,reach))<-.72||!clear(x,z,reach))continue
   if(shore.some(p=>Math.hypot(x-p.x,z-p.z)<(reach+kits[p.kit].half*p.scale)*.5))continue
   shore.push({kit,x,z,y:tideHeight(x,z)-kits[kit].height*scale*sink,scale,yaw:jitter*Math.PI*2,role:'cliff'})
   break
  }
 }
 for(const pool of tidePools)for(let i=0;i<12;i++){
  if(i===2||i===3||i===7||i===8)continue
  const a=i*Math.PI/6+pool.phase*.23+(rand()-.5)*.15,outline=1+.08*Math.sin(a*3+pool.phase)+.045*Math.cos(a*5-pool.phase)
  const kit:CoastKit=i===0?'Rock_Boulder':'Rock_Cobbles',scale=.7+rand()*.28,reach=kits[kit].half*scale
  const x=pool.x+Math.cos(a)*(pool.rx*outline*1.25+reach*.3),z=pool.z+Math.sin(a)*(pool.rz*outline*1.25+reach*.3)
  if(!clear(x,z,reach)||pools.some(p=>Math.hypot(x-p.x,z-p.z)<(reach+kits[p.kit].half*p.scale)*.82))continue
  const y=Math.min(tideHeight(x,z)-kits[kit].height*scale*.82,Math.min(...footprint(x,z,reach))-.07)
  pools.push({kit,x,z,y,scale,yaw:rand()*Math.PI*2,role:'cliff'})
 }
 return{shore,pools}
}
