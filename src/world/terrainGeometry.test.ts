import {expect,it} from 'vitest'
import {Mesh,MeshBasicMaterial,Raycaster,Vector3} from 'three'
import {createTerrainGeometry} from './terrainGeometry'
import {pondRadiusAt,pondWaterInset} from './pondShape'
import {pond} from './worldConfig'
import {sandRect} from '../game/sand'

it('resolves the actual mesh waterline within 5 mm without refining the whole island',()=>{
  const geometry=createTerrainGeometry(),material=new MeshBasicMaterial(),mesh=new Mesh(geometry,material)
  const ray=new Raycaster(),down=new Vector3(0,-1,0)
  for(let a=0;a<Math.PI*2;a+=Math.PI/16){
    const r=pondRadiusAt(a)-pondWaterInset
    ray.set(new Vector3(pond.x+Math.cos(a)*r,2,pond.z+Math.sin(a)*r),down)
    const hit=ray.intersectObject(mesh)[0]
    expect(hit).toBeDefined()
    expect(Math.abs(hit.point.y-pond.waterY)).toBeLessThan(.005)
  }
  // The island plus the pond, and the south beach's play sand on top: 10 cm cells over 28.2 x 16.2 m add about 81k triangles.
  const beachCells=Math.ceil((sandRect.maxX-sandRect.minX)/.3)*Math.ceil((sandRect.maxZ-sandRect.minZ)/.3)
  expect(geometry.index!.count/3).toBeLessThan(270000+beachCells*(9-1)*2)
  geometry.dispose();material.dispose()
})
