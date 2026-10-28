import {create} from 'zustand'
import {t} from '../i18n'
import {useForestStore} from './store'
import {useUiStore} from './uiStore'
import {photoBlock} from './photo'
import {playSound} from '../audio/audioStore'
import {duskAt,tourDuration} from './tour'

type Light=ReturnType<typeof useForestStore.getState>['timeOfDay']
type TourState={
 active:boolean
 elapsed:number
 /** Where the camera was when the tour began; the scene fills it in on the first frame. */
 from:{eye:[number,number,number];target:[number,number,number]}|null
 /** The light before the tour's dusk at the tower; put back when it ends. */
 restoreLight:Light|null
 /** Set when the tour ends, so the toolbar's tour button can take the focus back. */
 returnFocus:boolean
 start:()=>void
 stop:()=>void
 tick:(delta:number)=>void
}

/** The guided tour's state. Gameplay holds still (as under a menu panel) and nothing is saved. */
export const useTourStore=create<TourState>((set,get)=>({
 active:false,elapsed:0,from:null,restoreLight:null,returnFocus:false,
 start:()=>{
  if(get().active)return
  // An open menu panel gives way to the tour; then, like the camera, it starts only from free play outdoors.
  useUiStore.getState().closePanel()
  const forest=useForestStore.getState()
  if(photoBlock(forest)||forest.location!=='island'){useForestStore.setState({message:t('tour.busy'),messageKind:'info'});return}
  if(document.activeElement instanceof HTMLElement)document.activeElement.blur()
  forest.reel(false)
  useForestStore.setState({menuPaused:true,message:'',inspectingTree:false})
  set({active:true,elapsed:0,from:null,restoreLight:forest.timeOfDay})
  playSound('ui-open',{volume:.7})
 },
 stop:()=>{
  const {active,restoreLight}=get();if(!active)return
  useForestStore.setState({menuPaused:false,...(restoreLight&&useForestStore.getState().timeOfDay!==restoreLight?{timeOfDay:restoreLight}:{})})
  set({active:false,elapsed:0,from:null,restoreLight:null,returnFocus:true})
  playSound('ui-close',{volume:.7})
 },
 tick:delta=>{
  const s=get();if(!s.active||!Number.isFinite(delta))return
  const elapsed=s.elapsed+Math.min(Math.max(delta,0),.1)
  if(elapsed>=tourDuration){get().stop();return}
  if(elapsed>=duskAt&&useForestStore.getState().timeOfDay!=='dusk')useForestStore.setState({timeOfDay:'dusk'})
  set({elapsed})
 },
}))
