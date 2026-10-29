import {useEffect,useMemo} from 'react'
import {useGLTF} from '@react-three/drei'
import * as THREE from 'three'
import {westBoardwalk as deck,westWetland as pool,westWetlandRadius,onWestBoardwalk,westTrailDistance} from './westExpansion'
import {terrainHeight,noiseGLSL} from './terrain'
import {climateUniforms,rainRingsGLSL} from './climateUniforms'

/** Five authored 2.4 m modules share the existing continuous walking plane. */
export function WestWetland(){
 const kit=useGLTF('/assets/expansion/wetland-kit.glb'),coast=useGLTF('/assets/expansion/coastal-kit.glb')
 const props=useMemo(()=>{
  const root=new THREE.Group(),matrix=new THREE.Object3D()
  const instance=(source:THREE.Object3D|undefined,placements:number[][])=>{
   if(!(source instanceof THREE.Mesh))throw new Error('Wetland asset module is missing')
   const mesh=new THREE.InstancedMesh(source.geometry,source.material,placements.length)
   placements.forEach(([x,y,z,yaw,scale],i)=>{matrix.position.set(x,y,z);matrix.rotation.set(0,yaw,0);matrix.scale.setScalar(scale);matrix.updateMatrix();mesh.setMatrixAt(i,matrix.matrix)})
   mesh.name=source.name;mesh.castShadow=true;mesh.receiveShadow=true;mesh.computeBoundingSphere();root.add(mesh)
  }
  const boards=Array.from({length:5},(_,i)=>[deck.minX+1.2+i*2.4,deck.y,deck.z,0,1])
  instance(kit.scene.getObjectByName('Boardwalk_240'),boards)
  const reeds:number[][]=[],stones:number[][]=[]
  for(let i=0;i<58;i++){
   const angle=i*2.399963,r=1.01+(i%5)*.045
   const x=pool.x+Math.cos(angle)*pool.rx*r,z=pool.z+Math.sin(angle)*pool.rz*r
   if(onWestBoardwalk(x,z,-.55)||westTrailDistance(x,z)<1.5)continue
   const edge=westWetlandRadius(x,z),y=terrainHeight(x,z)
   if(edge<.92||edge>1.34)continue
   if(i%4===0)stones.push([x,y-.055,z,angle,.22+(i%3)*.035])
   else reeds.push([x,y-.05,z,angle,.55+(i%4)*.13])
  }
  instance(kit.scene.getObjectByName('Rush_Clump'),reeds)
  instance(coast.scene.getObjectByName('Rock_Cobbles'),stones)
  root.userData.qa={modules:boards.length,reeds:reeds.length,cobbleClusters:stones.length,deckTop:deck.y,clearWidth:deck.halfWidth*2,decimated:false}
  return root
 },[kit.scene,coast.scene])
 const water=useMemo(()=>{
  const g=new THREE.PlaneGeometry(12,9,80,60);g.rotateX(-Math.PI/2);g.translate(pool.x,pool.waterY,pool.z)
  const positions=g.getAttribute('position'),depth=new Float32Array(positions.count)
  for(let i=0;i<positions.count;i++){
   const x=positions.getX(i),z=positions.getZ(i)
   // Coastal ground also lies below this freshwater level; only the basin may receive water.
   depth[i]=westWetlandRadius(x,z)<1.25?pool.waterY-terrainHeight(x,z):-1
  }
  g.setAttribute('waterDepth',new THREE.BufferAttribute(depth,1))
  return g
 },[])
 useEffect(()=>()=>{water.dispose();props.traverse(o=>{if(o instanceof THREE.InstancedMesh)o.dispose()})},[water,props])
 return <group name="west-wetland">
  <primitive object={props} dispose={null}/>
  <mesh name="wetland-water" geometry={water} receiveShadow renderOrder={1}>
   <meshPhysicalMaterial color="#355d53" roughness={.32} metalness={0} specularIntensity={.35} envMapIntensity={.6} transparent depthWrite={false}
    onBeforeCompile={shader=>{
     Object.assign(shader.uniforms,{climateTime:climateUniforms.climateTime,climateRain:climateUniforms.climateRain})
     shader.vertexShader='attribute float waterDepth;varying float vDepth;varying vec3 vMarsh;\n'+shader.vertexShader
     shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvDepth=waterDepth;vMarsh=position;')
     shader.fragmentShader=`varying float vDepth;varying vec3 vMarsh;uniform float climateTime;\n${noiseGLSL}\n${rainRingsGLSL}\n`+shader.fragmentShader
     shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',/* glsl */`
      #include <color_fragment>
      if(vDepth<=.004)discard;
      vec2 p=vMarsh.xz;
      float shallow=1.0-smoothstep(.02,.29,vDepth);
      diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.21,.24,.115),shallow*.65);
      diffuseColor.rgb*=.94+.06*noise21(p*2.2);
      diffuseColor.a=smoothstep(.004,.075,vDepth)*.91;
      if(climateRain>.01)diffuseColor.rgb+=rainRings(p,climateTime).x*climateRain*vec3(.16,.18,.16);
     `)
     shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',/* glsl */`
      #include <normal_fragment_maps>
      vec2 q=vMarsh.xz*.9+climateTime*vec2(.055,-.035);
      float h=noise21(q);
      vec2 slope=vec2(noise21(q+vec2(.07,0.0))-h,noise21(q+vec2(0.0,.07))-h)*.55;
      if(climateRain>.01)slope+=rainRings(vMarsh.xz,climateTime).yz*climateRain*.16;
      normal=normalize((viewMatrix*vec4(-slope.x,1.0,-slope.y,0.0)).xyz);
     `)
    }}/>
  </mesh>
 </group>
}
