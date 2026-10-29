import {sleepCamera} from '../game/dayCycle'
import {Bedroom,ExpansionExterior} from './ExpansionScene'
import {moveInBedroom,seats,seatLift,seatSlide} from '../game/expansion'
import {cameraRelativeMovement} from '../game/movementInput'
import {createOrbit,rotateOrbit,stepOrbit,orbitConfig,spawnYaw} from '../game/orbitCamera'
import {useOrbitInput} from './useOrbitInput'
import {ScaleReview} from './ScaleReview'
import {PostEffects} from './PostEffects'
import {PhotoCapture} from './PhotoCapture'
import {ForageItems} from './ForageItems'
import {Furniture} from './Furniture'
import {Secrets} from './Secrets'
import {Climate} from './Climate'
import {PuddleReflection} from './PuddleReflection'
import {freeCam,usePhotoStore} from '../game/photoStore'
import {constrainFreePosition,freeSpeed,lookDirection,moveFreeView,viewFromDirection} from '../game/freeCamera'
import {clampOrbitTargets,photoOrbit} from '../game/photo'
import { Canvas, useFrame } from '@react-three/fiber'
import { Suspense, useCallback, useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useForestStore } from '../game/store'
import {useUiStore,gameplayPaused} from '../game/uiStore'
import {promptFor} from '../game/prompt'
import { groundHeightAt, moveOnGround, pathStones } from '../game/movement'
import { lookoutPosition, workshopPosition } from './assets'
import {lookoutYaw} from './worldConfig'
import { canBoard, canLand, stepBoat } from '../game/rowing'
import { RowingBoat } from './RowingBoat'
import { fishingClips, fishingSites } from '../game/fishing'
import { FishingScene } from './FishingScene'
import { ModelAsset } from './ModelAsset'
import type { Locomotion } from './ModelAsset'
import { Atmosphere } from './Atmosphere'
import {Rainbow} from './Rainbow'
import {RiverLanterns} from './RiverLanterns'
import {launchPoint} from '../game/lanterns'
import {useTourStore} from '../game/tourStore'
import {tourFrame} from '../game/tour'
import { IslandTerrain } from './IslandTerrain'
import {WestWetland} from './WestWetland'
import {MistIsland} from './MistIslandScene'
import {IslandTrees} from './IslandTrees'
import { ForestKit } from './ForestKit'
import { GroundCover } from './GroundCover'
import { PondLife } from './PondLife'
import { SoundDirector } from './SoundDirector'
import { Stockpiles } from './Stockpiles'
import { AmbientLife } from './AmbientLife'
import { CoastalRocks } from './CoastalRocks'
import { PathDetails } from './PathDetails'
import {seaLevel} from './worldConfig'
import {OceanBoundary} from './OceanBoundary'
import {SeasideDock} from './SeasideDock'
import {GrowingTree} from './GrowingTree'
import {FarmScene} from './FarmScene'
import {feedSpot} from '../game/farm'
import {growthStages,plantingSpots,pushRadius,trunks} from '../game/growth'
import {lookoutEye} from '../game/lookout'
import {WorkshopCraft} from './WorkshopCraft'
import {woodSpot,workpieceSpot} from '../game/workshop'

import {moveInWorkshop} from '../game/workshopInterior'
import {movementYaw,walkingCamera,outdoorOrbitFocus,clipCameraArm,clearCanopy,slopePitch,indoorCameraBoxes,bedroomCameraBoxes,outdoorCameraBoxes} from '../game/followCamera'
import {canopySpheres} from './vegetationLayout'
import {SandPlay} from './SandPlay'
import {pressPaw,sandGroundAt} from './sandField'
import {useSandStore,sandAim} from '../game/sandStore'
import {inSandRect,sandObstacles,stepStride,type SandKind} from '../game/sand'

const sandKeys:Record<string,SandKind>={Digit1:'castle',Digit2:'river',Digit3:'pit',Digit4:'imprint',Numpad1:'castle',Numpad2:'river',Numpad3:'pit',Numpad4:'imprint'}

const qaEnabled = import.meta.env.DEV && new URLSearchParams(location.search).has('qa')

