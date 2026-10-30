import {noteSecretAt} from './secrets'
import {t} from '../i18n'
import {bedSpot,cabin,camp,seats,seatOrigin,tankSpot} from './expansion'
import {brushSpot,eggReady,eggSpot,feedSpot,woolReady} from './farm'
import {spotNear} from './forage'
import {woodReady} from './recipes'
import {logPile} from '../world/settlement'
import {fishingSites,fishingSpot} from './fishing'
import {plantedToday,plotNear,treeAt} from './growth'
import {canViewLookout} from './lookout'
import {approachBerth,canBoard,landingBerth,seaBoundaryClearance} from './rowing'
import {canLaunch,nearLaunch} from './lanterns'
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
 if(s.boatTransfer)return{status:s.boatTransfer.direction==='board'?t('prompt.boarding'):t('prompt.landing')}
 if(s.lookoutTransfer)return{status:s.lookoutTransfer.direction==='enter'?t('prompt.towerUp'):t('prompt.towerDown')}
 if(s.workshopTransfer)return{status:t('prompt.doorway')}
 if(s.homeTransfer)return{status:s.homeTransfer.direction==='enter'?t('prompt.homeIn'):t('prompt.homeOut')}
 // These modes show their own card (fishing, crafting, sleep, aquarium, lookout).
 if(['fishing','crafting','sleeping','lookout'].includes(s.mode)||s.aquariumOpen)return null
 if(s.mode==='sitting')return s.sitting?.phase==='idle'?{action:t('prompt.standUp')}:{status:s.sitting?.phase==='up'?t('prompt.standingUp'):t('prompt.sittingDown')}
 if(s.mode==='gathering')return{status:t('prompt.gathering')}
 if(s.mode==='foraging')return{status:t('prompt.foraging')}
 if(s.mode==='feeding')return{status:t('prompt.feeding')}
 if(s.mode==='planting')return{status:t('prompt.planting')}
 if(s.mode==='launching')return{status:t('prompt.launching')}
 if(s.mode==='rowing'){
  const berth=landingBerth(s.boat)
  return berth?{action:t('travel.landAt',{name:t(berth.id==='main'?'place.dock':`place.${berth.id}`)})}:approachBerth(s.boat)?{hint:t('travel.brake')}:seaBoundaryClearance(s.boat.x,s.boat.z)<2?{hint:t('prompt.openSea')}:{hint:t('travel.sailing')}
 }
 if(s.location==='bedroom'){
  if(near(p,{x:0,z:2.5},.9))return{action:t('prompt.toIsland')}
  if(near(p,bedSpot,1))return{action:t('prompt.sleep')}
  if(near(p,tankSpot,1.15))return{action:t('prompt.tank')}
  return null
 }
 if(s.location==='island'){
  if(seats.some(v=>near(p,seatOrigin(v),1.3)))return{action:t('prompt.sit')}
  const note=s.mode==='walking'?noteSecretAt(p):null
  if(note)return{action:t(`prompt.${note}`)}
  const spot=s.mode==='walking'?spotNear(p,s.forageBook,s.homeBook.nights):null
  if(spot)return{action:t('prompt.forage',{item:t(`item.${spot.kind}`)})}
  if(s.mode==='walking'&&near(p,logPile,1.4))return woodReady(s.workshopBook,s.homeBook.nights)?{action:t('prompt.wood')}:{hint:t('msg.woodTaken')}
  if(near(p,camp,2.1))return{action:s.homeBook.fireLit?t('prompt.fireOut'):t('prompt.fireLight')}
  if(near(p,{x:cabin.x,z:cabin.doorZ},1.2))return s.homeReady?{action:t('prompt.enterBedroom')}:{status:t('prompt.bedroomLoading')}
  if(s.mode==='walking'&&nearLaunch(p))return canLaunch(s.timeOfDay)?{action:t('prompt.lantern')}:{hint:t('prompt.lanternDay')}
  const plot=s.mode==='walking'?plotNear(p):null
  if(plot!==null){
   if(treeAt(s.garden,plot))return{action:s.inspectingTree&&s.plot===plot?t('prompt.walkOn'):t('prompt.lookTree')}
   return !s.growthReady?{status:t('prompt.treeLoading')}:plantedToday(s.garden,s.homeBook.nights)?{hint:t('prompt.plantedToday')}:{action:t('prompt.plant')}
  }
  if(s.nearby==='campfire')return{hint:t('prompt.toFire')}
  if(s.nearby==='bedroom')return{hint:t('prompt.toCabin')}
 }
 switch(s.nearby){
  case 'workshop':{
   if(!s.workshopReady)return{status:t('prompt.workshopLoading')}
   const inside=s.location==='workshop',book=s.workshopBook,action=workshopAction(p,book,inside?'workshop':'island')
   if(action==='enter')return{action:t('prompt.enterWorkshop')}
   if(action==='exit')return{action:t('prompt.toIsland')}
   if(action==='collect')return{action:t('prompt.collectStump')}
   if(action==='inspect')return{action:t('prompt.sitStool')}
   if(action==='recipes')return{action:t('prompt.recipes')}
   if(action==='craft'&&book.phase==='carrying')return{action:t('prompt.startCraft')}
   // Materials are mentioned only while they are still missing.
   if(book.phase==='available')return{hint:inside?t('prompt.stumpInside'):t('prompt.stumpOutside')}
   return{hint:inside?t('prompt.toBench'):t('prompt.toWorkshopDoor')}
  }
  case 'lookout':return !s.lookoutReady?{status:t('prompt.lookoutLoading')}:canViewLookout(p)?{action:t('prompt.enterLookout')}:{hint:t('prompt.toStairs')}
  case 'farm':
   if(s.farmReady&&eggReady(s.farmBook,s.homeBook.nights)&&near(p,eggSpot,.9))return{action:t('prompt.egg')}
   if(s.farmReady&&!s.mealActive&&woolReady(s.farmBook,s.homeBook.nights)&&near(p,brushSpot,1))return{action:t('prompt.wool')}
   return !s.farmReady?{status:t('prompt.farmLoading')}:s.mealActive?{hint:t('prompt.mealActive')}:near(p,feedSpot,.65)?{action:t('prompt.feed')}:{hint:t('prompt.toTrough')}
  case 'pond':return !s.fishingReady?{status:t('prompt.fishingLoading')}:near(p,fishingSpot,.85)?{action:t('prompt.cast')}:{hint:t('prompt.toFishingSpot')}
  case 'dock':return !s.boatReady?{status:t('prompt.boatLoading')}:canBoard(p.x,p.z,s.boat)?{action:t('prompt.board')}:near(p,fishingSites.sea.stand,.85)?{action:t('prompt.castSea')}:{hint:t('prompt.toDockEnd')}
  case 'grove':return{hint:t('prompt.toPlot')}
  case 'tidePools':return{hint:t('place.tidePools.hint')}
  case 'tide':
  case 'autumn':
  case 'mist':return !s.boatReady?{status:t('prompt.boatLoading')}:canBoard(p.x,p.z,s.boat)?{action:t('prompt.board')}:{hint:t('prompt.toDockEnd')}
  case 'autumnVista':return{hint:t('place.autumnVista.hint')}
  case 'mistPine':return{hint:t('place.mistPine.hint')}
  default:return null
 }
}
