import {useEffect,useMemo,useRef} from 'react'
import {useFrame,useThree} from '@react-three/fiber'
import * as THREE from 'three'
import {Reflector} from 'three/addons/objects/Reflector.js'
import {useForestStore} from '../game/store'
import {usePhotoStore} from '../game/photoStore'
import {groundHeightAt} from '../game/movement'
import {climateUniforms,puddleReflection} from './climateUniforms'

// Small, numerous things the mirror can do without: they cost the most to draw and barely show in a puddle.
const skipped=/^(grass-|GroundCover$|rain$|rain-splashes$|falling-leaves$|ambient-life$|fireflies$)/

/**
 * A horizontal reflector whose own plane draws nothing: it only renders the mirror view into its texture before the
 * scene. The view skips the small clutter, is drawn once per frame even when other passes render the scene again, and
 * never feeds its own texture back into the terrain while drawing it.
 */
function createPuddleReflector(width:number,height:number){
 const r=new Reflector(new THREE.PlaneGeometry(90,90),{textureWidth:width,textureHeight:height,clipBias:.003,multisample:0})
 r.rotation.x=-Math.PI/2;r.name='puddle-reflector';r.frustumCulled=false
 const m=r.material as THREE.ShaderMaterial;m.colorWrite=false;m.depthWrite=false
 const draw=r.onBeforeRender.bind(r),hidden:THREE.Object3D[]=[],toPlane=new THREE.Matrix4()
 const textureMatrix=(m.uniforms.textureMatrix as THREE.IUniform<THREE.Matrix4>).value
 // The frame loop sets `due` once per frame; ambient occlusion and depth of field render the scene again after.
 r.userData.due=false
 r.onBeforeRender=(renderer,scene,camera,...rest)=>{
  // A pass drawing the scene with one override material (normals, depth) must not become the mirror view.
  if(!r.userData.due||scene.overrideMaterial)return
  r.userData.due=false
  scene.traverse(o=>{if(o.visible&&skipped.test(o.name)){o.visible=false;hidden.push(o)}})
  puddleReflection.puddleMap.value=puddleReflection.blank
  draw(renderer,scene,camera,...rest)
  puddleReflection.puddleMap.value=r.getRenderTarget().texture
  // The reflector's matrix maps its own plane's local points; the terrain passes world points.
  puddleReflection.puddleMatrix.value.copy(textureMatrix).multiply(toPlane.copy(r.matrixWorld).invert())
  for(const o of hidden)o.visible=true
  hidden.length=0
 }
 return r
}

/**
 * Real reflections in rain puddles: a mirror view about the ground under the raccoon at half resolution, which the
 * terrain samples where puddles lie (`puddleReflection`). Only on wet days outdoors, never on the low quality tier.
 */
export function PuddleReflection(){
 const size=useThree(s=>s.size),gl=useThree(s=>s.gl),low=usePhotoStore(s=>s.lowQuality)
 const reflector=useMemo(()=>{const ratio=gl.getPixelRatio()*.5;return createPuddleReflector(Math.round(size.width*ratio),Math.round(size.height*ratio))},[gl,size.width,size.height])
 // The frame loop works on a ref to the built reflector (as Climate does), not on the memoised value.
 const live=useRef(reflector)
 useEffect(()=>{live.current=reflector;return ()=>{puddleReflection.puddleOn.value=0;puddleReflection.puddleMap.value=puddleReflection.blank;reflector.dispose()}},[reflector])
 useFrame(()=>{
  const r=live.current,s=useForestStore.getState(),on=!low&&s.location==='island'&&climateUniforms.climateWet.value>.2
  r.visible=on;r.userData.due=on;puddleReflection.puddleOn.value=on?1:0
  if(on){const y=groundHeightAt(s.position.x,s.position.z);r.position.set(s.position.x,y,s.position.z);puddleReflection.puddleHeight.value=y}
 })
 return <primitive object={reflector}/>
}
