import { create } from 'zustand'
import { findNearestLandmark, landmarks, type LandmarkId } from './landmarks'
import { canBoard, canLand, initialBoat, landing, type BoatState } from './rowing'
import { beginFishing, catchStorageKey, decodeCatchBook, emptyBook, fishingSpot, stepFishing, strikeFish, type CatchBook, type FishingState } from './fishing'
import {advanceTree,decodeTree,growthStages,growthStorageKey,legacySeedlingKey,plantingSpot,type PlantedTree} from './growth'
import {transferCommit,transferDuration,type BoatTransfer} from './boatPresentation'
import {decodeFarm,farmStorageKey,feedSpot,type FarmBook} from './farm'
import {canViewLookout,initialLookoutView,turnLookout,type LookoutView,type LookoutTransfer} from './lookout'
import {decodeWorkshop,workshopDoor,workshopStorageKey,workshopAction,strikeCraft,type WorkshopBook,type CraftSession,craftSpot,indoorSpawn,type WorkshopTransfer} from './workshop'

function saveWorkshop(book:WorkshopBook){try{window.localStorage.setItem(workshopStorageKey,JSON.stringify(book));return true}catch{return false}}

function saveTree(tree:PlantedTree){try{window.localStorage.setItem(growthStorageKey,JSON.stringify(tree));return true}catch{return false}}
function loadTree(){try{const tree=decodeTree(window.localStorage.getItem(growthStorageKey),window.localStorage.getItem(legacySeedlingKey),Date.now());if(tree)saveTree(tree);return tree}catch{return null}}
const initialTree=typeof window!=='undefined'?loadTree():null

type ForestState = {
  mode: 'walking' | 'rowing' | 'fishing' | 'planting' | 'feeding' | 'lookout' | 'gathering' | 'crafting'
  location: 'island'|'workshop'
  workshopTransfer:WorkshopTransfer|null
  workshopReturn:{x:number;z:number}
  tickWorkshopTransfer:(delta:number)=>boolean
  workshopBook:WorkshopBook
  workshopReady:boolean
  gatheringElapsed:number
  craft:CraftSession|null
  tickWorkshop:(delta:number)=>void
  cancelWorkshop:()=>void
  lookoutReady:boolean
  lookoutView:LookoutView
  lookoutTransfer:LookoutTransfer|null
  turnLookout:(yaw:number,pitch:number)=>void
  leaveLookout:()=>void
  tickLookoutTransfer:(delta:number)=>boolean
  farmBook:FarmBook
  farmReady:boolean
  feedingElapsed:number
  mealActive:boolean
  mealProgress:number
  tickFeeding:(delta:number)=>void
  cancelFeeding:()=>void
  finishMeal:()=>void
  boatTransfer:BoatTransfer|null
  tickBoatTransfer:(delta:number)=>boolean
  tree:PlantedTree|null
  growthReady:boolean
  inspectingTree:boolean
  plantingElapsed:number
  setGrowthReady:(ready:boolean)=>void
  tickPlanting:(delta:number)=>void
  cancelPlanting:()=>void
  refreshGrowth:()=>void
  fishing: FishingState | null
  fishBook: CatchBook
  fishingReady: boolean
  setFishingReady: (ready: boolean) => void
  tickFishing: (delta: number) => void
  reel: (held: boolean) => void
  pauseFishing: () => void
  cancelFishing: () => void
  position: { x: number; z: number }
  boat: BoatState
  boatReady: boolean
  setBoatReady: (ready: boolean) => void
  updateBoat: (boat: BoatState) => void
  nearby: LandmarkId | null
  planted: boolean
  message: string
  updatePosition: (x: number, z: number) => void
  interact: () => void
  dismiss: () => void
}

