import {shorelineRadius,landformHeight} from './worldConfig'
import {creekDistance} from '../game/expansion'
import {workshopDoor} from '../game/workshop'
import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { canStandAt, moveOnGround, groundHeightAt } from '../game/movement'
import { islandShape, loopRadius, terrainHeight, seaLevel, pathDistance, workshopPathZ } from './terrain'
import { vegetationPositions, lampPositions, instanceCircles, clearForVegetation } from './vegetationLayout'
import { maskedCentroid, nearestAnchors } from './lampAnchors'
import { transformedGeometry } from './transformedGeometry'

describe('expanded island and migrated vegetation',()=>{
  it('opens the lowland walking loop and places the elevated coastline at sea level',()=>{
    expect(islandShape.walkRadius).toBe(35)
    for(let a=0;a<Math.PI*2;a+=.012) {
      const r=loopRadius(a),x=Math.cos(a)*r,z=Math.sin(a)*r
      if(z< -7||creekDistance(x,z)<3)continue
      expect(canStandAt(x,z),`blocked loop ${x},${z}`).toBe(true)
      expect(pathDistance(x,z)).toBeLessThan(.000001)
      expect(Math.abs(terrainHeight(x,z)-landformHeight(x,z))).toBeLessThan(.126)
      expect(groundHeightAt(x,z)).toBe(terrainHeight(x,z))
      const next=a+.012,nr=loopRadius(next),nx=Math.cos(next)*nr,nz=Math.sin(next)*nr
      const end=moveOnGround({x,z},nx-x,nz-z)
      expect(Math.hypot(end.x-nx,end.z-nz)).toBeLessThan(.001)
      const water=shorelineRadius(a)
      expect(landformHeight(Math.cos(a)*water,Math.sin(a)*water)).toBeCloseTo(seaLevel,7)
    }
    expect(canStandAt(-44,0)).toBe(false)
    expect(canStandAt(35.1,0)).toBe(true) // New beach / dock approach.
  })
  it('keeps source-derived trunks and posts out of the circulation and gameplay zones',()=>{
    const trees=vegetationPositions.filter(p=>p.kit!=='bush-a')
    console.log('Layout:',trees.length,'trees;',vegetationPositions.length-trees.length,'bushes;',lampPositions.length,'lamps')
    expect(trees.length).toBeGreaterThanOrEqual(60)
    expect(lampPositions.length).toBeLessThanOrEqual(12)
    for(const p of vegetationPositions)expect(clearForVegetation(p.x,p.z)).toBe(true)
    for(const p of lampPositions)for(const c of instanceCircles(p))expect(pathDistance(c.x,c.z)-c.r).toBeGreaterThan(1.2)
    for(let x=-1.5;x> -12;x-=.1)expect(canStandAt(x,workshopPathZ(x)),`workshop path ${x},${workshopPathZ(x)}`).toBe(true)
    for(let x=0;x<23;x+=.1)expect(canStandAt(x,1.4),`beach approach ${x}`).toBe(true)
    for(let z=1.4;z> -4.7;z-=.1)expect(canStandAt(13,z)).toBe(true)
    for(const p of [...vegetationPositions,...lampPositions]) {
      expect(Number.isFinite(terrainHeight(p.x,p.z))).toBe(true)
      for(const c of instanceCircles(p))expect(canStandAt(c.x,c.z)).toBe(false)
    }
    for(const [x,z] of [[0,0],[0,8],[1.5,-5],[30.6,.8],[workshopDoor.x,workshopDoor.z],[13,-4.7]])expect(canStandAt(x,z)).toBe(true)
  })
  it('uses the mask UV orientation and deterministic nearest anchors for a capped light pool',()=>{
    expect(maskedCentroid([1,2,3,4,5,6],[0,.1,.8,.9],{width:1,height:2,data:[255,0,0,255,0,0,0,255]})).toEqual([1,2,3])
    const out:number[]=[]
    expect(nearestAnchors([1,2,0,4,2,0,2,2,0,8,2,0,3,2,0,20,2,0],0,0,5,10,out)).toBe(5)
    expect(out).toEqual([0,2,4,1,3])
    nearestAnchors([],0,0,4,10,out);expect(out).toEqual([])
  })
  it('restores metre-space positions without overflowing quantised integer attributes',()=>{
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(new Int16Array([0,-32767,0,0,32767,0]),3,true))
    const transformed=transformedGeometry(g,new THREE.Matrix4().compose(new THREE.Vector3(0,3,0),new THREE.Quaternion(),new THREE.Vector3(3,3,3)))
    expect(transformed.getAttribute('position').getY(0)).toBe(0)
    expect(transformed.getAttribute('position').getY(1)).toBe(6)
    expect(g.getAttribute('position').getY(1)).toBe(1)
    transformed.dispose();g.dispose()
  })
})
