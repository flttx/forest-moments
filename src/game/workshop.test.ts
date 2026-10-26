import {beforeEach,afterEach,it,expect,vi} from 'vitest'
import {decodeWorkshop,workshopStorageKey,woodSpot,craftSpot,workpieceSpot,strikeCraft,workshopDoor,indoorExit,workshopAction} from './workshop'
import {canStandAt} from './movement'
import {canStandInWorkshop,moveInWorkshop} from './workshopInterior'
let memory:Map<string,string>
beforeEach(()=>{vi.resetModules();memory=new Map();vi.stubGlobal('window',{localStorage:{getItem:(k:string)=>memory.get(k)??null,setItem:(k:string,v:string)=>memory.set(k,v)}})})
afterEach(()=>vi.unstubAllGlobals())
it('rejects bad saves and keeps only a single valid material/product phase',()=>{
 for(const raw of ['bad','{}','{"version":1,"phase":"duplicated"}'])expect(decodeWorkshop(raw).phase).toBe('available')
 expect(decodeWorkshop('{"version":1,"phase":"finished","count":99}')).toEqual({version:1,phase:'finished'})
})
it('keeps the station reachable and switches wood collision with the saved phase',()=>{
 expect(canStandInWorkshop(craftSpot.x,craftSpot.z,true)).toBe(true)
 expect(canStandAt(workshopDoor.x,workshopDoor.z)).toBe(true)
 expect(canStandAt(woodSpot.x,woodSpot.z,0,'available')).toBe(false)
 expect(canStandAt(woodSpot.x,woodSpot.z,0,'carrying')).toBe(true)
 expect(canStandInWorkshop(workpieceSpot.x,workpieceSpot.z,true)).toBe(false)
})
it('requires reach and loaded props; cancelling collection leaves the wood and does not save',async()=>{
 const {useForestStore:s}=await import('./store');s.setState({nearby:'workshop',position:{x:woodSpot.x,z:woodSpot.z+1}})
 s.getState().interact();expect(s.getState().mode).toBe('walking');s.setState({workshopReady:true});s.getState().interact();expect(s.getState().mode).toBe('gathering')
 s.getState().tickWorkshop(.05);s.getState().cancelWorkshop();expect(s.getState().workshopBook.phase).toBe('available');expect(memory.size).toBe(0)
 s.getState().interact();for(let i=0;i<33;i++)s.getState().tickWorkshop(.05)
 expect(s.getState().workshopBook.phase).toBe('carrying');expect(decodeWorkshop(memory.get(workshopStorageKey)!).phase).toBe('carrying')
 s.getState().interact();expect(s.getState().mode).toBe('walking')
})
it('misses cost no material, cancellation preserves it, and three completed strokes create exactly one persistent stool',async()=>{
 const {useForestStore:s}=await import('./store');s.setState({nearby:'workshop',workshopReady:true,location:'workshop',position:craftSpot,workshopBook:{version:1,phase:'carrying'}})
 s.getState().interact();s.getState().interact();expect(s.getState().craft!.steps).toBe(0)
 s.getState().cancelWorkshop();expect(s.getState().workshopBook.phase).toBe('carrying');s.getState().interact()
 for(let i=0;i<3;i++){
   s.setState({craft:{...s.getState().craft!,elapsed:.6,stroke:0}});s.getState().interact();s.getState().interact();expect(s.getState().craft!.steps).toBe(i+1)
   expect(s.getState().workshopBook.phase).toBe('carrying');for(let j=0;j<20;j++)s.getState().tickWorkshop(.05)
 }
 expect(s.getState().mode).toBe('walking');expect(s.getState().workshopBook.phase).toBe('finished');expect(decodeWorkshop(memory.get(workshopStorageKey)!).phase).toBe('finished')
 s.getState().interact();expect(s.getState().craft).toBeNull()
})
it('handles reload and blocked storage without losing session playability',async()=>{
 memory.set(workshopStorageKey,'{"version":1,"phase":"carrying"}')
 const {useForestStore:s}=await import('./store');expect(s.getState().workshopBook.phase).toBe('carrying');expect(s.getState().craft).toBeNull()
 window.localStorage.setItem=()=>{throw Error('denied')}
 s.setState({mode:'crafting',craft:{elapsed:1,steps:3,stroke:.01,feedback:''}});s.getState().tickWorkshop(.05)
 expect(s.getState().workshopBook.phase).toBe('finished');expect(s.getState().message).toContain('无法保存')
})
it('ignores strokes during a stroke and rejects non-finite time progression',async()=>{
 const c={elapsed:.6,steps:1,stroke:.5,feedback:'' as const};expect(strikeCraft(c)).toBe(c)
 const {useForestStore:s}=await import('./store');s.setState({mode:'gathering',gatheringElapsed:0});s.getState().tickWorkshop(NaN);s.getState().tickWorkshop(-4);expect(s.getState().gatheringElapsed).toBe(0)
})

it('enters through the door at the opaque point, locks repeat F and returns to the same exterior position',async()=>{
 const {useForestStore:s}=await import('./store');s.setState({nearby:'workshop',position:{...workshopDoor},workshopReady:true})
 s.getState().interact();expect(s.getState().location).toBe('island');expect(s.getState().workshopTransfer?.direction).toBe('enter')
 s.getState().interact();for(let i=0;i<7;i++)s.getState().tickWorkshopTransfer(.05)
 expect(s.getState().location).toBe('island');for(let i=0;i<11;i++)s.getState().tickWorkshopTransfer(.05)
 expect(s.getState().location).toBe('workshop');expect(s.getState().position).toEqual({x:0,z:1.6});expect(s.getState().workshopTransfer).toBeNull()
 s.getState().updatePosition(indoorExit.x,indoorExit.z);s.getState().interact();for(let i=0;i<18;i++)s.getState().tickWorkshopTransfer(.05)
 expect(s.getState().location).toBe('island');expect(s.getState().position).toEqual(workshopDoor)
})
it('separates indoor actions and collision from the island, blocks furniture and permits a route to the exit',()=>{
 expect(workshopAction(woodSpot,{version:1,phase:'available'},'workshop')).toBeNull()
 expect(workshopAction(craftSpot,{version:1,phase:'carrying'},'island')).toBeNull()
 expect(canStandInWorkshop(0,-2.4)).toBe(false);expect(canStandInWorkshop(3.2,-2.25)).toBe(false)
 expect(canStandInWorkshop(4.2,0)).toBe(false)
 let p=moveInWorkshop({x:0,z:1.6},-.6,0,true);p=moveInWorkshop(p,0,-2.25,true)
 expect(p.x).toBeCloseTo(craftSpot.x);expect(p.z).toBeCloseTo(craftSpot.z)
 p=moveInWorkshop(p,0,3.15,true);p=moveInWorkshop(p,.6,0,true)
 expect(p.x).toBeCloseTo(indoorExit.x);expect(p.z).toBeCloseTo(indoorExit.z)
 expect(moveInWorkshop(p,100,0).x).toBeLessThan(3.73)
})
