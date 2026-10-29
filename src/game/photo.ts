import type {useForestStore} from './store'

/** Photo mode rules (docs/JOURNAL_PHOTO_PLAN.md §3). Pure: the store, album and scene hook into these. */
export const albumLimit=12
export const thumbWidth=320
/** Orbit limits while framing a shot: wider than play, so the camera can go low and close or high and far. */
export const photoOrbit={minPitch:-.17,maxPitch:1.4,minZoom:.12,maxZoom:2.3} as const

/** Looks (plan §3.4). Filters change the rendered picture; frames are drawn around the saved one. Pages = stamped journal pages. */
export const filterIds=['plain','warm','depth','film','mono','lamp'] as const
export type FilterId=typeof filterIds[number]
export const frameIds=['none','paper','stamps'] as const
export type FrameId=typeof frameIds[number]
export const filterUnlock:Record<FilterId,number>={plain:0,warm:0,depth:1,film:2,mono:3,lamp:4}
export const frameUnlock:Record<FrameId,number>={none:0,paper:2,stamps:5}
/** All filters and frames are available from the start; journal progress is no longer required. */
export const openAllLooks=true
export const looksUnlocked=(pages:number,need:number)=>openAllLooks||pages>=need
/** Depth of field is the costly one: dropped on the low quality tier. */
export const filterAllowed=(id:FilterId,low:boolean)=>!(id==='depth'&&low)

type State=Pick<ReturnType<typeof useForestStore.getState>,'mode'|'sitting'|'menuPaused'|'aquariumOpen'|'homeTransfer'|'workshopTransfer'|'boatTransfer'|'lookoutTransfer'>
export type PhotoBlock='busy'|'transition'|'menu'

/** Why the camera cannot come out right now; null when it can. Fishing, woodwork, sleeping and the like are mid-task. */
export function photoBlock(s:State):PhotoBlock|null{
 if(s.menuPaused||s.aquariumOpen)return 'menu'
 if(s.homeTransfer||s.workshopTransfer||s.boatTransfer||s.lookoutTransfer)return 'transition'
 if(s.mode==='walking'||s.mode==='rowing'||s.mode==='lookout')return null
 if(s.mode==='sitting'&&s.sitting?.phase==='idle')return null
 return s.mode==='sitting'?'transition':'busy'
}

export const photoFileName=(at:Date)=>{
 const p=(n:number)=>String(n).padStart(2,'0')
 return `forest-moments-${at.getFullYear()}${p(at.getMonth()+1)}${p(at.getDate())}-${p(at.getHours())}${p(at.getMinutes())}${p(at.getSeconds())}.png`
}

/** Ids to delete so only the newest `limit` remain (records need `at`, ISO). */
export function photosToDrop(records:readonly {id:string;at:string}[],limit=albumLimit){
 return [...records].sort((a,b)=>Date.parse(b.at)-Date.parse(a.at)||(a.id<b.id?1:-1)).slice(limit).map(r=>r.id)
}

type OrbitTargets={targetPitch:number;targetZoom:number}
/** Pulls an orbit's targets back inside a range, e.g. into play limits after leaving photo mode. */
export function clampOrbitTargets(o:OrbitTargets,pitch:readonly [number,number],zoom:readonly [number,number]){
 o.targetPitch=Math.max(pitch[0],Math.min(pitch[1],o.targetPitch))
 o.targetZoom=Math.max(zoom[0],Math.min(zoom[1],o.targetZoom))
}
