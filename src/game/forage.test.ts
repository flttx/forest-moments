import {expect,it} from 'vitest'
import {availableSpots,decodeForage,emptyForage,forageKinds,forageSpots,perDay,spotNear,spotsForDay,takeSpot} from './forage'
import {canStandAt} from './movement'

it('has room on the island for every kind, each on standable ground and apart',()=>{
 for(const kind of forageKinds)expect(forageSpots.filter(s=>s.kind===kind).length).toBeGreaterThanOrEqual(perDay[kind]*2)
 for(const s of forageSpots)expect(canStandAt(s.x,s.z)).toBe(true)
 expect(new Set(forageSpots.map(s=>s.id)).size).toBe(forageSpots.length)
})
it('offers a fixed handful per day, different from day to day',()=>{
 const a=spotsForDay(3),b=spotsForDay(3),c=spotsForDay(4)
 expect(a).toEqual(b)
 for(const kind of forageKinds)expect(a.filter(s=>s.kind===kind)).toHaveLength(perDay[kind])
 expect(a.map(s=>s.id)).not.toEqual(c.map(s=>s.id))
})
it('picks the nearest thing within reach, once per day, and starts afresh after sleeping',()=>{
 const today=spotsForDay(2),first=today[0]
 expect(spotNear({x:first.x+.3,z:first.z},emptyForage(2),2)?.id).toBe(first.id)
 expect(spotNear({x:first.x+5,z:first.z+5},emptyForage(2),2)?.id).not.toBe(first.id)
 const book=takeSpot(emptyForage(2),2,first.id)
 expect(availableSpots(book,2).map(s=>s.id)).not.toContain(first.id)
 expect(takeSpot(book,2,first.id)).toBe(book)
 // Next day the old list no longer applies.
 expect(takeSpot(book,3,'x').taken).toEqual(['x'])
 expect(availableSpots(book,3)).toHaveLength(spotsForDay(3).length)
})
it('reads a saved book and rejects a broken one',()=>{
 expect(decodeForage(JSON.stringify({version:1,day:2,taken:['a','a','b']}))).toEqual({version:1,day:2,taken:['a','b']})
 for(const raw of ['x','{}',JSON.stringify({version:1,day:-1,taken:[]}),JSON.stringify({version:1,day:1,taken:[1]})])expect(decodeForage(raw)).toBeNull()
})

it('F beside a spot picks it up after a moment: satchel, journal and save follow',async()=>{
 const {vi}=await import('vitest')
 const memory=new Map<string,string>()
 vi.stubGlobal('window',{location:{search:''},localStorage:{getItem:(k:string)=>memory.get(k)??null,setItem:(k:string,v:string)=>memory.set(k,v)}})
 vi.resetModules()
 const {useForestStore:s}=await import('./store'),{useInventoryStore:i,installInventory}=await import('./inventoryStore'),{forageStorageKey:key,spotsForDay:today}=await import('./forage')
 const stop=installInventory()
 const spot=today(0).find(x=>x.kind==='mushroom')!
 s.setState({location:'island',mode:'walking',position:{x:spot.x+.2,z:spot.z},nearby:null})
 s.getState().interact();expect(s.getState().mode).toBe('foraging')
 for(let k=0;k<30;k++)s.getState().tickForage(.05)
 expect(s.getState().mode).toBe('walking');expect(i.getState().inv.items.mushroom).toBe(1)
 expect(JSON.parse(memory.get(key)!).taken).toEqual([spot.id])
 // Gone for today: F there no longer starts picking it.
 s.getState().interact();expect(s.getState().mode).not.toBe('foraging')
 stop();vi.unstubAllGlobals()
})
