import {beforeEach,afterEach,it,expect,vi} from 'vitest'
import {canViewLookout,lookoutEntry,initialLookoutView,turnLookout} from './lookout'
import {canStandAt} from './movement'
import {findNearestLandmark} from './landmarks'
import {transferOpacity} from './boatPresentation'

beforeEach(()=>{vi.resetModules();vi.stubGlobal('window',{localStorage:{getItem:()=>null,setItem:()=>{}}})})
afterEach(()=>vi.unstubAllGlobals())
it('places the entry on reachable land beside the tower, rejects its opposite side',()=>{
 expect(canStandAt(lookoutEntry.x,lookoutEntry.z)).toBe(true)
 expect(findNearestLandmark(lookoutEntry.x,lookoutEntry.z)).toBe('lookout')
 expect(canViewLookout(lookoutEntry)).toBe(true)
 expect(canViewLookout({x:13,z:-5.2})).toBe(false)
})
it('wraps a complete turn and clamps pitch without accepting non-finite input',()=>{
 const v=turnLookout(initialLookoutView,Math.PI*4,20)
 expect(v.yaw).toBeCloseTo(initialLookoutView.yaw);expect(v.pitch).toBe(.18)
 expect(turnLookout(v,0,-20).pitch).toBe(-.48)
 expect(turnLookout(v,NaN,0)).toBe(v)
 expect(turnLookout(v,0,0)).toBe(v)
})
it('requires loaded assets and entry reach, commits under opacity, locks repeated input and returns to the exact ground position',async()=>{
 const {useForestStore:s}=await import('./store')
 s.setState({nearby:'lookout',position:{...lookoutEntry}});s.getState().interact();expect(s.getState().lookoutTransfer).toBeNull()
 s.setState({lookoutReady:true,position:{x:13,z:-5.2}});s.getState().interact();expect(s.getState().lookoutTransfer).toBeNull()
 s.setState({position:{...lookoutEntry}});s.getState().interact()
 const initial=s.getState().lookoutTransfer;s.getState().interact();expect(s.getState().lookoutTransfer).toBe(initial)
 s.getState().turnLookout(1,1);expect(s.getState().lookoutView).toEqual(initialLookoutView)
 for(let i=0;i<9;i++)s.getState().tickLookoutTransfer(.05)
 expect(s.getState().mode).toBe('lookout');expect(transferOpacity(s.getState().lookoutTransfer!.elapsed)).toBe(1)
 s.getState().leaveLookout();expect(s.getState().lookoutTransfer!.direction).toBe('enter')
 for(let i=0;i<10;i++)s.getState().tickLookoutTransfer(.05)
 s.getState().turnLookout(1,-.1);expect(s.getState().lookoutView.yaw).not.toBe(initialLookoutView.yaw)
 s.getState().interact();for(let i=0;i<18;i++)s.getState().tickLookoutTransfer(.05)
 expect(s.getState().mode).toBe('walking');expect(s.getState().position).toEqual(lookoutEntry)
 expect(s.getState().lookoutTransfer).toBeNull()
})
it('invalid or negative delta cannot skip the transition and another interaction cannot start it',async()=>{
 const {useForestStore:s}=await import('./store')
 s.setState({nearby:'lookout',lookoutReady:true,position:lookoutEntry,mode:'feeding'});s.getState().interact();expect(s.getState().lookoutTransfer).toBeNull()
 s.setState({mode:'walking'});s.getState().interact()
 s.getState().tickLookoutTransfer(Infinity);s.getState().tickLookoutTransfer(-1)
 expect(s.getState().lookoutTransfer!.elapsed).toBe(0)
 s.getState().tickLookoutTransfer(100);expect(s.getState().mode).toBe('walking')
})
