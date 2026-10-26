import {useForestStore} from './game/store'
import {catchId} from './game/expansion'
import {useDialogFocus} from './useDialogFocus'
import {useT} from './i18n'
import {Icon} from './Icon'

const closeTank=()=>useForestStore.setState({aquariumOpen:false})

function Aquarium(){
 const t=useT()
 const s=useForestStore()
 const {ref,trap}=useDialogFocus<HTMLElement>(true)
 const available=s.fishBook.recent.filter(f=>!s.homeBook.usedCatchIds.includes(catchId(f)))
 const full=s.homeBook.fish.length>=5
 return <section ref={ref} className="paper-panel home-panel" role="dialog" aria-modal="true" aria-label={t('tank.label')} onKeyDown={e=>{trap(e);if(e.key==='Escape'){e.preventDefault();e.stopPropagation();closeTank()}}}>
  <header><h2>{t('tank.title',{n:s.homeBook.fish.length})}</h2><button type="button" className="close-button" onClick={closeTank} aria-label={t('tank.close')}><Icon name="close"/></button></header>
  <div className="panel-body">
   {s.homeBook.fish.map(f=><div className="fish-choice" key={f.id}><span>{t('tank.resident',{size:f.sizeCm})}</span><button type="button" onClick={()=>s.releaseFish(f.id)}>{t('tank.release')}</button></div>)}
   {available.length===0?(s.homeBook.fish.length===0&&<p className="empty">{t('tank.empty')}</p>):available.map(f=><div className="fish-choice" key={catchId(f)}><span>{t('tank.catch',{size:f.sizeCm})}</span><button type="button" disabled={full} onClick={()=>s.keepFish(catchId(f))}>{t('tank.keep')}</button></div>)}
  </div>
 </section>
}

/** Sleep and aquarium cards; everyday bedroom and seat actions use the shared bottom prompt. */
export function HomeHud(){
 const t=useT()
 const sleeping=useForestStore(s=>s.mode==='sleeping'),target=useForestStore(s=>s.sleepJourney?.target),wakeUp=useForestStore(s=>s.wakeUp)
 const tank=useForestStore(s=>s.location==='bedroom'&&s.aquariumOpen)
 if(sleeping)return <section className="sleep-panel" aria-label={t('home.time')}><strong>{t(target==='day'?'home.sunrise':'home.sunset')}</strong><button type="button" onClick={wakeUp}>{t('home.skip')}</button></section>
 return tank?<Aquarium/>:null
}
