import {nightsPerSeason,seasonFor,seasonIds,type Season} from './weather'

/**
 * Season recaps (docs/GAMEPLAY_TIER1_PLAN.md T2): when the raccoon wakes into a new season, the one just ended is
 * written up from the difference between two snapshots of the island's running totals. Pure.
 */
export const seasonsStorageKey='forest-moments:seasons:v1'
export const tallyIds=['fish','meals','stamps','crafted','secrets','trees'] as const
export type TallyId=typeof tallyIds[number]
export type Tally=Record<TallyId,number>
export interface SeasonRecap{season:Season;startDay:number;endDay:number;tally:Tally}
export interface SeasonBook{version:1;start:{day:number;tally:Tally};recaps:SeasonRecap[]}
/** Recaps kept; the oldest go first. */
export const recapLimit=12

export const seasonIndex=(day:number)=>Math.floor(Math.max(0,day)/nightsPerSeason)
export const startBook=(day:number,tally:Tally):SeasonBook=>({version:1,start:{day,tally:{...tally}},recaps:[]})

/** What happened between two snapshots; a total that went down (a reset save) counts as nothing. */
export const tallyDelta=(from:Tally,to:Tally):Tally=>Object.fromEntries(tallyIds.map(id=>[id,Math.max(0,to[id]-from[id])])) as Tally

/** After a night's sleep: when the day starts a new season, the ended one becomes a recap and a new snapshot begins. */
export function closeSeason(book:SeasonBook,day:number,tally:Tally):{book:SeasonBook;recap:SeasonRecap|null}{
 if(seasonIndex(day)<=seasonIndex(book.start.day))return{book,recap:null}
 const recap:SeasonRecap={season:seasonFor(book.start.day),startDay:book.start.day,endDay:day,tally:tallyDelta(book.start.tally,tally)}
 return{book:{version:1,start:{day,tally:{...tally}},recaps:[...book.recaps,recap].slice(-recapLimit)},recap}
}

/** Whether a photo taken on `day` belongs to the recap. */
export const inRecap=(recap:SeasonRecap,day:number|undefined)=>day!==undefined&&day>=recap.startDay&&day<recap.endDay

const isCount=(n:unknown):n is number=>Number.isSafeInteger(n)&&(n as number)>=0
const isTally=(t:unknown):t is Tally=>!!t&&typeof t==='object'&&tallyIds.every(id=>isCount((t as Tally)[id]))
export function decodeSeasons(raw:string|null):SeasonBook|null{
 try{
  const b=JSON.parse(raw??'null')
  if(b?.version!==1||!isCount(b.start?.day)||!isTally(b.start.tally)||!Array.isArray(b.recaps)||b.recaps.length>recapLimit)return null
  const recaps:SeasonRecap[]=b.recaps
  if(recaps.some(r=>!r||!seasonIds.includes(r.season)||!isCount(r.startDay)||!isCount(r.endDay)||r.endDay<=r.startDay||r.endDay>b.start.day||!isTally(r.tally)))return null
  return{version:1,start:{day:b.start.day,tally:pick(b.start.tally)},recaps:recaps.map(r=>({season:r.season,startDay:r.startDay,endDay:r.endDay,tally:pick(r.tally)}))}
 }catch{return null}
}
const pick=(t:Tally):Tally=>Object.fromEntries(tallyIds.map(id=>[id,t[id]])) as Tally
