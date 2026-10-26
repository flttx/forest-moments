import {useEffect,useId,useRef,useState} from 'react'
import {useT,type Key} from './i18n'
import {Icon} from './Icon'
import {useAudioStore} from './audio/audioStore'
import {audioChannels,type AudioChannel} from './audio/audioMix'

const channelLabel:Record<AudioChannel,Key>={master:'sound.master',music:'sound.music',ambience:'sound.ambience',effects:'sound.effects'}

/** Toolbar sound button and its small panel: mute (also M) and the four volumes, remembered on this device. */
export function SoundControl(){
 const t=useT()
 const settings=useAudioStore(s=>s.settings),setSettings=useAudioStore(s=>s.setSettings),unlocked=useAudioStore(s=>s.unlocked)
 const [open,setOpen]=useState(false)
 const panelId=useId(),button=useRef<HTMLButtonElement>(null),panel=useRef<HTMLDivElement>(null)
 useEffect(()=>{
  if(!open)return
  panel.current?.querySelector<HTMLInputElement>('input')?.focus()
  const close=(refocus:boolean)=>{setOpen(false);if(refocus)button.current?.focus()}
  // Escape closes only this panel; the scene's own Escape handling never sees it.
  const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.stopPropagation();e.preventDefault();close(true)}}
  const pointer=(e:PointerEvent)=>{const target=e.target as Node;if(!panel.current?.contains(target)&&!button.current?.contains(target))close(false)}
  window.addEventListener('keydown',key,true);window.addEventListener('pointerdown',pointer)
  return()=>{window.removeEventListener('keydown',key,true);window.removeEventListener('pointerdown',pointer)}
 },[open])
 return <div className="sound-control">
  <button ref={button} type="button" className="tool-button icon-only" aria-expanded={open} aria-controls={panelId} aria-keyshortcuts="M"
   aria-label={t(settings.muted?'sound.buttonMuted':'sound.button')} title={`${t('sound.label')} (M)`} onClick={()=>setOpen(v=>!v)}>
   <Icon name={settings.muted?'muted':'sound'}/>
  </button>
  {open&&<div ref={panel} id={panelId} role="group" aria-label={t('sound.button')} className="paper-note sound-panel">
   <label className="sound-row"><span>{t('sound.mute')}</span><input type="checkbox" checked={settings.muted} onChange={e=>setSettings({...settings,muted:e.target.checked})}/></label>
   {audioChannels.map(channel=><label key={channel} className="sound-slider">
    <span><span>{t(channelLabel[channel])}</span><span className="value">{Math.round(settings[channel]*100)}</span></span>
    <input type="range" min={0} max={100} step={5} value={Math.round(settings[channel]*100)} disabled={settings.muted} aria-valuetext={`${Math.round(settings[channel]*100)}%`}
     onChange={e=>setSettings({...settings,[channel]:Number(e.target.value)/100})}/>
   </label>)}
   {!unlocked&&<p className="sound-note">{t('sound.locked')}</p>}
  </div>}
  <p role="status" aria-live="polite" className="sr-only">{t(settings.muted?'sound.muted':'sound.on')}</p>
 </div>
}
