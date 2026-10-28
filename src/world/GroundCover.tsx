import { climateGLSL, climateUniforms } from './climateUniforms';
import {onBridge} from '../game/expansion'
// Grass geometry, rosette heads and wind shader adapted from my-blog GroundCover.tsx.
import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useForestStore } from '../game/store'
import { canStandAt, groundHeightAt, dockDeckHeight } from '../game/movement'
import { pathEdgeDistance, noiseGLSL, groundColourGLSL } from './terrain'
import {isBeachApproach,meadowWeight} from './worldConfig'
import {canopyDensityAt,canopyTexture} from './canopyMap'
const BLADES_PER_CLUMP=6, FLOWER_HEADS=2, PLAYER_RADIUS=.85, FADE_START=22, FADE_END=34
function hash(x: number, z: number, seed: number): number {
  const value = Math.sin(x * 127.1 + z * 311.7 + seed * 74.7) * 43758.5453;
  return value - Math.floor(value);
}

/** One clump of tapered blades leaning outward; uv.y is the height fraction used by the sway and tint. */
function createClumpGeometry(): THREE.BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const rows = [
    [0, 0.042],
    [0.4, 0.034],
    [0.75, 0.02],
    [1, 0],
  ];
  for (let blade = 0; blade < BLADES_PER_CLUMP; blade += 1) {
    const angle = (blade / BLADES_PER_CLUMP) * Math.PI * 2 + hash(blade, 1, 3) * 0.9;
    const offset = 0.03 + hash(blade, 2, 5) * 0.08;
    const height = 0.2 + hash(blade, 3, 7) * 0.16;
    const lean = 0.06 + hash(blade, 4, 9) * 0.12;
    const facing = angle + Math.PI / 2 + (hash(blade, 5, 11) - 0.5) * 1.2;
    const [dirX, dirZ] = [Math.cos(angle), Math.sin(angle)];
    const [sideX, sideZ] = [Math.cos(facing), Math.sin(facing)];
    const base = positions.length / 3;
    for (const [fraction, halfWidth] of rows) {
      const bend = lean * fraction * fraction;
      const x = dirX * (offset + bend);
      const z = dirZ * (offset + bend);
      const y = height * fraction * (1 - 0.25 * lean * fraction);
      if (halfWidth === 0) {
        positions.push(x, y, z);
        uvs.push(0.5, fraction);
      } else {
        positions.push(x - sideX * halfWidth, y, z - sideZ * halfWidth, x + sideX * halfWidth, y, z + sideZ * halfWidth);
        uvs.push(0, fraction, 1, fraction);
      }
    }
    // rows 0..2 are pairs, row 3 is the tip
    for (let row = 0; row < 2; row += 1) {
      const a = base + row * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    indices.push(base + 4, base + 5, base + 6);
  }
  const bladeVertices = positions.length / 3;
  // P14 C5: two small flower heads just above the blade tips, each a small eight-point rosette turned toward the camera in the
  // shader (a flat disc vanished edge-on from eye height); `flowerOffset` is the petal point in that facing plane.
  // The shader shows the heads only in flower drifts and collapses them everywhere else
  const petals: number[] = new Array((positions.length / 3) * 2).fill(0);
  for (let head = 0; head < FLOWER_HEADS; head += 1) {
    const angle = hash(head, 6, 13) * Math.PI * 2;
    const offset = 0.05 + hash(head, 7, 17) * 0.06;
    const [cx, cz] = [Math.cos(angle) * offset, Math.sin(angle) * offset];
    const y = 0.33 + hash(head, 8, 19) * 0.07;
    const centre = positions.length / 3;
    positions.push(cx, y, cz);
    uvs.push(0.5, 1);
    petals.push(0, 0);
    for (let petal = 0; petal < 8; petal += 1) {
      const a = (petal / 8) * Math.PI * 2 + angle;
      // shallow alternating notches keep the rosette from reading as a polygon
      const r = petal % 2 === 0 ? 0.032 : 0.024;
      positions.push(cx, y, cz);
      uvs.push(0, 1);
      petals.push(Math.cos(a) * r, Math.sin(a) * r);
    }
    for (let petal = 0; petal < 8; petal += 1) indices.push(centre, centre + 1 + petal, centre + 1 + ((petal + 1) % 8));
  }
  const flower = new Float32Array(positions.length / 3);
  flower.fill(1, bladeVertices);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('flower', new THREE.BufferAttribute(flower, 1));
  geometry.setAttribute('flowerOffset', new THREE.Float32BufferAttribute(petals, 2));
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  // grass lights like the ground it grows from, so blades never show dark backfaces
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(positions.map((_, index) => (index % 3 === 1 ? 1 : 0)), 3));
  geometry.setIndex(indices);
  return geometry;
}

const GRASS_VERTEX_PARS = /* glsl */ `
  uniform float grassTime;
  uniform vec3 grassPlayer;
  attribute float flower;
  attribute vec2 flowerOffset;
  varying vec3 vGrassColor;
  varying float vGrassHeight;
  ${noiseGLSL}
${groundColourGLSL}
`;

