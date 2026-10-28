import {expect,it} from 'vitest'
import {climateLook,nightsPerSeason,seasonFor,weatherFor,weatherIds} from './weather'

it('seasons turn every four nights: spring, summer, autumn, then spring again',()=>{
 expect([0,3,4,7,8,11,12].map(seasonFor)).toEqual(['spring','spring','summer','summer','autumn','autumn','spring'])
 expect(nightsPerSeason).toBe(4)
})
it('each morning has one fixed weather, starting clear, with every kind turning up',()=>{
 expect(weatherFor(0)).toBe('clear')
 expect(weatherFor(5)).toBe(weatherFor(5))
 const days=Array.from({length:400},(_,i)=>weatherFor(i+1)),count=(w:string)=>days.filter(d=>d===w).length
 for(const w of weatherIds)expect(count(w)).toBeGreaterThan(20)
 expect(count('clear')).toBeGreaterThan(count('rain'))
})
it('rain wets and darkens; mist thickens the fog; autumn warms broadleaf crowns more than pines',()=>{
 const rain=climateLook('rain','summer'),mist=climateLook('mist','summer'),clear=climateLook('clear','summer')
 expect(rain.wet).toBe(1);expect(rain.rain).toBe(1);expect(rain.light).toBeLessThan(clear.light)
 expect(mist.fog).toBeLessThan(rain.fog);expect(mist.rain).toBe(0)
 const autumn=climateLook('clear','autumn')
 expect(autumn.broadleaf[0]/autumn.broadleaf[2]).toBeGreaterThan(autumn.pine[0]/autumn.pine[2])
 expect(autumn.leaves).toBeGreaterThan(0);expect(clear.leaves).toBe(0)
 expect(clear.broadleaf).toEqual([1,1,1])
})
it('spring flowers most, summer brings the fireflies, autumn lays leaves on the ground',()=>{
 const spring=climateLook('clear','spring'),summer=climateLook('clear','summer'),autumn=climateLook('clear','autumn')
 expect(spring.bloom).toBeGreaterThan(summer.bloom);expect(summer.bloom).toBe(1);expect(autumn.bloom).toBeLessThan(summer.bloom)
 expect(summer.fireflies).toBeGreaterThan(spring.fireflies);expect(summer.fireflies).toBeGreaterThan(autumn.fireflies)
 expect(autumn.litter).toBe(1);expect(spring.litter+summer.litter).toBe(0)
 expect(autumn.butterflies).toBeLessThan(spring.butterflies)
 expect(autumn.turn).toBeGreaterThan(.5);expect(spring.turn+summer.turn).toBe(0)
})

it('one morning does not decide the next: every change of weather happens, and runs stay short',()=>{
 const days=Array.from({length:2000},(_,i)=>weatherFor(i+1)),pairs=new Set<string>()
 let run=1,longest=1
 for(let i=1;i<days.length;i++){pairs.add(days[i-1]+'>'+days[i]);run=days[i]===days[i-1]?run+1:1;longest=Math.max(longest,run)}
 expect(pairs.size).toBe(weatherIds.length**2)
 expect(longest).toBeLessThan(15)
})
