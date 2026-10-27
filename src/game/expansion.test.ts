import {beforeEach,afterEach,it,expect,vi} from 'vitest'
import {cabin,camp,seats,seatOrigin,bridge,bridgeHeight,creekZ,bedSpot,tankSpot,canStandInBedroom,moveInBedroom,decodeHome,emptyHome,addCatch,catchId,latestCatchChoice,expansionStorageKey} from './expansion'
import {canStandAt,moveOnGround,groundHeightAt} from './movement'
import {lookoutEntry} from './lookout'
import {workshopDoor} from './workshop'
import {terrainHeight,highlandPaths} from '../world/terrain'
import {shorelineRadius,landformHeight,seaLevel,landing} from '../world/worldConfig'
import {sleepDuration} from './dayCycle'
let memory:Map<string,string>
beforeEach(()=>{vi.resetModules();memory=new Map();vi.stubGlobal('window',{location:{search:''},localStorage:{getItem:(k:string)=>memory.get(k)??null,setItem:(k:string,v:string)=>memory.set(k,v)}})})
afterEach(()=>vi.unstubAllGlobals())

it('connects all new and existing destinations over walkable terrain without crossing the creek or cliffs',()=>{
 const step=.5,side=177,offset=44,visited=new Uint8Array(side*side),queue:number[]=[]
 const index=(x:number,z:number)=>(Math.round(z/step)+offset*2)*side+Math.round(x/step)+offset*2
 queue.push(index(0,0));visited[queue[0]]=1
 for(let head=0;head<queue.length;head++){
  const id=queue[head],x=(id%side-offset*2)*step,z=(Math.floor(id/side)-offset*2)*step
  for(const [dx,dz] of [[step,0],[-step,0],[0,step],[0,-step]]){
   const nx=x+dx,nz=z+dz;if(Math.abs(nx)>offset||Math.abs(nz)>offset)continue
   const next=index(nx,nz);if(visited[next]||!canStandAt(nx,nz))continue
   const end=moveOnGround({x,z},dx,dz);if(Math.hypot(end.x-nx,end.z-nz)>.001)continue
   visited[next]=1;queue.push(next)
  }
 }
 const targets=[['cabin',{x:cabin.x,z:cabin.doorZ}],['tower',lookoutEntry],['dock',landing],['workshop',workshopDoor],['fishing',{x:1.5,z:-5}],['farm',{x:8,z:4.3}],['camp',{x:camp.x,z:camp.z-1.5}],...seats.map(s=>[s.id,seatOrigin(s)] as const)] as const
 for(const [name,p] of targets){
  expect(canStandAt(p.x,p.z),`destination blocked: ${name}`).toBe(true)
  const connected=queue.some(id=>{const x=(id%side-offset*2)*step,z=(Math.floor(id/side)-offset*2)*step;return Math.hypot(x-p.x,z-p.z)<.71})
  expect(connected,`destination unreachable: ${name}`).toBe(true)
 }
 const blocked=[];for(const [ax,az,bx,bz] of highlandPaths)for(let t=0;t<=1;t+=.05){const x=ax+(bx-ax)*t,z=az+(bz-az)*t;if(!canStandAt(x,z))blocked.push([x,z])};expect(blocked,'authored trail centreline').toEqual([])
 expect(canStandAt(-25,creekZ(-25))).toBe(false)
 for(let z=-15;z>=-16.5;z-=.1)expect(canStandAt(-14,z),`south bridge ramp ${z}`).toBe(true)
 for(let z=bridge.z-3.2;z<bridge.z+3.2;z+=.1){expect(canStandAt(bridge.x,z),`bridge approach ${z}`).toBe(true);expect(Math.abs(groundHeightAt(bridge.x,z+.05)-groundHeightAt(bridge.x,z))).toBeLessThan(.12)}
 expect(bridgeHeight(bridge.z)).toBeCloseTo(6.6354,4)
 expect(terrainHeight(-15,-28)).toBeCloseTo(7.3)
 for(let a=0;a<Math.PI*2;a+=.1){const r=shorelineRadius(a);expect(landformHeight(Math.cos(a)*r,Math.sin(a)*r)).toBeCloseTo(seaLevel,6)}
},20000)