/** Fixed, opt-in development views for repeatable before/after captures. */
function ReviewCamera() {
  useFrame(({ camera }) => {
    const view = new URLSearchParams(location.search).get('view')
    if (!qaEnabled || !view || useForestStore.getState().mode==='sleeping') return
    const views: Record<string, [number[], number[]]> = {
      scaleFish: [[4,2,0],[2,1,-5]],
      scaleWorkshop: [[-12,3.6,24],[-12,2.2,8]],
      scaleLamp: [[.5,2.1,3],[-3.8,1,-2.5]],
      fullIsland: [[68, 58, 80], [0, 0, 0]],
      westOverview: [[-82,45,62],[-27,0,4]],
      westTrail: [[-41,3,4],[-52,.5,-4]],
      westWetland: [[-60,8,12],[-52,.4,-4]],
      westWetlandClear: [[-59,13,-17],[-59,.4,-4]],
      westBoardwalkClose: [[-55,2.8,-8],[-59,.65,-4]],
      archipelago: [[155,105,145],[22,0,-3]],
      mistOverview: [[72,35,27],[107,1,-10]],
      mistBerth: [[72,7,-2],[87,.2,-10]],
      mistPine: [[100,4,1],[106,2,-10]],
      mistUnderstory: [[103,2.5,-4.5],[107,1.5,-9]],
      mistRidge: [[124,12,-34],[114,3,-23]],
      mistLog: [[98,2.8,-6],[102,1.8,-9]],
      mistEdge: [[98,2.8,-13],[95,1.4,-16]],
      mistLogMouth: [[97.5,2.45,-9],[101,1.8,-9.5]],
      westTrailClear: [[-51,2.5,-3.5],[-62,1,-4]],
      flowers: [[-1, 1.1, 3], [-4, .2, 1]],
      trail: [[-2.8, 1.35, 16], [-.9, .05, 11]],
      lamp: [[-1.7, 2.2, 1], [-4.1, 1.2, -2.5]],
      beach: [[27,5,40],[10,0,31]],
      dock: [[48,3.5,8],[41,-.1,.4]],
      overview: [[34, 28, 42], [0, 0, 0]],
      coast: [[24, 4, 27], [0, 1, 0]],
      pond: [[14, 6, 4], [6, .4, -5]],
      workshop: [[-4, 5, 17], [-12, 1.3, 8]],
      tower: [[22.5,13,-21.5],[11.5,10.5,-31.5]],
      towerSea: [[2,10,-52],[11.5,9,-31.5]],
      sandPlay: [[6,6.5,47],[0,0,30.5]],
      sandClose: [[-1.5,2,35.5],[1,0,31.5]],
      farm: [[15, 4, 13], [8, .6, 6]],
      farmFront:[[14,5,-1],[8,.5,6]],
      farmFeed:[[11,2.5,1.8],[9.1,.3,4.7]],
      player: [[3, 2.5, 5], [0, .8, 0]],
      grove: [[4.5, 3, 13], [0, 1, 8]],
      sprout: [[.8, .48, 9], [0, .12, 8]],
      bedroom: [[3.2,2.8,2.6],[-.2,1,-.8]],
      tank: [[3.2,1.7,1.5],[2.3,.95,-1.3]],
      cabin: [[-6,12,-18],[-15,9,-28]],
      stream: [[-6,10,-13],[-17,5,-20]],
      creekMouth: [[-43,7,-10],[-34,1,-18]],
      seaCliff: [[-44,18,-49],[-18,5,-31]],
      camp: [[28,5,31],[20,.6,23]],
      fireClose: [[22.8,1.9,26.5],[20,.65,23]],
      fireSide: [[16.5,1.5,24.5],[20,.65,23]],
      fireHigh: [[21,4,24],[20,.4,23]],
      reef: [[35,3,-5],[34,0,-16]],
      craft: [[1.5,2.2,1.8],[-.4,.7,-1.8]],
      craftContact: [[1.0,1.1,-.5],[-.6,.55,-1.45]],
      interior: [[0,2.6,2.7],[0,1,-1.3]],
      wood: [[-5.9,1.8,11.8],[-7.9,.3,9.6]],
    }
    // Seat-local development views stay identical across all rotated bench instances.
    if(view.startsWith('seat')){
      const seat=seats.find(s=>s.id===useForestStore.getState().sitting?.id)
      if(seat){
        const y=groundHeightAt(seat.x,seat.z),a=seat.yaw
        const local=view==='seatSide'?[2.3,1,-.1]:view==='seatRear'?[1.8,1.3,2.2]:[1.8,1.2,-2.4]
        camera.position.set(seat.x+Math.cos(a)*local[0]+Math.sin(a)*local[2],y+local[1],seat.z-Math.sin(a)*local[0]+Math.cos(a)*local[2]);camera.lookAt(seat.x,y+.65,seat.z)
        return
      }
    }
    const shot = views[view]
    if (shot) { camera.position.set(shot[0][0], shot[0][1], shot[0][2]); camera.lookAt(shot[1][0], shot[1][1], shot[1][2]) }
  }, -1)
  return null
}

function Workshop() {
  return <group position={[...workshopPosition]}>
    <Suspense fallback={null}><ModelAsset asset="workshop" /></Suspense>
  </group>
}

function Tower() {
  const ready=useCallback((lookoutReady:boolean)=>useForestStore.setState({lookoutReady}),[])
  return <group position={[...lookoutPosition]} rotation={[0,lookoutYaw,0]}>
    <Suspense fallback={null}><ModelAsset asset="lookout" onReadyChange={ready} /></Suspense>
  </group>
}


function Water() {
  return <group>
    <SeasideDock />
    <Suspense fallback={null}><RowingBoat /></Suspense>
  </group>
}

