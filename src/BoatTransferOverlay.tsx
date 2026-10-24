import {useEffect,useRef} from 'react'
import {useForestStore} from './game/store'
import {transferOpacity} from './game/boatPresentation'

export function BoatTransferOverlay(){
 const ref=useRef<HTMLDivElement>(null)
 useEffect(()=>useForestStore.subscribe(state=>{
  if(!ref.current)return
  const transition=state.boatTransfer??state.lookoutTransfer??state.workshopTransfer
  ref.current.style.opacity=String(transition?transferOpacity(transition.elapsed):0)
 }),[])
 return <div ref={ref} className="boat-transfer-shade" aria-hidden="true"/>
}
