import type {CoastKit,CoastPiece} from './coastalLayout'

export interface RimRockSpec{
 cx:number;cz:number;seed:number
 height:(x:number,z:number)=>number
 /** Ground height every footprint sample must keep: protects rowable water. */
 minFootprint:number
 /** Height where the rock line sits; the shore crossing is searched between inner and outer radii. */
 level:number;inner:number;outer:number
 /** [centre angle, count] — uneven groups with gaps, as on the reference shores. */
 clusters:readonly (readonly [number,number])[]
 open:(x:number,z:number,reach:number)=>boolean
 existing:CoastPiece[]
 kits:Record<CoastKit,{height:number;half:number}>
}

/** Clustered anchor/companion rocks along a shore, falling back to smaller stones on narrow rims. */
export function buildRimRocks(s:RimRockSpec){
 let seed=s.seed
 const rand=()=>{seed=seed*16807%2147483647;return seed/2147483647}
 const out:CoastPiece[]=[]
 const footprint=(x:number,z:number,r:number)=>Math.min(...Array.from({length:24},(_,i)=>s.height(x+Math.cos(i*Math.PI/12)*r,z+Math.sin(i*Math.PI/12)*r)))
 const sites:number[]=[]
 for(const [centre,count] of s.clusters){let a=centre-count*.045;for(let i=0;i<count;i++){a+=.035+rand()*.09;sites.push(a)}}
 for(const a of sites){
  const anchor=rand()<.3,first:CoastKit=rand()<.3?'Rock_Slab':'Rock_Boulder',jitter=rand(),sink=.84+rand()*.16
  const point=(r:number)=>({x:s.cx+Math.cos(a)*r,z:s.cz+Math.sin(a)*r})
  let lo=s.inner,hi=s.outer
  if(s.height(point(lo).x,point(lo).z)<s.level)continue
  for(let j=0;j<24;j++){const r=(lo+hi)/2,p=point(r);if(s.height(p.x,p.z)>s.level)lo=r;else hi=r}
  for(const [kit,scale] of [[first,anchor?1.1+jitter*.45:.75+jitter*.35],['Rock_Boulder',.75],['Rock_Cobbles',.8]] as [CoastKit,number][]){
   const reach=s.kits[kit].half*scale
   let r=(lo+hi)/2-jitter*.4,p=point(r)
   for(let j=0;j<30&&footprint(p.x,p.z,reach)<s.minFootprint;j++){r-=.1;p=point(r)}
   if(footprint(p.x,p.z,reach)<s.minFootprint||!s.open(p.x,p.z,reach))continue
   if([...s.existing,...out].some(v=>Math.hypot(p.x-v.x,p.z-v.z)<(reach+s.kits[v.kit].half*v.scale)*.52))continue
   // On gentle shores bury below the lowest footprint sample rather than the centre, so more of the stone shows.
   const base=footprint(p.x,p.z,reach*.8)
   out.push({kit,...p,y:Math.max(s.height(p.x,p.z)-s.kits[kit].height*scale*sink,base-s.kits[kit].height*scale*(sink-.42)),scale,yaw:jitter*Math.PI*2,role:'cliff'})
   break
  }
 }
 return out
}
