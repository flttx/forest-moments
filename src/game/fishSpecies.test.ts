import {expect,it} from 'vitest'
import {bestLight,pickCatch,species,speciesIds,lightsFor} from './fishSpecies'
import {decodeCatchBook,recordCatch,emptyBook,beginFishing} from './fishing'
import {decodeHome} from './expansion'

const seq=(...v:number[])=>{let i=0;return()=>v[i++%v.length]}
it('picks only kinds that bite in this light, within their sizes',()=>{
 for(const light of ['day','dusk','night'] as const)for(let k=0;k<200;k++){
  const r=Math.random,c=pickCatch(light,r)
  expect(species[c.species].odds[light]).toBeGreaterThan(0)
  const [min,max]=species[c.species].size;expect(c.sizeCm).toBeGreaterThanOrEqual(min);expect(c.sizeCm).toBeLessThanOrEqual(max)
 }
 expect(pickCatch('day',seq(.999,.5)).species).not.toBe('glowfish')
 expect(lightsFor('glowfish')).toEqual(['night'])
 expect(bestLight('glowfish')).toEqual({light:'night',only:true})
 expect(bestLight('goldKoi')).toEqual({light:'dusk',only:false})
 // Hints differ between kinds, so the guide says something useful.
 expect(new Set(speciesIds.map(id=>bestLight(id).light)).size).toBeGreaterThan(1)
 // Odds: the last night roll falls to the glowfish.
 expect(pickCatch('night',seq(.999,.5)).species).toBe('glowfish')
 expect(speciesIds.every(id=>species[id].size[0]>=18&&species[id].size[1]<=36)).toBe(true)
})
it('casting in the dark can hook a glowfish; daylight never does',()=>{
 const kinds=new Set(Array.from({length:400},()=>beginFishing(Math.random,'night').species))
 expect(kinds.has('glowfish')).toBe(true)
 expect(Array.from({length:400},()=>beginFishing(Math.random,'day').species)).not.toContain('glowfish')
})
it('tallies kinds and reads an old koi-only book as koi',()=>{
 let b=recordCatch(emptyBook(),{sizeCm:20,at:'2026-10-27T01:00:00Z',species:'glowfish'})
 b=recordCatch(b,{sizeCm:28,at:'2026-10-27T02:00:00Z',species:'glowfish'})
 expect(b.kinds).toEqual({glowfish:{count:2,bestCm:28}});expect(b.count).toBe(2)
 expect(decodeCatchBook(JSON.stringify(b))).toEqual(b)
 const old={count:3,bestCm:31,recent:[{sizeCm:31,at:'2026-10-25T01:00:00Z'}]}
 expect(decodeCatchBook(JSON.stringify(old)).kinds).toEqual({koi:{count:3,bestCm:31}})
 expect(decodeCatchBook(JSON.stringify({...b,kinds:{shark:{count:1,bestCm:30}}})).count).toBe(0)
 expect(decodeCatchBook(JSON.stringify({...old,recent:[{sizeCm:31,at:'2026-10-25T01:00:00Z',species:'shark'}]})).count).toBe(0)
})
it('keeps the kind of a fish in the tank and rejects an unknown one',()=>{
 const home={version:1,fish:[{id:'a',sizeCm:22,at:'2026-10-27T01:00:00Z',species:'goldKoi'}],usedCatchIds:['a'],nights:0,fireLit:false}
 expect(decodeHome(JSON.stringify(home)).fish[0].species).toBe('goldKoi')
 expect(decodeHome(JSON.stringify({...home,fish:[{...home.fish[0],species:'shark'}]})).fish).toEqual([])
})

it('the jetty has its own kinds; the pond never yields sea fish and the sea never yields koi',async()=>{
 const {fishingSites}=await import('./fishing')
 const sea=new Set(Array.from({length:400},()=>pickCatch('day',Math.random,'sea').species))
 expect([...sea].sort()).toEqual(['mackerel','seaBass'])
 expect(Array.from({length:400},()=>pickCatch('night',Math.random,'sea').species).every(s=>s==='seaBass')).toBe(true)
 expect(Array.from({length:400},()=>pickCatch('day',Math.random,'pond').species).some(s=>s==='seaBass'||s==='mackerel')).toBe(false)
 // Sea hints compare within the sea.
 expect(bestLight('mackerel').light).toBe('day')
 // The jetty spot faces the water it casts into.
 const s=fishingSites.sea,ahead={x:-Math.sin(s.facing),z:-Math.cos(s.facing)}
 expect(Math.sign(s.float.z-s.stand.z)).toBe(Math.sign(ahead.z))
})
