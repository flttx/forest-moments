import {expect,it} from 'vitest'
import {pickCatch,bestLight,species} from './fishSpecies'
import {spotsForDay,perDay,forageSpots} from './forage'
import {rainbowFor,rainMushrooms,weatherFor} from './weather'
import {drawPage,taskAvailable,taskStep} from './journal'

const dayWith=(test:(d:number)=>boolean)=>{for(let d=1;d<2000;d++)if(test(d))return d;throw new Error('no such day')}

it('the mistfish bites only on misty days, at any light, and only in the pond',()=>{
 for(const light of ['day','dusk','night'] as const){
  expect(Array.from({length:300},()=>pickCatch(light,Math.random,'pond','clear').species)).not.toContain('mistfish')
  expect(Array.from({length:300},()=>pickCatch(light,Math.random,'pond','mist').species)).toContain('mistfish')
  expect(Array.from({length:300},()=>pickCatch(light,Math.random,'sea','mist').species)).not.toContain('mistfish')
 }
 // Its weather-only odds leave the other kinds' field-guide hints alone.
 expect(bestLight('goldKoi')).toEqual({light:'dusk',only:false})
 expect(species.mistfish.weather).toBe('mist')
})

it('a rainbow follows a rainy day that clears, never on the first morning or in rain or mist',()=>{
 expect(rainbowFor(0)).toBe(false)
 const after=dayWith(d=>weatherFor(d-1)==='rain'&&weatherFor(d)==='clear')
 expect(rainbowFor(after)).toBe(true)
 expect(rainbowFor(dayWith(d=>weatherFor(d-1)==='rain'&&weatherFor(d)==='rain'))).toBe(false)
 expect(rainbowFor(dayWith(d=>weatherFor(d-1)==='rain'&&weatherFor(d)==='mist'))).toBe(false)
 expect(rainbowFor(dayWith(d=>weatherFor(d-1)!=='rain'&&weatherFor(d)==='clear'))).toBe(false)
 const days=Array.from({length:400},(_,i)=>rainbowFor(i+1)).filter(Boolean).length
 expect(days).toBeGreaterThan(10)
})

it('rain brings up more mushrooms; other finds keep their numbers',()=>{
 expect(forageSpots.filter(s=>s.kind==='mushroom').length).toBeGreaterThanOrEqual(rainMushrooms)
 const count=(d:number,k:string)=>spotsForDay(d).filter(s=>s.kind===k).length
 const wet=dayWith(d=>weatherFor(d)==='rain'),dry=dayWith(d=>weatherFor(d)==='clear')
 expect(count(wet,'mushroom')).toBe(rainMushrooms)
 expect(count(dry,'mushroom')).toBe(perDay.mushroom)
 expect(count(wet,'shell')).toBe(perDay.shell)
})

it('the rainbow photo task is only drawn while a rainbow is up, and a picture of one completes it',()=>{
 const bow=dayWith(rainbowFor),plain=dayWith(d=>!rainbowFor(d))
 expect(taskAvailable('shotRainbow',{homeBook:{fish:[],nights:bow}})).toBe(true)
 expect(taskAvailable('shotRainbow',{homeBook:{fish:[],nights:plain}})).toBe(false)
 for(let i=0;i<50;i++)expect(drawPage(1,{homeBook:{fish:[],nights:plain}} as never).tasks.map(t=>t.id)).not.toContain('shotRainbow')
 expect(taskStep('shotRainbow',{type:'photo',night:false,subjects:['rainbow']})).toBe(1)
 expect(taskStep('shotRainbow',{type:'photo',night:false,subjects:['cabin']})).toBe(0)
})
