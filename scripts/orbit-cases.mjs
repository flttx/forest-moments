import assert from 'node:assert/strict'

export async function runOrbitCases({cmd,evaluate,snapshot,key,shot,sleep,wait,report}){
 const angle=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b))
 const state=async value=>evaluate(`(async()=>{const {useForestStore:s}=await import(performance.getEntriesByType('resource').find(e=>new URL(e.name).pathname==='/src/game/store.ts').name);s.setState(${JSON.stringify(value)})})()`)
 const frames=ms=>evaluate(`new Promise(resolve=>{let last=performance.now(),elapsed=0;function frame(t){elapsed+=Math.min(t-last,50);last=t;if(elapsed>=${ms})resolve();else requestAnimationFrame(frame)}requestAnimationFrame(frame)})`)
 const hold=async(k,ms)=>{await key(k,true);await frames(ms);await key(k,false)}
 const mouse=(type,x,y,buttons=0,button='none')=>cmd('Input.dispatchMouseEvent',{type,x,y,buttons,button,...(type==='mousePressed'||type==='mouseReleased'?{clickCount:1}:{})})
 const drag=async(dx,dy)=>{
  await mouse('mouseMoved',700,450);await mouse('mousePressed',700,450,2,'right')
  for(let i=1;i<=10;i++){await mouse('mouseMoved',700+dx*i/10,450+dy*i/10,2,'right');await sleep(16)}
  await mouse('mouseReleased',700+dx,450+dy,0,'right')
 }
 const check=(name,data)=>{report.checks.push({name,data});console.log('PASS '+name)}
 const reset=async(light='day',room='island')=>{
  await cmd('Page.navigate',{url:`http://127.0.0.1:5176/?qa&light=${light}`});await sleep(300)
  await wait(s=>s?.ready&&s.workshopReady,'assets')
  await state({location:room,position:{x:0,z:0},mode:'walking',workshopBook:{version:1,phase:'finished'},inspectingTree:false})
  await sleep(1200)
 }
 const direction=q=>[-Math.sin(q.orbit.yaw),-Math.cos(q.orbit.yaw)]
 for(const light of ['day','dusk','night'])for(const room of ['island','workshop']){
  await reset(light,room);const before=await snapshot();await shot(`${light}-${room}-initial`)
  await mouse('mouseMoved',700,450);await mouse('mousePressed',700,450,2,'right')
  const down=await snapshot();assert(Math.abs(angle(down.orbit.targetYaw,before.orbit.yaw))<.001,'press does not jump')
  await mouse('mouseReleased',700,450,0,'right');await drag(250,-100);await sleep(1200)
  const rotated=await snapshot();assert(Math.abs(angle(rotated.orbit.yaw,before.orbit.yaw)-1)<.01);assert(Math.abs(rotated.orbit.pitch-before.orbit.pitch-.3)<.01)
  assert(Math.hypot(rotated.position[0]-before.position[0],rotated.position[2]-before.position[2])<.001)
  assert.equal(rotated.orbitDragging,false);await shot(`${light}-${room}-orbit`)
  const results=[]
  for(const [button,x,z] of [['w',0,-1],['a',-1,0],['s',0,1],['d',1,0]]){
   await state({position:{x:0,z:0}});await sleep(300);const start=await snapshot(),f=direction(start),expected=[-f[1]*x-f[0]*z,f[0]*x-f[1]*z]
   await hold(button,350);const end=await snapshot(),v=[end.position[0]-start.position[0],end.position[2]-start.position[2]],distance=Math.hypot(...v),alignment=(v[0]*expected[0]+v[1]*expected[1])/distance
   assert(distance>.3);assert(alignment>.99,button+' camera-relative alignment');assert(Math.abs(angle(end.orbit.yaw,start.orbit.yaw))<.001,'Walking does not rotate camera')
   results.push({button,start,end,alignment})
  }
  await hold('w',350);await shot(`${light}-${room}-d-then-w`)
  check(`${light} ${room}: right drag and four camera-relative directions`,{before,rotated,results})
 }
 await reset();const initial=await snapshot()
 await mouse('mouseMoved',900,300);await sleep(100);assert.equal((await snapshot()).orbit.targetYaw,initial.orbit.targetYaw)
 await mouse('mousePressed',700,450,1,'left');await mouse('mouseMoved',900,400,1,'left');await mouse('mouseReleased',900,400,0,'left')
 assert.equal((await snapshot()).orbit.targetYaw,initial.orbit.targetYaw)
 await key('w',true);await drag(250,0);await frames(500);const turning=await snapshot();await key('w',false)
 const f=direction(turning);assert(turning.inputDirection.x*f[0]+turning.inputDirection.z*f[1]>.999,'Held W adopts mouse heading immediately')
 await shot('held-w-drag');check('mouse steers held W; unpressed and left-button motion ignored',{initial,turning})
 await reset();const start=await snapshot();await hold('d',3000);const end=await snapshot(),f0=direction(start),v=[end.position[0]-start.position[0],end.position[2]-start.position[2]]
 assert(Math.hypot(...v)>3.1);assert(Math.abs(v[0]*f0[0]+v[1]*f0[1])<.02);assert(Math.abs(angle(end.orbit.yaw,start.orbit.yaw))<.001)
 await shot('long-d-straight');check('held D remains straight without automatic orbit feedback',{start,end})
 // Relative to the reset heading, so the case does not depend on the spawn camera yaw.
 await reset();const home=await snapshot();await hold('q',350);const q=await snapshot();await hold('e',350);await sleep(700);const e=await snapshot()
 assert(angle(q.orbit.yaw,home.orbit.yaw)>.3);assert(Math.abs(angle(e.orbit.yaw,home.orbit.yaw))<.1);check('Q/E orbit keyboard alternative',{q,e})
 await drag(0,-2000);await sleep(600);const high=await snapshot();assert(Math.abs(high.orbit.pitch-Math.PI*.36)<.01);await shot('high-pitch')
 await drag(0,2000);await sleep(600);const low=await snapshot();assert(Math.abs(low.orbit.pitch-Math.PI/18)<.01);await shot('low-pitch')
 const wheel=dy=>cmd('Input.dispatchMouseEvent',{type:'mouseWheel',x:700,y:450,deltaX:0,deltaY:dy})
 for(let i=0;i<8;i++)await wheel(300);await sleep(900);const far=await snapshot();assert(Math.abs(far.orbit.zoom-1.6)<.01)
 for(let i=0;i<8;i++)await wheel(-300);await sleep(900);const near=await snapshot();assert(Math.abs(near.orbit.zoom-.55)<.01);await shot('near-zoom');check('pitch and wheel limits',{high,low,far,near})
 await mouse('mousePressed',700,450,2,'right');await mouse('mouseMoved',800,450,2,'right');await key('w',true)
 await evaluate("window.dispatchEvent(new Event('blur'))");await sleep(100);const stopped=await snapshot();await mouse('mouseMoved',950,350,2,'right');await sleep(500);const still=await snapshot()
 await key('w',false);await mouse('mouseReleased',950,350,0,'right');assert.equal(still.orbitDragging,false);assert.equal(still.orbit.targetYaw,stopped.orbit.targetYaw);assert(Math.hypot(still.position[0]-stopped.position[0],still.position[2]-stopped.position[2])<.02)
 check('blur releases both pointer capture and movement',{stopped,still})
 await reset('day','workshop');await state({mode:'crafting'});await sleep(100);const locked=await snapshot();await drag(150,-100);const afterLocked=await snapshot();assert.equal(afterLocked.orbit.targetYaw,locked.orbit.targetYaw)
 await key('Escape',true);await key('Escape',false);await wait(s=>s.mode==='walking','cancel crafting');await drag(150,0);await sleep(700);const unlocked=await snapshot();assert(Math.abs(angle(unlocked.orbit.yaw,locked.orbit.yaw))>.5);await shot('interaction-return');check('dedicated interaction locks orbit and cancellation restores input',{locked,afterLocked,unlocked})
 await reset();await state({mode:'rowing',boat:{x:30.6,z:2.15,heading:0,speed:0,phase:0,effort:0}});await sleep(1800)
 const boatBefore=await snapshot();await drag(180,-50);await sleep(250);const boatAfter=await snapshot();assert(Math.abs(angle(boatAfter.orbit.yaw,boatBefore.orbit.yaw))>.45);await shot('boat-orbit');check('boat supports manual orbit while keeping rowing input',{boatBefore,boatAfter})
 await reset();await state({mode:'lookout'});const towerBefore=await snapshot();await drag(150,40);const towerAfter=await snapshot();assert(Math.abs(angle(towerAfter.lookoutView.yaw,towerBefore.lookoutView.yaw))>.5);await shot('lookout-mouse');check('lookout supports right-drag gaze',{towerBefore,towerAfter})
}
