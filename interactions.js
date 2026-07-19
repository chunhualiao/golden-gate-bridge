import * as THREE from 'three';
import { createFlyControls } from './fly.js';

const INFO = {
  tower: {
    title: 'The Towers',
    body: 'Two 227 m Art Deco towers rise above the strait — until 1998 the tallest bridge towers in the world. Each contains ~22,000 tonnes of steel, stepped back at four portal struts. Architect Irving Morrow designed the vertical fluting and setbacks that make them iconic.',
  },
  cable: {
    title: 'Main Cables',
    body: 'Each of the two main cables is 2,332 m long and 92 cm in diameter, spun from 27,572 galvanized steel wires — about 129,000 km of wire per bridge, enough to circle the Earth three times. They drape 144 m from the tower saddles to midspan.',
  },
  suspender: {
    title: 'Suspender Ropes',
    body: 'Vertical suspender ropes hang every 15.24 m along both cables, transferring the deck load into the main cables. Each hanger is a bundle of four steel ropes, clamped to the cable above and socketed into the stiffening truss below.',
  },
  deck: {
    title: 'Roadway Deck',
    body: 'Six lanes of US-101, 27 m wide, carried 67 m above the water. The orange stiffening truss underneath is 7.6 m deep and keeps the deck rigid in wind. The original concrete deck was replaced with a lighter steel orthotropic deck in 1982–86.',
  },
  anchorage: {
    title: 'Anchorages',
    body: 'Two colossal concrete blocks lock the cable ends into the shore. Inside each anchorage the cable splays into 61 strands, each looped over a strand shoe embedded deep in ~60,000 tonnes of concrete. The whole bridge hangs from these.',
  },
  pier: {
    title: 'Piers & Pylons',
    body: 'The south tower pier stands in 30 m of open water inside an oval concrete fender — built by divers in 1933–34, one of the great feats of bridge construction. Concrete pylons and viaduct piers carry the approach roadways to the abutments.',
  },
  general: {
    title: 'Golden Gate Bridge',
    body: 'Opened May 27, 1937. Main span 1,280 m — the world\'s longest until 1964. Chief engineer Joseph B. Strauss; Irving Morrow chose the "International Orange" color (#C0362C) to stand out in fog and blend with the headlands. Total length 2.71 km.',
  },
};

const PRESETS = {
  overview: { pos: [1250, 380, 1450], tgt: [0, 90, 0] },
  deck:     { pos: [900, 71.5, 3],    tgt: [-200, 69, 0] },
  tower:    { pos: [752, 255, 155],   tgt: [640, 205, 0] },
  side:     { pos: [0, 120, 1950],    tgt: [0, 105, 0] },
};
const PRESET_KEYS = ['overview', 'deck', 'tower', 'side'];

