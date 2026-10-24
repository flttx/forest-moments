/** Recomputed every frame from the independent, smoothed orbit heading, as in my-blog.
 * Walking never turns that heading, so side movement cannot feed back into itself.
 */
export function cameraRelativeMovement(inputX:number,inputZ:number,heading:number){
 const length=Math.hypot(inputX,inputZ)
 if(!Number.isFinite(length)||!Number.isFinite(heading)||length===0)return null
 const x=inputX/length,z=inputZ/length,c=Math.cos(heading),s=Math.sin(heading)
 return{inputX,inputZ,x:x*c+z*s,z:-x*s+z*c}
}
