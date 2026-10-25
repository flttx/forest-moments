import {create} from 'zustand'
import {useForestStore} from './store'

export type MenuPanel='places'|'fishbook'|'help'
/** Modes whose controls are explained once, the first time the player enters them. */
export type ModeHint='rowing'|'lookout'|'sitting'
export const guideStorageKey='forest-moments:guide:v1'
export const hintStorageKey='forest-moments:hints:v1'
/** Ordinary feedback fades; errors (failed saves, failed loads) wait for the player to close them. */
export const noticeLifetime=(kind:'info'|'error')=>kind==='error'?null:4000
export const guideLifetime=8000

function readSeen(){
 try{
  const hints=JSON.parse(window.localStorage.getItem(hintStorageKey)??'[]')
  return{guide:window.localStorage.getItem(guideStorageKey)==='seen',hints:Array.isArray(hints)?hints.filter((h):h is ModeHint=>['rowing','lookout','sitting'].includes(h)):[]}
 }catch{return{guide:false,hints:[] as ModeHint[]}}
}
// Storage may be blocked (private mode, sandboxed preview); the guide then simply shows once per session.
function remember(key:string,value:string){try{window.localStorage.setItem(key,value)}catch{/* session-only */}}

type UiState={
 panel:MenuPanel|null
 guideSeen:boolean
 seenHints:ModeHint[]
 /** The mode hint shown right now: only on the first visit to that mode, cleared when the mode ends. */
 activeHint:ModeHint|null
 openPanel:(panel:MenuPanel)=>void
 closePanel:()=>void
 finishGuide:()=>void
 enterMode:(mode:string)=>void
}

const seen=typeof window==='undefined'?{guide:false,hints:[] as ModeHint[]}:readSeen()

export const useUiStore=create<UiState>((set,get)=>({
 panel:null,
 guideSeen:seen.guide,
 seenHints:seen.hints,
 activeHint:null,
 openPanel:panel=>{
  // One panel at a time: a menu panel replaces the aquarium. Held reel input is released, never re-pressed on close.
  const forest=useForestStore.getState()
  forest.reel(false)
  useForestStore.setState({menuPaused:true,aquariumOpen:false})
  set({panel})
 },
 closePanel:()=>{
  if(!get().panel)return
  useForestStore.setState({menuPaused:false})
  set({panel:null})
 },
 finishGuide:()=>{remember(guideStorageKey,'seen');set({guideSeen:true})},
 enterMode:mode=>{
  const {seenHints,activeHint}=get(),hint=(['rowing','lookout','sitting'] as const).find(h=>h===mode)??null
  if(!hint){if(activeHint)set({activeHint:null});return}
  if(activeHint===hint||seenHints.includes(hint))return
  const next=[...seenHints,hint];remember(hintStorageKey,JSON.stringify(next));set({seenHints:next,activeHint:hint})
 },
}))

/** Input and gameplay timers hold while any panel, including the aquarium, covers the scene. */
export const gameplayPaused=(forest:{menuPaused:boolean;aquariumOpen:boolean})=>forest.menuPaused||forest.aquariumOpen
