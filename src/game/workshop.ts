import {isRecipe,type RecipeId} from './recipes'
import {modelAssets,workshopPosition,workshopSize} from '../world/assets'
import boxes from './workshopColliders.json'

export const workshopStorageKey='forest-moments:workshop:v1'
/** `made`: recipes finished after the stool; `woodDay`: day (nights slept) wood was last taken from the pile. */
export type WorkshopBook={version:1;phase:'available'|'carrying'|'finished';made?:RecipeId[];woodDay?:number}
/** Latest sanding result, translated as `craft.<feedback>` when shown. */
export type CraftFeedback=''|'first'|'good'|'miss'
/** `recipe` is set for pieces after the stool. */
export type CraftSession={elapsed:number;steps:number;stroke:number;feedback:CraftFeedback;recipe?:RecipeId}
// Clear of the neighbouring pine's low branches (its foliage collider reaches 1.76 m from the trunk).
export const woodSpot={x:-7.9,z:9.6}
export const workshopDoor={x:workshopPosition[0],z:workshopPosition[2]+workshopSize.halfZ*modelAssets.workshop.scale+.85}
// Far enough from the entrance wall for the camera arm to sit behind the raccoon, not overhead.
export const indoorSpawn={x:0,z:1}
export const indoorExit={x:0,z:2.5}
export const workpieceSpot={x:-.6,z:-1.6}
export const craftSpot={x:-.6,z:-.65}
// Measured from bench_sit_idle: hips settle .296 m behind the root, thighs .20 m above the feet.
export const sitHipsBack=.296
export const stoolSeatHeight=.21
// Facing +x, so the hips land on the stool centre.
export const stoolSeat={x:workpieceSpot.x+sitHipsBack,z:workpieceSpot.z}
const bench=boxes.find(b=>b.name==='Collider_Workbench')!
// Standing anywhere along the bench front or ends counts, not only the exact station.
const atBench=(p:{x:number;z:number})=>Math.hypot(Math.max(bench.minX-p.x,0,p.x-bench.maxX),Math.max(bench.minZ-p.z,0,p.z-bench.maxZ))<=.6
export type WorkshopTransfer={direction:'enter'|'exit';elapsed:number;committed:boolean}
export function decodeWorkshop(raw:string|null):WorkshopBook{
 try{
  const b=JSON.parse(raw??'null')
  if(b?.version===1&&['available','carrying','finished'].includes(b.phase)){
   const out:WorkshopBook={version:1,phase:b.phase}
   if(Array.isArray(b.made)){const made=[...new Set(b.made.filter(isRecipe))] as RecipeId[];if(made.length)out.made=made}
   if(Number.isSafeInteger(b.woodDay)&&b.woodDay>=0)out.woodDay=b.woodDay
   return out
  }
 }catch{/* Invalid saves start fresh. */}
 return{version:1,phase:'available'}
}
export function workshopAction(p:{x:number;z:number},book:WorkshopBook,location:'island'|'workshop'='island'){
 if(location==='island'){
 if(Math.hypot(p.x-workshopDoor.x,p.z-workshopDoor.z)<=.85)return'enter'
 if(book.phase==='available'&&Math.hypot(p.x-woodSpot.x,p.z-woodSpot.z)<=1.25)return'collect'
 return null
 }
 if(Math.hypot(p.x-indoorExit.x,p.z-indoorExit.z)<=.8)return'exit'
 // Once the stool is made, the bench takes new pieces; the stool itself is still there to sit on.
 if(book.phase==='finished')return Math.hypot(p.x-stoolSeat.x,p.z-stoolSeat.z)<=.75?'inspect':Math.hypot(p.x-craftSpot.x,p.z-craftSpot.z)<=.7||atBench(p)?'recipes':null
 return Math.hypot(p.x-craftSpot.x,p.z-craftSpot.z)<=.7||atBench(p)?'craft':null
}
export function craftCursor(elapsed:number){const t=(elapsed%2.4)/1.2;return t<=1?t:2-t}
export function strikeCraft(c:CraftSession):CraftSession{
 if(c.stroke>0||c.steps>=3)return c
 const cursor=craftCursor(c.elapsed),hit=cursor>=.34&&cursor<=.66
 return{...c,steps:c.steps+(hit?1:0),stroke:hit?.95:0,feedback:hit?'good':'miss'}
}
