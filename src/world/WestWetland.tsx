import {useEffect,useMemo} from 'react'
import {useGLTF} from '@react-three/drei'
import * as THREE from 'three'
import {westBoardwalk as deck,westWetland as pool,westWetlandRadius,onWestBoardwalk,westTrailDistance} from './westExpansion'
import {terrainHeight,noiseGLSL} from './terrain'
import {climateUniforms,rainRingsGLSL} from './climateUniforms'

/** Wetland bounding box (pockets plus margin) for the water surface and the reed scatter. */
const marshBox=(()=>{const xs=pool.lobes.flatMap(([x,,rx])=>[x-rx*1.4,x+rx*1.4]),zs=pool.lobes.flatMap(([,z,,rz])=>[z-rz*1.4,z+rz*1.4]);return{minX:Math.min(...xs),maxX:Math.max(...xs),minZ:Math.min(...zs),maxZ:Math.max(...zs)}})()

/**
 * The authored 2.4 m deck module, stretched to each zigzag run and narrowed; posts at every turn and halfway,
 * with a low rail on both sides. Reeds crowd the banks and the hummocks between the pockets.
 */
export function WestWetland(){
 const kit=useGLTF('/assets/expansion/wetland-kit.glb'),coast=useGLTF('/assets/expansion/coastal-kit.glb')
 const props=useMemo(()=>{
  const root=new THREE.Group(),matrix=new THREE.Object3D()
  const instance=(source:THREE.Object3D|undefined,placements:number[][])=>{
   if(!(source instanceof THREE.Mesh))throw new Error('Wetland asset module is missing')
   const mesh=new THREE.InstancedMesh(source.geometry,source.material,placements.length)
   placements.forEach(([x,y,z,yaw,sx,sy=sx,sz=sx],i)=>{matrix.position.set(x,y,z);matrix.rotation.set(0,yaw,0);matrix.scale.set(sx,sy,sz);matrix.updateMatrix();mesh.setMatrixAt(i,matrix.matrix)})
   mesh.name=source.name;mesh.castShadow=true;mesh.receiveShadow=true;mesh.computeBoundingSphere();root.add(mesh)
  }
  const boards:number[][]=[],posts:number[][]=[],rails:number[][]=[],widthScale=deck.halfWidth/.95
  deck.points.slice(1).forEach(([bx,bz],i)=>{
   const [ax,az]=deck.points[i],length=Math.hypot(bx-ax,bz-az),yaw=-Math.atan2(bz-az,bx-ax),count=Math.max(1,Math.round(length/2.4)),step=length/count
   for(let k=0;k<count;k++){const t=(k+.5)/count;boards.push([ax+(bx-ax)*t,deck.y,az+(bz-az)*t,yaw,step/2.4,1,widthScale])}
   // Each run carries its own short rails, stopped well short of the turns so neighbours never cross over the deck;
   // a post at each rail end and one midway.
   const nx=-(bz-az)/length,nz=(bx-ax)/length,edge=deck.halfWidth-.05,trim=Math.min(.75,length*.2)/length
   for(const side of [-1,1]){
    for(const t of [trim,.5,1-trim])posts.push([ax+(bx-ax)*t+nx*edge*side,deck.y+.23,az+(bz-az)*t+nz*edge*side])
    rails.push([(ax+bx)/2+nx*edge*side,deck.y+.48,(az+bz)/2+nz*edge*side,yaw,length*(1-2*trim)+.1])
   }
  })
  // A small square landing at every turn covers the joint between two runs.
  deck.points.slice(1,-1).forEach(([x,z],i)=>{
   const [ax,az]=deck.points[i],[bx,bz]=deck.points[i+2],yaw=-Math.atan2(bz-az,bx-ax)
   boards.push([x,deck.y-.005,z,yaw,deck.halfWidth*2.3/2.4,1,widthScale*1.15])
  })
  instance(kit.scene.getObjectByName('Boardwalk_240'),boards)
  const wood=new THREE.MeshStandardMaterial({color:'#5b4430',roughness:.88})
  const post=new THREE.InstancedMesh(new THREE.BoxGeometry(.11,.95,.11),wood,posts.length)
  posts.forEach(([x,y,z],i)=>{matrix.position.set(x,y-.22,z);matrix.rotation.set(0,0,0);matrix.scale.setScalar(1);matrix.updateMatrix();post.setMatrixAt(i,matrix.matrix)})
  const rail=new THREE.InstancedMesh(new THREE.BoxGeometry(1,.07,.07),wood,rails.length)
  rails.forEach(([x,y,z,yaw,length],i)=>{matrix.position.set(x,y,z);matrix.rotation.set(0,yaw,0);matrix.scale.set(length,1,1);matrix.updateMatrix();rail.setMatrixAt(i,matrix.matrix)})
  for(const mesh of [post,rail]){mesh.name=mesh===post?'boardwalk-posts':'boardwalk-rails';mesh.castShadow=true;mesh.receiveShadow=true;mesh.computeBoundingSphere();root.add(mesh)}
  // Reeds on the banks and the hummocks between pockets; a few cobbles at the waterline. A fixed hashed scatter.
  const reeds:number[][]=[],stones:number[][]=[]
  for(let i=0;i<900;i++){
   const hx=Math.sin(i*12.9898)*43758.5453,hz=Math.sin(i*78.233)*43758.5453,fx=hx-Math.floor(hx),fz=hz-Math.floor(hz)
   const x=marshBox.minX+(marshBox.maxX-marshBox.minX)*fx,z=marshBox.minZ+(marshBox.maxZ-marshBox.minZ)*fz
   if(onWestBoardwalk(x,z,-.45)||westTrailDistance(x,z)<1.4)continue
   const edge=westWetlandRadius(x,z),y=terrainHeight(x,z)
   if(edge<.88||edge>1.3)continue
   if(i%6===0)stones.push([x,y-.055,z,fx*6.28,.2+fz*.12])
   else if(i%3!==1)reeds.push([x,y-.05,z,fz*6.28,.5+fx*.45])
  }
  instance(kit.scene.getObjectByName('Rush_Clump'),reeds)
  instance(coast.scene.getObjectByName('Rock_Cobbles'),stones)
  root.userData.qa={modules:boards.length,posts:posts.length,rails:rails.length,reeds:reeds.length,cobbleClusters:stones.length,deckTop:deck.y,clearWidth:deck.halfWidth*2,decimated:false}
  return root
 },[kit.scene,coast.scene])
 const water=useMemo(()=>{
  const w=marshBox.maxX-marshBox.minX,d=marshBox.maxZ-marshBox.minZ
  const g=new THREE.PlaneGeometry(w,d,Math.ceil(w*6),Math.ceil(d*6));g.rotateX(-Math.PI/2);g.translate((marshBox.minX+marshBox.maxX)/2,pool.waterY,(marshBox.minZ+marshBox.maxZ)/2)
  const positions=g.getAttribute('position'),depth=new Float32Array(positions.count)
  for(let i=0;i<positions.count;i++){
   const x=positions.getX(i),z=positions.getZ(i)
   // Coastal ground also lies below this freshwater level; only the basin may receive water.
   depth[i]=westWetlandRadius(x,z)<1.25?pool.waterY-terrainHeight(x,z):-1
  }
  g.setAttribute('waterDepth',new THREE.BufferAttribute(depth,1))
  return g
 },[])
 useEffect(()=>()=>{water.dispose();props.traverse(o=>{if(o instanceof THREE.InstancedMesh)o.dispose()})},[water,props])
 return <group name="west-wetland">
  <primitive object={props} dispose={null}/>
  <mesh name="wetland-water" geometry={water} receiveShadow renderOrder={1}>
   <meshPhysicalMaterial color="#355d53" roughness={.32} metalness={0} specularIntensity={.35} envMapIntensity={.6} transparent depthWrite={false}
    onBeforeCompile={shader=>{
     Object.assign(shader.uniforms,{climateTime:climateUniforms.climateTime,climateRain:climateUniforms.climateRain})
     shader.vertexShader='attribute float waterDepth;varying float vDepth;varying vec3 vMarsh;\n'+shader.vertexShader
     shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvDepth=waterDepth;vMarsh=position;')
     shader.fragmentShader=`varying float vDepth;varying vec3 vMarsh;uniform float climateTime;\n${noiseGLSL}\n${rainRingsGLSL}\n`+shader.fragmentShader
     shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',/* glsl */`
      #include <color_fragment>
      if(vDepth<=.004)discard;
      vec2 p=vMarsh.xz;
      float shallow=1.0-smoothstep(.02,.29,vDepth);
      diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.21,.24,.115),shallow*.65);
      diffuseColor.rgb*=.94+.06*noise21(p*2.2);
      diffuseColor.a=smoothstep(.004,.075,vDepth)*.91;
      if(climateRain>.01)diffuseColor.rgb+=rainRings(p,climateTime).x*climateRain*vec3(.16,.18,.16);
     `)
     shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',/* glsl */`
      #include <normal_fragment_maps>
      vec2 q=vMarsh.xz*.9+climateTime*vec2(.055,-.035);
      float h=noise21(q);
      vec2 slope=vec2(noise21(q+vec2(.07,0.0))-h,noise21(q+vec2(0.0,.07))-h)*.55;
      if(climateRain>.01)slope+=rainRings(vMarsh.xz,climateTime).yz*climateRain*.16;
      normal=normalize((viewMatrix*vec4(-slope.x,1.0,-slope.y,0.0)).xyz);
     `)
    }}/>
  </mesh>
 </group>
}
