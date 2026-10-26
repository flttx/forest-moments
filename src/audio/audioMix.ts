/**
 * Audio settings and the ambience mix: plain numbers, shared by the engine, the HUD and the tests.
 * Ported from my-blog's world audio (src/world/audio/audioMix.ts); this island has no rain but has a campfire.
 */
import {islandShape} from '../world/worldConfig'

export interface AudioSettings{version:1;muted:boolean;master:number;music:number;ambience:number;effects:number}
export const audioStorageKey='forest-moments:audio:v1'
export const defaultAudio:AudioSettings={version:1,muted:false,master:.8,music:.4,ambience:.75,effects:.85}
export const audioChannels=['master','music','ambience','effects'] as const
export type AudioChannel=typeof audioChannels[number]
export type AudioBus=Exclude<AudioChannel,'master'>

const unit=(value:unknown,fallback:number)=>typeof value==='number'&&Number.isFinite(value)?Math.min(1,Math.max(0,value)):fallback
export function parseAudioSettings(raw:string|null):AudioSettings{
 let value:unknown
 try{value=raw?JSON.parse(raw):null}catch{return defaultAudio}
 if(typeof value!=='object'||value===null||(value as {version?:unknown}).version!==1)return defaultAudio
 const v=value as Record<string,unknown>
 return{version:1,muted:v.muted===true,master:unit(v.master,defaultAudio.master),music:unit(v.music,defaultAudio.music),ambience:unit(v.ambience,defaultAudio.ambience),effects:unit(v.effects,defaultAudio.effects)}
}
/** The effective level of a bus: master times its own, nothing when muted. */
export const busLevel=(s:AudioSettings,bus:AudioBus)=>s.muted?0:s.master*s[bus]

export interface MixInput{
 /** 0 (full day) .. 1 (night), from the island's daylight. */
 night:number
 indoors:boolean
 /** 0 inland .. 1 on the shore or out on the water. */
 sea:number
 /** 0 .. 1: a lit campfire close by. */
 fire:number
}
export interface Mix{birds:number;crickets:number;sea:number;wind:number;room:number;fire:number;musicDay:number;musicNight:number;ambienceCutoff:number}

/** Target levels (0..1, before the bus volumes) for the island's state; walls muffle the outdoors. */
export function mixFor({night,indoors,sea,fire}:MixInput):Mix{
 const day=1-night
 return{
  birds:day*(indoors?.12:1),
  crickets:night*(indoors?.15:1),
  sea:sea*(indoors?.12:1),
  wind:indoors?.03:.16+.14*sea,
  room:indoors?1:0,
  fire:indoors?0:fire,
  musicDay:day,musicNight:night,
  ambienceCutoff:indoors?900:18000,
 }
}

/** How near the sea the raccoon is: the walkable plateau ends at ~35.5 m, the coast at ~41 m; 1 on the water. */
export function seaNearness(x:number,z:number,onWater:boolean){
 if(onWater)return 1
 const t=Math.min(1,Math.max(0,(Math.hypot(x,z)-(islandShape.plateauRadius-10))/12))
 return t*t*(3-2*t)
}
/** Campfire crackle fades in within 9 m of a lit fire. */
export function fireNearness(dx:number,dz:number,lit:boolean){
 if(!lit)return 0
 const t=Math.min(1,Math.max(0,1-(Math.hypot(dx,dz)-1.5)/7.5))
 return t*t
}

export type StepSurface='grass'|'wood'|'stone'
/** Metres between footfalls at a horizontal speed (walk 1.1 m/s, run 3.08 m/s for this raccoon). */
export const stepLength=(speed:number)=>speed<1.6?.42:.42+(Math.min(speed,3.1)-1.6)*.28
