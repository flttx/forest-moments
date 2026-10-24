import {pond} from './worldConfig'

export const pondDepth=.7
export const pondBankWidth=.65
/** Anchor the west bank at the established fishing spot, vary the remaining shoreline. */
export function pondRadiusAt(angle:number){
  const weight=(1+Math.cos(angle))*.5
  return pond.radius+weight*(.45*Math.sin(angle*2+.6)+.28*Math.cos(angle*3-.3)+.16*Math.sin(angle*5+1.2))
}
/** Negative inside the basin; rendering and walking share this radial contour. */
export function pondEdgeDistance(x:number,z:number){
  const dx=x-pond.x,dz=z-pond.z
  return Math.hypot(dx,dz)-pondRadiusAt(Math.atan2(dz,dx))
}
let low=0,high=1
for(let i=0;i<30;i++){const t=(low+high)/2;if(t*t*(3-2*t)<1+pond.waterY/pondDepth)low=t;else high=t}
export const pondWaterInset=pondBankWidth*(1-(low+high)/2)
export const pondGLSL=/* glsl */ `
float pondEdgeAt(vec2 p){
 vec2 q=p-vec2(${pond.x.toFixed(1)},${pond.z.toFixed(1)});
 float a=atan(q.y,q.x),w=(1.0+cos(a))*.5;
 float r=${pond.radius.toFixed(2)}+w*(.45*sin(a*2.0+.6)+.28*cos(a*3.0-.3)+.16*sin(a*5.0+1.2));
 return length(q)-r;
}
`
