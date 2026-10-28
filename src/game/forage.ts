import {vegetationPositions} from '../world/vegetationLayout'
import {pathEdgeDistance,terrainHeight} from '../world/terrain'
import {islandShape,seaLevel} from '../world/worldConfig'
import {canStandAt} from './movement'
import {rainMushrooms,weatherFor} from './weather'

/**
 * Gathering (docs/GAMEPLAY_EXPANSION_PLAN.md §2.4): mushrooms under the trees, berries by the bushes, shells on the
 * sand and cones under the pines. A fresh handful appears each time the raccoon wakes; nothing rots or runs out for
 * good. Pure: spots are fixed by the island, the day's picks by a seed.
 */
export const forageKinds=['mushroom','berry','shell','pinecone'] as const
export type ForageKind=typeof forageKinds[number]
export const forageStorageKey='forest-moments:forage:v1'
/** How many of each appear per day. */
export const perDay:Record<ForageKind,number>={mushroom:5,berry:4,shell:5,pinecone:4}
export const pickRadius=.9
export const forageSeconds=1.1
export interface ForageSpot{id:string;kind:ForageKind;x:number;z:number}
export interface ForageBook{version:1;day:number;taken:string[]}

const round=(n:number)=>Math.round(n*100)/100
/** Somewhere the raccoon can stand, off the paths and not on a slope. */
function placeable(x:number,z:number){
 if(!canStandAt(x,z)||pathEdgeDistance(x,z)<.6)return false
 return Math.hypot(terrainHeight(x+.3,z)-terrainHeight(x-.3,z),terrainHeight(x,z+.3)-terrainHeight(x,z-.3))/.6<.45
}
/** Roughly where the ground is drawn as sand (IslandTerrain): the east beach, the south crescent and the low outer shore. */
export function onSand(x:number,z:number){
 const r=Math.hypot(x,z),h=terrainHeight(x,z)
 return (x>30.5&&Math.abs(z)<11)||(z>21&&r>13.5&&h<2.6)||(r>islandShape.plateauRadius-.5&&h<1.8)
}
/** First standable point around a plant, trying distances outward and eight bearings from its own yaw. */
function beside(p:{x:number;z:number;yaw:number;scale:number},from:number,to:number){
 for(let d=from;d<=to+1e-6;d+=.2)for(let k=0;k<8;k++){
  const a=p.yaw+k*Math.PI/4,x=round(p.x+Math.cos(a)*d*p.scale),z=round(p.z+Math.sin(a)*d*p.scale)
  if(placeable(x,z)&&!onSand(x,z))return{x,z}
 }
 return null
}

/** Every place something can grow or wash up, fixed for the island. */
export const forageSpots:ForageSpot[]=(()=>{
 const spots:ForageSpot[]=[]
 const add=(kind:ForageKind,at:{x:number;z:number}|null)=>{if(at&&spots.every(s=>Math.hypot(s.x-at.x,s.z-at.z)>1.2))spots.push({id:`${kind}-${spots.filter(s=>s.kind===kind).length}`,kind,...at})}
 for(const p of vegetationPositions){
  if(p.kit==='normal-pine-b'||p.kit==='tall-pine-a'){add('pinecone',beside(p,1.6,2.4));add('mushroom',beside({...p,yaw:p.yaw+Math.PI/8},2.2,3))}
  else if(p.kit==='round-tree-a')add('mushroom',beside(p,2,2.8))
  else if(p.kit==='bush-a')add('berry',beside(p,1,1.6))
 }
 // Shells: a ring of the sandy shore just above the water.
 for(let i=0;i<72;i++){
  const a=i/72*Math.PI*2
  for(let r=40;r>=30;r-=.5){const x=round(Math.cos(a)*r),z=round(Math.sin(a)*r),h=terrainHeight(x,z);if(h>seaLevel+.2&&h<seaLevel+.9&&placeable(x,z)){add('shell',{x,z});break}}
 }
 return spots
})()

/** A small deterministic generator, so a day always offers the same things after a reload. */
function seeded(seed:number){let n=(seed*2654435761)%4294967296||1;return()=>((n=(n*1664525+1013904223)%4294967296)/4294967296)}
/** The spots offering something on a given day (day = nights slept). */
export function spotsForDay(day:number,spots:readonly ForageSpot[]=forageSpots):ForageSpot[]{
 const random=seeded(day+17),out:ForageSpot[]=[],rain=weatherFor(day)==='rain'
 for(const kind of forageKinds){
  const pool=spots.filter(s=>s.kind===kind),count=kind==='mushroom'&&rain?rainMushrooms:perDay[kind]
  for(let i=0;i<count&&pool.length;i++)out.push(pool.splice(Math.floor(random()*pool.length),1)[0])
 }
 return out
}
/** Still lying there today. */
export const availableSpots=(book:ForageBook,day:number)=>spotsForDay(day).filter(s=>book.day!==day||!book.taken.includes(s.id))
export function spotNear(p:{x:number;z:number},book:ForageBook,day:number):ForageSpot|null{
 let best:ForageSpot|null=null,distance=pickRadius
 for(const s of availableSpots(book,day)){const d=Math.hypot(p.x-s.x,p.z-s.z);if(d<distance){best=s;distance=d}}
 return best
}
/** The book after picking a spot; a new day starts a fresh list. */
export function takeSpot(book:ForageBook,day:number,id:string):ForageBook{
 const taken=book.day===day?book.taken:[]
 return taken.includes(id)?book:{version:1,day,taken:[...taken,id]}
}
export const emptyForage=(day=0):ForageBook=>({version:1,day,taken:[]})
export function decodeForage(raw:string|null):ForageBook|null{
 try{
  const b=JSON.parse(raw??'null')
  if(b?.version!==1||!Number.isSafeInteger(b.day)||b.day<0||!Array.isArray(b.taken)||b.taken.some((id:unknown)=>typeof id!=='string'))return null
  return{version:1,day:b.day,taken:[...new Set<string>(b.taken)]}
 }catch{return null}
}
