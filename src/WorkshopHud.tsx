import {useForestStore} from './game/store'
import {craftCursor} from './game/workshop'

const firstFeedback='指针进入浅绿区域时按 F 打磨。'

/** Crafting card: step, rhythm bar and the latest result. Walking prompts live in the shared bottom prompt. */
export function WorkshopHud(){
 const craft=useForestStore(s=>s.craft)
 const interact=useForestStore(s=>s.interact),cancel=useForestStore(s=>s.cancelWorkshop)
 if(!craft)return null
 const feedback=craft.feedback===firstFeedback?'':craft.feedback
 return <section className="paper-card craft-hud" aria-label="木墩修整">
   <strong>{['磨平木面','磨顺边缘','最后抛光'][Math.min(craft.steps,2)]} · {Math.min(craft.steps+1,3)} / 3</strong>
   <div className="craft-meter" role="meter" aria-label="打磨节奏" aria-valuemin={0} aria-valuemax={1} aria-valuenow={craftCursor(craft.elapsed)}><i/><b style={{left:`${craftCursor(craft.elapsed)*100}%`}}/></div>
   <small role="status">{feedback||'绿色区按 F'}</small>
   <button type="button" className="primary" onClick={interact} disabled={craft.stroke>0||craft.steps===3}><kbd>F</kbd>打磨</button><button type="button" className="quiet" onClick={cancel}><kbd>Esc</kbd>暂停</button>
 </section>
}
