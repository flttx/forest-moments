import * as THREE from 'three'
import {expect,it} from 'vitest'
import {frameBox,inPicture,subjectsIn,type Shot} from './photoSubjects'

function view(position:[number,number,number],target:[number,number,number]){
 const camera=new THREE.PerspectiveCamera(46,16/10,.1,600);camera.position.set(...position);camera.lookAt(...target);camera.updateMatrixWorld()
 return{camera:camera.position.clone(),viewProjection:new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse)}
}
const box=(cx:number,cy:number,cz:number,h:number)=>new THREE.Box3(new THREE.Vector3(cx-h,cy-h,cz-h),new THREE.Vector3(cx+h,cy+h,cz+h))
const shot=(over:Partial<Shot>={}):Shot=>({light:'day',mode:'walking',seat:null,fireLit:false,raccoonShown:true,raccoon:null,cabin:null,campfire:null,sun:new THREE.Vector3(1,.05,0).normalize(),fireflies:[],jellyfish:null,constellation:new THREE.Vector3(0,1,0),carving:null,heartStone:null,...view([0,1.5,0],[0,1.5,-10]),clear:()=>true,...over})

it('measures how much of a box is in the picture',()=>{
 const {viewProjection}=view([0,0,0],[0,0,-10])
 expect(frameBox(box(0,0,-10,1),viewProjection)).toMatchObject({inside:1})
 expect(frameBox(box(0,0,-10,1),viewProjection).area).toBeGreaterThan(.01)
 expect(frameBox(box(0,0,10,1),viewProjection)).toEqual({inside:0,area:0})
 // Half off the left edge.
 expect(frameBox(box(-6.5,0,-10,1.5),viewProjection).inside).toBeLessThan(1)
 expect(inPicture(new THREE.Vector3(0,0,-5),viewProjection)).toBe(true)
 expect(inPicture(new THREE.Vector3(0,0,5),viewProjection)).toBe(false)
})
it('sees the cabin only when it fills enough of the frame, whole and unhidden',()=>{
 const cabin=box(0,2,-14,3)
 expect(subjectsIn(shot({cabin}))).toEqual(['cabin'])
 expect(subjectsIn(shot({cabin,clear:()=>false}))).toEqual([])
 expect(subjectsIn(shot({cabin:box(0,2,-120,3)}))).toEqual([])
 expect(subjectsIn(shot({cabin:box(9,2,-14,3)}))).toEqual([])
})
it('sunsets need dusk and the sun in frame; on the boat it is also a boat sunset',()=>{
 const towardSun={sun:new THREE.Vector3(0,.05,-1).normalize()}
 expect(subjectsIn(shot({...towardSun,light:'dusk'}))).toEqual(['sunsetSea'])
 expect(subjectsIn(shot({...towardSun,light:'dusk',mode:'rowing'}))).toEqual(['sunsetSea','boatSunset'])
 expect(subjectsIn(shot({...towardSun,light:'day'}))).toEqual([])
 expect(subjectsIn(shot({light:'dusk',sun:new THREE.Vector3(0,.05,1)}))).toEqual([])
})
it('fireflies need the night and several of them close by in frame',()=>{
 const flies=[1,2,3,4,5].map(i=>new THREE.Vector3(i*.3-1,1.5,-4))
 expect(subjectsIn(shot({light:'night',fireflies:flies}))).toEqual(['fireflies'])
 expect(subjectsIn(shot({light:'night',fireflies:flies.slice(0,3)}))).toEqual([])
 expect(subjectsIn(shot({light:'dusk',fireflies:flies}))).toEqual([])
})
it('the raccoon by the fire needs it seated at camp, shown, with the lit fire in frame',()=>{
 const seated={mode:'sitting',seat:'camp-west',fireLit:true,raccoon:box(-1,.6,-6,.5),campfire:box(1,.3,-6,.5)}
 expect(subjectsIn(shot(seated))).toEqual(['fireside'])
 expect(subjectsIn(shot({...seated,raccoonShown:false}))).toEqual([])
 expect(subjectsIn(shot({...seated,fireLit:false}))).toEqual([])
 expect(subjectsIn(shot({...seated,seat:'coast'}))).toEqual([])
})

it('hidden corners: the carving up close in the middle of the picture, the heart stone only square on',()=>{
 const carving=new THREE.Vector3(0,1.5,-2.5)
 expect(subjectsIn(shot({carving}))).toEqual(['carving'])
 expect(subjectsIn(shot({carving:new THREE.Vector3(0,1.5,-6)}))).toEqual([])
 expect(subjectsIn(shot({carving,clear:()=>false}))).toEqual([])
 // Face normal along z: the default camera looks straight down -z at it.
 const stone={centre:new THREE.Vector3(0,.6,-5),normal:new THREE.Vector3(0,0,1)}
 expect(subjectsIn(shot({heartStone:stone}))).toEqual(['heartStone'])
 // The same stone seen edge on from the side.
 const side=view([5,1.5,-5],[0,.6,-5])
 expect(subjectsIn(shot({...side,heartStone:stone}))).toEqual([])
})
it('hidden corners: the jellyfish close by at night, and the constellation in a night sky',()=>{
 const jelly=new THREE.Vector3(.3,1.2,-6)
 expect(subjectsIn(shot({light:'night',jellyfish:jelly}))).toEqual(['jellyfish'])
 expect(subjectsIn(shot({light:'day',jellyfish:jelly}))).toEqual([])
 expect(subjectsIn(shot({light:'night',jellyfish:new THREE.Vector3(0,1.2,-30)}))).toEqual([])
 const up={...view([0,1.5,0],[0,12,-8]),constellation:new THREE.Vector3(0,.8,-.6).normalize()}
 expect(subjectsIn(shot({...up,light:'night'}))).toEqual(['constellation'])
 expect(subjectsIn(shot({...up,light:'dusk'}))).toEqual([])
})
