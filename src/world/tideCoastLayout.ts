import type {CoastKit,CoastPiece} from './coastalLayout'
import {tideIsland,tideHeight,tidePathDistance,tidePools,tideBerth,tideObservation} from './tideIsland'

/** Reuse the authored Blender kit; reserve dry shoulders and the open observation apron. */
export function buildTideCoast(kits:Record<CoastKit,{height:number;half:number}>){
 let seed=301031
 const rand=()=>{seed=seed*16807%2147483647;return seed/2147483647}
 const shore:CoastPiece[]=[],pools:CoastPiece[]=[]
 const clear=(x:number,z:number,reach:number)=>tidePathDistance(x,z)>reach+1.15
  &&Math.hypot(x-tideBerth.landing.x,z-tideBerth.landing.z)>reach+7
  &&Math.hypot(x-tideObservation.x,z-tideObservation.z)>reach+2
 const footprint=(x:number,z:number,r:number)=>Array.from({length:32},(_,i)=>tideHeight(x+Math.cos(i*Math.PI/16)*r,z+Math.sin(i*Math.PI/16)*r))
 for(const [angle,count] of [[-2.1,5],[-1.15,5],[-.2,5],[.65,5],[1.65,4],[2.6,3]])for(let i=0;i<count;i++){
  const a=angle+(i-(count-1)/2)*.105+(rand()-.5)*.13
  const kit:CoastKit=rand()<.23?'Rock_Slab':'Rock_Boulder',scale=.8+rand()*.48,reach=kits[kit].half*scale
  let low=10,high=25
  for(let j=0;j<28;j++){const r=(low+high)/2;if(tideHeight(tideIsland.x+Math.cos(a)*r,tideIsland.z+Math.sin(a)*r)>.06)low=r;else high=r}
  let r=(low+high)/2-rand()*.5,x=tideIsland.x+Math.cos(a)*r,z=tideIsland.z+Math.sin(a)*r
  // Entire mesh footprint must stay above boat water, not just its anchor.
  for(let j=0;j<40&&Math.min(...footprint(x,z,reach))<-.72;j++){r-=.1;x=tideIsland.x+Math.cos(a)*r;z=tideIsland.z+Math.sin(a)*r}
  if(Math.min(...footprint(x,z,reach))<-.72||!clear(x,z,reach))continue
  if(shore.some(p=>Math.hypot(x-p.x,z-p.z)<(reach+kits[p.kit].half*p.scale)*.63))continue
  const y=tideHeight(x,z)-kits[kit].height*scale*(.86+rand()*.16)
  shore.push({kit,x,z,y,scale,yaw:-a+(rand()-.5)*1.8,role:'cliff'})
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
