import {useEffect,useState} from 'react'
import {useProgress} from '@react-three/drei'
import {useT} from './i18n'
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
 if(active&&progress>peak)setPeak(progress)
 useEffect(()=>{
  if(done||active||progress<100)return
  const timer=setTimeout(()=>setDone(true),settleMs)
  return()=>clearTimeout(timer)
 },[active,progress,done])
 if(done)return null
 const value=Math.round(Math.max(peak,active?0:progress))
 return <div className="asset-loading twill" role="status" aria-busy="true">
  <div className="loading-card">
   <RaccoonPatch arc="FOREST MOMENTS" className="loading-patch"/>
   <h1>{t('loading')}</h1>
   <div className="loading-bar" role="progressbar" aria-label={t('loading.label')} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value||undefined} aria-valuetext={value?`${value}%`:t('loading.preparing')}>
    <i style={{width:`${Math.max(4,value)}%`}}/>
   </div>
   <p>{value?`${value}%`:t('loading.preparing')}</p>
  </div>
 </div>
}
