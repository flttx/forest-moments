import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { pond } from '../game/rowing'
import { noiseGLSL, seaLevel, islandShape, shoreWaterFraction } from './terrain'
import {pondRadiusAt,pondGLSL,pondWaterInset} from './pondShape'

const palettes = {
  day: { top: '#6e9cb2', horizon: '#c4d6d6', sun: '#fff0ce', light: '#ffe4b8', sea: '#286879', power: 2.5, fill: 1.1, environment: .55, sunPosition: [-28, 30, -26] as [number, number, number] },
  dusk: { top: '#637b99', horizon: '#e9b687', sun: '#ffdb9e', light: '#ffb878', sea: '#385c68', power: 1.8, fill: .85, environment: .4, sunPosition: [-36, 10, -30] as [number, number, number] },
  night: { top: '#111e36', horizon: '#394d64', sun: '#dce7f2', light: '#b1c9ef', sea: '#203b50', power: .65, fill: .8, environment: .3, sunPosition: [-24, 32, -32] as [number, number, number] },
}
const requested = new URLSearchParams(location.search).get('light')
const lighting = requested === 'dusk' || requested === 'night' ? requested : 'day'
const palette = palettes[lighting]

function createWindClock() {
  const uniform={value:0}
  return {uniform,advance(delta:number){uniform.value+=Math.min(delta,.05)}}
}