export function initInteractions({ renderer, camera, controls, env, bridge, traffic }) {
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2(-10, -10);
  let pointerClient = { x: 0, y: 0 };
  let pointerDirty = false;
  let hoveredKey = null;

  const tip = document.getElementById('hover-tip');
  const card = document.getElementById('info-card');
  const cardTitle = document.getElementById('info-title');
  const cardBody = document.getElementById('info-body');

  // --- Hover tracking ---
  renderer.domElement.addEventListener('pointermove', (e) => {
    pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
    pointerClient = { x: e.clientX, y: e.clientY };
    pointerDirty = true;
  });

  // --- Click (distinguished from orbit-drag by movement threshold) ---
  let downPos = null;
  renderer.domElement.addEventListener('pointerdown', (e) => { downPos = { x: e.clientX, y: e.clientY }; });
  renderer.domElement.addEventListener('pointerup', (e) => {
    if (!downPos) return;
    const moved = Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y);
    downPos = null;
    if (moved > 6) return;
    if (hoveredKey && INFO[hoveredKey]) showCard(hoveredKey);
    else hideCard();
  });

  function showCard(key) {
    cardTitle.textContent = INFO[key].title;
    cardBody.textContent = INFO[key].body;
    card.classList.add('visible');
  }
  function hideCard() { card.classList.remove('visible'); }
  document.getElementById('info-close').addEventListener('click', hideCard);

  // --- Camera preset fly-to ---
  let tween = null;
  function flyTo(name) {
    const p = PRESETS[name];
    tween = {
      t: 0, dur: 1.5,
      fromPos: camera.position.clone(), toPos: new THREE.Vector3(...p.pos),
      fromTgt: controls.target.clone(), toTgt: new THREE.Vector3(...p.tgt),
    };
    controls.enabled = false;
  }

  // --- Movement mode: orbit <-> fly ---
  const fly = createFlyControls(camera, renderer.domElement);
  let mode = 'orbit';
  document.querySelectorAll('[data-mode]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.dataset.mode === mode) return;
      mode = btn.dataset.mode;
      document.querySelectorAll('[data-mode]').forEach(b => b.classList.toggle('active', b === btn));
      if (mode === 'fly') {
        controls.enabled = false;
        fly.enter();
      } else {
        fly.exit();
        // put the orbit pivot back out in front of the camera
        const fwd = camera.getWorldDirection(new THREE.Vector3());
        controls.target.copy(camera.position).addScaledVector(fwd, 400);
        controls.enabled = true;
        controls.update();
      }
    });
  });
  document.querySelectorAll('[data-preset]').forEach(btn => {
    btn.addEventListener('click', () => flyTo(btn.dataset.preset));
  });
  window.addEventListener('keydown', (e) => {
    const i = ['1', '2', '3', '4'].indexOf(e.key);
    if (i >= 0) flyTo(PRESET_KEYS[i]);
    if (e.key === 'Escape') hideCard();
  });

  // --- Toggle buttons ---
  document.querySelectorAll('[data-toggle]').forEach(btn => {
    btn.addEventListener('click', () => {
      const on = btn.classList.toggle('active');
      switch (btn.dataset.toggle) {
        case 'night': env.setNight(on); break;
        case 'rotate': controls.autoRotate = on; controls.autoRotateSpeed = 0.55; break;
        case 'traffic': traffic.group.visible = on; break;
        case 'wireframe': bridge.materials.forEach(m => { m.wireframe = on; }); break;
      }
    });
  });

  // --- Fog slider ---
  const fogSlider = document.getElementById('fog-slider');
  const fogValue = document.getElementById('fog-value');
  env.setFog(fogSlider.value / 100);
  fogSlider.addEventListener('input', () => {
    fogValue.textContent = `${fogSlider.value}%`;
    env.setFog(fogSlider.value / 100);
  });

  // --- Per-frame update ---
  const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - ((-2 * t + 2) ** 3) / 2);

  function update(dt) {
    // camera tween
    if (tween) {
      tween.t += dt / tween.dur;
      const k = easeInOut(Math.min(tween.t, 1));
      camera.position.lerpVectors(tween.fromPos, tween.toPos, k);
      controls.target.lerpVectors(tween.fromTgt, tween.toTgt, k);
      camera.lookAt(controls.target); // controls.update() is paused during the tween
      if (tween.t >= 1) {
        tween = null;
        if (mode === 'fly') fly.syncFromCamera();
        else controls.enabled = true;
      }
    } else if (mode === 'fly') {
      fly.update(dt);
    }

    // hover raycast (only when the pointer moved; not while fly-dragging)
    if (pointerDirty && !tween && !(mode === 'fly' && fly.isDragging)) {
      pointerDirty = false;
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(bridge.pickables, false);
      const key = hits.length ? hits[0].object.userData.key : null;
      if (key !== hoveredKey) {
        hoveredKey = key;
        bridge.setHighlight(key);
        renderer.domElement.style.cursor = key ? 'pointer' : '';
        if (key) {
          tip.textContent = hits[0].object.userData.label;
          tip.style.display = 'block';
        } else {
          tip.style.display = 'none';
        }
      }
      if (hoveredKey) {
        tip.style.left = `${pointerClient.x + 14}px`;
        tip.style.top = `${pointerClient.y + 12}px`;
      }
    }
  }

  return { update, fly };
}
