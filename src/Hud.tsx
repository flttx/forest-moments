import {useEffect} from 'react'
import {useDialogFocus} from './useDialogFocus'
import {useProgress} from '@react-three/drei'
import {useShallow} from 'zustand/react/shallow'
import {useForestStore} from './game/store'
import {useUiStore,noticeLifetime,guideLifetime,type MenuPanel,type ModeHint} from './game/uiStore'
import {promptFor} from './game/prompt'
import {landmarks} from './game/landmarks'
import {growthStages} from './game/growth'
import {FishingHud} from './FishingHud'
import {HomeHud} from './HomeHud'
import {WorkshopHud} from './WorkshopHud'
import {LookoutHud} from './LookoutHud'
import {GrowthStatus} from './GrowthStatus'

const menuItems:[MenuPanel,string][]=[['places','地点'],['fishbook','鱼簿'],['help','帮助']]
const inTransfer=(s:ReturnType<typeof useForestStore.getState>)=>!!(s.boatTransfer||s.lookoutTransfer||s.workshopTransfer||s.homeTransfer)

/** Small title and three light menu entries; both step aside during transfers and sleep. */
function TopBar(){
 const panel=useUiStore(s=>s.panel),openPanel=useUiStore(s=>s.openPanel),closePanel=useUiStore(s=>s.closePanel)
 const hidden=useForestStore(s=>s.mode==='sleeping'||inTransfer(s))
 if(hidden)return null
 return <>
  <div className="brand">森林拾光</div>
  <nav className="menu" aria-label="菜单">
   {menuItems.map(([id,label])=><button key={id} type="button" className="paper-button" aria-haspopup="dialog" aria-expanded={panel===id} aria-controls="menu-panel" onClick={()=>panel===id?closePanel():openPanel(id)}>{label}</button>)}
  </nav>
 </>
}

function MenuPanelView(){
 const panel=useUiStore(s=>s.panel),closePanel=useUiStore(s=>s.closePanel)
 const {ref,trap}=useDialogFocus<HTMLElement>(!!panel)
 if(!panel)return null
 const title=menuItems.find(([id])=>id===panel)![1]
 return <section id="menu-panel" ref={ref} className="paper-panel menu-panel" role="dialog" aria-modal="true" aria-labelledby="menu-panel-title"
  onKeyDown={e=>{trap(e);if(e.key==='Escape'){e.preventDefault();e.stopPropagation();closePanel()}}} onWheel={e=>e.stopPropagation()}>
  <header><h2 id="menu-panel-title">{title}</h2><button type="button" className="close-button" onClick={closePanel} aria-label="关闭面板">×</button></header>
  <div className="panel-body">{panel==='places'?<Places/>:panel==='fishbook'?<FishBook/>:<Help/>}</div>
 </section>
}

function Places(){
 const s=useForestStore(useShallow(s=>({nearby:s.nearby,meals:s.farmBook.meals,tree:s.tree,nights:s.homeBook.nights,fireLit:s.homeBook.fireLit,phase:s.workshopBook.phase,fish:s.fishBook.count})))
 const status:Partial<Record<(typeof landmarks)[number]['id'],string>>={
  bedroom:`已安睡 ${s.nights} 次`,campfire:s.fireLit?'篝火燃着':'篝火未点燃',workshop:s.phase==='finished'?'木墩凳已完成':s.phase==='carrying'?'旧木墩已收好':'还没找到旧木墩',
  farm:`已喂养 ${s.meals} 次`,pond:`已钓到 ${s.fish} 尾`,grove:s.tree?`已种植 · ${growthStages[s.tree.stage].label}`:'还没种树',
 }
 return <ul className="place-list">{landmarks.map(p=><li key={p.id} className={s.nearby===p.id?'here':undefined}>
  <strong>{p.name}{s.nearby===p.id&&<em> · 就在附近</em>}</strong><p>{p.hint}</p>{status[p.id]&&<small>{status[p.id]}</small>}
 </li>)}</ul>
}

function FishBook(){
 const book=useForestStore(s=>s.fishBook)
 if(!book.count)return <p className="empty">还没有渔获</p>
 return <><p>锦鲤 · {book.count} 尾 · 最大 {book.bestCm} cm</p><ol className="catch-list">{book.recent.slice(0,8).map((fish,i)=><li key={`${fish.at}-${i}`}>{fish.sizeCm} cm · {new Date(fish.at).toLocaleDateString('zh-CN')}</li>)}</ol></>
}

