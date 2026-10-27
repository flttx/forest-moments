import {useShallow} from 'zustand/react/shallow'
import {useForestStore} from './game/store'
import {canStargaze,roastBlock,roastSeconds,skySeats} from './game/campfire'
import {useT} from './i18n'

/** Seated by the fire or the sea: roast a fish (R) and, at night, look up at the stars (V). */
export function CampHud(){
 const t=useT()
 const s=useForestStore(useShallow(s=>({seated:s.mode==='sitting'&&s.sitting?.phase==='idle'&&(skySeats as readonly string[]).includes(s.sitting.id),camp:s.mode==='sitting'&&s.sitting?.id.startsWith('camp-'),
  block:roastBlock(s),sky:canStargaze(s),roast:s.roast,stargazing:s.stargazing})))
 const startRoast=useForestStore(s=>s.startRoast),toggleStargaze=useForestStore(s=>s.toggleStargaze)
 if(!s.seated||(!s.camp&&!s.sky))return null
 return <section className="paper-card camp-hud" aria-label={t('camp.label')}>
  {s.camp&&(s.roast?<label className="camp-roast" role="status">{t('camp.roasting',{name:t(`fish.${s.roast.species}`)})}<progress aria-label={t('camp.roastProgress')} value={s.roast.elapsed} max={roastSeconds}/></label>
   :<button type="button" disabled={!!s.block} title={s.block==='fire'?t('camp.noFire'):s.block==='fish'?t('camp.noFish'):undefined} onClick={startRoast}><kbd>R</kbd>{t('camp.roast')}</button>)}
  {s.camp&&!s.roast&&s.block&&s.block!=='seat'&&<small>{t(s.block==='fire'?'camp.noFire':'camp.noFish')}</small>}
  {s.sky&&!s.roast&&<button type="button" aria-pressed={s.stargazing} onClick={toggleStargaze}><kbd>V</kbd>{t(s.stargazing?'camp.starsBack':'camp.stars')}</button>}
 </section>
}