function Player() {
  const root = useRef<THREE.Group>(null)
  const motion = useRef<Locomotion>('idle')
  const orbit=useRef(createOrbit(spawnYaw)),dragging=useRef(false)
  useOrbitInput(orbit,dragging)
  const motionPreference=useMemo(()=>window.matchMedia('(prefers-reduced-motion: reduce)'),[])
  const ready = useRef(false)
  const wasSleeping=useRef(false)
  const wasPhoto=useRef(false)
  const skyLook=useRef(new THREE.Vector3())
  const stride=useRef({travelled:0,left:true})
  const slopeTilt=useRef(0)
  const onReadyChange = useCallback((value: boolean) => { ready.current = value }, [])
  const pressed = useRef(new Set<string>())
  const movementIntent=useRef<ReturnType<typeof cameraRelativeMovement>>(null)
  const movementHeading=useRef(spawnYaw)
  // Face away from the opening camera so the first frame shows the raccoon's back, not its face.
  useEffect(()=>{if(root.current)root.current.rotation.y=spawnYaw},[])
  const updatePosition = useForestStore((s) => s.updatePosition)

  useEffect(() => {
    function down(e: KeyboardEvent) {
      if (e.target instanceof HTMLElement && (e.target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName))) return
      // An open panel owns the keyboard: Esc closes only the top panel, nothing reaches the scene.
      // The tour gives way to any key.
      if (useTourStore.getState().active) { e.preventDefault(); if (!e.repeat) useTourStore.getState().stop(); return }
      const ui=useUiStore.getState()
      const photo=usePhotoStore.getState()
      if (photo.active) {
        if (e.code === 'Escape' || e.code === 'KeyP') { e.preventDefault(); if (!e.repeat) photo.exit() }
        else if (e.code === 'Space') { e.preventDefault(); if (!e.repeat) photo.shutter() }
        else if (['KeyW','KeyA','KeyS','KeyD','KeyQ','KeyE','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)) { e.preventDefault(); pressed.current.add(e.code) }
        return
      }
      if (ui.panel) { if (e.code === 'Escape') { e.preventDefault(); ui.closePanel() } return }
      if (useForestStore.getState().aquariumOpen) {
        if (e.code === 'Escape' || (e.code === 'KeyF' && !e.repeat)) { e.preventDefault(); useForestStore.setState({ aquariumOpen: false }) }
        return
      }
      if (e.code === 'KeyP' && !e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey) { photo.enter(); return }
      // Seated by the fire or the sea: R roasts a fish, V looks up at the stars.
      if ((e.code === 'KeyR' || e.code === 'KeyV') && !e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey && useForestStore.getState().mode === 'sitting') { e.preventDefault(); if (e.code === 'KeyR') useForestStore.getState().startRoast(); else useForestStore.getState().toggleStargaze(); return }
      // Sand play on the south beach: B opens the quick bar; 1-4 choose, R turns the outline, F builds, Esc steps back.
      const sand=useSandStore.getState()
      if (e.code === 'KeyB' && !e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); if (sand.active) sand.exit(); else sand.enter(); return }
      if (sand.active && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const tool=sandKeys[e.code]
        if (tool) { e.preventDefault(); if (!e.repeat) sand.choose(tool); return }
        if (e.code === 'KeyR') { e.preventDefault(); if (!e.repeat) sand.rotate(e.shiftKey?-Math.PI/8:Math.PI/8); return }
        if (e.code === 'KeyF') { e.preventDefault(); if (!e.repeat) sand.confirm(); return }
        if (e.code === 'Escape') { e.preventDefault(); if (sand.build) sand.cancel(); else sand.exit(); return }
      }
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE', 'ShiftLeft', 'ShiftRight', 'KeyF', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code) || e.code==='Escape' || (['fishing','planting','feeding','lookout','gathering','crafting','sitting','sleeping'].includes(useForestStore.getState().mode) && ['Space', 'Escape'].includes(e.code))) {
        e.preventDefault()
        pressed.current.add(e.code)
        // Where the prompt only points the way, F stays quiet instead of repeating the same hint as a notice.
        if (e.code === 'KeyF' && !e.repeat && ready.current) { const prompt = promptFor(useForestStore.getState()); if (!prompt || prompt.action) useForestStore.getState().interact() }
        if (e.code === 'Space') useForestStore.getState().reel(true)
        if (e.code === 'Escape') {useForestStore.getState().leaveSeat();useForestStore.getState().wakeUp();useForestStore.setState({aquariumOpen:false});useForestStore.getState().cancelFishing();useForestStore.getState().cancelPlanting();useForestStore.getState().cancelFeeding();useForestStore.getState().leaveLookout();useForestStore.getState().cancelWorkshop()}
      }
    }
    function up(e: KeyboardEvent) { if (e.code === 'Space' && usePhotoStore.getState().active) e.preventDefault(); pressed.current.delete(e.code); if(!['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowLeft','ArrowDown','ArrowRight'].some(k=>pressed.current.has(k)))movementIntent.current=null; if (e.code === 'Space') useForestStore.getState().reel(false) }
    function blur() { pressed.current.clear();movementIntent.current=null; useForestStore.getState().pauseFishing();useForestStore.getState().cancelPlanting();useForestStore.getState().cancelFeeding();useForestStore.getState().cancelWorkshop() }
    const unsubscribe = useUiStore.subscribe(s => { if (s.panel) { pressed.current.clear(); movementIntent.current = null } })
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', blur)
    document.addEventListener('visibilitychange', blur)
    return () => {
      unsubscribe()
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', blur)
      document.removeEventListener('visibilitychange', blur)
    }
  }, [])

  useFrame(({ camera, clock }, delta) => {
    const character = root.current
    if (!character) return
    const dt = Math.min(delta, .05)
    useTourStore.getState().tick(dt)
    const transferring=!!(useForestStore.getState().boatTransfer||useForestStore.getState().lookoutTransfer||useForestStore.getState().workshopTransfer||useForestStore.getState().homeTransfer)
    if(transferring)pressed.current.clear()
    const transferCommitted=useForestStore.getState().tickBoatTransfer(dt)
    const homeCommitted=useForestStore.getState().tickHome(dt)
    const workshopCommitted=useForestStore.getState().tickWorkshopTransfer(dt)
    const lookoutCommitted=useForestStore.getState().tickLookoutTransfer(dt)
    const sleeping=useForestStore.getState().mode==='sleeping',returnedFromSleep=wasSleeping.current&&!sleeping
    if(sleeping!==wasSleeping.current){pressed.current.clear();movementIntent.current=null}
    wasSleeping.current=sleeping
    // While a panel is open the raccoon and boat hold still; scenery keeps animating.
    const hold = gameplayPaused(useForestStore.getState())
    const photoActive=usePhotoStore.getState().active
    // Photo mode holds the game but still turns the view and the tower look-around.
    const look=photoActive?pressed.current:null
    const freeLook=photoActive&&usePhotoStore.getState().free
    const keys = hold ? new Set<string>() : pressed.current
    const x = Number(keys.has('KeyD') || keys.has('ArrowRight')) - Number(keys.has('KeyA') || keys.has('ArrowLeft'))
    const z = Number(keys.has('KeyS') || keys.has('ArrowDown')) - Number(keys.has('KeyW') || keys.has('ArrowUp'))
    const running = keys.has('ShiftLeft') || keys.has('ShiftRight')
    const speed = running ? 3.08 : 1.1
    motion.current = 'idle'
    const state = useForestStore.getState()
    const islandOverview=state.location==='island'&&['walking','rowing','sitting'].includes(state.mode)&&orbit.current.zoom>5
    if(state.islandOverview!==islandOverview)useForestStore.setState({islandOverview})
    if(camera instanceof THREE.PerspectiveCamera){const fov=state.mode==='sleeping'?55:state.location!=='island'?62:46;if(camera.fov!==fov){camera.fov=fov;camera.updateProjectionMatrix()}}
    // Through a door the raccoon faces into the new space. Indoors the camera follows from behind;
    // outdoors "behind" is inside the building, so it starts out front, three-quarter on, with the door behind.
    const doorway=homeCommitted||workshopCommitted,outside=doorway&&state.location==='island'
    if(doorway)character.rotation.y=outside?Math.PI:0
    if(homeCommitted||workshopCommitted||lookoutCommitted||transferCommitted){Object.assign(orbit.current,createOrbit(character.rotation.y+(outside?Math.PI-.5:0)));movementHeading.current=character.rotation.y;movementIntent.current=null}
    if(!transferring&&!state.inspectingTree&&(state.mode==='walking'||state.mode==='rowing'||state.mode==='sitting')){
      const turn=freeLook?0:Number((look??keys).has('KeyQ'))-Number((look??keys).has('KeyE'))
      rotateOrbit(orbit.current,turn*orbitConfig.keySpeed*dt/orbitConfig.yawPerPixel,0,photoActive?photoOrbit.minPitch:undefined,photoActive?photoOrbit.maxPitch:undefined)
      if(dragging.current)orbit.current.idle=0
      stepOrbit(orbit.current,dt,motionPreference.matches,state.mode==='rowing'&&!photoActive?state.boat.heading-Math.PI/2:undefined)
    }
    character.rotation.x=0;character.rotation.z=0
    character.visible = state.mode !== 'rowing' && state.mode !== 'lookout' && state.mode !== 'sleeping' && !(photoActive&&usePhotoStore.getState().hideRaccoon)
    // Back inside play limits once the camera is put away.
    if(wasPhoto.current&&!photoActive)clampOrbitTargets(orbit.current,[orbitConfig.minPitch,orbitConfig.maxPitch],[orbitConfig.minZoom,orbitConfig.maxZoom])
    wasPhoto.current=photoActive
    // Store position also supplies the safe landing point after leaving the boat.
    character.position.set(state.position.x, state.location!=='island'?0:sandGroundAt(state.position.x, state.position.z), state.position.z)
    if(state.location==='island'&&state.mode==='walking')for(const tree of state.garden.trees){
      const spot=plantingSpots[tree.spot],r=pushRadius[tree.stage],dx=character.position.x-spot.x,dz=character.position.z-spot.z,d=Math.hypot(dx,dz)
      if(d<r){character.position.x=spot.x+(d?dx/d:0)*(r+.01);character.position.z=spot.z+(d?dz/d:1)*(r+.01)}
    }
    if(state.mode==='sitting'&&state.sitting){
      const seat=seats.find(v=>v.id===state.sitting?.id);character.rotation.y=seat?.yaw??-Math.PI/2
      if(seat){
        const slide=seatSlide(state.sitting)
        character.position.x+=Math.sin(seat.yaw)*slide;character.position.z+=Math.cos(seat.yaw)*slide
        character.position.y=groundHeightAt(seat.x,seat.z)+seatLift(state.sitting)
      }
      motion.current=state.sitting.phase==='down'?'bench_sit_down':state.sitting.phase==='up'?'bench_stand_up':'bench_sit_idle'
      if((x||z)&&state.sitting.phase==='idle')state.leaveSeat()
    }

    if(state.mode==='foraging'&&state.foraging){state.tickForage(dt);motion.current='interact';const at=state.foraging;character.rotation.y=Math.atan2(character.position.x-at.x,character.position.z-at.z)}
    if(state.mode==='launching'){state.tickLaunch(dt);motion.current='interact';character.rotation.y=Math.atan2(character.position.x-launchPoint.x,character.position.z-launchPoint.z)}
    if(state.mode==='feeding'){state.tickFeeding(dt);motion.current='interact';character.rotation.y=Math.atan2(character.position.x-(feedSpot.x+1),character.position.z-feedSpot.z)}
    if(state.mode==='planting'){state.tickPlanting(dt);motion.current='interact';const spot=plantingSpots[state.plot??0];character.rotation.y=Math.atan2(character.position.x-spot.x,character.position.z-spot.z)}
    if(state.mode==='gathering'||state.mode==='crafting'){
      state.tickWorkshop(dt)
      const target=state.mode==='gathering'?woodSpot:workpieceSpot
      character.rotation.y=Math.atan2(character.position.x-target.x,character.position.z-target.z)
      if(state.mode==='crafting')character.position.z=-1.1
      motion.current=state.mode==='gathering'?'interact':'woodwork'
    }
    if (state.mode === 'rowing'&&!transferring&&!hold) state.updateBoat(stepBoat(state.boat, -z, -x, dt))
    if (state.mode === 'fishing') {
      state.tickFishing(dt)
      const f = useForestStore.getState().fishing
      if (f) motion.current = fishingClips[f.phase]
      character.rotation.y = fishingSites[f?.site ?? 'pond'].facing
    }
    // Building in the sand: the raccoon stays put, faces the work and digs with the gathering motion.
    const sand=useSandStore.getState()
    if(sand.active&&!sand.build&&(state.location!=='island'||state.mode!=='walking'||!inSandRect(state.position.x,state.position.z,.3)))sand.exit()
    const building=sand.build
    if(building&&!hold){sand.tick(dt);motion.current='interact';character.rotation.y=Math.atan2(character.position.x-building.work.x,character.position.z-building.work.z)}
    sandAim.facing=character.rotation.y
    if(state.mode!=='walking'){movementHeading.current=character.rotation.y;movementIntent.current=null}
    if(transferring||(x===0&&z===0))movementIntent.current=null
    if (state.mode === 'walking' && !transferring && !building && ready.current && (x !== 0 || z !== 0)) {
      if(state.inspectingTree||state.aquariumOpen||state.recipesOpen)useForestStore.setState({inspectingTree:false,aquariumOpen:false,recipesOpen:false})
      const intent=cameraRelativeMovement(x,z,orbit.current.yaw)!
      movementIntent.current=intent
      const next = state.location==='bedroom'?moveInBedroom(character.position,intent.x*speed*dt,intent.z*speed*dt):state.location==='workshop'?moveInWorkshop(character.position,intent.x*speed*dt,intent.z*speed*dt,state.workshopBook.phase==='finished'):moveOnGround(character.position, intent.x*speed*dt, intent.z*speed*dt,[...trunks(state.garden),...sandObstacles(sand.book.works)],state.workshopBook.phase)
      if (Math.hypot(next.x - character.position.x, next.z - character.position.z) > .00001) {
        movementHeading.current=movementYaw(next.x-character.position.x,next.z-character.position.z,movementHeading.current)
        // Paws press prints into the play sand, one stride at a time.
        if(state.location==='island'&&inSandRect(next.x,next.z)){const step=stepStride(stride.current,character.position,next,running);stride.current=step.stride;if(step.print)pressPaw(step.print,clock.elapsedTime)}
        character.position.set(next.x,state.location!=='island'?0:sandGroundAt(next.x, next.z), next.z)
        motion.current = running ? 'run' : 'walk'
      }
    }
    if(state.mode==='walking'&&!transferring){
      const difference=movementHeading.current-character.rotation.y
      character.rotation.y+=Math.atan2(Math.sin(difference),Math.cos(difference))*(1-Math.exp(-12*dt))
    }
    if (state.mode === 'walking') updatePosition(character.position.x, character.position.z)
    const current = useForestStore.getState()
    const tour=useTourStore.getState()
    if(tour.active){
      // The route starts from wherever the camera was looking.
      let from=tour.from
      if(!from){const ahead=camera.position.clone().addScaledVector(camera.getWorldDirection(new THREE.Vector3()),10);from={eye:[camera.position.x,camera.position.y,camera.position.z],target:[ahead.x,ahead.y,ahead.z]};useTourStore.setState({from})}
      const frame=tourFrame(tour.elapsed,from);camera.position.set(...frame.eye);camera.lookAt(...frame.target)
      return
    }
    if(freeLook){
      // Hand-flown camera: starts where the camera is, then keeps to the raccoon's surroundings.
      let view=freeCam.view
      if(!view){const d=new THREE.Vector3();camera.getWorldDirection(d);view=viewFromDirection(camera.position,d)}
      const k=pressed.current,has=(a:string,b:string)=>k.has(a)||k.has(b)
      view=moveFreeView(view,{forward:Number(has('KeyW','ArrowUp'))-Number(has('KeyS','ArrowDown')),right:Number(has('KeyD','ArrowRight'))-Number(has('KeyA','ArrowLeft')),up:Number(k.has('KeyE'))-Number(k.has('KeyQ'))},freeSpeed*dt)
      const inside=current.location!=='island',boxes=current.location==='bedroom'?bedroomCameraBoxes:inside?indoorCameraBoxes:outdoorCameraBoxes
      const centre=current.mode==='rowing'?{x:current.boat.x,y:seaLevel+.5,z:current.boat.z}:{x:character.position.x,y:character.position.y+.5,z:character.position.z}
      const safe=constrainFreePosition(view,centre,{boxes,crowns:inside?[]:canopySpheres,floor:inside?()=>0:(x,z)=>Math.max(groundHeightAt(x,z),seaLevel),room:inside?{x:3.72,z:2.72,ceiling:3.05}:undefined})
      view={...view,...safe};freeCam.view=view
      const d=lookDirection(view)
      camera.position.set(view.x,view.y,view.z);camera.lookAt(view.x+d.x,view.y+d.y,view.z+d.z)
      return
    }
    if(current.mode==='lookout'){
      if(!transferring&&!freeLook){const lx=look?Number(look.has('KeyD')||look.has('ArrowRight'))-Number(look.has('KeyA')||look.has('ArrowLeft')):x,lz=look?Number(look.has('KeyS')||look.has('ArrowDown'))-Number(look.has('KeyW')||look.has('ArrowUp')):z;current.turnLookout(-lx*dt*.7,-lz*dt*.4)}
      const {yaw,pitch}=useForestStore.getState().lookoutView
      camera.position.set(lookoutEye.x,lookoutEye.y,lookoutEye.z)
      camera.lookAt(lookoutEye.x+Math.sin(yaw)*Math.cos(pitch),lookoutEye.y+Math.sin(pitch),lookoutEye.z+Math.cos(yaw)*Math.cos(pitch))
      return
    }
    const looked=current.plot!==null?current.garden.trees.find(t=>t.spot===current.plot):undefined
    if(current.inspectingTree&&looked&&current.mode==='walking'){
      const h=growthStages[looked.stage].height,spot=plantingSpots[looked.spot],ground=groundHeightAt(spot.x,spot.z)
      camera.position.lerp(new THREE.Vector3(spot.x+Math.max(.8,h*1.1),ground+Math.max(.5,h*.8),spot.z+Math.max(.8,h*1.1)),1-Math.exp(-4*dt))
      camera.lookAt(spot.x,ground+h*.45,spot.z)
      return
    }
    if(current.mode==='feeding'){
      camera.position.lerp(new THREE.Vector3(12.8,4.2,.2),1-Math.exp(-3*dt))
      camera.lookAt(8,.5,5.7)
      return
    }
    if(current.location==='workshop'&&current.mode==='crafting'){
      const p=current.position
      const next=new THREE.Vector3(THREE.MathUtils.clamp(p.x*.4+.7,-1.8,1.8),3.05,THREE.MathUtils.clamp(p.z+3.8,1.6,2.8))
      if(workshopCommitted)camera.position.copy(next)
      else camera.position.lerp(next,1-Math.exp(-5*dt))
      camera.lookAt(p.x*.5,.55,Math.min(p.z-1,1.3))
      return
    }
    if(current.mode==='sleeping'&&current.sleepJourney){
      const shot=sleepCamera(current.sleepJourney.target);camera.position.set(...shot.position);camera.lookAt(...shot.target);return
    }
    if(current.stargazing&&current.mode==='sitting'){
      // Looking up from the seat: the eye eases to just behind the head and tilts up along the seat's facing.
      const yaw=character.rotation.y,forward=new THREE.Vector3(-Math.sin(yaw),0,-Math.cos(yaw))
      const head=new THREE.Vector3(character.position.x,character.position.y+1.05,character.position.z)
      camera.position.lerp(head.clone().addScaledVector(forward,-.85).add(new THREE.Vector3(0,.45,0)),1-Math.exp(-2.2*dt))
      skyLook.current.lerp(head.clone().addScaledVector(forward,8).add(new THREE.Vector3(0,6,0)),1-Math.exp(-2.2*dt))
      camera.lookAt(skyLook.current)
      return
    }
    skyLook.current.copy(camera.position).add(camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(6))
    if(current.mode!=='rowing'&&current.mode!=='fishing'){
      const inside=current.location!=='island'
      // Outdoors the view eases toward the slope ahead; it fades out as the orbit widens to the island overview.
      const tilt=inside?0:slopePitch(groundHeightAt,character.position,orbit.current.yaw)*THREE.MathUtils.clamp((4-orbit.current.zoom)/2,0,1)
      slopeTilt.current=returnedFromSleep||homeCommitted||transferCommitted||lookoutCommitted||workshopCommitted?tilt:slopeTilt.current+(tilt-slopeTilt.current)*(1-Math.exp(-2.5*dt))
      const view={zoom:orbit.current.zoom,pitch:THREE.MathUtils.clamp(orbit.current.pitch+slopeTilt.current,orbitConfig.minPitch,orbitConfig.maxPitch)}
      const {eye,target}=walkingCamera(character.position,orbit.current.yaw,inside,view,current.location==='bedroom'?bedroomCameraBoxes:inside?indoorCameraBoxes:outdoorCameraBoxes)
      // Outdoors, a camera that would sit inside a tree crown slides along the arm to just outside it.
      const clear=inside?eye:clearCanopy(target,eye,canopySpheres)
      const next=new THREE.Vector3(clear.x,clear.y,clear.z)
      if(returnedFromSleep||homeCommitted||transferCommitted||lookoutCommitted||workshopCommitted)camera.position.copy(next)
      else camera.position.lerp(next,1-Math.exp(-7*dt))
      // Position interpolation can cut a corner; constrain the interpolated arm too.
      const safe=clipCameraArm(target,camera.position,current.location==='bedroom'?bedroomCameraBoxes:inside?indoorCameraBoxes:outdoorCameraBoxes)
      safe.y=Math.max(safe.y,camera.position.y)
      if(!inside)Object.assign(safe,clearCanopy(target,safe,canopySpheres))
      if(inside){safe.x=THREE.MathUtils.clamp(safe.x,-3.72,3.72);safe.z=THREE.MathUtils.clamp(safe.z,-2.72,2.72)}
      safe.y=inside?Math.min(3.05,safe.y):Math.max(safe.y,groundHeightAt(safe.x,safe.z)+.25)
      camera.position.set(safe.x,safe.y,safe.z)
      camera.lookAt(target.x,target.y,target.z)
      return
    }
    const target = current.mode === 'rowing' ? current.boat : character.position
    const surface=current.mode==='rowing'?seaLevel:character.position.y
    const focus=outdoorOrbitFocus({x:target.x,y:surface+.05,z:target.z},orbit.current.zoom,orbit.current.pitch)
    const radius=8.7*orbit.current.zoom,horizontal=radius*Math.cos(focus.pitch)
    // Fishing: behind and to the right of the angler, whichever way the site faces.
    const site=fishingSites[current.fishing?.site??'pond'],fx=-Math.sin(site.facing),fz=-Math.cos(site.facing)
    const cameraTarget=current.mode==='fishing'?new THREE.Vector3(target.x-1.8*fx-5*fz,surface+3.2,target.z-1.8*fz+5*fx):new THREE.Vector3(focus.target.x+Math.sin(orbit.current.yaw)*horizontal,focus.target.y+radius*Math.sin(focus.pitch),focus.target.z+Math.cos(orbit.current.yaw)*horizontal)
    if(homeCommitted||transferCommitted||lookoutCommitted||workshopCommitted)camera.position.copy(cameraTarget)
    else camera.position.lerp(cameraTarget, 1 - Math.exp(-3 * dt))
    if(current.mode==='fishing')camera.lookAt(target.x+fx,surface+.85,target.z+fz)
    else camera.lookAt(focus.target.x,focus.target.y,focus.target.z)
  }, -2)

  useFrame(({ gl, scene, camera }) => {
    // Opt-in, read-only local QA telemetry; removed from production builds.
    if (qaEnabled && root.current) {
      // Geometry audits (scripts/audit_collisions.mjs) read the live scene graph.
      Object.assign(window, { forestScene: scene })
      const current = useForestStore.getState()
      const models = ['raccoon', 'workshop', 'lookout', 'canoe'].filter((name) => scene.getObjectByName(`asset-${name}`))
      gl.domElement.dataset.forestQa = JSON.stringify({
        position: root.current.position.toArray(), motion: motion.current, ready: ready.current, models,
        animation: scene.getObjectByName('asset-raccoon')?.userData.animation,woodwork:scene.getObjectByName('asset-raccoon')?.userData.woodwork,
        homeBook:current.homeBook,homeReady:current.homeReady,homeTransfer:current.homeTransfer,sitting:current.sitting,sleepElapsed:current.sleepElapsed,sleepJourney:current.sleepJourney,timeOfDay:current.timeOfDay,mode: current.mode, boatTransfer:current.boatTransfer,boat: current.boat, boatReady: current.boatReady, dockReady: !!scene.getObjectByName('asset-coastal-jetty'),
        lookoutReady:current.lookoutReady,lookoutTransfer:current.lookoutTransfer,lookoutView:current.lookoutView,cameraPosition:camera.position.toArray(),orbit:orbit.current,orbitDragging:dragging.current,movementHeading:movementHeading.current,inputDirection:movementIntent.current,characterYaw:root.current.rotation.y,playerVisible:root.current.visible,
        canBoard: canBoard(current.position.x, current.position.z, current.boat), canLand: canLand(current.boat),
        boatAnimation: scene.getObjectByName('asset-canoe')?.userData.animation,
        boatSurface:scene.getObjectByName('asset-canoe')?.userData.surface,
        waterFeedback:scene.getObjectByName('boat-water-feedback')?.userData.qa,
        wetland:scene.getObjectByName('Boardwalk_240')?.parent?.userData.qa,
        travel:current.travel,
        fishing: current.fishing, fishingReady: current.fishingReady, fishBook: current.fishBook,
        fishingVisual: scene.getObjectByName('fishing-tools')?.userData.qa,
        garden:current.garden,plot:current.plot,growthReady:current.growthReady,plantingElapsed:current.plantingElapsed,growthVisual:scene.getObjectByName('planted-tree')?.userData.stage,
        farmReady:current.farmReady,mealActive:current.mealActive,farmBook:current.farmBook,feedingElapsed:current.feedingElapsed,farmVisual:scene.getObjectByName('forest-farm')?.userData.qa,
        location:current.location,workshopTransfer:current.workshopTransfer,workshopReady:current.workshopReady,workshopBook:current.workshopBook,craft:current.craft,gatheringElapsed:current.gatheringElapsed,workshopVisual:scene.getObjectByName('workshop-craft')?.userData.qa,
        triangles: gl.info.render.triangles, calls: gl.info.render.calls,
      })
    }
  })

  return <group ref={root}>
    <Suspense fallback={null}><ModelAsset asset="raccoon" motion={motion} onReadyChange={onReadyChange} /></Suspense>
  </group>
}

