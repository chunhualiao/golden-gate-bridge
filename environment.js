import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { Water } from 'three/addons/objects/Water.js';

// ---------------------------------------------------------------------------
// Deterministic value noise (terrain heightfields)
// ---------------------------------------------------------------------------
function hash2(ix, iz, seed) {
  let h = (ix * 374761393 + iz * 668265263 + seed * 1013904223) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967295;
}
function vnoise(x, z, seed) {
  const ix = Math.floor(x), iz = Math.floor(z);
  const fx = x - ix, fz = z - iz;
  const sx = fx * fx * (3 - 2 * fx), sz = fz * fz * (3 - 2 * fz);
  const a = hash2(ix, iz, seed), b = hash2(ix + 1, iz, seed);
  const c = hash2(ix, iz + 1, seed), d = hash2(ix + 1, iz + 1, seed);
  return a + (b - a) * sx + (c - a) * sz + (a - b - c + d) * sx * sz;
}
function fbm(x, z, seed, octaves = 4) {
  let v = 0, amp = 0.5, f = 1, norm = 0;
  for (let o = 0; o < octaves; o++) {
    v += vnoise(x * f, z * f, seed + o * 131) * amp;
    norm += amp; amp *= 0.5; f *= 2.1;
  }
  return v / norm;
}

// ---------------------------------------------------------------------------
// Day/night parameter sets
// ---------------------------------------------------------------------------
const PRESETS = {
  day: {
    sunPos: new THREE.Vector3(1180, 1543, 1409),   // warm afternoon sun, SE
    sunColor: new THREE.Color(0xfff1dd), sunIntensity: 1.2,
    skySun: new THREE.Vector3(0.492, 0.643, 0.587), // matches sunPos direction
    turbidity: 6, rayleigh: 3,
    hemiSky: new THREE.Color(0xbdd8f2), hemiGround: new THREE.Color(0x54604f), hemiIntensity: 0.15,
    fogColor: new THREE.Color(0xc6d5e2),
    waterColor: new THREE.Color(0x0e3a4a), waterSunColor: new THREE.Color(0xffffff),
    exposure: 0.35, envIntensity: 0.45,
  },
  night: {
    sunPos: new THREE.Vector3(-1430, 900, -1704),    // moon
    sunColor: new THREE.Color(0x8ea3d8), sunIntensity: 0.25,
    skySun: new THREE.Vector3(-0.970, -0.174, -0.171), // set sun below the horizon
    turbidity: 6, rayleigh: 2.5,
    hemiSky: new THREE.Color(0x22304a), hemiGround: new THREE.Color(0x0d1017), hemiIntensity: 0.08,
    fogColor: new THREE.Color(0x0e1826),
    waterColor: new THREE.Color(0x081a28), waterSunColor: new THREE.Color(0x8899cc),
    exposure: 0.32, envIntensity: 0.35,
  },
};

