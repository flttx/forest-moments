import {modelAssets,workshopPosition,workshopSize} from '../world/assets'

export const workshopStorageKey='forest-moments:workshop:v1'
export type WorkshopBook={version:1;phase:'available'|'carrying'|'finished'}
/** Latest sanding result, translated as `craft.<feedback>` when shown. */
export type CraftFeedback=''|'first'|'good'|'miss'
export type CraftSession={elapsed:number;steps:number;stroke:number;feedback:CraftFeedback}
export const woodSpot={x:-7.5,z:9.2}
export const workshopDoor={x:workshopPosition[0],z:workshopPosition[2]+workshopSize.halfZ*modelAssets.workshop.scale+.85}
export const indoorSpawn={x:0,z:1.6}
export const indoorExit={x:0,z:2.5}
export const workpieceSpot={x:-.6,z:-1.6}
export const craftSpot={x:-.6,z:-.65}
export type WorkshopTransfer={direction:'enter'|'exit';elapsed:number;committed:boolean}
export function decodeWorkshop(raw:string|null):WorkshopBook{
 try{const b=JSON.parse(raw??'null');if(b?.version===1&&['available','carrying','finished'].includes(b.phase))return{version:1,phase:b.phase}}catch{/* Invalid saves start fresh. */}
 return{version:1,phase:'available'}
}
export function workshopAction(p:{x:number;z:number},book:WorkshopBook,location:'island'|'workshop'='island'){
 if(location==='island'){
 if(Math.hypot(p.x-workshopDoor.x,p.z-workshopDoor.z)<=.85)return'enter'
 if(book.phase==='available'&&Math.hypot(p.x-woodSpot.x,p.z-woodSpot.z)<=1.25)return'collect'
 return null
 }
 if(Math.hypot(p.x-indoorExit.x,p.z-indoorExit.z)<=.8)return'exit'
 if(Math.hypot(p.x-craftSpot.x,p.z-craftSpot.z)<=.7)return book.phase==='finished'?'inspect':'craft'
 return null
}
export function craftCursor(elapsed:number){const t=(elapsed%2.4)/1.2;return t<=1?t:2-t}
export function strikeCraft(c:CraftSession):CraftSession{
 if(c.stroke>0||c.steps>=3)return c
 const cursor=craftCursor(c.elapsed),hit=cursor>=.34&&cursor<=.66
 return{...c,steps:c.steps+(hit?1:0),stroke:hit?.95:0,feedback:hit?'good':'miss'}
}