const helpRows:[string,string[]][]=[
 ['移动',['W','A','S','D']],['奔跑',['Shift']],['转动视角',['右键拖动']],['环绕',['Q','E']],['远近',['滚轮']],['互动',['F']],['返回 / 关闭',['Esc']],
 ['钓鱼：提竿',['F']],['钓鱼：收线',['按住 Space']],['划船',['W','S']],['划船转向',['A','D']],['塔上环顾',['A','D','W','S']],
]
function Help(){
 return <dl className="help-list">{helpRows.map(([label,keys])=><div key={label}><dt>{label}</dt><dd>{keys.map(k=><kbd key={k}>{k}</kbd>)}</dd></div>)}</dl>
}

/** First visit only: three essentials, folding away after eight seconds. */
function FirstGuide(){
 const seen=useUiStore(s=>s.guideSeen),finish=useUiStore(s=>s.finishGuide)
 // Ready means the scene's own models reported in, not the idle state before loading begins.
 const loading=useProgress(s=>s.active),assetsReady=useForestStore(s=>s.boatReady&&s.fishingReady),walking=useForestStore(s=>s.mode==='walking'&&s.location==='island'&&!s.menuPaused)
 const show=!seen&&!loading&&assetsReady&&walking
 useEffect(()=>{if(!show)return;const timer=setTimeout(finish,guideLifetime);return()=>clearTimeout(timer)},[show,finish])
 if(!show)return null
 return <div className="paper-note guide" role="status">
  <span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> 移动</span><span><kbd>右键</kbd> 视角</span><span><kbd>滚轮</kbd> 缩放</span>
  <button type="button" className="close-button" onClick={finish} aria-label="收起操作引导">×</button>
 </div>
}

const modeHints:Record<ModeHint,string>={rowing:'W / S 划船 · A / D 转向 · 回到码头按 F 下船',lookout:'A / D 环顾 · W / S 俯仰',sitting:'F 或 Esc 起身'}
/** A mode's own controls, shown the first time only; afterwards just the current action remains. */
function ModeHintLine(){
 const mode=useForestStore(s=>s.mode),active=useUiStore(s=>s.activeHint),enterMode=useUiStore(s=>s.enterMode)
 useEffect(()=>enterMode(mode),[mode,enterMode])
 return active&&active===mode?<p className="mode-hint">{modeHints[active]}</p>:null
}

function Prompt(){
 const prompt=useForestStore(useShallow(promptFor))
 const s=useForestStore(useShallow(s=>({paused:s.menuPaused,mode:s.mode,inspecting:s.inspectingTree,nearby:s.nearby,feeding:s.feedingElapsed,planting:s.plantingElapsed,boat:s.boatTransfer?.direction,lookout:s.lookoutTransfer?.direction})))
 const interact=useForestStore(s=>s.interact)
 if(s.paused||!prompt)return null
 return <div className="interaction prompt" aria-live="polite" data-boat-transfer={s.boat} data-lookout-transfer={s.lookout}>
  {prompt.status&&<span className="prompt-status">{prompt.status}</span>}
  {s.mode==='feeding'&&<progress aria-label="添料进度" value={s.feeding} max={1.6}/>}
  {s.mode==='planting'&&<progress aria-label="栽种进度" value={s.planting} max={1.6}/>}
  {s.nearby==='grove'&&s.inspecting&&s.mode==='walking'&&<GrowthStatus/>}
  {prompt.action?<button type="button" onClick={interact}><kbd>F</kbd>{prompt.action}</button>:prompt.hint&&<span className="prompt-hint">{prompt.hint}</span>}
 </div>
}

/** One short line per event: ordinary feedback fades after four seconds, errors wait to be closed. */
function Notice(){
 const message=useForestStore(s=>s.message),kind=useForestStore(s=>s.messageKind),dismiss=useForestStore(s=>s.dismiss)
 const paused=useForestStore(s=>s.menuPaused)
 useEffect(()=>{const life=noticeLifetime(kind);if(!message||life===null)return;const timer=setTimeout(dismiss,life);return()=>clearTimeout(timer)},[message,kind,dismiss])
 if(!message||paused)return null
 return <div className={`paper-note notice${kind==='error'?' notice-error':''}`} role={kind==='error'?'alert':'status'}>
  <p>{message}</p><button type="button" className="close-button" onClick={dismiss} aria-label="关闭提示">×</button>
 </div>
}

/** All on-screen interface above the scene, in one place. */
export function Hud(){
 const mode=useForestStore(s=>s.mode),paused=useForestStore(s=>s.menuPaused)
 return <div className="hud">
  <TopBar/>
  <FirstGuide/>
  {!paused&&<>
   {mode==='fishing'&&<FishingHud/>}
   {mode==='crafting'&&<WorkshopHud/>}
   {mode==='lookout'&&<LookoutHud/>}
   <HomeHud/>
  </>}
  <div className="bottom-stack"><Notice/><ModeHintLine/><Prompt/></div>
  <MenuPanelView/>
 </div>
}
