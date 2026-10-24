import {beforeEach,afterEach,it,expect,vi} from 'vitest'
import {farmStorageKey,feedSpot} from './farm'
let memory:Map<string,string>
beforeEach(()=>{vi.resetModules();memory=new Map();vi.stubGlobal('window',{localStorage:{getItem:(k:string)=>memory.get(k)??null,setItem:(k:string,v:string)=>memory.set(k,v)}})})
afterEach(()=>vi.unstubAllGlobals())
it('requires assets and reach; cancellation makes no food; one completed meal earns one saved record',async()=>{
 const {useForestStore:s}=await import('./store')
 s.setState({nearby:'farm',position:feedSpot});s.getState().interact();expect(s.getState().mode).toBe('walking')
 s.setState({farmReady:true,position:{x:8,z:6}});s.getState().interact();expect(s.getState().mode).toBe('walking')
 s.setState({position:feedSpot});s.getState().interact();expect(s.getState().mode).toBe('feeding')
 s.getState().tickFeeding(.05);s.getState().cancelFeeding();expect(s.getState().mealActive).toBe(false);expect(memory.size).toBe(0)
 s.getState().interact();for(let i=0;i<33;i++)s.getState().tickFeeding(.05)
 expect(s.getState().mealActive).toBe(true);s.getState().interact();expect(s.getState().mode).toBe('walking')
 s.getState().finishMeal();s.getState().finishMeal();expect(s.getState().farmBook.meals).toBe(1)
 expect(JSON.parse(memory.get(farmStorageKey)!).meals).toBe(1)
})
it('loads only completed meals and keeps a failed save playable',async()=>{
 memory.set(farmStorageKey,'{"version":1,"meals":4}')
 const {useForestStore:s}=await import('./store');expect(s.getState().farmBook.meals).toBe(4);expect(s.getState().mealActive).toBe(false)
 window.localStorage.setItem=()=>{throw Error('denied')}
 s.setState({mealActive:true});s.getState().finishMeal();expect(s.getState().farmBook.meals).toBe(5);expect(s.getState().message).toContain('无法保存')
})
