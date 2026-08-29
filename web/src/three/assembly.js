import * as THREE from 'three';
import { buildComponent } from './components.js';

// Builds an upright right hand and forearm from the real InMoov print files.
//
// The source OBJs are STL exports in PRINT position — every part flat on the
// bed, and the fingers arriving as plates of six loose phalanx pieces laid out
// in a grid. Nothing self-assembles, so every rotation and position here is
// authored, and the fingers are genuinely reassembled piece by piece.
//
// World: +Y up (fingertips), +Z toward the viewer (palm faces us), millimetres.

const D = Math.PI / 180;

/* ------------------------------------------------------------ orientation */

// Maps a piece's longest axis onto +Y, so a phalanx printed on its side still
// stacks correctly along the finger.
function alignLongestToY(size) {
  const i = size.indexOf(Math.max(...size));
  if (i === 0) return [0, 0, 90];   // local +X -> +Y
  if (i === 2) return [-90, 0, 0];  // local +Z -> +Y
  return [0, 0, 0];
}

function setEuler(obj, deg) {
  obj.rotation.set(deg[0] * D, deg[1] * D, deg[2] * D);
}

// A part as one movable unit: outer group carries the "stand it up" rotation,
// inner carries a roll about the part's own axis. Two levels keeps the two
// concerns from fighting over Euler order.
function unit(part, { up = [0, 0, 0], roll = [0, 0, 0] } = {}) {
  const inner = new THREE.Group();
  for (const isl of part.islands) inner.add(isl.mesh);
  inner.position.set(-part.center[0], -part.center[1], -part.center[2]);

  const rolled = new THREE.Group();
  setEuler(rolled, roll);
  rolled.add(inner);

  const outer = new THREE.Group();
  setEuler(outer, up);
  outer.add(rolled);

  const holder = new THREE.Group();
  holder.name = part.id;
  holder.add(outer);
  return holder;
}

/* ---------------------------------------------------------------- fingers */

// A finger plate holds six pieces. The three longest are the phalanges —
// proximal, middle, distal, in descending length, which matches real finger
// proportions. The three shorter ones are the joint pieces that sit between
// them. Stacking them along +Y rebuilds the digit.
function buildFinger(part, id) {
  const g = new THREE.Group();
  g.name = `finger.${id}`;

  const isl = [...part.islands].sort(
    (a, b) => Math.max(...b.size) - Math.max(...a.size),
  );
  const segs = isl.slice(0, 3);
  const joints = isl.slice(3, 6);

  const SEG = ['prox', 'mid', 'dist'];
  let y = 0;

  segs.forEach((s, i) => {
    const len = Math.max(...s.size);

    if (joints[i]) {
      const j = joints[i];
      j.mesh.position.set(0, 0, 0);
      setEuler(j.mesh, alignLongestToY(j.size));
      const jh = new THREE.Group();
      jh.name = `finger.${id}.joint${i}`;
      jh.add(j.mesh);
      jh.position.y = y;
      jh.scale.setScalar(0.82);
      g.add(jh);
    }

    s.mesh.position.set(0, 0, 0);
    setEuler(s.mesh, alignLongestToY(s.size));
    const h = new THREE.Group();
    h.name = `finger.${id}.${SEG[i]}`;
    h.add(s.mesh);
    h.position.y = y + len / 2;
    g.add(h);

    y += len * 0.9; // slight overlap so joints read as joints, not gaps
  });

  g.userData.length = y;
  return g;
}

/* ------------------------------------------------------------- electronics */

// Bought parts, not printed, so they come from the procedural models in
// components.js scaled to their real package dimensions and dropped inside the
// forearm volume where they actually sit.
const ELECTRONICS = [
  { id: 'servo.thumb',  label: 'Thumb servo',  model: 'servo', mm: [23, 29, 12], pos: [-38, -150, 6],  info: 'mg90s' },
  { id: 'servo.index',  label: 'Index servo',  model: 'servo', mm: [23, 29, 12], pos: [-19, -178, -6], info: 'mg90s' },
  { id: 'servo.middle', label: 'Middle servo', model: 'servo', mm: [23, 29, 12], pos: [0, -150, 6],    info: 'mg90s' },
  { id: 'servo.ring',   label: 'Ring servo',   model: 'servo', mm: [23, 29, 12], pos: [19, -178, -6],  info: 'mg90s' },
  { id: 'servo.pinky',  label: 'Pinky servo',  model: 'servo', mm: [23, 29, 12], pos: [38, -150, 6],   info: 'mg90s' },
  { id: 'pcb.afe',      label: 'Analog front-end board', model: 'pcb', mm: [80, 60, 3], pos: [0, -238, 0], info: 'pcb', rot: [90, 0, 0] },
  { id: 'mcu.esp32',    label: 'ESP32-S3 controller', model: 'devboard', mm: [63, 25, 6], pos: [0, -252, 8], info: 'esp32', rot: [90, 0, 0] },
];

