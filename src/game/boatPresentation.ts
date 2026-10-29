import type {BoatState} from './rowing'
import {berths,type BerthId} from '../world/worldConfig'

export const transferDuration=.85
export const transferCommit=.4
export type BoatTransfer={direction:'board'|'land';elapsed:number;committed:boolean;berth?:BerthId}
const smooth=(x:number)=>{const t=Math.max(0,Math.min(1,x));return t*t*(3-2*t)}
export function transferOpacity(elapsed:number){
 return elapsed<.32?smooth(elapsed/.32):elapsed<.48?1:1-smooth((elapsed-.48)/(transferDuration-.48))
}
/** Small presentation offsets only. Navigation and shoreline collisions remain on the mean water plane. */
export function boatSurfacePose(boat:BoatState,time:number,reducedMotion:boolean){
 const offshore=smooth((Math.min(...Object.values(berths).map(({mooring:m})=>Math.hypot(boat.x-m.x,boat.z-m.z)))-.8)/1.3)
 const strength=reducedMotion?0:offshore
 if(strength===0)return {heave:0,pitch:0,roll:0}
 return {heave:strength*(Math.sin(time*1.4+boat.x*.18)*.014+Math.sin(time*2.1+boat.z*.2)*.006),
  pitch:strength*Math.sin(time*1.25+boat.x*.1)*.009,
  roll:strength*Math.sin(time*1.7+boat.z*.2)*.012}
}
