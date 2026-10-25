import {afterEach,beforeEach,expect,it,vi} from 'vitest'
import {fishingSpot} from './fishing'
import {feedSpot} from './farm'
import {craftSpot} from './workshop'
import {guideStorageKey,hintStorageKey,noticeLifetime} from './uiStore'

let memory:Map<string,string>
beforeEach(()=>{vi.resetModules();memory=new Map();vi.stubGlobal('window',{location:{search:''},localStorage:{getItem:(k:string)=>memory.get(k)??null,setItem:(k:string,v:string)=>memory.set(k,v)}})})
afterEach(()=>vi.unstubAllGlobals())
const load=async()=>({forest:(await import('./store')).useForestStore,ui:(await import('./uiStore')).useUiStore,promptFor:(await import('./prompt')).promptFor})

it('offers F only where interact would act, otherwise a place hint, and transfers outrank everything',async()=>{
 const {forest:s,promptFor}=await load()
 s.setState({nearby:'pond',fishingReady:true,position:{x:fishingSpot.x+3,z:fishingSpot.z}})
 expect(promptFor(s.getState())).toEqual({hint:'走到池塘西岸的钓点'})
 s.setState({position:fishingSpot});expect(promptFor(s.getState())).toEqual({action:'抛竿钓鱼'})
 s.getState().interact();expect(s.getState().mode).toBe('fishing');expect(promptFor(s.getState())).toBeNull()
 s.setState({mode:'walking',fishing:null,nearby:'farm',farmReady:true,position:feedSpot,mealActive:false})
 expect(promptFor(s.getState())).toEqual({action:'添一份饲料'})
 s.setState({boatTransfer:{direction:'board',elapsed:0,committed:false}});expect(promptFor(s.getState())).toEqual({status:'正在上船…'})
 // Bedroom: no standing guidance away from the furniture.
 s.setState({boatTransfer:null,location:'bedroom',nearby:'bedroom',position:{x:0,z:0}});expect(promptFor(s.getState())).toBeNull()
 // Workshop materials are mentioned only while missing.
 s.setState({location:'workshop',nearby:'workshop',workshopReady:true,position:{x:2,z:0},workshopBook:{version:1,phase:'available'}})
 expect(promptFor(s.getState())?.hint).toContain('缺少旧木墩')
 s.setState({workshopBook:{version:1,phase:'carrying'},position:craftSpot});expect(promptFor(s.getState())).toEqual({action:'开始修整'})
})

it('fades ordinary feedback after four seconds and keeps errors until closed',async()=>{
 expect(noticeLifetime('info')).toBe(4000);expect(noticeLifetime('error')).toBeNull()
 const {forest:s}=await load()
 s.setState({nearby:'pond',fishingReady:true,position:{x:fishingSpot.x+3,z:fishingSpot.z}});s.getState().interact()
 expect(s.getState().messageKind).toBe('info')
 window.localStorage.setItem=()=>{throw Error('blocked')}
 s.setState({location:'island',position:{x:20,z:23},homeBook:{...s.getState().homeBook,fireLit:false}});s.getState().interact()
 expect(s.getState().messageKind).toBe('error');expect(s.getState().message).toContain('无法保存')
 // The next ordinary message is not stuck as an error.
 s.setState({nearby:'pond',position:{x:fishingSpot.x+3,z:fishingSpot.z}});s.getState().interact();expect(s.getState().messageKind).toBe('info')
})

it('keeps one panel at a time, holds gameplay while open and resumes without losing or skipping time',async()=>{
 const {forest:s,ui}=await load()
 s.setState({location:'bedroom',aquariumOpen:true});ui.getState().openPanel('help')
 expect(s.getState().aquariumOpen).toBe(false);expect(s.getState().menuPaused).toBe(true)
 ui.getState().openPanel('places');expect(ui.getState().panel).toBe('places')
 ui.getState().closePanel();expect(s.getState().menuPaused).toBe(false)
 // Fishing: a bite window cannot expire behind the help panel, and reeling is released.
 s.setState({location:'island',mode:'fishing',fishing:{phase:'reeling',elapsed:0,wait:3,sizeCm:20,progress:.4,tension:.3,held:true,paused:false,reason:''}})
 ui.getState().openPanel('help');expect(s.getState().fishing?.held).toBe(false)
 const held={...s.getState().fishing!};for(let i=0;i<200;i++)s.getState().tickFishing(.05)
 expect(s.getState().fishing).toEqual(held)
 ui.getState().closePanel();s.getState().tickFishing(.05);expect(s.getState().fishing?.elapsed).toBeCloseTo(.05,6);expect(s.getState().fishing?.held).toBe(false)
 // Planting and crafting timers neither reset nor jump.
 s.setState({mode:'planting',plantingElapsed:.4,fishing:null});ui.getState().openPanel('fishbook')
 for(let i=0;i<40;i++)s.getState().tickPlanting(.05);expect(s.getState().plantingElapsed).toBe(.4)
 ui.getState().closePanel();s.getState().tickPlanting(.05);expect(s.getState().plantingElapsed).toBeCloseTo(.45,6)
 s.setState({mode:'crafting',location:'workshop',craft:{elapsed:1,steps:1,stroke:0,feedback:''}});ui.getState().openPanel('help')
 for(let i=0;i<40;i++)s.getState().tickWorkshop(.05);expect(s.getState().craft?.elapsed).toBe(1)
 ui.getState().closePanel();s.getState().tickWorkshop(.05);expect(s.getState().craft?.elapsed).toBeCloseTo(1.05,6)
})

it('remembers the first-run guide and mode hints, and still works when storage is blocked',async()=>{
 const {ui}=await load()
 expect(ui.getState().guideSeen).toBe(false);ui.getState().finishGuide();ui.getState().enterMode('rowing');expect(ui.getState().activeHint).toBe('rowing');ui.getState().enterMode('walking');expect(ui.getState().activeHint).toBeNull();ui.getState().enterMode('rowing');expect(ui.getState().activeHint).toBeNull()
 expect(memory.get(guideStorageKey)).toBe('seen');expect(JSON.parse(memory.get(hintStorageKey)!)).toEqual(['rowing'])
 vi.resetModules();expect((await import('./uiStore')).useUiStore.getState()).toMatchObject({guideSeen:true,seenHints:['rowing'],activeHint:null})
 vi.resetModules();window.localStorage.getItem=()=>{throw Error('blocked')};window.localStorage.setItem=()=>{throw Error('blocked')}
 const blocked=(await import('./uiStore')).useUiStore
 expect(blocked.getState().guideSeen).toBe(false);blocked.getState().finishGuide();expect(blocked.getState().guideSeen).toBe(true)
})
