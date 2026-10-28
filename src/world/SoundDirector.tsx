import {climateNow} from './climateUniforms'
import {useEffect,useRef} from 'react'
import {useFrame} from '@react-three/fiber'
import {Vector3} from 'three'
import {useForestStore} from '../game/store'
import {useUiStore} from '../game/uiStore'
import {animalObstacles} from '../game/farm'
import {camp,onBridge} from '../game/expansion'
import {daylightAt} from '../game/dayCycle'
import {groundHeightAt} from '../game/movement'
import {isDockSurface} from './worldConfig'
import {audioEngine,playSound} from '../audio/audioStore'
import {fireNearness,mixFor,seaNearness,stepLength} from '../audio/audioMix'
import {soundCues} from '../audio/soundCues'

const forward=new Vector3()
type State=ReturnType<typeof useForestStore.getState>
const inTransfer=(s:State)=>!!(s.boatTransfer||s.workshopTransfer||s.homeTransfer||s.lookoutTransfer)

/**
 * Drives the island's sound, as my-blog's AudioDirector does: one-shots for each change in the game and the menus,
 * and every frame the listener at the camera, the ambience and music mix, footfalls paced by the raccoon's speed
 * (wood on the bridge, the dock and indoors), the reel while it is wound, and hens, sheep and gulls calling now and then.
 */
export function SoundDirector(){
 const run=useRef({mix:0,hen:4,sheep:9,gull:7,reel:0,stride:0,lastStep:-1,x:NaN,z:NaN})
 useEffect(()=>{
  const offForest=useForestStore.subscribe((next,prev)=>{for(const c of soundCues(prev,next))playSound(c.name,c.options)})
  const offUi=useUiStore.subscribe((next,prev)=>{
   if(next.panel&&!prev.panel)playSound('ui-open',{volume:.8})
   else if(!next.panel&&prev.panel)playSound('ui-close',{volume:.6})
   else if(next.panel!==prev.panel)playSound('page',{volume:.6})
  })
  return()=>{offForest();offUi()}
 },[])
 useFrame(({camera},delta)=>{
  const s=useForestStore.getState(),r=run.current,dt=Math.min(delta,.1),p=s.position
  const moved=Number.isFinite(r.x)?Math.hypot(p.x-r.x,p.z-r.z):0;r.x=p.x;r.z=p.z
  const engine=audioEngine()
  if(!engine?.ready)return
  camera.getWorldDirection(forward);engine.setListener(camera.position,forward)
  const indoors=s.location!=='island',onWater=s.mode==='rowing',here=onWater?s.boat:p
  const daylight=daylightAt(s),night=Math.min(1,Math.max(0,(.6-daylight)/.6)),sea=indoors?0:seaNearness(here.x,here.z,onWater)
  r.mix-=dt
  if(r.mix<=0){r.mix=.25;engine.applyMix(mixFor({night,indoors,sea,fire:indoors?0:fireNearness(here.x-camp.x,here.z-camp.z,s.homeBook.fireLit),rain:climateNow.rain}))}
  // Footfalls: one per stride travelled on foot. Teleports (doors, landing) move far in one frame and are not steps.
  const speed=moved/Math.max(dt,1e-3)
  if(s.mode==='walking'&&!inTransfer(s)&&speed>.3&&speed<5){
   r.stride+=moved
   const length=stepLength(speed)
   if(r.stride>=length){
    r.stride-=length
    const surface=indoors||onBridge(p.x,p.z)||isDockSurface(p.x,p.z)?'wood':'grass'
    let pick=Math.floor(Math.random()*5);if(pick===r.lastStep)pick=(pick+1)%5;r.lastStep=pick
    playSound(`step-${surface}-${pick}`,{volume:Math.min(1,.3+speed*.15),rate:.92+Math.random()*.16})
   }
  }else r.stride=0
  // The reel clicks while the line is wound in.
  if(s.fishing?.phase==='reeling'&&s.fishing.held&&!s.fishing.paused){r.reel-=dt;if(r.reel<=0){r.reel=1.1;playSound('reel',{volume:.55,rate:.95+Math.random()*.1})}}else r.reel=0
  if(indoors||s.mode==='sleeping')return
  // The farm: a hen or the sheep calls from where it stands, less often at night.
  const [hen,sheep]=animalObstacles
  for(const [kind,at] of [['hen',hen],['sheep',sheep]] as const){
   r[kind]-=dt;if(r[kind]>0)continue
   r[kind]=(kind==='hen'?3+Math.random()*6:7+Math.random()*10)*(night>.6?4:1)
   if(Math.hypot(at.x-here.x,at.z-here.z)<30)playSound(`${kind}-${1+Math.floor(Math.random()*2)}`,{volume:kind==='hen'?.55:.7,rate:.95+Math.random()*.1,at:{x:at.x,y:groundHeightAt(at.x,at.z)+.4,z:at.z}})
  }
  // Gulls wheel over the water by day, somewhere on the sea side of the raccoon.
  r.gull-=dt
  if(r.gull<=0){
   r.gull=8+Math.random()*12
   if(sea>.25&&night<.5){
    const away=Math.atan2(here.z,here.x)+(Math.random()-.5)*1.6,distance=12+Math.random()*14
    playSound(`gull-${1+Math.floor(Math.random()*2)}`,{volume:.5,rate:.95+Math.random()*.12,at:{x:here.x+Math.cos(away)*distance,y:7+Math.random()*4,z:here.z+Math.sin(away)*distance}})
   }
  }
 })
 return null
}
