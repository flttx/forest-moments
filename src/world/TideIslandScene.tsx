import {Suspense,useEffect,useMemo} from 'react'
import * as THREE from 'three'
import {tideHeight,tideIsland,tidePools,tidePoolWaterY,tideGLSL} from './tideIsland'
import {TidePoolLife} from './TidePoolLife'
import {noiseGLSL} from './terrain'
import {rockSlabGLSL} from './rockShading'
import {climateUniforms,climateGLSL} from './climateUniforms'

export function TideIsland(){
 const geometry=useMemo(()=>{
  const g=new THREE.PlaneGeometry(44,36,220,180);g.rotateX(-Math.PI/2);g.translate(tideIsland.x,0,tideIsland.z)
  const p=g.getAttribute('position')
  for(let i=0;i<p.count;i++)p.setY(i,tideHeight(p.getX(i),p.getZ(i)))
  g.computeVertexNormals();g.computeBoundingSphere();return g
 },[])
 useEffect(()=>()=>geometry.dispose(),[geometry])
 return <group><Suspense fallback={null}><TidePoolLife/></Suspense><mesh name="tide-island-terrain" geometry={geometry} receiveShadow>
  <meshStandardMaterial roughness={.96} onBeforeCompile={shader=>{
   Object.assign(shader.uniforms,{climateWet:climateUniforms.climateWet})
   shader.vertexShader='varying vec3 vTide;varying vec3 vTideNormal;\n'+shader.vertexShader
   shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvTide=position;vTideNormal=normal;')
   shader.fragmentShader=`varying vec3 vTide;varying vec3 vTideNormal;${noiseGLSL}${rockSlabGLSL}${tideGLSL}${climateGLSL}\n`+shader.fragmentShader
   shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',/* glsl */`
    #include <color_fragment>
    vec2 p=vTide.xz;float broad=noise21(p*.55),grain=noise21(p*24.0);
    vec3 stone=mix(vec3(.36,.31,.24),vec3(.54,.46,.34),broad)*(.91+grain*.17);
    // Jointed blocks on the outer face and in a few patches on top; pool beds stay smooth.
    vec2 slab=rockSlab(p,2.4);
    float joints=(smoothstep(.55,.85,tideRadius(p))+smoothstep(.6,.85,noise21(p*.4+4.0))*.5)*smoothstep(1.1,1.5,tidePoolDistance(p));
    stone*=1.0+(slab.x-.5)*.24*joints;stone*=1.0-slab.y*.34*min(joints,1.0);
    float seam=smoothstep(.78,.98,sin(vTide.y*18.0+noise21(p*1.5)*2.0))*smoothstep(.35,.7,noise21(p*2.3));
    stone*=1.0-seam*.12;
    float path=1.0-smoothstep(.65,1.08,tidePath(p)+(noise21(p*3.0)-.5)*.22);
    // Outer shelf face: warm strata, shadowed hollows, algae near the waterline and pale salt crust on the lip.
    float face=smoothstep(.5,.82,tideRadius(p))*(1.0-smoothstep(1.0,1.16,tideRadius(p)));
    float strata=sin(vTide.y*11.0+noise21(p*.6)*9.0+noise21(p*2.2)*2.5);
    vec3 warm=mix(vec3(.36,.30,.23),vec3(.52,.44,.33),smoothstep(-.5,.7,strata));
    stone=mix(stone,warm*(.86+grain*.2),face*.5);
    stone*=1.0-face*(1.0-smoothstep(.35,.9,vTideNormal.y))*.35;
    stone=mix(stone,vec3(.17,.24,.16),face*(1.0-smoothstep(.04,.34,vTide.y))*smoothstep(.4,.8,noise21(p*1.4)*.7+noise21(p*5.0)*.3)*.55);
    stone=mix(stone,vec3(.62,.58,.48),face*smoothstep(.45,.62,vTide.y)*smoothstep(.55,.8,noise21(p*1.3+3.0))*.35);
    // Orange-ochre lichen freckles on exposed rock, as on the reference's sea-facing ledges.
    float lichen=smoothstep(.64,.82,noise21(p*2.6+11.0))*smoothstep(.3,.8,noise21(p*4.5))*smoothstep(.12,.3,vTide.y);
    stone=mix(stone,vec3(.62,.41,.17),lichen*(.35+face*.4));
    // Pale, worn stone collars around each pool with a dark seam where water meets rock.
    float pd=tidePoolDistance(p);
    float collar=smoothstep(.98,1.08,pd)*(1.0-smoothstep(1.3,1.6,pd+(noise21(p*2.0)-.5)*.2));
    stone=mix(stone,vec3(.62,.56,.45)*(.9+grain*.14),collar*.7);
    stone*=1.0-(1.0-smoothstep(.0,.06,abs(pd-1.0)))*.25;
    vec3 colour=mix(stone,vec3(.48,.42,.30)*(.9+grain*.12),path*.65);
    // Small lee cove of warm sand beside the jetty.
    float cove=(1.0-smoothstep(3.0,6.5,length((p-vec2(84.5,102.6))*vec2(1.0,1.4))+(noise21(p*1.2)-.5)*1.5))*(1.0-smoothstep(.5,.85,vTide.y));
    colour=mix(colour,vec3(.74,.64,.47)*(.93+grain*.1),cove*.85);
    float moss=(1.0-smoothstep(.67,.85,tideRadius(p)))*smoothstep(.58,.75,broad)*(1.0-path)*smoothstep(.35,.7,vTide.y);
    colour=mix(colour,vec3(.22,.27,.14),moss*.6);
    // Salt-meadow turf: broad drifts of living grass over the dry shelf, thinning to bare rock near the sea and the loop.
    float turf=smoothstep(.4,.6,tideTurfField(p)+(noise21(p*1.7)-.5)*.22+(noise21(p*6.0)-.5)*.14)*(1.0-smoothstep(.72,.92,tideRadius(p)))*(1.0-path*.85)*smoothstep(.28,.5,vTide.y);
    vec3 grass=mix(vec3(.2,.31,.11),vec3(.33,.4,.15),noise21(p*5.0));
    colour=mix(colour,grass,turf*.9);
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
    // clearer toward the middle, so the creature on the bed shows through; the rim keeps its old density
    diffuseColor.a*=(1.0-smoothstep(.90,1.18,r))*mix(.55,1.0,smoothstep(.35,.95,r));
    diffuseColor.rgb*=.94+.08*noise21(vPool.xz*9.0);
   `)
  }}/>
 </mesh>)}</group>
}
