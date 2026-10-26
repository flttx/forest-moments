import {sleepCamera} from '../game/dayCycle'
import {Bedroom,ExpansionExterior} from './ExpansionScene'
import {moveInBedroom,seats} from '../game/expansion'
import {cameraRelativeMovement} from '../game/movementInput'
import {createOrbit,rotateOrbit,stepOrbit,orbitConfig,spawnYaw} from '../game/orbitCamera'
import {useOrbitInput} from './useOrbitInput'
import {ScaleReview} from './ScaleReview'
import {PostEffects} from './PostEffects'
import { Canvas, useFrame } from '@react-three/fiber'
import { Suspense, useCallback, useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useForestStore } from '../game/store'
import {useUiStore,gameplayPaused} from '../game/uiStore'
import {promptFor} from '../game/prompt'
import { groundHeightAt, moveOnGround, pathStones } from '../game/movement'
import { lookoutPosition, workshopPosition } from './assets'
import { canBoard, canLand, stepBoat } from '../game/rowing'
import { RowingBoat } from './RowingBoat'
import { fishingClips } from '../game/fishing'
import { FishingScene } from './FishingScene'
import { ModelAsset } from './ModelAsset'
import type { Locomotion } from './ModelAsset'
import { Atmosphere } from './Atmosphere'
import { IslandTerrain } from './IslandTerrain'
import { ForestKit } from './ForestKit'
import { GroundCover } from './GroundCover'
import { PondLife } from './PondLife'
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
import {growthStages,plantingSpot} from '../game/growth'
import {lookoutEye} from '../game/lookout'
import {WorkshopCraft} from './WorkshopCraft'
import {woodSpot,workpieceSpot} from '../game/workshop'

