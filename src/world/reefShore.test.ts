import {expect,it} from 'vitest'
import {mistReefPieces,autumnReefPieces,tideReefPieces,reefShoreSolids,coastKits} from './coastalLayout'
import {mistIsland} from './mistIsland'
import {autumnIsland} from './autumnIsland'
import {tideIsland} from './tideIsland'
import {berths} from './worldConfig'
import {isNavigableSea,boatFits} from '../game/rowing'

const islands=[[mistIsland,mistReefPieces],[autumnIsland,autumnReefPieces],[tideIsland,tideReefPieces]] as const

it('rings each small island with a continuous reef, broken only at coves and landings',()=>{
 for(const [island,pieces] of islands){
  expect(pieces.length).toBeGreaterThan(40)
  // 10° sectors holding a stone: the old shore and rim rocks left most of the coastline bare
  const sectors=new Set(pieces.map(p=>Math.floor((Math.atan2(p.z-island.z,p.x-island.x)+Math.PI)/(Math.PI/18))))
  expect(sectors.size/36).toBeGreaterThan(.7)
  for(const p of pieces){expect(p.scale).toBeGreaterThanOrEqual(.7);expect(p.scale).toBeLessThanOrEqual(1.7)}
 }
})

it('makes the waterline stones solid for the boat and keeps every mooring free',()=>{
 expect(reefShoreSolids.length).toBeGreaterThan(60)
 for(const s of reefShoreSolids)expect(isNavigableSea(s.x,s.z)).toBe(false)
 for(const berth of Object.values(berths)){
  expect(boatFits(berth.mooring.x,berth.mooring.z,berth.mooring.heading)).toBe(true)
  for(const [,pieces] of islands)for(const p of pieces)expect(Math.hypot(p.x-berth.mooring.x,p.z-berth.mooring.z)).toBeGreaterThan(coastKits[p.kit].half*p.scale+8)
 }
})