function buildElectronics() {
  const g = new THREE.Group();
  g.name = 'electronics';

  for (const e of ELECTRONICS) {
    const m = buildComponent(e.model);
    // buildComponent normalises to a fixed span; rescale to real millimetres.
    const bb = new THREE.Box3().setFromObject(m);
    const s = bb.getSize(new THREE.Vector3());
    m.scale.multiply(new THREE.Vector3(
      e.mm[0] / Math.max(s.x, 0.001),
      e.mm[1] / Math.max(s.y, 0.001),
      e.mm[2] / Math.max(s.z, 0.001),
    ));

    const holder = new THREE.Group();
    holder.name = e.id;
    if (e.rot) setEuler(holder, e.rot);
    holder.add(m);
    holder.position.set(...e.pos);
    holder.userData.info = e.info;
    holder.userData.label = e.label;
    g.add(holder);
  }
  return g;
}

/* ------------------------------------------------------------- the hand */

// sub drives colour coding, cascade order and the explode direction.
const SUBS = {
  shell: { hue: 0xB49AFF, slot: 0.00 },
  wrist: { hue: 0xB49AFF, slot: 0.14 },
  palm: { hue: 0xB49AFF, slot: 0.22 },
  finger: { hue: 0xFF8ABB, slot: 0.30 },
  cover: { hue: 0xFF8ABB, slot: 0.38 },
  electronics: { hue: 0x45D9F0, slot: 0.44 },
  hardware: { hue: 0xB7F056, slot: 0.52 },
};

// Fan of the four long digits across the knuckle line.
const DIGITS = [
  { id: 'index',  part: 'Index3',       x: -27, y: 52, tilt: -7,  yaw: -6, scale: 1.0 },
  { id: 'middle', part: 'Majeure3',     x: -2,  y: 56, tilt: 0,   yaw: 0,  scale: 1.0 },
  { id: 'ring',   part: 'ringfinger3',  x: 22,  y: 52, tilt: 6,   yaw: 5,  scale: 0.97 },
  { id: 'pinky',  part: 'Auriculaire3', x: 44,  y: 44, tilt: 13,  yaw: 11, scale: 0.9 },
];

