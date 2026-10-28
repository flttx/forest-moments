import {create} from 'zustand'
import {t} from '../i18n'
import {useForestStore} from './store'
import {useJournalStore} from './journalStore'
import {useUiStore} from './uiStore'
import {madeOf} from './recipes'
import {closeSeason,decodeSeasons,seasonsStorageKey,startBook,type SeasonBook,type Tally} from './seasons'

/** The island's running totals right now. */
export function tallyNow():Tally{
 const s=useForestStore.getState()
 return{fish:s.fishBook.count,meals:s.farmBook.meals,stamps:useJournalStore.getState().book.stamps.length,crafted:madeOf(s.workshopBook).length,
  secrets:Object.keys(s.secretsBook.found).length,trees:s.garden.trees.length}
}

type SeasonState={book:SeasonBook|null;/** The recap open in the season panel, by index. */viewing:number;view:(index:number)=>void}
export const useSeasonStore=create<SeasonState>(set=>({book:null,viewing:0,view:viewing=>set({viewing})}))

let warned=false
function save(book:SeasonBook){
 try{window.localStorage.setItem(seasonsStorageKey,JSON.stringify(book))}
 catch{if(!warned){warned=true;useForestStore.setState({message:t('season.unsaved'),messageKind:'error'})}}
}

/** Keeps the season snapshot and opens the recap on the first morning of a new season. Returns the cleanup. */
export function installSeasons(){
 const day=useForestStore.getState().homeBook.nights
 let saved:SeasonBook|null=null
 try{saved=decodeSeasons(window.localStorage.getItem(seasonsStorageKey))}catch{/* blocked storage: start afresh */}
 // A save from a later day than the island's (the home save was reset) starts over from today.
 const book=saved&&saved.start.day<=day?saved:startBook(day,tallyNow())
 useSeasonStore.setState({book,viewing:Math.max(0,book.recaps.length-1)})
 save(book)
 return useForestStore.subscribe((next,prev)=>{
  if(next.homeBook.nights<=prev.homeBook.nights)return
  const current=useSeasonStore.getState().book;if(!current)return
  const {book,recap}=closeSeason(current,next.homeBook.nights,tallyNow())
  if(!recap)return
  save(book)
  useSeasonStore.setState({book,viewing:book.recaps.length-1})
  useUiStore.getState().openPanel('season')
 })
}
