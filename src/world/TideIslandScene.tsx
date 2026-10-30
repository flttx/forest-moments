import {useEffect,useMemo} from 'react'
import * as THREE from 'three'
import {tideHeight,tideIsland,tidePools,tidePoolWaterY,tideGLSL} from './tideIsland'
import {noiseGLSL} from './terrain'
import {climateUniforms,climateGLSL} from './climateUniforms'

export function TideIsland(){
 const geometry=useMemo(()=>{
  const g=new THREE.PlaneGeometry(44,36,220,180);g.rotateX(-Math.PI/2);g.translate(tideIsland.x,0,tideIsland.z)
  const p=g.getAttribute('position')
  for(let i=0;i<p.count;i++)p.setY(i,tideHeight(p.getX(i),p.getZ(i)))
  g.computeVertexNormals();g.computeBoundingSphere();return g
 },[])
 useEffect(()=>()=>geometry.dispose(),[geometry])
 return <group><mesh name="tide-island-terrain" geometry={geometry} receiveShadow>
  <meshStandardMaterial roughness={.96} onBeforeCompile={shader=>{
   Object.assign(shader.uniforms,{climateWet:climateUniforms.climateWet})
   shader.vertexShader='varying vec3 vTide;varying vec3 vTideNormal;\n'+shader.vertexShader
   shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvTide=position;vTideNormal=normal;')
   shader.fragmentShader=`varying vec3 vTide;varying vec3 vTideNormal;${noiseGLSL}${tideGLSL}${climateGLSL}\n`+shader.fragmentShader
   shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',/* glsl */`
    #include <color_fragment>
    vec2 p=vTide.xz;float broad=noise21(p*.55),grain=noise21(p*24.0);
    vec3 stone=mix(vec3(.30,.285,.245),vec3(.44,.405,.33),broad)*(.91+grain*.17);
    float seam=smoothstep(.78,.98,sin(vTide.y*18.0+noise21(p*1.5)*2.0))*smoothstep(.35,.7,noise21(p*2.3));
    stone*=1.0-seam*.12;
    float path=1.0-smoothstep(.65,1.08,tidePath(p)+(noise21(p*3.0)-.5)*.22);
    vec3 colour=mix(stone,vec3(.48,.42,.30)*(.9+grain*.12),path*.65);
    float moss=(1.0-smoothstep(.67,.85,tideRadius(p)))*smoothstep(.58,.75,broad)*(1.0-path)*smoothstep(.35,.7,vTide.y);
    colour=mix(colour,vec3(.22,.27,.14),moss*.6);
    float wet=1.0-smoothstep(.12,.36,vTide.y);
    colour*=1.0-wet*.25-climateWet*.16;
    diffuseColor.rgb*=colour;
   `)
  }}/>
 </mesh>{tidePools.map((p,i)=><mesh key={i} name={`tide-pool-${i}`} rotation={[-Math.PI/2,0,0]} position={[p.x,tidePoolWaterY,p.z]} receiveShadow>
  <planeGeometry args={[p.rx*2.7,p.rz*2.7]}/>
  <meshPhysicalMaterial color="#4f938c" transparent opacity={.66} depthWrite={false} roughness={.24} metalness={0} specularIntensity={.35} customProgramCacheKey={()=>`tide-pool-${i}`} onBeforeCompile={shader=>{
   shader.vertexShader='varying vec3 vPool;\n'+shader.vertexShader
   shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvPool=(modelMatrix*vec4(position,1.0)).xyz;')
   shader.fragmentShader=`varying vec3 vPool;${noiseGLSL}${tideGLSL}\n`+shader.fragmentShader
   shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',/* glsl */`
    #include <color_fragment>
    float r=tidePool(vPool.xz,vec4(${p.x.toFixed(1)},${p.z.toFixed(1)},${p.rx.toFixed(2)},${p.rz.toFixed(2)}),${p.phase.toFixed(2)});
    if(r>1.18)discard;
    diffuseColor.a*=1.0-smoothstep(.90,1.18,r);
    diffuseColor.rgb*=.94+.08*noise21(vPool.xz*9.0);
   `)
  }}/>
 </mesh>)}</group>
}
