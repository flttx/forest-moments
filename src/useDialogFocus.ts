import {useEffect,useRef,type KeyboardEvent as ReactKeyboardEvent} from 'react'

const focusable='button:not([disabled]),[href],summary,[tabindex]:not([tabindex="-1"])'
/** Keeps keyboard focus inside a modal panel; returns it to the element that opened it. */
export function useDialogFocus<T extends HTMLElement>(open:boolean){
 const ref=useRef<T>(null)
 useEffect(()=>{
  if(!open)return
  const opener=document.activeElement instanceof HTMLElement?document.activeElement:null
  // Keyboard users get a visible ring on both moves; a mouse click keeps focus where it belongs without one.
  const keyboard=opener?.matches(':focus-visible')??false
  ref.current?.querySelector<HTMLElement>(focusable)?.focus({focusVisible:keyboard} as FocusOptions)
  return()=>{if(opener?.isConnected)opener.focus({focusVisible:keyboard} as FocusOptions)}
 },[open])
 const trap=(e:ReactKeyboardEvent)=>{
  if(e.key!=='Tab'||!ref.current)return
  const items=[...ref.current.querySelectorAll<HTMLElement>(focusable)];if(!items.length)return
  const first=items[0],last=items[items.length-1]
  if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}
  else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}
 }
 return{ref,trap}
}
