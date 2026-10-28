import {seaLevel} from '../world/worldConfig'

/**
 * Hidden corners (docs/GAMEPLAY_EXPANSION_PLAN.md §2.9): small things the island keeps for those who look. No map
 * marker; the field guide only gives a hint. Found by walking up and pressing F, or by photographing them. Pure.
 */
export const secretIds=['bottle','jellyfish','constellation','carving','heartStone','foxDen'] as const
export type SecretId=typeof secretIds[number]
export const isSecret=(id:string):id is SecretId=>(secretIds as readonly string[]).includes(id)
export const secretsStorageKey='forest-moments:secrets:v1'
export interface SecretsBook{version:1;found:Partial<Record<SecretId,string>>}
export const emptySecrets=():SecretsBook=>({version:1,found:{}})

/** A bottle washed up on the south crescent, by the reef at (31, 25); read it with F. */
export const bottleSpot={x:28.3,z:25.72}
export const bottleReach=1
/** A jellyfish drifting beside the jetty, its bell just breaking the surface; it glows at night. */
export const jellyfishSpot={x:40,y:seaLevel-.37,z:-2.2}

/** A raccoon's mark cut into the lookout's timber, seen from the platform; found by photographing it up close. */
export const carvingReach=4
/**
 * A thin standing stone in the east meadow, heart-shaped face on and a plain slab from the trail. It faces east and
 * west (`normal`), so only a picture taken from either side, roughly square on, shows the heart.
 */
export const heartStone={x:27.4,z:15.6,height:1.15,normal:{x:1,z:0}}
/** How far off square on a picture of the heart stone may be, in radians. */
export const heartStoneAngle=.42
/**
 * A fox den dug into the foot of the bank below the lookout hill (the mound leans with the slope, `tilt` radians);
 * the fox sleeps beside it at `sleep`. F from the trail side (`stand`).
 */
export const foxDen={x:14.1,z:-18.1,tilt:.4,sleep:{x:13.35,z:-17.3},stand:{x:14,z:-16.9},reach:1.3}
/** Secrets found by walking up and pressing F; each shows its note again afterwards. */
export const noteSecrets=['bottle','foxDen'] as const satisfies readonly SecretId[]

/** The F-found secret within reach of a spot on foot, if any. */
export function noteSecretAt(p:{x:number;z:number}):typeof noteSecrets[number]|null{
 if(Math.hypot(p.x-bottleSpot.x,p.z-bottleSpot.z)<bottleReach)return 'bottle'
 if(Math.hypot(p.x-foxDen.stand.x,p.z-foxDen.stand.z)<foxDen.reach)return 'foxDen'
 return null
}

/** Unit direction on the sky dome from a bearing (radians from +z toward +x) and an elevation. */
const sky=(bearing:number,elevation:number):[number,number,number]=>[Math.sin(bearing)*Math.cos(elevation),Math.sin(elevation),Math.cos(bearing)*Math.cos(elevation)]
/**
 * The raccoon constellation: two ears, a masked face and a curling tail, toward +x at about 45° elevation, which is
 * where the eye goes when stargazing from the west campfire seat (it faces +x). `lines` join star indices; the sky
 * shader draws exactly these stars, and a photo counts when the centre is in frame.
 */
export const constellation={
 stars:[sky(1.48,.86),sky(1.6,.88),sky(1.54,.8),sky(1.56,.72),sky(1.66,.7),sky(1.76,.73),sky(1.8,.81)] as [number,number,number][],
 lines:[[0,2],[1,2],[2,3],[3,4],[4,5],[5,6]] as [number,number][],
 centre:sky(1.62,.79),
}

export function discover(book:SecretsBook,id:SecretId,at:string):SecretsBook{
 return book.found[id]?book:{version:1,found:{...book.found,[id]:at}}
}
export function decodeSecrets(raw:string|null):SecretsBook|null{
 try{
  const b=JSON.parse(raw??'null')
  if(b?.version!==1||!b.found||typeof b.found!=='object'||Array.isArray(b.found))return null
  const found:SecretsBook['found']={}
  for(const [id,at] of Object.entries(b.found)){
   if(!isSecret(id)||typeof at!=='string'||!Number.isFinite(Date.parse(at)))return null
   found[id as SecretId]=at
  }
  return{version:1,found}
 }catch{return null}
}
