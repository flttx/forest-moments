import {afterEach,beforeEach,expect,it,vi} from 'vitest'
import {decodeTravel,emptyTravel,travelSpawn,travelStorageKey} from './islandTravel'
import {berths} from '../world/worldConfig'
import {mistLoop,mistPaths,mistPine} from '../world/mistIsland'
import {boatFits,canBoard,canLand,stepBoat,initialBoat,approachBerth} from './rowing'
import {canStandAt,moveOnGround} from './movement'
import {useForestStore} from './store'
import {promptFor} from './prompt'
import baseline from '../../docs/evidence/2026-10-29-west-expansion/before/world-snapshot.json'

let storage:Map<string,string>
beforeEach(()=>{
 storage=new Map();vi.stubGlobal('window',{localStorage:{getItem:(k:string)=>storage.get(k)??null,setItem:(k:string,v:string)=>storage.set(k,v)}})
 useForestStore.setState({mode:'walking',location:'island',menuPaused:false,travel:emptyTravel(),boat:{...initialBoat},boatTransfer:null,boatReady:true,nearby:null,position:{x:0,z:0},message:'',lookoutTransfer:null,homeTransfer:null,workshopTransfer:null})
})
afterEach(()=>vi.unstubAllGlobals())

it('keeps the neighbour at 20–25% of the original walkable main island and preserves sea separation',()=>{
 let walkable=0
 for(let x=78;x<135;x+=.5)for(let z=-36;z<10;z+=.5)if(canStandAt(x,z))walkable+=.25
 console.log('MIST_AREA',walkable,'ratio',walkable/baseline.walkableArea)
 expect(walkable/baseline.walkableArea).toBeGreaterThanOrEqual(.2)
 expect(walkable/baseline.walkableArea).toBeLessThanOrEqual(.25)
 for(let x=48;x<76;x++)expect(boatFits(x,-6,0)).toBe(true)
})

it('walks the berth approach and every forest path both ways without tree or slope obstructions',()=>{
 const paths=[[berths.mist.landing.x,berths.mist.landing.z,...mistLoop[0]],...mistPaths]
 for(const [ax,az,bx,bz] of paths)for(const direction of [1,-1]){
  const [sx,sz,tx,tz]=direction===1?[ax,az,bx,bz]:[bx,bz,ax,az]
  let position:{x:number;z:number}={x:sx,z:sz};const n=Math.ceil(Math.hypot(tx-sx,tz-sz)/.1)
  for(let i=1;i<=n;i++){
   const x=sx+(tx-sx)*i/n,z=sz+(tz-sz)*i/n
   position=moveOnGround(position,x-position.x,z-position.z)
   expect(Math.hypot(position.x-x,position.z-z),`${x},${z}`).toBeLessThan(.001)
  }
 }
})

it('allows loaded boarding at both berths, records arrival and discovery, and restores a returnable boat',()=>{
 const s=useForestStore.getState,finish=()=>{for(let i=0;i<18;i++)s().tickBoatTransfer(.05)}
 for(const berth of [berths.mist,berths.main]){
  const boat={...berth.mooring,speed:0,phase:0,effort:0}
  expect(boatFits(boat.x,boat.z,boat.heading)).toBe(true)
  expect(canLand(boat)).toBe(true);expect(canLand({...boat,speed:.4})).toBe(false)
  expect(canBoard(berth.landing.x,berth.landing.z,boat)).toBe(true)
  useForestStore.setState({mode:'rowing',boat});s().interact();finish()
  expect(s().position).toEqual(berth.landing);expect(s().travel.checkpoint).toBe(berth.id)
  const restored=travelSpawn(decodeTravel(storage.get(travelStorageKey)!))
  expect(restored.position).toEqual(berth.landing);expect(canBoard(restored.position.x,restored.position.z,restored.boat)).toBe(true)
  if(berth.id==='mist'){
   s().updatePosition(mistPine.x,mistPine.z+3.7);expect(s().travel.foundPine).toBe(true)
   s().updatePosition(berth.landing.x,berth.landing.z)
  }
  s().interact();finish();expect(s().mode).toBe('rowing')
 }
 expect(s().travel).toEqual({version:1,checkpoint:'main',visitedMist:true,foundPine:true,visitedAutumn:false,foundVista:false})
})

