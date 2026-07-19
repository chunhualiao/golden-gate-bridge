import * as THREE from 'three';

// Free-fly camera: drag to look, WASD/arrows to move, Q/E (or Space) down/up,
// Shift = boost, mouse wheel = base speed. OrbitControls is disabled while active.
export function createFlyControls(camera, dom) {
  let active = false;
  let dragging = false;
  let lastX = 0, lastY = 0;
  let yaw = 0, pitch = 0;
  let speed = 80; // m/s
  const keys = new Set();
  const euler = new THREE.Euler(0, 0, 0, 'YXZ');
  const fwd = new THREE.Vector3();
  const right = new THREE.Vector3();
  const move = new THREE.Vector3();
  const UP = new THREE.Vector3(0, 1, 0);
  const LOOK_SPEED = 0.0032;

  function syncFromCamera() {
    const d = camera.getWorldDirection(new THREE.Vector3());
    pitch = Math.asin(THREE.MathUtils.clamp(d.y, -1, 1));
    yaw = Math.atan2(-d.x, -d.z);
  }

  function onPointerDown(e) {
    if (e.button !== 0) return;
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    dom.style.cursor = 'grabbing';
  }
  function onPointerMove(e) {
    if (!dragging) return;
    // manual deltas — movementX is unreliable on synthetic/CDP input
    const dx = e.clientX - lastX, dy = e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
    yaw -= dx * LOOK_SPEED;
    pitch = THREE.MathUtils.clamp(pitch - dy * LOOK_SPEED, -1.55, 1.55);
  }
  function onPointerUp() {
    dragging = false;
    if (active) dom.style.cursor = 'grab';
  }
  function onKeyDown(e) {
    if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
    keys.add(e.code);
  }
  function onKeyUp(e) { keys.delete(e.code); }
  function onWheel(e) {
    e.preventDefault();
    speed = THREE.MathUtils.clamp(speed * (e.deltaY < 0 ? 1.2 : 1 / 1.2), 5, 900);
  }

  function enter() {
    if (active) return;
    active = true;
    syncFromCamera();
    dom.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    dom.addEventListener('wheel', onWheel, { passive: false });
    dom.style.cursor = 'grab';
  }

  function exit() {
    active = false;
    dragging = false;
    keys.clear();
    dom.removeEventListener('pointerdown', onPointerDown);
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    dom.removeEventListener('wheel', onWheel);
    dom.style.cursor = '';
  }

  function update(dt) {
    euler.set(pitch, yaw, 0);
    camera.quaternion.setFromEuler(euler);

    camera.getWorldDirection(fwd);
    right.crossVectors(fwd, UP).normalize();
    move.set(0, 0, 0);
    if (keys.has('KeyW') || keys.has('ArrowUp')) move.add(fwd);
    if (keys.has('KeyS') || keys.has('ArrowDown')) move.sub(fwd);
    if (keys.has('KeyD') || keys.has('ArrowRight')) move.add(right);
    if (keys.has('KeyA') || keys.has('ArrowLeft')) move.sub(right);
    if (keys.has('KeyE') || keys.has('Space')) move.y += 1;
    if (keys.has('KeyQ')) move.y -= 1;
    if (move.lengthSq() === 0) return;
    const boost = (keys.has('ShiftLeft') || keys.has('ShiftRight')) ? 3 : 1;
    camera.position.addScaledVector(move.normalize(), speed * boost * dt);
  }

  return {
    enter, exit, update, syncFromCamera,
    get isActive() { return active; },
    get isDragging() { return dragging; },
    get speed() { return speed; },
  };
}
