import {seaLevel} from '../world/worldConfig'

/**
 * Hidden corners (docs/GAMEPLAY_EXPANSION_PLAN.md §2.9): small things the island keeps for those who look. No map
 * marker; the field guide only gives a hint. Found by walking up and pressing F, or by photographing them. Pure.
 */
export const secretIds=['bottle','jellyfish','constellation'] as const
export type SecretId=typeof secretIds[number]
export const secretsStorageKey='forest-moments:secrets:v1'
export interface SecretsBook{version:1;found:Partial<Record<SecretId,string>>}
export const emptySecrets=():SecretsBook=>({version:1,found:{}})

/** A bottle washed up on the south crescent, by the reef at (31, 25); read it with F. */
export const bottleSpot={x:28.3,z:25.72}
export const bottleReach=1
/** A jellyfish drifting beside the jetty, its bell just breaking the surface; it glows at night. */
export const jellyfishSpot={x:40,y:seaLevel-.37,z:-2.2}

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
   if(!(secretIds as readonly string[]).includes(id)||typeof at!=='string'||!Number.isFinite(Date.parse(at)))return null
   found[id as SecretId]=at
  }
  return{version:1,found}
 }catch{return null}
}
