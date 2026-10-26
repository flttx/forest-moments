import {useRef} from 'react'
import {useLang,useT,type Key} from './i18n'
import {Icon,type IconName} from './Icon'
import {useJournalStore} from './game/journalStore'
import {pageDone,taskTarget,type StampId,type TaskId} from './game/journal'

const stampIcon:Record<StampId,IconName>={pine:'pine',koi:'fishbook',flame:'flame',feather:'feather',boat:'boat',moon:'moon'}
const measured:Partial<Record<TaskId,Key>>={row:'journal.meters',fireside:'journal.seconds'}

/** A stamp in ink: one of six designs, rotating by page. */
export function Stamp({id,size=28}:{id:StampId;size?:number}){
 const t=useT()
 return <span className="stamp" role="img" aria-label={t(`journal.stamp.${id}` as Key)}><Icon name={stampIcon[id]} size={size}/></span>
}

/** The journal panel: this page's three small things, its stamp once full, and the stamps collected so far. */
export function JournalPanel(){
 const t=useT(),lang=useLang(s=>s.lang)
 const book=useJournalStore(s=>s.book),turn=useJournalStore(s=>s.turn)
 const title=useRef<HTMLParagraphElement>(null)
 const full=pageDone(book.page),stamp=full?book.stamps.at(-1):undefined
 const time=(at:string)=>new Date(at).toLocaleTimeString(lang==='zh'?'zh-CN':'en-GB',{hour:'2-digit',minute:'2-digit'})
 return <div className="journal">
  <p ref={title} className="journal-page" tabIndex={-1}>{t('journal.page',{n:book.page.number})}</p>
  <ul className="journal-tasks">
   {book.page.tasks.map(task=>{
    const unit=measured[task.id]
    return <li key={task.id} className={task.doneAt?'done':undefined}>
     <Icon name={task.doneAt?'done':'todo'}/>
     <span>{t(`journal.task.${task.id}` as Key)}</span>
     {task.doneAt?<small>{time(task.doneAt)}</small>:unit&&<small>{t(unit,{p:Math.floor(task.progress),target:taskTarget[task.id]})}</small>}
    </li>
   })}
  </ul>
  {stamp&&<div className="journal-full">
   <Stamp id={stamp.stamp} size={40}/>
   <span>{t('journal.full')}</span>
   {/* The button leaves with the full page, so focus moves on to the new page's title. */}
   <button type="button" className="primary" onClick={()=>{turn();requestAnimationFrame(()=>title.current?.focus())}}>{t('journal.turn')}</button>
  </div>}
  <section className="journal-stamps">
   <h3>{t('journal.stamps',{n:book.stamps.length})}</h3>
   {book.stamps.length?<div className="stamp-row">{book.stamps.slice(-12).map(s=><Stamp key={s.page} id={s.stamp} size={22}/>)}</div>:<p className="empty">{t('journal.noStamps')}</p>}
  </section>
 </div>
}
