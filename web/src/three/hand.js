import * as THREE from 'three';

// PLACEHOLDER GEOMETRY — not the real hand.
//
// Stands in for the InMoov assembly until real STLs land. What matters is that
// the *structure* is correct: every part is a separately named object with its
// own pivot and its own `userData.explode` travel vector. Swapping in real
// meshes means matching these names and reusing the same vectors — the
// choreography in scene.js never has to change.
//
// Naming follows the InMoov convention so the mapping is unambiguous:
//   forearm.shell.{upper,lower} · servo.{thumb,index,middle,ring,pinky}
//   pcb.afe · mcu.esp32 · palm.core · finger.<name>.{prox,mid,dist}

const FINGERS = [
  { id: 'thumb',  x: -0.98, z:  0.62, len: 0.78, rot:  0.55, scale: 0.92 },
  { id: 'index',  x: -0.46, z: -0.10, len: 1.02, rot:  0.10, scale: 1.0 },
  { id: 'middle', x:  0.00, z: -0.18, len: 1.12, rot:  0.0,  scale: 1.0 },
  { id: 'ring',   x:  0.46, z: -0.10, len: 1.00, rot: -0.10, scale: 0.96 },
  { id: 'pinky',  x:  0.88, z:  0.10, len: 0.80, rot: -0.22, scale: 0.86 },
];

const mkMat = (o) => new THREE.MeshStandardMaterial(o);

const MATS = {
  shell: () => mkMat({ color: 0xdfe3e8, roughness: 0.72, metalness: 0.04 }),
  shellIn: () => mkMat({ color: 0x9aa2ad, roughness: 0.85, metalness: 0.03 }),
  joint: () => mkMat({ color: 0x2b3038, roughness: 0.5, metalness: 0.3 }),
  servo: () => mkMat({ color: 0x2b6fd4, roughness: 0.6, metalness: 0.1 }),
  pcb: () => mkMat({ color: 0x123028, roughness: 0.62, metalness: 0.12 }),
  metal: () => mkMat({ color: 0xb9bfc9, roughness: 0.3, metalness: 0.9 }),
  tendon: () => mkMat({ color: 0xff7a2f, roughness: 0.45, metalness: 0.1, emissive: 0xff7a2f, emissiveIntensity: 0.35 }),
};

function rounded(w, h, d, mat, r = 0.09) {
  const s = new THREE.Shape();
  const rr = Math.min(r, w / 2.2, d / 2.2);
  s.moveTo(-w / 2 + rr, -d / 2);
  s.lineTo(w / 2 - rr, -d / 2);
  s.quadraticCurveTo(w / 2, -d / 2, w / 2, -d / 2 + rr);
  s.lineTo(w / 2, d / 2 - rr);
  s.quadraticCurveTo(w / 2, d / 2, w / 2 - rr, d / 2);
  s.lineTo(-w / 2 + rr, d / 2);
  s.quadraticCurveTo(-w / 2, d / 2, -w / 2, d / 2 - rr);
  s.lineTo(-w / 2, -d / 2 + rr);
  s.quadraticCurveTo(-w / 2, -d / 2, -w / 2 + rr, -d / 2);
  const g = new THREE.ExtrudeGeometry(s, {
    depth: h, bevelEnabled: true, bevelThickness: 0.02,
    bevelSize: 0.02, bevelSegments: 2, curveSegments: 8,
  });
  g.rotateX(-Math.PI / 2);
  g.translate(0, -h / 2, 0);
  const m = new THREE.Mesh(g, mat);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function phalanx(len, w, mat) {
  const g = new THREE.Group();
  const seg = rounded(w, 0.3, len, mat, 0.11);
  seg.position.z = len / 2;
  g.add(seg);
  const knuckle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.155, 0.155, w * 1.04, 20),
    MATS.joint(),
  );
  knuckle.rotation.z = Math.PI / 2;
  knuckle.castShadow = true;
  g.add(knuckle);
  return g;
}

