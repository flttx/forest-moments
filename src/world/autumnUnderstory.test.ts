import {expect,it} from 'vitest'
import {autumnFerns,fernReach} from './autumnUnderstoryLayout'
import {autumnEdgePlants,autumnPlants,canopySpheres} from './vegetationLayout'
import {autumnPaths,autumnPathDistance,autumnVista} from './autumnIsland'
import {autumnShorePieces,coastKits} from './coastalLayout'
import {canStandAt,standBlocker} from '../game/movement'
import coastBaseline from '../../docs/evidence/2026-10-30-autumn-coast/reviewed/report.json'

it('keeps the adopted autumn rocks exactly in place while shrubs have solids and camera coverage',()=>{
 expect(autumnShorePieces).toHaveLength(coastBaseline.autumnCoast.pieces.length)
 for(const [i,p] of autumnShorePieces.entries()){
  const old=coastBaseline.autumnCoast.pieces[i];expect(p.kit).toBe(old.kit)
  for(const key of ['x','y','z','yaw','scale'] as const)expect(p[key]).toBeCloseTo(old[key],10)
 }
 expect(autumnPlants).toHaveLength(15);expect(autumnEdgePlants.length).toBeGreaterThan(3)
 for(const p of autumnEdgePlants){
  expect(standBlocker(p.x,p.z)).toBe('plant:bush-a')
  expect(canopySpheres.some(c=>Math.hypot(c.x-p.x,c.z-p.z)<.01)).toBe(true)
  for(const rock of autumnShorePieces)expect(Math.hypot(p.x-rock.x,p.z-rock.z)).toBeGreaterThan(.92*p.scale+coastKits[rock.kit].half*rock.scale)
 }
})

it('keeps full fern fronds off paths, trees, shrubs and rocks, with an open vista',()=>{
 expect(autumnFerns.length).toBeGreaterThan(12)
 for(const p of autumnFerns){
  const reach=fernReach*p.scale
  expect(autumnPathDistance(p.x,p.z)-reach).toBeGreaterThan(1)
  expect(Math.hypot(p.x-autumnVista.x,p.z-autumnVista.z)).toBeGreaterThan(5)
  for(const tree of autumnPlants)expect(Math.hypot(p.x-tree.x,p.z-tree.z)).toBeGreaterThan(reach+1)
  for(const shrub of autumnEdgePlants)expect(Math.hypot(p.x-shrub.x,p.z-shrub.z)).toBeGreaterThan(reach+.75*shrub.scale)
  expect(canStandAt(p.x,p.z),JSON.stringify({...p,blocker:standBlocker(p.x,p.z)})).toBe(true) // Soft fronds add no invisible walking wall.
 }
 for(const [ax,az,bx,bz] of autumnPaths){
  if(ax<100||bx<100)continue // Narrow jetty approach remains covered by the travel test.
  const d=Math.hypot(bx-ax,bz-az)
  for(let t=0;t<=1;t+=.025)for(const side of [-.6,0,.6]){
   const x=ax+(bx-ax)*t-(bz-az)/d*side,z=az+(bz-az)*t+(bx-ax)/d*side
   expect(canStandAt(x,z),`trail ${x},${z}`).toBe(true)
  }
 }
})
