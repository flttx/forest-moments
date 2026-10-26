import {useEffect} from 'react'
import {useDialogFocus} from './useDialogFocus'
import {useProgress} from '@react-three/drei'
import {useShallow} from 'zustand/react/shallow'
import {useForestStore} from './game/store'
import {SoundControl} from './SoundControl'
import {JournalPanel} from './JournalPanel'
import {useJournalStore} from './game/journalStore'
import {useAudioStore} from './audio/audioStore'
import {useUiStore,noticeLifetime,guideLifetime,type MenuPanel,type ModeHint} from './game/uiStore'
import {promptFor} from './game/prompt'
import {landmarks,type LandmarkId} from './game/landmarks'
import {growthStages} from './game/growth'
import {useLang,useT,type Key} from './i18n'
import {Icon} from './Icon'
import {FishingHud} from './FishingHud'
import {HomeHud} from './HomeHud'
import {WorkshopHud} from './WorkshopHud'
import {LookoutHud} from './LookoutHud'
import {GrowthStatus} from './GrowthStatus'

const menuItems:[MenuPanel,Key][]=[['journal','menu.journal'],['places','menu.places'],['fishbook','menu.fishbook'],['help','menu.help']]
const inTransfer=(s:ReturnType<typeof useForestStore.getState>)=>!!(s.boatTransfer||s.lookoutTransfer||s.workshopTransfer||s.homeTransfer)

/** Two-way switch: both languages stay visible, the current one is set in ink. */
function LanguageSwitch(){
 const t=useT(),lang=useLang(s=>s.lang),setLang=useLang(s=>s.setLang)
 return <button type="button" className="tool-button lang-switch" aria-label={t('menu.lang')} onClick={()=>setLang(lang==='zh'?'en':'zh')}>
  <Icon name="language"/><span className={lang==='zh'?'current':undefined}>中</span><span className="slash" aria-hidden="true">/</span><span className={lang==='en'?'current':undefined}>EN</span>
 </button>
}

/** This page's progress beside the journal button: quiet, no badge colour or motion to nag. */
function JournalCount(){
 const t=useT(),tasks=useJournalStore(s=>s.book.page.tasks),done=tasks.filter(task=>task.doneAt).length
 return <span className="tool-count" aria-label={t('journal.countLabel',{done,total:tasks.length})}>{done}/{tasks.length}</span>
}

/** Title set in the display face straight on the scene, and one paper toolbar; both step aside during transfers and sleep. */
function TopBar(){
 const t=useT()
 const panel=useUiStore(s=>s.panel),openPanel=useUiStore(s=>s.openPanel),closePanel=useUiStore(s=>s.closePanel),toggleHud=useUiStore(s=>s.toggleHud)
 const hidden=useForestStore(s=>s.mode==='sleeping'||inTransfer(s))
 if(hidden)return null
 return <>
  <div className="brand">{t('brand')}</div>
  <nav className="menu" aria-label={t('menu.label')}>
   {menuItems.map(([id,label])=><button key={id} type="button" className="tool-button" aria-haspopup="dialog" aria-expanded={panel===id} aria-controls="menu-panel" onClick={()=>panel===id?closePanel():openPanel(id)}><Icon name={id}/><span className="tool-label">{t(label)}</span>{id==='journal'&&<JournalCount/>}</button>)}
   <span className="tool-divider" aria-hidden="true"/>
   <LanguageSwitch/>
   <SoundControl/>
   <button type="button" className="tool-button icon-only" aria-label={t('menu.hide')} title={`${t('menu.hide')} (H)`} onClick={toggleHud}><Icon name="hide"/></button>
  </nav>
 </>
}

function MenuPanelView(){
 const t=useT()
 const panel=useUiStore(s=>s.panel),closePanel=useUiStore(s=>s.closePanel)
 const {ref,trap}=useDialogFocus<HTMLElement>(!!panel)
 if(!panel)return null
 const title=t(menuItems.find(([id])=>id===panel)![1])
 return <section id="menu-panel" ref={ref} className="paper-panel menu-panel" role="dialog" aria-modal="true" aria-labelledby="menu-panel-title"
  onKeyDown={e=>{trap(e);if(e.key==='Escape'){e.preventDefault();e.stopPropagation();closePanel()}}} onWheel={e=>e.stopPropagation()}>
  <header><h2 id="menu-panel-title">{title}</h2><button type="button" className="close-button" onClick={closePanel} aria-label={t('panel.close')}><Icon name="close"/></button></header>
  <div className="panel-body">{panel==='journal'?<JournalPanel/>:panel==='places'?<Places/>:panel==='fishbook'?<FishBook/>:<Help/>}</div>
 </section>
}

