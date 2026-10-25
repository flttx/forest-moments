import {afterEach,beforeEach,expect,it,vi} from 'vitest'
import {beginSleepJourney,daylightAt,lanternPower,lightingStorageKey,sleepDuration} from './dayCycle'
import {dayLighting} from '../world/dayLighting'
import {bedSpot} from './expansion'

let memory:Map<string,string>
beforeEach(()=>{vi.resetModules();memory=new Map();vi.stubGlobal('window',{location:{search:''},localStorage:{getItem:(k:string)=>memory.get(k)??null,setItem:(k:string,v:string)=>memory.set(k,v)}})})
afterEach(()=>vi.unstubAllGlobals())

it.each(['day','dusk','night'] as const)('completes %s sleep once, returns to bed and persists the opposite period',async from=>{
 const {useForestStore:s}=await import('./store')
 s.setState({location:'bedroom',position:bedSpot,timeOfDay:from,homeReady:true})
 s.getState().interact();expect(s.getState().sleepJourney).toEqual(beginSleepJourney(from))
 const target=from==='night'?'day':'night',start=daylightAt(s.getState())
 for(const dt of [NaN,Infinity,-1])s.getState().tickHome(dt)
 expect(s.getState().sleepElapsed).toBe(0)
 let previous=start
 for(let i=0;i<=sleepDuration/.05;i++){
  s.getState().tickHome(.05);const d=daylightAt(s.getState())
  expect(target==='day'?d>=previous:d<=previous).toBe(true);previous=d
 }
 expect(s.getState()).toMatchObject({mode:'walking',location:'bedroom',position:bedSpot,timeOfDay:target,sleepJourney:null,homeBook:{nights:1}})
 s.getState().wakeUp();expect(s.getState().homeBook.nights).toBe(1)
 expect(memory.get(lightingStorageKey)).toBe(target)
 vi.resetModules();expect((await import('./store')).useForestStore.getState().timeOfDay).toBe(target)
})

it('skipping completes the target period and remains usable when saving is blocked',async()=>{
 const {useForestStore:s}=await import('./store')
 s.setState({location:'bedroom',position:bedSpot,timeOfDay:'day',homeReady:true});s.getState().interact()
 window.localStorage.setItem=()=>{throw Error('blocked')}
 s.getState().interact()
 expect(s.getState()).toMatchObject({timeOfDay:'night',mode:'walking',homeBook:{nights:1}})
 expect(s.getState().message).toContain('无法保存')
 s.getState().interact();s.getState().wakeUp();expect(s.getState().timeOfDay).toBe('day')
})

it('crosses the horizon continuously, switches east/west and fades moon and lanterns opposite daylight',()=>{
 let last=dayLighting(0)
 expect(last.sunPosition.y).toBeLessThan(0);expect(last.power).toBe(0);expect(last.night).toBe(1)
 for(let d=.001;d<=1;d+=.001){const next=dayLighting(d);expect(next.sunPosition.y).toBeGreaterThan(last.sunPosition.y);expect(Math.abs(next.horizon.r-last.horizon.r)).toBeLessThan(.01);expect(next.power).toBeGreaterThanOrEqual(last.power);last=next}
 expect(dayLighting(1).sunPosition.y).toBeGreaterThan(0);expect(dayLighting(1).night).toBe(0)
 expect(dayLighting(.3,true).sunPosition.x).toBeGreaterThan(0);expect(dayLighting(.3,false).sunPosition.x).toBeLessThan(0)
 expect(lanternPower(0)).toBe(1);expect(lanternPower(1)).toBe(0)
})
