import {useForestStore} from './game/store'
import {craftCursor,workshopAction} from './game/workshop'

export function WorkshopHud(){
 const mode=useForestStore(s=>s.mode),book=useForestStore(s=>s.workshopBook),craft=useForestStore(s=>s.craft)
 const action=useForestStore(s=>workshopAction(s.position,s.workshopBook,s.location==='workshop'?'workshop':'island')),ready=useForestStore(s=>s.workshopReady)
 const interact=useForestStore(s=>s.interact),cancel=useForestStore(s=>s.cancelWorkshop)
 const inside=useForestStore(s=>s.location==='workshop'),transfer=useForestStore(s=>s.workshopTransfer)
 if(mode==='crafting'&&craft)return <section className="craft-hud" aria-label="木墩修整">
   <strong>修整木墩凳 · {Math.min(craft.steps+1,3)} / 3</strong>
   <span>{['磨平木面','磨顺边缘','最后抛光'][Math.min(craft.steps,2)]}</span>
   <div className="craft-meter" role="meter" aria-label="打磨节奏" aria-valuemin={0} aria-valuemax={1} aria-valuenow={craftCursor(craft.elapsed)}><i/><b style={{left:`${craftCursor(craft.elapsed)*100}%`}}/></div>
   <small role="status">{craft.feedback}</small>
   <button onClick={interact} disabled={craft.stroke>0||craft.steps===3}>打磨 <kbd>F</kbd></button><button onClick={cancel}>暂停 <kbd>Esc</kbd></button>
 </section>
 const label=transfer?'正在通过门口':action==='enter'?'进入工坊':action==='exit'?'回到小岛':mode==='gathering'?'正在收好木墩':action==='collect'?'收好旧木墩':action==='inspect'?'坐在木墩凳上':book.phase==='available'?(inside?'出门寻找旧木墩':'走到工坊正门'):action==='craft'?'开始修整':'走到木工台前'
 return <div className="interaction" aria-live="polite"><span>{book.phase==='finished'?'木墩凳 · 已完成':book.phase==='carrying'?'材料 · 旧木墩 1 / 1':'材料 · 旧木墩 0 / 1'}</span><button onClick={interact} disabled={!ready||mode==='gathering'||!!transfer}>{label} <kbd>F</kbd></button></div>
}
