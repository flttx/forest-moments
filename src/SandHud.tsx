import {useForestStore} from './game/store'
import {canPlaySand,useSandStore} from './game/sandStore'
import {buildSeconds,sandKinds,type SandKind} from './game/sand'
import {useT} from './i18n'
import {Icon,type IconName} from './Icon'

const icons:Record<SandKind,IconName>={castle:'castle',river:'waves',pit:'pit',imprint:'paw'}

/** On the east beach: a way into sand play, then its quick bar (1–4, R, F, Esc) or the progress of a work going up. */
export function SandHud(){
 const t=useT()
 const active=useSandStore(s=>s.active),tool=useSandStore(s=>s.tool),build=useSandStore(s=>s.build)
 const enter=useSandStore(s=>s.enter),exit=useSandStore(s=>s.exit),choose=useSandStore(s=>s.choose),rotate=useSandStore(s=>s.rotate),confirm=useSandStore(s=>s.confirm),cancel=useSandStore(s=>s.cancel)
 const here=useForestStore(canPlaySand)
 if(build)return <div className="interaction prompt sand-hud" aria-live="polite">
  <span className="ink-note prompt-info"><span className="prompt-status">{t('sand.building')}</span><progress aria-label={t(`sand.tool.${build.work.kind}`)} value={build.elapsed} max={buildSeconds}/></span>
  <button type="button" className="quiet" onClick={cancel}><kbd>Esc</kbd></button>
 </div>
 if(!active)return here?<div className="interaction prompt"><button type="button" className="action-button" onClick={enter}><kbd>B</kbd>{t('sand.prompt')}</button></div>:null
 return <section className="sand-hud" aria-label={t('sand.title')}>
  <div className="sand-tools paper-note" role="toolbar" aria-label={t('sand.tools')}>
   {sandKinds.map((k,i)=><button key={k} type="button" className="sand-tool" aria-pressed={tool===k} onClick={()=>choose(k)}>
    <kbd>{i+1}</kbd><Icon name={icons[k]} size={22}/><span>{t(`sand.tool.${k}`)}</span>
   </button>)}
  </div>
  <div className="interaction">
   <button type="button" className="round" aria-label={t('sand.rotate')} title={`${t('sand.rotate')} (R)`} disabled={tool==='river'} onClick={()=>rotate()}><Icon name="rotate"/></button>
   <button type="button" className="action-button" onClick={confirm}><kbd>F</kbd>{t('sand.build')}</button>
   <button type="button" onClick={exit}><kbd>Esc</kbd>{t('sand.exit')}</button>
  </div>
  <span className="ink-note sand-help">{t('sand.help')}</span>
 </section>
}
