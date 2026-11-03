import {useEffect,useMemo} from 'react'
import {ClearingBirds} from './ClearingBirds'
import * as THREE from 'three'
import {autumnIsland,autumnHeight,autumnGLSL} from './autumnIsland'
import {noiseGLSL} from './terrain'
import {rockSlabGLSL} from './rockShading'
import {climateUniforms,climateGLSL} from './climateUniforms'
import {AutumnUnderstory} from './AutumnUnderstory'

/** Separate terrain chunk: no giant empty grid between islands. */
export function AutumnIsland(){
 const geometry=useMemo(()=>{
  const g=new THREE.PlaneGeometry(54,50,180,166);g.rotateX(-Math.PI/2);g.translate(autumnIsland.x,0,autumnIsland.z)
  const p=g.getAttribute('position')
  for(let i=0;i<p.count;i++)p.setY(i,autumnHeight(p.getX(i),p.getZ(i)))
  g.computeVertexNormals();g.computeBoundingSphere();return g
 },[])
 useEffect(()=>()=>geometry.dispose(),[geometry])
 return <group><AutumnUnderstory/><ClearingBirds/><mesh name="autumn-island-terrain" geometry={geometry} receiveShadow>
  <meshStandardMaterial roughness={.94} onBeforeCompile={shader=>{
   Object.assign(shader.uniforms,{climateGrass:climateUniforms.climateGrass,climateWet:climateUniforms.climateWet})
   shader.vertexShader='varying vec3 vAutumn;varying vec3 vAutumnNormal;\n'+shader.vertexShader
   shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvAutumn=position;vAutumnNormal=normal;')
   shader.fragmentShader=`varying vec3 vAutumn;varying vec3 vAutumnNormal;${noiseGLSL}${rockSlabGLSL}${autumnGLSL}${climateGLSL}\n`+shader.fragmentShader
   shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',/* glsl */`
    #include <color_fragment>
    vec2 p=vAutumn.xz;float broad=noise21(p*.5),fleck=noise21(p*25.0);
    vec3 grass=mix(vec3(.22,.28,.13),vec3(.30,.36,.18),broad)*climateGrass;
    float path=1.0-smoothstep(.72,1.04,autumnPath(p)+(noise21(p*4.0)-.5)*.18);
    vec3 earth=mix(vec3(.20,.14,.085),vec3(.32,.25,.15),broad)*(.85+fleck*.25);
    vec3 colour=mix(grass,earth,path);
    // The rock band climbs the whole exposed slope; stopping at the waterline left a pale grass skirt in distant views.
    float sand=smoothstep(.79,.9,autumnRadius(p)+(noise21(p*.9)-.5)*.07)*(1.0-smoothstep(1.0,2.2,vAutumn.y));
    // Reference shores are rock-lined: keep sand only in the lee cove by the jetty, elsewhere weathered stone with lichen.
    float cove=1.0-smoothstep(5.0,9.0,length(p-vec2(93.5,51.0))+(noise21(p*1.1)-.5)*2.0);
    vec3 shoreRock=mix(vec3(.12,.11,.095),vec3(.26,.23,.185),noise21(p*1.6))*(.86+fleck*.2);
    // Joints only in patches and mostly where the shore steepens, so they never read as paving.
    vec2 slab=rockSlab(p,2.6);
    float joints=smoothstep(.35,.7,noise21(p*.45+2.0))*(.5+.5*smoothstep(.08,.35,1.0-normalize(vAutumnNormal).y));
    shoreRock*=1.0+(slab.x-.5)*.34*joints;shoreRock*=1.0-slab.y*.5*joints;
    shoreRock=mix(shoreRock,vec3(.58,.40,.17),smoothstep(.66,.8,noise21(p*2.4+5.0))*smoothstep(.3,.8,noise21(p*4.0))*.5);
    shoreRock=mix(shoreRock,vec3(.18,.21,.13),(1.0-smoothstep(.0,.35,vAutumn.y))*.45);
    // The cove keeps its old waterline strip of sand; above it the jetty slope is rock like the rest of the shore.
    float beach=cove*smoothstep(.81,1.02,autumnRadius(p)+(noise21(p*.9)-.5)*.055)*(1.0-smoothstep(.4,1.7,vAutumn.y));
    colour=mix(colour,shoreRock,sand);colour=mix(colour,vec3(.46,.39,.27)*(.88+fleck*.15),beach);
    float cliff=smoothstep(.18,.5,1.0-normalize(vAutumnNormal).y);
    // Broken mineral seams join the embedded kit rocks to the exposed coastal slope.
    float strata=sin((vAutumn.y+noise21(p*.6)*.32)*12.0+noise21(p*2.5)*1.8);
    float seam=smoothstep(.77,.96,strata)*smoothstep(.35,.7,noise21(p*2.3));
    vec3 stone=mix(vec3(.19,.195,.17),vec3(.29,.28,.24),noise21(p*1.3));
    stone*=1.0-seam*.07;
    colour=mix(colour,stone,cliff);
    colour*=mix(.6,1.0,smoothstep(-1.0,.1,vAutumn.y))*(1.0-climateWet*.18);
    diffuseColor.rgb*=colour;
   `)
  }}/>
 </mesh></group>
}
