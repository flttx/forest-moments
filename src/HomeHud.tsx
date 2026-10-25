import {sleepDuration} from './game/dayCycle'
import {useForestStore} from './game/store'
import {bedSpot,tankSpot,seats,seatOrigin,catchId,cabin,camp} from './game/expansion'

export function HomeHud(){
 const s=useForestStore(),p=s.position
 if(s.mode==='sitting')return <div className="interaction"><span>{s.sitting?.id==='stool'?'坐在亲手修好的木墩凳上':'坐下来，听听风声'}</span><button onClick={s.leaveSeat} disabled={s.sitting?.phase!=='idle'}>{s.sitting?.phase==='idle'?'起身 · F / Esc':'慢慢坐稳 / 起身…'}</button></div>
 if(s.mode==='sleeping')return <section className="sleep-panel" aria-label="小岛时光"><strong>{s.sleepJourney?.target==='day'?'等待日出':'看夕阳落下'}</strong><p>{s.sleepJourney?.target==='day'?'夜色渐退，晨光将照亮森林。':'暮色漫过海岸，小岛渐渐亮起灯火。'}</p><progress max={sleepDuration} value={s.sleepElapsed}/><button onClick={s.wakeUp}>跳过过渡 · F / Esc</button></section>
 if(s.homeTransfer)return <div className="interaction"><span>{s.homeTransfer.direction==='enter'?'回到林缘小屋':'走回森林'}</span><button disabled>请稍候…</button></div>
 if(s.location==='bedroom'){
  if(s.aquariumOpen){const available=s.fishBook.recent.filter(f=>!s.homeBook.usedCatchIds.includes(catchId(f)));return <section className="home-panel" aria-label="卧室鱼缸"><strong>窗边鱼缸 · {s.homeBook.fish.length} / 5</strong><p>把亲手钓到的锦鲤带回家。</p>
   {s.homeBook.fish.map(f=><div className="fish-choice" key={f.id}><span>锦鲤 · {f.sizeCm} cm</span><button onClick={()=>s.releaseFish(f.id)}>放归池塘</button></div>)}
   {available.length===0?<small>暂时没有可放入的渔获，去池塘钓一条吧。</small>:available.map(f=><div className="fish-choice" key={catchId(f)}><span>渔获 · {f.sizeCm} cm</span><button disabled={s.homeBook.fish.length>=5} onClick={()=>s.keepFish(catchId(f))}>放入鱼缸</button></div>)}
   <button onClick={()=>useForestStore.setState({aquariumOpen:false})}>返回房间 · Esc</button>
  </section>}
  const label=Math.hypot(p.x,p.z-2.5)<.9?'回到小岛':Math.hypot(p.x-bedSpot.x,p.z-bedSpot.z)<1?'上床休息':Math.hypot(p.x-tankSpot.x,p.z-tankSpot.z)<1.15?'看看鱼缸':null
  return <div className="interaction"><span>林缘卧室 · 已安睡 {s.homeBook.nights} 次</span><button onClick={s.interact} disabled={!label}>{label??'走近床边、鱼缸或门口'} <kbd>F</kbd></button></div>
 }
 if(s.location!=='island'||s.mode!=='walking')return null
 const seat=seats.find(v=>Math.hypot(p.x-seatOrigin(v).x,p.z-seatOrigin(v).z)<1.3)
 if(seat)return <div className="interaction"><span>{seat.name}</span><button onClick={s.interact}>坐下休息 <kbd>F</kbd></button></div>
 if(s.nearby==='bedroom')return <div className="interaction"><span>林缘卧室</span><button disabled={!s.homeReady||Math.hypot(p.x-cabin.x,p.z-cabin.doorZ)>=1.2} onClick={s.interact}>进入卧室 <kbd>F</kbd></button></div>
 if(s.nearby==='campfire')return <div className="interaction"><span>海风营地</span><button disabled={Math.hypot(p.x-camp.x,p.z-camp.z)>=2.1} onClick={s.interact}>{s.homeBook.fireLit?'熄灭篝火':'点燃篝火'} <kbd>F</kbd></button></div>
 return null
}