function buildFinger(f, parts) {
  const root = new THREE.Group();
  root.name = `finger.${f.id}`;
  root.position.set(f.x, 0.06, f.z);
  root.rotation.y = f.rot;
  root.scale.setScalar(f.scale);

  const L = [f.len * 0.44, f.len * 0.32, f.len * 0.26];
  const W = [0.34, 0.30, 0.26];

  const prox = phalanx(L[0], W[0], MATS.shell());
  prox.name = `finger.${f.id}.prox`;
  root.add(prox);

  const mid = phalanx(L[1], W[1], MATS.shell());
  mid.name = `finger.${f.id}.mid`;
  mid.position.z = L[0];
  prox.add(mid);

  const dist = phalanx(L[2], W[2], MATS.shell());
  dist.name = `finger.${f.id}.dist`;
  dist.position.z = L[1];
  mid.add(dist);

  // Fingertip pad.
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.13, 18, 14), MATS.shellIn());
  tip.position.z = L[2];
  tip.scale.set(1, 0.8, 1.25);
  tip.castShadow = true;
  dist.add(tip);

  // Tendon — the amber line is the one visual cue tying actuation to signal.
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, -0.1, 0),
    new THREE.Vector3(0, -0.12, L[0]),
    new THREE.Vector3(0, -0.1, L[0] + L[1]),
    new THREE.Vector3(0, -0.06, L[0] + L[1] + L[2] * 0.8),
  ]);
  const tendon = new THREE.Mesh(
    new THREE.TubeGeometry(curve, 30, 0.022, 6, false),
    MATS.tendon(),
  );
  tendon.name = `tendon.${f.id}`;
  root.add(tendon);

  // Curl pivots, driven by the actuation demo.
  parts.joints.push({ id: f.id, prox, mid, dist });

  root.userData.explode = new THREE.Vector3(f.x * 0.55, 0.30, -0.55);
  parts.explodable.push(root);
  return root;
}

