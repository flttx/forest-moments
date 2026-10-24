import assert from 'node:assert/strict'
export async function runOrbitCases({cmd,evaluate,snapshot,shot,sleep,report}){
 const state=async value=>evaluate(`(async()=>{const {useForestStore:s}=await import(performance.getEntriesByType('resource').find(e=>new URL(e.name).pathname==='/src/game/store.ts').name);s.setState(${JSON.stringify(value)})})()`)
 const mouse=(type,x,y,buttons=0,button='none')=>cmd('Input.dispatchMouseEvent',{type,x,y,buttons,button,...(type==='mousePressed'||type==='mouseReleased'?{clickCount:1}:{})})
 const drag=async(dx,dy)=>{
  await mouse('mouseMoved',700,450);await mouse('mousePressed',700,450,2,'right')
  await mouse('mouseMoved',700+dx,450+dy,2,'right');await mouse('mouseReleased',700+dx,450+dy,0,'right');await sleep(1000)
 }
 const boxes=await evaluate("(async()=>{const m=await import('/src/game/followCamera.ts');return m.indoorCameraBoxes})()")
 for(const [i,p] of [{x:0,z:2.3},{x:2.8,z:1.2},{x:-2.8,z:1.2}].entries()){
  await state({location:'workshop',position:p,mode:'walking',workshopBook:{version:1,phase:'finished'}})
  for(const [label,dy,zoom] of [['low',2000,300],['high',-2000,-300]]){
   await drag(600,dy)
   for(let j=0;j<8;j++)await cmd('Input.dispatchMouseEvent',{type:'mouseWheel',x:700,y:450,deltaX:0,deltaY:zoom})
   await sleep(1000);const q=await snapshot(),[x,y,z]=q.cameraPosition
   assert(q.cameraPosition.every(Number.isFinite));assert(Math.abs(x)<=3.72&&Math.abs(z)<=2.72&&y<=3.05)
   assert(!boxes.some(b=>x>b.minX&&x<b.maxX&&y>b.minY&&y<b.maxY&&z>b.minZ&&z<b.maxZ),'camera must not enter a wall/fixture')
   const name=`wall-${i}-${label}`;await shot(name);report.checks.push({name,data:q});console.log('PASS '+name)
  }
 }
 await state({location:'island',position:{x:0,z:0},mode:'walking'});await sleep(800)
 await drag(850,0);const released=await snapshot();assert.equal(released.orbitDragging,false)
 await mouse('mouseMoved',900,450);await sleep(200);const still=await snapshot();assert.equal(still.orbit.targetYaw,released.orbit.targetYaw)
 await mouse('mousePressed',700,450,2,'right');await mouse('mouseMoved',800,450,2,'right')
 await evaluate("(()=>{const c=document.querySelector('canvas');c.dispatchEvent(new PointerEvent('pointercancel',{pointerId:1}))})()");await sleep(100)
 const cancelled=await snapshot();assert.equal(cancelled.orbitDragging,false,'pointercancel alone releases drag');await mouse('mouseReleased',800,450,0,'right');await sleep(100)
 assert.equal((await snapshot()).orbitDragging,false);await shot('outside-release-and-cancel')
 report.checks.push({name:'release outside viewport and pointercancel clear drag',data:{released,still,cancelled}})
}
