/**
 * Capes and coves for the neighbour islands: each feature is a gaussian bump on the bearing from the island centre,
 * positive pushing the shore out into a point, negative pulling it into a small bay. They act only on the outer rim
 * (from `rimStart` of the normalised radius), so clearings, paths and landmarks inland keep their ground.
 */
export interface CoastFeature{angle:number;width:number;amount:number}
export const rimStart=.6,rimFull=.88

const wrap=(a:number)=>Math.atan2(Math.sin(a),Math.cos(a))
export function featureOffset(features:readonly CoastFeature[],angle:number){
 return features.reduce((sum,f)=>sum+f.amount*Math.exp(-((wrap(angle-f.angle)/f.width)**2)),0)
}
const smooth=(e0:number,e1:number,x:number)=>{const t=Math.min(1,Math.max(0,(x-e0)/(e1-e0)));return t*t*(3-2*t)}
/** Applies the features to a normalised radius: smaller inside a cape (more land), larger inside a cove. */
export function shapeRadius(base:number,angle:number,features:readonly CoastFeature[]){
 return base-smooth(rimStart,rimFull,base)*featureOffset(features,angle)*base
}
/** GLSL twin of shapeRadius, named per island. */
export function shapeGLSL(name:string,features:readonly CoastFeature[]){
 // d*d, not pow(d,2.0): GLSL leaves pow undefined for a negative base
 const terms=features.map(f=>`d=atan(sin(a-(${f.angle.toFixed(3)})),cos(a-(${f.angle.toFixed(3)})))/${f.width.toFixed(3)};s+=${f.amount.toFixed(3)}*exp(-d*d);`).join('')
 return `float ${name}(float base,float a){float s=0.0,d;${terms}return base-smoothstep(${rimStart.toFixed(2)},${rimFull.toFixed(2)},base)*s*base;}\n`
}

/**
 * Cardinal spline through the control points (each one stays on the curve), as short straight segments. Tension 0.5
 * halves the Catmull-Rom tangents, so corners round off without the trail bulging out toward the shore.
 */
export function smoothPath(points:readonly (readonly [number,number])[],closed:boolean,steps=4,tension=.5){
 const n=points.length,at=(i:number)=>points[closed?(i+n)%n:Math.max(0,Math.min(n-1,i))]
 const out:[number,number][]=[]
 for(let i=0;i<(closed?n:n-1);i++){
  const [p0,p1,p2,p3]=[at(i-1),at(i),at(i+1),at(i+2)]
  for(let s=0;s<steps;s++){
   const t=s/steps,t2=t*t,t3=t2*t
   // Hermite form: tangents (p2-p0) and (p3-p1) scaled by the tension
   const h00=2*t3-3*t2+1,h10=t3-2*t2+t,h01=-2*t3+3*t2,h11=t3-t2
   out.push([0,1].map(k=>h00*p1[k]+h10*tension*(p2[k]-p0[k])+h01*p2[k]+h11*tension*(p3[k]-p1[k])) as [number,number])
  }
 }
 out.push([...(closed?points[0]:points[n-1])] as [number,number])
 return out
}
/** Consecutive points as [ax,az,bx,bz] segments. */
export const toSegments=(points:readonly (readonly [number,number])[])=>points.slice(1).map((p,i)=>[points[i][0],points[i][1],p[0],p[1]] as const)
