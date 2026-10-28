// Adapted from my-blog src/world/scene/CampfireFlame.tsx (14d4c1d).
// Reuse its noise-shaped flame cards and GPU embers; this component follows the island's fire switch.
import {useEffect,useMemo,useRef} from 'react'
import {useFrame,useThree} from '@react-three/fiber'
import * as THREE from 'three'

const LIGHT_INTENSITY = 5;
const EMBER_COUNT = 28;
const EMBER_SIZE = 0.035;
// per flame card: sideways offset, offset toward the camera, width, height (m); drawn back to front
const FLAME_LAYERS = [
  [0, -0.06, 0.62, 0.98],
  [-0.1, 0.02, 0.4, 0.7],
  [0.11, 0.06, 0.36, 0.62],
] as const;

const NOISE = /* glsl */ `
  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }
  float valueNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x), mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  float fbm(vec2 p) {
    return 0.55 * valueNoise(p) + 0.3 * valueNoise(p * 2.1 + 1.7) + 0.15 * valueNoise(p * 4.3 + 3.1);
  }
`;

// cylindrical billboards: each card turns about the vertical axis to face the camera
const FLAME_VERTEX = /* glsl */ `
  attribute vec4 layer;
  attribute float seed;
  uniform float time;
  varying vec2 flameUv;
  varying float flameSeed;
  #include <fog_pars_vertex>
  void main() {
    vec3 base = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
    vec3 toCamera = vec3(cameraPosition.x - base.x, 0.0, cameraPosition.z - base.z);
    toCamera = length(toCamera) > 1e-4 ? normalize(toCamera) : vec3(0.0, 0.0, 1.0);
    vec3 side = vec3(toCamera.z, 0.0, -toCamera.x);
    float sway = sin(time * 2.3 + seed) * 0.04 * position.y;
    vec3 world = base + side * (layer.x + position.x * layer.z + sway) + toCamera * layer.y + vec3(0.0, position.y * layer.w, 0.0);
    flameUv = vec2(position.x + 0.5, position.y);
    flameSeed = seed;
    vec4 mvPosition = viewMatrix * vec4(world, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;

// teardrop mask whose edge is eaten by rising noise; colour runs from a pale core to orange and red edges
const FLAME_FRAGMENT = /* glsl */ `
  uniform float time;
  uniform float lit;
  varying vec2 flameUv;
  varying float flameSeed;
  #include <common>
  #include <fog_pars_fragment>
  ${NOISE}
  void main() {
    if (lit < 0.5) discard;
    vec2 uv = flameUv;
    float n = fbm(vec2(uv.x * 2.4 + flameSeed, uv.y * 1.8 - time * 1.6));
    float x = uv.x - 0.5 + (n - 0.5) * 0.45 * uv.y;
    float halfWidth = 0.46 * pow(1.0 - uv.y, 0.75) + 0.015;
    float edge = abs(x) / halfWidth;
    float mask = (1.0 - smoothstep(0.7, 1.0, edge)) * (1.0 - smoothstep(0.55 + 0.4 * n, 1.0, uv.y)) * smoothstep(0.0, 0.1, uv.y);
    if (mask < 0.01) discard;
    float heat = (1.0 - edge) * (1.0 - uv.y) + 0.25 * n;
    vec3 color = mix(vec3(0.9, 0.16, 0.02), vec3(1.0, 0.48, 0.06), smoothstep(0.12, 0.5, heat));
    color = mix(color, vec3(1.0, 0.82, 0.45), smoothstep(0.62, 0.95, heat));
    // above 1 so the flame reads as emissive after tone mapping, but low enough that the tone curve keeps the orange
    gl_FragColor = vec4(color * 1.3, mask);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`;

const EMBER_VERTEX = /* glsl */ `
  attribute float seed;
  uniform float time;
  uniform float pointSize;
  varying float emberFade;
  #include <fog_pars_vertex>
  void main() {
    float life = fract(time * (0.35 + 0.25 * fract(seed * 7.13)) + seed);
    float angle = seed * 6.2831 + time * 0.8;
    vec3 offset = vec3(cos(angle), 0.0, sin(angle)) * (0.08 + 0.3 * life) + vec3(0.0, 0.25 + 1.7 * life, 0.0);
    offset.x += sin(time * 1.7 + seed * 11.0) * 0.12 * life;
    vec4 mvPosition = modelViewMatrix * vec4(offset, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    emberFade = smoothstep(0.0, 0.1, life) * (1.0 - smoothstep(0.55, 1.0, life));
    gl_PointSize = pointSize * projectionMatrix[1][1] * (1.0 - 0.5 * life) / -mvPosition.z;
    #include <fog_vertex>
  }
`;

const EMBER_FRAGMENT = /* glsl */ `
  uniform float lit;
  varying float emberFade;
  #include <common>
  #include <fog_pars_fragment>
  void main() {
    if (lit < 0.5) discard;
    float glow = (1.0 - smoothstep(0.2, 0.5, length(gl_PointCoord - 0.5))) * emberFade;
    if (glow < 0.01) discard;
    gl_FragColor = vec4(vec3(1.0, 0.55, 0.15) * 1.5, glow);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`;

function createFire() {
  const time = { value: 0 };
  const pointSize = { value: 1 };
  const litUniform = { value: 1 };
  const fogUniforms = () => THREE.UniformsUtils.clone(THREE.UniformsLib.fog);

  const flameGeometry = new THREE.BufferGeometry();
  const corners = [[-0.5, 0], [0.5, 0], [0.5, 1], [-0.5, 1]];
  flameGeometry.setAttribute('position', new THREE.Float32BufferAttribute(FLAME_LAYERS.flatMap(() => corners.flatMap(([x, y]) => [x, y, 0])), 3));
  flameGeometry.setAttribute('layer', new THREE.Float32BufferAttribute(FLAME_LAYERS.flatMap((layer) => corners.flatMap(() => [...layer])), 4));
  flameGeometry.setAttribute('seed', new THREE.Float32BufferAttribute(FLAME_LAYERS.flatMap((_layer, index) => corners.map(() => index * 3.7)), 1));
  flameGeometry.setIndex(FLAME_LAYERS.flatMap((_layer, index) => [0, 1, 2, 0, 2, 3].map((corner) => index * 4 + corner)));
  flameGeometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.5, 0), 0.9);
  const flameMaterial = new THREE.ShaderMaterial({
    uniforms: { ...fogUniforms(), time, lit: litUniform },
    vertexShader: FLAME_VERTEX,
    fragmentShader: FLAME_FRAGMENT,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    fog: true,
  });
  const flame = new THREE.Mesh(flameGeometry, flameMaterial);
  flame.name = 'Campfire_Flame';
  flame.position.y = 0.04;
  flame.renderOrder = 1;

  const emberGeometry = new THREE.BufferGeometry();
  emberGeometry.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(EMBER_COUNT * 3), 3));
  emberGeometry.setAttribute('seed', new THREE.Float32BufferAttribute(Array.from({ length: EMBER_COUNT }, (_value, index) => (index * 0.618034) % 1), 1));
  emberGeometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 1.1, 0), 1.4);
  const emberMaterial = new THREE.ShaderMaterial({
    uniforms: { ...fogUniforms(), time, pointSize, lit: litUniform },
    vertexShader: EMBER_VERTEX,
    fragmentShader: EMBER_FRAGMENT,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: true,
  });
  const embers = new THREE.Points(emberGeometry, emberMaterial);
  embers.name = 'Campfire_Embers';
  embers.renderOrder = 2;

  // warm fill on the logs, ring and benches; no shadow map, falls off before the trail mouths
  const light = new THREE.PointLight('#ffa352', LIGHT_INTENSITY, 9, 2);
  light.position.y = 0.65;

  const group = new THREE.Group();
  group.name = 'Campfire_Effect';
  group.add(flame, embers, light);
  // camera and interaction rays pass through the fire
  flame.raycast = () => {};
  embers.raycast = () => {};

  return {
    group,
    flame,
    embers,
    /**
     * Out: every pixel discarded and no light. Everything stays in the scene (the light at zero), so lighting the
     * fire changes neither the light count nor what the GPU has uploaded, and no frame stalls.
     */
    setLit(lit: boolean) {
      litUniform.value = lit ? 1 : 0;
      if (!lit) light.intensity = 0;
    },
    /** still (reduced motion): frozen flame shape, no embers, steady light */
    update(elapsed: number, still: boolean, bufferHeight: number) {
      const t = still ? 0 : elapsed;
      time.value = t;
      embers.visible = !still;
      light.intensity = LIGHT_INTENSITY * (still ? 1 : 0.86 + 0.08 * Math.sin(t * 7.3) + 0.04 * Math.sin(t * 13.1 + 1.3) + 0.02 * Math.sin(t * 23.7));
      pointSize.value = EMBER_SIZE * bufferHeight * 0.5;
    },
    dispose() {
      flameGeometry.dispose();
      flameMaterial.dispose();
      emberGeometry.dispose();
      emberMaterial.dispose();
      light.dispose();
    },
  };
}

export default function CampfireFlame({lit}:{lit:boolean}) {
  const fire=useMemo(()=>createFire(),[])
  const bufferSize=useMemo(()=>new THREE.Vector2(),[])
  const motion=useMemo(()=>window.matchMedia('(prefers-reduced-motion: reduce)'),[])
  const reduced=useRef(motion.matches),elapsed=useRef(0)
  useEffect(()=>{
    const change=()=>{reduced.current=motion.matches}
    motion.addEventListener('change',change)
    return()=>motion.removeEventListener('change',change)
  },[motion])
  useEffect(()=>()=>fire.dispose(),[fire])
  // Lighting the fire used to compile every lit material anew (the light count changed, the flame's shaders were new)
  // and the frame stalled for seconds. Compile it all once, while the fire is out, and keep the light in the scene.
  const {gl,scene,camera}=useThree()
  useEffect(()=>{
    fire.setLit(true)
    try{gl.compile(scene,camera)}catch{/* compiled on first use instead */}
    fire.setLit(lit)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only the first state is compiled; later changes just toggle
  },[fire,gl,scene,camera])
  useEffect(()=>{fire.setLit(lit)},[fire,lit])
  useFrame(({gl},dt)=>{
    if(!lit)return
    if(!reduced.current)elapsed.current+=Math.min(dt,.05)
    fire.update(elapsed.current,reduced.current,gl.getDrawingBufferSize(bufferSize).y)
  })
  // The existing stone ring's firewood sits above the ground; put the flame roots inside it.
  return <primitive object={fire.group} position={[0,.22,0]} dispose={null}/>
}
