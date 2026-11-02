import {tideBerth,tideHeight,tideIsland,tideObservation,tidePathDistance} from './tideIsland'
import {tideShorePieces,tidePoolPieces,coastKits} from './coastalLayout'
import {tidePlants} from './vegetationLayout'

export interface TideDetail{x:number;z:number;scale:number;yaw:number}
export interface TideDriftwood extends TideDetail{kit:'Driftwood_Long'|'Driftwood_Short'}
const rocks=[...tideShorePieces,...tidePoolPieces]
const slope=(x:number,z:number)=>Math.hypot(tideHeight(x+.3,z)-tideHeight(x-.3,z),tideHeight(x,z+.3)-tideHeight(x,z-.3))/.6
const hash=(a:number,b:number)=>{const n=Math.sin(a*12.9898+b*78.233)*43758.5453;return n-Math.floor(n)}
const free=(x:number,z:number,reach:number)=>tidePathDistance(x,z)>reach+.9
 &&Math.hypot(x-tideBerth.landing.x,z-tideBerth.landing.z)>reach+5
 &&Math.hypot(x-tideObservation.x,z-tideObservation.z)>reach+2.2
 &&rocks.every(p=>Math.hypot(x-p.x,z-p.z)>coastKits[p.kit].half*p.scale+reach+.15)
 &&tidePlants.every(p=>Math.hypot(x-p.x,z-p.z)>reach+1.2)

/** Weathered logs stranded on the dry rim, lying along the shore tangent. */
export const tideDriftwood:TideDriftwood[]=(()=>{
 const out:TideDriftwood[]=[]
 for(const [angle,kit,scale] of [[-2.55,'Driftwood_Long',.9],[-1.45,'Driftwood_Short',1],[.2,'Driftwood_Long',.8],[1.25,'Driftwood_Short',1.1],[2.2,'Driftwood_Long',1],[-.85,'Driftwood_Short',.9],[2.85,'Driftwood_Short',1],[-.2,'Driftwood_Short',.85],[1.75,'Driftwood_Long',.8]] as const){
  const reach=coastKits[kit].half*scale
  for(let k=0;k<30;k++){
   const a=angle+(k%2?1:-1)*Math.ceil(k/2)*.025
   let lo=.5,hi=1.2
   for(let j=0;j<24;j++){const m=(lo+hi)/2;if(tideHeight(tideIsland.x+Math.cos(a)*tideIsland.rx*m,tideIsland.z+Math.sin(a)*tideIsland.rz*m)>.2)lo=m;else hi=m}
   // Stranded just above the rock line; step inland when the rim is already occupied by stones.
   const spot=[.045,.1,.16].map(d=>({x:tideIsland.x+Math.cos(a)*tideIsland.rx*(lo-d),z:tideIsland.z+Math.sin(a)*tideIsland.rz*(lo-d)}))
    .find(({x,z})=>free(x,z,reach)&&slope(x,z)<=.45&&tideHeight(x,z)>=.2&&out.every(p=>Math.hypot(x-p.x,z-p.z)>=reach+3))
   if(!spot)continue
   // Long axis follows the shoreline, not the radius.
   out.push({kit,...spot,scale,yaw:-(a+Math.PI/2)+(hash(k,angle)-.5)*.4});break
  }
 }
 return out
})()
