import {useEffect,useMemo,useRef} from 'react'
import {useFrame} from '@react-three/fiber'
import * as THREE from 'three'
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import {useForestStore} from '../game/store'
import {useSandStore,outlineAt,sandAim} from '../game/sandStore'
import {placementRefusal,raccoonOutline,riverPath,workHeight,type SandWork} from '../game/sand'
import {buildAmount,clearSand,drawBuilding,drawWorks,fadePrints,sandGroundAt} from './sandField'
import {groundHeightAt} from '../game/movement'
import {seaLevel} from './worldConfig'
import {noiseGLSL} from './terrain'

// ---------- Castle ----------
// Freshly packed damp sand, a shade under the dry beach around it.
const sandColour=new THREE.Color(.58,.47,.32),shade=new THREE.Color(.36,.27,.17),stick=new THREE.Color(.33,.23,.14),cloth=new THREE.Color(.72,.3,.22)
function piece(g:THREE.BufferGeometry,x:number,y:number,z:number,colour:THREE.Color){
 g.translate(x,y,z)
 const flat=g.index?g.toNonIndexed():g,n=flat.attributes.position.count,c=new Float32Array(n*3)
 for(let i=0;i<n;i++){
  // A little unevenness between faces, like hand-packed sand.
  const k=1+(Math.sin(i*12.9898+x*78.2+z*37.7)*.5)*.06
  c.set([colour.r*k,colour.g*k,colour.b*k],i*3)
 }
 flat.setAttribute('color',new THREE.BufferAttribute(c,3));flat.deleteAttribute('uv')
 return flat
}
function crenels(r:number,y:number,count:number,size:number,ox=0,oz=0){
 return Array.from({length:count},(_,i)=>{const a=i/count*Math.PI*2;return piece(new THREE.BoxGeometry(size,size,size),ox+Math.cos(a)*r,y,oz+Math.sin(a)*r,sandColour)})
}
/** A bucket-moulded keep, four corner towers, walls with battlements, a gate and a twig flag. Base at y=0. */
function castleGeometry(){
 const parts:THREE.BufferGeometry[]=[piece(new THREE.CylinderGeometry(.17,.22,.4,16),0,.2,0,sandColour),...crenels(.155,.43,7,.06)]
 for(const sx of [-1,1])for(const sz of [-1,1])parts.push(piece(new THREE.CylinderGeometry(.1,.13,.3,12),sx*.4,.15,sz*.4,sandColour),...crenels(.09,.32,5,.045,sx*.4,sz*.4))
 for(const s of [-1,1]){
  parts.push(piece(new THREE.BoxGeometry(.6,.17,.09),0,.085,s*.4,sandColour),piece(new THREE.BoxGeometry(.09,.17,.6),s*.4,.085,0,sandColour))
  for(const k of [-.18,0,.18])parts.push(piece(new THREE.BoxGeometry(.06,.05,.09),k,.195,s*.4,sandColour),piece(new THREE.BoxGeometry(.09,.05,.06),s*.4,.195,k,sandColour))
 }
 parts.push(piece(new THREE.BoxGeometry(.13,.12,.02),0,.06,.446,shade),piece(new THREE.CylinderGeometry(.006,.008,.26,5),0,.53,0,stick))
 const flag=new THREE.BufferGeometry();flag.setAttribute('position',new THREE.Float32BufferAttribute([0,.64,0,0,.56,0,.12,.6,0],3));flag.computeVertexNormals()
 parts.push(piece(flag,0,0,0,cloth))
 const merged=mergeGeometries(parts)!;merged.computeVertexNormals();return merged
}
/** Sand that reads as grains up close rather than painted plastic. */
function sandMaterial(){
 const m=new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,side:THREE.DoubleSide})
 m.onBeforeCompile=shader=>{
  shader.vertexShader='varying vec3 vSandWorld;\n'+shader.vertexShader.replace('#include <worldpos_vertex>','#include <worldpos_vertex>\nvSandWorld=(modelMatrix*vec4(transformed,1.0)).xyz;')
  shader.fragmentShader=`varying vec3 vSandWorld;\n${noiseGLSL}\n`+shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
   diffuseColor.rgb*=.9+noise21(vSandWorld.xz*60.0+vSandWorld.y*40.0)*.16+noise21(vSandWorld.xy*9.0+vSandWorld.z*7.0)*.06;`)
 }
 return m
}

function Castle({work,amount}:{work:SandWork;amount:number}){
 const ref=useRef<THREE.Group>(null),{geometry,material}=useCastleKit()
 useFrame(()=>{const g=ref.current;if(!g)return;g.position.set(work.x,groundHeightAt(work.x,work.z)+.05*amount,work.z);g.scale.set(.85+.15*amount,Math.max(.001,amount),.85+.15*amount)})
 return <group ref={ref} name="sand-castle" rotation={[0,work.yaw,0]}><mesh geometry={geometry} material={material} castShadow receiveShadow/></group>
}
let castleKit:{geometry:THREE.BufferGeometry;material:THREE.Material}|null=null
const useCastleKit=()=>castleKit??=(castleKit={geometry:castleGeometry(),material:sandMaterial()})

// ---------- River water ----------
const flowUniform={value:0}
function ribbon(points:{x:number;z:number}[],width:number,height:(x:number,z:number,t:number)=>number){
 const pos:number[]=[],uv:number[]=[],index:number[]=[]
 points.forEach((p,i)=>{
  const a=points[Math.max(0,i-1)],b=points[Math.min(points.length-1,i+1)],dx=b.x-a.x,dz=b.z-a.z,l=Math.hypot(dx,dz)||1,nx=-dz/l*width/2,nz=dx/l*width/2,t=i/(points.length-1)
  for(const s of [-1,1]){const x=p.x+nx*s,z=p.z+nz*s;pos.push(x,height(x,z,t),z);uv.push(t,(s+1)/2)}
  if(i)index.push(i*2-2,i*2-1,i*2,i*2-1,i*2+1,i*2)
 })
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(index);g.computeVertexNormals();return g
}
/** Finer points along the channel so the water follows its bend. */
const smoothPath=(w:SandWork)=>{const p=riverPath(w);return p.flatMap((a,i)=>i?[{x:(p[i-1].x+a.x)/2,z:(p[i-1].z+a.z)/2},a]:[a])}
/** Each channel's water reach, read by its shader. */
const fills=new WeakMap<SandWork,{value:number}>()
const fillFor=(w:SandWork)=>{let f=fills.get(w);if(!f)fills.set(w,f={value:0});return f}
function River({work,amount}:{work:SandWork;amount:number}){
 // Water follows once the channel reaches the sea, then fills back to the dug end.
 const fill=Math.max(0,Math.min(1,(amount-.6)/.4))
 useFrame(()=>{fillFor(work).value=fill})
 const geometry=useMemo(()=>ribbon(smoothPath(work),.26,(x,z)=>Math.max(seaLevel+.006,groundHeightAt(x,z)+workHeight(work,x,z)+.075)),[work])
 const material=useMemo(()=>{
  const m=new THREE.MeshStandardMaterial({color:new THREE.Color(.35,.55,.56),roughness:.12,metalness:0,transparent:true,opacity:.78,depthWrite:false})
  m.onBeforeCompile=shader=>{
   shader.uniforms.flow=flowUniform;shader.uniforms.fill=fillFor(work)
   shader.vertexShader='varying vec2 vFlowUv;\n'+shader.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\nvFlowUv=uv;')
   shader.fragmentShader=`varying vec2 vFlowUv;uniform float flow;uniform float fill;\n${noiseGLSL}\n`+shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
    // The sea runs in from the outer end; ripples travel inland and the edges thin to the wet sand.
    if(vFlowUv.x<1.0-fill)discard;
    float ripple=noise21(vec2(vFlowUv.x*26.0+flow*1.4,vFlowUv.y*3.0))*noise21(vec2(vFlowUv.x*11.0+flow*.8,vFlowUv.y*5.0+3.0));
    diffuseColor.rgb+=vec3(.16,.18,.17)*smoothstep(.25,.55,ripple);
    diffuseColor.a*=smoothstep(0.0,.22,vFlowUv.y)*smoothstep(1.0,.78,vFlowUv.y)*smoothstep(1.0-fill,1.0-fill+.08,vFlowUv.x);`)
  }
  return m
 },[work])
 useEffect(()=>()=>{geometry.dispose()},[geometry])
 useEffect(()=>()=>{material.dispose()},[material])
 return fill>0?<mesh name="sand-river" geometry={geometry} material={material} renderOrder={2}/>:null
}

