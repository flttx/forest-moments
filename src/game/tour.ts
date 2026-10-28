import {workshopPosition} from '../world/worldConfig'
import {camp} from './expansion'
import {lookoutEye} from './lookout'

/**
 * The guided tour (docs/GAMEPLAY_TIER1_PLAN.md T5): the camera flies a fixed route over the island's places with a
 * line about each, then lets go. Nothing in the game moves or is saved. Pure: the route and where the camera is.
 */
type V3=readonly [number,number,number]
export interface TourStop{id:string;eye:V3;target:V3;/** Seconds flying in, then held (drifting a little closer). */fly:number;hold:number;dusk?:boolean}
const [wx,,wz]=workshopPosition
// From the lookout platform, out over the north-west sea where the dusk sun sets.
const yaw=-2.36,pitch=-.1,towerEye=[lookoutEye.x,lookoutEye.y,lookoutEye.z] as const
const towerView=[lookoutEye.x+Math.sin(yaw)*Math.cos(pitch)*40,lookoutEye.y+Math.sin(pitch)*40,lookoutEye.z+Math.cos(yaw)*Math.cos(pitch)*40] as const
// Eyes picked clear of near trunks and crowns (ray grid over each frame; see docs/evidence/2026-10-28-tier1).
export const tourStops:readonly TourStop[]=[
 {id:'overview',eye:[52,34,48],target:[0,0,-2],fly:6,hold:9},
 {id:'workshop',eye:[-8.2,4,19.4],target:[wx,1.4,wz],fly:7,hold:6},
 {id:'farm',eye:[15.5,6.5,-1],target:[8,.8,6],fly:4.5,hold:6},
 {id:'pond',eye:[-.5,3.4,1.5],target:[6,0,-5],fly:4.5,hold:6},
 {id:'dock',eye:[36.2,5.7,16],target:[42,0,0],fly:4.5,hold:6},
 {id:'camp',eye:[17.6,3.9,31.9],target:[camp.x,.6,camp.z],fly:4.5,hold:6},
 {id:'lookout',eye:towerEye,target:towerView,fly:6.5,hold:9,dusk:true},
]
export const tourDuration=tourStops.reduce((n,s)=>n+s.fly+s.hold,0)
/** When dusk comes on: as the camera sets off for the first stop that wants it. */
export const duskAt=(()=>{let n=0;for(const s of tourStops){if(s.dusk)return n;n+=s.fly+s.hold}return Infinity})()

const smoother=(t:number)=>t*t*t*(t*(t*6-15)+10)
const mix=(a:V3,b:V3,t:number):[number,number,number]=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t]
const dist=(a:V3,b:V3)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2])
/** Where a stop's hold ends: 6% of the way toward what it looks at. */
const settled=(s:TourStop)=>mix(s.eye,s.target,.06)

export interface TourFrame{eye:[number,number,number];target:[number,number,number];/** The stop being flown to or held. */stop:number;done:boolean}
/** The camera `elapsed` seconds in; `from` is where the camera was when the tour began. */
export function tourFrame(elapsed:number,from:{eye:V3;target:V3}):TourFrame{
 let t=Math.max(0,Number.isFinite(elapsed)?elapsed:0),prev=from
 for(let i=0;i<tourStops.length;i++){
  const s=tourStops[i]
  if(t<s.fly){
   // Over the trees between stops: the path lifts with the distance flown.
   const u=smoother(t/s.fly),eye=mix(prev.eye,s.eye,u),lift=Math.min(14,dist(prev.eye,s.eye)*.22)*Math.sin(Math.PI*u)
   eye[1]+=lift
   return{eye,target:mix(prev.target,s.target,u),stop:i,done:false}
  }
  t-=s.fly
  if(t<s.hold)return{eye:mix(s.eye,settled(s),smoother(t/s.hold)),target:[...s.target],stop:i,done:false}
  t-=s.hold
  prev={eye:settled(s),target:s.target}
 }
 const last=tourStops[tourStops.length-1]
 return{eye:settled(last),target:[...last.target],stop:tourStops.length-1,done:true}
}
