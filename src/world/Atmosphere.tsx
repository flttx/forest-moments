import {climateNow,climateUniforms,jellyGlow,rainRingsGLSL} from './climateUniforms'
// Mist and rain thin the colour toward a soft grey.
const mistGrey=new THREE.Color('#c3cbc7')
import {constellation} from '../game/secrets'
import {daylightAt,lanternPower} from '../game/dayCycle'
import {dayLighting} from './dayLighting'
import {useForestStore} from '../game/store'
import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { pond } from '../game/rowing'
import { noiseGLSL, seaLevel, islandShape, shoreWaterFraction } from './terrain'
import {pondRadiusAt,pondGLSL,pondWaterInset} from './pondShape'
import {mistGLSL} from './mistIsland'
import {tideGLSL} from './tideIsland'
import {autumnGLSL} from './autumnIsland'

function createWindClock() {
  const uniform={value:0}
  return {uniform,advance(delta:number){uniform.value+=Math.min(delta,.05)}}
}

/** Locally painted sky supplies PBR reflections as well as a matching visible horizon. */
function skyTexture(palette:ReturnType<typeof dayLighting>) {
  const w=512, h=256, bytes=new Uint8Array(w*h*4)
  const top=new THREE.Color(palette.top), horizon=new THREE.Color(palette.horizon), sun=new THREE.Color(palette.sun)
  const direction=palette.sunPosition.clone().normalize(), colour=new THREE.Color()
  for(let y=0;y<h;y++) for(let x=0;x<w;x++) {
    const latitude=((y+.5)/h-.5)*Math.PI, longitude=((x+.5)/w-.5)*Math.PI*2
    const up=Math.sin(latitude), ring=Math.cos(latitude)
    const facing=Math.max(0,ring*Math.cos(longitude)*direction.x+up*direction.y+ring*Math.sin(longitude)*direction.z)
    colour.copy(horizon).lerp(top,Math.pow(Math.max(0,up),.55)).lerp(sun,Math.pow(facing,48)*.65)
    colour.convertLinearToSRGB()
    const i=(y*w+x)*4
    bytes[i]=Math.round(colour.r*255);bytes[i+1]=Math.round(colour.g*255);bytes[i+2]=Math.round(colour.b*255);bytes[i+3]=255
  }
  const texture=new THREE.DataTexture(bytes,w,h)
  texture.mapping=THREE.EquirectangularReflectionMapping;texture.colorSpace=THREE.SRGBColorSpace
  texture.magFilter=THREE.LinearFilter;texture.minFilter=THREE.LinearFilter;texture.needsUpdate=true
  return texture
}

/** Finite-difference slope of a value-noise height field (metres), sampled at the given frequency. */
const waveGLSL=/* glsl */ `vec2 waveSlope(vec2 x,float freq,float height){vec2 p=x*freq;float h=noise21(p);return vec2(noise21(p+vec2(.1,0.0))-h,noise21(p+vec2(0.0,.1))-h)*(10.0*freq*height);}`

