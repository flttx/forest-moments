import {useEffect,useMemo} from 'react'
import * as THREE from 'three'
import {mistIsland,mistHeight,mistGLSL} from './mistIsland'
import {noiseGLSL} from './terrain'
import {rockSlabGLSL} from './rockShading'
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
   shader.fragmentShader=`varying vec3 vMist;varying vec3 vMistNormal;${noiseGLSL}${rockSlabGLSL}${mistGLSL}${climateGLSL}\n`+shader.fragmentShader
   shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',/* glsl */`
    #include <color_fragment>
    vec2 p=vMist.xz;float broad=noise21(p*.5),fleck=noise21(p*25.0);
    vec3 grass=mix(vec3(.19,.25,.11),vec3(.27,.33,.15),broad)*climateGrass;
    float path=1.0-smoothstep(.72,1.04,mistPath(p)+(noise21(p*4.0)-.5)*.18);
    vec3 earth=mix(vec3(.20,.14,.085),vec3(.32,.25,.15),broad)*(.85+fleck*.25);
    vec3 colour=mix(grass,earth,path);
    // The rock band climbs the whole exposed slope; stopping at the waterline left a pale grass skirt in distant views.
    float sand=smoothstep(.79,.9,mistRadius(p)+(noise21(p*.9)-.5)*.07)*(1.0-smoothstep(1.0,2.2,vMist.y));
    // Reference shores are rock-lined: keep sand only in the lee cove by the jetty, elsewhere weathered stone with lichen.
    float cove=1.0-smoothstep(5.0,9.0,length(p-vec2(86.0,-10.0))+(noise21(p*1.1)-.5)*2.0);
    vec3 shoreRock=mix(vec3(.12,.11,.095),vec3(.26,.23,.185),noise21(p*1.6))*(.86+fleck*.2);
    // Joints only in patches and mostly where the shore steepens, so they never read as paving.
    vec2 slab=rockSlab(p,2.6);
    float joints=smoothstep(.35,.7,noise21(p*.45+2.0))*(.5+.5*smoothstep(.08,.35,1.0-normalize(vMistNormal).y));
    shoreRock*=1.0+(slab.x-.5)*.34*joints;shoreRock*=1.0-slab.y*.5*joints;
    shoreRock=mix(shoreRock,vec3(.55,.40,.19),smoothstep(.68,.82,noise21(p*2.4+5.0))*smoothstep(.3,.8,noise21(p*4.0))*.45);
    shoreRock=mix(shoreRock,vec3(.17,.21,.14),(1.0-smoothstep(.0,.35,vMist.y))*.45);
    colour=mix(colour,mix(shoreRock,vec3(.46,.39,.27)*(.88+fleck*.15),cove),sand);
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
