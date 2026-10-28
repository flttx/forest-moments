import {create} from 'zustand'
import {t} from '../i18n'
import {useForestStore} from './store'
import {playSound} from '../audio/audioStore'
import {buildSeconds,decodeSand,emptySand,inSandRect,placementRefusal,reachAhead,sandStorageKey,type SandBook,type SandKind,type SandWork} from './sand'
import {canStandAt} from './movement'

type Build={work:SandWork;elapsed:number}
type SandState={
 book:SandBook
 /** Sand mode: the quick bar is up and F builds instead of interacting. */
 active:boolean
 tool:SandKind|null
 /** The outline's turn, in radians (castles and prints; a river always runs to the sea). */
 yaw:number
 build:Build|null
 enter:()=>void
 exit:()=>void
 choose:(kind:SandKind)=>void
 rotate:(step?:number)=>void
 /** Start building at the outline in front of the raccoon; false (with a note) when it cannot go there. */
 confirm:()=>boolean
 cancel:()=>void
 tick:(dt:number)=>SandWork|null
 /** The tide comes in overnight: another day starts with smooth sand. */
 sync:(day:number)=>void
}

function load(day:number):SandBook{
 try{return decodeSand(window.localStorage.getItem(sandStorageKey),day)}catch{return emptySand(day)}
}
function save(book:SandBook){
 try{window.localStorage.setItem(sandStorageKey,JSON.stringify(book));return true}catch{return false}
}
/** The raccoon's facing, kept current by the scene while sand mode is up (no store churn every frame). */
export const sandAim={facing:0}
const note=(message:string,kind:'info'|'error'='info')=>useForestStore.setState({message,messageKind:kind})

/** Where the outline sits: a little ahead of the raccoon (forward is -sin, -cos of its yaw). */
export function outlineAt(kind:SandKind,position:{x:number;z:number},facing:number,yaw:number):SandWork{
 const d=reachAhead[kind]
 return{kind,x:position.x-Math.sin(facing)*d,z:position.z-Math.cos(facing)*d,yaw:kind==='river'?0:yaw}
}
/** On the play sand, on foot and free to start something. */
export function canPlaySand(s:ReturnType<typeof useForestStore.getState>){
 return s.location==='island'&&s.mode==='walking'&&!s.menuPaused&&inSandRect(s.position.x,s.position.z,.3)&&canStandAt(s.position.x,s.position.z)
}

export const useSandStore=create<SandState>((set,get)=>({
 book:typeof window==='undefined'?emptySand(0):load(useForestStore.getState().homeBook.nights),
 active:false,tool:null,yaw:0,build:null,
 enter:()=>{
  if(get().active)return
  if(!canPlaySand(useForestStore.getState())){note(t('sand.notHere'));return}
  set({active:true,tool:get().tool??'castle'});playSound('ui-open',{volume:.6})
 },
 exit:()=>{if(get().active||get().build){set({active:false,build:null});playSound('ui-close',{volume:.5})}},
 choose:kind=>{if(get().active&&!get().build)set({tool:kind})},
 rotate:(step=Math.PI/8)=>{if(get().active&&!get().build)set({yaw:Math.atan2(Math.sin(get().yaw+step),Math.cos(get().yaw+step))})},
 confirm:()=>{
  const s=get(),forest=useForestStore.getState()
  if(!s.active||!s.tool||s.build||!canPlaySand(forest))return false
  const work=outlineAt(s.tool,forest.position,sandAim.facing,s.yaw),refusal=placementRefusal(work,s.book.works)
  if(refusal){note(t(`sand.refuse.${refusal}`));playSound('ui-close',{volume:.4});return false}
  set({build:{work,elapsed:0}});note('')
  return true
 },
 cancel:()=>{if(get().build){set({build:null});note(t('sand.cancelled'))}},
 tick:dt=>{
  const b=get().build
  if(!b||!Number.isFinite(dt)||dt<=0)return null
  const elapsed=b.elapsed+Math.min(dt,.1)
  if(elapsed<buildSeconds){set({build:{...b,elapsed}});return null}
  const book={...get().book,works:[...get().book.works,b.work]},saved=save(book)
  set({book,build:null})
  note(saved?t(`sand.done.${b.work.kind}`):t('sand.unsaved'),saved?'info':'error')
  return b.work
 },
 sync:day=>{if(get().book.day!==day){const book=emptySand(day);save(book);set({book,build:null})}},
}))
