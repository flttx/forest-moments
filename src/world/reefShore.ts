import type {CoastKit,CoastPiece} from './coastalLayout'

export interface ReefShoreSpec{
 cx:number;cz:number;seed:number
 height:(x:number,z:number)=>number
 /** Waterline height, and the shallowest ground the boat may use: upper-ledge stones keep a hull's width above it. */
 sea:number;navigable:number
 /** The waterline crossing is searched between these radii from the island centre. */
 inner:number;outer:number
 /** Ray angles left open: the sandy coves. Landings and paths are kept clear by open(). */
 gap:(angle:number)=>boolean
 open:(x:number,z:number,reach:number)=>boolean
 existing:CoastPiece[]
 kits:Record<CoastKit,{height:number;half:number}>
}

/** Hull clearance beyond a land stone's footprint: the canoe's half-beam plus a little. */
const hull=.5

/**
 * A continuous, layered reef along the waterline (archipelago stage 7): overlapping large stones standing in the shallows,
 * with a broken upper ledge behind them. The earlier shore and rim rocks sit higher up the slope and read as pebbles
 * from afar; this band carries the coastline. The waterline stones reach into rowable water, so the boat treats them as
 * solids (reefShoreSolids); the upper ledge stays a hull's width clear of it.
 */
export function buildReefShore(s:ReefShoreSpec){
 let seed=s.seed
 const rand=()=>{seed=seed*16807%2147483647;return seed/2147483647}
 const out:CoastPiece[]=[]
 const point=(a:number,r:number)=>({x:s.cx+Math.cos(a)*r,z:s.cz+Math.sin(a)*r})
 const lowest=(x:number,z:number,r:number)=>Math.min(...Array.from({length:20},(_,i)=>s.height(x+Math.cos(i*Math.PI/10)*r,z+Math.sin(i*Math.PI/10)*r)))
 /** Radius along a ray where the ground falls through level, or null where the ray starts below it. */
 const crossing=(a:number,level:number)=>{
  let lo=s.inner,hi=s.outer
  if(s.height(point(a,lo).x,point(a,lo).z)<level)return null
  for(let i=0;i<24;i++){const r=(lo+hi)/2,p=point(a,r);if(s.height(p.x,p.z)>level)lo=r;else hi=r}
  return(lo+hi)/2
 }
 const slope=(x:number,z:number)=>Math.hypot(s.height(x+.3,z)-s.height(x-.3,z),s.height(x,z+.3)-s.height(x,z-.3))/.6
 const near=(p:{x:number;z:number},reach:number,list:CoastPiece[],k:number)=>list.some(v=>Math.hypot(p.x-v.x,p.z-v.z)<(reach+s.kits[v.kit].half*v.scale)*k)
 /** Tries the stone, then smaller copies where a path, landing or neighbour leaves no room for it. */
 const place=(a:number,level:number,kit:CoastKit,size:number,seaward:number,sink:number,wet:boolean)=>{
  const r0=crossing(a,level)
  if(r0===null)return false
  // Kit modules are authored for 0.7–1.7 scale.
  for(const scale of [...new Set([size,size*.72,size*.52].map(v=>Math.min(1.7,Math.max(.7,v))))]){
   const reach=s.kits[kit].half*scale
   let r=r0+seaward*reach,p=point(a,r)
   if(!wet)for(let j=0;j<40&&lowest(p.x,p.z,reach+hull)<=s.navigable;j++){r-=.1;p=point(a,r)}
   if(!wet&&lowest(p.x,p.z,reach+hull)<=s.navigable||!s.open(p.x,p.z,reach))continue
   // The upper ledge keeps to the steep face: on the walkable shore it would eat the islands' standing room.
   if(!wet&&slope(p.x,p.z)<.55)continue
   // Reef stones may merge into the older shore rocks and each other as one mass, but not stack on the same spot.
   if(near(p,reach,s.existing,.28)||near(p,reach,out,.42))continue
   // Waterline stones stand with their lower part in the sea. On the steep upper slope a centre-buried stone would hang
   // above the ground below it, so sink it until its downhill foot meets the lowest ground.
   const h=s.kits[kit].height*scale
   const y=wet?Math.min(s.height(p.x,p.z)-h*sink,s.sea-h*.4):Math.min(s.height(p.x,p.z)-h*sink,lowest(p.x,p.z,reach*.85)-h*.15)
   out.push({kit,...p,y,scale,yaw:rand()*Math.PI*2,role:'cliff'})
   return true
  }
  return false
 }
 let a=-Math.PI
 while(a<Math.PI){
  const pick=rand(),kit:CoastKit=pick<.5?'Rock_Slab':pick<.88?'Rock_Boulder':'Rock_Tall'
  const scale=kit==='Rock_Tall'?1+rand()*.4:1.25+rand()*.75,r=crossing(a,s.sea)??s.inner
  const step=s.kits[kit].half*scale*1.05/Math.max(r,1)
  if(!s.gap(a)){
   // Lower tier: centred a little seaward of the waterline, most of it in the sea, so it covers little walkable beach.
   place(a,s.sea,kit,scale,.25,kit==='Rock_Tall'?.62:.5+rand()*.12,true)
   // Upper ledge behind it on most sites, broken so the slope still shows between stones.
   if(rand()<.6){
    const upper:CoastKit=rand()<.65?'Rock_Slab':'Rock_Boulder'
    place(a+(rand()-.5)*step,s.sea+.6+rand()*.7,upper,.95+rand()*.6,0,.62+rand()*.12,false)
   }
  }
  a+=step*(.85+rand()*.3)
 }
 return out
}
