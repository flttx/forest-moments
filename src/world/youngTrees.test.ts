import {expect,it} from 'vitest'
import {westPlants,autumnPlants,autumnFringe,canopySpheres} from './vegetationLayout'
import {standBlocker} from '../game/movement'
import {clearing} from './birdPerches'
import {forageSpots} from '../game/forage'
import islandTemplates from './island-tree-templates.json'

const young=['ie-young-pine','ie-young-birch','ie-young-maple','ie-spruce-sapling'] as const

it('grows the western companions as young trees instead of shrinking adult spruces',()=>{
 expect(westPlants.some(p=>p.kit==='ie-spruce'&&p.scale<.6)).toBe(false)
 const pines=westPlants.filter(p=>p.kit==='ie-young-pine'),saplings=westPlants.filter(p=>p.kit==='ie-spruce-sapling')
 expect(pines.length).toBeGreaterThan(0);expect(saplings.length).toBeGreaterThan(0)
 // companions keep the old fixed offset beside a grid tree; the young pines go beside spruces
 for(const p of [...pines,...saplings])expect(westPlants.some(o=>(o.kit==='ie-spruce'||o.kit==='ie-old-pine')&&Math.hypot(p.x-1.4-o.x,p.z-1.3-o.z)<.01)).toBe(true)
 for(const p of pines)expect(westPlants.some(o=>o.kit==='ie-spruce'&&Math.hypot(p.x-1.4-o.x,p.z-1.3-o.z)<.01)).toBe(true)
})

it('keeps young broadleaves away from the bird clearing and leaves adult broadleaves in place',()=>{
 const autumn=[...autumnPlants,...autumnFringe],grown=autumn.filter(p=>p.kit==='ie-young-birch'||p.kit==='ie-young-maple')
 expect(grown.length).toBeGreaterThan(0)
 for(const p of grown)expect(Math.hypot(p.x-clearing.x,p.z-clearing.z)).toBeGreaterThan(11)
 for(const kit of ['ie-birch','ie-maple'])expect(autumnPlants.some(p=>p.kit===kit)).toBe(true)
 // fallen leaves still gather under every maple, young or adult (seven spots before the young forms)
 expect(forageSpots.filter(s=>s.kind==='mapleLeaf').length).toBe(7)
})

it('gives every young tree a trunk solid and a camera crown',()=>{
 // saplings beside an old pine stand on its root flare (the shrunk spruces before them did too), so its solid wins there
 for(const p of [...westPlants,...autumnPlants,...autumnFringe].filter(p=>(young as readonly string[]).includes(p.kit)&&standBlocker(p.x,p.z)!=='plant:ie-old-pine')){
  expect(standBlocker(p.x,p.z)).toBe(`plant:${p.kit}`)
  expect(canopySpheres.some(c=>Math.hypot(c.x-p.x,c.z-p.z)<.01)).toBe(true)
 }
})

it('derives young forms that are slimmer for their height than the adult they come from',()=>{
 const ratio=(kit:keyof typeof islandTemplates)=>islandTemplates[kit].colliders[0][2]/(islandTemplates[kit].frame.half*2)
 const crown=(kit:keyof typeof islandTemplates)=>islandTemplates[kit].crown.r/(islandTemplates[kit].frame.half*2)
 for(const [kid,adult] of [['ie-young-pine','ie-old-pine'],['ie-young-birch','ie-birch'],['ie-young-maple','ie-maple']] as const){
  expect(islandTemplates[kid].frame.half).toBeLessThan(islandTemplates[adult].frame.half)
  expect(ratio(kid)).toBeLessThan(ratio(adult))
  expect(crown(kid)).toBeLessThan(crown(adult))
 }
})
