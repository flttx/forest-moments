import {afterEach,expect,it} from 'vitest'
import {naturalWeather,rainbowFor,setForcedWeather,weatherFor} from './weather'
import {decodeWeather} from './weatherStore'

afterEach(()=>setForcedWeather(null))
it('follows the days until a weather is picked, then holds it for every day, and lets go again',()=>{
 const day=Array.from({length:60},(_,i)=>i+1).find(d=>naturalWeather(d)!=='rain')!
 expect(weatherFor(day)).toBe(naturalWeather(day))
 setForcedWeather('rain');expect(weatherFor(day)).toBe('rain');expect(weatherFor(0)).toBe('rain')
 setForcedWeather(null);expect(weatherFor(day)).toBe(naturalWeather(day))
})
it('keeps the rainbow tied to a real rainy yesterday, whatever sky is picked',()=>{
 const after=Array.from({length:200},(_,i)=>i+1).find(d=>naturalWeather(d-1)==='rain'&&['clear','cloudy'].includes(naturalWeather(d)))!
 const none=Array.from({length:200},(_,i)=>i+1).find(d=>naturalWeather(d-1)!=='rain')!
 expect(rainbowFor(after)).toBe(true)
 setForcedWeather('mist');expect(rainbowFor(after)).toBe(false);expect(rainbowFor(none)).toBe(false)
 setForcedWeather('clear');expect(rainbowFor(after)).toBe(true);expect(rainbowFor(none)).toBe(false)
})
it('reads a saved pick only when it is one of the four skies',()=>{
 expect(decodeWeather('mist')).toBe('mist')
 for(const bad of [null,'','snow','Rain','{"a":1}'])expect(decodeWeather(bad)).toBeNull()
})