export function buildHand() {
  const hand = new THREE.Group();
  hand.name = 'emg-hand.placeholder';

  const parts = { explodable: [], joints: [], shells: [], internals: [] };

  /* ---- forearm: split shell, the piece that opens ---- */

  const forearm = new THREE.Group();
  forearm.name = 'forearm';
  forearm.position.z = -2.5;

  const upper = rounded(1.75, 0.42, 2.55, MATS.shell(), 0.42);
  upper.name = 'forearm.shell.upper';
  upper.position.y = 0.42;
  upper.userData.explode = new THREE.Vector3(0, 1.55, -0.35);
  forearm.add(upper);
  parts.explodable.push(upper);
  parts.shells.push(upper);

  const lower = rounded(1.75, 0.42, 2.55, MATS.shell(), 0.42);
  lower.name = 'forearm.shell.lower';
  lower.position.y = -0.42;
  lower.userData.explode = new THREE.Vector3(0, -1.5, -0.35);
  forearm.add(lower);
  parts.explodable.push(lower);
  parts.shells.push(lower);

  /* ---- internals revealed when the shell opens ---- */

  // Five servos in a staggered bank.
  FINGERS.forEach((f, i) => {
    const s = new THREE.Group();
    s.name = `servo.${f.id}`;
    const body = rounded(0.5, 0.44, 0.26, MATS.servo(), 0.04);
    body.rotation.x = Math.PI / 2;
    s.add(body);
    const boss = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.1, 14), MATS.metal());
    boss.position.set(0, 0.2, 0.16);
    s.add(boss);

    s.position.set(-0.62 + i * 0.31, (i % 2 ? 0.14 : -0.14), -0.35 + (i % 2) * 0.5);
    s.userData.explode = new THREE.Vector3((i - 2) * 0.55, (i % 2 ? 0.7 : -0.7), -0.9);
    forearm.add(s);
    parts.explodable.push(s);
    parts.internals.push(s);
  });

  // AFE board.
  const board = rounded(1.25, 0.07, 0.95, MATS.pcb(), 0.05);
  board.name = 'pcb.afe';
  board.position.set(0, 0.02, 0.82);
  board.userData.explode = new THREE.Vector3(-1.65, 0.15, 0.35);
  forearm.add(board);
  parts.explodable.push(board);
  parts.internals.push(board);

  // A few components on it so it reads as populated at distance.
  for (let i = 0; i < 6; i++) {
    const c = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.06, 0.07),
      i % 2 ? MATS.joint() : MATS.metal(),
    );
    c.position.set(-0.42 + i * 0.17, 0.07, 0.82 + (i % 2 ? 0.16 : -0.16));
    forearm.add(c);
    board.attach(c);
  }

  // MCU.
  const mcu = rounded(0.82, 0.06, 0.42, MATS.pcb(), 0.04);
  mcu.name = 'mcu.esp32';
  mcu.position.set(0, 0.02, -1.15);
  mcu.userData.explode = new THREE.Vector3(1.65, 0.2, -0.5);
  forearm.add(mcu);
  parts.explodable.push(mcu);
  parts.internals.push(mcu);

  const shield = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.05, 0.28), MATS.metal());
  shield.position.set(-0.18, 0.06, 0);
  mcu.add(shield);

  hand.add(forearm);

  /* ---- wrist + palm ---- */

  const wrist = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.62, 0.42, 24), MATS.joint());
  wrist.name = 'wrist';
  wrist.rotation.x = Math.PI / 2;
  wrist.position.z = -1.05;
  wrist.castShadow = true;
  wrist.userData.explode = new THREE.Vector3(0, -0.2, -0.7);
  hand.add(wrist);
  parts.explodable.push(wrist);

  const palm = rounded(1.9, 0.42, 1.5, MATS.shell(), 0.3);
  palm.name = 'palm.core';
  palm.position.z = -0.15;
  palm.userData.explode = new THREE.Vector3(0, 0.1, 0.15);
  hand.add(palm);
  parts.explodable.push(palm);
  parts.shells.push(palm);

  // Tendon routing plate inside the palm.
  const plate = rounded(1.4, 0.05, 1.0, MATS.metal(), 0.06);
  plate.name = 'palm.routing';
  plate.position.set(0, -0.1, -0.15);
  plate.userData.explode = new THREE.Vector3(0, -0.95, 0.1);
  hand.add(plate);
  parts.explodable.push(plate);
  parts.internals.push(plate);

  /* ---- fingers ---- */

  const fingerRoot = new THREE.Group();
  fingerRoot.name = 'fingers';
  fingerRoot.position.z = 0.55;
  FINGERS.forEach((f) => fingerRoot.add(buildFinger(f, parts)));
  hand.add(fingerRoot);

  // Cache rest positions so explode/collapse is a pure lerp.
  parts.explodable.forEach((o) => {
    o.userData.rest = o.position.clone();
    if (!o.userData.explode) o.userData.explode = new THREE.Vector3();
  });

  hand.userData.parts = parts;
  return hand;
}

// t = 0 assembled, t = 1 fully exploded.
export function setExplode(hand, t) {
  const e = t * t * (3 - 2 * t); // smoothstep
  hand.userData.parts.explodable.forEach((o) => {
    const rest = o.userData.rest;
    const off = o.userData.explode;
    o.position.set(
      rest.x + off.x * e,
      rest.y + off.y * e,
      rest.z + off.z * e,
    );
  });
}

// t = 0 open, t = 1 fully curled.
export function setCurl(hand, t) {
  hand.userData.parts.joints.forEach(({ id, prox, mid, dist }) => {
    const bias = id === 'thumb' ? 0.72 : 1;
    prox.rotation.x = -t * 1.05 * bias;
    mid.rotation.x = -t * 1.25 * bias;
    dist.rotation.x = -t * 0.95 * bias;
  });
}
