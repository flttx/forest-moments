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
 expect(b.stamps).toEqual([{page:1,stamp:stampFor(1),doneAt:'t4',tasks:b.page.tasks}])
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

const now='2026-10-26T14:00:00Z'
it('starts a new outing or fireside attempt without erasing completed tasks',async()=>{
 const {useForestStore:s}=await import('./store'),base=s.getState()
 const rowing={...base,mode:'rowing' as const}
 const camp={...base,mode:'sitting' as const,homeBook:{...base.homeBook,fireLit:true},sitting:{id:'camp-west' as const,phase:'idle' as const,elapsed:4,returnPosition:{x:0,z:0}}}
 let b=recordEvents(book(['row','fireside','tree']),[{type:'row',meters:25},{type:'fireside',seconds:4}],now).book
 const leftBoat=journalEvents(rowing,base),leftFire=journalEvents(camp,{...camp,sitting:{...camp.sitting,phase:'up'}})
 expect(leftBoat).toContainEqual({type:'reset',task:'row'})
 expect(leftFire).toContainEqual({type:'reset',task:'fireside'})
 expect(journalEvents(camp,{...camp,homeBook:{...camp.homeBook,fireLit:false}})).toContainEqual({type:'reset',task:'fireside'})
 expect(journalEvents(camp,{...camp,sitting:{...camp.sitting,id:'camp-east'}})).toContainEqual({type:'reset',task:'fireside'})
 b=recordEvents(b,[...leftBoat,...leftFire],now).book
 expect(b.page.tasks.map(t=>t.progress)).toEqual([0,0,0])
 b=recordEvents(b,[{type:'row',meters:20},{type:'fireside',seconds:4}],now).book
 expect(b.page.tasks.every(t=>!t.doneAt)).toBe(true)
 expect(journalEvents(camp,{...camp,menuPaused:true,sitting:{...camp.sitting,elapsed:6}})).toEqual([])
 expect(journalEvents(rowing,{...rowing,menuPaused:true,boat:{...rowing.boat,x:rowing.boat.x+.1}})).toEqual([])
 b=recordEvents(b,[{type:'row',meters:20},{type:'fireside',seconds:4}],now).book
 const done=recordEvents(b,[...leftBoat,...leftFire],now)
 expect(done.book).toBe(b)
 expect(done.finished).toEqual([])
})
it('keeps full historical pages through turns and reloads; preserves legacy stamps without inventing tasks',()=>{
 const filled=recordEvents(book(['tree','lookout','feed']),[{type:'tree'},{type:'lookout'},{type:'feed'}],now).book
 const next=turnPage(filled,roomy,()=>.5),saved=decodeJournal(JSON.stringify(next))!
 expect(saved.stamps[0].tasks).toEqual(filled.page.tasks)
 expect(saved.page.number).toBe(2)
 expect(saved.page.tasks.every(t=>!t.doneAt)).toBe(true)
 const old={...next,stamps:[{page:1,stamp:stampFor(1),doneAt:now}]}
 expect(decodeJournal(JSON.stringify(old))!.stamps[0].tasks).toBeUndefined()
 const oldCurrent={...filled,stamps:old.stamps}
 expect(decodeJournal(JSON.stringify(oldCurrent))!.stamps[0].tasks).toEqual(filled.page.tasks)
 for(const stamps of [[...next.stamps,...next.stamps],[{...next.stamps[0],page:-1}],[{...next.stamps[0],doneAt:'bad'}],[{...next.stamps[0],tasks:book(['tree','lookout','feed']).page.tasks}]])
  expect(decodeJournal(JSON.stringify({...next,stamps}))).toBeNull()
})
it('resets unfinished session counters on reload but keeps completed tasks',()=>{
 let b=recordEvents(book(['row','fireside','tree']),[{type:'row',meters:12},{type:'fireside',seconds:4},{type:'tree'}],now).book
 expect(decodeJournal(JSON.stringify(b))!.page.tasks.map(t=>t.progress)).toEqual([0,0,1])
 b=recordEvents(b,[{type:'row',meters:28}],now).book
 expect(decodeJournal(JSON.stringify(b))!.page.tasks.map(t=>t.progress)).toEqual([40,0,1])
})
it('saves the initial page, achievements and page turns, with no per-frame writes',async()=>{
 memory.set(journalStorageKey,JSON.stringify(book(['row','fireside','tree'])))
 const {useJournalStore:j,installJournal}=await import('./journalStore')
 const write=vi.spyOn(window.localStorage,'setItem')
 const stop=installJournal()
 try{
  expect(write.mock.calls.filter(c=>c[0]===journalStorageKey)).toHaveLength(1)
  for(let i=0;i<100;i++)j.getState().record([{type:'row',meters:.1},{type:'fireside',seconds:.02}])
  expect(write.mock.calls.filter(c=>c[0]===journalStorageKey)).toHaveLength(1)
  j.getState().record([{type:'tree'}])
  expect(write.mock.calls.filter(c=>c[0]===journalStorageKey)).toHaveLength(2)
  expect(decodeJournal(memory.get(journalStorageKey)!)!.page.tasks.map(t=>t.progress)).toEqual([0,0,1])
  j.getState().record([{type:'row',meters:40},{type:'fireside',seconds:8}])
  expect(write.mock.calls.filter(c=>c[0]===journalStorageKey)).toHaveLength(3)
  j.getState().turn()
  expect(write.mock.calls.filter(c=>c[0]===journalStorageKey)).toHaveLength(4)
  expect(decodeJournal(memory.get(journalStorageKey)!)!.page.number).toBe(2)
 }finally{stop()}
})
it('credits every available task from the corresponding event and protects unrelated tasks',()=>{
 const cases:[TaskId,Parameters<typeof recordEvents>[1][number]][]=[
  ['catch',{type:'catch',sizeCm:20}],['bigCatch',{type:'catch',sizeCm:30}],['keep',{type:'keep'}],['feed',{type:'feed'}],
  ['fireside',{type:'fireside',seconds:8}],['seaside',{type:'seaside'}],['lookout',{type:'lookout'}],['row',{type:'row',meters:40}],
  ['sleep',{type:'sleep'}],['tree',{type:'tree'}],['photo',{type:'photo',night:false}],['nightPhoto',{type:'photo',night:true}],
 ]
 for(const [id,event] of cases){
  const other=taskIds.filter(t=>t!==id&&t!=='catch'&&t!=='bigCatch'&&t!=='photo'&&t!=='nightPhoto').slice(0,2)
  const result=recordEvents(book([id,...other]),[event],now)
  expect(result.book.page.tasks[0].doneAt).toBe(now)
  expect(result.finished).toEqual([id])
 }
})
