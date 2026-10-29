import {afterEach,beforeEach,expect,it,vi} from 'vitest'
import {berths,seaLevel} from '../world/worldConfig'
import {autumnLoop,autumnPaths,autumnVista,autumnHeight,autumnIsland,autumnOffset} from '../world/autumnIsland'
import {terrainHeight} from '../world/terrain'
import {mistHeight,mistIsland} from '../world/mistIsland'
import {vegetationPositions,autumnPlants,canopySpheres} from '../world/vegetationLayout'
import {canStandAt,moveOnGround,standBlocker} from './movement'
import {canopyDensityAt} from '../world/canopyMap'
import {boatFits,canBoard} from './rowing'
import {outdoorOrbitFocus} from './followCamera'
import {decodeTravel,emptyTravel,travelSpawn,travelStorageKey} from './islandTravel'
import {useForestStore} from './store'
import baseline from '../../docs/evidence/2026-10-29-autumn-island/before/world-snapshot.json'
let storage:Map<string,string>
beforeEach(()=>{
 storage=new Map();vi.stubGlobal('window',{localStorage:{getItem:(k:string)=>storage.get(k)??null,setItem:(k:string,v:string)=>storage.set(k,v)}})
 useForestStore.setState({mode:'walking',location:'island',menuPaused:false,travel:emptyTravel(),boatTransfer:null,boatReady:true,nearby:null,position:{x:0,z:0},lookoutTransfer:null,homeTransfer:null,workshopTransfer:null})
})
afterEach(()=>vi.unstubAllGlobals())
it('makes both dedicated broadleaf species solid with camera and ground canopy coverage',()=>{
 for(const kit of ['ie-birch','ie-maple']){
  const plants=autumnPlants.filter(p=>p.kit===kit)
  expect(plants.length).toBeGreaterThan(0)
  for(const p of plants){
   expect(standBlocker(p.x,p.z)).toBe(`plant:${kit}`)
   expect(canopySpheres.some(c=>Math.hypot(c.x-p.x,c.z-p.z)<.01&&c.r>1.5)).toBe(true)
   expect(canopyDensityAt(p.x,p.z)).toBeGreaterThan(.7)
  }
 }
 expect(autumnPlants.some(p=>p.kit==='round-tree-a')).toBe(false)
})
it('preserves existing land, plants and berths while adding a separate island at the intended size',()=>{
 for(const [x,z,h] of baseline.terrain.filter(([x,z])=>x<72||z<10))expect(terrainHeight(x,z)).toBeCloseTo(h,10)
 for(const [i,p] of baseline.plants.entries()){expect(vegetationPositions[i].kit).toBe(p.kit);for(const key of ['x','z','scale','yaw'] as const)expect(Math.abs(vegetationPositions[i][key]-p[key])).toBeLessThan(1e-10)}
 expect(berths.main).toEqual(baseline.berths.main);expect(berths.mist).toEqual(baseline.berths.mist)
 let area=0
 for(let x=78+autumnOffset.x;x<138+autumnOffset.x;x+=.5)for(let z=10+autumnOffset.z;z<56+autumnOffset.z;z+=.5)if(canStandAt(x,z))area+=.25
 console.log('AUTUMN_AREA',area,'ratio',area/3695)
 expect(area/3695).toBeGreaterThanOrEqual(.2);expect(area/3695).toBeLessThanOrEqual(.25)
 for(let x=91;x<126;x+=1)expect(boatFits(x,10,0),`channel ${x}`).toBe(true)
 for(const berth of Object.values(berths))expect(boatFits(berth.mooring.x,berth.mooring.z,berth.mooring.heading)).toBe(true)
 expect(autumnHeight(117+autumnOffset.x,24+autumnOffset.z)).toBeGreaterThan(autumnHeight(97+autumnOffset.x,33+autumnOffset.z)+1)
 expect(terrainHeight(70,28)).toBeLessThan(seaLevel-.22)
})
it('walks every loop and clearing link both ways, with room beside the path centre',()=>{
 const paths=[[berths.autumn.landing.x,berths.autumn.landing.z,...autumnLoop[0]],...autumnPaths]
 for(const [ax,az,bx,bz] of paths)for(const direction of [1,-1]){
  const [sx,sz,tx,tz]=direction===1?[ax,az,bx,bz]:[bx,bz,ax,az]
  let p:{x:number;z:number}={x:sx,z:sz};const n=Math.ceil(Math.hypot(tx-sx,tz-sz)/.1)
  for(let i=1;i<=n;i++){
   const x=sx+(tx-sx)*i/n,z=sz+(tz-sz)*i/n
   p=moveOnGround(p,x-p.x,z-p.z)
   expect(Math.hypot(p.x-x,p.z-z),`${x},${z}`).toBeLessThan(.001)
   if(x>92+autumnOffset.x)for(const offset of [-.4,.4])expect(canStandAt(x,z+offset),`verge ${x},${z+offset}`).toBe(true)
  }
 }
})
it('records autumn arrival, discovers the hill on foot and restores a boardable third berth',()=>{
 const s=useForestStore.getState,finish=()=>{for(let i=0;i<18;i++)s().tickBoatTransfer(.05)}
 useForestStore.setState({mode:'rowing',boat:{...berths.autumn.mooring,speed:0,phase:0,effort:0}})
 s().interact();finish();expect(s().travel.visitedAutumn).toBe(true);expect(s().travel.checkpoint).toBe('autumn')
 expect(s().nearby).toBe('autumn');expect(s().position).toEqual(berths.autumn.landing)
 s().updatePosition(autumnVista.x,autumnVista.z);expect(s().travel.foundVista).toBe(true)
 const book=decodeTravel(storage.get(travelStorageKey)!);expect(book?.foundVista).toBe(true)
 const restored=travelSpawn(book);expect(canBoard(restored.position.x,restored.position.z,restored.boat)).toBe(true)
 s().updatePosition(restored.position.x,restored.position.z);s().interact();finish();expect(s().mode).toBe('rowing')
})
it('adds false autumn flags to old saves, rejects unknown berths and reports failed saves without stranding the boat',()=>{
 const old=decodeTravel('{"version":1,"checkpoint":"mist","visitedMist":true,"foundPine":true}')
 expect(old).toEqual({...emptyTravel(),checkpoint:'mist',visitedMist:true,foundPine:true})
 expect(decodeTravel('{"version":1,"checkpoint":"tidal"}')).toBeNull()
 vi.stubGlobal('window',{localStorage:{setItem:()=>{throw Error('quota')}}})
 const s=useForestStore.getState
 useForestStore.setState({mode:'rowing',boat:{...berths.autumn.mooring,speed:0,phase:0,effort:0}})
 s().interact();for(let i=0;i<18;i++)s().tickBoatTransfer(.05)
 expect(s().messageKind).toBe('error');expect(canBoard(s().position.x,s().position.z,s().boat)).toBe(true)
})

