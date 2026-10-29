import {berths,type BerthId} from '../world/worldConfig'

export const travelStorageKey='forest-moments:island-travel:v1'
export interface TravelBook{version:1;checkpoint:BerthId;visitedMist:boolean;foundPine:boolean}
export const emptyTravel=():TravelBook=>({version:1,checkpoint:'main',visitedMist:false,foundPine:false})
/** Save only named safe berths, never an unvalidated arbitrary world position. */
export function decodeTravel(raw:string|null):TravelBook|null{
 try{
  const v:unknown=JSON.parse(raw??'null')
  if(!v||typeof v!=='object'||!('version'in v)||v.version!==1||!('checkpoint'in v)||(v.checkpoint!=='main'&&v.checkpoint!=='mist'))return null
  return{version:1,checkpoint:v.checkpoint,visitedMist:'visitedMist'in v&&v.visitedMist===true,foundPine:'foundPine'in v&&v.foundPine===true}
 }catch{return null}
}
export function travelSpawn(book:TravelBook|null){
 const berth=berths[book?.checkpoint??'main']
 return{position:book?{...berth.landing}:{x:0,z:0},boat:{...berth.mooring,speed:0,phase:0,effort:0}}
}
export function loadTravel(){try{return decodeTravel(window.localStorage.getItem(travelStorageKey))}catch{return null}}
export function saveTravel(book:TravelBook){try{window.localStorage.setItem(travelStorageKey,JSON.stringify(book));return true}catch{return false}}
