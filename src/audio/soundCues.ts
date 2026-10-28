import type {PlayOptions} from './WorldAudio'
import type {useForestStore} from '../game/store'
import {camp,catchId} from '../game/expansion'
import {plantingSpots} from '../game/growth'
import {launchPoint} from '../game/lanterns'
import {fishingSites} from '../game/fishing'

type State=ReturnType<typeof useForestStore.getState>
export interface Cue{name:string;options?:PlayOptions}

const campfire={x:camp.x,y:.4,z:camp.z},sapling=(spot:number)=>({...plantingSpots[spot],y:.4})
const started=<T,>(prev:T|null,next:T|null)=>!prev&&!!next

/**
 * One-shot sounds for a change in the game state (prev → next). Pure: the game never calls audio itself; a director
 * compares successive states and plays what this returns. Sounds come from my-blog's CC0 set (public/assets/audio).
 */
export function soundCues(prev:State,next:State):Cue[]{
 const cues:Cue[]=[]
 const cue=(name:string,options?:PlayOptions)=>cues.push({name,options})

 // Fishing: cast, the float landing, a bite, the strike, the fish breaking the surface, or it getting away.
 const was=prev.fishing?.phase,is=next.fishing?.phase
 const site=fishingSites[next.fishing?.site??prev.fishing?.site??'pond'],castLanding={x:site.float.x,y:site.waterY,z:site.float.z}
 if(is!==was){
  if(is==='casting')cue('cast',{volume:.8})
  if(was==='casting'&&is==='waiting')cue('splash-tiny',{volume:.6,at:castLanding})
  if(is==='bite')cue('bite',{volume:.7})
  if(was==='bite'&&is==='reeling')cue('splash',{volume:.7,at:castLanding})
  if(is==='landing')cue('splash',{volume:.9,rate:.9})
  if(is==='escaped'&&(was==='bite'||was==='reeling'))cue('splash-tiny',{volume:.5,at:castLanding})
 }
 // The catch kept in the tank, or let go back into the pond.
 const kept=next.homeBook.fish.length-prev.homeBook.fish.length
 if(kept>0)cue('pour',{volume:.7})
 if(kept<0)cue('pour',{volume:.6,rate:.85})
 if(kept===0&&next.homeBook.usedCatchIds.length>prev.homeBook.usedCatchIds.length&&next.fishBook.recent[0]&&next.homeBook.usedCatchIds.includes(catchId(next.fishBook.recent[0])))cue('splash',{volume:.8})

 // Doors: open as the fade begins, close once inside or out.
 for(const key of ['workshopTransfer','homeTransfer'] as const){
  if(started(prev[key],next[key]))cue('door-open',{volume:.8})
  if(!prev[key]?.committed&&next[key]?.committed)cue('door-close',{volume:.8})
 }
 if(started(prev.boatTransfer,next.boatTransfer))cue('cloth',{volume:.6})
 if(started(prev.lookoutTransfer,next.lookoutTransfer))cue('step-wood-2',{volume:.7})

 // Workshop: gathering the stump, each true plane stroke, a miss, the finished stool.
 if(next.mode==='gathering'&&prev.mode!=='gathering')cue('rustle',{volume:.8})
 if(prev.workshopBook.phase==='available'&&next.workshopBook.phase==='carrying')cue('pickup',{volume:.8})
 if(next.craft&&prev.craft&&next.craft.steps>prev.craft.steps)cue('craft',{volume:.9})
 if(next.craft&&prev.craft&&next.craft!==prev.craft&&next.craft.elapsed===prev.craft.elapsed&&next.craft.feedback==='miss')cue('drop',{volume:.5})
 if(prev.workshopBook.phase==='carrying'&&next.workshopBook.phase==='finished')cue('task-done',{volume:.9})

 // Farm, sapling, seats, campfire, bed.
 if(next.mode==='feeding'&&prev.mode!=='feeding')cue('pour',{volume:.8})
 if(next.lanterns.total>prev.lanterns.total)cue('splash-tiny',{volume:.5,at:{...launchPoint,y:5.5}})
 if(next.mode==='planting'&&prev.mode!=='planting')cue('rustle',{volume:.9,at:sapling(next.plot??0)})
 const planted=next.garden.trees.find(t=>!prev.garden.trees.some(p=>p.spot===t.spot))
 if(planted)cue('pluck',{volume:.8,at:sapling(planted.spot)})
 const grown=next.garden.trees.find(t=>{const was=prev.garden.trees.find(p=>p.spot===t.spot);return was&&t.stage>was.stage})
 if(grown)cue('rustle',{volume:.6,rate:1.1,at:sapling(grown.spot)})
 if(next.sitting?.phase!==prev.sitting?.phase&&(next.sitting?.phase==='down'||next.sitting?.phase==='up'))cue('cloth',{volume:.55,rate:next.sitting?.phase==='up'?.9:1})
 if(!prev.homeBook.fireLit&&next.homeBook.fireLit)cue('rustle',{volume:.8,rate:.8,at:campfire})
 if(prev.homeBook.fireLit&&!next.homeBook.fireLit)cue('splash-tiny',{volume:.5,at:campfire})
 if(next.mode==='sleeping'&&prev.mode!=='sleeping')cue('cloth',{volume:.6})
 if(!prev.aquariumOpen&&next.aquariumOpen)cue('ui-open',{volume:.8})
 if(prev.aquariumOpen&&!next.aquariumOpen)cue('ui-close',{volume:.6})
 return cues
}
