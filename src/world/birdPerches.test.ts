import {expect,it} from 'vitest'
import {perchFor} from './birdPerches'
import {groundHeightAt} from '../game/movement'
import {vegetationPositions} from './vegetationLayout'
import islandTemplates from './island-tree-templates.json'

it('perches each robin in a real maple or birch crown round the clearing, not in thin air',()=>{
 // the three birds' directions, as ClearingBirds lays them out
 const perches=[0,1,2].map(i=>perchFor(i*2.2+.4+.3))
 for(const p of perches){
  const tree=vegetationPositions.filter(t=>t.kit==='ie-maple'||t.kit==='ie-birch').sort((a,b)=>Math.hypot(a.x-p.x,a.z-p.z)-Math.hypot(b.x-p.x,b.z-p.z))[0]
  const crown=islandTemplates[tree.kit as 'ie-maple'|'ie-birch'].crown,cy=groundHeightAt(tree.x,tree.z)+crown.y*tree.scale
  // inside that tree's crown and well up off the ground
  expect(Math.hypot(p.x-tree.x,p.y-cy,p.z-tree.z)).toBeLessThan(crown.r*tree.scale)
  expect(p.y-groundHeightAt(p.x,p.z)).toBeGreaterThan(1.5)
 }
 // three birds, three different perches
 for(let i=0;i<3;i++)for(let j=i+1;j<3;j++)expect(perches[i].distanceTo(perches[j])).toBeGreaterThan(1.5)
})