/** Locally painted sky supplies PBR reflections as well as a matching visible horizon. */
function skyTexture() {
  const w=512, h=256, bytes=new Uint8Array(w*h*4)
  const top=new THREE.Color(palette.top), horizon=new THREE.Color(palette.horizon), sun=new THREE.Color(palette.sun)
  const direction=new THREE.Vector3(...palette.sunPosition).normalize(), colour=new THREE.Color()
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

function WaterSurface({ time, fresh = false }: { time: THREE.IUniform<number>; fresh?: boolean }) {
  const uniforms=useMemo(()=>({waterTime:time, fresh:{value:fresh ? 1 : 0}, shallow:{value:new THREE.Color(fresh ? '#74977c' : '#73a99c')}}),[fresh,time])
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
  return <mesh name={fresh ? 'fresh-water' : 'ocean'} rotation={[-Math.PI/2,0,0]} position={fresh ? [pond.x,pond.waterY,pond.z] : [0,seaLevel,0]} receiveShadow>
    <primitive object={geometry} attach="geometry"/>
    <meshPhysicalMaterial color={fresh ? '#3d746d' : palette.sea} roughness={fresh ? .36 : .32} metalness={0} specularIntensity={.28} envMapIntensity={.7}
      onBeforeCompile={(shader)=>{
        Object.assign(shader.uniforms,uniforms)
        shader.vertexShader='varying vec3 vWater;\n'+shader.vertexShader
        shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvWater=(modelMatrix*vec4(position,1.0)).xyz;')
        shader.fragmentShader=`uniform float waterTime; uniform float fresh; uniform vec3 shallow; varying vec3 vWater;\n${noiseGLSL}\n${pondGLSL}\n`+shader.fragmentShader
        shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',/* glsl */ `
          #include <color_fragment>
          vec2 p=vWater.xz;
          float shore=fresh>.5 ? -pondEdgeAt(p)-${pondWaterInset.toFixed(9)} : length(p)-mix(${islandShape.plateauRadius.toFixed(1)},coastAt(p)+${islandShape.shoreExtension.toFixed(1)},${shoreWaterFraction.toFixed(9)});
          float shallows=1.0-smoothstep(.0,fresh>.5?1.2:5.0,shore);
          diffuseColor.rgb=mix(diffuseColor.rgb,shallow,shallows*.65);
          float ripples=sin(p.x*2.4+p.y*1.1-waterTime*.8)*sin(p.y*3.2-p.x*.6+waterTime*.5);
          float foam=(1.0-smoothstep(.0,.38,abs(shore-.22-sin(waterTime*.7+p.x*.5)*.12)))*smoothstep(.28,.72,noise21(p*3.5+waterTime*.08));
          diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.65,.72,.61),foam*(fresh>.5?.2:.65));
          diffuseColor.rgb*=.96+ripples*.04;
        `)
        shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',/* glsl */ `
          #include <normal_fragment_maps>
          vec2 q=vWater.xz; float t=waterTime;
          float strength=mix(.11,.065,fresh);
          float warp=noise21(q*.28+t*.04)*3.0;
          float nx=cos(q.x*1.85+q.y*.8+warp-t*.75)*strength+cos(q.x*4.4-q.y*2.3+t*.9)*strength*.35;
          float nz=sin(q.y*1.95-q.x*.6+warp-t*.6)*strength+sin(q.y*4.9+q.x*2.6+t*.7)*strength*.25;
          vec3 rippleNormal=normalize((viewMatrix*vec4(-nx,1.0,-nz,0.0)).xyz);
          normal=normalize(mix(normal,rippleNormal,.88));
        `)
      }} />
  </mesh>
}

export function Atmosphere() {
  const get=useThree(s=>s.get)
  const sky=useRef<THREE.Mesh>(null)
  const wind=useMemo(()=>createWindClock(),[])
  const time=wind.uniform
  const reduced=useRef(false)
  const uniforms=useMemo(()=>({
    time, top:{value:new THREE.Color(palette.top)}, horizon:{value:new THREE.Color(palette.horizon)},
    sunlight:{value:new THREE.Color(palette.sun)}, sun:{value:new THREE.Vector3(...palette.sunPosition).normalize()},
    night:{value:lighting==='night'?1:0},
  }),[time])
  useEffect(()=>{
    const {gl,scene}=get()
    const media=matchMedia('(prefers-reduced-motion: reduce)')
    const change=()=>{reduced.current=media.matches};change();media.addEventListener('change',change)
    const texture=skyTexture(), generator=new THREE.PMREMGenerator(gl), target=generator.fromEquirectangular(texture)
    const previous={environment:scene.environment,environmentIntensity:scene.environmentIntensity}
    scene.environment=target.texture;scene.environmentIntensity=palette.environment
    return ()=>{media.removeEventListener('change',change);Object.assign(scene,previous);texture.dispose();target.dispose();generator.dispose()}
  },[get])
  useFrame(({camera,gl},delta)=>{
    if(!reduced.current)wind.advance(delta)
    sky.current?.position.copy(camera.position)
    if(import.meta.env.DEV && new URLSearchParams(location.search).has('qa')) gl.domElement.dataset.environmentQa=JSON.stringify({time:time.value,reduced:reduced.current,lighting})
  })
  return <>
    <fog attach="fog" args={[palette.horizon,65,270]} />
    <hemisphereLight args={['#c4deed','#6b6245',palette.fill]} />
    <directionalLight position={palette.sunPosition} color={palette.light} intensity={palette.power} castShadow
      shadow-mapSize={[2048,2048]} shadow-camera-left={-36} shadow-camera-right={36} shadow-camera-top={36} shadow-camera-bottom={-36}
      shadow-camera-near={1} shadow-camera-far={110} shadow-bias={-.00025} shadow-normalBias={.025} />
    <mesh ref={sky} name="painted-sky" renderOrder={-100} frustumCulled={false}>
      <sphereGeometry args={[450,32,16]} />
      <shaderMaterial side={THREE.BackSide} depthWrite={false} uniforms={uniforms}
        vertexShader={`varying vec3 vDirection;void main(){vDirection=position;vec4 p=projectionMatrix*modelViewMatrix*vec4(position,1.0);gl_Position=p.xyww;}`}
        fragmentShader={/* glsl */ `
          varying vec3 vDirection;uniform float time;uniform float night;
          uniform vec3 top;uniform vec3 horizon;uniform vec3 sunlight;uniform vec3 sun;
          ${noiseGLSL}
          float cloud(vec2 p){return noise21(p)*.57+noise21(p*2.03+17.1)*.28+noise21(p*4.1+9.2)*.15;}
          void main(){
            vec3 d=normalize(vDirection);
            vec3 colour=mix(horizon,top,pow(max(d.y,0.0),.55));
            float facing=max(0.0,dot(d,sun));
            colour=mix(colour,sunlight,pow(facing,48.0)*.55);
            colour=mix(colour,sunlight*1.8,smoothstep(.99955,.9998,facing));
            vec2 p=d.xz/(max(d.y,0.0)+.17)*2.5+vec2(time*.003,time*.001)+vec2(8,3);
            float density=cloud(p), rim=clamp(.5+(density-cloud(p+sun.xz*.18))*4.0,0.0,1.0);
            float alpha=smoothstep(.54,.72,density)*smoothstep(.015,.18,d.y)*.8;
            vec3 shade=mix(horizon*.65,sunlight,.45+rim*.4)*mix(1.0,.15,night);
            colour=mix(colour,shade,alpha);
            vec2 stars=d.xz/(d.y+.9)*210.0;float star=step(.997,hash21(floor(stars)))*(1.0-smoothstep(.02,.13,length(fract(stars)-.5)));
            colour+=vec3(star*night*smoothstep(.06,.25,d.y)*(1.0-alpha));
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
