import {it,expect} from 'vitest'
import {Bone,BufferGeometry,Float32BufferAttribute,Group,MeshBasicMaterial,Skeleton,SkinnedMesh,Uint16BufferAttribute,Vector3} from 'three'
import {createBenchSeatContact} from './benchSeatContact'
import {seats,seatLift,seatSlide,type SeatSession} from '../game/expansion'
import {terrainHeight} from './terrain'

it('keeps hip contact above each rotated seat and restores the original mesh for other activities',()=>{
 for(const seat of seats){
  const root=new Group();root.position.set(seat.x,terrainHeight(seat.x,seat.z),seat.z);root.rotation.y=seat.yaw
  const geo=new BufferGeometry();geo.setAttribute('position',new Float32BufferAttribute([0,.25,-.1,0,.5,-.1,0,.25,-.6],3));geo.setAttribute('skinIndex',new Uint16BufferAttribute(Array(12).fill(0),4));geo.setAttribute('skinWeight',new Float32BufferAttribute([1,0,0,0,1,0,0,0,1,0,0,0],4))
  const mesh=new SkinnedMesh(geo,new MeshBasicMaterial()),bone=new Bone();bone.name='mixamorigHips';mesh.add(bone);mesh.bind(new Skeleton([bone]));root.add(mesh)
  const original=Array.from(geo.attributes.position.array),rig=createBenchSeatContact(root),session:SeatSession={id:seat.id,phase:'idle',elapsed:2,returnPosition:{x:0,z:0}}
  rig.update(session);root.updateMatrixWorld(true)
  expect(mesh.getVertexPosition(0,new Vector3()).applyMatrix4(mesh.matrixWorld).y).toBeCloseTo(root.position.y+.358,5)
  expect(mesh.geometry.attributes.position.getY(1)).toBeCloseTo(.5);expect(mesh.geometry.attributes.position.getY(2)).toBeCloseTo(.25)
  expect(Array.from(geo.attributes.position.array)).toEqual(original)
  rig.restore();rig.update({...session,id:'stool'});expect(Array.from(mesh.geometry.attributes.position.array)).toEqual(original)
  rig.dispose();geo.dispose();(mesh.material as MeshBasicMaterial).dispose()
 }
})

it('starts and ends the bench adjustment at ground level, with continuous phase boundaries and no stool change',()=>{
 const s:SeatSession={id:'camp-west',phase:'down',elapsed:0,returnPosition:{x:0,z:0}}
 for(const adjust of [seatLift,seatSlide]){
  expect(adjust(s)).toBe(0)
  expect(adjust({...s,elapsed:2.234})).toBe(adjust({...s,phase:'idle'}))
  expect(adjust({...s,phase:'up',elapsed:0})).toBe(adjust({...s,phase:'idle'}))
  expect(adjust({...s,phase:'up',elapsed:2.267})).toBe(0)
  expect(adjust({...s,id:'stool',phase:'idle'})).toBe(0)
 }
})
