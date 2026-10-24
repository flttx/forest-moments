import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js'
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const $ = (selector) => document.querySelector(selector);
const status = $('#status');
const errorBox = $('#error');
const measurement = $('#measurement');
const assetSelect = $('#asset');
const materialSelect = $('#material');
const measureButton = $('#measure');
const exportButton = $('#export');
const animationSelect = $('#animation');
const pauseButton = $('#pause');
let report = null;

function dispose(root) {
  const resources = new Set();
  root.traverse((object) => {
    if (object.geometry) resources.add(object.geometry);
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials.filter(Boolean)) {
      resources.add(material);
      for (const value of Object.values(material)) if (value?.isTexture) resources.add(value);
    }
  });
  for (const resource of resources) resource.dispose();
}

async function main() {
  const canvas = $('#viewport');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#eee9dd');
  scene.add(new THREE.HemisphereLight(0xfff8e8, 0x6e7567, 2));
  for (const [x, y, z, power] of [[3, 5, 4, 3], [-4, 2, -3, 2]]) {
    const light = new THREE.DirectionalLight(0xfff8ed, power);
    light.position.set(x, y, z);
    scene.add(light);
  }
  const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 1000);
  const controls = new OrbitControls(camera, canvas);
  // Immediate controls avoid a residual damping movement during fixed-view sampling.
  controls.enableDamping = false;
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const response = await fetch('/docs/evidence/assets/2026-10-22-round-01/manifest.json');
  if (!response.ok) throw new Error(`清单读取失败：HTTP ${response.status}`);
  const manifest = await response.json();
  let model = null, distance = 8, height = 3, sequence = 0, loaded = null, sample = null;
  let mixer = null, clips = [], activeAction = null, paused = false, lastFrameTime = null;

  function cancel(reason) {
    if (sample) measurement.textContent = `测量已取消：${reason}。请重新开始。`;
    sample = null;
    report = null;
    controls.enabled = true;
    exportButton.disabled = true;
    measureButton.disabled = !loaded;
  }
  function angle(radians) {
    cancel('机位改变');
    camera.position.set(Math.sin(radians) * distance, height * 0.68, Math.cos(radians) * distance);
    controls.target.set(0, height * 0.45, 0);
    controls.update();
  }
  async function load() {
    const ticket = ++sequence;
    loaded = null;
    cancel('资产改变');
    const id = assetSelect.value;
    materialSelect.disabled = id !== 'raccoon';
    if (id !== 'raccoon') materialSelect.value = 'raw';
    const variant = materialSelect.value;
    status.textContent = '正在加载原面数模型…';
    errorBox.textContent = '';
    measurement.textContent = '尚未测量。';
    if (mixer && model) { mixer.stopAllAction(); mixer.uncacheRoot(mixer.getRoot()); }
    mixer = null; clips = []; activeAction = null; paused = false;
    animationSelect.replaceChildren(new Option('静止绑定姿势', ''));
    animationSelect.disabled = true; pauseButton.disabled = true; pauseButton.textContent = '暂停动作';
    // Release the previous GPU resources before loading a new large batch.
    if (model) { scene.remove(model); dispose(model); model = null; }
    const group = new THREE.Group();
    const started = performance.now();
    const sources = [];
    try {
      let selected = manifest.assets.filter((asset) => id === 'all' || asset.asset === id);
      if (id.endsWith('-structure')) {
        const updated = await fetch('/docs/evidence/assets/2026-10-22-structures/manifest.json');
        if (!updated.ok) throw new Error('缺少结构修整版清单');
        selected = (await updated.json()).assets.filter((asset) => asset.asset === id);
        if (ticket !== sequence) return;
      }
      if (id === 'raccoon-mixamo' || id === 'raccoon-surface') {
        const updated = await fetch('/docs/evidence/assets/2026-10-22-raccoon-animation/manifest.json');
        if (!updated.ok) throw new Error('缺少动作与材质候选清单');
        selected = (await updated.json()).assets.filter((asset) => asset.asset === id);
        if (ticket !== sequence) return;
      }
      if (id === 'raccoon-multiview' || id === 'raccoon-tail-repair') {
        const directory = id === 'raccoon-tail-repair' ? '2026-10-22-raccoon-tail-repair' : '2026-10-22-raccoon-multiview';
        const updated = await fetch(`/docs/evidence/assets/${directory}/manifest.json`);
        if (!updated.ok) throw new Error('浣熊候选缺少文件核验清单');
        selected = (await updated.json()).assets;
        if (ticket !== sequence) return;
      }
      for (const [index, asset] of selected.entries()) {
        const file = asset.files.find((item) => item.glb);
        const path = variant === 'material-v1'
          ? 'assets/lux3d/round-01/raccoon/material-v1.glb' : file.path;
        let artifactSha256 = file.sha256;
        if (variant === 'material-v1') {
          const meta = await fetch('/docs/evidence/assets/2026-10-22-round-01/raccoon/material-v1/material-change.json');
          if (!meta.ok) throw new Error('缺少材质试稿来源记录');
          artifactSha256 = (await meta.json()).outputSha256;
        }
        const gltf = await loader.loadAsync(`/${path}`);
        if (ticket !== sequence) { dispose(gltf.scene); dispose(group); return; }
        const root = gltf.scene;
        if (selected.length === 1 && gltf.animations.length) {
          mixer = new THREE.AnimationMixer(root);
          clips = gltf.animations;
          for (const clip of clips) animationSelect.add(new Option(clip.name, clip.name));
          animationSelect.disabled = false;
        }
        root.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(root);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        const normalization = new THREE.Group();
        normalization.add(root);
        root.position.sub(new THREE.Vector3(center.x, box.min.y, center.z));
        normalization.scale.setScalar(3 / Math.max(size.x, size.y, size.z));
        normalization.position.x = selected.length > 1 ? (index - 1.5) * 3.8 : 0;
        group.add(normalization);
        sources.push({ asset: asset.asset, taskId: asset.taskId, path,
          rawSha256: asset.sourceSha256 ?? file.sha256, artifactSha256,
          variant: asset.variant ?? variant, triangles: file.glb.triangles });
      }
      if (ticket !== sequence) { dispose(group); return; }
      model = group;
      scene.add(model);
      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      height = size.y;
      distance = Math.max(size.x, size.y, size.z) * 2.2;
      camera.near = distance / 1000;
      camera.far = distance * 100;
      camera.updateProjectionMatrix();
      angle(0.65);
      loaded = { selection: id, variant, sources, fetchParseSceneMs: performance.now() - started };
      measureButton.disabled = false;
      status.textContent = `${selected.length} 项 · ${sources.reduce((n, a) => n + a.triangles, 0).toLocaleString()} 三角面 · ${id === 'raccoon-tail-repair' ? '局部切缝修整，未减面' : '原面数'} · 加载/解析/场景准备 ${loaded.fetchParseSceneMs.toFixed(0)} ms（缓存状态未知；不含首次 GPU 上传）`;
    } catch (error) {
      dispose(group);
      if (ticket !== sequence) return;
      loaded = null;
      measureButton.disabled = true;
      errorBox.textContent = `模型读取失败：${error.message}`;
      status.textContent = '加载失败，可切换资产重试。';
    }
  }
  function resize() {
    cancel('视口尺寸改变');
    const rect = $('#stage').getBoundingClientRect();
    renderer.setSize(Math.max(1, rect.width), Math.max(1, rect.height), false);
    camera.aspect = Math.max(1, rect.width) / Math.max(1, rect.height);
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe($('#stage'));
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) cancel('页面进入后台');
  });
  controls.addEventListener('start', () => cancel('手动操作相机'));
  assetSelect.addEventListener('change', load);
  materialSelect.addEventListener('change', load);
  animationSelect.addEventListener('change', () => {
    cancel('动作改变');
    if (!mixer) return;
    mixer.stopAllAction();
    const clip = clips.find((item) => item.name === animationSelect.value);
    activeAction = clip ? mixer.clipAction(clip).reset().play() : null;
    // One-shot clips must not jump from their end pose back to standing.
    if (activeAction) {
      const once = /(?:down|stand_up|fish_cast|fish_land|interact)/.test(clip.name);
      activeAction.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, once ? 1 : Infinity);
      activeAction.clampWhenFinished = once;
    }
    paused = false; pauseButton.disabled = !activeAction; pauseButton.textContent = '暂停动作';
  });
  pauseButton.addEventListener('click', () => {
    cancel('动作暂停状态改变');
    paused = !paused;
    if (activeAction) activeAction.paused = paused;
    pauseButton.textContent = paused ? '继续动作' : '暂停动作';
  });
  document.querySelectorAll('[data-angle]').forEach((button) => {
    button.addEventListener('click', () => angle(Number(button.dataset.angle)));
  });
  measureButton.addEventListener('click', () => {
    if (!loaded || document.hidden) return;
    cancel('重新开始');
    sample = { warmUntil: performance.now() + 2000, first: null, last: null, frames: [] };
    controls.enabled = false;
    measureButton.disabled = true;
    measurement.textContent = '预热 2 秒，随后固定机位采样 30 秒…';
  });
  exportButton.addEventListener('click', () => {
    if (!report) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `forest-assets-${report.selection}-${Date.now()}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  renderer.setAnimationLoop((now) => {
    const delta = lastFrameTime === null ? 0 : Math.min((now - lastFrameTime) / 1000, 0.1);
    lastFrameTime = now;
    if (mixer && !document.hidden) mixer.update(delta);
    controls.update();
    renderer.render(scene, camera);
    if (!sample || now < sample.warmUntil) return;
    if (sample.first === null) { sample.first = now; sample.last = now; return; }
    sample.frames.push(now - sample.last);
    sample.last = now;
    const duration = now - sample.first;
    if (duration < 30000) return;
    const sorted = [...sample.frames].sort((a, b) => a - b);
    const percentile = (fraction) => sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)];
    report = { timestamp: new Date().toISOString(), scope: 'fixed-view asset review; not game benchmark',
      ...loaded, userAgent: navigator.userAgent, threeRevision: THREE.REVISION,
      animation: animationSelect.value || null, animationPaused: paused,
      drawingBuffer: [canvas.width, canvas.height], pixelRatio: renderer.getPixelRatio(),
      camera: { position: camera.position.toArray(), target: controls.target.toArray(), fov: camera.fov },
      durationMs: duration, frames: sorted.length, averageFps: sorted.length * 1000 / duration,
      frameMs: { p50: percentile(0.5), p95: percentile(0.95), max: sorted.at(-1) },
      render: { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles },
      resourceCounts: { ...renderer.info.memory }, gpuMemoryBytes: null,
      note: 'RAF intervals include display refresh/vsync and main-thread scheduling. Resource counts are not VRAM; no GPU time measured.' };
    measurement.textContent = `30 秒结果：平均 ${report.averageFps.toFixed(1)} FPS；帧间隔 p95 ${report.frameMs.p95.toFixed(2)} ms；${report.render.calls} draw calls；${report.render.triangles.toLocaleString()} 可见三角面。\n仅本展示台固定机位；显存未测量。`;
    sample = null;
    controls.enabled = true;
    measureButton.disabled = false;
    exportButton.disabled = false;
  });
  resize();
  await load();
}

main().catch((error) => {
  errorBox.textContent = `预览初始化失败：${error.message}`;
  status.textContent = '未取得可用渲染结果。';
});
