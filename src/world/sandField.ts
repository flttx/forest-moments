import * as THREE from 'three'
import {useSandStore} from '../game/sandStore'
import {buildSeconds,inSandRect,pawDepth,printLifetime,sandOffsetAt,sandRect,sandSize,sandTexel,workExtent,workHeight,type SandWork} from '../game/sand'
import {groundHeightAt} from '../game/movement'

/**
 * The south beach's deformable sand (docs/BEACH_SANDPLAY_PLAN.md S1–S3). One half-float RGBA texture over `sandRect`:
 * R is what the works dug or heaped (it moves the terrain's vertices), G the paw prints (shading only, they fade).
 * Writes touch only the rows they change.
 */
const {w:W,h:H}=sandSize
const texels=new Uint16Array(W*H*4)
const baseStatic=new Float32Array(W*H),prints=new Float32Array(W*H)
export const sandTexture=new THREE.DataTexture(texels,W,H,THREE.RGBAFormat,THREE.HalfFloatType)
sandTexture.magFilter=sandTexture.minFilter=THREE.LinearFilter
sandTexture.needsUpdate=true
export const sandUniforms={sandMap:{value:sandTexture}}
/** Declarations for both shader stages of the terrain. */
export const sandGLSL=/* glsl */`
uniform sampler2D sandMap;
const vec4 sandBounds=vec4(${sandRect.minX.toFixed(2)},${sandRect.minZ.toFixed(2)},${sandRect.maxX.toFixed(2)},${sandRect.maxZ.toFixed(2)});
vec2 sandUv(vec2 p){return (p-sandBounds.xy)/(sandBounds.zw-sandBounds.xy);}
bool inSand(vec2 p){return p.x>sandBounds.x&&p.x<sandBounds.z&&p.y>sandBounds.y&&p.y<sandBounds.w;}
float sandDug(vec2 p){return inSand(p)?texture2D(sandMap,sandUv(p)).r:0.0;}
float sandRelief(vec2 p){if(!inSand(p))return 0.0;vec4 s=texture2D(sandMap,sandUv(p));return s.r-s.g;}
float sandPrint(vec2 p){return inSand(p)?texture2D(sandMap,sandUv(p)).g:0.0;}
`

const half=THREE.DataUtils.toHalfFloat
const column=(x:number)=>Math.floor((x-sandRect.minX)/sandTexel)
const row=(z:number)=>Math.floor((z-sandRect.minZ)/sandTexel)
type Box={i0:number;i1:number;j0:number;j1:number}
const boxAround=(x:number,z:number,r:number):Box=>({i0:Math.max(0,column(x-r)),i1:Math.min(W-1,column(x+r)),j0:Math.max(0,row(z-r)),j1:Math.min(H-1,row(z+r))})
function upload(b:Box,value:(k:number,x:number,z:number)=>void){
 for(let j=b.j0;j<=b.j1;j++){
  const z=sandRect.minZ+(j+.5)*sandTexel
  for(let i=b.i0;i<=b.i1;i++)value(j*W+i,sandRect.minX+(i+.5)*sandTexel,z)
  sandTexture.addUpdateRange((j*W+b.i0)*4,(b.i1-b.i0+1)*4)
 }
 sandTexture.needsUpdate=true
}
const writeR=(k:number,v:number)=>{texels[k*4]=half(v)}
const writeG=(k:number,v:number)=>{texels[k*4+1]=half(v)}

/** Finished works into the static layer, then into the texture; everything when the list changes. */
export function drawWorks(works:readonly SandWork[]){
 baseStatic.fill(0)
 for(const w of works){
  const b=boxAround(w.x,w.z,workExtent(w))
  for(let j=b.j0;j<=b.j1;j++){const z=sandRect.minZ+(j+.5)*sandTexel;for(let i=b.i0;i<=b.i1;i++){const x=sandRect.minX+(i+.5)*sandTexel;baseStatic[j*W+i]+=workHeight(w,x,z)}}
 }
 upload({i0:0,i1:W-1,j0:0,j1:H-1},k=>writeR(k,baseStatic[k]))
}
/** The work going up, at `amount`, over what is already there. */
export function drawBuilding(w:SandWork,amount:number){
 upload(boxAround(w.x,w.z,workExtent(w)),(k,x,z)=>writeR(k,baseStatic[k]+workHeight(w,x,z,amount)))
}

type Print={x:number;z:number;yaw:number;left:boolean;born:number;fade:number}
let pressed:Print[]=[]
let lastFade=0
const printFade=(age:number)=>1-Math.max(0,Math.min(1,(age-printLifetime*.55)/(printLifetime*.45)))
function drawPrints(x:number,z:number){
 const near=pressed.filter(p=>Math.hypot(p.x-x,p.z-z)<.34)
 upload(boxAround(x,z,.16),(k,tx,tz)=>{
  let d=0
  for(const p of near){const dx=tx-p.x,dz=tz-p.z,s=Math.sin(p.yaw),c=Math.cos(p.yaw);d=Math.max(d,pawDepth(dx*c-dz*s,dx*s+dz*c,p.left)*p.fade)}
  prints[k]=d;writeG(k,d)
 })
}
/** Press a paw print; the oldest go once there are too many. */
export function pressPaw(p:{x:number;z:number;yaw:number;left:boolean},now:number){
 if(!inSandRect(p.x,p.z,.1))return
 pressed.push({...p,born:now,fade:1})
 if(pressed.length>120){const old=pressed.shift()!;drawPrints(old.x,old.z)}
 drawPrints(p.x,p.z)
}
export function clearSand(){
 pressed=[];prints.fill(0);texels.fill(0);baseStatic.fill(0)
 sandTexture.clearUpdateRanges();sandTexture.needsUpdate=true
}

/** What the raccoon stands on: the island plus whatever is dug or heaped there now. */
export function sandGroundAt(x:number,z:number){
 const s=useSandStore.getState(),b=s.build
 const works=b?[...s.book.works,b.work]:s.book.works
 return groundHeightAt(x,z)+sandOffsetAt(works,x,z,b?[...s.book.works.map(()=>1),buildAmount(b.elapsed)]:undefined)
}
export const buildAmount=(elapsed:number)=>{const t=Math.min(1,elapsed/buildSeconds);return t*t*(3-2*t)}

/** Prints soften twice a second rather than every frame. */
export function fadePrints(now:number){
 if(now-lastFade<.5||!pressed.length)return
 lastFade=now
 const fading=pressed.filter(p=>{const f=printFade(now-p.born),changed=Math.abs(f-p.fade)>.02||(f===0&&p.fade>0);p.fade=f;return changed})
 pressed=pressed.filter(p=>p.fade>0)
 for(const p of fading)drawPrints(p.x,p.z)
}