export function buildHandAssembly(parts) {
  const root = new THREE.Group();
  root.name = 'inmoov.right';
  const items = [];

  const add = (obj, { sub, id, label, info, explode }) => {
    obj.userData = {
      ...obj.userData,
      sub, id, label, info,
      rest: obj.position.clone(),
      restQuat: obj.quaternion.clone(),
      explode: new THREE.Vector3(...explode),
      slot: SUBS[sub].slot,
      hue: SUBS[sub].hue,
    };
    root.add(obj);
    items.push(obj);
  };

  /* ---- forearm: two barrel sections, each a top and bottom half ---- */
  // Shell tube axis is local Z; standing it up puts the arch opening on Z, so
  // the mating half is rolled 180 degrees about that same tube axis.
  // Arch direction was measured from the meshes, not guessed: for each shell the
  // crown is narrow in X and the open rim is wide, and the two halves of a
  // section already open opposite ways. So neither needs rolling — they only
  // need offsetting off the rim plane, which is where the tube axis lies.
  //   opens: -1 = opens local -Y (material on world -Z after standing up)
  //          +1 = opens local +Y (material on world +Z)
  const SHELLS = [
    ['robpart2V4', -1, -118, 'Forearm shell, wrist section (back)'],
    ['robpart3V4', +1, -118, 'Forearm shell, wrist section (front)'],
    ['robpart4V4', +1, -222, 'Forearm shell, elbow section (front)'],
    ['robpart5V4', -1, -222, 'Forearm shell, elbow section (back)'],
  ];
  SHELLS.forEach(([pid, opens, y, label]) => {
    const p = parts.get(pid);
    if (!p) return;
    const u = unit(p, { up: [-90, 0, 0] });
    const off = (opens === -1 ? -1 : 1) * (p.size[1] / 2);
    u.position.set(0, y, off);
    add(u, {
      sub: 'shell', id: pid, label, info: 'shell',
      explode: [0, 0, Math.sign(off) * 210],
    });
  });

  const cap = parts.get('robcap3V2');
  if (cap) {
    const u = unit(cap, { up: [-90, 0, 0] });
    u.position.set(0, -282, 0);
    add(u, { sub: 'shell', id: 'robcap3V2', label: 'Forearm end cap', info: 'shell', explode: [0, -150, 0] });
  }

  /* ---- electronics, inside the forearm volume ---- */
  const elec = buildElectronics();
  for (const child of [...elec.children]) {
    add(child, {
      sub: 'electronics',
      id: child.name,
      label: child.userData.label || child.name,
      info: child.userData.info,
      explode: [child.position.x * 2.4, 10, 250],
    });
  }

  /* ---- wrist ---- */
  const WRISTS = [
    ['WristlargeV4', -58, 'Wrist plate, large', [-230, 20, 0]],
    ['WristsmallV4', -22, 'Wrist plate, small', [230, 20, 0]],
  ];
  WRISTS.forEach(([pid, y, label, exp]) => {
    const p = parts.get(pid);
    if (!p) return;
    const u = unit(p, { up: [0, 0, 0] });
    u.position.set(0, y, 0);
    add(u, { sub: 'wrist', id: pid, label, info: 'wrist', explode: exp });
  });

  /* ---- palm: base plate and top cover ---- */
  const base = parts.get('topsurface6');
  if (base) {
    const u = unit(base, { up: [0, 0, 0] });
    u.position.set(0, 6, -10);
    add(u, { sub: 'palm', id: 'topsurface6', label: 'Palm base plate', info: 'palm', explode: [0, 0, -190] });
  }
  const cover = parts.get('topsurfaceUP6');
  if (cover) {
    const u = unit(cover, { up: [-90, 0, 0] });
    u.position.set(0, 6, 12);
    add(u, { sub: 'palm', id: 'topsurfaceUP6', label: 'Palm top cover', info: 'palm', explode: [0, 0, 200] });
  }

  /* ---- four long digits ---- */
  DIGITS.forEach((d, i) => {
    const p = parts.get(d.part);
    if (!p) return;
    const f = buildFinger(p, d.id);
    const holder = new THREE.Group();
    holder.name = d.part;
    holder.add(f);
    setEuler(holder, [0, d.yaw, d.tilt]);
    holder.position.set(d.x, d.y, 0);
    holder.scale.setScalar(d.scale);
    add(holder, {
      sub: 'finger', id: d.part,
      label: `${d.id[0].toUpperCase()}${d.id.slice(1)} finger`,
      info: 'digit',
      explode: [(i - 1.5) * 90, 150, 40],
    });
  });

  /* ---- thumb: offset, rotated out of the palm plane ---- */
  const th = parts.get('thumb5');
  if (th) {
    const f = buildFinger(th, 'thumb');
    const holder = new THREE.Group();
    holder.name = 'thumb5';
    holder.add(f);
    setEuler(holder, [26, 18, 46]);
    holder.position.set(-42, -6, 6);
    add(holder, { sub: 'finger', id: 'thumb5', label: 'Thumb', info: 'digit', explode: [-190, 40, 90] });
  }

  /* ---- finger covers: one per digit, laid over the knuckle line ---- */
  const covers = parts.get('coverfinger1');
  if (covers) {
    const small = covers.islands.filter((s) => Math.max(...s.size) < 45);
    const big = covers.islands.filter((s) => Math.max(...s.size) >= 45);
    small.slice(0, 4).forEach((s, i) => {
      const d = DIGITS[i];
      s.mesh.position.set(0, 0, 0);
      setEuler(s.mesh, alignLongestToY(s.size));
      const h = new THREE.Group();
      h.name = `cover.${d.id}`;
      h.add(s.mesh);
      h.position.set(d.x, d.y + 12, 13);
      setEuler(h, [0, d.yaw, d.tilt]);
      add(h, {
        sub: 'cover', id: `cover.${d.id}`,
        label: `${d.id[0].toUpperCase()}${d.id.slice(1)} cover`,
        info: 'cover', explode: [(i - 1.5) * 70, 210, 130],
      });
    });
    big.forEach((s, i) => {
      s.mesh.position.set(0, 0, 0);
      const h = new THREE.Group();
      h.name = 'cover.knuckle';
      h.add(s.mesh);
      h.position.set(0, 34, 16);
      add(h, { sub: 'cover', id: 'cover.knuckle', label: 'Knuckle cover', info: 'cover', explode: [0, 120, 190] });
    });
  }

  /* ---- fasteners ---- */
  const bolts = parts.get('Bolt_entretoise7');
  if (bolts) {
    const u = unit(bolts, { up: [-90, 0, 0] });
    u.position.set(0, -80, -34);
    add(u, { sub: 'hardware', id: 'Bolt_entretoise7', label: 'Bolts and spacers', info: 'bolts', explode: [-170, -110, 120] });
  }

  const sup = parts.get('ardiuinosupport');
  if (sup) {
    const u = unit(sup, { up: [-90, 0, 0] });
    u.position.set(0, -262, -22);
    add(u, { sub: 'hardware', id: 'ardiuinosupport', label: 'Controller bracket', info: 'bracket', explode: [190, -60, 90] });
  }

  root.userData.items = items;
  return root;
}

/* ------------------------------------------------------------- animation */

const MAX_SLOT = 0.55;

// Travel vectors are authored generously so each part is clearly separated;
// this trims them to what stays inside a 16:9 frame.
const SPREAD = 0.68;

export function setExplode(root, t) {
  for (const o of root.userData.items) {
    let k = t * (1 + MAX_SLOT) - o.userData.slot;
    k = k < 0 ? 0 : k > 1 ? 1 : k;
    k = k * k * (3 - 2 * k);
    const r = o.userData.rest;
    const e = o.userData.explode;
    const g = k * SPREAD;
    o.position.set(r.x + e.x * g, r.y + e.y * g, r.z + e.z * g);
  }
}
