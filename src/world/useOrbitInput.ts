import {useEffect,type RefObject} from 'react'
import {useThree} from '@react-three/fiber'
import {useForestStore} from '../game/store'
import {freeCam,usePhotoStore} from '../game/photoStore'
import {dollyFreeView,turnFreeView} from '../game/freeCamera'
import {photoOrbit} from '../game/photo'
import {cancelOrbit,rotateOrbit,zoomOrbit,orbitConfig,type Orbit} from '../game/orbitCamera'

export function useOrbitInput(orbit:RefObject<Orbit>,dragging:RefObject<boolean>){
 const gl=useThree(s=>s.gl)
 useEffect(()=>{
  const canvas=gl.domElement
  let pointer:number|null=null,last:{x:number;y:number}|null=null
  const enabled=()=>{const s=useForestStore.getState();return (!s.menuPaused||usePhotoStore.getState().active)&&!s.homeTransfer&&!s.aquariumOpen&&!s.boatTransfer&&!s.workshopTransfer&&!s.lookoutTransfer&&!s.inspectingTree&&['walking','rowing','lookout','sitting'].includes(s.mode)}
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
   const photo=usePhotoStore.getState()
   if(photo.active&&photo.free){if(freeCam.view)freeCam.view=turnFreeView(freeCam.view,dx,dy)}
   else if(s.mode==='lookout')s.turnLookout(-dx*.004,dy*.003)
   else if(usePhotoStore.getState().active)rotateOrbit(orbit.current,dx,dy,photoOrbit.minPitch,photoOrbit.maxPitch)
   else rotateOrbit(orbit.current,dx,dy)
  }
  const up=(e:PointerEvent)=>{if(e.pointerId===pointer&&!(e.buttons&2))stop()}
  const menu=(e:MouseEvent)=>e.preventDefault()
  const wheel=(e:WheelEvent)=>{
   const flying=usePhotoStore.getState()
   // In free framing the wheel moves the camera along its view.
   if(enabled()&&flying.active&&flying.free){e.preventDefault();if(freeCam.view)freeCam.view=dollyFreeView(freeCam.view,-e.deltaY*.01);return}
   if(!enabled()||useForestStore.getState().mode==='lookout')return
   e.preventDefault();const photo=usePhotoStore.getState().active,pixels=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?canvas.clientHeight:1)
   if(photo)zoomOrbit(orbit.current,pixels,useForestStore.getState().location==='island'?photoOrbit.maxZoom:orbitConfig.indoorMaxZoom,photoOrbit.minZoom)
   else zoomOrbit(orbit.current,pixels,useForestStore.getState().location==='island'?orbitConfig.maxZoom:orbitConfig.indoorMaxZoom)
  }
  const visibility=()=>{if(document.visibilityState!=='visible')clear()}
  const unsubscribe=useForestStore.subscribe(()=>{if(!enabled())clear()})
  const unsubscribePhoto=usePhotoStore.subscribe((s,p)=>{if(s.active!==p.active)clear()})
  canvas.setAttribute('tabindex','0')
  canvas.addEventListener('pointerdown',down);canvas.addEventListener('pointermove',move);canvas.addEventListener('pointerup',up)
  canvas.addEventListener('pointercancel',clear);canvas.addEventListener('lostpointercapture',stop)
  canvas.addEventListener('contextmenu',menu);canvas.addEventListener('wheel',wheel,{passive:false})
  window.addEventListener('blur',clear);document.addEventListener('visibilitychange',visibility)
  return()=>{
   unsubscribe();unsubscribePhoto();canvas.removeEventListener('pointerdown',down);canvas.removeEventListener('pointermove',move);canvas.removeEventListener('pointerup',up)
   canvas.removeEventListener('pointercancel',clear);canvas.removeEventListener('lostpointercapture',stop)
   canvas.removeEventListener('contextmenu',menu);canvas.removeEventListener('wheel',wheel)
   window.removeEventListener('blur',clear);document.removeEventListener('visibilitychange',visibility);clear()
  }
 },[gl,orbit,dragging])
}