function Scene() {
  const inside=useForestStore(s=>s.location!=='island'&&s.mode!=='sleeping')
  const stones = pathStones
  return <>
    <group visible={!inside} name="island-exterior">
    <Atmosphere />
    <Rainbow />
    <IslandTerrain />
    <WestWetland />
    <MistIsland />
    <IslandTrees />
    <ForestKit />
    <GroundCover />
    <PathDetails />
    <PondLife />
    <Stockpiles />
    <AmbientLife />
    <Suspense fallback={null}><CoastalRocks /></Suspense>
    <OceanBoundary />
    {stones.map(([x, z], i) => <mesh key={i} position={[x, .13, z]} scale={[1, .44, .8]} rotation={[0, i, 0]}>
      <icosahedronGeometry args={[.36, 1]} /><meshStandardMaterial color="#9f9e86" roughness={.95} />
    </mesh>)}
    <Workshop />
    <Tower />
    <Suspense fallback={null}><FarmScene /></Suspense>
    <Water />
    <Suspense fallback={null}><ExpansionExterior/></Suspense>
    <Suspense fallback={null}><GrowingTree /></Suspense>
    <Suspense fallback={null}><FishingScene /></Suspense>
    <ForageItems />
    <SandPlay />
    <Furniture place="island" />
    <Secrets />
    <RiverLanterns />
    </group>
    <Suspense fallback={null}><WorkshopCraft/></Suspense>
    <Suspense fallback={null}><Bedroom/></Suspense>
    <Player />
    <SoundDirector />
    <Climate />
    <PuddleReflection />
    <PostEffects />
    <PhotoCapture />
    {import.meta.env.DEV && <><ReviewCamera /><ScaleReview/></>}
  </>
}

export function ForestWorld() {
  return <Canvas shadows dpr={[1, 1.7]} camera={{ position: [8, 5.8, 8], fov: 46, far: 600 }} gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1 }} style={{ height: '100%', width: '100%' }}>
    <Suspense fallback={null}><Scene /></Suspense>
  </Canvas>
}
