import {afterEach,beforeEach,expect,it,vi} from 'vitest'
import {fishingSpot} from './game/fishing'
import {langStorageKey} from './i18n'

let memory:Map<string,string>
beforeEach(()=>{vi.resetModules();memory=new Map();vi.stubGlobal('window',{location:{search:''},localStorage:{getItem:(k:string)=>memory.get(k)??null,setItem:(k:string,v:string)=>memory.set(k,v)}})})
afterEach(()=>vi.unstubAllGlobals())
const load=async()=>({i18n:await import('./i18n'),forest:(await import('./game/store')).useForestStore,ui:(await import('./game/uiStore')).useUiStore,promptFor:(await import('./game/prompt')).promptFor})

it('defaults to Chinese, fills parameters and switches every rendered prompt to English',async()=>{
 const {i18n,forest:s,promptFor}=await load()
 expect(i18n.useLang.getState().lang).toBe('zh')
 expect(i18n.t('status.fish',{n:3})).toBe('已钓到 3 尾')
 s.setState({nearby:'pond',fishingReady:true,position:fishingSpot})
 expect(promptFor(s.getState())).toEqual({action:'抛竿钓鱼'})
 i18n.useLang.getState().setLang('en')
 expect(promptFor(s.getState())).toEqual({action:'Cast a line'})
 expect(i18n.t('fishbook.summary',{count:2,best:31})).toBe('Koi · 2 caught · largest 31 cm')
 // Messages are written in the language active at the time.
 s.setState({position:{x:fishingSpot.x+3,z:fishingSpot.z}});s.getState().interact()
 expect(s.getState().message).toBe('Walk to the spot on the pond’s west bank, then press F to cast.')
 expect(memory.get(langStorageKey)).toBe('en')
})

it('remembers the language on this device and keeps working when storage is blocked',async()=>{
 memory.set(langStorageKey,'en')
 expect((await import('./i18n')).useLang.getState().lang).toBe('en')
 vi.resetModules();memory.set(langStorageKey,'fr')
 expect((await import('./i18n')).useLang.getState().lang).toBe('zh')
 vi.resetModules();window.localStorage.getItem=()=>{throw Error('blocked')};window.localStorage.setItem=()=>{throw Error('blocked')}
 const blocked=(await import('./i18n')).useLang
 expect(blocked.getState().lang).toBe('zh');blocked.getState().setLang('en');expect(blocked.getState().lang).toBe('en')
})

it('hides the HUD as a photo view: an open panel closes and play resumes, showing again leaves it closed',async()=>{
 const {forest:s,ui}=await load()
 ui.getState().openPanel('places');expect(s.getState().menuPaused).toBe(true)
 ui.getState().toggleHud()
 expect(ui.getState()).toMatchObject({hudHidden:true,panel:null});expect(s.getState().menuPaused).toBe(false)
 ui.getState().toggleHud();expect(ui.getState()).toMatchObject({hudHidden:false,panel:null})
})
