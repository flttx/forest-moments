import {furnitureAt} from './furniture'
import {isSpecies,type SpeciesId} from './fishSpecies'
import {smoothRange} from '../world/worldConfig'
export const cabin={x:-15,z:-28,halfX:3.4,halfZ:2.8,doorZ:-24.5}
export const camp={x:20,z:23}
// foot: body-band extent of each reef above its own sand, in its turned frame (u0,u1,w0,w1), measured by scripts/audit_collisions.mjs.
export const reefs=[{x:36,z:-17,yaw:.5,scale:1,foot:[-.64,.89,-1.47,1.19]},{x:31,z:25,yaw:2.4,scale:1.2,foot:[-2.4,1.95,-1.8,1.43]},{x:-31,z:27,yaw:1.2,scale:1,foot:[-2,1.59,-1.5,1.17]},{x:-39,z:-7,yaw:2.8,scale:1.2,foot:[-1.34,1.32,-1.76,1.8]}] as const
export const bridge={x:-14,z:-18+2*Math.sin(-1.4),halfX:1.05,halfZ:3}
// Clear of the entrance wall so the camera arm fits behind the raccoon, like the workshop spawn.
export const bedroomSpawn={x:0,z:1.1}
export const bedSpot={x:-1.0,z:-.5}
export const tankSpot={x:2,z:-.3}
export const expansionStorageKey='forest-moments:home:v1'
export type KeptFish={id:string;sizeCm:number;at:string;species?:SpeciesId}
export type HomeBook={version:1;fish:KeptFish[];usedCatchIds:string[];nights:number;fireLit:boolean}
export const emptyHome=():HomeBook=>({version:1,fish:[],usedCatchIds:[],nights:0,fireLit:false})
export function decodeHome(raw:string|null):HomeBook{
 try{const b=JSON.parse(raw??'null');if(b?.version!==1||!Array.isArray(b.fish)||b.fish.length>5||!Array.isArray(b.usedCatchIds)||!Number.isSafeInteger(b.nights)||b.nights<0||typeof b.fireLit!=='boolean')return emptyHome();
 if(b.fish.some((f:KeptFish)=>!f||typeof f.id!=='string'||!Number.isFinite(f.sizeCm)||f.sizeCm<18||f.sizeCm>36||typeof f.at!=='string'||!Number.isFinite(Date.parse(f.at))||(f.species!==undefined&&!isSpecies(f.species)))||b.usedCatchIds.some((id:unknown)=>typeof id!=='string'))return emptyHome();
 if(new Set(b.fish.map((f:KeptFish)=>f.id)).size!==b.fish.length)return emptyHome();
 return{version:1,fish:b.fish,usedCatchIds:[...new Set<string>([...b.usedCatchIds,...b.fish.map((f:KeptFish)=>f.id)])],nights:b.nights,fireLit:b.fireLit}
 }catch{return emptyHome()}
}
export const catchId=(f:{at:string;sizeCm:number})=>`${f.at}:${f.sizeCm}`
/** What became of the newest catch: swimming in the tank, let go at the pond, or not decided yet. */
export function latestCatchChoice(s:{fishBook:{recent:{at:string;sizeCm:number}[]};homeBook:HomeBook}){
 const f=s.fishBook.recent[0];if(!f)return null
 const id=catchId(f);return s.homeBook.fish.some(x=>x.id===id)?'kept':s.homeBook.usedCatchIds.includes(id)?'released':null
}
export function addCatch(home:HomeBook,fish:{at:string;sizeCm:number;species?:SpeciesId}){
 const id=catchId(fish);if(home.fish.length>=5||home.usedCatchIds.includes(id))return home
 return{...home,fish:[...home.fish,{...fish,id}],usedCatchIds:[...home.usedCatchIds,id]}
}
export const seats=[
 {id:'coast',name:'落日海湾',x:-29,z:-10,yaw:Math.PI/2},
 {id:'reef',name:'礁石观赏点',x:29,z:-12,yaw:-Math.PI/2},
 {id:'camp-west',name:'篝火西侧',x:17.7,z:23,yaw:-Math.PI/2},
 {id:'camp-south',name:'篝火南侧',x:20,z:25.3,yaw:0},
 {id:'camp-east',name:'篝火东侧',x:22.3,z:23,yaw:Math.PI/2},
 // Facing down into the gorge at the falls, from the levelled pad on the south-west rim.
 {id:'falls',name:'瀑布观景台',x:-32.75,z:-12.75,yaw:-.773},
 // One bench on each neighbour island (archipelago stage 4), on level ground clear of trees and trail, facing its sight:
 // the Mist Isle old pine 8.5 m off, the Autumn maple clearing 6 m off (outside the robins' 3.5 m flight distance), the tide pools.
 {id:'mistBench',name:'古松长椅',x:99.04,z:-5.12,yaw:-.959},
 {id:'autumnBench',name:'林窗长椅',x:104,z:47,yaw:-Math.PI/2},
 {id:'tideBench',name:'潮池长椅',x:104.49,z:107.75,yaw:.698},
] as const
export type SeatId=typeof seats[number]['id']|'stool'
export type SeatSession={id:SeatId;phase:'down'|'idle'|'up';elapsed:number;returnPosition:{x:number;z:number}}
// Seat top .35 m, thigh underside .20 m; low hip/coat outline gets local soft
// contact in benchSeatContact rather than raising the thighs off the seat.
// The hips settle .296 m behind the actor root.
export const benchSeatForward=.45
export const benchSeatLift=.15
const benchApproachForward=.254*7/3
export function seatOrigin(s:{x:number;z:number;yaw:number}){return{x:s.x-Math.sin(s.yaw)*benchApproachForward,z:s.z-Math.cos(s.yaw)*benchApproachForward}}
function seatBlend(s:SeatSession){return s.id==='stool'?0:s.phase==='idle'?1:s.phase==='down'?smoothRange(s.elapsed,.35,1.8):1-smoothRange(s.elapsed,.25,1.8)}
export function seatLift(s:SeatSession){return benchSeatLift*seatBlend(s)}
export function seatSlide(s:SeatSession){return (benchApproachForward-benchSeatForward)*seatBlend(s)}
export function creekZ(x:number){return -18+2*Math.sin(x*.1)}
/** The creek idles down from the bridge to a rock lip, falls into a plunge pool, then riffles across a pebble cove into the sea. */
export const creekFalls={lipX:-26.6,footX:-27.2,top:4.75,pool:{x:-29.6,z:-18+2*Math.sin(-2.96),radius:2.6,water:.7}} as const
export function creekWaterY(x:number){
 const {lipX,footX,top,pool}=creekFalls
 if(x>=lipX)return top+(5.55-top)*smoothRange(x,lipX,-10)
 if(x>=footX)return pool.water+(top-pool.water)*smoothRange(x,footX,lipX)
 return -.85+(pool.water+.85)*smoothRange(x,-39,-31.6)
}
/** Before 2026-11-02 the creek slid in one even slope down a slot to the sea; the adopted coast layout still derives from it. */
export function originalCreekWaterY(x:number){return -.85+6.4*smoothRange(x,-40,-10)}
/** Ground the falls rework re-shaped (upper creek, lip, pool, gorge, mouth); baseline checks of older layouts skip it. */
export function inCreekRework(x:number,z:number){return x>-47&&x<-9.5&&Math.abs(z-creekZ(Math.max(-44,Math.min(-10,x))))<10}
/** A footpath from the west beach round the headland foot, down the gorge's south bank to the pool edge: [x,z,ground y]. */
export const fallsTrail=[[-41.8,-9.8,.85],[-38.6,-10.2,.95],[-37.4,-12.2,.9],[-36.3,-14,.6],[-34.6,-15.4,.45],[-32.4,-15.9,.75],[-31.3,-15.7,.95]] as const
/** Distance to the trail's centre line and the ground height there. */
export function fallsTrailAt(x:number,z:number){
 let best={d:Infinity,y:0}
 for(let i=0;i<fallsTrail.length-1;i++){
  const [ax,az,ay]=fallsTrail[i],[bx,bz,by]=fallsTrail[i+1],dx=bx-ax,dz=bz-az,t=Math.max(0,Math.min(1,((x-ax)*dx+(z-az)*dz)/(dx*dx+dz*dz)))
  const d=Math.hypot(x-ax-t*dx,z-az-t*dz);if(d<best.d)best={d,y:ay+(by-ay)*t}
 }
 return best
}
/** The rim lookout over the falls: a small levelled pad for the bench. */
const fallsSeat=seats[5]
export const fallsLookout={x:fallsSeat.x,z:fallsSeat.z,y:4.5}
/** A ford of flat stones across the riffle, from the footpath to the gorge's north pebble bank. */
export const creekFord={a:[-34.35,-15.9],b:[-34.55,-19.1],half:.38} as const
export function onCreekFord(x:number,z:number){
 const [ax,az]=creekFord.a,[bx,bz]=creekFord.b,dx=bx-ax,dz=bz-az,t=Math.max(0,Math.min(1,((x-ax)*dx+(z-az)*dz)/(dx*dx+dz*dz)))
 return Math.hypot(x-ax-t*dx,z-az-t*dz)<creekFord.half
}
/** The stones stand a hand above the running water; off the channel the ford is the bank itself. */
export const fordHeight=(x:number,ground:number)=>Math.max(ground,creekWaterY(x)+.12)
/** Deepest water the raccoon wades into at the pool's edge. */
export const poolWadeDepth=.3
export function creekPoolDistance(x:number,z:number){return Math.hypot(x-creekFalls.pool.x,z-creekFalls.pool.z)}
export function creekDistance(x:number,z:number){return Math.hypot(Math.max(-44-x,0,x+10),z-creekZ(Math.max(-44,Math.min(-10,x))))}
export function onBridge(x:number,z:number,inset=0){return Math.abs(x-bridge.x)<bridge.halfX-inset&&Math.abs(z-bridge.z)<bridge.halfZ}
// Centre walking surface sampled from the normalized AHOLO mesh (Blender ray casts).
const bridgeDeck=[.6354,.6339,.631,.6231,.612,.5902,.5728,.5486,.5249,.4967,.4514,.4064,.3623,.3154,.2703,.225]
export function bridgeHeight(z:number){const t=Math.min(15,Math.abs(z-bridge.z)/.2),i=Math.min(14,Math.floor(t));return 6+bridgeDeck[i]+(bridgeDeck[i+1]-bridgeDeck[i])*(t-i)}
export function canStandInBedroom(x:number,z:number){
 if(!Number.isFinite(x)||!Number.isFinite(z)||Math.abs(x)>3.65||Math.abs(z)>2.65)return false
 if(furnitureAt('bedroom',x,z,.28))return false
 return ![{x:-2.2,z:-.65,hx:.85,hz:1.45},{x:2.3,z:-1.3,hx:.72,hz:.31}].some(b=>Math.hypot(Math.max(Math.abs(x-b.x)-b.hx,0),Math.max(Math.abs(z-b.z)-b.hz,0))<.28)
}
export function moveInBedroom(p:{x:number;z:number},dx:number,dz:number){let{x,z}=p;if(![x,z,dx,dz].every(Number.isFinite))return p;const n=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.1));for(let i=0;i<n;i++){if(canStandInBedroom(x+dx/n,z))x+=dx/n;if(canStandInBedroom(x,z+dz/n))z+=dz/n}return{x,z}}