function WaterSurface({ time, fresh = false }: { time: THREE.IUniform<number>; fresh?: boolean }) {
  const material=useRef<THREE.MeshPhysicalMaterial>(null)
  const uniforms=useMemo(()=>({waterTime:time, fresh:{value:fresh ? 1 : 0}, shallow:{value:new THREE.Color(fresh ? '#74977c' : '#73a99c')}, seaHaze:{value:new THREE.Color()}}),[fresh,time])
  useFrame(()=>{if(!fresh&&material.current){const s=useForestStore.getState(),light=dayLighting(daylightAt(s),s.sunRising);material.current.color.copy(light.sea);uniforms.seaHaze.value.copy(light.haze)}})
  const geometry=useMemo(()=>{
    if(!fresh)return new THREE.PlaneGeometry(1200,1200)
    const g=new THREE.CircleGeometry(1,192),p=g.getAttribute('position')
    for(let i=1;i<p.count;i++){
      const x=p.getX(i),y=p.getY(i),r=pondRadiusAt(Math.atan2(-y,x))
      p.setXY(i,x*r,y*r)
    }
    return g
  },[fresh])
  useEffect(()=>()=>geometry.dispose(),[geometry])
  return <mesh name={fresh ? 'fresh-water' : 'ocean'} rotation={[-Math.PI/2,0,0]} position={fresh ? [pond.x,pond.waterY,pond.z] : [0,seaLevel,0]} receiveShadow={fresh}>
    <primitive object={geometry} attach="geometry"/>
    <meshPhysicalMaterial ref={material} color={fresh ? '#3d746d' : '#286879'} roughness={fresh ? .36 : .32} metalness={0} specularIntensity={.28} envMapIntensity={.7}
      onBeforeCompile={(shader)=>{
        Object.assign(shader.uniforms,uniforms,{climateRain:climateUniforms.climateRain,jellyGlow})
        shader.vertexShader='varying vec3 vWater;\n'+shader.vertexShader
        shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvWater=(modelMatrix*vec4(position,1.0)).xyz;')
        shader.fragmentShader=`uniform float waterTime; uniform float fresh; uniform vec3 shallow; uniform vec3 seaHaze; uniform vec4 jellyGlow; varying vec3 vWater;\n${noiseGLSL}\n${pondGLSL}\n${mistGLSL}\n${autumnGLSL}\n${tideGLSL}\n${waveGLSL}\n${rainRingsGLSL}\n`+shader.fragmentShader
        shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',/* glsl */ `
          #include <color_fragment>
          vec2 p=vWater.xz;
          float shore=fresh>.5 ? -pondEdgeAt(p)-${pondWaterInset.toFixed(9)} : length(p)-mix(${islandShape.plateauRadius.toFixed(1)},coastAt(p)+${islandShape.shoreExtension.toFixed(1)},${shoreWaterFraction.toFixed(9)});
          if(fresh<.5)shore=mix(shore,min(shore,(westLandAt(p)-.896)*28.0),westBlendAt(p));
          if(fresh<.5&&p.x>72.0)shore=min(shore,min((mistRadius(p)-.98)*19.0,min((autumnRadius(p)-.98)*18.0,(tideRadius(p)-.98)*15.0)));
          float shallows=1.0-smoothstep(.0,fresh>.5?1.2:5.0,shore);
          diffuseColor.rgb=mix(diffuseColor.rgb,shallow,shallows*.65);
          float ripples=sin(p.x*2.4+p.y*1.1-waterTime*.8)*sin(p.y*3.2-p.x*.6+waterTime*.5);
          // A soft line washes up and back along the whole shore; noise only varies its width and density.
          float wash=.3+.28*sin(waterTime*.55+noise21(p*.12)*6.0);
          float washLine=1.0-smoothstep(.0,.16+.14*noise21(p*1.7),abs(shore-wash));
          float hug=1.0-smoothstep(.0,.3,shore);
          float foam=max(washLine*(.35+.35*noise21(p*3.0+waterTime*.1)),hug*.85);
          diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.78,.83,.78),foam*(fresh>.5?.2:.7));
          diffuseColor.rgb*=.96+ripples*.04;
          // Raindrop rings catch a little light; they fade out where a ring would be smaller than a pixel.
          vec2 rainCell=fwidth(p);float rainNear=1.0-smoothstep(.02,.08,max(rainCell.x,rainCell.y));
          if(climateRain>.01)diffuseColor.rgb+=vec3(.55,.6,.6)*rainRings(p,waterTime).x*climateRain*rainNear*.16;
          // The jellyfish by the jetty shows through the sea as a pale bell by day and a glow with trailing threads at night.
          vec2 jellyOff=p-jellyGlow.xz;float jellyR=dot(jellyOff,jellyOff);
          float jellyBell=(1.0-fresh)*exp(-jellyR/.04);
          diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.62,.8,.78),jellyBell*.3);
        `)
        shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>',/* glsl */ `
          #include <emissivemap_fragment>
          // A slow pulse, as the bell opens and closes.
          totalEmissiveRadiance+=vec3(.4,.9,.8)*(jellyBell*.4+(1.0-fresh)*exp(-jellyR/.5)*.08)*(.8+.2*sin(waterTime*1.3))*jellyGlow.w;
        `)
        shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',/* glsl */ `
          #include <normal_fragment_maps>
          vec2 q=vWater.xz; float t=waterTime;
          // Fade each octave as it shrinks toward a pixel; far water otherwise aliases into a moire grid.
          vec2 cell=fwidth(q);float footprint=max(cell.x,cell.y);
          // Non-periodic noise octaves in rotated directions: no octave lines up into a visible lattice.
          vec2 slope=waveSlope(q+t*vec2(.35,.2),.55,.22)*(1.0-smoothstep(.1,.5,footprint));
          slope+=waveSlope(mat2(.8,-.6,.6,.8)*q+t*vec2(-.5,.4),1.4,.07)*(1.0-smoothstep(.04,.18,footprint));
          slope+=waveSlope(mat2(.6,.8,-.8,.6)*q+t*vec2(.8,-.6),3.2,.025)*(1.0-smoothstep(.015,.07,footprint));
          slope*=mix(1.0,.6,fresh);
          if(climateRain>.01)slope+=rainRings(q,t).yz*climateRain*(1.0-smoothstep(.02,.08,footprint))*.35;
          // Broad, slow swell keeps distant sea from turning into a flat mirror.
          slope+=(waveSlope(q+t*vec2(.3,.2),.045,2.0)+waveSlope(q+t*vec2(-.45,.35),.13,.5)*(1.0-smoothstep(.1,.6,footprint)))*(1.0-fresh);
          float nx=slope.x,nz=slope.y;
          vec3 rippleNormal=normalize((viewMatrix*vec4(-nx,1.0,-nz,0.0)).xyz);
          normal=normalize(mix(normal,rippleNormal,.88));
        `)
        shader.fragmentShader=shader.fragmentShader.replace('#include <fog_fragment>',/* glsl */ `
          #ifdef USE_FOG
            // The open sea fades into the same haze the sky paints below the horizon.
            gl_FragColor.rgb=mix(gl_FragColor.rgb,mix(seaHaze,fogColor,fresh),smoothstep(fogNear,fogFar,vFogDepth));
          #endif
        `)
      }} />
  </mesh>
}

export function Atmosphere() {
  const palette=useMemo(()=>dayLighting(1),[])
  const sunLight=useRef<THREE.DirectionalLight>(null),moonLight=useRef<THREE.DirectionalLight>(null),fillLight=useRef<THREE.HemisphereLight>(null)
  const shadowTarget=useMemo(()=>new THREE.Object3D(),[])
  const shadowRuntime=useRef(shadowTarget)
  const get=useThree(s=>s.get)
  const sky=useRef<THREE.Mesh>(null)
  const skyMaterial=useRef<THREE.ShaderMaterial>(null)
  const wind=useMemo(()=>createWindClock(),[])
  const time=wind.uniform
  const reduced=useRef(false)
  const uniforms=useMemo(()=>({
    time, top:{value:new THREE.Color(palette.top)}, horizon:{value:new THREE.Color(palette.horizon)},
    sunlight:{value:new THREE.Color(palette.sun)}, sun:{value:palette.sunPosition.clone().normalize()},
    night:{value:0},disc:{value:1},stargaze:{value:0},overcast:{value:0},meteorA:{value:new THREE.Vector3(0,1,0)},meteorB:{value:new THREE.Vector3(0,1,0)},meteorT:{value:0},conStars:{value:constellation.stars.map(d=>new THREE.Vector3(...d))},moon:{value:new THREE.Vector3(-24,32,-32).normalize()},haze:{value:new THREE.Color(palette.haze)},
  }),[time,palette])
  useEffect(()=>{
    const {gl,scene}=get()
    const media=matchMedia('(prefers-reduced-motion: reduce)')
    const change=()=>{reduced.current=media.matches};change();media.addEventListener('change',change)
    const texture=skyTexture(palette), generator=new THREE.PMREMGenerator(gl), target=generator.fromEquirectangular(texture)
    const previous={environment:scene.environment,environmentIntensity:scene.environmentIntensity,fog:scene.fog}
    // Atmosphere lives under the exterior group: attach fog to the actual Scene.
    scene.fog=new THREE.Fog(palette.horizon,65,270)
    scene.environment=target.texture;scene.environmentIntensity=palette.environment
    return ()=>{media.removeEventListener('change',change);Object.assign(scene,previous);texture.dispose();target.dispose();generator.dispose()}
  },[get,palette])
  useFrame(({camera,gl},delta)=>{
    if(!skyMaterial.current)return
    if(!reduced.current)wind.advance(delta)
    const state=useForestStore.getState(),daylight=daylightAt(state),light=dayLighting(daylight,state.sunRising),u=skyMaterial.current.uniforms as typeof uniforms
    u.time.value=time.value
    u.overcast.value=climateNow.overcast
    // Looking up from a seat: more and brighter stars, and now and then a falling star (none with reduced motion).
    const gazing=state.stargazing&&state.mode==='sitting'
    u.stargaze.value+=((gazing?1:0)-u.stargaze.value)*(1-Math.exp(-1.5*Math.min(delta,.1)))
    if(u.meteorT.value>0){u.meteorT.value+=Math.min(delta,.1)/.9;if(u.meteorT.value>=1)u.meteorT.value=0}
    else if(gazing&&!reduced.current&&Math.random()<Math.min(delta,.1)/7){
      const a=Math.random()*Math.PI*2,e=.55+Math.random()*.4
      u.meteorA.value.set(Math.cos(a)*Math.cos(e),Math.sin(e),Math.sin(a)*Math.cos(e))
      u.meteorB.value.copy(u.meteorA.value).add(new THREE.Vector3(Math.cos(a+1.4)*.35,-.22,Math.sin(a+1.4)*.35)).normalize()
      u.meteorT.value=.001
    }
    u.top.value.copy(light.top);u.horizon.value.copy(light.horizon);u.sunlight.value.copy(light.sun);u.sun.value.copy(light.sunPosition).normalize();u.night.value=light.night;u.disc.value=light.disc;u.haze.value.copy(light.haze)
    if(sunLight.current){
      // Move the same-size shadow window into the west forest; preserve the original lighting direction and resolution.
      const x=state.mode==='rowing'?state.boat.x:state.position.x
      const target=shadowRuntime.current
      target.position.set(x>72?107:Math.min(0,x+32),0,x>72?-10:0);target.updateMatrixWorld()
      sunLight.current.target=target;sunLight.current.position.copy(light.sunPosition).add(target.position)
      sunLight.current.color.copy(light.light);sunLight.current.intensity=light.power*climateNow.light;sunLight.current.shadow.intensity=THREE.MathUtils.smoothstep(light.sunPosition.y,1,7)
    }
    if(moonLight.current)moonLight.current.intensity=.95*light.night
    if(fillLight.current){fillLight.current.intensity=light.fill*(.6+.4*climateNow.light);fillLight.current.color.copy(light.sky);fillLight.current.groundColor.copy(light.ground)}
    const viewDistance=state.mode==='sleeping'?165:camera.position.length()
    const scene=get().scene;if(scene.fog){scene.fog.color.copy(light.horizon).lerp(mistGrey,Math.min(1,Math.max(0,(1-climateNow.fog)*1.2))*.7);if(scene.fog instanceof THREE.Fog){scene.fog.near=Math.max(65,viewDistance-25)*climateNow.fog;scene.fog.far=(270+Math.max(0,viewDistance-65)*1.8)*climateNow.fog}}scene.environmentIntensity=light.environment*climateNow.light
    sky.current?.position.copy(camera.position)
    if(import.meta.env.DEV && new URLSearchParams(location.search).has('qa')) gl.domElement.dataset.environmentQa=JSON.stringify({time:time.value,reduced:reduced.current,lighting:state.timeOfDay,daylight,sunPosition:light.sunPosition.toArray(),sunPower:light.power,moonPower:.95*light.night,lanternPower:lanternPower(daylight),sky:light.top.getHexString(),horizon:light.horizon.getHexString(),renderedNight:u.night.value,renderedDisc:u.disc.value})
  })
  return <>
    <primitive object={shadowTarget}/>
    <hemisphereLight ref={fillLight} args={[palette.sky,palette.ground,palette.fill]} />
    <directionalLight ref={moonLight} position={[-24,32,-32]} color="#9db8ec" intensity={0}/>
    <directionalLight ref={sunLight} position={palette.sunPosition} color={palette.light} intensity={palette.power} castShadow
      shadow-mapSize={[2048,2048]} shadow-camera-left={-48} shadow-camera-right={48} shadow-camera-top={48} shadow-camera-bottom={-48}
      shadow-camera-near={1} shadow-camera-far={110} shadow-bias={-.00025} shadow-normalBias={.025} />
    <mesh ref={sky} name="painted-sky" renderOrder={-100} frustumCulled={false}>
      <sphereGeometry args={[450,32,16]} />
      <shaderMaterial ref={skyMaterial} side={THREE.BackSide} depthWrite={false} uniforms={uniforms}
        vertexShader={`varying vec3 vDirection;void main(){vDirection=position;vec4 p=projectionMatrix*modelViewMatrix*vec4(position,1.0);gl_Position=p.xyww;}`}
        fragmentShader={/* glsl */ `
          varying vec3 vDirection;uniform float time;uniform float night;uniform float stargaze;uniform float overcast;uniform vec3 meteorA;uniform vec3 meteorB;uniform float meteorT;uniform vec3 conStars[7];
          uniform vec3 top;uniform vec3 horizon;uniform vec3 sunlight;uniform vec3 sun;uniform vec3 moon;uniform float disc;uniform vec3 haze;
          ${noiseGLSL}
          void conLine(vec3 d,vec3 a,vec3 b,inout vec3 colour,float night){a=normalize(a);b=normalize(b);vec3 seg=b-a;float h=clamp(dot(d-a,seg)/dot(seg,seg),0.0,1.0);float l=length(d-(a+seg*h));colour+=vec3(.85,.9,1.0)*smoothstep(.0016,.0,l)*night*.22*step(.0,dot(d,a));}
          float cloud(vec2 p){return noise21(p)*.57+noise21(p*2.03+17.1)*.28+noise21(p*4.1+9.2)*.15;}
          void main(){
            vec3 d=normalize(vDirection);
            vec3 colour=mix(horizon,top,pow(max(d.y,0.0),.55));
            // Below the horizon the dome stands in for sea beyond the far plane.
            colour=mix(colour,haze,1.0-smoothstep(-.025,.003,d.y));
            float facing=max(0.0,dot(d,sun));
            colour=mix(colour,sunlight,pow(facing,48.0)*.55*disc*smoothstep(0.0,.12,d.y));
            colour=mix(colour,sunlight*1.8,smoothstep(.9993,.99965,facing)*disc);
            float moonFacing=max(0.0,dot(d,moon));colour=mix(colour,vec3(.68,.76,.85),smoothstep(.9995,.9998,moonFacing)*night);
            vec2 p=d.xz/(max(d.y,0.0)+.17)*2.5+vec2(time*.003,time*.001)+vec2(8,3);
            float density=cloud(p), rim=clamp(.5+(density-cloud(p+sun.xz*.18))*4.0,0.0,1.0);
            float alpha=smoothstep(.54-.28*overcast,.72-.16*overcast,density)*smoothstep(.015,.18,d.y)*(.8+.15*overcast);
            // An overcast sky is flatter and greyer behind the clouds.
            colour=mix(colour,vec3(dot(colour,vec3(.3,.5,.2)))*.92,overcast*.55);
            vec3 shade=mix(mix(horizon*.65,sunlight,.45+rim*.4),top*1.1,night);
            colour=mix(colour,shade,alpha);
            vec2 stars=d.xz/(d.y+.9)*210.0;float star=step(.997-.0035*stargaze,hash21(floor(stars)))*(1.0-smoothstep(.02,.13,length(fract(stars)-.5)));
            colour+=vec3(star*night*(1.0+1.6*stargaze)*smoothstep(.06,.25,d.y)*(1.0-alpha*(1.0-.5*stargaze)));
            // The raccoon constellation (hidden corner): seven steady stars joined by faint lines.
            for(int i=0;i<7;i++){float a=acos(clamp(dot(d,normalize(conStars[i])),-1.0,1.0));colour+=vec3(1.0,.97,.88)*smoothstep(.0045,.0012,a)*night*(1.2+stargaze);}
            conLine(d,conStars[0],conStars[2],colour,night);conLine(d,conStars[1],conStars[2],colour,night);conLine(d,conStars[2],conStars[3],colour,night);conLine(d,conStars[3],conStars[4],colour,night);conLine(d,conStars[4],conStars[5],colour,night);conLine(d,conStars[5],conStars[6],colour,night);
            if(meteorT>0.0){vec3 head=normalize(mix(meteorA,meteorB,meteorT)),tail=normalize(mix(meteorA,meteorB,max(0.0,meteorT-.3)));vec3 seg=head-tail;
              float h=clamp(dot(d-tail,seg)/max(dot(seg,seg),1e-6),0.0,1.0);float l=length(d-(tail+seg*h));
              colour+=vec3(1.0,.96,.86)*smoothstep(.0022,.0,l)*h*night*sin(meteorT*3.14159)*1.6;}
            gl_FragColor=vec4(colour,1.0);
            // Fog is composited after tone mapping by Three.js. Keep the painted
            // horizon in the same display colour space to avoid a bright seam.
            #include <colorspace_fragment>
          }`} />
    </mesh>
    <WaterSurface time={time} />
    <WaterSurface time={time} fresh />
  </>
}
