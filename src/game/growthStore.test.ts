import {beforeEach,afterEach,expect,it,vi} from 'vitest'
import {growthStorageKey,legacySeedlingKey} from './growth'
let memory:Map<string,string>
beforeEach(()=>{
 vi.resetModules();vi.useFakeTimers();vi.setSystemTime(500000)
 memory=new Map()
 vi.stubGlobal('window',{localStorage:{getItem:(k:string)=>memory.get(k)??null,setItem:(k:string,v:string)=>memory.set(k,v)}})
})
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals()})
it('cancels safely, then plants exactly once and persists later stages',async()=>{
 const {useForestStore:store}=await import('./store')
 store.setState({growthReady:true,position:{x:0,z:6.6},nearby:'grove'})
 store.getState().interact();expect(store.getState().mode).toBe('planting')
 store.getState().cancelPlanting();expect(store.getState().tree).toBeNull();expect(memory.size).toBe(0)
 store.getState().interact();store.getState().interact()
 for(let i=0;i<33;i++)store.getState().tickPlanting(.05)
 expect(store.getState().tree?.stage).toBe(0)
 const at=store.getState().tree!.plantedAt
 store.getState().interact();expect(store.getState().tree!.plantedAt).toBe(at)
 vi.setSystemTime(740000);store.getState().refreshGrowth()
 expect(JSON.parse(memory.get(growthStorageKey)!).stage).toBe(3)
})
it('requires loaded assets and proximity, and migrates legacy saved seedlings',async()=>{
 memory.set(legacySeedlingKey,'true')
 const {useForestStore:store}=await import('./store')
 expect(store.getState().tree?.stage).toBe(1)
 expect(JSON.parse(memory.get(growthStorageKey)!).stage).toBe(1)
 store.setState({tree:null,planted:false,nearby:'grove',position:{x:0,z:6.5}})
 store.getState().interact();expect(store.getState().mode).toBe('walking')
 store.setState({growthReady:true,position:{x:0,z:5}})
 store.getState().interact();expect(store.getState().mode).toBe('walking')
})
it('keeps the session playable and reports a failed storage write',async()=>{
 const {useForestStore:store}=await import('./store')
 window.localStorage.setItem=()=>{throw Error('blocked')}
 store.setState({growthReady:true,position:{x:0,z:6.6},nearby:'grove'})
 store.getState().interact();for(let i=0;i<33;i++)store.getState().tickPlanting(.05)
 expect(store.getState().planted).toBe(true)
 expect(store.getState().message).toContain('无法保存')
 expect(memory.has(growthStorageKey)).toBe(false)
})
