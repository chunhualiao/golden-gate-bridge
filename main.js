import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { buildEnvironment } from './environment.js';
import { buildBridge } from './bridge.js';
import { buildTraffic } from './traffic.js';
import { initInteractions } from './interactions.js';

const canvas = document.getElementById('scene-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.5, 30000);
camera.position.set(1250, 380, 1450);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 100, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.minDistance = 25;
controls.maxDistance = 8000;
controls.maxPolarAngle = Math.PI * 0.55;
controls.update();

// Build the world
const env = buildEnvironment(scene, renderer);
const bridge = buildBridge(scene);
const traffic = buildTraffic(scene);
const interactions = initInteractions({ renderer, camera, controls, env, bridge, traffic });

// exposed for automated testing / debugging
window.__gg = { camera, controls, env, bridge, fly: interactions.fly };

// Post-processing: HDR render → bloom → tone-mapped output
const composerTarget = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, {
  type: THREE.HalfFloatType, samples: 4,
});
const composer = new EffectComposer(renderer, composerTarget);
composer.addPass(new RenderPass(scene, camera));
const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight), 0.05, 0.35, 1.8);
composer.addPass(bloomPass);
composer.addPass(new OutputPass());
composer.setSize(window.innerWidth, window.innerHeight); // apply retina pixel ratio to targets

// Resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
  composer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});

// Animation loop
const clock = new THREE.Clock();
function tick() {
  requestAnimationFrame(tick);
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;

  env.update(dt);
  traffic.update(dt);
  traffic.setNightFactor(env.nightFactor);
  bridge.setLampGlow(env.nightFactor);
  bridge.setNightGlow(env.nightFactor);
  bridge.beacons.forEach((b, i) => { b.visible = Math.sin(t * 2.2 + i * Math.PI / 2) > 0; });
  bloomPass.strength = 0.05 + env.nightFactor * 0.45;
  interactions.update(dt);
  // OrbitControls.update() would override the fly camera's orientation — skip it
  // whenever the orbit controller is disabled (fly mode, camera tween).
  if (controls.enabled) controls.update();
  composer.render();
}
tick();
