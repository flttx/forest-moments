import {useEffect,useState} from 'react'
import {useProgress} from '@react-three/drei'
import {useT} from './i18n'
import {useUiStore} from './game/uiStore'
import {RaccoonPatch} from './Patch'

/** Loader batches finish one after another; wait this long at 100% before treating the island as loaded. */
const settleMs=700

/**
 * First arrival only, after my-blog's world loading card: a twill ground over the whole screen, the raccoon patch,
 * a title and one bar. drei restarts its percentage for each batch, so the bar keeps its highest value.
 * Removed outright when done: a fading layer above the WebGL canvas stalled frames before.
 */
export function LoadingScreen(){
 const t=useT()
 const {active,progress}=useProgress()
 const [peak,setPeak]=useState(0)
 const [done,setDone]=useState(false)
 // Downloads finishing is not enough: later batches and shader compiles still leave a bare canvas. Wait for the world.
 const drawn=useUiStore(s=>s.worldDrawn||s.worldFailed)
 if(active&&progress>peak)setPeak(progress)
 useEffect(()=>{
  if(done||active||progress<100||!drawn)return
  const timer=setTimeout(()=>setDone(true),settleMs)
  return()=>clearTimeout(timer)
 },[active,progress,done,drawn])
 if(done)return null
 const value=Math.round(Math.max(peak,active?0:progress))
 return <div className="asset-loading twill" role="status" aria-busy="true">
  <div className="loading-card">
   <RaccoonPatch arc="FOREST MOMENTS" className="loading-patch"/>
   <h1>{t('loading')}</h1>
   <div className="loading-bar" role="progressbar" aria-label={t('loading.label')} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value||undefined} aria-valuetext={value?`${value}%`:t('loading.preparing')}>
    <i style={{width:`${Math.max(4,value)}%`}}/>
   </div>
   {/* everything downloaded but the world still compiling and placing: say so rather than sit on a full bar's 100% */}
   <p>{value&&!(value>=100&&!drawn)?`${value}%`:t('loading.preparing')}</p>
  </div>
 </div>
}
