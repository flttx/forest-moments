import {create} from 'zustand'
import {t} from '../i18n'
import {useForestStore} from './store'
import {useJournalStore} from './journalStore'
import {playSound} from '../audio/audioStore'
import {filterUnlock,frameUnlock,looksUnlocked,photoBlock,photoFileName,type FilterId,type FrameId} from './photo'
import {composeFrame} from './photoFrame'
import {makeThumb,savePhoto} from './photoAlbum'

type Light=ReturnType<typeof useForestStore.getState>['timeOfDay']
export interface LastShot{id:string;url:string;name:string;saved:boolean}

type PhotoState={
 active:boolean
 hideRaccoon:boolean
 filter:FilterId
 frame:FrameId
 /** The light the player was in before previewing another one; restored on leaving. */
 restoreLight:Light|null
 /** Set by the shutter, taken by the scene on its next frame (the canvas is read right after it renders). */
 pending:boolean
 flash:number
 /** Bumped whenever the album changes so an open album reloads. */
 albumVersion:number
 last:LastShot|null
 enter:()=>void
 exit:()=>void
 toggleHideRaccoon:()=>void
 setFilter:(id:FilterId)=>void
 setFrame:(id:FrameId)=>void
 setLight:(light:Light)=>void
 shutter:()=>void
 takePending:()=>boolean
 finish:(blob:Blob|null,width:number,height:number)=>Promise<void>
 dismissLast:()=>void
}

/** Stamped journal pages: each one unlocks the next look. */
export const pagesFilled=()=>useJournalStore.getState().book.stamps.length
const say=(message:string,kind:'info'|'error'='info')=>useForestStore.setState({message,messageKind:kind})
const forget=(shot:LastShot|null)=>{if(shot)URL.revokeObjectURL(shot.url)}

export const usePhotoStore=create<PhotoState>((set,get)=>({
 active:false,hideRaccoon:false,filter:'plain',frame:'none',restoreLight:null,pending:false,flash:0,albumVersion:0,last:null,
 enter:()=>{
  const forest=useForestStore.getState()
  if(get().active)return
  const block=photoBlock(forest)
  if(block){if(block!=='menu')say(t(block==='busy'?'photo.busy':'photo.transition'));return}
  if(document.activeElement instanceof HTMLElement)document.activeElement.blur()
  forest.reel(false)
  useForestStore.setState({menuPaused:true,message:''})
  set({active:true,restoreLight:forest.timeOfDay,pending:false})
  playSound('ui-open',{volume:.7})
 },
 exit:()=>{
  const {active,restoreLight,last}=get()
  if(!active)return
  forget(last)
  useForestStore.setState({menuPaused:false,...(restoreLight?{timeOfDay:restoreLight}:{})})
  set({active:false,hideRaccoon:false,filter:'plain',frame:'none',restoreLight:null,pending:false,last:null})
  playSound('ui-close',{volume:.7})
 },
 toggleHideRaccoon:()=>{if(get().active)set({hideRaccoon:!get().hideRaccoon})},
 setFilter:id=>{if(get().active&&looksUnlocked(pagesFilled(),filterUnlock[id]))set({filter:id})},
 setFrame:id=>{if(get().active&&looksUnlocked(pagesFilled(),frameUnlock[id]))set({frame:id})},
 // A look at another time of day is for the picture only: it is put back on leaving and never saved.
 setLight:light=>{if(get().active&&useForestStore.getState().timeOfDay!==light)useForestStore.setState({timeOfDay:light})},
 shutter:()=>{if(get().active&&!get().pending)set({pending:true})},
 takePending:()=>{if(!get().pending)return false;set({pending:false});return true},
 finish:async(blob,width,height)=>{
  if(!get().active)return
  if(!blob){say(t('photo.failed'),'error');return}
  const {frame}=get()
  if(frame!=='none'){
   try{blob=await composeFrame(blob,frame,useJournalStore.getState().book.stamps.map(s=>s.stamp),new Date(),t('brand'))}
   catch{say(t('photo.frameFailed'),'error')}
  }
  if(!get().active)return
  const night=useForestStore.getState().timeOfDay==='night',at=new Date(),id=`${at.getTime()}-${Math.random().toString(36).slice(2,6)}`
  playSound('scissors',{volume:.6,rate:1.5})
  forget(get().last)
  const shot:LastShot={id,url:URL.createObjectURL(blob),name:photoFileName(at),saved:false}
  set(s=>({flash:s.flash+1,last:shot}))
  useJournalStore.getState().record([{type:'photo',night}])
  const saved=await savePhoto({id,at:at.toISOString(),night,width,height,image:blob,thumb:await makeThumb(blob)})
  if(!saved)say(t('photo.unsaved'),'error')
  set(s=>({albumVersion:s.albumVersion+1,last:s.last?.id===id?{...s.last,saved}:s.last}))
 },
 dismissLast:()=>{forget(get().last);set({last:null})},
}))
