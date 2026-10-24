import {useEffect,useState} from 'react'
import {useForestStore} from './game/store'
import {growthRemaining,growthStages} from './game/growth'
export function GrowthStatus(){
 const tree=useForestStore(s=>s.tree),mode=useForestStore(s=>s.mode),elapsed=useForestStore(s=>s.plantingElapsed)
 const [now,setNow]=useState(()=>Date.now())
 useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer)},[])
 if(mode==='planting')return <span>正在安放小苗… <progress aria-label="栽种进度" value={elapsed} max={1.6}/></span>
 if(!tree)return <span>种植角 · 种下一株小苗，看看它慢慢长大</span>
 const seconds=growthRemaining(tree,now)
 return <span data-growth-stage={growthStages[tree.stage].id}>{growthStages[tree.stage].label} · {tree.stage===3?'已长成':`约 ${seconds>=60?`${Math.ceil(seconds/60)} 分钟`:`${seconds} 秒`}后进入下一阶段`}</span>
}
