import {expect,it} from 'vitest'
import {curioIds,decodeCurios,emptyCurios,hollowEnds,reachEnd,reachIn} from './curios'
import {canStandAt} from './movement'

it('opens two ends on each hollow log, each with standable ground within reach',()=>{
 expect(hollowEnds).toHaveLength(4)
 for(const e of hollowEnds){
  const stand=Array.from({length:32},(_,i)=>({x:e.x+Math.cos(i*Math.PI/16)*.9,z:e.z+Math.sin(i*Math.PI/16)*.9})).filter(p=>canStandAt(p.x,p.z)&&reachEnd(p))
  expect(stand.length).toBeGreaterThan(4)
 }
})
it('gives one curio a day in a fixed order, then nothing once all five are found',()=>{
 let book=emptyCurios()
 for(const [day,id] of curioIds.entries()){
  const r=reachIn(book,day);expect(r.find).toEqual({kind:'found',id});book=r.book
  expect(reachIn(book,day).find.kind).toBe('emptyToday')
 }
 expect(reachIn(book,9).find.kind).toBe('allFound')
 expect(book.found).toEqual([...curioIds])
})
it('reads a saved shelf and drops anything unknown',()=>{
 expect(decodeCurios(JSON.stringify({version:1,found:['key','key','sock'],day:3}))).toEqual({version:1,found:['key'],day:3})
 expect(decodeCurios(JSON.stringify({version:1,found:[],day:-2}))?.day).toBeNull()
 for(const raw of ['x','{}',JSON.stringify({version:2,found:[]})])expect(decodeCurios(raw)).toBeNull()
})
it('F at a hollow end finds today\'s curio and saves it',async()=>{
 const {vi}=await import('vitest')
 const memory=new Map<string,string>()
 vi.stubGlobal('window',{location:{search:''},localStorage:{getItem:(k:string)=>memory.get(k)??null,setItem:(k:string,v:string)=>memory.set(k,v)}})
 vi.resetModules()
 const {useForestStore:s}=await import('./store'),{curiosStorageKey}=await import('./curios'),{promptFor}=await import('./prompt')
 const e=hollowEnds[0],spot=Array.from({length:32},(_,i)=>({x:e.x+Math.cos(i*Math.PI/16)*.9,z:e.z+Math.sin(i*Math.PI/16)*.9})).find(p=>canStandAt(p.x,p.z)&&reachEnd(p))!
 s.setState({location:'island',mode:'walking',position:spot,nearby:null})
 expect(promptFor(s.getState())?.action).toBeTruthy()
 s.getState().interact()
 expect(s.getState().curiosBook.found).toEqual(['compass'])
 expect(JSON.parse(memory.get(curiosStorageKey)!).found).toEqual(['compass'])
 expect(promptFor(s.getState())?.action).toBeFalsy()
 vi.unstubAllGlobals()
})
