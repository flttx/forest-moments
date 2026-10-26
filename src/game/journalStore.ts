import {create} from 'zustand'
import {t,type Key} from '../i18n'
import {useForestStore} from './store'
import {playSound} from '../audio/audioStore'
import {decodeJournal,drawPage,journalEvents,journalStorageKey,pageDone,recordEvents,turnPage,type JournalBook,type JournalEvent} from './journal'

function load():JournalBook{
 let saved:JournalBook|null=null
 try{saved=decodeJournal(window.localStorage.getItem(journalStorageKey))}catch{/* blocked storage: a fresh page */}
 return saved??{version:1,page:drawPage(1,useForestStore.getState()),stamps:[]}
}

type JournalState={book:JournalBook;record:(events:readonly JournalEvent[])=>void;turn:()=>void}
let warned=false
function save(book:JournalBook){
 try{window.localStorage.setItem(journalStorageKey,JSON.stringify(book))}
 catch{
  // Play goes on for this visit; say so once rather than on every tick.
  if(!warned){warned=true;useForestStore.setState({message:t('journal.unsaved'),messageKind:'error'})}
 }
}
/** A short note for a finished task, unless an error is already waiting to be read. */
function note(message:string){const s=useForestStore.getState();if(!(s.message&&s.messageKind==='error'))useForestStore.setState({message,messageKind:'info'})}

export const useJournalStore=create<JournalState>((set,get)=>({
 book:typeof window==='undefined'?{version:1,page:{number:1,tasks:[]},stamps:[]}:load(),
 record:events=>{
  const before=get().book,{book,finished}=recordEvents(before,events,new Date().toISOString())
  if(book===before)return
  set({book})
  // Metres and seconds belong to the current outing/sitting. Persist achievements, not every frame.
  if(finished.length)save(book)
  if(!finished.length)return
  if(pageDone(book.page)){playSound('craft',{volume:.9});note(t('journal.pageDone',{n:book.page.number}))}
  else{playSound('task-done',{volume:.8});note(t('journal.taskDone',{task:t(`journal.task.${finished[0]}` as Key)}))}
 },
 turn:()=>{
  const book=turnPage(get().book,useForestStore.getState());if(book===get().book)return
  set({book});save(book);playSound('page',{volume:.8})
 },
}))

/** Writes down what happens on the island as it happens. Returns the cleanup. */
export function installJournal(){
 // Save the freshly drawn page immediately, including when the player refreshes before doing a task.
 save(useJournalStore.getState().book)
 return useForestStore.subscribe((next,prev)=>{const events=journalEvents(prev,next);if(events.length)useJournalStore.getState().record(events)})
}
