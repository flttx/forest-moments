import {beforeEach,afterEach,expect,it,vi} from 'vitest'
import {decodeJournal,drawPage,journalEvents,journalStorageKey,pageDone,recordEvents,stampFor,taskIds,taskTarget,turnPage,type JournalBook,type TaskId} from './journal'
import {beginFishing} from './fishing'
import type {SeatId,SeatSession} from './expansion'

let memory:Map<string,string>
beforeEach(()=>{vi.resetModules();memory=new Map();vi.stubGlobal('window',{location:{search:''},localStorage:{getItem:(k:string)=>memory.get(k)??null,setItem:(k:string,v:string)=>memory.set(k,v)}})})
afterEach(()=>vi.unstubAllGlobals())
const roomy={homeBook:{fish:[]}},full={homeBook:{fish:[1,2,3,4,5]}}
const book=(ids:TaskId[]):JournalBook=>({version:1,page:{number:1,tasks:ids.map(id=>({id,progress:0,doneAt:null}))},stamps:[]})

it('draws three different tasks it can offer, avoiding the last page where it can',()=>{
 for(let seed=0;seed<40;seed++){
  let n=seed;const random=()=>((n=n*16807%2147483647)/2147483647)||.5
  const page=drawPage(2,full,['catch','feed','row'],random),ids=page.tasks.map(t=>t.id)
  expect(new Set(ids).size).toBe(3)
  // A full tank takes no new fish; photos wait for photo mode; the last page's tasks are skipped while others remain.
  expect(ids.some(id=>['keep','photo','nightPhoto','catch','feed','row'].includes(id))).toBe(false)
 }
})
it('moves only matching tasks, accumulates metres and seconds, and stamps a page once all three are done',()=>{
 let b=book(['bigCatch','row','fireside'])
 let r=recordEvents(b,[{type:'catch',sizeCm:24}],'t1');expect(r.book).toBe(b)
 r=recordEvents(b,[{type:'row',meters:25},{type:'fireside',seconds:3}],'t2');b=r.book
 expect(b.page.tasks.map(t=>t.progress)).toEqual([0,25,3]);expect(r.finished).toEqual([])
 r=recordEvents(b,[{type:'row',meters:30}],'t3');b=r.book
 expect(b.page.tasks[1]).toEqual({id:'row',progress:taskTarget.row,doneAt:'t3'});expect(r.finished).toEqual(['row'])
 r=recordEvents(b,[{type:'fireside',seconds:6},{type:'catch',sizeCm:31}],'t4');b=r.book
 expect(r.finished.sort()).toEqual(['bigCatch','fireside']);expect(pageDone(b.page)).toBe(true)
 expect(b.stamps).toEqual([{page:1,stamp:stampFor(1),doneAt:'t4'}])
 // A full page records nothing more until it is turned, and only then.
 expect(recordEvents(b,[{type:'catch',sizeCm:40}],'t5').book).toBe(b)
 expect(turnPage(book(['catch','feed','sleep']),roomy)).toEqual(book(['catch','feed','sleep']))
 const next=turnPage(b,roomy,()=>.5)
 expect(next.page.number).toBe(2);expect(next.page.tasks.every(t=>t.progress===0&&!t.doneAt)).toBe(true);expect(next.stamps).toHaveLength(1)
})
it('turns game changes into journal entries',async()=>{
 const {useForestStore:s}=await import('./store'),base=s.getState()
 const fishing={...base,mode:'fishing' as const,fishing:{...beginFishing(()=>.9),phase:'landing' as const}}
 expect(journalEvents(fishing,{...fishing,fishing:{...fishing.fishing,phase:'caught' as const}})).toEqual([{type:'catch',sizeCm:fishing.fishing.sizeCm}])
 expect(journalEvents(base,{...base,farmBook:{version:1,meals:base.farmBook.meals+1}})).toEqual([{type:'feed'}])
 const rowing={...base,mode:'rowing' as const}
 expect(journalEvents(rowing,{...rowing,boat:{...rowing.boat,x:rowing.boat.x+.05}})[0]).toMatchObject({type:'row'})
 // A mooring reset is not rowing.
 expect(journalEvents(rowing,{...rowing,boat:{...rowing.boat,x:rowing.boat.x+6}})).toEqual([])
 const seat=(id:SeatId,elapsed:number,phase:SeatSession['phase']='idle'):SeatSession=>({id,phase,elapsed,returnPosition:{x:0,z:0}})
 const lit={...base,mode:'sitting' as const,homeBook:{...base.homeBook,fireLit:true}}
 expect(journalEvents({...lit,sitting:seat('camp-west',1)},{...lit,sitting:seat('camp-west',1.5)})).toEqual([{type:'fireside',seconds:.5}])
 expect(journalEvents({...base,sitting:seat('camp-west',1)},{...base,sitting:seat('camp-west',1.5)})).toEqual([])
 expect(journalEvents({...base,mode:'sitting',sitting:seat('coast',2,'down')},{...base,mode:'sitting',sitting:seat('coast',0)})).toEqual([{type:'seaside'}])
 expect(journalEvents(base,{...base,homeBook:{...base.homeBook,nights:base.homeBook.nights+1}})).toEqual([{type:'sleep'}])
})
it('restores a valid save and starts afresh from a broken one; a blocked save keeps the session going',async()=>{
 const saved=book(['catch','feed','sleep']);saved.page.tasks[0]={id:'catch',progress:1,doneAt:'2026-10-26T10:00:00Z'}
 expect(decodeJournal(JSON.stringify(saved))).toEqual(saved)
 for(const raw of ['bad','{}',JSON.stringify({...saved,page:{...saved.page,tasks:saved.page.tasks.slice(0,2)}}),JSON.stringify({...saved,page:{...saved.page,tasks:[...saved.page.tasks.slice(0,2),{id:'catch',progress:0,doneAt:null}]}}),JSON.stringify({...saved,page:{...saved.page,tasks:[{id:'row',progress:99,doneAt:null},...saved.page.tasks.slice(1)]}})])
  expect(decodeJournal(raw)).toBeNull()
 memory.set(journalStorageKey,JSON.stringify(saved))
 const {useJournalStore:j}=await import('./journalStore'),{useForestStore:s}=await import('./store')
 expect(j.getState().book).toEqual(saved)
 window.localStorage.setItem=()=>{throw Error('denied')}
 j.getState().record([{type:'feed'}])
 expect(j.getState().book.page.tasks[1].doneAt).not.toBeNull();expect(s.getState().messageKind).toBe('error')
 expect(taskIds).toHaveLength(12)
})
