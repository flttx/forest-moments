import {useEffect,useState} from 'react'
import {useForestStore} from './game/store'
import {growthRemaining,growthStages} from './game/growth'

/** Growth details, shown only while the player is looking at the tree. */
export function GrowthStatus(){
 const tree=useForestStore(s=>s.tree)
 const [now,setNow]=useState(()=>Date.now())
 useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer)},[])
 if(!tree)return null
 const seconds=growthRemaining(tree,now)
 return <span className="prompt-status" data-growth-stage={growthStages[tree.stage].id}>{growthStages[tree.stage].label} · {tree.stage===3?'已长成':`约 ${seconds>=60?`${Math.ceil(seconds/60)} 分钟`:`${seconds} 秒`}后长大`}</span>
}
