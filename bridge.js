import * as THREE from 'three';

// ---------------------------------------------------------------------------
// Dimensions (metres, 1 unit = 1 m). Water level y = 0.
// ---------------------------------------------------------------------------
export const DECK_TOP = 67;          // roadway surface above water
const TRUSS_BOTTOM = 59.4;           // underside of the stiffening truss
const TOWER_X = 640;                 // towers at x = ±640 (main span 1,280 m)
const TOWER_TOP = 227;               // tower height above water
const SADDLE_Y = 224;                // main-cable saddle elevation
const MID_CABLE_Y = 80;              // cable elevation at midspan (sag ≈ 144 m)
const ANCHOR_X = 983;                // anchorages at x = ±983 (side spans 343 m)
const ANCHOR_CABLE_Y = 18;           // cable dead-end elevation inside anchorage
const DECK_END = 1120;               // end of modelled approach viaducts
const CABLE_Z = 13.5;                // cable planes at z = ±13.5
const LEG_Z = 16.5;                  // tower-leg centrelines at z = ±16.5
const DECK_HALF_W = 13.5;
const SUSP_SPACING = 15.24;          // suspender spacing (50 ft)

// Main-cable elevation at station x (parabolic main span, near-straight side spans)
export function cableY(x) {
  const ax = Math.abs(x);
  if (ax <= TOWER_X) {
    return MID_CABLE_Y + (SADDLE_Y - MID_CABLE_Y) * (x / TOWER_X) ** 2;
  }
  const t = (ax - TOWER_X) / (ANCHOR_X - TOWER_X); // 0 at tower, 1 at anchorage
  const yLine = SADDLE_Y + (ANCHOR_CABLE_Y - SADDLE_Y) * t;
  return yLine - 7 * Math.sin(Math.PI * t); // slight catenary droop
}

const INTL_ORANGE = 0xc84434; // "International Orange", brightened for tone mapping

// ---------------------------------------------------------------------------
// Procedural canvas textures (weathering, asphalt, concrete formwork)
// ---------------------------------------------------------------------------
function makeTexture(size, painter, repeatX = 1, repeatY = 1) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  painter(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeatX, repeatY);
  t.anisotropy = 8;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function speckle(ctx, size, count, alpha) {
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = Math.random() < 0.5
      ? `rgba(0,0,0,${alpha * Math.random()})`
      : `rgba(255,255,255,${alpha * 0.8 * Math.random()})`;
    ctx.fillRect(Math.random() * size, Math.random() * size, 1 + Math.random() * 2, 1 + Math.random() * 2);
  }
}
const steelTex = makeTexture(256, (ctx, s) => {
  ctx.fillStyle = '#c84434'; ctx.fillRect(0, 0, s, s);
  speckle(ctx, s, 5000, 0.06);
  for (let i = 0; i < 40; i++) { // vertical weathering streaks
    ctx.fillStyle = `rgba(60,15,10,${0.03 + Math.random() * 0.04})`;
    ctx.fillRect(Math.random() * s, 0, 1 + Math.random() * 2, s);
  }
});
const asphaltTex = makeTexture(512, (ctx, s) => {
  ctx.fillStyle = '#35383c'; ctx.fillRect(0, 0, s, s);
  speckle(ctx, s, 12000, 0.09);
  for (let i = 0; i < 14; i++) { // patches and repairs
    ctx.fillStyle = `rgba(0,0,0,${0.04 + Math.random() * 0.05})`;
    ctx.beginPath();
    ctx.ellipse(Math.random() * s, Math.random() * s, 20 + Math.random() * 60,
                10 + Math.random() * 30, Math.random() * 3, 0, 7);
    ctx.fill();
  }
}, 112, 2);
const concreteTex = makeTexture(256, (ctx, s) => {
  ctx.fillStyle = '#b0a99d'; ctx.fillRect(0, 0, s, s);
  speckle(ctx, s, 5000, 0.07);
  for (let i = 1; i < 6; i++) { // formwork lines
    ctx.fillStyle = 'rgba(0,0,0,0.05)';
    ctx.fillRect(0, (s / 6) * i, s, 1);
  }
});

