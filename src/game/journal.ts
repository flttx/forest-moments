import type {useForestStore} from './store'

/**
 * The island journal (docs/JOURNAL_PHOTO_PLAN.md §2): pages of three small things to do with the island's existing
 * play. Pure rules and data; journalStore keeps the page, saves it and reacts to the game.
 */
export const journalStorageKey='forest-moments:journal:v1'
export const taskIds=['catch','bigCatch','keep','feed','fireside','seaside','lookout','row','sleep','photo','nightPhoto','tree'] as const
export type TaskId=typeof taskIds[number]
export const stampIds=['pine','koi','flame','feather','boat','moon'] as const
export type StampId=typeof stampIds[number]
export interface JournalTask{id:TaskId;progress:number;doneAt:string|null}
export interface JournalBook{version:1;page:{number:number;tasks:JournalTask[]};stamps:{page:number;stamp:StampId;doneAt:string}[]}

/** How much of each thing completes it: seconds by the fire, metres rowed, otherwise once. */
export const taskTarget:Record<TaskId,number>={catch:1,bigCatch:1,keep:1,feed:1,fireside:8,seaside:1,lookout:1,row:40,sleep:1,photo:1,nightPhoto:1,tree:1}
export const tasksPerPage=3
/** Photo tasks join the pool once photo mode exists (plan stage P1). */
export const photoModeReady=false

export type JournalEvent=
 {type:'catch';sizeCm:number}|{type:'keep'}|{type:'feed'}|{type:'fireside';seconds:number}|{type:'seaside'}
 |{type:'lookout'}|{type:'row';meters:number}|{type:'sleep'}|{type:'photo';night:boolean}|{type:'tree'}

type State=ReturnType<typeof useForestStore.getState>
const campSeats=['camp-west','camp-south','camp-east'],seaSeats=['coast','reef']

/** Things worth writing down in a change of the game state (prev → next). */
export function journalEvents(prev:State,next:State):JournalEvent[]{
 const events:JournalEvent[]=[]
 if(next.fishing?.phase==='caught'&&prev.fishing?.phase!=='caught')events.push({type:'catch',sizeCm:next.fishing.sizeCm})
 if(next.homeBook.fish.length>prev.homeBook.fish.length)events.push({type:'keep'})
 if(next.farmBook.meals>prev.farmBook.meals)events.push({type:'feed'})
 const seat=next.sitting
 if(seat?.phase==='idle'&&prev.sitting?.phase==='idle'&&prev.sitting.id===seat.id&&campSeats.includes(seat.id)&&next.homeBook.fireLit&&seat.elapsed>prev.sitting.elapsed)
  events.push({type:'fireside',seconds:seat.elapsed-prev.sitting.elapsed})
 if(seat?.phase==='idle'&&prev.sitting?.phase!=='idle'&&seaSeats.includes(seat.id))events.push({type:'seaside'})
 if(next.mode==='lookout'&&prev.mode!=='lookout')events.push({type:'lookout'})
 // Boat steps are a few centimetres a frame; a larger jump is a reset (landing, mooring), not rowing.
 if(next.mode==='rowing'&&prev.mode==='rowing'){const meters=Math.hypot(next.boat.x-prev.boat.x,next.boat.z-prev.boat.z);if(meters>0&&meters<1)events.push({type:'row',meters})}
 if(next.homeBook.nights>prev.homeBook.nights)events.push({type:'sleep'})
 if((next.planted&&!prev.planted)||(next.inspectingTree&&!prev.inspectingTree))events.push({type:'tree'})
 return events
}

/** How far an event moves a task (0 when unrelated). */
export function taskStep(id:TaskId,e:JournalEvent){
 switch(id){
  case 'catch':return e.type==='catch'?1:0
  case 'bigCatch':return e.type==='catch'&&e.sizeCm>=30?1:0
  case 'fireside':return e.type==='fireside'?e.seconds:0
  case 'row':return e.type==='row'?e.meters:0
  case 'photo':return e.type==='photo'?1:0
  case 'nightPhoto':return e.type==='photo'&&e.night?1:0
  default:return e.type===id?1:0
 }
}