export const useForestStore = create<ForestState>((set, get) => ({
  mode: 'walking',
  location:'island',workshopTransfer:null,workshopReturn:{...workshopDoor},
  tickWorkshopTransfer:delta=>{
    const previous=get().workshopTransfer
    if(!previous||!Number.isFinite(delta))return false
    const elapsed=previous.elapsed+Math.min(Math.max(delta,0),.05),commit=!previous.committed&&elapsed>=transferCommit
    if(commit){const enter=previous.direction==='enter';set({location:enter?'workshop':'island',position:enter?{...indoorSpawn}:{...get().workshopReturn},nearby:'workshop',inspectingTree:false,message:'',mode:'walking'})}
    set({workshopTransfer:elapsed>=transferDuration?null:{...previous,elapsed,committed:previous.committed||commit}})
    return commit
  },
  workshopBook:(()=>{try{return decodeWorkshop(window.localStorage.getItem(workshopStorageKey))}catch{return decodeWorkshop(null)}})(),
  workshopReady:false,gatheringElapsed:0,craft:null,
  cancelWorkshop:()=>{if(['crafting','gathering'].includes(get().mode))set({mode:'walking',craft:null,gatheringElapsed:0,message:'已暂停，材料仍然保留。'})},
  tickWorkshop:delta=>{
    if(!Number.isFinite(delta))return
    const dt=Math.min(Math.max(delta,0),.05),s=get()
    if(s.mode==='gathering'){
      const elapsed=s.gatheringElapsed+dt
      if(elapsed<1.6){set({gatheringElapsed:elapsed});return}
      const workshopBook:WorkshopBook={version:1,phase:'carrying'},saved=saveWorkshop(workshopBook)
      set({workshopBook,mode:'walking',gatheringElapsed:0,message:saved?'旧木墩已收好。从西侧工坊正门进入，在室内修整。':'旧木墩已收好；浏览器无法保存，仅在本次会话保留。'})
    }
    if(s.mode==='crafting'&&s.craft){
      const craft={...s.craft,elapsed:s.craft.elapsed+dt,stroke:Math.max(0,s.craft.stroke-dt)}
      if(craft.steps===3&&craft.stroke===0){
        const workshopBook:WorkshopBook={version:1,phase:'finished'},saved=saveWorkshop(workshopBook)
        set({workshopBook,mode:'walking',craft:null,message:saved?'木墩凳修整好了，留在工坊室内。成果已保存。':'木墩凳修整好了；浏览器无法保存，仅在本次会话保留。'})
      }else set({craft})
    }
  },
  lookoutReady:false,lookoutView:{...initialLookoutView},lookoutTransfer:null,
  turnLookout:(yaw,pitch)=>{if(get().mode==='lookout'&&!get().lookoutTransfer){const view=get().lookoutView,next=turnLookout(view,yaw,pitch);if(next!==view)set({lookoutView:next})}},
  leaveLookout:()=>{if(get().mode==='lookout'&&!get().lookoutTransfer)set({lookoutTransfer:{direction:'exit',elapsed:0,committed:false}})},
  tickLookoutTransfer:delta=>{
    const previous=get().lookoutTransfer
    if(!previous||!Number.isFinite(delta))return false
    const elapsed=previous.elapsed+Math.min(Math.max(delta,0),.05),commit=!previous.committed&&elapsed>=transferCommit
    if(commit)set({mode:previous.direction==='enter'?'lookout':'walking',inspectingTree:false,message:''})
    set({lookoutTransfer:elapsed>=transferDuration?null:{...previous,elapsed,committed:previous.committed||commit}})
    return commit
  },
  farmBook:(()=>{try{return decodeFarm(window.localStorage.getItem(farmStorageKey))}catch{return decodeFarm(null)}})(),
  farmReady:false,feedingElapsed:0,mealActive:false,mealProgress:0,
  tickFeeding:delta=>{
    if(get().mode!=='feeding'||!Number.isFinite(delta))return
    const elapsed=get().feedingElapsed+Math.min(Math.max(delta,0),.05)
    if(elapsed<1.6){set({feedingElapsed:elapsed});return}
    set({mode:'walking',feedingElapsed:0,mealActive:true,mealProgress:0,message:'饲料添好了，鸡和羊会走过来吃。给它们留一点路。'})
  },
  cancelFeeding:()=>{if(get().mode==='feeding')set({mode:'walking',feedingElapsed:0,message:'已暂停添料，按 F 可以重新开始。'})},
  finishMeal:()=>{
    if(!get().mealActive)return
    const farmBook:FarmBook={version:1,meals:get().farmBook.meals+1};let saved=true
    try{window.localStorage.setItem(farmStorageKey,JSON.stringify(farmBook))}catch{saved=false}
    set({farmBook,mealActive:false,mealProgress:1,message:saved?'鸡和羊吃饱了，回去散步了。喂养记录已保存。':'鸡和羊吃饱了；浏览器无法保存，记录仅在本次会话保留。'})
  },
  boatTransfer:null,
  tickBoatTransfer:(delta)=>{
    const previous=get().boatTransfer
    if(!previous||!Number.isFinite(delta))return false
    const elapsed=previous.elapsed+Math.min(Math.max(delta,0),.05)
    const commit=!previous.committed&&elapsed>=transferCommit
    if(commit){
      const boat={...get().boat,speed:0,effort:0}
      if(previous.direction==='board')set({mode:'rowing',boat,inspectingTree:false,message:''})
      else set({mode:'walking',boat,position:{...landing},nearby:'dock',message:''})
    }
    set({boatTransfer:elapsed>=transferDuration?null:{...previous,elapsed,committed:previous.committed||commit}})
    return commit
  },
  tree:initialTree,
  growthReady:false,
  inspectingTree:false,
  plantingElapsed:0,
  setGrowthReady:(growthReady)=>set({growthReady}),
  cancelPlanting:()=>{if(get().mode==='planting')set({mode:'walking',plantingElapsed:0,message:'已暂停栽种，再按 F 可以重新开始。'})},
  tickPlanting:(delta)=>{
    if(get().mode!=='planting')return
    const elapsed=get().plantingElapsed+Math.min(Math.max(delta,0),.05)
    if(elapsed<1.6){set({plantingElapsed:elapsed});return}
    const tree:PlantedTree={version:2,plantedAt:Date.now(),stage:0},saved=saveTree(tree)
    set({tree,planted:true,mode:'walking',inspectingTree:true,plantingElapsed:0,message:saved?'小苗种好了。走动或按 F 返回漫游；离开后它也会继续成长。':'小苗种好了；浏览器无法保存，成长仅在本次会话保留。'})
  },
  refreshGrowth:()=>{
    const previous=get().tree;if(!previous)return
    const tree=advanceTree(previous,Date.now());if(tree===previous)return
    const saved=saveTree(tree)
    set({tree,message:`树长成了${growthStages[tree.stage].label}。${saved?'已记入这片森林。':'浏览器无法保存，本次会话仍可继续。'}`})
  },
  fishing: null,
  fishBook: (() => { try { return decodeCatchBook(window.localStorage.getItem(catchStorageKey)) } catch { return emptyBook() } })(),
  fishingReady: false,
  setFishingReady: (fishingReady) => set({ fishingReady }),
  reel: (held) => { const f = get().fishing; if (f && f.phase === 'reeling' && !f.paused) set({ fishing: { ...f, held } }) },
  pauseFishing: () => { const f = get().fishing; if (f && !['caught', 'escaped'].includes(f.phase)) set({ fishing: { ...f, paused: true, held: false } }) },
  cancelFishing: () => { if (get().mode === 'fishing') set({ mode: 'walking', fishing: null, message: '' }) },
  tickFishing: (delta) => {
    const current = get().fishing
    if (!current || get().mode !== 'fishing') return
    const fishing = stepFishing(current, delta)
    if (fishing === current) return
    if (fishing.phase === 'caught' && current.phase !== 'caught') {
      const book = get().fishBook
      const fishBook = { count: book.count + 1, bestCm: Math.max(book.bestCm, fishing.sizeCm), recent: [{ sizeCm: fishing.sizeCm, at: new Date().toISOString() }, ...book.recent].slice(0, 20) }
      let saved = true
      try { window.localStorage.setItem(catchStorageKey, JSON.stringify(fishBook)) } catch { saved = false }
      set({ fishing, fishBook, message: saved ? `钓到 ${fishing.sizeCm} cm 锦鲤，已存入鱼簿。` : '钓到锦鲤！浏览器不允许存档，渔获仅在本次会话保留。' })
    } else set({ fishing })
  },
  position: { x: 0, z: 0 },
  boat: { ...initialBoat },
  boatReady: false,
  setBoatReady: (boatReady) => set({ boatReady }),
  updateBoat: (boat) => set({ boat }),
  nearby: null,
  planted:!!initialTree,
  message: '',
  updatePosition: (x, z) => {
    const nearby = get().location==='workshop'?'workshop':findNearestLandmark(x, z)
    const previous = get()
    if (x !== previous.position.x || z !== previous.position.z || nearby !== previous.nearby) set({ nearby, position: { x, z } })
  },
  interact: () => {
    const { nearby, planted, mode, position, boat, boatReady } = get()
    if(mode==='planting'||mode==='feeding'||mode==='gathering'||get().boatTransfer||get().lookoutTransfer||get().workshopTransfer)return
    if(mode==='crafting'){const c=get().craft;if(c)set({craft:strikeCraft(c)});return}
    if(mode==='lookout'){get().leaveLookout();return}
    if (mode === 'fishing') {
      const f = get().fishing
      if (f) set({ fishing: ['caught', 'escaped'].includes(f.phase) ? beginFishing() : strikeFish(f), message: '' })
      return
    }
    if (mode === 'rowing') {
      if (!canLand(boat)) { set({ message: '回到码头旁，松开方向键停稳后按 F 下船。' }); return }
      set({boatTransfer:{direction:'land',elapsed:0,committed:false},message:''})
      return
    }
    if (!nearby) return
    if(nearby==='workshop'){
      if(!get().workshopReady){set({message:'木工台正在准备，请稍候。'});return}
      const book=get().workshopBook,action=workshopAction(position,book,get().location)
      if(action==='enter'){set({workshopReturn:{...position},workshopTransfer:{direction:'enter',elapsed:0,committed:false},message:''});return}
      if(action==='exit'){set({workshopTransfer:{direction:'exit',elapsed:0,committed:false},message:''});return}
      if(action==='collect'){set({mode:'gathering',gatheringElapsed:0,inspectingTree:false,message:''});return}
      if(action==='inspect'){set({message:'你修整的木墩凳已经留在工坊室内。'});return}
      if(action==='craft'&&book.phase==='carrying'){set({mode:'crafting',position:{...craftSpot},craft:{elapsed:0,steps:0,stroke:0,feedback:'指针进入浅绿区域时按 F 打磨。'},inspectingTree:false,message:''});return}
      set({message:get().location==='island'?'走到工坊正门，按 F 进入；旧木墩在东侧路边。':book.phase==='available'?'从身后的门回小岛，沿工坊东侧小路找到旧木墩。':'走近北侧木工台前的木墩位置，按 F 修整。'});return
    }
    if(nearby==='lookout'){
      if(!get().lookoutReady){set({message:'瞭望塔正在准备，请稍候。'});return}
      if(!canViewLookout(position)){set({message:'沿塔的东侧绕到楼梯脚，再按 F 进入观景视角。'});return}
      set({lookoutTransfer:{direction:'enter',elapsed:0,committed:false},lookoutView:{...initialLookoutView},message:''});return
    }
    if(nearby==='farm'){
      if(!get().farmReady){set({message:'牧场正在准备，请稍候。'});return}
      if(get().mealActive){set({message:'饲料还没有吃完，给它们留一点路。'});return}
      if(Math.hypot(position.x-feedSpot.x,position.z-feedSpot.z)>.65){set({message:'从围栏北侧开口进入，走到食槽左边的小空地，按 F 添料。'});return}
      set({mode:'feeding',feedingElapsed:0,inspectingTree:false,message:''});return
    }
    if (nearby === 'pond') {
      if (!get().fishingReady) { set({ message: '钓具正在准备，请稍候。' }); return }
      if (Math.hypot(position.x - fishingSpot.x, position.z - fishingSpot.z) > .85) { set({ message: '走到池塘西岸的钓点，再按 F 抛竿。' }); return }
      set({ mode: 'fishing', position: { ...fishingSpot }, fishing: beginFishing(), message: '' })
      return
    }
    if (nearby === 'dock') {
      if (!boatReady) { set({ message: '木船正在准备，请稍候。' }); return }
      if (!canBoard(position.x, position.z, boat)) { set({ message: '走到木码头靠水的一端，再按 F 上船。' }); return }
      set({boatTransfer:{direction:'board',elapsed:0,committed:false},message:''})
      return
    }
    if (nearby === 'grove') {
      if (!planted) {
        if(!get().growthReady){set({message:'树苗正在准备，请稍候。'});return}
        if(Math.hypot(position.x-plantingSpot.x,position.z-plantingSpot.z)>1.8){set({message:'走近种植角的空地，再按 F 种下小苗。'});return}
        const dx=position.x-plantingSpot.x,dz=position.z-plantingSpot.z,d=Math.hypot(dx,dz)
        const stand=d<.65?{x:plantingSpot.x+(d?dx/d:0)*.8,z:plantingSpot.z+(d?dz/d:1)*.8}:position
        set({mode:'planting',position:stand,plantingElapsed:0,message:''})
      } else {get().refreshGrowth();set({inspectingTree:!get().inspectingTree,message:''})}
      return
    }
    const point = landmarks.find((item) => item.id === nearby)
    set({ message: point?.hint ?? '' })
  },
  dismiss: () => set({ message: '' }),
}))