it('uses the departure berth after a reload at sea and ignores missing, corrupt or unknown saves',()=>{
 expect(travelSpawn(null)).toEqual({position:{x:0,z:0},boat:initialBoat})
 for(const raw of ['broken','null','{"version":1,"checkpoint":"__proto__"}','{"version":2,"checkpoint":"mist"}'])expect(decodeTravel(raw)).toBeNull()
 const book={...emptyTravel(),checkpoint:'mist' as const,visitedMist:true}
 const restored=travelSpawn(decodeTravel(JSON.stringify({...book,position:{x:NaN,z:Infinity}})))
 expect(restored.position).toEqual(berths.mist.landing)
 const boat=stepBoat(restored.boat,1,0,.05);expect(boat.x).toBeLessThan(restored.boat.x)
})

it('reports failed travel storage without stranding the player at a berth',()=>{
 vi.stubGlobal('window',{localStorage:{setItem:()=>{throw Error('quota')}}})
 useForestStore.setState({mode:'rowing',boat:{...berths.mist.mooring,speed:0,phase:0,effort:0}})
 const s=useForestStore.getState;s().interact();for(let i=0;i<18;i++)s().tickBoatTransfer(.05)
 expect(s().mode).toBe('walking');expect(s().messageKind).toBe('error');expect(canBoard(s().position.x,s().position.z,s().boat)).toBe(true)
})

it('accepts broad, bow-on and oblique approaches, then moors under cover with a clear departure',()=>{
 const s=useForestStore.getState
 for(const berth of Object.values(berths)){
  const side=Math.sign(berth.mooring.z-berth.landing.z),edge=side<0?berth.dock.minZ:berth.dock.maxZ
  for(const [dx,distance,heading] of [[0,2.1,side*Math.PI/2],[2*side,1.8,0],[2*side,1.8,Math.PI],[0,2.3,side*Math.PI/4]]){
   const boat={...initialBoat,x:berth.mooring.x+dx,z:edge+side*distance,heading}
   expect(boatFits(boat.x,boat.z,heading),JSON.stringify({id:berth.id,dx,distance,heading})).toBe(true)
   expect(canLand(boat)).toBe(true)
   useForestStore.setState({mode:'rowing',boat,boatTransfer:null})
   expect(promptFor(s())?.action).toContain('下船')
   s().interact();expect(s().boat).toEqual(boat)
   for(let i=0;i<18;i++)s().tickBoatTransfer(.05)
   expect(s().mode).toBe('walking');expect(s().boat).toMatchObject(berth.mooring)
   expect(canBoard(s().position.x,s().position.z,s().boat)).toBe(true)
   s().interact();for(let i=0;i<18;i++)s().tickBoatTransfer(.05)
   expect(s().mode).toBe('rowing')
   let departing=s().boat
   for(let i=0;i<40;i++)departing=stepBoat(departing,1,0,.05)
   expect(Math.hypot(departing.x-berth.mooring.x,departing.z-berth.mooring.z)).toBeGreaterThan(1)
  }
 }
})
it('explains braking and rejects the opposite dock side, open sea, deck overlap and invalid input',()=>{
 for(const berth of Object.values(berths)){
  const boat={...initialBoat,...berth.mooring,speed:.5}
  expect(approachBerth(boat)?.id).toBe(berth.id);expect(canLand(boat)).toBe(false)
  useForestStore.setState({mode:'rowing',boat,boatTransfer:null})
  expect(promptFor(useForestStore.getState())?.hint).toContain('松开')
  useForestStore.getState().interact();expect(useForestStore.getState().boatTransfer).toBeNull()
  expect(useForestStore.getState().message).toContain('松开')
  for(const invalid of [
   {...boat,speed:0,z:berth.dock.minZ+berth.dock.maxZ-berth.mooring.z},
   {...boat,speed:0,x:berth.mooring.x+4},
   {...boat,speed:0,z:berth.landing.z},
   {...boat,speed:0,heading:NaN},
   {...boat,speed:NaN},
  ])expect(canLand(invalid)).toBe(false)
 }
})
