import {useEffect,useMemo,useRef} from 'react'
import {useFrame} from '@react-three/fiber'
import * as THREE from 'three'
import {creekFalls,creekPoolDistance,creekFord,fordHeight} from '../game/expansion'
import {createFallsGeometry,fallsFoot} from './creekGeometry'
import {noiseGLSL,terrainHeight} from './terrain'
import {daylightAt} from '../game/dayCycle'
import {useForestStore} from '../game/store'

const {pool}=creekFalls
/** Droplets thrown up where the fall strikes the pool. Each loops through its own arc on the GPU; none fly back into the rock. */
const dropletCount=180
const dropletShader={
 vertex:/* glsl */`attribute vec4 seed;uniform float fallsTime;uniform float pixels;uniform vec3 origin;uniform float waterY;varying float vFade;
  void main(){
   float life=.45+.4*seed.y,t=fract(fallsTime/life+seed.w)*life;
   float a=3.14159*(.58+.84*seed.x),out_=.5+1.5*seed.y*seed.y,up=1.4+2.4*seed.z;
   vec3 p=origin+vec3(-.15,0.0,(fract(seed.x*37.1)-.5)*1.3)+vec3(cos(a)*out_*t,up*t-4.9*t*t,sin(a)*out_*t);
   vFade=step(waterY,p.y)*(1.0-smoothstep(.6,1.0,t/life));
   vec4 mv=modelViewMatrix*vec4(p,1.0);gl_Position=projectionMatrix*mv;gl_PointSize=pixels*(.022+.03*seed.z)/max(-mv.z,.1);
  }`,
 fragment:/* glsl */`uniform float light;varying float vFade;
  void main(){float r=length(gl_PointCoord-.5)*2.0;if(r>1.0||vFade<=0.0)discard;
   gl_FragColor=vec4(vec3(.9,.95,.95)*light,(1.0-smoothstep(.35,1.0,r))*vFade*.85);}`,
}
const fallsGLSL=/* glsl */`uniform float fallsTime;varying vec2 fallsUv;\n${noiseGLSL}`
/**
 * Glassy where the water rolls smoothly over the lip, breaking into racing white streaks below; ragged edges that
 * waver as the flow wanders. `speed` slows the inner layer, `opacity` thins it.
 */
const sheetGLSL=(speed:number,opacity:number,strands=0,shade=1)=>/* glsl */`
   float t=fallsTime*${speed.toFixed(2)};
   float streak=noise21(vec2(fallsUv.x*16.0,fallsUv.y*3.0-t*3.2))*.6+noise21(vec2(fallsUv.x*41.0,fallsUv.y*7.0-t*4.5))*.4;
   float tongue=1.0-smoothstep(.08,.42,fallsUv.y+(noise21(vec2(fallsUv.x*9.0,t*.7))-.5)*.12);
   float side=fallsUv.x<.5?0.0:7.0;
   float edge=abs(fallsUv.x*2.0-1.0)+(noise21(vec2(side,fallsUv.y*5.0-t*2.2))-.5)*.22;
   vec3 white=mix(vec3(.38,.56,.54),vec3(.93,.97,.96),smoothstep(.4,.78,streak)*.65+smoothstep(.6,1.0,fallsUv.y)*.35);
   vec3 glass=mix(vec3(.2,.36,.35),vec3(.55,.7,.68),smoothstep(.45,.8,noise21(vec2(fallsUv.x*7.0,fallsUv.y*2.0-t*1.5))));
   // Below the glassy tongue the outer curtain parts into ropes of water that drift slowly across; the gaps show the
   // darker inner fall and the wet rock behind, which is what gives the curtain depth seen face-on.
   float ropeField=noise21(vec2(fallsUv.x*13.0,fallsUv.y*.8-t*.25))*.7+noise21(vec2(fallsUv.x*31.0,fallsUv.y*1.6-t*.4))*.3;
   float rope=smoothstep(.36,.6,ropeField),rim=1.0-smoothstep(.0,.06,abs(ropeField-.48));
   float parted=${strands.toFixed(2)}*(1.0-tongue)*smoothstep(.12,.35,fallsUv.y);
   // The inner fall sits in the curtain's shadow: darker, bluer, with less white in it.
   vec3 body=mix(white,glass,tongue*.9);body=mix(body,mix(vec3(.24,.4,.42),body,.45),1.0-${shade.toFixed(2)});
   diffuseColor.rgb=body*${shade.toFixed(2)}*mix(1.0,.88+.24*rope+.15*rim,parted);
   diffuseColor.a=mix(.36+.55*smoothstep(.3,.75,streak),.7,tongue)*(1.0-smoothstep(.72,1.0,edge+(streak-.5)*.2))*mix(1.0,.06+.94*rope,parted)*${opacity.toFixed(2)};`

