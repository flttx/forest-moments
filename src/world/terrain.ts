import {creekDistance,creekWaterY} from '../game/expansion'
import { MathUtils } from 'three'
import {modelAssets,workshopSize,workshopPathOffset} from './assets'
import {islandShape,workshopPosition,lookoutPosition,landformHeight} from './worldConfig'
import {pondEdgeDistance,pondDepth,pondBankWidth} from './pondShape'
export {seaLevel,islandShape,coastRadius,shoreWaterFraction} from './worldConfig'
export function terrainHeight(x:number,z:number) {
  const basin=1-MathUtils.smoothstep(pondEdgeDistance(x,z),-pondBankWidth,0)
  const base=landformHeight(x,z)-pondDepth*basin+pathRelief(x,z)
  const creek=1-MathUtils.smoothstep(creekDistance(x,z),.75,2.2)
  return base*(1-creek)+(creekWaterY(x)-.42)*creek

}
export const highlandPaths=[[-1.7,-14,-14,-15],[-14,-15,-14,-24.5],[13,1.7,20,-12],[20,-12,23,-20],[23,-20,15.45,-27.65],[-14,-24.5,-9,-24],[-9,-24,-8,-28],[-8,-28,6,-29],[6,-29,10,-30],[10,-30,17,-30],[17,-30,15.45,-27.65],[-14,-11,-29,-10],[20,1,30.5,-8],[30.5,-8,30.5,-12],[30.5,-12,29.7,-12]] as const
export function segmentDistance(x:number,z:number,ax:number,az:number,bx:number,bz:number){const dx=bx-ax,dz=bz-az,t=Math.max(0,Math.min(1,((x-ax)*dx+(z-az)*dz)/(dx*dx+dz*dz)));return Math.hypot(x-ax-t*dx,z-az-t*dz)}
export function loopRadius(angle:number){return islandShape.loopRadius+.65*Math.sin(angle*3+.3)}
export function workshopPathZ(x:number,offset=workshopPathOffset){return 10.8+Math.sin(x*.35)*.6+offset*(1-MathUtils.smoothstep(x,-8,-5))}
export function pathDistance(x:number,z:number,workshopOffset=workshopPathOffset) {
  const main=Math.abs(x+1.7-Math.sin(z*.23)*1.15)
  const wx=MathUtils.clamp(x,-12,-1.5),ex=MathUtils.clamp(x,-1.7,23),tz=MathUtils.clamp(z,-4.7,1.7)
  const workshop=Math.hypot(x-wx,z-workshopPathZ(wx,workshopOffset))
  const eastZ=1.4*(1-MathUtils.smoothstep(ex,12,23))-Math.sin(ex*.4)*.55*(1-MathUtils.smoothstep(ex,16,23))
  const east=Math.hypot(x-ex,z-eastZ)
  const tower=Math.hypot(x-13,z-tz)
  const highland=highlandPaths.reduce((d,[ax,az,bx,bz])=>Math.min(d,segmentDistance(x,z,ax,az,bx,bz)),Infinity)
  const bedroom=Math.hypot(x+14,z-MathUtils.clamp(z,-24.5,-15))
  const camp=Math.hypot(x-MathUtils.clamp(x,0,20),z-23)
  const coastTrail=Math.hypot(x-MathUtils.clamp(x,20,35),z)
  const loop=Math.abs(Math.hypot(x,z)-loopRadius(Math.atan2(z,x)))
  return Math.min(main,workshop,east,tower,loop,bedroom,camp,coastTrail,highland)
}
export function groundNoise(x:number,z:number) {
  const hash=(a:number,b:number)=>{const n=Math.sin(a*127.1+b*311.7)*43758.5453;return n-Math.floor(n)}
  const ix=Math.floor(x),iz=Math.floor(z),fx=x-ix,fz=z-iz,u=fx*fx*(3-2*fx),v=fz*fz*(3-2*fz)
  return MathUtils.lerp(MathUtils.lerp(hash(ix,iz),hash(ix+1,iz),u),MathUtils.lerp(hash(ix,iz+1),hash(ix+1,iz+1),u),v)
}
/** Shared worn verge, in metres: negative is dirt, positive is the grassy shoulder. */
export function pathEdgeDistance(x:number,z:number) {
  const width=.78+.17*Math.sin(x*.53+z*.37)+.14*(groundNoise(x*.7+4,z*.7)-.5)
  return pathDistance(x,z)-width+(groundNoise(x*3.1,z*3.1)-.5)*.28+(groundNoise(x*9.7,z*9.7)-.5)*.10
}
/** Small real undulations, faded out at foundations, interaction pads and the shore. */
export function pathRelief(x:number,z:number) {
  const track=pathDistance(x,z)
  if(track>=1.45||Math.hypot(x,z)>=23)return 0
  let pad=1
  for(const [px,pz,r] of [[0,0,1.2],[workshopPosition[0],workshopPosition[2],Math.hypot(workshopSize.halfX,workshopSize.halfZ)*modelAssets.workshop.scale+.6],[lookoutPosition[0],lookoutPosition[2],3.7],[8,6,4.8],[6,-5,5.3],[23,0,3],[0,8,1.4]])
    pad*=MathUtils.smoothstep(Math.hypot(x-px,z-pz),r,r+.8)
  const envelope=(1-MathUtils.smoothstep(track,.7,1.45))*(1-MathUtils.smoothstep(Math.hypot(x,z),22,23))*pad
  if(envelope===0)return 0
  return envelope*(.075*Math.sin(x*.91+z*.37)*Math.cos(z*.72-x*.21)+.025*Math.sin(x*2.1-z*1.6)-.025*Math.exp(-track*track*5))
}
export const noiseGLSL=/* glsl */ `
float hash21(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise21(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(hash21(i),hash21(i+vec2(1,0)),f.x),mix(hash21(i+vec2(0,1)),hash21(i+1.0),f.x),f.y);}
float coastAt(vec2 p){float a=atan(p.y,p.x);return ${islandShape.coastRadius.toFixed(1)}+.85*sin(a*3.0+.4)+.55*sin(a*5.0-.8)+.25*cos(a*9.0);}
`
export const pathGLSL=/* glsl */ `
float segDist(vec2 p,vec2 a,vec2 b){vec2 d=b-a;float t=clamp(dot(p-a,d)/dot(d,d),0.0,1.0);return length(p-a-t*d);}
float pathAt(vec2 p){
 float track=abs(p.x+1.7-sin(p.y*.23)*1.15);
 float wx=clamp(p.x,-12.0,-1.5),ex=clamp(p.x,-1.7,23.0),tz=clamp(p.y,-4.7,1.7);
 track=min(track,length(vec2(p.x-wx,p.y-10.8-sin(wx*.35)*.6-${workshopPathOffset.toFixed(8)}*(1.0-smoothstep(-8.0,-5.0,wx)))));
 float eastZ=1.4*(1.0-smoothstep(12.0,23.0,ex))-sin(ex*.4)*.55*(1.0-smoothstep(16.0,23.0,ex));
 track=min(track,length(vec2(p.x-ex,p.y-eastZ)));
 track=min(track,length(vec2(p.x-13.0,p.y-tz)));
 track=min(track,length(vec2(p.x+14.0,p.y-clamp(p.y,-24.5,-15.0))));
 track=min(track,length(vec2(p.x-clamp(p.x,0.0,20.0),p.y-23.0)));
 track=min(track,length(vec2(p.x-clamp(p.x,20.0,35.0),p.y)));
 ${highlandPaths.map(([ax,az,bx,bz])=>`track=min(track,segDist(p,vec2(${ax.toFixed(4)},${az.toFixed(4)}),vec2(${bx.toFixed(4)},${bz.toFixed(4)})));`).join('\n')}
 return min(track,abs(length(p)-(${islandShape.loopRadius.toFixed(1)}+.65*sin(atan(p.y,p.x)*3.0+.3))));
}
float pathEdgeAt(vec2 p){
 float width=.78+.17*sin(p.x*.53+p.y*.37)+.14*(noise21(p*.7+vec2(4.0,0.0))-.5);
 return pathAt(p)-width+(noise21(p*3.1)-.5)*.28+(noise21(p*9.7)-.5)*.10;
}
`
export const groundColourGLSL=/* glsl */ `
vec3 groundColour(vec2 p){
 float broad=noise21(p*.38),fleck=noise21(p*14.0);
 return mix(vec3(.105,.175,.065),vec3(.29,.36,.13),broad)*(.92+fleck*.16);
}
`