function Places(){
 const t=useT()
 const s=useForestStore(useShallow(s=>({nearby:s.nearby,meals:s.farmBook.meals,tree:s.tree,nights:s.homeBook.nights,fireLit:s.homeBook.fireLit,phase:s.workshopBook.phase,fish:s.fishBook.count})))
 const status:Partial<Record<LandmarkId,string>>={
  bedroom:t('status.nights',{n:s.nights}),campfire:t(s.fireLit?'status.fireLit':'status.fireOut'),
  workshop:t(s.phase==='finished'?'status.stoolDone':s.phase==='carrying'?'status.stumpCarried':'status.stumpMissing'),
  farm:t('status.meals',{n:s.meals}),pond:t('status.fish',{n:s.fish}),
  grove:s.tree?t('status.planted',{stage:t(`growth.${growthStages[s.tree.stage].id}`)}):t('status.noTree'),
 }
 return <ul className="place-list">{landmarks.map(p=><li key={p.id} className={s.nearby===p.id?'here':undefined}>
  <strong>{t(`place.${p.id}`)}{s.nearby===p.id&&<em> · {t('place.nearby')}</em>}</strong><p>{t(`place.${p.id}.hint`)}</p>{status[p.id]&&<small>{status[p.id]}</small>}
 </li>)}</ul>
}

function FishBook(){
 const t=useT(),lang=useLang(s=>s.lang)
 const book=useForestStore(s=>s.fishBook)
 if(!book.count)return <p className="empty">{t('fishbook.empty')}</p>
 return <><p>{t('fishbook.summary',{count:book.count,best:book.bestCm})}</p><ol className="catch-list">{book.recent.slice(0,8).map((fish,i)=><li key={`${fish.at}-${i}`}>{fish.sizeCm} cm · {new Date(fish.at).toLocaleDateString(lang==='zh'?'zh-CN':'en-GB')}</li>)}</ol></>
}

const helpRows:[Key,(Key|string)[]][]=[
 ['help.move',['W','A','S','D']],['help.run',['Shift']],['help.look',['key.rightDrag']],['help.orbit',['Q','E']],['help.zoom',['key.wheel']],['help.interact',['F']],['help.back',['Esc']],['help.hide',['H']],['help.mute',['M']],
 ['help.strike',['F']],['help.reel',['key.holdSpace']],['help.row',['W','S']],['help.steer',['A','D']],['help.tower',['A','D','W','S']],
]
function Help(){
 const t=useT()
 return <dl className="help-list">{helpRows.map(([label,keys])=><div key={label}><dt>{t(label)}</dt><dd>{keys.map(k=><kbd key={k}>{k.startsWith('key.')?t(k as Key):k}</kbd>)}</dd></div>)}</dl>
}

/** First visit only: three essentials, folding away after eight seconds. */
function FirstGuide(){
 const t=useT()
 const seen=useUiStore(s=>s.guideSeen),finish=useUiStore(s=>s.finishGuide)
 // Ready means the scene's own models reported in, not the idle state before loading begins.
 const loading=useProgress(s=>s.active),assetsReady=useForestStore(s=>s.boatReady&&s.fishingReady),walking=useForestStore(s=>s.mode==='walking'&&s.location==='island'&&!s.menuPaused)
 const show=!seen&&!loading&&assetsReady&&walking
 useEffect(()=>{if(!show)return;const timer=setTimeout(finish,guideLifetime);return()=>clearTimeout(timer)},[show,finish])
 if(!show)return null
 return <div className="ink-note guide" role="status">
  <span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> {t('guide.move')}</span><span><kbd>{t('key.rightButton')}</kbd> {t('guide.look')}</span><span><kbd>{t('key.wheel')}</kbd> {t('guide.zoom')}</span>
  <button type="button" className="close-button" onClick={finish} aria-label={t('guide.close')}><Icon name="close"/></button>
 </div>
}

const modeHints:Record<ModeHint,Key>={rowing:'hint.rowing',lookout:'hint.lookout',sitting:'hint.sitting'}
/** A mode's own controls, shown the first time only; afterwards just the current action remains. */
function ModeHintLine(){
 const t=useT()
 const mode=useForestStore(s=>s.mode),active=useUiStore(s=>s.activeHint),enterMode=useUiStore(s=>s.enterMode)
 useEffect(()=>enterMode(mode),[mode,enterMode])
 return active&&active===mode?<p className="ink-note mode-hint">{t(modeHints[active])}</p>:null
}

