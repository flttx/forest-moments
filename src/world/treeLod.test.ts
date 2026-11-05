import {expect,it} from 'vitest'
import islandTemplates from './island-tree-templates.json'

// Present files only; triangle counts and sizes are recorded by derive_tree_lods.py (evidence/2026-11-05-tree-lod).
const shipped=Object.keys(import.meta.glob('/public/assets/island-trees/*.glb'))

it('ships a distant LOD for every AHOLO tree kit',()=>{
 for(const kit of Object.keys(islandTemplates)){
  const file=kit.replace(/^ie-/,'')
  expect(shipped,file).toContain(`/public/assets/island-trees/${file}.glb`)
  expect(shipped,file).toContain(`/public/assets/island-trees/${file}-lod.glb`)
 }
})