// ---------- Outline preview ----------
function silhouetteTexture(){
 const c=document.createElement('canvas');c.width=100;c.height=150
 const g=c.getContext('2d')!,img=g.createImageData(100,150)
 for(let y=0;y<150;y++)for(let x=0;x<100;x++){
  const u=-.45+x/100,v=.65-y/150*1.5,s=raccoonOutline(u,v),a=s<-.012?.38:s<.012?.95:0
  img.data.set([255,255,255,a*255],(y*100+x)*4)
 }
 g.putImageData(img,0,0);return new THREE.CanvasTexture(c)
}
function pitTexture(){
 const c=document.createElement('canvas');c.width=c.height=128
 const g=c.getContext('2d')!
 g.fillStyle='rgba(255,255,255,.3)';g.beginPath();g.arc(64,64,62,0,Math.PI*2);g.fill()
 g.strokeStyle='rgba(255,255,255,.95)';g.lineWidth=4;g.beginPath();g.arc(64,64,40,0,Math.PI*2);g.stroke()
 return new THREE.CanvasTexture(c)
}
/** One outline is ever shown, so its textures and materials live for the page. */
let outlineCache:{decals:{imprint:THREE.Texture;pit:THREE.Texture};ghostMaterial:THREE.MeshBasicMaterial;decalMaterial:THREE.MeshBasicMaterial}|null=null
const outlineKit=()=>outlineCache??=(outlineCache={
 decals:{imprint:silhouetteTexture(),pit:pitTexture()},
 ghostMaterial:new THREE.MeshBasicMaterial({color:'white',transparent:true,opacity:.42,depthWrite:false}),
 decalMaterial:new THREE.MeshBasicMaterial({transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2}),
})
function Outline(){
 const tool=useSandStore(s=>s.tool),active=useSandStore(s=>s.active),yaw=useSandStore(s=>s.yaw),works=useSandStore(s=>s.book.works),building=useSandStore(s=>!!s.build)
 const decal=useRef<THREE.Mesh>(null),ghost=useRef<THREE.Group>(null),river=useRef<THREE.Mesh>(null)
 useFrame(()=>{
  const {decals,ghostMaterial,decalMaterial}=outlineKit()
  const show=active&&!!tool&&!building,forest=useForestStore.getState()
  for(const r of [decal,ghost,river])if(r.current)r.current.visible=false
  if(!show||!tool)return
  const work=outlineAt(tool,forest.position,sandAim.facing,yaw),ok=!placementRefusal(work,works),colour=ok?'#fff8e8':'#e0605a'
  ghostMaterial.color.set(colour);decalMaterial.color.set(colour)
  const y=sandGroundAt(work.x,work.z)
  if(tool==='castle'&&ghost.current){ghost.current.visible=true;ghost.current.position.set(work.x,y+.04,work.z);ghost.current.rotation.y=work.yaw}
  if((tool==='pit'||tool==='imprint')&&decal.current){
   const m=decal.current;m.visible=true;m.position.set(work.x,y+.03,work.z);m.rotation.set(-Math.PI/2,0,work.yaw)
   if(decalMaterial.map!==decals[tool]){decalMaterial.map=decals[tool];decalMaterial.needsUpdate=true}
   if(tool==='pit')m.scale.set(1.76,1.76,1);else m.scale.set(1,1.5,1)
   // The silhouette texture is centred 0.1 m behind the print's middle.
   if(tool==='imprint'){const s=Math.sin(work.yaw),c=Math.cos(work.yaw);m.position.x+=-.05*c-.1*s;m.position.z+=.05*s-.1*c}
  }
  if(tool==='river'&&river.current){
   const key=`${work.x.toFixed(2)},${work.z.toFixed(2)}`
   if(river.current.userData.key!==key){river.current.geometry.dispose();river.current.geometry=ribbon(smoothPath(work),.4,(x,z)=>groundHeightAt(x,z)+.03);river.current.userData.key=key}
   river.current.visible=true
  }
 })
 const castle=useCastleKit(),{ghostMaterial,decalMaterial}=outlineKit()
 return <group name="sand-outline">
  <group ref={ghost} visible={false}><mesh geometry={castle.geometry} material={ghostMaterial}/></group>
  <mesh ref={decal} visible={false} material={decalMaterial} renderOrder={3}><planeGeometry args={[1,1]}/></mesh>
  <mesh ref={river} visible={false} material={ghostMaterial} renderOrder={3}/>
 </group>
}

