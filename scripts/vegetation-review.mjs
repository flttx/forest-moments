import * as THREE from 'three'
import {transformedGeometry} from '/src/world/transformedGeometry.ts'
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js'
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js'
const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder)
const manifest=await(await fetch('/docs/evidence/vegetation-expansion/2026-10-24/asset-manifest.json')).json()
const kit=new URLSearchParams(location.search).get('kit')??'normal-pine-b'
const night=new URLSearchParams(location.search).has('night')
const [original,derived]=await Promise.all([loader.loadAsync('/assets/vegetation/source-forest-island-ecology-v3.glb'),loader.loadAsync('/assets/vegetation/forest-kit.glb')])
const a=original.scene.getObjectByName('Eco_'+kit),b=derived.scene.getObjectByName('Eco_'+kit)
derived.scene.updateMatrixWorld(true)
const frame=manifest.templates[kit].frame
const matrix=new THREE.Matrix4().compose(new THREE.Vector3(...frame.center),new THREE.Quaternion(),new THREE.Vector3().setScalar(frame.half))
const ga=transformedGeometry(a.geometry,matrix),gb=transformedGeometry(b.geometry,b.matrixWorld)
let maxError=0
for(let i=0;i<ga.attributes.position.count;i++)for(let j=0;j<3;j++)maxError=Math.max(maxError,Math.abs(ga.attributes.position.getComponent(i,j)-gb.attributes.position.getComponent(i,j)))
if(maxError>.00001)throw Error('Template changed')
const mask=kit==='lantern'?await new THREE.TextureLoader().loadAsync('/assets/vegetation/lantern-glow.webp'):null
if(mask){mask.flipY=false;mask.colorSpace=THREE.NoColorSpace}
const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(1);renderer.setScissorTest(true);renderer.shadowMap.enabled=true;renderer.toneMapping=THREE.ACESFilmicToneMapping;document.body.appendChild(renderer.domElement)
const box=new THREE.Box3().setFromBufferAttribute(gb.attributes.position),height=box.max.y-box.min.y
const camera=new THREE.PerspectiveCamera(38,innerWidth/2/innerHeight,.1,100)
const extent=Math.max(height,(box.max.x-box.min.x)/camera.aspect,(box.max.z-box.min.z)/camera.aspect)
camera.position.set(extent*.65,height*.45+extent*.22,extent*1.7);camera.lookAt(0,height*.45,0)
const scenes=[ga,gb].map((g,i)=>{
 const scene=new THREE.Scene();scene.background=new THREE.Color(night?'#202f41':'#cbd6c7')
 scene.add(new THREE.HemisphereLight('#e4eff4','#817759',night?.8:1.8))
 const sun=new THREE.DirectionalLight(night?'#c0d7f1':'#fff0d1',night?.6:2.5);sun.position.set(-5,10,6);scene.add(sun)
 const m=(i?b:a).material.clone();if(mask){m.emissiveMap=mask;m.emissive.set('#ffb15c');m.emissiveIntensity=night?3.2:0}
 scene.add(new THREE.Mesh(g,m))
 const ground=new THREE.Mesh(new THREE.PlaneGeometry(100,100),new THREE.MeshStandardMaterial({color:'#829875',roughness:1}));ground.rotation.x=-Math.PI/2;ground.position.y=-.025;scene.add(ground)
 return scene
})
document.querySelector('#name').textContent=kit+' · 同尺度、同机位、同光照 · '+(night?'灯罩遮罩':'原材质')
function render(){for(let i=0;i<2;i++){renderer.setViewport(i*innerWidth/2,0,innerWidth/2,innerHeight);renderer.setScissor(i*innerWidth/2,0,innerWidth/2,innerHeight);renderer.render(scenes[i],camera)}requestAnimationFrame(render)}render()
document.body.dataset.review=JSON.stringify({ready:true,kit,maxPositionError:maxError,vertices:ga.attributes.position.count})
