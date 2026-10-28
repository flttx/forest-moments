import {afterEach,beforeEach,expect,it,vi} from 'vitest'
import {tourDuration,tourFrame,tourStops} from './tour'

const from={eye:[0,5,10] as const,target:[0,0,0] as const}
it('flies from where the camera was through every stop in order, smoothly, and ends held on the last',()=>{
 expect(tourFrame(0,from).eye).toEqual([0,5,10])
 expect(tourDuration).toBeGreaterThan(60);expect(tourDuration).toBeLessThan(90)
 let previous=tourFrame(0,from),seen=new Set<number>()
 for(let t=.05;t<=tourDuration;t+=.05){
  const f=tourFrame(t,from);seen.add(f.stop)
  expect(f.stop).toBeGreaterThanOrEqual(previous.stop)
  // No jumps between frames: under 1.5 m per 50 ms (30 m/s) even at the peak of the longest flights.
  expect(Math.hypot(f.eye[0]-previous.eye[0],f.eye[1]-previous.eye[1],f.eye[2]-previous.eye[2])).toBeLessThan(1.5)
  previous=f
 }
 expect([...seen]).toEqual(tourStops.map((_,i)=>i))
 expect(tourFrame(tourDuration+1,from).done).toBe(true)
 expect(tourFrame(NaN,from).eye).toEqual([0,5,10])
 // Each hold is framed on its stop: looking at its target from its own eye.
 let at=0
 for(const s of tourStops){at+=s.fly;expect(tourFrame(at+.001,from).eye.map(v=>Math.round(v*10)/10)).toEqual(s.eye.map(v=>Math.round(v*10)/10));at+=s.hold}
})

let memory:Map<string,string>
beforeEach(()=>{vi.resetModules();memory=new Map();vi.stubGlobal('window',{location:{search:''},localStorage:{getItem:(k:string)=>memory.get(k)??null,setItem:(k:string,v:string)=>memory.set(k,v)}});vi.stubGlobal('document',{activeElement:null,documentElement:{}});vi.stubGlobal('HTMLElement',class{})})
afterEach(()=>vi.unstubAllGlobals())

it('holds the game, turns to dusk for the tower, and puts the light back on leaving; saves nothing',async()=>{
 const {useForestStore:s}=await import('./store'),{useTourStore:tour}=await import('./tourStore')
 s.setState({timeOfDay:'night',location:'island',mode:'walking'})
 const saved=new Map(memory)
 tour.getState().start()
 expect(tour.getState().active).toBe(true);expect(s.getState().menuPaused).toBe(true)
 for(let t=0;t<tourDuration-tourStops.at(-1)!.fly-tourStops.at(-1)!.hold-.2;t+=.1)tour.getState().tick(.1)
 expect(s.getState().timeOfDay).toBe('night')
 tour.getState().tick(.1);tour.getState().tick(.1);tour.getState().tick(.1)
 expect(s.getState().timeOfDay).toBe('dusk')
 for(let t=0;t<30;t+=.1)tour.getState().tick(.1)
 expect(tour.getState().active).toBe(false)
 expect(s.getState()).toMatchObject({timeOfDay:'night',menuPaused:false})
 expect(memory).toEqual(saved)
})

it('starts only outdoors from free play, and an early stop restores everything',async()=>{
 const {useForestStore:s}=await import('./store'),{useTourStore:tour}=await import('./tourStore')
 s.setState({location:'workshop'});tour.getState().start();expect(tour.getState().active).toBe(false)
 s.setState({location:'island',mode:'fishing'});tour.getState().start();expect(tour.getState().active).toBe(false)
 s.setState({mode:'walking',timeOfDay:'day'});tour.getState().start();tour.getState().tick(1)
 tour.getState().stop()
 expect(tour.getState()).toMatchObject({active:false,elapsed:0,returnFocus:true});expect(s.getState().menuPaused).toBe(false)
})