// ---------------------------------------------------------------------------
export function buildBridge(scene) {
  const group = new THREE.Group();
  const pickables = [];
  const dummy = new THREE.Object3D();

  // Materials — one per component so hover highlighting can address them.
  const matTower     = new THREE.MeshStandardMaterial({ color: 0xffffff, map: steelTex, roughness: 0.5,  metalness: 0.4 });
  const matCable     = new THREE.MeshStandardMaterial({ color: 0xffffff, map: steelTex, roughness: 0.45, metalness: 0.45 });
  const matTruss     = new THREE.MeshStandardMaterial({ color: 0xffffff, map: steelTex, roughness: 0.55, metalness: 0.35 });
  const matSuspender = new THREE.MeshStandardMaterial({ color: 0xffffff, map: steelTex, roughness: 0.5,  metalness: 0.4 });
  const matRailing   = new THREE.MeshStandardMaterial({ color: 0xffffff, map: steelTex, roughness: 0.5,  metalness: 0.4 });
  const matRoad      = new THREE.MeshStandardMaterial({ color: 0xffffff, map: asphaltTex, roughness: 0.95, metalness: 0.0 });
  const matConcAnchor= new THREE.MeshStandardMaterial({ color: 0xffffff, map: concreteTex, roughness: 0.9, metalness: 0.0 });
  const matConcPier  = new THREE.MeshStandardMaterial({ color: 0xffffff, map: concreteTex, roughness: 0.9, metalness: 0.0 });
  const matMedian    = new THREE.MeshStandardMaterial({ color: 0xffffff, map: concreteTex, roughness: 0.85, metalness: 0.0 });
  const matLineW     = new THREE.MeshStandardMaterial({ color: 0xd6d6d0, roughness: 0.8,  metalness: 0.0 });
  const matLineY     = new THREE.MeshStandardMaterial({ color: 0xd9b83c, roughness: 0.8,  metalness: 0.0 });
  const matLampPost  = new THREE.MeshStandardMaterial({ color: 0x6a7076, roughness: 0.6,  metalness: 0.6 });
  const matLampGlobe = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 });
  matLampGlobe.color.setRGB(1.5, 1.25, 0.8); // HDR for bloom

  const materials = [matTower, matCable, matTruss, matSuspender, matRailing, matRoad,
                     matConcAnchor, matConcPier, matMedian, matLineW, matLineY, matLampPost];

  function addMesh(geo, mat, x, y, z, key, label, { shadow = true } = {}) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = shadow;
    m.receiveShadow = true;
    if (key) { m.userData.key = key; m.userData.label = label; pickables.push(m); }
    group.add(m);
    return m;
  }

  // -------------------------------------------------------------------------
  // Towers
  // -------------------------------------------------------------------------
  // Leg segments between strut levels: [y0, y1, legWidthX]
  const LEG_LEVELS = [
    [8, 100, 11], [100, 138, 10], [138, 176, 9], [176, 214, 8], [214, SADDLE_Y, 7],
  ];
  const STRUT_LEVELS = [100, 138, 176, 214]; // four portal struts above the roadway

  function buildTower(xPos) {
    // Concrete pier / fender
    addMesh(new THREE.BoxGeometry(30, 10, 48), matConcPier, xPos, 3, 0, 'pier', 'Tower pier');

    for (const side of [-1, 1]) {
      const z = side * LEG_Z;
      for (const [y0, y1, w] of LEG_LEVELS) {
        addMesh(new THREE.BoxGeometry(w, y1 - y0, 5.5), matTower,
                xPos, (y0 + y1) / 2, z, 'tower', 'Tower (227 m)');
      }
      // Crown setback + saddle housing reaching inboard to catch the cable
      addMesh(new THREE.BoxGeometry(5, TOWER_TOP - SADDLE_Y, 4.5), matTower,
              xPos, (SADDLE_Y + TOWER_TOP) / 2, z, 'tower', 'Tower (227 m)');
      addMesh(new THREE.BoxGeometry(7, 7.45, 4.5), matTower,
              xPos, SADDLE_Y - 4.3, side * (CABLE_Z + 1.75), 'tower', 'Cable saddle');
    }

    // Portal struts (solid Art Deco struts spanning both legs)
    for (const y of STRUT_LEVELS) {
      const w = y === 100 ? 10 : y === 138 ? 9 : y === 176 ? 8 : 7;
      addMesh(new THREE.BoxGeometry(w, 8, 38.5), matTower, xPos, y, 0, 'tower', 'Portal strut');
    }
    // Below-roadway strut
    addMesh(new THREE.BoxGeometry(11, 10, 38.5), matTower, xPos, 50, 0, 'tower', 'Tower (227 m)');
  }
  buildTower(-TOWER_X);
  buildTower(TOWER_X);

  // Vertical fluting ribs on the tower legs (Art Deco detail, one instanced mesh)
  const ribs = [];
  for (const xPos of [-TOWER_X, TOWER_X]) {
    for (const side of [-1, 1]) {
      const zc = side * LEG_Z;
      for (const [y0, y1, w] of LEG_LEVELS) {
        const h = y1 - y0, ym = (y0 + y1) / 2;
        for (const xf of [-1, 1]) { // broad faces (facing along the bridge axis)
          for (let i = 0; i < 4; i++) {
            ribs.push([xPos + xf * (w / 2 + 0.12), ym, zc - 2.2 + i * 1.45, 0.3, h, 0.55]);
          }
        }
        for (const zf of [-1, 1]) { // side faces
          const n = Math.max(2, Math.floor((w - 1.2) / 1.6));
          for (let i = 0; i < n; i++) {
            ribs.push([xPos - (n - 1) * 0.8 + i * 1.6, ym, zc + zf * (2.75 + 0.12), 0.55, h, 0.3]);
          }
        }
      }
    }
  }
  const ribInst = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), matTower, ribs.length);
  ribs.forEach((r, i) => {
    dummy.position.set(r[0], r[1], r[2]);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(r[3], r[4], r[5]);
    dummy.updateMatrix();
    ribInst.setMatrixAt(i, dummy.matrix);
  });
  ribInst.castShadow = true;
  ribInst.userData.key = 'tower';
  ribInst.userData.label = 'Tower (227 m)';
  pickables.push(ribInst);
  group.add(ribInst);

  // -------------------------------------------------------------------------
  // Main cables (Catmull-Rom through parabola samples → tube)
  // -------------------------------------------------------------------------
  const cablePts = [];
  for (let x = -ANCHOR_X; x <= ANCHOR_X; x += 20) {
    cablePts.push(new THREE.Vector3(x, cableY(x), 0));
  }
  for (const side of [-1, 1]) {
    const pts = cablePts.map(p => new THREE.Vector3(p.x, p.y, side * CABLE_Z));
    const curve = new THREE.CatmullRomCurve3(pts);
    const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 260, 0.55, 10, false), matCable);
    tube.castShadow = true;
    tube.userData.key = 'cable';
    tube.userData.label = 'Main cable';
    pickables.push(tube);
    group.add(tube);
  }

  // -------------------------------------------------------------------------
  // Suspenders — one instanced mesh of unit cylinders
  // -------------------------------------------------------------------------
  const suspX = [];
  for (let x = -ANCHOR_X + SUSP_SPACING; x <= ANCHOR_X - SUSP_SPACING; x += SUSP_SPACING) {
    if (cableY(x) - DECK_TOP > 1.2) suspX.push(x);
  }
  const suspCount = suspX.length * 2;
  const suspGeo = new THREE.CylinderGeometry(0.12, 0.12, 1, 6);
  const suspenders = new THREE.InstancedMesh(suspGeo, matSuspender, suspCount);
  let si = 0;
  for (const side of [-1, 1]) {
    for (const x of suspX) {
      const top = cableY(x) - 0.4;
      const bottom = DECK_TOP - 1;
      dummy.position.set(x, (top + bottom) / 2, side * CABLE_Z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, top - bottom, 1);
      dummy.updateMatrix();
      suspenders.setMatrixAt(si++, dummy.matrix);
    }
  }
  suspenders.userData.key = 'suspender';
  suspenders.userData.label = 'Suspender ropes';
  pickables.push(suspenders);
  group.add(suspenders);

  // -------------------------------------------------------------------------
  // Deck — slab, lanes, railing, stiffening truss
  // -------------------------------------------------------------------------
  const deckLen = DECK_END * 2;
  addMesh(new THREE.BoxGeometry(deckLen, 1.0, DECK_HALF_W * 2), matRoad,
          0, DECK_TOP - 0.5, 0, 'deck', 'Roadway deck');

  // Lane lines (6 lanes of 4.5 m) + median barrier
  for (const z of [-9, -4.5, 4.5, 9]) {
    addMesh(new THREE.BoxGeometry(deckLen, 0.04, 0.18), matLineW, 0, DECK_TOP + 0.01, z);
  }
  for (const z of [-0.35, 0.35]) {
    addMesh(new THREE.BoxGeometry(deckLen, 0.04, 0.18), matLineY, 0, DECK_TOP + 0.01, z);
  }
  addMesh(new THREE.BoxGeometry(deckLen, 0.8, 1.0), matMedian, 0, DECK_TOP + 0.4, 0, 'deck', 'Median barrier');

  // Railings
  for (const side of [-1, 1]) {
    addMesh(new THREE.BoxGeometry(deckLen, 1.1, 0.25), matRailing,
            0, DECK_TOP + 0.55, side * (DECK_HALF_W - 0.12), 'deck', 'Railing');
  }

  // Stiffening truss: chords (continuous) + instanced verticals/diagonals/floor beams
  for (const side of [-1, 1]) {
    for (const y of [DECK_TOP - 1, TRUSS_BOTTOM + 0.45]) {
      addMesh(new THREE.BoxGeometry(deckLen, 0.9, 0.9), matTruss, 0, y, side * CABLE_Z, 'deck', 'Stiffening truss');
    }
  }
  const trussX = [];
  for (let x = -DECK_END; x <= DECK_END; x += SUSP_SPACING) trussX.push(x);
  const trussH = (DECK_TOP - 1) - (TRUSS_BOTTOM + 0.45);
  const trussMidY = ((DECK_TOP - 1) + (TRUSS_BOTTOM + 0.45)) / 2;
  const diagLen = Math.hypot(SUSP_SPACING, trussH);
  const diagAng = Math.atan2(trussH, SUSP_SPACING);
  const trussInstCount = trussX.length * 2          // verticals (two sides)
                       + (trussX.length - 1) * 2    // diagonals
                       + trussX.length;             // floor beams
  const trussInst = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), matTruss, trussInstCount);
  let ti = 0;
  for (const side of [-1, 1]) {
    trussX.forEach((x, i) => {
      // vertical
      dummy.position.set(x, trussMidY, side * CABLE_Z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(0.7, trussH, 0.7);
      dummy.updateMatrix();
      trussInst.setMatrixAt(ti++, dummy.matrix);
      // diagonal (alternating)
      if (i < trussX.length - 1) {
        dummy.position.set(x + SUSP_SPACING / 2, trussMidY, side * CABLE_Z);
        dummy.rotation.set(0, 0, (i % 2 === 0 ? 1 : -1) * diagAng);
        dummy.scale.set(diagLen, 0.45, 0.45);
        dummy.updateMatrix();
        trussInst.setMatrixAt(ti++, dummy.matrix);
      }
    });
  }
  for (const x of trussX) { // transverse floor beams under the slab
    dummy.position.set(x, TRUSS_BOTTOM + 0.9, 0);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(0.8, 0.9, DECK_HALF_W * 2);
    dummy.updateMatrix();
    trussInst.setMatrixAt(ti++, dummy.matrix);
  }
  trussInst.count = ti;
  trussInst.castShadow = true;
  trussInst.userData.key = 'deck';
  trussInst.userData.label = 'Stiffening truss';
  pickables.push(trussInst);
  group.add(trussInst);

  // -------------------------------------------------------------------------
  // Anchorages, pylons, approach piers
  // -------------------------------------------------------------------------
  for (const dir of [-1, 1]) {
    addMesh(new THREE.BoxGeometry(40, 36, 42), matConcAnchor,
            dir * ANCHOR_X, 16, 0, 'anchorage', 'Anchorage');
    addMesh(new THREE.BoxGeometry(28, 12, 34), matConcAnchor,
            dir * (ANCHOR_X - 2), 40, 0, 'anchorage', 'Anchorage');
    addMesh(new THREE.BoxGeometry(10, 58, 30), matConcPier,
            dir * (ANCHOR_X + 29), 27, 0, 'pier', 'Pylon');
    for (const px of [1045, 1080, 1110]) {
      addMesh(new THREE.BoxGeometry(6, 62, 24), matConcPier,
              dir * px, 28, 0, 'pier', 'Approach pier');
    }
  }

  // -------------------------------------------------------------------------
  // Roadway lamps (posts always visible, globes fade in at night)
  // -------------------------------------------------------------------------
  const lampX = [];
  for (let x = -DECK_END + 15; x <= DECK_END - 15; x += SUSP_SPACING * 2) lampX.push(x);
  const postInst = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.12, 0.16, 7, 6), matLampPost, lampX.length);
  const globeInst = new THREE.InstancedMesh(new THREE.SphereGeometry(1.8, 8, 6), matLampGlobe, lampX.length);
  lampX.forEach((x, i) => {
    const z = (i % 2 === 0 ? 1 : -1) * (DECK_HALF_W - 0.9);
    dummy.position.set(x, DECK_TOP + 3.5, z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    postInst.setMatrixAt(i, dummy.matrix);
    dummy.position.set(x, DECK_TOP + 7.2, z);
    dummy.updateMatrix();
    globeInst.setMatrixAt(i, dummy.matrix);
  });
  group.add(postInst, globeInst);

  // -------------------------------------------------------------------------
  // Aircraft-warning beacons on the four leg crowns
  // -------------------------------------------------------------------------
  const beacons = [];
  for (const tx of [-TOWER_X, TOWER_X]) {
    for (const side of [-1, 1]) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(1.1, 10, 8),
                               new THREE.MeshBasicMaterial({ color: 0xff2222 }));
      b.material.color.setRGB(3, 0.35, 0.3); // HDR for bloom
      b.position.set(tx, TOWER_TOP + 1.2, side * LEG_Z);
      beacons.push(b);
      group.add(b);
    }
  }

  scene.add(group);

  // -------------------------------------------------------------------------
  // Hover highlighting + night floodlight glow (both drive material emissive)
  // -------------------------------------------------------------------------
  const highlightMap = {
    tower: [matTower],
    cable: [matCable],
    suspender: [matSuspender],
    deck: [matRoad, matTruss, matRailing, matMedian],
    anchorage: [matConcAnchor],
    pier: [matConcPier],
  };
  const HIGHLIGHT = new THREE.Color(0x1c4a66);
  const NIGHT_GLOW = new THREE.Color(0x8a2f12); // sodium floodlights on the orange steel
  const BLACK = new THREE.Color(0x000000);
  const glowMats = [matTower, matCable, matTruss, matSuspender, matRailing];
  const baseGlow = new Map(); // material -> base emissive Color from night glow
  let highlightedKey = null;

  function applyEmissive(m) {
    m.emissive.copy(baseGlow.get(m) || BLACK);
    if (highlightedKey && highlightMap[highlightedKey].includes(m)) m.emissive.add(HIGHLIGHT);
  }

  function setHighlight(key) {
    if (key === highlightedKey) return;
    const prev = highlightedKey ? highlightMap[highlightedKey] : [];
    highlightedKey = key;
    const next = key ? highlightMap[key] : [];
    for (const m of new Set([...prev, ...next])) applyEmissive(m);
  }

  function setNightGlow(f) {
    for (const m of glowMats) {
      baseGlow.set(m, f <= 0.01 ? BLACK : NIGHT_GLOW.clone().multiplyScalar(f * 0.9));
      applyEmissive(m);
    }
  }

  function setLampGlow(f) { matLampGlobe.opacity = f; }

  return { group, pickables, materials, beacons, setHighlight, setNightGlow, setLampGlow };
}
