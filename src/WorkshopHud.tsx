import {useForestStore} from './game/store'
import {craftCursor} from './game/workshop'
import {useT} from './i18n'

const steps=['craft.step1','craft.step2','craft.step3'] as const

/** Crafting card: step, rhythm bar and the latest result. Walking prompts live in the shared bottom prompt. */
export function WorkshopHud(){
 const t=useT()
 const craft=useForestStore(s=>s.craft)
 const interact=useForestStore(s=>s.interact),cancel=useForestStore(s=>s.cancelWorkshop)
 if(!craft)return null
 // The opening instruction is already the zone hint below; only later results replace it.
 const feedback=craft.feedback&&craft.feedback!=='first'?t(`craft.${craft.feedback}`):''
 return <section className="paper-card craft-hud" aria-label={t('craft.label')}>
   <strong>{t(steps[Math.min(craft.steps,2)])} · {Math.min(craft.steps+1,3)} / 3</strong>
   <div className="craft-meter" role="meter" aria-label={t('craft.meter')} aria-valuemin={0} aria-valuemax={1} aria-valuenow={craftCursor(craft.elapsed)}><i/><b style={{left:`${craftCursor(craft.elapsed)*100}%`}}/></div>
   <small role="status">{feedback||t('craft.zone')}</small>
   <button type="button" className="primary" onClick={interact} disabled={craft.stroke>0||craft.steps===3}><kbd>F</kbd>{t('craft.sand')}</button><button type="button" className="quiet" onClick={cancel}><kbd>Esc</kbd>{t('craft.pause')}</button>
 </section>
}