import {moveInWorkshop} from '../game/workshopInterior'
import {movementYaw,walkingCamera,outdoorOrbitFocus,clipCameraArm,clearCanopy,indoorCameraBoxes,bedroomCameraBoxes,outdoorCameraBoxes} from '../game/followCamera'
import {canopySpheres} from './vegetationLayout'

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
      flowers: [[-1, 1.1, 3], [-4, .2, 1]],
      trail: [[-2.8, 1.35, 16], [-.9, .05, 11]],
      lamp: [[-1.7, 2.2, 1], [-4.1, 1.2, -2.5]],
      beach: [[27,5,40],[10,0,31]],
      dock: [[48,3.5,8],[41,-.1,.4]],
      overview: [[34, 28, 42], [0, 0, 0]],
      coast: [[24, 4, 27], [0, 1, 0]],
      pond: [[14, 6, 4], [6, .4, -5]],
      workshop: [[-4, 5, 17], [-12, 1.3, 8]],
      tower: [[24,13,-16],[13,10.5,-26]],
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
      reef: [[35,3,-5],[34,0,-16]],
      craft: [[1.5,2.2,1.8],[-.4,.7,-1.8]],
      craftContact: [[1.0,1.1,-.5],[-.6,.55,-1.45]],
      interior: [[0,2.6,2.7],[0,1,-1.3]],
      wood: [[-5.9,1.8,11.8],[-7.9,.3,9.6]],
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
  return <group position={[...lookoutPosition]}>
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
      const ui=useUiStore.getState()
      if (ui.panel) { if (e.code === 'Escape') { e.preventDefault(); ui.closePanel() } return }
      if (useForestStore.getState().aquariumOpen) {
        if (e.code === 'Escape' || (e.code === 'KeyF' && !e.repeat)) { e.preventDefault(); useForestStore.setState({ aquariumOpen: false }) }
        return
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
    function up(e: KeyboardEvent) { pressed.current.delete(e.code); if(!['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowLeft','ArrowDown','ArrowRight'].some(k=>pressed.current.has(k)))movementIntent.current=null; if (e.code === 'Space') useForestStore.getState().reel(false) }
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

  useFrame(({ camera }, delta) => {
    const character = root.current
    if (!character) return
    const dt = Math.min(delta, .05)
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
      const turn=Number(keys.has('KeyQ'))-Number(keys.has('KeyE'))
      rotateOrbit(orbit.current,turn*orbitConfig.keySpeed*dt/orbitConfig.yawPerPixel,0)
      if(dragging.current)orbit.current.idle=0
      stepOrbit(orbit.current,dt,motionPreference.matches,state.mode==='rowing'?state.boat.heading-Math.PI/2:undefined)
    }
    character.rotation.x=0;character.rotation.z=0
    character.visible = state.mode !== 'rowing' && state.mode !== 'lookout' && state.mode !== 'sleeping'
    // Store position also supplies the safe landing point after leaving the boat.
    character.position.set(state.position.x, state.location!=='island'?0:groundHeightAt(state.position.x, state.position.z), state.position.z)
    if(state.location==='island'&&state.tree&&state.mode==='walking'){
      const r=[.34,.39,.47,.60][state.tree.stage],dx=character.position.x-plantingSpot.x,dz=character.position.z-plantingSpot.z,d=Math.hypot(dx,dz)
      if(d<r){character.position.x=plantingSpot.x+(d?dx/d:0)*(r+.01);character.position.z=plantingSpot.z+(d?dz/d:1)*(r+.01)}
    }
    if(state.mode==='sitting'&&state.sitting){
      const seat=seats.find(v=>v.id===state.sitting?.id);character.rotation.y=seat?.yaw??-Math.PI/2
      motion.current=state.sitting.phase==='down'?'bench_sit_down':state.sitting.phase==='up'?'bench_stand_up':'bench_sit_idle'
      if((x||z)&&state.sitting.phase==='idle')state.leaveSeat()
    }

    if(state.mode==='feeding'){state.tickFeeding(dt);motion.current='interact';character.rotation.y=Math.atan2(character.position.x-(feedSpot.x+1),character.position.z-feedSpot.z)}
    if(state.mode==='planting'){state.tickPlanting(dt);motion.current='interact';character.rotation.y=Math.atan2(character.position.x-plantingSpot.x,character.position.z-plantingSpot.z)}
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
      character.rotation.y = -Math.PI / 2
    }
    if(state.mode!=='walking'){movementHeading.current=character.rotation.y;movementIntent.current=null}
    if(transferring||(x===0&&z===0))movementIntent.current=null
    if (state.mode === 'walking' && !transferring && ready.current && (x !== 0 || z !== 0)) {
      if(state.inspectingTree||state.aquariumOpen)useForestStore.setState({inspectingTree:false,aquariumOpen:false})
      const intent=cameraRelativeMovement(x,z,orbit.current.yaw)!
      movementIntent.current=intent
      const next = state.location==='bedroom'?moveInBedroom(character.position,intent.x*speed*dt,intent.z*speed*dt):state.location==='workshop'?moveInWorkshop(character.position,intent.x*speed*dt,intent.z*speed*dt,state.workshopBook.phase==='finished'):moveOnGround(character.position, intent.x*speed*dt, intent.z*speed*dt,state.tree?[.06,.11,.19,.32][state.tree.stage]:0,state.workshopBook.phase)
      if (Math.hypot(next.x - character.position.x, next.z - character.position.z) > .00001) {
        movementHeading.current=movementYaw(next.x-character.position.x,next.z-character.position.z,movementHeading.current)
        character.position.set(next.x,state.location!=='island'?0:groundHeightAt(next.x, next.z), next.z)
        motion.current = running ? 'run' : 'walk'
      }
    }
    if(state.mode==='walking'&&!transferring){
      const difference=movementHeading.current-character.rotation.y
      character.rotation.y+=Math.atan2(Math.sin(difference),Math.cos(difference))*(1-Math.exp(-12*dt))
    }
    if (state.mode === 'walking') updatePosition(character.position.x, character.position.z)
    const current = useForestStore.getState()
    if(current.mode==='lookout'){
      if(!transferring)current.turnLookout(-x*dt*.7,-z*dt*.4)
      const {yaw,pitch}=useForestStore.getState().lookoutView
      camera.position.set(lookoutEye.x,lookoutEye.y,lookoutEye.z)
      camera.lookAt(lookoutEye.x+Math.sin(yaw)*Math.cos(pitch),lookoutEye.y+Math.sin(pitch),lookoutEye.z+Math.cos(yaw)*Math.cos(pitch))
      return
    }
    if(current.inspectingTree&&current.tree&&current.mode==='walking'){
      const h=growthStages[current.tree.stage].height
      camera.position.lerp(new THREE.Vector3(plantingSpot.x+Math.max(.8,h*1.1),Math.max(.5,h*.8),plantingSpot.z+Math.max(.8,h*1.1)),1-Math.exp(-4*dt))
      camera.lookAt(plantingSpot.x,h*.45,plantingSpot.z)
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
    if(current.mode!=='rowing'&&current.mode!=='fishing'){
      const inside=current.location!=='island'
      const {eye,target}=walkingCamera(character.position,orbit.current.yaw,inside,orbit.current,current.location==='bedroom'?bedroomCameraBoxes:inside?indoorCameraBoxes:outdoorCameraBoxes)
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
    const cameraTarget=current.mode==='fishing'?new THREE.Vector3(target.x-1.8,surface+3.2,target.z+5):new THREE.Vector3(focus.target.x+Math.sin(orbit.current.yaw)*horizontal,focus.target.y+radius*Math.sin(focus.pitch),focus.target.z+Math.cos(orbit.current.yaw)*horizontal)
    if(homeCommitted||transferCommitted||lookoutCommitted||workshopCommitted)camera.position.copy(cameraTarget)
    else camera.position.lerp(cameraTarget, 1 - Math.exp(-3 * dt))
    if(current.mode==='fishing')camera.lookAt(target.x+1,surface+.85,target.z)
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
        fishing: current.fishing, fishingReady: current.fishingReady, fishBook: current.fishBook,
        fishingVisual: scene.getObjectByName('fishing-tools')?.userData.qa,
        tree:current.tree,growthReady:current.growthReady,plantingElapsed:current.plantingElapsed,growthVisual:scene.getObjectByName('planted-tree')?.userData.stage,
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
    <IslandTerrain />
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
    </group>
    <Suspense fallback={null}><WorkshopCraft/></Suspense>
    <Suspense fallback={null}><Bedroom/></Suspense>
    <Player />
    <PostEffects />
    {import.meta.env.DEV && <><ReviewCamera /><ScaleReview/></>}
  </>
}

export function ForestWorld() {
  return <Canvas shadows dpr={[1, 1.7]} camera={{ position: [8, 5.8, 8], fov: 46, far: 600 }} gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1 }} style={{ height: '100%', width: '100%' }}>
    <Suspense fallback={null}><Scene /></Suspense>
  </Canvas>
}
