import {vegetationPositions} from '../world/vegetationLayout'
import {pathEdgeDistance,terrainHeight} from '../world/terrain'
import {plateauRadiusAt,seaLevel} from '../world/worldConfig'
import {canStandAt} from './movement'
import {mistPathDistance,mistRadius} from '../world/mistIsland'
import {autumnPathDistance,autumnRadius} from '../world/autumnIsland'
import {tideHeight,tidePathDistance,tideRadius,tideIsland,inTidePool} from '../world/tideIsland'
import {rainMushrooms,weatherFor} from './weather'

/**
 * Gathering (docs/GAMEPLAY_EXPANSION_PLAN.md §2.4): mushrooms under the trees, berries by the bushes, shells on the
 * sand and cones under the pines. A fresh handful appears each time the raccoon wakes; nothing rots or runs out for
 * good. Pure: spots are fixed by the island, the day's picks by a seed.
 */
export const forageKinds=['mushroom','berry','shell','pinecone','mistcap','mapleLeaf','birchBark','seaGlass'] as const
export type ForageKind=typeof forageKinds[number]
export const forageStorageKey='forest-moments:forage:v1'
/** The main island and each neighbour keep their own daily handful, so the islands never thin out the home pickings. */
export const forageRegions=['main','mist','autumn','tide'] as const
export type ForageRegion=typeof forageRegions[number]
/** How many of each appear per day, per region; the main island's counts and their order are the original ones. */
export const regionQuota:Record<ForageRegion,Partial<Record<ForageKind,number>>>={
 main:{mushroom:5,berry:4,shell:5,pinecone:4},
 mist:{mistcap:4,pinecone:3},
 autumn:{mapleLeaf:3,birchBark:3},
 tide:{shell:5,seaGlass:2},
}
/** Across all regions, how many of each appear on a dry day. */
export const perDay=Object.fromEntries(forageKinds.map(k=>[k,forageRegions.reduce((n,r)=>n+(regionQuota[r][k]??0),0)])) as Record<ForageKind,number>
export const pickRadius=.9
export const forageSeconds=1.1
export interface ForageSpot{id:string;kind:ForageKind;region:ForageRegion;x:number;z:number}
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
 return (x>30.5&&Math.abs(z)<11)||(z>21&&r>13.5&&h<2.6)||(r>plateauRadiusAt(Math.atan2(z,x))-.5&&h<1.8)
}
/** First standable point around a plant, trying distances outward and eight bearings from its own yaw. */
function beside(p:{x:number;z:number;yaw:number;scale:number},from:number,to:number){
 for(let d=from;d<=to+1e-6;d+=.2)for(let k=0;k<8;k++){
  const a=p.yaw+k*Math.PI/4,x=round(p.x+Math.cos(a)*d*p.scale),z=round(p.z+Math.sin(a)*d*p.scale)
  if(placeable(x,z)&&!onSand(x,z))return{x,z}
 }
 return null
}

/** On a neighbour island: standable, off its trail and not on a slope. */
function islandPlaceable(x:number,z:number,trail:(x:number,z:number)=>number){
 if(!canStandAt(x,z)||trail(x,z)<.8)return false
 return Math.hypot(terrainHeight(x+.3,z)-terrainHeight(x-.3,z),terrainHeight(x,z+.3)-terrainHeight(x,z-.3))/.6<.45
}
function islandBeside(p:{x:number;z:number;yaw:number;scale:number},from:number,to:number,trail:(x:number,z:number)=>number){
 for(let d=from;d<=to+1e-6;d+=.2)for(let k=0;k<8;k++){
  const a=p.yaw+k*Math.PI/4,x=round(p.x+Math.cos(a)*d*p.scale),z=round(p.z+Math.sin(a)*d*p.scale)
  if(islandPlaceable(x,z,trail))return{x,z}
 }
 return null
}

