import {useRef,useState} from 'react'
import {useLang,useT,type Key} from './i18n'
import {Icon,type IconName} from './Icon'
import {useJournalStore} from './game/journalStore'
import {pageDone,taskTarget,type StampId,type TaskId} from './game/journal'
import {useSeasonStore} from './game/seasonStore'
import {useUiStore} from './game/uiStore'
import type {SeasonRecap} from './game/seasons'

const none:SeasonRecap[]=[]

const stampIcon:Record<StampId,IconName>={pine:'pine',koi:'fishbook',flame:'flame',feather:'feather',boat:'boat',moon:'moon'}
const measured:Partial<Record<TaskId,Key>>={row:'journal.meters',fireside:'journal.seconds',mushrooms:'journal.count'}

/** A stamp in ink: one of six designs, rotating by page. */
export function Stamp({id,size=28}:{id:StampId;size?:number}){
 const t=useT()
 return <span className="stamp" role="img" aria-label={t(`journal.stamp.${id}` as Key)}><Icon name={stampIcon[id]} size={size}/></span>
}

/** The journal panel: this page's three small things, its stamp once full, and the stamps collected so far. */
export function JournalPanel(){
 const t=useT(),lang=useLang(s=>s.lang)
 const book=useJournalStore(s=>s.book),turn=useJournalStore(s=>s.turn)
 const recaps=useSeasonStore(s=>s.book?.recaps??none),view=useSeasonStore(s=>s.view),openPanel=useUiStore(s=>s.openPanel)
 const title=useRef<HTMLParagraphElement>(null)
 const [selected,setSelected]=useState<number|null>(null)
 const current=selected===null||selected>=book.page.number
 const number=current?book.page.number:selected
 const stamp=book.stamps.find(s=>s.page===number)
 const tasks=current?book.page.tasks:stamp?.tasks
 const full=current?pageDone(book.page):true
 const show=(n:number|null)=>{setSelected(n);requestAnimationFrame(()=>title.current?.focus())}
 const date=(at:string)=>new Date(at).toLocaleDateString(lang==='zh'?'zh-CN':'en-GB',{year:'numeric',month:'short',day:'numeric'})
 const time=(at:string)=>new Date(at).toLocaleTimeString(lang==='zh'?'zh-CN':'en-GB',{hour:'2-digit',minute:'2-digit'})
 return <div className="journal">
  <nav className="journal-nav" aria-label={t('journal.browse')}>
   <button type="button" disabled={number<=1} onClick={()=>show(number-1)} aria-label={t('journal.previous')}>←</button>
   <p ref={title} className="journal-page" tabIndex={-1}>{t('journal.page',{n:number})}</p>
   <button type="button" disabled={current} onClick={()=>show(number+1)} aria-label={t('journal.next')}>→</button>
  </nav>
  {!current&&<button type="button" className="journal-return" onClick={()=>show(null)}>{t('journal.current')}</button>}
  {!tasks&&<p className="empty journal-legacy">{t('journal.legacy')}</p>}
  <ul className="journal-tasks">
   {tasks?.map(task=>{
    const unit=measured[task.id]
    return <li key={task.id} className={task.doneAt?'done':undefined}>
     <Icon name={task.doneAt?'done':'todo'}/>
     <span>{t(`journal.task.${task.id}` as Key)}{!task.doneAt&&measured[task.id]&&<small className="journal-condition">{t(task.id==='row'?'journal.rowCondition':'journal.fireCondition')}</small>}</span>
     {task.doneAt?<small>{time(task.doneAt)}</small>:unit&&<small>{t(unit,{p:Math.floor(task.progress),target:taskTarget[task.id]})}</small>}
    </li>
   })}
  </ul>
  {full&&stamp&&<div className="journal-full">
   <Stamp id={stamp.stamp} size={40}/>
   <span>{t('journal.full')}<small className="journal-date">{date(stamp.doneAt)}</small></span>
   {/* The button leaves with the full page, so focus moves on to the new page's title. */}
   {current&&<button type="button" className="primary" onClick={()=>{turn();show(null)}}>{t('journal.turn')}</button>}
  </div>}
  <section className="journal-stamps">
   <h3>{t('journal.stamps',{n:book.stamps.length})}</h3>
   {book.stamps.length?<div className="stamp-row">{book.stamps.map(s=><button key={s.page} type="button" aria-label={t('journal.viewPage',{n:s.page})} aria-pressed={number===s.page} onClick={()=>show(s.page)}><Stamp id={s.stamp} size={22}/><small>{s.page}</small></button>)}</div>:<p className="empty">{t('journal.noStamps')}</p>}
  </section>
  {recaps.length>0&&<section className="journal-stamps">
   <h3>{t('season.title')}</h3>
 <div className="recap-row">{recaps.map((r,i)=><button key={r.startDay} type="button" className="tool-button" onClick={()=>{view(i);openPanel('season')}}>{t(`season.${r.season}`)}<small>{t('season.days',{from:r.startDay+1,to:r.endDay})}</small></button>)}</div>
  </section>}
 </div>
}