it('keeps furniture solid and the bed, tank and doorway accessible',()=>{
 for(const p of [bedSpot,tankSpot,{x:0,z:2.3}])expect(canStandInBedroom(p.x,p.z)).toBe(true)
 expect(canStandInBedroom(-2.2,-.65)).toBe(false);expect(canStandInBedroom(2.3,-1.3)).toBe(false)
 const p=moveInBedroom({x:0,z:0},-10,0);expect(p.x).toBeGreaterThan(-1.08)
 expect(moveInBedroom({x:0,z:0},0,10).z).toBeLessThanOrEqual(2.65)
})
it('requires an actual catch, prevents duplication after release and restores persistent residents',async()=>{
 const {useForestStore:s}=await import('./store'),fish={at:'2026-10-25T02:00:00Z',sizeCm:26},id=catchId(fish)
 s.setState({fishBook:{count:1,bestCm:26,recent:[fish],kinds:{}}})
 s.getState().keepFish(id);expect(s.getState().homeBook.fish).toHaveLength(0)
 s.setState({location:'bedroom',aquariumOpen:true});s.getState().keepFish('unknown');s.getState().keepFish(id);s.getState().keepFish(id)
 expect(s.getState().homeBook.fish).toHaveLength(1);expect(decodeHome(memory.get(expansionStorageKey)!).fish[0].id).toBe(id)
 s.getState().releaseFish(id);s.getState().keepFish(id);expect(s.getState().homeBook.fish).toHaveLength(0)
 let book=emptyHome();for(let i=0;i<6;i++)book=addCatch(book,{...fish,at:`2026-10-25T02:00:0${i}Z`});expect(book.fish).toHaveLength(5)
 for(const raw of ['bad','{}',JSON.stringify({...book,nights:-1})])expect(decodeHome(raw)).toEqual(emptyHome())
})
it('lets the newest catch go into the tank or back into the pond right at the bank, once',async()=>{
 const {useForestStore:s}=await import('./store'),fish={at:'2026-10-25T03:00:00Z',sizeCm:30},caught={phase:'caught' as const,elapsed:0,wait:3,sizeCm:30,progress:1,tension:.2,held:false,paused:false,reason:'' as const,species:'koi' as const}
 s.setState({fishBook:{count:1,bestCm:30,recent:[fish],kinds:{}}})
 // Only while the catch is on the line.
 s.getState().keepCatch();expect(s.getState().homeBook.fish).toHaveLength(0)
 s.setState({mode:'fishing',fishing:caught});expect(latestCatchChoice(s.getState())).toBeNull()
 s.getState().keepCatch();s.getState().keepCatch();s.getState().releaseCatch()
 expect(s.getState().homeBook.fish.map(f=>f.id)).toEqual([catchId(fish)]);expect(latestCatchChoice(s.getState())).toBe('kept')
 expect(decodeHome(memory.get(expansionStorageKey)!).fish).toHaveLength(1)
 // A released catch never shows up in the tank afterwards.
 const next={at:'2026-10-25T03:05:00Z',sizeCm:22};s.setState({fishBook:{count:2,bestCm:30,recent:[next,fish],kinds:{}}})
 s.getState().releaseCatch();s.getState().keepCatch();expect(latestCatchChoice(s.getState())).toBe('released')
 expect(s.getState().homeBook.fish).toHaveLength(1)
 s.setState({mode:'walking',fishing:null,location:'bedroom',aquariumOpen:true});s.getState().keepFish(catchId(next));expect(s.getState().homeBook.fish).toHaveLength(1)
 // A full tank refuses the keep but still allows letting go.
 let full=emptyHome();for(let i=0;i<5;i++)full=addCatch(full,{...fish,at:`2026-10-25T04:00:0${i}Z`})
 const last={at:'2026-10-25T05:00:00Z',sizeCm:24};s.setState({homeBook:full,location:'island',aquariumOpen:false,mode:'fishing',fishing:caught,fishBook:{count:8,bestCm:30,recent:[last],kinds:{}}})
 s.getState().keepCatch();expect(latestCatchChoice(s.getState())).toBeNull();s.getState().releaseCatch();expect(latestCatchChoice(s.getState())).toBe('released')
})
it('enters and exits at the fade midpoint and sleeps through to morning once',async()=>{
 const {useForestStore:s}=await import('./store');s.setState({position:{x:cabin.x,z:cabin.doorZ},homeReady:true,timeOfDay:'night'})
 s.getState().interact();s.getState().interact();expect(s.getState().location).toBe('island')
 for(let i=0;i<18;i++)s.getState().tickHome(.05);expect(s.getState().location).toBe('bedroom');expect(s.getState().homeTransfer).toBeNull()
 s.setState({position:bedSpot});s.getState().interact();expect(s.getState().mode).toBe('sleeping')
 s.getState().tickHome(NaN);expect(s.getState().sleepElapsed).toBe(0)
 for(let i=0;i<=sleepDuration/.05;i++)s.getState().tickHome(.05)
 expect(s.getState().homeBook.nights).toBe(1);expect(s.getState().timeOfDay).toBe('day');expect(s.getState().mode).toBe('walking')
 s.setState({position:{x:0,z:2.5}});s.getState().interact();for(let i=0;i<18;i++)s.getState().tickHome(.05)
 expect(s.getState().location).toBe('island');expect(s.getState().position).toEqual({x:cabin.x,z:cabin.doorZ})
})
it('plays down, idle and up before restoring the safe approach position; campfire survives blocked storage',async()=>{
 const {useForestStore:s}=await import('./store'),p=seatOrigin(seats[0]);s.setState({position:p});s.getState().interact()
 expect(s.getState().sitting?.phase).toBe('down');s.getState().leaveSeat();expect(s.getState().sitting?.phase).toBe('down')
 for(let i=0;i<45;i++)s.getState().tickHome(.05);expect(s.getState().sitting?.phase).toBe('idle')
 s.getState().interact();for(let i=0;i<46;i++)s.getState().tickHome(.05);expect(s.getState().mode).toBe('walking');expect(s.getState().position).toEqual(p)
 window.localStorage.setItem=()=>{throw Error('blocked')};s.setState({position:{x:camp.x,z:camp.z-1.5}});s.getState().interact();expect(s.getState().homeBook.fireLit).toBe(true);expect(s.getState().message).toContain('无法保存')
 s.getState().interact();expect(s.getState().homeBook.fireLit).toBe(false)
})
