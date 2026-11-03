import {mistLogs,mistLogHalf} from '../world/mistDetails'

/**
 * Curios in the Mist Isle hollow logs: reaching into a hollow end turns up one small old thing a day, until all five are
 * found. They go on the bedroom shelf at home. Pure rules; the store saves the book.
 */
export const curioIds=['compass','button','marble','whistle','key'] as const
export type CurioId=typeof curioIds[number]
export const curiosStorageKey='forest-moments:curios:v1'
export interface CurioBook{version:1;found:CurioId[];day:number|null}
export const emptyCurios=():CurioBook=>({version:1,found:[],day:null})

/** The open ends of each hollow log, where a paw can reach in; same local frame as movement's log solids. */
export const hollowEnds=mistLogs.flatMap(p=>[-1,1].map(side=>{
 const along=side*mistLogHalf.x*p.scale
 return{x:p.x+Math.cos(p.yaw)*along,z:p.z-Math.sin(p.yaw)*along}
}))
export const reachEnd=(p:{x:number;z:number})=>hollowEnds.some(e=>Math.hypot(p.x-e.x,p.z-e.z)<1.1)

export type CurioFind={kind:'found';id:CurioId}|{kind:'emptyToday'}|{kind:'allFound'}
/** What reaching in finds today; the order of finds is fixed so every save tells the same small story. */
export function reachIn(book:CurioBook,day:number):{book:CurioBook;find:CurioFind}{
 if(book.day===day)return{book,find:{kind:'emptyToday'}}
 const next=curioIds.find(id=>!book.found.includes(id))
 if(!next)return{book:{...book,day},find:{kind:'allFound'}}
 return{book:{version:1,found:[...book.found,next],day},find:{kind:'found',id:next}}
}
const isCurio=(id:unknown):id is CurioId=>typeof id==='string'&&(curioIds as readonly string[]).includes(id)
export function decodeCurios(raw:string|null):CurioBook|null{
 try{
  const v=JSON.parse(raw??'null')
  if(v?.version!==1||!Array.isArray(v.found))return null
  const day=Number.isSafeInteger(v.day)&&v.day>=0?v.day as number:null
  return{version:1,found:[...new Set((v.found as unknown[]).filter(isCurio))],day}
 }catch{return null}
}