/** Every place something can grow or wash up, fixed for the islands. Main-island ids keep their original form. */
export const forageSpots:ForageSpot[]=(()=>{
 const spots:ForageSpot[]=[]
 const add=(kind:ForageKind,at:{x:number;z:number}|null,region:ForageRegion='main')=>{
  if(!at||!spots.every(s=>Math.hypot(s.x-at.x,s.z-at.z)>1.2))return
  const n=spots.filter(s=>s.kind===kind&&s.region===region).length
  spots.push({id:region==='main'?`${kind}-${n}`:`${region}-${kind}-${n}`,kind,region,...at})
 }
 for(const p of vegetationPositions){
  if(p.kit==='normal-pine-b'||p.kit==='tall-pine-a'){add('pinecone',beside(p,1.6,2.4));add('mushroom',beside({...p,yaw:p.yaw+Math.PI/8},2.2,3))}
  else if(p.kit==='round-tree-a')add('mushroom',beside(p,2,2.8))
  else if(p.kit==='bush-a')add('berry',beside(p,1,1.6))
 }
 // Shells: a ring of the sandy shore just above the water.
 for(let i=0;i<72;i++){
  const a=i/72*Math.PI*2
  for(let r=40;r>=30;r-=.5){const x=round(Math.cos(a)*r),z=round(Math.sin(a)*r),h=terrainHeight(x,z);if(h>seaLevel+.2&&h<seaLevel+.9&&onSand(x,z)&&placeable(x,z)){add('shell',{x,z});break}}
 }
 // Mist: pale caps in the needle litter under the spruces and the old pine, cones beside every other tree.
 vegetationPositions.filter(p=>mistRadius(p.x,p.z)<1&&(p.kit==='ie-spruce'||p.kit==='ie-old-pine'||p.kit==='ie-spruce-sapling')).forEach((p,i)=>{
  add('mistcap',islandBeside(p,1.4,2.6,mistPathDistance),'mist')
  if(i%2===0)add('pinecone',islandBeside({...p,yaw:p.yaw+Math.PI*.7},1.2,2.2,mistPathDistance),'mist')
 })
 // Autumn: fallen leaves under the maples' wide crowns, curls of bark at the foot of the birches.
 for(const p of vegetationPositions.filter(p=>autumnRadius(p.x,p.z)<1)){
  if(p.kit==='ie-maple')for(const turn of [0,2.1])add('mapleLeaf',islandBeside({...p,yaw:p.yaw+turn},1.8,3.4,autumnPathDistance),'autumn')
  else if(p.kit==='ie-birch')add('birchBark',islandBeside(p,1,1.8,autumnPathDistance),'autumn')
 }
 // Tide: shells washed onto the outer shelf, from just above the water to its low rim, never in the pools.
 for(let i=0;i<96;i++){
  const a=i/96*Math.PI*2
  for(let r=1.05;r>=.6;r-=.02){
   const x=round(tideIsland.x+Math.cos(a)*tideIsland.rx*r),z=round(tideIsland.z+Math.sin(a)*tideIsland.rz*r),h=tideHeight(x,z)
   // every fourth bearing along the shore offers worn sea glass instead of a shell
   if(h>seaLevel+.25&&h<seaLevel+1.6&&tideRadius(x,z)>.62&&!inTidePool(x,z,.6)&&islandPlaceable(x,z,tidePathDistance)){add(i%4===2?'seaGlass':'shell',{x,z},'tide');break}
  }
 }
 return spots
})()

/** A small deterministic generator, so a day always offers the same things after a reload. */
function seeded(seed:number){let n=(seed*2654435761)%4294967296||1;return()=>((n=(n*1664525+1013904223)%4294967296)/4294967296)}
/** The spots offering something on a given day (day = nights slept). */
export function spotsForDay(day:number,spots:readonly ForageSpot[]=forageSpots):ForageSpot[]{
 const out:ForageSpot[]=[],rain=weatherFor(day)==='rain'
 forageRegions.forEach((region,r)=>{
  // The main island draws with its original seed and order, so a day offers exactly what it always did there.
  const random=seeded(day+17+r*7919)
  for(const [kind,base] of Object.entries(regionQuota[region]) as [ForageKind,number][]){
   const pool=spots.filter(s=>s.region===region&&s.kind===kind)
   // rain brings out more caps on both islands
   const count=rain&&kind==='mushroom'?rainMushrooms:rain&&kind==='mistcap'?base+2:base
   for(let i=0;i<count&&pool.length;i++)out.push(pool.splice(Math.floor(random()*pool.length),1)[0])
  }
 })
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
