import {afterEach,beforeEach,expect,it,vi} from 'vitest'
import {afloat,canLaunch,lanternAt,lanternLife,launchPoint,launchSeconds,launchStand,maxLanterns,nearLaunch,riverSeconds} from './lanterns'
import {creekWaterY,creekZ} from './expansion'
import {creekSection} from '../world/creekGeometry'
import {seaLevel} from '../world/worldConfig'
import {canStandAt,moveOnGround} from './movement'

it('rides the creek downstream on its water, then drifts out to sea and fades',()=>{
 let previous=Infinity
 for(let age=0;age<riverSeconds;age+=.5){
  const p=lanternAt(age,3)!
  expect(p.x).toBeLessThanOrEqual(previous);previous=p.x
  expect(Math.abs(p.y-creekWaterY(p.x)-.02)).toBeLessThan(.02)
  // Within the stream's banks the whole way down.
  const s=creekSection(p.x);expect(p.z-creekZ(p.x)).toBeGreaterThan(-s.left);expect(p.z-creekZ(p.x)).toBeLessThan(s.right)
 }
 const sea=lanternAt(riverSeconds+10)!
 expect(sea.x).toBeLessThan(-40);expect(Math.abs(sea.y-seaLevel-.02)).toBeLessThan(.02)
 expect(lanternAt(1)!.opacity).toBe(1);expect(lanternAt(lanternLife-1)!.opacity).toBeCloseTo(.1)
 for(const age of [-1,lanternLife,NaN])expect(lanternAt(age)).toBeNull()
 expect(Math.hypot(lanternAt(0)!.x-launchPoint.x,lanternAt(0)!.z-launchPoint.z)).toBeLessThan(.05)
})

it('is only lit after dark, from the stone above the bridge, which the raccoon can walk to',()=>{
 expect(canLaunch('day')).toBe(false);expect(canLaunch('dusk')).toBe(true);expect(canLaunch('night')).toBe(true)
 expect(nearLaunch(launchStand)).toBe(true);expect(nearLaunch({x:launchStand.x,z:launchStand.z+2})).toBe(false)
 expect(canStandAt(launchStand.x,launchStand.z)).toBe(true)
 // From the highland trail just north of it, straight down to the stone.
 const end=moveOnGround({x:-11.5,z:-14.8},launchStand.x+11.5,launchStand.z+14.8)
 expect(Math.hypot(end.x-launchStand.x,end.z-launchStand.z)).toBeLessThan(.05)
 expect(afloat([0,1000,90000],95000)).toEqual([90000])
})

let memory:Map<string,string>
beforeEach(()=>{vi.resetModules();vi.useFakeTimers();vi.setSystemTime(1e6);memory=new Map();vi.stubGlobal('window',{location:{search:''},localStorage:{getItem:(k:string)=>memory.get(k)??null,setItem:(k:string,v:string)=>memory.set(k,v)}})})
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals()})

it('sets a lantern with the interact motion, refuses by day and beyond the limit, and writes it in the journal',async()=>{
 const {useForestStore:s}=await import('./store'),{journalEvents}=await import('./journal')
 s.setState({position:{...launchStand},timeOfDay:'day'})
 s.getState().interact();expect(s.getState().mode).toBe('walking');expect(s.getState().message).toContain('黄昏')
 s.setState({timeOfDay:'night'})
 s.getState().interact();expect(s.getState().mode).toBe('launching')
 const before=s.getState()
 for(let i=0;i<=launchSeconds/.05;i++)s.getState().tickLaunch(.05)
 expect(s.getState()).toMatchObject({mode:'walking',lanterns:{launched:[1e6],total:1}})
 expect(journalEvents(before,s.getState())).toContainEqual({type:'lantern'})
 s.setState({lanterns:{launched:Array(maxLanterns).fill(1e6),total:maxLanterns}})
 s.getState().interact();expect(s.getState().mode).toBe('walking');expect(s.getState().message).toContain('够多')
})
