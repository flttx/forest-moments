import {useEffect,useRef} from 'react'
import {useT,type Key} from './i18n'
import {Icon} from './Icon'
import {useTourStore} from './game/tourStore'
import {tourDuration,tourFrame,tourStops} from './game/tour'

/** Toolbar button that starts the guided tour. */
export function TourButton(){
 const t=useT(),start=useTourStore(s=>s.start),button=useRef<HTMLButtonElement>(null)
 useEffect(()=>{if(useTourStore.getState().returnFocus){useTourStore.setState({returnFocus:false});button.current?.focus({preventScroll:true})}},[])
 return <button ref={button} type="button" className="tool-button" title={t('tour.start')} aria-label={t('tour.start')} onClick={start}>
  <Icon name="tour"/><span className="tool-label">{t('tour.label')}</span>
 </button>
}

/** While the tour runs: a line about the current stop, how far along it is, and a way out (any key also ends it). */
export function TourHud(){
 const t=useT()
 const active=useTourStore(s=>s.active),elapsed=useTourStore(s=>s.elapsed),stop=useTourStore(s=>s.stop)
 const exit=useRef<HTMLButtonElement>(null)
 useEffect(()=>{if(active)exit.current?.focus({preventScroll:true})},[active])
 if(!active)return null
 const at=tourFrame(elapsed,{eye:[0,0,0],target:[0,0,0]}).stop,id=tourStops[at].id
 return <div className="tour-card paper-card" role="region" aria-label={t('tour.label')}>
  <p className="tour-step">{t('tour.step',{n:at+1,total:tourStops.length})} · {t(`tour.${id}.name` as Key)}</p>
  <p className="tour-line" aria-live="polite">{t(`tour.${id}` as Key)}</p>
  <div className="tour-foot">
   <progress aria-label={t('tour.progress')} value={elapsed} max={tourDuration}/>
   <button ref={exit} type="button" className="tool-button" onClick={stop}><Icon name="close"/>{t('tour.exit')}</button>
  </div>
 </div>
}