/** Whether the player could do it right now: a full tank takes no new fish, photos wait for photo mode. */
export function taskAvailable(id:TaskId,s:{homeBook:{fish:unknown[]}}){
 if(id==='keep')return s.homeBook.fish.length<5
 if(id==='photo'||id==='nightPhoto')return photoModeReady
 return true
}

/** Three different available tasks, preferring ones the last page did not ask for. */
export function drawPage(number:number,s:{homeBook:{fish:unknown[]}},last:readonly TaskId[]=[],random=Math.random){
 const pool=taskIds.filter(id=>taskAvailable(id,s)),fresh=pool.filter(id=>!last.includes(id)),picks:TaskId[]=[]
 for(const source of [fresh,pool])while(picks.length<tasksPerPage){
  const left=source.filter(id=>!picks.includes(id));if(!left.length)break
  picks.push(left[Math.floor(random()*left.length)])
 }
 return{number,tasks:picks.map(id=>({id,progress:0,doneAt:null}))}
}

export const pageDone=(page:JournalBook['page'])=>page.tasks.every(t=>t.doneAt!==null)
/** Stamps rotate through the six designs by page. */
export const stampFor=(page:number):StampId=>stampIds[(page-1)%stampIds.length]

/** Applies events to the page; returns the same book when nothing moved, and the tasks finished by these events. */
export function recordEvents(book:JournalBook,events:readonly JournalEvent[],now:string):{book:JournalBook;finished:TaskId[]}{
 if(!events.length||pageDone(book.page))return{book,finished:[]}
 const finished:TaskId[]=[]
 let changed=false
 const tasks=book.page.tasks.map(t=>{
  if(t.doneAt)return t
  const step=events.reduce((n,e)=>n+taskStep(t.id,e),0)
  if(step<=0)return t
  changed=true
  const progress=Math.min(taskTarget[t.id],t.progress+step),done=progress>=taskTarget[t.id]
  if(done)finished.push(t.id)
  return{...t,progress,doneAt:done?now:null}
 })
 if(!changed)return{book,finished}
 const page={...book.page,tasks}
 // The stamp goes on as soon as the last task is done; turning the page is the player's choice.
 const stamps=pageDone(page)?[...book.stamps,{page:page.number,stamp:stampFor(page.number),doneAt:now}]:book.stamps
 return{book:{...book,page,stamps},finished}
}

export function turnPage(book:JournalBook,s:{homeBook:{fish:unknown[]}},random=Math.random):JournalBook{
 if(!pageDone(book.page))return book
 return{...book,page:drawPage(book.page.number+1,s,book.page.tasks.map(t=>t.id),random)}
}

export function decodeJournal(raw:string|null):JournalBook|null{
 try{
  const b=JSON.parse(raw??'null')
  if(b?.version!==1||!Number.isSafeInteger(b.page?.number)||b.page.number<1||!Array.isArray(b.page.tasks)||b.page.tasks.length!==tasksPerPage||!Array.isArray(b.stamps))return null
  const ids=new Set<string>()
  for(const t of b.page.tasks){
   if(!taskIds.includes(t?.id)||ids.has(t.id)||!Number.isFinite(t.progress)||t.progress<0||t.progress>taskTarget[t.id as TaskId]||(t.doneAt!==null&&typeof t.doneAt!=='string'))return null
   ids.add(t.id)
  }
  if(b.stamps.some((s:{page:unknown;stamp:unknown;doneAt:unknown})=>!Number.isSafeInteger(s?.page)||!stampIds.includes(s.stamp as StampId)||typeof s.doneAt!=='string'))return null
  return{version:1,page:{number:b.page.number,tasks:b.page.tasks.map((t:JournalTask)=>({id:t.id,progress:t.progress,doneAt:t.doneAt}))},stamps:b.stamps}
 }catch{return null}
}