// sway, a gust wave, a push away from the player and a distance fade, applied as a world offset converted back to
// instance space so shadows and fog see the same blade; the root colour is the terrain albedo under the clump
const GRASS_VERTEX = /* glsl */ `
  mat3 grassBasis = mat3(instanceMatrix);
  vec3 grassRoot = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  float grassScale2 = dot(grassBasis[0], grassBasis[0]);
  float grassH = uv.y * uv.y;
  float grassPhase = dot(grassRoot.xz, vec2(0.37, 0.23));
  float grassGust = noise21(grassRoot.xz * 0.08 + vec2(grassTime * 0.35, grassTime * 0.12));
  vec2 grassWind = vec2(0.82, 0.57) * (sin(grassTime * 1.6 + grassPhase) * 0.05 + grassGust * 0.14);
  vec2 grassAway = grassRoot.xz - grassPlayer.xz;
  float grassPush = (1.0 - smoothstep(0.2, ${PLAYER_RADIUS.toFixed(2)}, length(grassAway))) * step(abs(grassRoot.y - grassPlayer.y), 1.2);
  vec2 grassBend = (grassWind + normalize(grassAway + vec2(1e-4)) * grassPush * 0.32) * grassH;
  vec3 grassOffset = vec3(grassBend.x, -0.1 * grassPush * grassH, grassBend.y);
  transformed += transpose(grassBasis) * grassOffset / grassScale2;
  float grassFade = 1.0 - smoothstep(${FADE_START.toFixed(1)}, ${FADE_END.toFixed(1)}, distance(grassRoot, cameraPosition));
  transformed *= grassFade;
  vec3 grassGround = groundColour(grassRoot.xz);
  float grassPatch = noise21(grassRoot.xz * 0.9);
  vec3 grassTip = grassGround * mix(vec3(1.2, 1.32, 0.96), vec3(1.45, 1.36, 0.88), grassPatch) + vec3(0.02, 0.03, 0.0);
  // per-clump value jitter and a darker root keep neighbouring clumps from merging into one flat sheet
  float grassJitter = 0.86 + 0.24 * hash21(grassRoot.xz * 1.7);
  vGrassColor = mix(grassGround * 0.7, grassTip, smoothstep(0.0, 0.9, uv.y)) * grassJitter;
  vGrassHeight = uv.y;
  // flowers gather in drifts a few metres across, on full-height clumps only (not trimmed path edges or the forest
  // floor); each drift keeps one muted colour: warm yellow, dusty lilac or soft pink, a little darker at the centre
  float flowerMeadow = meadowAt(grassRoot.xz);
  float flowerDrift = max(smoothstep(0.66, 0.8, noise21(grassRoot.xz * 0.16 + 13.0)), flowerMeadow * smoothstep(0.42, 0.6, noise21(grassRoot.xz * 0.3 + 5.0)));
  float flowerOn = flowerDrift * step(mix(0.7, 0.5, flowerMeadow), hash21(grassRoot.xz * 3.1 + 0.7)) * step(0.8, sqrt(grassScale2));
  vec3 flowerRight = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 flowerUp = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  // a little shorter than wide, as if the flower tipped up toward the sky
  vec3 flowerFacing = (flowerRight * flowerOffset.x + flowerUp * flowerOffset.y * 0.8) * grassFade;
  transformed += transpose(grassBasis) * flowerFacing / grassScale2;
  transformed = mix(transformed, vec3(0.0), flower * (1.0 - flowerOn));
  float flowerKind = noise21(grassRoot.xz * 0.05 + 3.0);
  vec3 flowerColour = flowerKind < 0.45 ? vec3(0.74, 0.5, 0.1) : (flowerKind < 0.65 ? vec3(0.44, 0.32, 0.6) : vec3(0.68, 0.38, 0.42));
  flowerColour *= (0.85 + 0.2 * hash21(grassRoot.xz * 5.3)) * mix(0.7, 1.0, step(0.25, abs(uv.x - 0.5)));
  vGrassColor = mix(vGrassColor, flowerColour, flower);
`;

interface GrassUniforms {
  grassTime: { value: number };
  grassPlayer: { value: THREE.Vector3 };
  canopyMap: { value: THREE.Texture };
}

function createGrassMaterial(uniforms: GrassUniforms) {
  const material = new THREE.MeshStandardMaterial({ roughness: 0.92, metalness: 0, side: THREE.DoubleSide });
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms, { climateGrass: climateUniforms.climateGrass, climateWet: climateUniforms.climateWet });
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${GRASS_VERTEX_PARS}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n${GRASS_VERTEX}`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vGrassColor;\nvarying float vGrassHeight;\n${climateGLSL}`)
      .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb *= vGrassColor * climateGrass * (1.0 - climateWet * .15);')
      // DoubleSide flips back-face normals downward, which leaves half the blades unlit; both sides share the up normal
      .replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\nnormal = normalize(vNormal);')
      // a little back-light through the upper blade so sunlit grass glows instead of reading as flat paint
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vGrassColor * 0.08 * vGrassHeight;');
  };
  return material;
}


