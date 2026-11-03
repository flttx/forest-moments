import {coastKits,type CoastKit} from './coastalLayout'
import {landformHeight,seaLevel,seaRangeRadius} from './worldConfig'

/**
 * One archipelago instead of five stamped islands: a shared shallow shelf under the sea joins the land masses, reef
 * stacks rise along its rim between the islands, and lit buoys mark the channels between the four berths.
 * The ellipses only shape the sea tint and the reef rim; land, collision and the boat still use the real terrain.
 */
export const shelfMasses=[[-2,0,42,40],[-60,4,28,30],[107,-10,19.5,17.5],[112,47,20.5,16.5],[100,101,17,13]] as const
const shelfBlend=14
/** Smooth-union distance (m) outside the land masses; it dips between near neighbours, so the shelf bridges them. */
export function shelfDistance(x:number,z:number){
 let sum=0
 for(const [cx,cz,rx,rz] of shelfMasses)sum+=Math.exp(-(Math.hypot((x-cx)/rx,(z-cz)/rz)-1)*Math.min(rx,rz)/shelfBlend)
 return -shelfBlend*Math.log(sum)
}
export const shelfGLSL=/* glsl */ `
float shelfDistance(vec2 p){float s=0.0;${shelfMasses.map(([cx,cz,rx,rz])=>`s+=exp(-(length((p-vec2(${cx.toFixed(1)},${cz.toFixed(1)}))/vec2(${rx.toFixed(1)},${rz.toFixed(1)}))-1.0)*${Math.min(rx,rz).toFixed(1)}/${shelfBlend.toFixed(1)});`).join('')}return -${shelfBlend.toFixed(1)}*log(s);}
`

/** Where the boat leaves each berth, and the channels rowed between them; reefs keep out of these. */
export const channelMouths={main:{x:46,z:2},mist:{x:77,z:-12},autumn:{x:84,z:49},tide:{x:76,z:99}} as const
const m=channelMouths
export const channels=[[m.main,m.mist],[m.main,m.autumn],[m.mist,m.autumn],[m.autumn,m.tide],[m.main,m.tide]] as const
export function channelDistance(x:number,z:number){
 let d=Infinity
 for(const [a,b] of channels){const dx=b.x-a.x,dz=b.z-a.z,t=Math.max(0,Math.min(1,((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz)));d=Math.min(d,Math.hypot(x-a.x-dx*t,z-a.z-dz*t))}
 return d
}

export interface ReefStack{kit:CoastKit;x:number;y:number;z:number;yaw:number;scale:number}
export interface ReefCluster{x:number;z:number;r:number}
const channelClearance=9
/**
 * Reef clusters on the shelf rim east of the main island: a tall sea stack or broad slab with a few lower rocks round it,
 * standing on the open seabed. Few and large, so they read as reefs from the overview rather than scattered debris.
 */
export const {reefStacks,reefClusters}=(()=>{
 let seed=20261103
 const rand=()=>{seed=seed*16807%2147483647;return seed/2147483647}
 const stacks:ReefStack[]=[],clusters:ReefCluster[]=[]
 const deep=(x:number,z:number,r:number)=>Array.from({length:12},(_,i)=>landformHeight(x+Math.cos(i*Math.PI/6)*r,z+Math.sin(i*Math.PI/6)*r)).every(h=>h<-2)
 for(let x=40;x<=136;x+=4)for(let z=-46;z<=128;z+=4){
  const px=x+(rand()-.5)*3,pz=z+(rand()-.5)*3,rim=shelfDistance(px,pz)
  // keep the rowable ring inside the outer sea limit open as well as the channels
  if(rim<8||rim>16||rand()>.35||Math.hypot(px,pz)>seaRangeRadius(Math.atan2(pz,px))-14)continue
  if(clusters.some(c=>Math.hypot(c.x-px,c.z-pz)<c.r+16))continue
  const tall=rand()<.6,anchor:CoastKit=tall?'Rock_Tall':'Rock_Slab',scale=tall?1.7+rand()*.7:1.9+rand()*.6
  const cluster:ReefStack[]=[{kit:anchor,x:px,z:pz,y:-2.5,yaw:rand()*Math.PI*2,scale}]
  for(let i=0,n=2+Math.floor(rand()*3);i<n;i++){
   // companions stand on the seabed and just break the surface (0.15–0.75 m), sized from that height
   const a=i/n*Math.PI*2+rand()*.9,d=coastKits[anchor].half*scale+.8+rand()*1.8,kit:CoastKit=rand()<.55?'Rock_Boulder':'Rock_Slab',top=seaLevel+.15+rand()*.6
   cluster.push({kit,x:px+Math.cos(a)*d,z:pz+Math.sin(a)*d,y:-2.5,yaw:rand()*Math.PI*2,scale:(top+2.5)/coastKits[kit].height})
  }
  const r=Math.max(...cluster.map(c=>Math.hypot(c.x-px,c.z-pz)+coastKits[c.kit].half*c.scale))
  if(channelDistance(px,pz)<channelClearance+r||!cluster.every(c=>deep(c.x,c.z,coastKits[c.kit].half*c.scale+.6)))continue
  stacks.push(...cluster);clusters.push({x:px,z:pz,r})
 }
 return{reefStacks:stacks,reefClusters:clusters}
})()
/** Hull test: a stack blocks the boat across its footprint plus a small margin. */
export function reefBlocks(x:number,z:number){return reefClusters.some(c=>Math.hypot(x-c.x,z-c.z)<c.r+.2)&&reefStacks.some(s=>Math.hypot(x-s.x,z-s.z)<coastKits[s.kit].half*s.scale*.9+.15)}
/** Distance (m) outside the nearest reef cluster, for the white water and pale halo the sea draws round each reef. */
export const reefGLSL=/* glsl */ `
float reefDistance(vec2 p){float d=1000.0;${reefClusters.map(c=>`d=min(d,length(p-vec2(${c.x.toFixed(2)},${c.z.toFixed(2)}))-${c.r.toFixed(2)});`).join('')}return d;}
`

export interface Buoy{x:number;z:number;phase:number}
/**
 * Two buoys a channel near a third of the way in from each mouth, marking alternate edges of a 14 m lane. Channels from
 * one berth fan out, so a buoy slides along (or swaps sides) until it is clear of every other channel too.
 */
export const buoys:Buoy[]=channels.flatMap(([a,b],i)=>{
 const dx=b.x-a.x,dz=b.z-a.z,len=Math.hypot(dx,dz),nx=-dz/len,nz=dx/len
 return [.3,.7].map((t0,j)=>{
  const side=(i+j)%2?1:-1
  for(const t of [t0,t0+.06,t0-.06,t0+.12,t0-.12])for(const k of [side,-side]){
   const x=a.x+dx*t+nx*7*k,z=a.z+dz*t+nz*7*k
   if(channelDistance(x,z)>6.5)return{x,z,phase:i*1.7+j*.9}
  }
  throw Error(`no clear buoy spot on channel ${i}`)
 })
})
export const buoyRadius=.45
export function buoyBlocks(x:number,z:number){return buoys.some(b=>Math.hypot(x-b.x,z-b.z)<buoyRadius)}
