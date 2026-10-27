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
export interface JournalStamp{page:number;stamp:StampId;doneAt:string;tasks?:JournalTask[]}
export interface JournalBook{version:1;page:{number:number;tasks:JournalTask[]};stamps:JournalStamp[]}

/** How much of each thing completes it: seconds by the fire, metres rowed, otherwise once. */
export const taskTarget:Record<TaskId,number>={catch:1,bigCatch:1,keep:1,feed:1,fireside:8,seaside:1,lookout:1,row:40,sleep:1,photo:1,nightPhoto:1,tree:1}
export const tasksPerPage=3
/** Photo tasks are in the pool: photo mode exists (plan stage P1). */
export const photoModeReady=true

export type JournalEvent=
 {type:'catch';sizeCm:number}|{type:'keep'}|{type:'feed'}|{type:'fireside';seconds:number}|{type:'seaside'}
 |{type:'lookout'}|{type:'row';meters:number}|{type:'sleep'}|{type:'photo';night:boolean}|{type:'tree'}
 |{type:'reset';task:'row'|'fireside'}

type State=ReturnType<typeof useForestStore.getState>
const campSeats=['camp-west','camp-south','camp-east'],seaSeats=['coast','reef']
const atFire=(s:State)=>s.mode==='sitting'&&s.sitting?.phase==='idle'&&campSeats.includes(s.sitting.id)&&s.homeBook.fireLit

/** Things worth writing down in a change of the game state (prev → next). */
export function journalEvents(prev:State,next:State):JournalEvent[]{
 const events:JournalEvent[]=[]
 if(next.fishing?.phase==='caught'&&prev.fishing?.phase!=='caught')events.push({type:'catch',sizeCm:next.fishing.sizeCm})
 if(next.homeBook.fish.length>prev.homeBook.fish.length)events.push({type:'keep'})
 if(next.farmBook.meals>prev.farmBook.meals)events.push({type:'feed'})
 const seat=next.sitting
 const sameFire=atFire(prev)&&atFire(next)&&prev.sitting?.id===seat?.id
 if(atFire(prev)&&!sameFire)events.push({type:'reset',task:'fireside'})
 if(sameFire&&seat&&prev.sitting&&!next.menuPaused&&seat.elapsed>prev.sitting.elapsed)
  events.push({type:'fireside',seconds:seat.elapsed-prev.sitting.elapsed})
 if(seat?.phase==='idle'&&prev.sitting?.phase!=='idle'&&seaSeats.includes(seat.id))events.push({type:'seaside'})
 if(next.mode==='lookout'&&prev.mode!=='lookout')events.push({type:'lookout'})
 // Boat steps are a few centimetres a frame; a larger jump is a reset (landing, mooring), not rowing.
 if(prev.mode==='rowing'&&next.mode!=='rowing')events.push({type:'reset',task:'row'})
 if(next.mode==='rowing'&&prev.mode==='rowing'&&!next.menuPaused&&!next.boatTransfer){const meters=Math.hypot(next.boat.x-prev.boat.x,next.boat.z-prev.boat.z);if(meters>0&&meters<1)events.push({type:'row',meters})}
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

/** Whether the player could do it right now: a full tank takes no new fish, . */
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
  // Resets end only unfinished attempts; a completed task remains on the page.
  const progress=events.reduce((n,e)=>e.type==='reset'&&e.task===t.id?0:Math.min(taskTarget[t.id],n+taskStep(t.id,e)),t.progress)
  if(progress===t.progress)return t
  changed=true
  const done=progress>=taskTarget[t.id]
  if(done)finished.push(t.id)
  return{...t,progress,doneAt:done?now:null}
 })
 if(!changed)return{book,finished}
 const page={...book.page,tasks}
 // The stamp goes on as soon as the last task is done; turning the page is the player's choice.
 const stamps=pageDone(page)?[...book.stamps,{page:page.number,stamp:stampFor(page.number),doneAt:now,tasks:tasks.map(t=>({...t}))}]:book.stamps
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
  const validDate=(s:unknown)=>typeof s==='string'&&Number.isFinite(Date.parse(s))
  const validTasks=(tasks:JournalTask[])=>Array.isArray(tasks)&&tasks.length===tasksPerPage&&new Set(tasks.map(t=>t?.id)).size===tasksPerPage&&tasks.every(t=>
   t&&taskIds.includes(t.id)&&Number.isFinite(t.progress)&&t.progress>=0&&t.progress<=taskTarget[t.id]&&(t.doneAt===null?t.progress<taskTarget[t.id]:validDate(t.doneAt)&&t.progress===taskTarget[t.id]))
  if(!validTasks(b.page.tasks))return null
  const stamps:JournalStamp[]=b.stamps
  if(stamps.some((s,i)=>!s||!Number.isSafeInteger(s.page)||s.page!==i+1||s.page>b.page.number||s.stamp!==stampFor(s.page)||!validDate(s.doneAt)||
   (s.tasks!==undefined&&(!validTasks(s.tasks)||s.tasks.some(t=>t.doneAt===null)))))return null
  const full=pageDone(b.page)
  if(stamps.length!==b.page.number-(full?0:1))return null
  const tasks=b.page.tasks.map((t:JournalTask)=>({id:t.id,progress:!t.doneAt&&(t.id==='row'||t.id==='fireside')?0:t.progress,doneAt:t.doneAt}))
  // Old v1 saves only retained stamps. Preserve those; recover details only for the current page we still have.
  return{version:1,page:{number:b.page.number,tasks},stamps:stamps.map(s=>({page:s.page,stamp:s.stamp,doneAt:s.doneAt,
   ...(s.tasks?{tasks:s.tasks.map(t=>({...t}))}:s.page===b.page.number&&full?{tasks:tasks.map((t:JournalTask)=>({...t}))}:{})}))}
 }catch{return null}
}
