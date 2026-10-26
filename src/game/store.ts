import {t} from '../i18n'
import {beginSleepJourney,sleepDuration,lightingStorageKey,type TimeOfDay,type SleepJourney} from './dayCycle'
import {cabin,camp,seats,seatOrigin,bedSpot,tankSpot,bedroomSpawn,decodeHome,expansionStorageKey,addCatch,catchId,type HomeBook,type SeatSession,type SeatId} from './expansion'
import { create } from 'zustand'
import { findNearestLandmark, type LandmarkId } from './landmarks'
import { canBoard, canLand, initialBoat, landing, type BoatState } from './rowing'
import { beginFishing, catchStorageKey, decodeCatchBook, emptyBook, fishingSpot, stepFishing, strikeFish, type CatchBook, type FishingState } from './fishing'
import {advanceTree,decodeTree,growthStages,growthStorageKey,legacySeedlingKey,plantingSpot,type PlantedTree} from './growth'
import {transferCommit,transferDuration,type BoatTransfer} from './boatPresentation'
import {decodeFarm,farmStorageKey,feedSpot,type FarmBook} from './farm'
import {canViewLookout,initialLookoutView,turnLookout,type LookoutView,type LookoutTransfer} from './lookout'
import {decodeWorkshop,workshopDoor,workshopStorageKey,workshopAction,strikeCraft,type WorkshopBook,type CraftSession,craftSpot,indoorSpawn,type WorkshopTransfer} from './workshop'

function saveHome(home:HomeBook){try{window.localStorage.setItem(expansionStorageKey,JSON.stringify(home));return true}catch{return false}}
function saveWorkshop(book:WorkshopBook){try{window.localStorage.setItem(workshopStorageKey,JSON.stringify(book));return true}catch{return false}}

function saveTree(tree:PlantedTree){try{window.localStorage.setItem(growthStorageKey,JSON.stringify(tree));return true}catch{return false}}
function loadTree(){try{const tree=decodeTree(window.localStorage.getItem(growthStorageKey),window.localStorage.getItem(legacySeedlingKey),Date.now());if(tree)saveTree(tree);return tree}catch{return null}}
const initialTree=typeof window!=='undefined'?loadTree():null

type ForestState = {
  mode: 'walking' | 'rowing' | 'fishing' | 'planting' | 'feeding' | 'lookout' | 'gathering' | 'crafting' | 'sitting' | 'sleeping'
  location: 'island'|'workshop'|'bedroom'
  islandOverview:boolean
  homeBook:HomeBook
  homeReady:boolean
  homeTransfer:WorkshopTransfer|null
  homeReturn:{x:number;z:number}
  sitting:SeatSession|null
  sleepElapsed:number
  sleepJourney:SleepJourney|null
  sunRising:boolean
  aquariumOpen:boolean
  timeOfDay:TimeOfDay
  tickHome:(delta:number)=>boolean
  leaveSeat:()=>void
  sit:(id:SeatId)=>void
  keepFish:(id:string)=>void
  releaseFish:(id:string)=>void
  wakeUp:()=>void
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
  /** 'error' notices (save or load failures) stay until dismissed; ordinary feedback fades. */
  messageKind: 'info'|'error'
  /** A menu panel is open: movement, boat thrust and gameplay timers hold still until it closes. */
  menuPaused: boolean
  updatePosition: (x: number, z: number) => void
  interact: () => void
  dismiss: () => void
}