function Prompt(){
 const t=useT()
 const prompt=useForestStore(useShallow(promptFor))
 const s=useForestStore(useShallow(s=>({paused:s.menuPaused,mode:s.mode,inspecting:s.inspectingTree,nearby:s.nearby,feeding:s.feedingElapsed,planting:s.plantingElapsed,boat:s.boatTransfer?.direction,lookout:s.lookoutTransfer?.direction})))
 const interact=useForestStore(s=>s.interact)
 if(s.paused||!prompt)return null
 const info=prompt.status||s.mode==='feeding'||s.mode==='planting'||(s.nearby==='grove'&&s.inspecting&&s.mode==='walking')
 return <div className="interaction prompt" aria-live="polite" data-boat-transfer={s.boat} data-lookout-transfer={s.lookout}>
  {info&&<span className="ink-note prompt-info">
   {prompt.status&&<span className="prompt-status">{prompt.status}</span>}
   {s.mode==='feeding'&&<progress aria-label={t('progress.feeding')} value={s.feeding} max={1.6}/>}
   {s.mode==='planting'&&<progress aria-label={t('progress.planting')} value={s.planting} max={1.6}/>}
   {s.nearby==='grove'&&s.inspecting&&s.mode==='walking'&&<GrowthStatus/>}
  </span>}
  {prompt.action?<button type="button" className="action-button" onClick={interact}><kbd>F</kbd>{prompt.action}</button>:prompt.hint&&<span className="ink-note prompt-hint">{prompt.hint}</span>}
 </div>
}

/** One short line per event: ordinary feedback fades after four seconds, errors wait to be closed. */
function Notice(){
 const t=useT()
 const message=useForestStore(s=>s.message),kind=useForestStore(s=>s.messageKind),dismiss=useForestStore(s=>s.dismiss)
 const paused=useForestStore(s=>s.menuPaused),hudHidden=useUiStore(s=>s.hudHidden)
 useEffect(()=>{const life=noticeLifetime(kind);if(!message||life===null)return;const timer=setTimeout(dismiss,life);return()=>clearTimeout(timer)},[message,kind,dismiss])
 // Errors still reach a player who has hidden the interface.
 if(!message||paused||hudHidden&&kind!=='error')return null
 return <div className={`paper-note notice${kind==='error'?' notice-error':''}`} role={kind==='error'?'alert':'status'}>
  {kind==='error'&&<Icon name="alert"/>}<p>{message}</p><button type="button" className="close-button" onClick={dismiss} aria-label={t('notice.close')}><Icon name="close"/></button>
 </div>
}

/** H toggles the photo view anywhere except while typing; held keys never repeat it. */
function useHideShortcut(){
 const toggleHud=useUiStore(s=>s.toggleHud)
 useEffect(()=>{
  const down=(e:KeyboardEvent)=>{
   if(e.code!=='KeyH'||e.repeat||e.ctrlKey||e.metaKey||e.altKey)return
   if(e.target instanceof HTMLElement&&e.target.closest('input,textarea,[contenteditable]'))return
   toggleHud()
  }
  window.addEventListener('keydown',down)
  return()=>window.removeEventListener('keydown',down)
 },[toggleHud])
}

/** M toggles mute anywhere except while typing (range sliders included in the sound panel still allow it). */
function useMuteShortcut(){
 const toggleMute=useAudioStore(s=>s.toggleMute)
 useEffect(()=>{
  const down=(e:KeyboardEvent)=>{
   if(e.code!=='KeyM'||e.repeat||e.ctrlKey||e.metaKey||e.altKey)return
   if(e.target instanceof HTMLElement&&e.target.closest('input:not([type=range]):not([type=checkbox]),textarea,[contenteditable]'))return
   toggleMute()
  }
  window.addEventListener('keydown',down)
  return()=>window.removeEventListener('keydown',down)
 },[toggleMute])
}

/** All on-screen interface above the scene, in one place. */
export function Hud(){
 const t=useT()
 useHideShortcut()
 useMuteShortcut()
 const mode=useForestStore(s=>s.mode),paused=useForestStore(s=>s.menuPaused)
 const hudHidden=useUiStore(s=>s.hudHidden),toggleHud=useUiStore(s=>s.toggleHud)
 // A running game keeps its own card even in the photo view, so a hidden HUD never strands the player mid-task.
 const gameCards=!paused&&<>
  {mode==='fishing'&&<FishingHud/>}
  {mode==='crafting'&&<WorkshopHud/>}
  <HomeHud/>
 </>,lookout=!paused&&mode==='lookout'&&<LookoutHud/>
 if(hudHidden)return <div className="hud hud-hidden">
  <button type="button" className="show-hud" aria-label={t('menu.show')} title={`${t('menu.show')} (H)`} onClick={toggleHud}><Icon name="show"/></button>
  {gameCards}
  <div className="bottom-stack"><Notice/>{lookout}</div>
 </div>
 return <div className="hud">
  <TopBar/>
  <FirstGuide/>
  {gameCards}
  <div className="bottom-stack"><Notice/><ModeHintLine/><Prompt/>{lookout}</div>
  <MenuPanelView/>
 </div>
}
