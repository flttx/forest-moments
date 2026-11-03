import {expect,it} from 'vitest'
import {availableSpots,decodeForage,onSand,emptyForage,forageKinds,forageSpots,forageRegions,regionQuota,perDay,spotNear,spotsForDay,takeSpot,type ForageKind} from './forage'
import {rainMushrooms} from './weather'
import {mistRadius} from '../world/mistIsland'
import {autumnRadius} from '../world/autumnIsland'
import {tideRadius} from '../world/tideIsland'
import {canStandAt} from './movement'
import {weatherFor} from './weather'

it('has room on the island for every kind, each on standable ground and apart',()=>{
 for(const kind of forageKinds)expect(forageSpots.filter(s=>s.kind===kind).length).toBeGreaterThanOrEqual(perDay[kind]*2)
 for(const s of forageSpots)expect(canStandAt(s.x,s.z)).toBe(true)
 // Main island: woodland finds stay off the sand; shells are only on it.
 for(const s of forageSpots.filter(s=>s.region==='main'))expect(onSand(s.x,s.z)).toBe(s.kind==='shell')
 // Each neighbour keeps its own finds on its own ground, with room for at least two days' worth.
 const on={main:()=>true,mist:(x:number,z:number)=>mistRadius(x,z)<1,autumn:(x:number,z:number)=>autumnRadius(x,z)<1,tide:(x:number,z:number)=>tideRadius(x,z)<1.1}
 for(const region of forageRegions)for(const [kind,n] of Object.entries(regionQuota[region])){
  const spots=forageSpots.filter(s=>s.region===region&&s.kind===kind)
  expect(spots.length,`${region} ${kind}`).toBeGreaterThanOrEqual((n??0)*2)
  for(const s of spots)expect(on[region](s.x,s.z)).toBe(true)
 }
 expect(new Set(forageSpots.map(s=>s.id)).size).toBe(forageSpots.length)
})
it('offers a fixed handful per day, different from day to day',()=>{
 // Two dry days: rain brings up extra mushrooms (tier1Weather.test.ts).
 const [d,e]=Array.from({length:40},(_,i)=>i+1).filter(n=>weatherFor(n)!=='rain')
 const a=spotsForDay(d),b=spotsForDay(d),c=spotsForDay(e)
 expect(a).toEqual(b)
 for(const kind of forageKinds)expect(a.filter(s=>s.kind===kind)).toHaveLength(perDay[kind])
 expect(a.map(s=>s.id)).not.toEqual(c.map(s=>s.id))
})
it('draws each region on its own, leaving the main island exactly as it was before the islands had finds',()=>{
 // The pre-island draw: one seed, the four home kinds in order, over the main island's spots only.
 const legacy=(day:number)=>{
  let n=((day+17)*2654435761)%4294967296||1;const random=()=>((n=(n*1664525+1013904223)%4294967296)/4294967296)
  const rain=weatherFor(day)==='rain',out:string[]=[]
  for(const kind of ['mushroom','berry','shell','pinecone'] as ForageKind[]){
   const pool=forageSpots.filter(s=>s.region==='main'&&s.kind===kind),count=kind==='mushroom'&&rain?rainMushrooms:regionQuota.main[kind]??0
   for(let i=0;i<count&&pool.length;i++)out.push(pool.splice(Math.floor(random()*pool.length),1)[0].id)
  }
  return out
 }
 for(let day=0;day<30;day++){
  const today=spotsForDay(day),rain=weatherFor(day)==='rain'
  expect(today.filter(s=>s.region==='main').map(s=>s.id)).toEqual(legacy(day))
  expect(today.filter(s=>s.region==='mist'&&s.kind==='mistcap')).toHaveLength((regionQuota.mist.mistcap??0)+(rain?2:0))
  expect(today.filter(s=>s.region==='tide'&&s.kind==='shell')).toHaveLength(regionQuota.tide.shell??0)
  expect(today.filter(s=>s.kind==='seaGlass')).toHaveLength(regionQuota.tide.seaGlass??0)
 }
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
it('F on the neighbour islands gathers their own finds into the satchel, and a reload keeps them gone for the day',async()=>{
 const {vi}=await import('vitest')
 const memory=new Map<string,string>()
 vi.stubGlobal('window',{location:{search:''},localStorage:{getItem:(k:string)=>memory.get(k)??null,setItem:(k:string,v:string)=>memory.set(k,v)}})
 vi.resetModules()
 const {useForestStore:s}=await import('./store'),{useInventoryStore:i,installInventory}=await import('./inventoryStore'),{forageStorageKey:key,spotsForDay:today}=await import('./forage')
 const stop=installInventory(),picked:string[]=[]
 for(const [region,kind] of [['mist','mistcap'],['autumn','mapleLeaf'],['autumn','birchBark'],['tide','shell']] as const){
  const spot=today(0).find(x=>x.region===region&&x.kind===kind)!
  s.setState({location:'island',mode:'walking',position:{x:spot.x+.2,z:spot.z},nearby:null})
  s.getState().interact();expect(s.getState().mode,`${region} ${kind}`).toBe('foraging')
  for(let k=0;k<30;k++)s.getState().tickForage(.05)
  picked.push(spot.id)
 }
 expect(i.getState().inv.items).toMatchObject({mistcap:1,mapleLeaf:1,birchBark:1,shell:1})
 expect(JSON.parse(memory.get(key)!).taken).toEqual(picked)
 stop();vi.unstubAllGlobals()
 // A fresh load of the same day still has them picked.
 vi.resetModules()
 vi.stubGlobal('window',{location:{search:''},localStorage:{getItem:(k:string)=>memory.get(k)??null,setItem:(k:string,v:string)=>memory.set(k,v)}})
 const {useForestStore:again}=await import('./store'),{availableSpots}=await import('./forage')
 expect(availableSpots(again.getState().forageBook,0).map(x=>x.id)).not.toContain(picked[0])
 vi.unstubAllGlobals()
})