// ---------- Flying sand while building ----------
const grains=36
let spray:THREE.Material|null=null
const sprayMaterial=()=>spray??=(spray=new THREE.MeshStandardMaterial({color:new THREE.Color(.62,.51,.35),roughness:1}))
function Spray(){
 const ref=useRef<THREE.InstancedMesh>(null),matrix=useMemo(()=>new THREE.Matrix4(),[])
 useFrame(()=>{
  const m=ref.current,b=useSandStore.getState().build,forest=useForestStore.getState()
  if(!m)return
  m.visible=!!b;if(!b)return
  // Grains leave from between the paws and the work, arcing up and out.
  const fx=b.work.x-forest.position.x,fz=b.work.z-forest.position.z,l=Math.hypot(fx,fz)||1,ox=forest.position.x+fx/l*.45,oz=forest.position.z+fz/l*.45,base=sandGroundAt(ox,oz)
  for(let i=0;i<grains;i++){
   const t=(b.elapsed*1.7+i/grains)%1,a=i*2.399,spread=.35*t,x=ox+Math.cos(a)*spread,z=oz+Math.sin(a)*spread,y=base+.05+Math.sin(Math.PI*t)*(.16+(i%5)*.03)
   const s=(1-t)*.9+.1;matrix.makeScale(s,s,s).setPosition(x,y,z);m.setMatrixAt(i,matrix)
  }
  m.instanceMatrix.needsUpdate=true
 })
 return <instancedMesh ref={ref} args={[undefined,sprayMaterial(),grains]} visible={false} frustumCulled={false}><boxGeometry args={[.016,.016,.016]}/></instancedMesh>
}

/** Works, their water, the outline and the spray; keeps the sand texture in step with the store. */
export function SandPlay(){
 const works=useSandStore(s=>s.book.works),build=useSandStore(s=>s.build),day=useForestStore(s=>s.homeBook.nights)
 useEffect(()=>{useSandStore.getState().sync(day)},[day])
 useEffect(()=>{if(!works.length)clearSand();drawWorks(works)},[works])
 useFrame(({clock},delta)=>{
  flowUniform.value+=delta
  const b=useSandStore.getState().build
  if(b)drawBuilding(b.work,buildAmount(b.elapsed))
  fadePrints(clock.elapsedTime)
 })
 return <group name="sand-play">
  {works.map((w,i)=>w.kind==='castle'?<Castle key={i} work={w} amount={1}/>:w.kind==='river'?<River key={i} work={w} amount={1}/>:null)}
  {build?.work.kind==='castle'&&<Castle work={build.work} amount={buildAmount(build.elapsed)}/>}
  {build?.work.kind==='river'&&<River work={build.work} amount={buildAmount(build.elapsed)}/>}
  <Outline/>
  <Spray/>
 </group>
}
