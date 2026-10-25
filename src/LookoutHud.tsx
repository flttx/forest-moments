import {useForestStore} from './game/store'

export function LookoutHud(){
 const view=useForestStore(s=>s.lookoutView),turn=useForestStore(s=>s.turnLookout),leave=useForestStore(s=>s.leaveLookout)
 const heading=((view.yaw*180/Math.PI)+360)%360
 const direction=['南','东南','东','东北','北','西北','西','西南'][Math.round(heading/45)%8]
 return <section className="interaction prompt lookout-hud" aria-label="塔上观景">
   <span className="prompt-status">朝{direction}</span>
   <button type="button" className="quiet" aria-label="向左环顾" onClick={()=>turn(.25,0)}>←</button>
   <button type="button" className="quiet" aria-label="向右环顾" onClick={()=>turn(-.25,0)}>→</button>
   <button type="button" onClick={leave}><kbd>F</kbd>返回塔脚</button>
 </section>
}
