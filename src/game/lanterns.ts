import {creekWaterY,creekZ} from './expansion'
import {seaLevel} from '../world/worldConfig'

/**
 * River lanterns (docs/GAMEPLAY_TIER1_PLAN.md T4): at dusk or night the raccoon sets a paper lantern on the creek
 * just above the bridge; it rides the stream down to the west shore, then drifts out to sea and fades. Lanterns live
 * for this visit only. Pure.
 */
export const launchStand={x:-11.5,z:-18.13}
/** Where the lantern touches the water: mid-stream in front of the stand. */
export const launchPoint={x:-11.3,z:creekZ(-11.3)}
export const launchReach=1.2
export const launchSeconds=1.4
export const maxLanterns=6
/** Seconds on the creek, then out at sea; the last few fade away. */
export const riverSeconds=60,seaSeconds=20,lanternLife=riverSeconds+seaSeconds,fadeSeconds=10
const creekMouth=-40,seaDrift=10

export const canLaunch=(light:'day'|'dusk'|'night')=>light!=='day'
export const nearLaunch=(p:{x:number;z:number})=>Math.hypot(p.x-launchStand.x,p.z-launchStand.z)<launchReach
/** Launch times (ms) still afloat at `now`. */
export const afloat=(launched:readonly number[],now:number)=>launched.filter(at=>now-at>=0&&now-at<lanternLife*1000)

/** Where a lantern is `age` seconds after launch (`seed` varies the sway), and how bright, or null once gone. */
export function lanternAt(age:number,seed=0){
 if(!Number.isFinite(age)||age<0||age>=lanternLife)return null
 const sway=Math.sin(age*.55+seed*2.1)*.22,bob=Math.sin(age*2.3+seed)*.012
 let x:number,z:number,y:number
 if(age<riverSeconds){
  // Eased off the bank, then carried at an even pace down to the mouth.
  const t=age/riverSeconds,s=t<.05?t*t/.1:t-.025
  x=launchPoint.x+(creekMouth-launchPoint.x)*s/.975;z=creekZ(x)+sway*Math.min(1,age/4);y=creekWaterY(x)
 }else{
  const t=(age-riverSeconds)/seaSeconds
  x=creekMouth-seaDrift*t;z=creekZ(creekMouth)+sway+t*1.5;y=seaLevel
 }
 return{x,y:y+.02+bob,z,opacity:Math.min(1,(lanternLife-age)/fadeSeconds),yaw:age*.12+seed}
}