export const useForestStore = create<ForestState>((rawSet, get) => {
  // A new message is ordinary feedback unless the caller marks it as an error explicitly.
  const set=(partial:Partial<ForestState>)=>rawSet('message' in partial&&!('messageKind' in partial)?{...partial,messageKind:'info'}:partial)
  return {
  messageKind:'info',
  menuPaused:false,
  mode: 'walking',
  islandOverview:false,
  homeBook:(()=>{try{return decodeHome(window.localStorage.getItem(expansionStorageKey))}catch{return decodeHome(null)}})(),
  homeReady:false,homeTransfer:null,homeReturn:{x:cabin.x,z:cabin.doorZ},sitting:null,sleepElapsed:0,sleepJourney:null,sunRising:false,aquariumOpen:false,
  timeOfDay:(()=>{if(typeof window==='undefined')return'day';const t=new URLSearchParams(window.location?.search??'').get('light');if(t==='day'||t==='night'||t==='dusk')return t;try{const saved=window.localStorage.getItem(lightingStorageKey);return saved==='night'?'night':'day'}catch{return'day'}})(),
  sit:id=>{
    const s=get();if(s.mode!=='walking'||s.homeTransfer||s.workshopTransfer||s.boatTransfer||s.lookoutTransfer)return
    const seat=seats.find(v=>v.id===id),position=id==='stool'?{x:-.6+.254*7/3,z:-1.6}:seat?seatOrigin(seat):null
    if(!position||id==='stool'&&(s.location!=='workshop'||s.workshopBook.phase!=='finished')||id!=='stool'&&s.location!=='island'||Math.hypot(s.position.x-position.x,s.position.z-position.z)>1.5)return
    set({mode:'sitting',position,sitting:{id,phase:'down',elapsed:0,returnPosition:{...s.position}},message:'',inspectingTree:false})
  },
  leaveSeat:()=>{const sitting=get().sitting;if(sitting&&sitting.phase==='idle')set({sitting:{...sitting,phase:'up',elapsed:0}})},
  wakeUp:()=>{
    const s=get();if(s.mode!=='sleeping'||!s.sleepJourney)return
    const timeOfDay=s.sleepJourney.target,homeBook={...s.homeBook,nights:s.homeBook.nights+1};let saved=saveHome(homeBook)
    try{window.localStorage.setItem(lightingStorageKey,timeOfDay)}catch{saved=false}
    set({mode:'walking',position:{...bedSpot},sleepElapsed:0,sleepJourney:null,homeBook,timeOfDay,messageKind:saved?'info':'error',message:(timeOfDay==='day'?t('msg.morning'):t('msg.evening'))+(saved?'':t('msg.unsavedShort'))})
  },
  keepFish:id=>{const s=get();if(s.location!=='bedroom'||!s.aquariumOpen||s.mode!=='walking')return;const fish=s.fishBook.recent.find(f=>catchId(f)===id);if(!fish)return;const homeBook=addCatch(s.homeBook,fish);if(homeBook===s.homeBook)return;const saved=saveHome(homeBook);set({homeBook,messageKind:saved?'info':'error',message:saved?t('msg.fishKept'):t('msg.fishKeptUnsaved')})},
  releaseFish:id=>{const s=get();if(s.location!=='bedroom'||!s.aquariumOpen||s.mode!=='walking'||!s.homeBook.fish.some(f=>f.id===id))return;const homeBook={...s.homeBook,fish:s.homeBook.fish.filter(f=>f.id!==id)};const saved=saveHome(homeBook);set({homeBook,messageKind:saved?'info':'error',message:saved?t('msg.fishReleased'):t('msg.fishReleasedUnsaved')})},
  tickHome:delta=>{
    if(!Number.isFinite(delta))return false
    const dt=Math.min(Math.max(delta,0),.05),s=get(),t=s.homeTransfer
    if(s.menuPaused&&s.mode==='sitting')return false
    if(t){const elapsed=t.elapsed+dt,commit=!t.committed&&elapsed>=transferCommit;if(commit)set({location:t.direction==='enter'?'bedroom':'island',position:t.direction==='enter'?{...bedroomSpawn}:{...s.homeReturn},nearby:'bedroom',message:'',aquariumOpen:false,mode:'walking'});set({homeTransfer:elapsed>=transferDuration?null:{...t,elapsed,committed:t.committed||commit}});return commit}
    if(s.mode==='sitting'&&s.sitting){const sitting={...s.sitting,elapsed:s.sitting.elapsed+dt};if(sitting.phase==='down'&&sitting.elapsed>=2.234){sitting.phase='idle';sitting.elapsed=0}if(sitting.phase==='up'&&sitting.elapsed>=2.267)set({mode:'walking',position:sitting.returnPosition,sitting:null});else set({sitting})}
    if(s.mode==='sleeping'){const elapsed=s.sleepElapsed+dt;if(elapsed>=sleepDuration)get().wakeUp();else set({sleepElapsed:elapsed})}
    return false
  },
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
  cancelWorkshop:()=>{if(['crafting','gathering'].includes(get().mode))set({mode:'walking',craft:null,gatheringElapsed:0,message:t('msg.workshopPaused')})},
  tickWorkshop:delta=>{
    if(!Number.isFinite(delta)||get().menuPaused)return
    const dt=Math.min(Math.max(delta,0),.05),s=get()
    if(s.mode==='gathering'){
      const elapsed=s.gatheringElapsed+dt
      if(elapsed<1.6){set({gatheringElapsed:elapsed});return}
      const workshopBook:WorkshopBook={version:1,phase:'carrying'},saved=saveWorkshop(workshopBook)
      set({workshopBook,mode:'walking',gatheringElapsed:0,messageKind:saved?'info':'error',message:saved?t('msg.stumpCollected'):t('msg.stumpCollectedUnsaved')})
    }
    if(s.mode==='crafting'&&s.craft){
      const craft={...s.craft,elapsed:s.craft.elapsed+dt,stroke:Math.max(0,s.craft.stroke-dt)}
      if(craft.steps===3&&craft.stroke===0){
        const workshopBook:WorkshopBook={version:1,phase:'finished'},saved=saveWorkshop(workshopBook)
        set({workshopBook,mode:'walking',craft:null,messageKind:saved?'info':'error',message:saved?t('msg.stoolDone'):t('msg.stoolDoneUnsaved')})
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
    if(get().mode!=='feeding'||!Number.isFinite(delta)||get().menuPaused)return
    const elapsed=get().feedingElapsed+Math.min(Math.max(delta,0),.05)
    if(elapsed<1.6){set({feedingElapsed:elapsed});return}
    set({mode:'walking',feedingElapsed:0,mealActive:true,mealProgress:0,message:t('msg.fed')})
  },
  cancelFeeding:()=>{if(get().mode==='feeding')set({mode:'walking',feedingElapsed:0,message:t('msg.feedingPaused')})},
  finishMeal:()=>{
    if(!get().mealActive)return
    const farmBook:FarmBook={version:1,meals:get().farmBook.meals+1};let saved=true
    try{window.localStorage.setItem(farmStorageKey,JSON.stringify(farmBook))}catch{saved=false}
    set({farmBook,mealActive:false,mealProgress:1,messageKind:saved?'info':'error',message:saved?t('msg.mealDone'):t('msg.mealDoneUnsaved')})
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
  cancelPlanting:()=>{if(get().mode==='planting')set({mode:'walking',plantingElapsed:0,message:t('msg.plantingPaused')})},
  tickPlanting:(delta)=>{
    if(get().mode!=='planting'||get().menuPaused)return
    const elapsed=get().plantingElapsed+Math.min(Math.max(delta,0),.05)
    if(elapsed<1.6){set({plantingElapsed:elapsed});return}
    const tree:PlantedTree={version:2,plantedAt:Date.now(),stage:0},saved=saveTree(tree)
    set({tree,planted:true,mode:'walking',inspectingTree:true,plantingElapsed:0,messageKind:saved?'info':'error',message:saved?t('msg.planted'):t('msg.plantedUnsaved')})
  },
  refreshGrowth:()=>{
    const previous=get().tree;if(!previous)return
    const tree=advanceTree(previous,Date.now());if(tree===previous)return
    const saved=saveTree(tree)
    set({tree,messageKind:saved?'info':'error',message:t(saved?'msg.grew':'msg.grewUnsaved',{stage:t(`growth.${growthStages[tree.stage].id}`)})})
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
    if (!current || get().mode !== 'fishing' || get().menuPaused) return
    const fishing = stepFishing(current, delta)
    if (fishing === current) return
    if (fishing.phase === 'caught' && current.phase !== 'caught') {
      const book = get().fishBook
      const fishBook = { count: book.count + 1, bestCm: Math.max(book.bestCm, fishing.sizeCm), recent: [{ sizeCm: fishing.sizeCm, at: new Date().toISOString() }, ...book.recent].slice(0, 20) }
      let saved = true
      try { window.localStorage.setItem(catchStorageKey, JSON.stringify(fishBook)) } catch { saved = false }
      set({ fishing, fishBook, message: saved ? '' : t('msg.catchUnsaved'), messageKind: saved ? 'info' : 'error' })
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
    const nearby = get().location==='bedroom'?'bedroom':get().location==='workshop'?'workshop':findNearestLandmark(x, z)
    const previous = get()
    if (x !== previous.position.x || z !== previous.position.z || nearby !== previous.nearby) set({ nearby, position: { x, z } })
  },
  interact: () => {
    const { nearby, planted, mode, position, boat, boatReady } = get()
    // Under an open menu panel the scene ignores F, including clicks that reach the prompt.
    if(get().menuPaused)return
    if(mode==='planting'||mode==='feeding'||mode==='gathering'||get().boatTransfer||get().lookoutTransfer||get().workshopTransfer||get().homeTransfer)return
    if(mode==='sitting'){get().leaveSeat();return}
    if(mode==='sleeping'){get().wakeUp();return}
    if(mode==='crafting'){const c=get().craft;if(c)set({craft:strikeCraft(c)});return}
    if(mode==='lookout'){get().leaveLookout();return}
    if (mode === 'fishing') {
      const f = get().fishing
      if (f) set({ fishing: ['caught', 'escaped'].includes(f.phase) ? beginFishing() : strikeFish(f), message: '' })
      return
    }
    if (mode === 'rowing') {
      if (!canLand(boat)) { set({ message: t('msg.notAtDock') }); return }
      set({boatTransfer:{direction:'land',elapsed:0,committed:false},message:''})
      return
    }
    if(get().location==='bedroom'){
      if(Math.hypot(position.x,position.z-2.5)<.9){set({homeTransfer:{direction:'exit',elapsed:0,committed:false},aquariumOpen:false});return}
      if(Math.hypot(position.x-bedSpot.x,position.z-bedSpot.z)<1){set({mode:'sleeping',sleepElapsed:0,sleepJourney:beginSleepJourney(get().timeOfDay),sunRising:get().timeOfDay==='night',aquariumOpen:false,message:''});return}
      if(Math.hypot(position.x-tankSpot.x,position.z-tankSpot.z)<1.15){set({aquariumOpen:!get().aquariumOpen,message:''});return}
      return
    }
    if(get().location==='island'){
      const seat=seats.find(v=>Math.hypot(position.x-seatOrigin(v).x,position.z-seatOrigin(v).z)<1.3)
      if(seat){get().sit(seat.id);return}
      if(Math.hypot(position.x-camp.x,position.z-camp.z)<2.1){const homeBook={...get().homeBook,fireLit:!get().homeBook.fireLit},saved=saveHome(homeBook);set({homeBook,messageKind:saved?'info':'error',message:(homeBook.fireLit?t('msg.fireLit'):t('msg.fireOut'))+(saved?'':t('msg.unsavedShort'))});return}
      if(Math.hypot(position.x-cabin.x,position.z-cabin.doorZ)<1.2){if(get().homeReady)set({homeReturn:{...position},homeTransfer:{direction:'enter',elapsed:0,committed:false},message:''});else set({message:t('msg.bedroomLoading')});return}
    }
    if (!nearby) return
    if(nearby==='workshop'){
      if(!get().workshopReady){set({message:t('msg.benchLoading')});return}
      const book=get().workshopBook,action=workshopAction(position,book,get().location==='workshop'?'workshop':'island')
      if(action==='enter'){set({workshopReturn:{...position},workshopTransfer:{direction:'enter',elapsed:0,committed:false},message:''});return}
      if(action==='exit'){set({workshopTransfer:{direction:'exit',elapsed:0,committed:false},message:''});return}
      if(action==='collect'){set({mode:'gathering',gatheringElapsed:0,inspectingTree:false,message:''});return}
      if(action==='inspect'){get().sit('stool');return}
      if(action==='craft'&&book.phase==='carrying'){set({mode:'crafting',position:{...craftSpot},craft:{elapsed:0,steps:0,stroke:0,feedback:'first'},inspectingTree:false,message:''});return}
      set({message:get().location==='island'?t('msg.toWorkshopDoor'):book.phase==='available'?t('msg.findStump'):t('msg.toBench')});return
    }
    if(nearby==='lookout'){
      if(!get().lookoutReady){set({message:t('msg.lookoutLoading')});return}
      if(!canViewLookout(position)){set({message:t('msg.toStairs')});return}
      set({lookoutTransfer:{direction:'enter',elapsed:0,committed:false},lookoutView:{...initialLookoutView},message:''});return
    }
    if(nearby==='farm'){
      if(!get().farmReady){set({message:t('msg.farmLoading')});return}
      if(get().mealActive){set({message:t('msg.mealActive')});return}
      if(Math.hypot(position.x-feedSpot.x,position.z-feedSpot.z)>.65){set({message:t('msg.toTrough')});return}
      set({mode:'feeding',feedingElapsed:0,inspectingTree:false,message:''});return
    }
    if (nearby === 'pond') {
      if (!get().fishingReady) { set({ message: t('msg.fishingLoading') }); return }
      if (Math.hypot(position.x - fishingSpot.x, position.z - fishingSpot.z) > .85) { set({ message: t('msg.toFishingSpot') }); return }
      set({ mode: 'fishing', position: { ...fishingSpot }, fishing: beginFishing(), message: '' })
      return
    }
    if (nearby === 'dock') {
      if (!boatReady) { set({ message: t('msg.boatLoading') }); return }
      if (!canBoard(position.x, position.z, boat)) { set({ message: t('msg.toDockEnd') }); return }
      set({boatTransfer:{direction:'board',elapsed:0,committed:false},message:''})
      return
    }
    if (nearby === 'grove') {
      if (!planted) {
        if(!get().growthReady){set({message:t('msg.treeLoading')});return}
        if(Math.hypot(position.x-plantingSpot.x,position.z-plantingSpot.z)>1.8){set({message:t('msg.toPlot')});return}
        const dx=position.x-plantingSpot.x,dz=position.z-plantingSpot.z,d=Math.hypot(dx,dz)
        const stand=d<.65?{x:plantingSpot.x+(d?dx/d:0)*.8,z:plantingSpot.z+(d?dz/d:1)*.8}:position
        set({mode:'planting',position:stand,plantingElapsed:0,message:''})
      } else {get().refreshGrowth();set({inspectingTree:!get().inspectingTree,message:''})}
      return
    }
    set({ message: t(`place.${nearby}.hint`) })
  },
  dismiss: () => set({ message: '' }),
}})