it('keeps a broad open channel between the two neighbour shorelines',()=>{
 const coast=(island:{x:number;z:number},height:(x:number,z:number)=>number)=>Array.from({length:360},(_,i)=>{
  const a=i*Math.PI/180,c=Math.cos(a),s=Math.sin(a);let low=0,high=35
  for(let j=0;j<30;j++){const r=(low+high)/2;if(height(island.x+c*r,island.z+s*r)>seaLevel)low=r;else high=r}
  return{x:island.x+c*(low+high)/2,z:island.z+s*(low+high)/2}
 })
 const left=coast(mistIsland,mistHeight),right=coast(autumnIsland,autumnHeight)
 const gap=Math.min(...left.map(a=>Math.min(...right.map(b=>Math.hypot(a.x-b.x,a.z-b.z)))))
 console.log('MIST_AUTUMN_SHORE_GAP',gap)
 expect(gap).toBeGreaterThan(20)
})

it('keeps wide walking orbit centred on the current neighbour rather than the other island',()=>{
 for(const island of [mistIsland,autumnIsland]){
  const p={x:island.x+3,y:1,z:island.z+2}
  expect(outdoorOrbitFocus(p,1,.3).target).toEqual({...p,y:1.8})
  expect(outdoorOrbitFocus(p,18,.3).target).toEqual({x:island.x,y:4,z:island.z})
 }
})
