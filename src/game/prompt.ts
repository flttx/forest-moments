import {bedSpot,cabin,camp,seats,seatOrigin,tankSpot} from './expansion'
import {feedSpot} from './farm'
import {fishingSpot} from './fishing'
import {plantingSpot} from './growth'
import {canViewLookout} from './lookout'
import {canBoard,canLand,seaBoundaryClearance} from './rowing'
import type {useForestStore} from './store'
import {workshopAction} from './workshop'

/**
 * The single bottom prompt. `action` is only offered when pressing F would really do it; otherwise
 * `hint` says where to go. `status` describes something already in progress. Mirrors interact().
 */
export interface Prompt{action?:string;hint?:string;status?:string}
type State=ReturnType<typeof useForestStore.getState>
const near=(p:{x:number;z:number},q:{x:number;z:number},r:number)=>Math.hypot(p.x-q.x,p.z-q.z)<r

export function promptFor(s:State):Prompt|null{
 const p=s.position
 if(s.boatTransfer)return{status:s.boatTransfer.direction==='board'?'正在上船…':'正在回到码头…'}
 if(s.lookoutTransfer)return{status:s.lookoutTransfer.direction==='enter'?'正在登上塔顶…':'正在回到塔脚…'}
 if(s.workshopTransfer)return{status:'正在穿过门口…'}
 if(s.homeTransfer)return{status:s.homeTransfer.direction==='enter'?'正在回到小屋…':'正在走回森林…'}
 // These modes show their own card (fishing, crafting, sleep, aquarium, lookout).
 if(['fishing','crafting','sleeping','lookout'].includes(s.mode)||s.aquariumOpen)return null
 if(s.mode==='sitting')return s.sitting?.phase==='idle'?{action:'起身'}:{status:s.sitting?.phase==='up'?'起身中…':'慢慢坐下…'}
 if(s.mode==='gathering')return{status:'正在收好旧木墩…'}
 if(s.mode==='feeding')return{status:'正在撒下谷粒…'}
 if(s.mode==='planting')return{status:'正在种下小苗…'}
 if(s.mode==='rowing')return canLand(s.boat)?{action:'下船'}:seaBoundaryClearance(s.boat.x,s.boat.z)<2?{hint:'前方是远海，请沿岸航行'}:null
 if(s.location==='bedroom'){
  if(near(p,{x:0,z:2.5},.9))return{action:'回到小岛'}
  if(near(p,bedSpot,1))return{action:'上床休息'}
  if(near(p,tankSpot,1.15))return{action:'看看鱼缸'}
  return null
 }
 if(s.location==='island'){
  if(seats.some(v=>near(p,seatOrigin(v),1.3)))return{action:'坐下'}
  if(near(p,camp,2.1))return{action:s.homeBook.fireLit?'熄灭篝火':'点燃篝火'}
  if(near(p,{x:cabin.x,z:cabin.doorZ},1.2))return s.homeReady?{action:'进入卧室'}:{status:'卧室准备中…'}
  if(s.nearby==='campfire')return{hint:'走近石圈'}
  if(s.nearby==='bedroom')return{hint:'走到小屋门前'}
 }
 switch(s.nearby){
  case 'workshop':{
   if(!s.workshopReady)return{status:'工坊准备中…'}
   const inside=s.location==='workshop',book=s.workshopBook,action=workshopAction(p,book,inside?'workshop':'island')
   if(action==='enter')return{action:'进入工坊'}
   if(action==='exit')return{action:'回到小岛'}
   if(action==='collect')return{action:'收好旧木墩'}
   if(action==='inspect')return{action:'坐上木墩凳'}
   if(action==='craft'&&book.phase==='carrying')return{action:'开始修整'}
   // Materials are mentioned only while they are still missing.
   if(book.phase==='available')return{hint:inside?'缺少旧木墩 · 出门到工坊东侧路边找':'缺少旧木墩 · 在工坊东侧路边'}
   return{hint:inside?'走到木工台前':'走到工坊正门'}
  }
  case 'lookout':return !s.lookoutReady?{status:'瞭望塔准备中…'}:canViewLookout(p)?{action:'进入观景'}:{hint:'绕到塔东侧的楼梯脚'}
  case 'farm':return !s.farmReady?{status:'牧场准备中…'}:s.mealActive?{hint:'它们正在吃饭，留出通道'}:near(p,feedSpot,.65)?{action:'添一份饲料'}:{hint:'从北侧开口进围栏，走到食槽左边'}
  case 'pond':return !s.fishingReady?{status:'钓具准备中…'}:near(p,fishingSpot,.85)?{action:'抛竿钓鱼'}:{hint:'走到池塘西岸的钓点'}
  case 'dock':return !s.boatReady?{status:'木船准备中…'}:canBoard(p.x,p.z,s.boat)?{action:'上船'}:{hint:'走到码头靠水的一端'}
  case 'grove':
   if(s.planted)return{action:s.inspectingTree?'返回漫游':'看看小树'}
   return !s.growthReady?{status:'树苗准备中…'}:near(p,plantingSpot,1.8)?{action:'种一棵树'}:{hint:'走近种植角的空地'}
  default:return null
 }
}
