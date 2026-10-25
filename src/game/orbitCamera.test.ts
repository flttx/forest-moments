import {expect,it} from 'vitest'
import {createOrbit,rotateOrbit,zoomOrbit,stepOrbit,cancelOrbit,orbitConfig,wrapAngle} from './orbitCamera'
import {walkingCamera,indoorCameraBoxes} from './followCamera'
import {PerspectiveCamera,Vector3} from 'three'
import {shorelineRadius,seaLevel} from '../world/worldConfig'

it('matches my-blog CSS pixel sensitivity and eases without a first-frame jump',()=>{
 const s=createOrbit(0);rotateOrbit(s,100,-100)
 expect(s.targetYaw).toBeCloseTo(.4);expect(s.targetPitch-s.pitch).toBeCloseTo(.3);expect(s.yaw).toBe(0)
 stepOrbit(s,1/60);expect(s.yaw).toBeGreaterThan(0);expect(s.yaw).toBeLessThan(.1)
 for(let i=0;i<180;i++)stepOrbit(s,1/60)
 expect(s.yaw).toBeCloseTo(.4,8)
 const yaw=s.yaw;for(let i=0;i<180;i++)stepOrbit(s,1/60)
 expect(s.yaw).toBeCloseTo(yaw,8)
})
it('clamps vertical orbit and zoom, and rejects invalid input',()=>{
 const s=createOrbit();rotateOrbit(s,0,-100000);zoomOrbit(s,1e6)
 for(let i=0;i<20;i++)zoomOrbit(s,300)
 stepOrbit(s,.05,true);expect(s.pitch).toBe(orbitConfig.maxPitch);expect(s.zoom).toBe(orbitConfig.maxZoom)
 rotateOrbit(s,0,100000);for(let i=0;i<20;i++)zoomOrbit(s,-300)
 stepOrbit(s,.05,true);expect(s.pitch).toBeCloseTo(orbitConfig.minPitch,12);expect(s.zoom).toBeCloseTo(orbitConfig.minZoom,12)
 const copy={...s};rotateOrbit(s,NaN,1);zoomOrbit(s,NaN);stepOrbit(s,NaN);expect(s).toEqual(copy)
})
it('cancels pending motion on blur and uses the short angle seam at all frame rates',()=>{
 const results=[]
 for(const hz of [30,60,144]){
  const s=createOrbit(Math.PI-.1);rotateOrbit(s,50,0)
  for(let i=0;i<hz;i++)stepOrbit(s,1/hz)
  expect(Math.abs(wrapAngle(s.yaw-(Math.PI+.1)))).toBeLessThan(.0001);results.push(s.yaw)
  rotateOrbit(s,100,100);zoomOrbit(s,100);cancelOrbit(s);const copy={...s};stepOrbit(s,.05)
  expect(s.yaw).toBe(copy.yaw);expect(s.pitch).toBe(copy.pitch);expect(s.zoom).toBe(copy.zoom)
 }
 expect(Math.max(...results)-Math.min(...results)).toBeLessThan(.00001)
})
it('only follows the boat heading after the manual orbit hold expires',()=>{
 const s=createOrbit(0);rotateOrbit(s,10,0)
 for(let i=0;i<60;i++)stepOrbit(s,1/60,false,Math.PI/2)
 expect(s.targetYaw).toBeCloseTo(.04)
 for(let i=0;i<300;i++)stepOrbit(s,1/60,false,Math.PI/2)
 expect(s.yaw).toBeGreaterThan(1.5)
})
it('keeps orbit extremes inside the room and outside wall volumes',()=>{
 for(const pitch of [orbitConfig.minPitch,orbitConfig.maxPitch])for(const zoom of [.55,1.6])for(let i=0;i<16;i++){
  const {eye}=walkingCamera({x:0,y:0,z:0},i*Math.PI/8,true,{pitch,zoom})
  expect(Math.abs(eye.x)).toBeLessThanOrEqual(3.72);expect(Math.abs(eye.z)).toBeLessThanOrEqual(2.72);expect(eye.y).toBeLessThanOrEqual(3.05)
  expect(indoorCameraBoxes.some(b=>eye.x>b.minX&&eye.x<b.maxX&&eye.y>b.minY&&eye.y<b.maxY&&eye.z>b.minZ&&eye.z<b.maxZ)).toBe(false)
 }
})

it('frames the complete coast from the island edge at maximum zoom and any orbit heading',()=>{
 const coast:Vector3[]=[];for(let a=0;a<Math.PI*2;a+=.1){const r=shorelineRadius(a);coast.push(new Vector3(Math.cos(a)*r,seaLevel,Math.sin(a)*r))}
 for(const position of [{x:0,y:0,z:0},{x:-15,y:7.3,z:-24.5},{x:42.6,y:.12,z:.8}])for(const pitch of [orbitConfig.minPitch,orbitConfig.maxPitch])for(let i=0;i<16;i++){
  const {eye,target}=walkingCamera(position,i*Math.PI/8,false,{pitch,zoom:orbitConfig.maxZoom})
  const camera=new PerspectiveCamera(46,4/3,.1,1000);camera.position.set(eye.x,eye.y,eye.z);camera.lookAt(target.x,target.y,target.z);camera.updateMatrixWorld()
  for(const point of coast){const p=point.clone().project(camera);expect(Math.abs(p.x)).toBeLessThan(.9);expect(Math.abs(p.y)).toBeLessThan(.9);expect(p.z).toBeLessThan(1)}
 }
})
it('keeps the previous close view and indoor zoom limit',()=>{
 const close=walkingCamera({x:3,y:0,z:5},0,false,{pitch:Math.atan2(5,9),zoom:1})
 expect(close.eye.x).toBe(3);expect(close.eye.y).toBeCloseTo(5.8);expect(close.eye.z).toBeCloseTo(14);expect(close.target).toEqual({x:3,y:.8,z:5})
 const s=createOrbit();for(let i=0;i<20;i++)zoomOrbit(s,300,orbitConfig.indoorMaxZoom)
 expect(s.targetZoom).toBe(1.6)
})