/**
 * Rings spreading from the raccoon's legs while it wades in the pool: faint when it stands still, brisk as it walks.
 * The disc sits on the pool surface and only shows where there is water under it.
 */
function WadeRipples(){
 const disc=useMemo(()=>new THREE.CircleGeometry(1.1,40).rotateX(-Math.PI/2),[])
 const material=useMemo(()=>new THREE.ShaderMaterial({transparent:true,depthWrite:false,
  uniforms:{rippleTime:{value:0},stir:{value:0},light:{value:1},show:{value:0}},
  vertexShader:/* glsl */`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
  fragmentShader:/* glsl */`uniform float rippleTime;uniform float stir;uniform float light;uniform float show;varying vec2 vUv;
   void main(){vec2 q=vUv*2.0-1.0;float r=length(q),ring=0.0,ang=atan(q.y,q.x);
    // Rings wobble a little round their circumference and soften as they spread, so they read as water, not drawn circles.
    float wobble=.025*sin(ang*5.0+rippleTime*1.7)+.02*sin(ang*3.0-rippleTime*1.1);
    for(int i=0;i<3;i++){float age=fract(rippleTime*(.55+.5*stir)+float(i)/3.0),front=.18+.8*age+wobble*age;ring+=(1.0-smoothstep(.0,.04+.05*age,abs(r-front)))*(1.0-age)*(1.0-age*.4);}
    float a=(ring*(.5+.5*stir)+(1.0-smoothstep(.1,.3,r))*.25*stir)*(1.0-smoothstep(.85,1.0,r))*show;
    gl_FragColor=vec4(vec3(.85,.93,.92)*light,a*.85);}`}),[])
 const mesh=useRef<THREE.Mesh>(null)
 const run=useRef({time:0,stir:0,x:NaN,z:NaN})
 useFrame((_,delta)=>{
  const s=useForestStore.getState(),r=run.current,dt=Math.min(delta,.05),p=s.position,m=mesh.current
  if(!m)return
  const speed=Number.isFinite(r.x)?Math.hypot(p.x-r.x,p.z-r.z)/Math.max(dt,1e-3):0;r.x=p.x;r.z=p.z
  const wading=s.location==='island'&&s.mode!=='rowing'&&creekPoolDistance(p.x,p.z)<pool.radius+.1&&pool.water-terrainHeight(p.x,p.z)>.02
  r.stir+=((wading?Math.min(1,speed/2):0)-r.stir)*(1-Math.exp(-4*dt))
  if(!matchMedia('(prefers-reduced-motion: reduce)').matches)r.time+=dt
  const u=(m.material as THREE.ShaderMaterial).uniforms
  u.rippleTime.value=r.time;u.stir.value=r.stir;u.light.value=.15+.85*daylightAt(s);u.show.value+=((wading?1:0)-u.show.value)*(1-Math.exp(-6*dt))
  m.visible=u.show.value>.01;m.position.set(p.x,pool.water+.015,p.z)
 })
 useEffect(()=>()=>{disc.dispose();material.dispose()},[disc,material])
 return <mesh ref={mesh} geometry={disc} material={material} name="creek-wade-ripples" renderOrder={3} visible={false} raycast={()=>{}}/>
}

/** Flat, slightly tilted stones laid across the riffle along the ford; their tops are the walking surface. */
function FordStones(){
 const stones=useMemo(()=>{
  const [ax,az]=creekFord.a,[bx,bz]=creekFord.b,count=Math.round(Math.hypot(bx-ax,bz-az)/.48)+1
  return Array.from({length:count},(_,i)=>{
   const t=i/(count-1),j=Math.sin(i*12.9898)*43758.5453,n=j-Math.floor(j),x=ax+(bx-ax)*t+(n-.5)*.12,z=az+(bz-az)*t
   return{x,z,y:fordHeight(x,terrainHeight(x,z))-.07,yaw:n*6.28,sx:.27+n*.08,sz:.23+(1-n)*.07,tilt:(n-.5)*.12}
  })
 },[])
 // Splashed stone: dark and glossy toward the water with a thin film of green weed at the line; dry and pale on top.
 const wet=useMemo(()=>{
  const m=new THREE.MeshStandardMaterial({color:'#665f53',roughness:.8,flatShading:true})
  m.customProgramCacheKey=()=>'creek-ford-stone'
  m.onBeforeCompile=s=>{
   s.vertexShader='varying vec3 fordWorld;\n'+s.vertexShader.replace('#include <worldpos_vertex>','#include <worldpos_vertex>\nfordWorld=(modelMatrix*vec4(transformed,1.0)).xyz;')
   s.fragmentShader=`varying vec3 fordWorld;\n${noiseGLSL}\nfloat fordWater(float x){float t=clamp((x+39.0)/7.4,0.0,1.0);return -.85+${(pool.water+.85).toFixed(2)}*t*t*(3.0-2.0*t);}\n`+s.fragmentShader
    .replace('#include <color_fragment>',`#include <color_fragment>
     float above=fordWorld.y-fordWater(fordWorld.x);
     // Soaked near the water; above it, splashed in patches that are darker and glossier than the dry stone between.
     float soaked=max(1.0-smoothstep(.04,.12+noise21(fordWorld.xz*9.0)*.05,above),smoothstep(.36,.62,noise21(fordWorld.xz*6.0+3.0))*.8);
     diffuseColor.rgb*=mix(1.0,.5,soaked);
     diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.16,.22,.12),(1.0-smoothstep(.0,.035,abs(above-.015)))*.6);`)
    .replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=mix(roughnessFactor,.22,soaked);')
  }
  return m
 },[])
 useEffect(()=>()=>wet.dispose(),[wet])
 return <group name="creek-ford">{stones.map((s,i)=><mesh key={i} position={[s.x,s.y,s.z]} rotation={[s.tilt,s.yaw,0]} scale={[s.sx,.1,s.sz]} material={wet} castShadow receiveShadow>
  <icosahedronGeometry args={[1,0]}/>
 </mesh>)}</group>
}

export function CreekFalls(){
 const sheet=useMemo(()=>createFallsGeometry(),[])
 const inner=useMemo(()=>createFallsGeometry(.16,.8),[])
 const foam=useMemo(()=>new THREE.CircleGeometry(1.5,40).rotateX(-Math.PI/2),[])
 const time=useRef({value:0})
 const spray=useMemo(()=>{
  const canvas=document.createElement('canvas');canvas.width=canvas.height=64
  const g=canvas.getContext('2d')
  // A soft, eased falloff so a puff never shows a rim.
  if(g){const glow=g.createRadialGradient(32,32,0,32,32,32);for(const [at,a] of [[0,.55],[.35,.32],[.7,.08],[1,0]])glow.addColorStop(at,`rgba(255,255,255,${a})`);g.fillStyle=glow;g.fillRect(0,0,64,64)}
  const map=new THREE.CanvasTexture(canvas)
  return Array.from({length:7},()=>new THREE.SpriteMaterial({map,transparent:true,depthWrite:false,opacity:0}))
 },[])
 const droplets=useMemo(()=>{
  const g=new THREE.BufferGeometry(),seed=new Float32Array(dropletCount*4)
  // A fixed scatter (hashed, not random) so every visit throws the same spray.
  for(let i=0;i<seed.length;i++){const n=Math.sin(i*12.9898+78.233)*43758.5453;seed[i]=n-Math.floor(n)}
  // Positions are computed in the vertex shader; the attribute only sizes the draw.
  g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(dropletCount*3),3));g.setAttribute('seed',new THREE.BufferAttribute(seed,4))
  const material=new THREE.ShaderMaterial({vertexShader:dropletShader.vertex,fragmentShader:dropletShader.fragment,transparent:true,depthWrite:false,
   uniforms:{fallsTime:{value:0},pixels:{value:900},light:{value:1},origin:{value:new THREE.Vector3(fallsFoot.x,pool.water,fallsFoot.z)},waterY:{value:pool.water}}})
  const points=new THREE.Points(g,material);points.frustumCulled=false;points.name='creek-falls-droplets';points.raycast=()=>{}
  return{points,material}
 },[])
 const sprayGroup=useRef<THREE.Group>(null)
 // The frame loop works on a ref to the built droplets (as Climate does), not on the memoised value.
 const live=useRef(droplets)
 useFrame((state,dt)=>{
  if(!matchMedia('(prefers-reduced-motion: reduce)').matches)time.current.value+=Math.min(dt,.05)
  // Sprites and droplets are unlit: dim them with the daylight so they never glow in the dark gorge.
  const light=.12+.88*daylightAt(useForestStore.getState())
  const drops=live.current.material.uniforms;drops.fallsTime.value=time.current.value;drops.light.value=light;drops.pixels.value=state.size.height*state.viewport.dpr
  sprayGroup.current?.children.forEach((puff,i)=>{
   const life=(time.current.value*.22+i/spray.length)%1
   puff.position.set(fallsFoot.x-.3-life*.9,pool.water+.15+life*1.4,fallsFoot.z+Math.sin(i*2.4)*.6)
   puff.scale.setScalar(1.1+life*2.2);spray[i].opacity=Math.sin(Math.PI*life)*.2*(.4+.6*light);spray[i].color.setRGB(.91*light,.95*light,.94*light)
  })
 })
 useEffect(()=>()=>{sheet.dispose();inner.dispose();foam.dispose();spray[0].map?.dispose();spray.forEach(m=>m.dispose());droplets.points.geometry.dispose();droplets.material.dispose()},[sheet,inner,foam,spray,droplets])
 const compile=(body:string)=>(s:THREE.WebGLProgramParametersWithUniforms)=>{
  s.uniforms.fallsTime=time.current
  s.vertexShader='varying vec2 fallsUv;\n'+s.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\nfallsUv=uv;')
  s.fragmentShader=fallsGLSL+s.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\n'+body)
 }
 return <group name="creek-falls">
  {/* The inner layer nearer the rock: darker, slower, so the fall has depth when seen from the side. */}
  <mesh geometry={inner} name="creek-falls-inner"><meshStandardMaterial color="#9fbcb6" roughness={.35} transparent depthWrite={false} side={THREE.DoubleSide} customProgramCacheKey={()=>'creek-falls-inner'} onBeforeCompile={compile(sheetGLSL(.7,.72,0,.6))}/></mesh>
  <mesh geometry={sheet} name="creek-falls-sheet" renderOrder={1}><meshStandardMaterial color="#cfe6e0" roughness={.3} transparent depthWrite={false} side={THREE.DoubleSide} customProgramCacheKey={()=>'creek-falls-sheet'} onBeforeCompile={compile(sheetGLSL(1,1,1))}/></mesh>
  {/* Churned white water spreading from the foot of the fall. */}
  <mesh geometry={foam} position={[fallsFoot.x-.55,pool.water+.02,fallsFoot.z]} name="creek-falls-foam" renderOrder={2}><meshStandardMaterial color="#eef5f2" roughness={.6} transparent depthWrite={false} customProgramCacheKey={()=>'creek-falls-foam'} onBeforeCompile={compile(/* glsl */`
   vec2 q=fallsUv*2.0-1.0;float r=length(q);
   // Rings of churn roll outward from the plunge; the direction is sampled as a vector so there is no angular seam.
   vec2 dir=q/max(r,1e-3)*smoothstep(.0,.35,r);
   float churn=noise21(dir*2.2+vec2(r*5.0-fallsTime*1.4))*.55+noise21(q*7.0+fallsTime*.6)*.25+noise21(q*16.0-fallsTime*.9)*.2;
   diffuseColor.a=smoothstep(.5,.82,churn+(1.0-r)*.25)*(1.0-smoothstep(.1,.95,r))*.75;`)}/></mesh>
  {/* Spray hanging over the plunge, drifting up and fading. */}
  {/* No raycast: sprites need raycaster.camera, which the photo line-of-sight test does not set. */}
  <primitive object={droplets.points}/>
  <WadeRipples/>
  <FordStones/>
  <group ref={sprayGroup} name="creek-falls-spray">{spray.map((m,i)=><sprite key={i} material={m} raycast={()=>{}}/>)}</group>
 </group>
}
