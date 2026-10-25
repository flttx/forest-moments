/** One deliberate forward shaving pass, lifted slightly on the return. */
export function woodworkPose(stroke:number){
 const t=Math.max(0,Math.min(1,(.95-stroke)/.95)),active=stroke>0
 const push=active?Math.sin(Math.min(t/.72,1)*Math.PI/2):0
 return{x:-.6,y:.475+(active&&t>.72?Math.sin((t-.72)/.28*Math.PI)*.045:0),z:-1.35-push*.22,contact:active&&t>.12&&t<.72}
}
