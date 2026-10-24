import {useEffect,type RefObject} from 'react'
import {useThree} from '@react-three/fiber'
import {useForestStore} from '../game/store'
import {cancelOrbit,rotateOrbit,zoomOrbit,type Orbit} from '../game/orbitCamera'

export function useOrbitInput(orbit:RefObject<Orbit>,dragging:RefObject<boolean>){
 const gl=useThree(s=>s.gl)
 useEffect(()=>{
  const canvas=gl.domElement
  let pointer:number|null=null,last:{x:number;y:number}|null=null
  const enabled=()=>{const s=useForestStore.getState();return !s.boatTransfer&&!s.workshopTransfer&&!s.lookoutTransfer&&!s.inspectingTree&&['walking','rowing','lookout'].includes(s.mode)}
  const stop=()=>{const id=pointer;pointer=null;last=null;dragging.current=false;if(id!==null&&canvas.hasPointerCapture(id))canvas.releasePointerCapture(id)}
  const clear=()=>{stop();cancelOrbit(orbit.current)}
  const down=(e:PointerEvent)=>{
   if(e.button!==2||!enabled())return
   e.preventDefault();pointer=e.pointerId;last={x:e.clientX,y:e.clientY};dragging.current=true
   canvas.setPointerCapture(e.pointerId);canvas.focus({preventScroll:true})
  }
  const move=(e:PointerEvent)=>{
   if(pointer!==e.pointerId)return
   if(!(e.buttons&2)||!enabled()){stop();return}
   const previous=last;last={x:e.clientX,y:e.clientY};if(!previous)return
   const dx=e.clientX-previous.x,dy=e.clientY-previous.y,s=useForestStore.getState()
   if(s.mode==='lookout')s.turnLookout(-dx*.004,dy*.003)
   else rotateOrbit(orbit.current,dx,dy)
  }
  const up=(e:PointerEvent)=>{if(e.pointerId===pointer&&!(e.buttons&2))stop()}
  const menu=(e:MouseEvent)=>e.preventDefault()
  const wheel=(e:WheelEvent)=>{
   if(!enabled()||useForestStore.getState().mode==='lookout')return
   e.preventDefault();zoomOrbit(orbit.current,e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?canvas.clientHeight:1))
  }
  const visibility=()=>{if(document.visibilityState!=='visible')clear()}
  const unsubscribe=useForestStore.subscribe(()=>{if(!enabled())clear()})
  canvas.setAttribute('tabindex','0')
  canvas.addEventListener('pointerdown',down);canvas.addEventListener('pointermove',move);canvas.addEventListener('pointerup',up)
  canvas.addEventListener('pointercancel',clear);canvas.addEventListener('lostpointercapture',stop)
  canvas.addEventListener('contextmenu',menu);canvas.addEventListener('wheel',wheel,{passive:false})
  window.addEventListener('blur',clear);document.addEventListener('visibilitychange',visibility)
  return()=>{
   unsubscribe();canvas.removeEventListener('pointerdown',down);canvas.removeEventListener('pointermove',move);canvas.removeEventListener('pointerup',up)
   canvas.removeEventListener('pointercancel',clear);canvas.removeEventListener('lostpointercapture',stop)
   canvas.removeEventListener('contextmenu',menu);canvas.removeEventListener('wheel',wheel)
   window.removeEventListener('blur',clear);document.removeEventListener('visibilitychange',visibility);clear()
  }
 },[gl,orbit,dragging])
}
