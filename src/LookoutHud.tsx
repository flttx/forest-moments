import {useForestStore} from './game/store'
import {useT} from './i18n'
import {Icon} from './Icon'

const directions=['dir.s','dir.se','dir.e','dir.ne','dir.n','dir.nw','dir.w','dir.sw'] as const

export function LookoutHud(){
 const t=useT()
 const view=useForestStore(s=>s.lookoutView),turn=useForestStore(s=>s.turnLookout),leave=useForestStore(s=>s.leaveLookout)
 const heading=((view.yaw*180/Math.PI)+360)%360
 const direction=t(directions[Math.round(heading/45)%8])
 return <section className="interaction prompt lookout-hud" aria-label={t('lookout.label')}>
   <span className="ink-note prompt-status">{t('lookout.facing',{dir:direction})}</span>
   <button type="button" className="quiet round" aria-label={t('lookout.left')} onClick={()=>turn(.25,0)}><Icon name="left"/></button>
   <button type="button" className="quiet round" aria-label={t('lookout.right')} onClick={()=>turn(-.25,0)}><Icon name="right"/></button>
   <button type="button" className="action-button" onClick={leave}><kbd>F</kbd>{t('lookout.back')}</button>
 </section>
}
