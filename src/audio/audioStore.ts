import {create} from 'zustand'
import {audioStorageKey,parseAudioSettings,type AudioSettings} from './audioMix'
import {WorldAudio,type PlayOptions} from './WorldAudio'

/** Sounds worth decoding as soon as audio unlocks; the rest decode on first use. */
const preload=['amb-birds','amb-crickets','amb-sea','music-day','music-night','step-grass-0','step-grass-1','step-grass-2','step-wood-0','step-wood-1','ui-open','ui-close','cast','splash-tiny']
const qa=import.meta.env.DEV&&typeof location!=='undefined'&&new URLSearchParams(location.search).has('qa')

let engine:WorldAudio|null=null
/** The engine once the visitor has interacted; null before that or where WebAudio is missing. */
export const audioEngine=()=>engine

type AudioState={settings:AudioSettings;unlocked:boolean;setSettings:(settings:AudioSettings)=>void;toggleMute:()=>void}
export const useAudioStore=create<AudioState>((set,get)=>({
 settings:(()=>{try{return parseAudioSettings(window.localStorage.getItem(audioStorageKey))}catch{return parseAudioSettings(null)}})(),
 unlocked:false,
 setSettings:settings=>{
  // Blocked storage only means the choice lasts for this visit.
  try{window.localStorage.setItem(audioStorageKey,JSON.stringify(settings))}catch{/* session-only */}
  engine?.applySettings(settings);set({settings})
 },
 toggleMute:()=>{const s=get().settings;get().setSettings({...s,muted:!s.muted})},
}))

/** Plays a one-shot; silently ignored until a gesture has unlocked audio. Dev QA keeps a log of what was asked for. */
export function playSound(name:string,options?:PlayOptions){
 if(qa)(window as unknown as {forestAudioLog?:string[]}).forestAudioLog?.push(name)
 engine?.play(name,options)
}

/** Creates the engine on the first pointer or key press and follows tab visibility. Returns the cleanup. */
export function installAudio(){
 if(qa)Object.assign(window,{forestAudioLog:[] as string[]})
 const unlock=()=>{
  // A modifier key alone is not a user activation: the context then starts suspended, so every later gesture retries.
  if(engine){if(engine.ctx.state==='suspended'&&document.visibilityState==='visible')engine.setActive(true);return}
  engine=WorldAudio.create();if(!engine)return
  engine.applySettings(useAudioStore.getState().settings)
  void engine.load().then(()=>engine?.preload(preload))
  // After this event: a state update now would re-render between this listener and the game's own key handler.
  window.setTimeout(()=>useAudioStore.setState({unlocked:true}),0)
 }
 const visibility=()=>engine?.setActive(document.visibilityState==='visible')
 window.addEventListener('pointerdown',unlock);window.addEventListener('keydown',unlock)
 document.addEventListener('visibilitychange',visibility)
 return()=>{
  window.removeEventListener('pointerdown',unlock);window.removeEventListener('keydown',unlock)
  document.removeEventListener('visibilitychange',visibility)
  engine?.dispose();engine=null
 }
}
