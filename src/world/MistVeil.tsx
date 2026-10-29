import {useEffect,useMemo,useRef} from 'react'
import {useFrame} from '@react-three/fiber'
import * as THREE from 'three'
import {daylightAt} from '../game/dayCycle'
import {useForestStore} from '../game/store'
import {climateNow,climateUniforms} from './climateUniforms'
import {dayLighting} from './dayLighting'
import {noiseGLSL} from './terrain'
import {mistHeight} from './mistIsland'

// Loose, overlapping wisps above the ridge; no sheets over the west landing or the sea lane.
const wisps=[[103,-22,7,1.8],[109,-24,8,2],[116,-23,7,1.8],[120,-19,6,1.5],[108,-17,7,1.7],[115,-17,6,1.8]] as const
/** Camera-facing, feathered mist cards, not physical volumetric scattering. Opaque trees
 * and rocks occlude each card; no box surface intersects the sloping ground.
 * The shared climate clock holds motion under the system's reduced-motion preference.
 * ponytail: cards approximate depth; add scene-depth blending only if visible intersections require it.
 */
export function MistVeil(){
 const material=useRef<THREE.ShaderMaterial>(null)
 const mesh=useRef<THREE.InstancedMesh>(null)
 const uniforms=useMemo(()=>({mistTime:{value:0},tint:{value:new THREE.Color()},density:{value:.16}}),[])
 useEffect(()=>{
  if(!mesh.current)return
  const matrix=new THREE.Matrix4(),q=new THREE.Quaternion()
  wisps.forEach(([x,z,width,height],i)=>mesh.current!.setMatrixAt(i,matrix.compose(new THREE.Vector3(x,mistHeight(x,z)+1.7,z),q,new THREE.Vector3(width,height,1))))
  mesh.current.instanceMatrix.needsUpdate=true
  // Vertex billboarding can extend beyond the unrotated instance boxes.
  mesh.current.boundingSphere=new THREE.Sphere(new THREE.Vector3(112,4,-21),18)
 },[])
 useFrame(()=>{
  if(!material.current)return
  const s=useForestStore.getState(),light=dayLighting(daylightAt(s),s.sunRising),u=material.current.uniforms
  u.tint.value.copy(light.haze).multiplyScalar(.85)
  u.density.value=.16+climateNow.rain*.025
  u.mistTime.value=climateUniforms.climateTime.value
 })
 return <instancedMesh ref={mesh} name="mist-ridge-veil" args={[undefined,undefined,wisps.length]}>
  <planeGeometry/>
  <shaderMaterial ref={material} uniforms={uniforms} transparent depthWrite={false} side={THREE.DoubleSide}
   vertexShader={/* glsl */`varying vec2 vUv;varying vec3 vCentre;varying float vDistance;
    void main(){
     vUv=uv;vec4 centre=modelMatrix*instanceMatrix*vec4(0.0,0.0,0.0,1.0);vCentre=centre.xyz;
     vec4 mv=viewMatrix*centre;vDistance=length(mv.xyz);
     mv.xy+=position.xy*vec2(length(instanceMatrix[0].xyz),length(instanceMatrix[1].xyz));
     gl_Position=projectionMatrix*mv;
    }`}
   fragmentShader={/* glsl */`
    varying vec2 vUv;varying vec3 vCentre;varying float vDistance;
    uniform float mistTime;uniform float density;uniform vec3 tint;
    ${noiseGLSL}
    void main(){
     vec2 q=(vUv-.5)*2.0;
     float edge=1.0-smoothstep(.05,1.0,dot(q,q));
     float drift=noise21(vUv*vec2(3.0,1.7)+vCentre.xz*.27+vec2(mistTime*.018,-mistTime*.009));
     float alpha=edge*edge*smoothstep(.18,.8,drift)*density*smoothstep(2.0,6.0,vDistance);
     gl_FragColor=vec4(tint,alpha);
     #include <tonemapping_fragment>
     #include <colorspace_fragment>
    }`}/>
 </instancedMesh>
}
