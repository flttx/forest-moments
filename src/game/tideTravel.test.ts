import {afterEach,beforeEach,expect,it,vi} from 'vitest'
import {tideIsland,tideHeight,tideLoop,tidePaths,tidePools,tideObservation,tidePoolWaterY,poolRadius} from '../world/tideIsland'
import {autumnHeight} from '../world/autumnIsland'
import {terrainHeight} from '../world/terrain'
import {berths,seaLevel} from '../world/worldConfig'
import {boatFits,canBoard,stepBoat} from './rowing'
import {canStandAt,moveOnGround} from './movement'
import {decodeTravel,emptyTravel,travelSpawn,travelStorageKey} from './islandTravel'
import {outdoorOrbitFocus} from './followCamera'
import {useForestStore} from './store'
let storage:Map<string,string>
beforeEach(()=>{
 storage=new Map();vi.stubGlobal('window',{localStorage:{getItem:(k:string)=>storage.get(k)??null,setItem:(k:string,v:string)=>storage.set(k,v)}})
 useForestStore.setState({mode:'walking',location:'island',menuPaused:false,travel:emptyTravel(),boatTransfer:null,boatReady:true,nearby:null,position:{x:0,z:0},lookoutTransfer:null,homeTransfer:null,workshopTransfer:null})
})
afterEach(()=>vi.unstubAllGlobals())
it('adds a separate low island within the 12–18% standable-area target, with three closed shallow pools',()=>{
 let area=0
 for(let x=75;x<124;x+=.5)for(let z=80;z<122;z+=.5)if(canStandAt(x,z))area+=.25
 console.log('TIDE_AREA',area,'ratio',area/3695)
 expect(area/3695).toBeGreaterThanOrEqual(.12);expect(area/3695).toBeLessThanOrEqual(.18)
 for(const p of tidePools){
  expect(tideHeight(p.x,p.z)).toBeCloseTo(-.18,8);expect(tidePoolWaterY-tideHeight(p.x,p.z)).toBeCloseTo(.36,8)
  expect(canStandAt(p.x,p.z)).toBe(false)
  // All submerged basin samples are blocked; the full edge ring rises above the fixed water plane.
  for(let a=0;a<Math.PI*2;a+=.1){
   const r=1+.08*Math.sin(a*3+p.phase)+.045*Math.cos(a*5-p.phase)
   const x=p.x+Math.cos(a)*p.rx*r*1.3,z=p.z+Math.sin(a)*p.rz*r*1.3
   expect(tideHeight(x,z),`closed bank ${x},${z}`).toBeGreaterThan(tidePoolWaterY+.1)
  }
  for(let x=p.x-p.rx*1.4;x<p.x+p.rx*1.4;x+=.1)for(let z=p.z-p.rz*1.4;z<p.z+p.rz*1.4;z+=.1){
   if(poolRadius(x,z,p)<1.3&&terrainHeight(x,z)<tidePoolWaterY+.1)expect(canStandAt(x,z)).toBe(false)
  }
 }
 for(let x=86;x<=116;x++)expect(terrainHeight(x,77)).toBeLessThan(seaLevel-.22)
 // The new terrain stays below the existing autumn chunk throughout its bounding box.
 for(let x=80;x<143;x++)for(let z=28;z<75;z++)expect(tideHeight(x,z)).toBeLessThanOrEqual(autumnHeight(x,z))
})
it('walks the landing, entire dry loop and pool outlook branch both ways with shoulders clear',()=>{
 const paths=[[berths.tide.landing.x,berths.tide.landing.z,...tideLoop[0]],...tidePaths]
 for(const [ax,az,bx,bz] of paths)for(const direction of [1,-1]){
  const [sx,sz,tx,tz]=direction===1?[ax,az,bx,bz]:[bx,bz,ax,az],distance=Math.hypot(tx-sx,tz-sz),n=Math.ceil(distance/.1)
  let p:{x:number;z:number}={x:sx,z:sz}
  for(let i=1;i<=n;i++){
   const x=sx+(tx-sx)*i/n,z=sz+(tz-sz)*i/n;p=moveOnGround(p,x-p.x,z-p.z)
   expect(Math.hypot(p.x-x,p.z-z),`path ${x},${z}`).toBeLessThan(.001)
   if(x>88)for(const side of [-.5,.5])expect(canStandAt(x+(tz-sz)/distance*side,z-(tx-sx)/distance*side),`shoulder ${x},${z}`).toBe(true)
  }
 }
})
it('supports the complete hull along both directions of the autumn–tide channel and every berth',()=>{
 const points=[[83,48.95],[77,76],[76,97],[79.6,98.5]]
 for(let i=1;i<points.length;i++){
  const [ax,az]=points[i-1],[bx,bz]=points[i],angle=Math.atan2(az-bz,bx-ax),n=Math.ceil(Math.hypot(bx-ax,bz-az)/.1)
  for(let j=0;j<=n;j++)for(const flip of [0,Math.PI])expect(boatFits(ax+(bx-ax)*j/n,az+(bz-az)*j/n,angle+flip),`hull ${i},${j}`).toBe(true)
 }
 for(const p of points.slice(1,-1))for(let a=0;a<Math.PI*2;a+=.1)expect(boatFits(p[0],p[1],a)).toBe(true)
 for(const b of Object.values(berths)){
  expect(boatFits(b.mooring.x,b.mooring.z,b.mooring.heading)).toBe(true)
  let boat={...b.mooring,speed:0,phase:0,effort:0}
  for(let i=0;i<80;i++)boat=stepBoat(boat,1,0,.05)
  expect(Math.hypot(boat.x-b.mooring.x,boat.z-b.mooring.z)).toBeGreaterThan(3)
 }
})
it('records tide arrival and observation, migrates old saves, and restores a boardable fourth berth',()=>{
 const s=useForestStore.getState,finish=()=>{for(let i=0;i<18;i++)s().tickBoatTransfer(.05)}
 expect(decodeTravel('{"version":1,"checkpoint":"autumn","visitedAutumn":true}')?.foundPools).toBe(false)
 useForestStore.setState({mode:'rowing',boat:{...berths.tide.mooring,speed:0,phase:0,effort:0}})
 s().interact();finish();expect(s().travel.visitedTide).toBe(true);expect(s().travel.checkpoint).toBe('tide')
 s().updatePosition(tideObservation.x,tideObservation.z);expect(s().travel.foundPools).toBe(true)
 const restored=travelSpawn(decodeTravel(storage.get(travelStorageKey)!))
 expect(canBoard(restored.position.x,restored.position.z,restored.boat)).toBe(true)
 expect(restored.position).toEqual(berths.tide.landing)
 s().updatePosition(restored.position.x,restored.position.z);s().interact();finish();expect(s().mode).toBe('rowing')
 expect(outdoorOrbitFocus({x:101,y:.6,z:100},18,.3).target).toEqual({x:tideIsland.x,y:4,z:tideIsland.z})
})
