import {useEffect,useState} from 'react'
import {useForestStore} from './game/store'
import {growthRemaining,growthStages} from './game/growth'
import {useT} from './i18n'

/** Growth details, shown only while the player is looking at the tree. */
export function GrowthStatus(){
 const t=useT()
 const tree=useForestStore(s=>s.tree)
 const [now,setNow]=useState(()=>Date.now())
 useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer)},[])
 if(!tree)return null
 const seconds=growthRemaining(tree,now),stage=growthStages[tree.stage]
 return <span className="prompt-status" data-growth-stage={stage.id}>{t(`growth.${stage.id}`)} · {tree.stage===3?t('growth.grown'):seconds>=60?t('growth.minutes',{n:Math.ceil(seconds/60)}):t('growth.seconds',{n:seconds})}</span>
}
