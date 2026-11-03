import {expect,it} from 'vitest'
import {tideCreatures,creatureNear,observeReach,recordCreature} from './tidePoolLife'
import {decodeTravel,emptyTravel} from './islandTravel'
import {canStandAt} from './movement'
import {poolRadius,tidePools} from '../world/tideIsland'

it('keeps one creature on the bed of each pool, seen from a standable spot on its rim',()=>{
 expect(tideCreatures.map(c=>c.pool)).toEqual([0,1,2])
 for(const c of tideCreatures){
  expect(poolRadius(c.x,c.z,tidePools[c.pool])).toBeLessThan(.9)
  // some ground the raccoon can stand on, around the rim, is within reach of the creature
  const rim=Array.from({length:48},(_,i)=>{const a=i/48*Math.PI*2,p=tidePools[c.pool];return{x:p.x+Math.cos(a)*p.rx*1.25,z:p.z+Math.sin(a)*p.rz*1.25}}).filter(p=>canStandAt(p.x,p.z)&&creatureNear(p)?.id===c.id)
  expect(rim.length,c.id).toBeGreaterThan(4)
  expect(creatureNear({x:c.x+observeReach(c.pool)+.5,z:c.z})?.id).not.toBe(c.id)
 }
})
it('records each creature once and reads the guide back, tolerating old saves without it',()=>{
 expect(recordCreature(recordCreature([],'starfish'),'starfish')).toEqual(['starfish'])
 const old={...emptyTravel(),creatures:undefined}
 expect(decodeTravel(JSON.stringify(old))?.creatures).toEqual([])
 expect(decodeTravel(JSON.stringify({...emptyTravel(),creatures:['anemone','x','anemone']}))?.creatures).toEqual(['anemone'])
})
it('F at a pool rim records the creature, saves it, and a second look only shows its note',async()=>{
 const {vi}=await import('vitest')
 const memory=new Map<string,string>()
 vi.stubGlobal('window',{location:{search:''},localStorage:{getItem:(k:string)=>memory.get(k)??null,setItem:(k:string,v:string)=>memory.set(k,v)}})
 vi.resetModules()
 const {useForestStore:s}=await import('./store'),{travelStorageKey}=await import('./islandTravel'),{promptFor}=await import('./prompt')
 const c=tideCreatures[0],p=tidePools[c.pool],spot=Array.from({length:48},(_,i)=>{const a=i/48*Math.PI*2;return{x:p.x+Math.cos(a)*p.rx*1.25,z:p.z+Math.sin(a)*p.rz*1.25}}).find(q=>canStandAt(q.x,q.z)&&creatureNear(q)?.id===c.id)!
 s.setState({location:'island',mode:'walking',position:spot,nearby:null})
 expect(promptFor(s.getState())?.action).toBeTruthy()
 s.getState().interact()
 expect(s.getState().travel.creatures).toEqual([c.id])
 expect(JSON.parse(memory.get(travelStorageKey)!).creatures).toEqual([c.id])
 s.getState().interact()
 expect(s.getState().travel.creatures).toEqual([c.id])
 vi.unstubAllGlobals()
})