export function buildEnvironment(scene, renderer) {
  // --- Physical sky + image-based lighting ---
  const sky = new Sky();
  sky.scale.setScalar(15000);
  scene.add(sky);
  const skyU = sky.material.uniforms;
  skyU.mieCoefficient.value = 0.005;
  skyU.mieDirectionalG.value = 0.76;

  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  const skyEnv = new THREE.Mesh(sky.geometry, sky.material); // shares material/uniforms
  skyEnv.scale.setScalar(15000);
  envScene.add(skyEnv);
  let envRT = null;
  function refreshEnvironment() {
    const rt = pmrem.fromScene(envScene, 0, 0.1, 30000);
    if (envRT) envRT.dispose();
    envRT = rt;
    scene.environment = envRT.texture;
  }

  // --- Fog ---
  scene.fog = new THREE.FogExp2(PRESETS.day.fogColor.clone(), 0.00008);
  let fogT = 0.12;

  // --- San Francisco Bay water (real-time reflections) ---
  const waterNormals = new THREE.TextureLoader().load('./vendor/waternormals.jpg', (t) => {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
  });
  const water = new Water(new THREE.PlaneGeometry(22000, 22000), {
    textureWidth: 512, textureHeight: 512,
    waterNormals,
    sunDirection: PRESETS.day.sunPos.clone().normalize(),
    sunColor: 0xffffff,
    waterColor: PRESETS.day.waterColor.getHex(),
    distortionScale: 2.6,
    fog: true,
  });
  water.rotation.x = -Math.PI / 2;
  water.material.uniforms.size.value = 160;
  scene.add(water);

  // --- Terrain heightfields ---
  function terrainPatch(cx, cz, sx, sz, maxH, seed, palette) {
    const seg = 72;
    const geo = new THREE.PlaneGeometry(sx, sz, seg, seg);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const col = new THREE.Color(), tmp = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const wx = Math.max(0, 1 - Math.abs(x / (sx / 2)) ** 3);
      const wz = Math.max(0, 1 - Math.abs(z / (sz / 2)) ** 3);
      const w = Math.min(wx, wz);
      let h = fbm((x + cx) * 0.0014, (z + cz) * 0.0014, seed, 4);
      h = Math.pow(h, 1.35) * maxH * w - 3; // edges sink below the waterline
      pos.setY(i, h);
      if (h < 2.5) col.setHex(palette.shore);
      else col.setHex(palette.low).lerp(tmp.setHex(palette.high),
                                        THREE.MathUtils.clamp(h / (maxH * 0.7), 0, 1));
      const j = 0.94 + hash2(i, seed, 7) * 0.12;
      colors[i * 3] = col.r * j; colors[i * 3 + 1] = col.g * j; colors[i * 3 + 2] = col.b * j;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 }));
    m.position.set(cx, 0, cz);
    m.receiveShadow = true;
    scene.add(m);
  }
  const MARIN = { shore: 0x8f8468, low: 0x97854e, high: 0x6f6543 };
  const GREEN = { shore: 0x6f7a52, low: 0x4c6a42, high: 0x39543a };
  const ROCK  = { shore: 0x86817a, low: 0x7b766e, high: 0x6b665f };
  terrainPatch(1800, 0, 1500, 2800, 240, 11, MARIN);     // Marin Headlands
  terrainPatch(-1900, -200, 1500, 2400, 120, 23, GREEN); // Presidio / SF hills
  terrainPatch(-1150, 0, 520, 720, 34, 7, GREEN);        // Fort Point bluff
  terrainPatch(900, 3900, 1300, 1300, 200, 31, GREEN);   // Angel Island backdrop
  terrainPatch(600, 2800, 260, 200, 22, 41, ROCK);       // Alcatraz

  // --- Distant downtown SF skyline silhouette ---
  const dummy = new THREE.Object3D();
  const city = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ color: 0x6b7480, roughness: 1 }), 30);
  for (let i = 0; i < 30; i++) {
    const h = 25 + Math.random() * 95;
    dummy.position.set(-2400 + (Math.random() - 0.5) * 500, h / 2 - 2, (Math.random() - 0.5) * 1400);
    dummy.scale.set(60 + Math.random() * 80, h, 60 + Math.random() * 80);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    city.setMatrixAt(i, dummy.matrix);
  }
  scene.add(city);

  // --- Stars (fade in at night) ---
  const starPos = new Float32Array(1500 * 3);
  for (let i = 0; i < 1500; i++) {
    let x, y, z;
    do {
      x = Math.random() * 2 - 1; y = Math.random() * 2 - 1; z = Math.random() * 2 - 1;
    } while (x * x + y * y + z * z > 1 || y < 0.05);
    const v = new THREE.Vector3(x, y, z).normalize().multiplyScalar(8000);
    starPos.set([v.x, v.y, v.z], i * 3);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({
    color: 0xcfd8ff, size: 1.6, sizeAttenuation: false,
    transparent: true, opacity: 0, fog: false, depthWrite: false,
  }));
  scene.add(stars);

  // --- Lights ---
  const sun = new THREE.DirectionalLight(PRESETS.day.sunColor, PRESETS.day.sunIntensity);
  sun.position.copy(PRESETS.day.sunPos);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  sun.shadow.camera.left = -1600; sun.shadow.camera.right = 1600;
  sun.shadow.camera.top = 800; sun.shadow.camera.bottom = -800;
  sun.shadow.camera.near = 200; sun.shadow.camera.far = 6000;
  sun.shadow.bias = -0.0002;
  sun.shadow.normalBias = 2;
  scene.add(sun);
  const hemi = new THREE.HemisphereLight(PRESETS.day.hemiSky, PRESETS.day.hemiGround, PRESETS.day.hemiIntensity);
  scene.add(hemi);

  // --- Day/night state ---
  let nightTarget = 0;
  let nightFactor = 0;
  let pmremCooldown = 0;

  const cur = {
    sunColor: PRESETS.day.sunColor.clone(), sunIntensity: PRESETS.day.sunIntensity,
    sunPos: PRESETS.day.sunPos.clone(), skySun: PRESETS.day.skySun.clone(),
    turbidity: PRESETS.day.turbidity, rayleigh: PRESETS.day.rayleigh,
    hemiSky: PRESETS.day.hemiSky.clone(), hemiGround: PRESETS.day.hemiGround.clone(),
    hemiIntensity: PRESETS.day.hemiIntensity,
    fogColor: PRESETS.day.fogColor.clone(),
    waterColor: PRESETS.day.waterColor.clone(), waterSunColor: PRESETS.day.waterSunColor.clone(),
    exposure: PRESETS.day.exposure, envIntensity: PRESETS.day.envIntensity,
  };

  function applyCur() {
    sun.color.copy(cur.sunColor); sun.intensity = cur.sunIntensity; sun.position.copy(cur.sunPos);
    hemi.color.copy(cur.hemiSky); hemi.groundColor.copy(cur.hemiGround); hemi.intensity = cur.hemiIntensity;
    skyU.sunPosition.value.copy(cur.skySun);
    skyU.turbidity.value = cur.turbidity;
    skyU.rayleigh.value = cur.rayleigh;
    scene.fog.color.copy(cur.fogColor);
    water.material.uniforms.waterColor.value.copy(cur.waterColor);
    water.material.uniforms.sunColor.value.copy(cur.waterSunColor);
    water.material.uniforms.sunDirection.value.copy(cur.sunPos).normalize();
    renderer.toneMappingExposure = cur.exposure;
    scene.environmentIntensity = cur.envIntensity;
    stars.material.opacity = nightFactor * 0.85;
  }

  function update(dt) {
    const speed = dt / 1.1;
    if (nightFactor < nightTarget) nightFactor = Math.min(nightTarget, nightFactor + speed);
    else if (nightFactor > nightTarget) nightFactor = Math.max(nightTarget, nightFactor - speed);
    const transitioning = Math.abs(nightFactor - nightTarget) > 1e-4;

    const f = nightFactor, D = PRESETS.day, N = PRESETS.night;
    cur.sunColor.lerpColors(D.sunColor, N.sunColor, f);
    cur.sunIntensity = D.sunIntensity + (N.sunIntensity - D.sunIntensity) * f;
    cur.sunPos.lerpVectors(D.sunPos, N.sunPos, f);
    cur.skySun.lerpVectors(D.skySun, N.skySun, f).normalize();
    cur.turbidity = D.turbidity + (N.turbidity - D.turbidity) * f;
    cur.rayleigh = D.rayleigh + (N.rayleigh - D.rayleigh) * f;
    cur.hemiSky.lerpColors(D.hemiSky, N.hemiSky, f);
    cur.hemiGround.lerpColors(D.hemiGround, N.hemiGround, f);
    cur.hemiIntensity = D.hemiIntensity + (N.hemiIntensity - D.hemiIntensity) * f;
    cur.fogColor.lerpColors(D.fogColor, N.fogColor, f);
    cur.waterColor.lerpColors(D.waterColor, N.waterColor, f);
    cur.waterSunColor.lerpColors(D.waterSunColor, N.waterSunColor, f);
    cur.exposure = D.exposure + (N.exposure - D.exposure) * f;
    cur.envIntensity = D.envIntensity + (N.envIntensity - D.envIntensity) * f;
    applyCur();

    // The sky changed → re-bake the IBL environment map (throttled while transitioning)
    if (transitioning) {
      pmremCooldown -= dt;
      if (pmremCooldown <= 0) { refreshEnvironment(); pmremCooldown = 0.15; }
    } else if (pmremCooldown !== 0) {
      refreshEnvironment();
      pmremCooldown = 0;
    }

    scene.fog.density = fogT * 0.0006 * (1 + 0.15 * f);
    water.material.uniforms.time.value += dt * 0.8;
  }

  applyCur();
  refreshEnvironment();

  return {
    update,
    setNight(b) { nightTarget = b ? 1 : 0; },
    setFog(t) { fogT = t; },
    get nightFactor() { return nightFactor; },
  };
}