/** Small lazy chunks: no full-island raycasts or old map systems. */
export function GroundCover() {
  const field=useMemo(()=>{
    const root=new THREE.Group();root.name='GroundCover'
    const geometry=createClumpGeometry()
    const uniforms:GrassUniforms={grassTime:{value:0},grassPlayer:{value:new THREE.Vector3()},canopyMap:{value:canopyTexture()}}
    const material=createGrassMaterial(uniforms)
    const chunks:{x:number;z:number;mesh:THREE.InstancedMesh|null;built:boolean}[]=[]
    for(let x=-40;x<40;x+=8)for(let z=-40;z<40;z+=8)chunks.push({x,z,mesh:null,built:false})
    return {root,geometry,material,uniforms,chunks,reduced:false,time:0}
  },[])
  const runtime=useRef(field)
  useEffect(()=>{
    const media=matchMedia('(prefers-reduced-motion: reduce)')
    const changed=()=>{runtime.current.reduced=media.matches};changed();media.addEventListener('change',changed)
    return ()=>{media.removeEventListener('change',changed);field.chunks.forEach(c=>c.mesh?.dispose());field.geometry.dispose();field.material.dispose()}
  },[field])
  useFrame(({camera,gl},dt)=>{
    const field=runtime.current
    const player=useForestStore.getState().position
    if(!field.reduced)field.time+=Math.min(dt,.05)
    field.uniforms.grassTime.value=field.time
    field.uniforms.grassPlayer.value.set(player.x,groundHeightAt(player.x,player.z),player.z)
    const start=performance.now(),dummy=new THREE.Object3D()
    const pending=field.chunks.filter(c=>!c.built&&Math.hypot(c.x+4-player.x,c.z+4-player.z)<32).sort((a,b)=>Math.hypot(a.x-player.x,a.z-player.z)-Math.hypot(b.x-player.x,b.z-player.z))
    for(const c of pending) {
      if(performance.now()-start>3)break
      c.built=true
      const matrices:number[]=[]
      for(let i=0;i<24;i++)for(let j=0;j<24;j++) {
        const cx=c.x+i/3,cz=c.z+j/3,x=cx+hash(cx,cz,1)/3,z=cz+hash(cx,cz,2)/3
        const edge=pathEdgeDistance(x,z)
        if(onBridge(x,z)||!canStandAt(x,z)||groundHeightAt(x,z)===dockDeckHeight||edge<-.18||Math.hypot(x,z)>34.5||(z>25&&Math.hypot(x,z)>23)||Math.hypot(x,z-8)<1.3||(Math.abs(x-8)<3.7&&Math.abs(z-6)<3)||Math.hypot(x-1.5,z+5)<1.0||(isBeachApproach(x,z)&&x>21))continue
        // meadows grow continuous turf, crown shade thins it out, and the verge tapers toward the track
        const shade=canopyDensityAt(x,z),meadow=meadowWeight(x,z)
        const drift=.55+.45*Math.sin(x*.31+Math.sin(z*.23)*2.1)*Math.cos(z*.27-Math.sin(x*.19)*1.7)
        const weight=THREE.MathUtils.smoothstep(edge,-.18,1.25-.5*meadow)*(1-.72*shade)
        if(hash(cx,cz,3)>weight*Math.min(1,drift+.25+.75*meadow))continue
        dummy.position.set(x,groundHeightAt(x,z)-.015,z);dummy.rotation.set(0,hash(cx,cz,4)*Math.PI*2,0)
        dummy.scale.setScalar((.75+hash(cx,cz,5)*.5)*(.8+.35*drift+.15*meadow)*(.5+.5*weight))
        dummy.updateMatrix();matrices.push(...dummy.matrix.elements)
      }
      if(matrices.length) {
        c.mesh=new THREE.InstancedMesh(field.geometry,field.material,matrices.length/16)
        c.mesh.name=`grass-${c.x}-${c.z}`;c.mesh.instanceMatrix.array.set(matrices);c.mesh.instanceMatrix.needsUpdate=true
        c.mesh.computeBoundingSphere();if(c.mesh.boundingSphere)c.mesh.boundingSphere.radius+=.6
        c.mesh.receiveShadow=true;c.mesh.raycast=()=>{};field.root.add(c.mesh)
      }
    }
    field.chunks.forEach(c=>{if(c.mesh)c.mesh.visible=Math.hypot(c.x+4-camera.position.x,c.z+4-camera.position.z)<40})
    if(import.meta.env.DEV&&new URLSearchParams(location.search).has('qa'))gl.domElement.dataset.grassQa=JSON.stringify({time:field.time,reduced:field.reduced,chunks:field.chunks.filter(c=>c.built).length,clumps:field.chunks.reduce((n,c)=>n+(c.mesh?.count??0),0)})
  })
  return <primitive object={field.root} dispose={null}/>
}
