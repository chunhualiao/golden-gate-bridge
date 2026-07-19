import * as THREE from 'three';
import { DECK_TOP } from './bridge.js';

const LANES = [-11.25, -6.75, -2.25, 2.25, 6.75, 11.25]; // lane centrelines (z)
const ROAD_END = 1115;
const CAR_COLORS = [0xd8d8d8, 0xf5f5f5, 0x1a1a1c, 0x8a1f1f, 0x1f3a6b, 0x5a6068, 0xb8b8b0];

export function buildTraffic(scene) {
  const group = new THREE.Group();
  const N = 46;
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();

  const bodies = new THREE.InstancedMesh(
    new THREE.BoxGeometry(4.6, 1.5, 1.9),
    new THREE.MeshStandardMaterial({ roughness: 0.35, metalness: 0.8 }), N);
  const cabins = new THREE.InstancedMesh(
    new THREE.BoxGeometry(2.4, 0.75, 1.7),
    new THREE.MeshStandardMaterial({ color: 0x1c2a3a, roughness: 0.15, metalness: 0.8 }), N);
  const lights = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.3, 0.3, 0.3),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 }), N * 2);
  lights.visible = false;

  const cars = [];
  for (let i = 0; i < N; i++) {
    const lane = Math.floor(Math.random() * LANES.length);
    cars.push({
      lane,
      dir: lane < 3 ? 1 : -1,                       // western 3 lanes → +x, eastern → −x
      speed: 20 + Math.random() * 13,
      x: Math.random() * ROAD_END * 2 - ROAD_END,
    });
    bodies.setColorAt(i, color.setHex(CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)]));
    lights.setColorAt(i * 2, color.setRGB(2.4, 2.2, 1.8));    // headlight (HDR for bloom)
    lights.setColorAt(i * 2 + 1, color.setRGB(2.6, 0.3, 0.2)); // taillight
  }
  bodies.instanceColor.needsUpdate = true;
  lights.instanceColor.needsUpdate = true;

  group.add(bodies, cabins, lights);
  scene.add(group);

  function update(dt) {
    if (!group.visible) return;
    for (let i = 0; i < N; i++) {
      const c = cars[i];
      c.x += c.dir * c.speed * dt;
      if (c.x > ROAD_END) c.x = -ROAD_END;
      if (c.x < -ROAD_END) c.x = ROAD_END;
      const z = LANES[c.lane];
      const rotY = c.dir > 0 ? 0 : Math.PI;

      dummy.rotation.set(0, rotY, 0);
      dummy.scale.set(1, 1, 1);
      dummy.position.set(c.x, DECK_TOP + 0.85, z);
      dummy.updateMatrix();
      bodies.setMatrixAt(i, dummy.matrix);

      dummy.position.set(c.x - 0.35 * c.dir, DECK_TOP + 1.95, z);
      dummy.updateMatrix();
      cabins.setMatrixAt(i, dummy.matrix);

      dummy.position.set(c.x + 2.35 * c.dir, DECK_TOP + 0.8, z);
      dummy.scale.set(1, 1, 2.6);
      dummy.updateMatrix();
      lights.setMatrixAt(i * 2, dummy.matrix);
      dummy.position.set(c.x - 2.35 * c.dir, DECK_TOP + 0.8, z);
      dummy.updateMatrix();
      lights.setMatrixAt(i * 2 + 1, dummy.matrix);
    }
    bodies.instanceMatrix.needsUpdate = true;
    cabins.instanceMatrix.needsUpdate = true;
    lights.instanceMatrix.needsUpdate = true;
  }

  function setNightFactor(f) {
    lights.material.opacity = f;
    lights.visible = f > 0.03;
  }

  return { group, update, setNightFactor };
}
