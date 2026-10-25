export type TimeOfDay='day'|'dusk'|'night'
export type SleepJourney={from:TimeOfDay;target:'day'|'night'}
export const sleepDuration=18
export const lightingStorageKey='forest-moments:lighting:v1'
export const daylightFor=(time:TimeOfDay)=>time==='day'?1:time==='dusk'?.32:0
export const beginSleepJourney=(from:TimeOfDay):SleepJourney=>({from,target:from==='night'?'day':'night'})
export function sleepProgress(elapsed:number){const t=Math.max(0,Math.min(1,(elapsed-1)/16));return t*t*(3-2*t)}
export function daylightAt(state:{mode:string;timeOfDay:TimeOfDay;sleepElapsed:number;sleepJourney:SleepJourney|null}){
 const journey=state.mode==='sleeping'?state.sleepJourney:null
 if(!journey)return daylightFor(state.timeOfDay)
 return daylightFor(journey.from)+(daylightFor(journey.target)-daylightFor(journey.from))*sleepProgress(state.sleepElapsed)
}
export function lanternPower(daylight:number){const t=Math.max(0,Math.min(1,(daylight-.08)/.48));return 1-t*t*(3-2*t)}
export function sleepCamera(target:'day'|'night'){
 const side=target==='day'?-1:1
 return{position:[74*side,58,96*side] as const,target:[0,10,0] as const,fov:55}
}
