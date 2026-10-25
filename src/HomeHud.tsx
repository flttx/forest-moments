import {useForestStore} from './game/store'
import {catchId} from './game/expansion'
import {useDialogFocus} from './useDialogFocus'

const closeTank=()=>useForestStore.setState({aquariumOpen:false})

function Aquarium(){
 const s=useForestStore()
 const {ref,trap}=useDialogFocus<HTMLElement>(true)
 const available=s.fishBook.recent.filter(f=>!s.homeBook.usedCatchIds.includes(catchId(f)))
 const full=s.homeBook.fish.length>=5
 return <section ref={ref} className="paper-panel home-panel" role="dialog" aria-modal="true" aria-label="卧室鱼缸" onKeyDown={e=>{trap(e);if(e.key==='Escape'){e.preventDefault();e.stopPropagation();closeTank()}}}>
  <header><h2>鱼缸 · {s.homeBook.fish.length} / 5</h2><button type="button" className="close-button" onClick={closeTank} aria-label="关闭鱼缸">×</button></header>
  <div className="panel-body">
   {s.homeBook.fish.map(f=><div className="fish-choice" key={f.id}><span>锦鲤 · {f.sizeCm} cm</span><button type="button" onClick={()=>s.releaseFish(f.id)}>放归池塘</button></div>)}
   {available.length===0?(s.homeBook.fish.length===0&&<p className="empty">还没有可放入的渔获</p>):available.map(f=><div className="fish-choice" key={catchId(f)}><span>渔获 · {f.sizeCm} cm</span><button type="button" disabled={full} onClick={()=>s.keepFish(catchId(f))}>放入鱼缸</button></div>)}
  </div>
 </section>
}

/** Sleep and aquarium cards; everyday bedroom and seat actions use the shared bottom prompt. */
export function HomeHud(){
 const sleeping=useForestStore(s=>s.mode==='sleeping'),target=useForestStore(s=>s.sleepJourney?.target),wakeUp=useForestStore(s=>s.wakeUp)
 const tank=useForestStore(s=>s.location==='bedroom'&&s.aquariumOpen)
 if(sleeping)return <section className="sleep-panel" aria-label="小岛时光"><strong>{target==='day'?'日出':'日落'}</strong><button type="button" onClick={wakeUp}>跳过</button></section>
 return tank?<Aquarium/>:null
}
