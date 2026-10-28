import {afterEach,beforeEach,expect,it,vi} from 'vitest'
import {closeSeason,decodeSeasons,inRecap,recapLimit,seasonsStorageKey,startBook,tallyDelta,type Tally} from './seasons'

const tally=(n:Partial<Tally>={}):Tally=>({fish:0,meals:0,stamps:0,crafted:0,secrets:0,trees:0,...n})

it('closes a season only on the first morning of the next one, counting what happened in between',()=>{
 const book=startBook(1,tally({fish:3,meals:1}))
 expect(closeSeason(book,3,tally({fish:9})).recap).toBeNull()
 const {book:next,recap}=closeSeason(book,4,tally({fish:7,meals:2,stamps:1}))
 expect(recap).toEqual({season:'spring',startDay:1,endDay:4,tally:tally({fish:4,meals:1,stamps:1})})
 expect(next.start).toEqual({day:4,tally:tally({fish:7,meals:2,stamps:1})})
 // The summer then runs from day 4; autumn from day 8.
 expect(closeSeason(next,8,tally({fish:7})).recap?.season).toBe('summer')
})

it('never counts a total that went down, and keeps only the newest recaps',()=>{
 expect(tallyDelta(tally({fish:5}),tally({fish:2,trees:1}))).toEqual(tally({trees:1}))
 let book=startBook(0,tally())
 for(let d=4;d<=4*(recapLimit+3);d+=4)book=closeSeason(book,d,tally()).book
 expect(book.recaps).toHaveLength(recapLimit)
 expect(book.recaps.at(-1)?.endDay).toBe(4*(recapLimit+3))
})

it('places photos by the island day they were taken; older photos without one are left out',()=>{
 const r={season:'summer' as const,startDay:4,endDay:8,tally:tally()}
 expect([3,4,7,8,undefined].map(d=>inRecap(r,d))).toEqual([false,true,true,false,false])
})

it('reads back a valid book and rejects broken ones',()=>{
 const {book}=closeSeason(startBook(0,tally({fish:1})),4,tally({fish:2}))
 expect(decodeSeasons(JSON.stringify(book))).toEqual(book)
 for(const bad of ['{',JSON.stringify({...book,version:2}),JSON.stringify({...book,start:{day:-1,tally:tally()}}),
  JSON.stringify({...book,recaps:[{...book.recaps[0],season:'winter'}]}),JSON.stringify({...book,recaps:[{...book.recaps[0],endDay:9}]}),
  JSON.stringify({...book,start:{day:4,tally:{...tally(),fish:1.5}}})])expect(decodeSeasons(bad)).toBeNull()
})

let memory:Map<string,string>
beforeEach(()=>{vi.resetModules();memory=new Map();vi.stubGlobal('window',{location:{search:''},localStorage:{getItem:(k:string)=>memory.get(k)??null,setItem:(k:string,v:string)=>memory.set(k,v)}})})
afterEach(()=>vi.unstubAllGlobals())

it('waking into a new season saves a recap of the old one and opens it',async()=>{
 const {useForestStore:s}=await import('./store'),{installSeasons,useSeasonStore}=await import('./seasonStore'),{useUiStore:ui}=await import('./uiStore')
 s.setState({homeBook:{...s.getState().homeBook,nights:2},fishBook:{...s.getState().fishBook,count:1}})
 const stop=installSeasons()
 expect(JSON.parse(memory.get(seasonsStorageKey)!).start).toMatchObject({day:2,tally:{fish:1}})
 s.setState({fishBook:{...s.getState().fishBook,count:4},homeBook:{...s.getState().homeBook,nights:3}})
 expect(ui.getState().panel).toBeNull()
 s.setState({homeBook:{...s.getState().homeBook,nights:4}})
 expect(ui.getState().panel).toBe('season')
 expect(useSeasonStore.getState().book?.recaps).toEqual([{season:'spring',startDay:2,endDay:4,tally:tally({fish:3})}])
 expect(decodeSeasons(memory.get(seasonsStorageKey)!)?.recaps).toHaveLength(1)
 stop()
})
