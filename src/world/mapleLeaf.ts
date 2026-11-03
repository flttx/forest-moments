import * as THREE from 'three'

/**
 * A maple leaf outline in the xy plane, stem notch at -y: five broad lobes with pointed tips, the two lower ones
 * smaller, and fine teeth along the edge. `size` is the top lobe's tip radius.
 */
export function mapleLeafShape(size:number){
 const shape=new THREE.Shape(),steps=150
 for(let i=0;i<=steps;i++){
  const a=i/steps*Math.PI*2,u=a*5/(Math.PI*2)
  // 1 at a lobe tip (every 72° from the top), 0 in the sinus between; a power under 1 keeps the lobes full, the tips sharp
  const lobe=Math.pow(1-2*Math.abs(u-Math.round(u)),.7),teeth=1-2*Math.abs(u*4-Math.round(u*4))
  const lower=Math.cos(a)<-.5?.62:1
  const r=size*(.38+.62*lobe*lower+.07*teeth*lobe)
  const [x,y]=[Math.cos(a+Math.PI/2)*r,Math.sin(a+Math.PI/2)*r]
  if(i)shape.lineTo(x,y);else shape.moveTo(x,y)
 }
 return shape
}
