import {expect,it} from 'vitest'
import {defaultAudio,busLevel,mixFor,parseAudioSettings,seaNearness,fireNearness,stepLength} from './audioMix'
import {islandShape} from '../world/worldConfig'

it('round-trips, clamps and falls back on audio settings',()=>{
 const custom={...defaultAudio,muted:true,music:.2}
 expect(parseAudioSettings(JSON.stringify(custom))).toEqual(custom)
 expect(parseAudioSettings('{bad')).toEqual(defaultAudio)
 expect(parseAudioSettings(JSON.stringify({version:1,master:3,effects:-1,music:'x'}))).toEqual({...defaultAudio,master:1,effects:0})
 expect(busLevel(custom,'music')).toBe(0)
 expect(busLevel(defaultAudio,'music')).toBeCloseTo(defaultAudio.master*defaultAudio.music,9)
})
it('mixes birds by day, crickets by night, the sea near the shore and a lit fire; walls muffle the outdoors',()=>{
 const day=mixFor({night:0,indoors:false,sea:0,fire:0})
 expect([day.birds,day.crickets,day.musicDay,day.musicNight]).toEqual([1,0,1,0])
 const night=mixFor({night:1,indoors:false,sea:1,fire:1})
 expect([night.crickets,night.musicNight,night.sea,night.fire]).toEqual([1,1,1,1])
 const inside=mixFor({night:0,indoors:true,sea:1,fire:1})
 expect(inside.room).toBe(1);expect(inside.sea).toBeLessThan(.2);expect(inside.fire).toBe(0);expect(inside.ambienceCutoff).toBeLessThan(2000)
})
it('grows the sea toward the coast, the fire near the camp, and lengthens strides with speed',()=>{
 expect(seaNearness(0,0,false)).toBe(0);expect(seaNearness(0,0,true)).toBe(1)
 expect(seaNearness(islandShape.coastRadius,0,false)).toBeGreaterThan(.9)
 expect(fireNearness(1,0,true)).toBe(1);expect(fireNearness(1,0,false)).toBe(0);expect(fireNearness(12,0,true)).toBe(0)
 expect(stepLength(1.1)).toBe(.42);expect(stepLength(3.08)).toBeGreaterThan(.8)
})
