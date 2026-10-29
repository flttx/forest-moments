import {useEffect,useMemo} from 'react'
import * as THREE from 'three'
import {mistIsland,mistHeight,mistGLSL} from './mistIsland'
import {noiseGLSL} from './terrain'
import {climateUniforms,climateGLSL} from './climateUniforms'
import {MistFerns} from './MistFerns'
import {MistVeil} from './MistVeil'
import {MistLogs} from './MistLogs'

/** Separate terrain chunk: no giant empty grid between islands. */
export function MistIsland(){
 const geometry=useMemo(()=>{
  const g=new THREE.PlaneGeometry(54,50,180,166);g.rotateX(-Math.PI/2);g.translate(mistIsland.x,0,mistIsland.z)
  const p=g.getAttribute('position')
  for(let i=0;i<p.count;i++)p.setY(i,mistHeight(p.getX(i),p.getZ(i)))
  g.computeVertexNormals();g.computeBoundingSphere();return g
 },[])
 useEffect(()=>()=>geometry.dispose(),[geometry])
 return <group><MistFerns/><MistLogs/><MistVeil/><mesh name="mist-island-terrain" geometry={geometry} receiveShadow>
  <meshStandardMaterial roughness={.94} onBeforeCompile={shader=>{
   Object.assign(shader.uniforms,{climateGrass:climateUniforms.climateGrass,climateWet:climateUniforms.climateWet})
   shader.vertexShader='varying vec3 vMist;varying vec3 vMistNormal;\n'+shader.vertexShader
   shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvMist=position;vMistNormal=normal;')
   shader.fragmentShader=`varying vec3 vMist;varying vec3 vMistNormal;${noiseGLSL}${mistGLSL}${climateGLSL}\n`+shader.fragmentShader
   shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',/* glsl */`
    #include <color_fragment>
    vec2 p=vMist.xz;float broad=noise21(p*.5),fleck=noise21(p*25.0);
    vec3 grass=mix(vec3(.19,.25,.11),vec3(.27,.33,.15),broad)*climateGrass;
    float path=1.0-smoothstep(.72,1.04,mistPath(p)+(noise21(p*4.0)-.5)*.18);
    vec3 earth=mix(vec3(.20,.14,.085),vec3(.32,.25,.15),broad)*(.85+fleck*.25);
    vec3 colour=mix(grass,earth,path);
    float sand=smoothstep(.81,1.02,mistRadius(p)+(noise21(p*.9)-.5)*.055)*(1.0-smoothstep(.4,1.7,vMist.y));
    colour=mix(colour,vec3(.42,.36,.25)*(.88+fleck*.15),sand);
    float cliff=smoothstep(.18,.5,1.0-normalize(vMistNormal).y);
    // Broken mineral seams join the embedded kit rocks to the exposed coastal slope.
    float strata=sin((vMist.y+noise21(p*.6)*.32)*12.0+noise21(p*2.5)*1.8);
    float seam=smoothstep(.77,.96,strata)*smoothstep(.35,.7,noise21(p*2.3));
    vec3 stone=mix(vec3(.19,.195,.17),vec3(.29,.28,.24),noise21(p*1.3));
    stone*=1.0-seam*.07;
    colour=mix(colour,stone,cliff);
    colour*=mix(.6,1.0,smoothstep(-1.0,.1,vMist.y))*(1.0-climateWet*.18);
    diffuseColor.rgb*=colour;
   `)
  }}/>
 </mesh></group>
}
