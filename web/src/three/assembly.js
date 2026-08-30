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

// Standing a printed piece up on the finger axis.
//
// The first version of this ranked the bounding-box extents and sent the
// longest to +Y. That works for a long phalanx and fails badly for a short fat
// one: the thumb's distal segment is 22 mm across and only 18 mm long, so its
// "longest axis" is its diameter and the piece came out end-on, reading as a
// ball rather than a bone.
//
// The files say it plainly instead. Every island in every part has min z = 0 --
// they are STL exports in print position, each piece standing on the bed -- and
// looking down that Z axis shows a ring for every tube-shaped piece. So the
// digit axis IS local +Z, for the 27 mm proximal and the 18 mm thumb tip alike.
// One fixed rotation stands a piece up; only its sign is in question.
const _AX = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)];

const _UP = new THREE.Quaternion().setFromAxisAngle(_AX[0], -Math.PI / 2);
const _DOWN = new THREE.Quaternion().setFromAxisAngle(_AX[0], Math.PI / 2);

// Which way up. The rotation pins the axis but not its sign, and half the
// pieces are printed nose-down. The vertex centroid settles it: a segment with
// a clevis at one end and a solid knuckle at the other carries most of its
// surface on the knuckle, so putting the heavy end at -Y makes every piece in a
// digit point the same way and the joints actually mate.
function alignPrintAxisToY(vc, noseUp = false) {
  const heavyAtTop = vc ? vc[2] > 0 : false;
  return (heavyAtTop !== noseUp) ? _DOWN.clone() : _UP.clone();
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
const jointMat = new THREE.MeshStandardMaterial({
  color: 0xd7dbe2, roughness: 0.16, metalness: 0.98,
});
const tendonMat = new THREE.MeshStandardMaterial({
  color: 0xf2f4f8, roughness: 0.35, metalness: 0.0,
});

// What is actually on a finger plate.
//
// Rendering each island on its own (tools/islands.html) shows six distinct
// pieces, not six phalanges: three tapering tube segments with a clevis at one
// end and a knuckle at the other, one smooth domed tip, and two short hinge
// blocks that sit inside the clevis at each joint. All four long-finger files
// share the same profile -- their islands come out of the pack in the same
// order with matching triangle counts (1140/1090/782/776/690/634) -- so one
// recipe covers them. The thumb is a different plate: a flat metacarpal mount,
// only two phalanges (which is anatomically right), a tip, and two hinges.
//
// Indices are into the pack's own ordering, islands sorted longest-first --
// which for these files is also tallest-on-the-bed first, so index 0 is always
// the longest segment. The thumb's index 0 is the odd one out: it is the flat
// 33 mm bracket, longest overall but only 18 mm tall.
const RECIPES = {
  long:  { chain: [0, 1, 2], tip: 4, hinge: [3, 5], tipUp: true },
  // The thumb's dome is printed the other way up, so its nose flag is inverted.
  thumb: { chain: [1, 3],    tip: 5, hinge: [2, 4], mount: 0, tipUp: false },
};

function place(mesh, vc, noseUp = false) {
  mesh.position.set(0, 0, 0);
  mesh.quaternion.copy(alignPrintAxisToY(vc, noseUp));
}

function buildFinger(part, id, kind = 'long') {
  const g = new THREE.Group();
  g.name = `finger.${id}`;

  const r = RECIPES[kind];
  const isl = part.islands;                    // already sorted longest-first
  const chain = r.chain.map((i) => isl[i]).filter(Boolean);
  const tipPiece = isl[r.tip];

  const joints = [];
  let y = 0;
  let girth = 16;

  chain.forEach((s, i) => {
    const len = s.size[2];                       // print height = segment length
    girth = Math.max(s.size[0], s.size[1]);

    place(s.mesh, s.vc);
    const h = new THREE.Group();
    h.name = `finger.${id}.seg${i}`;
    h.add(s.mesh);
    h.position.y = y + len / 2;

    // Each segment leans a little further forward than the last, so an open
    // hand reads as relaxed rather than as a stack of blocks. The lean is taken
    // about the joint below it, which is what a hinge does.
    const bend = i * 3.2;
    h.rotation.x = -bend * D;
    g.add(h);

    // Steel pin through the knuckle -- the pivot the printed parts actually
    // turn on, and the one non-plastic thing on a finger.
    const jy = y + len * 0.88;
    const pin = new THREE.Mesh(new THREE.SphereGeometry(girth * 0.15, 20, 14), jointMat);
    pin.position.set(0, jy, 0);
    pin.castShadow = true;
    g.add(pin);
    joints.push(jy);

    // The next clevis swallows this knuckle, so the segments overlap. Without
    // the overlap the digit shows a dark slot at every joint.
    y += len * 0.74;
  });

  // The two hinge blocks are real geometry off the same plate, but they sit
  // inside the joint rather than on it. Parked at the knuckle -- which lands
  // them within the palm shell -- they stay in the part count, in the explode
  // and in x-ray, without cluttering the silhouette of a closed finger.
  (r.hinge || []).forEach((idx, i) => {
    const s = isl[idx];
    if (!s) return;
    place(s.mesh, s.vc);
    const h = new THREE.Group();
    h.name = `finger.${id}.hinge${i}`;
    h.add(s.mesh);
    h.position.set((i - 0.5) * 9, -26, -5);
    h.scale.setScalar(0.72);
    g.add(h);
  });

  // Domed tip closes the digit.
  if (tipPiece) {
    const len = tipPiece.size[2];
    place(tipPiece.mesh, tipPiece.vc, r.tipUp);
    const h = new THREE.Group();
    h.name = `finger.${id}.tip`;
    h.add(tipPiece.mesh);
    h.position.y = y + len / 2 - len * 0.14;
    h.rotation.x = -(chain.length * 3.2) * D;
    g.add(h);
    y += len * 0.82;
  }

  // Tendon: the braided line that closes the finger, up the palmar side (+Z)
  // and anchored behind the tip.
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, -6, girth * 0.34),
    new THREE.Vector3(0, joints[0] ?? 16, girth * 0.42),
    new THREE.Vector3(0, joints[1] ?? 34, girth * 0.38),
    new THREE.Vector3(0, y - 7, girth * 0.20),
  ]);
  const tendon = new THREE.Mesh(new THREE.TubeGeometry(curve, 36, 0.85, 7, false), tendonMat);
  tendon.name = `tendon.${id}`;
  g.add(tendon);

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
// Knuckle line. A relaxed open hand splays only a few degrees — the wide fan
// this started with read as a cartoon. The knuckles also arc backward slightly
// (index and pinky sit lower than the middle), which is what makes the row of
// fingertips curve instead of running flat.
const DIGITS = [
  { id: 'index',  part: 'Index3',       x: -26, y: 50, z: 1,  tilt: -4, yaw: -4, scale: 0.94 },
  { id: 'middle', part: 'Majeure3',     x: -2,  y: 54, z: 0,  tilt: 0,  yaw: 0,  scale: 0.94 },
  { id: 'ring',   part: 'ringfinger3',  x: 21,  y: 51, z: -1, tilt: 4,  yaw: 3,  scale: 0.92 },
  { id: 'pinky',  part: 'Auriculaire3', x: 42,  y: 43, z: -3, tilt: 9,  yaw: 7,  scale: 0.85 },
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
    holder.position.set(d.x, d.y, d.z);
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
    const f = buildFinger(th, 'thumb', 'thumb');
    const holder = new THREE.Group();
    holder.name = 'thumb5';
    holder.add(f);
    // The thumb is the one digit that leaves the palm plane. It sits low on the
    // radial side, swings out about 55 degrees, and rolls forward so its pad
    // faces the fingers rather than the camera — opposition is the whole point
    // of a thumb, and without the roll it reads as a fifth finger.
    setEuler(holder, [-14, 26, 42]);
    holder.position.set(-40, 6, 10);
    holder.scale.setScalar(0.9);
    add(holder, { sub: 'finger', id: 'thumb5', label: 'Thumb', info: 'digit', explode: [-190, 40, 90] });

    // The flat piece on the thumb plate is the metacarpal mount that bolts the
    // whole digit to the side of the palm. It belongs to the palm, not to the
    // finger chain, so it is placed and exploded separately.
    const mount = th.islands[RECIPES.thumb.mount];
    if (mount) {
      place(mount.mesh, mount.vc);
      const m = new THREE.Group();
      m.name = 'thumb.mount';
      m.add(mount.mesh);
      setEuler(m, [-8, 22, 40]);
      m.position.set(-46, -14, 4);
      add(m, {
        sub: 'palm', id: 'thumb.mount', label: 'Thumb mount',
        info: 'palm', explode: [-215, -30, 60],
      });
    }
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
    // Threaded rods run the length of the forearm, so they stand on the same
    // axis as the shells and sit on the centreline -- off it they poke through
    // the back of the shell.
    const u = unit(bolts, { up: [-90, 0, 0] });
    u.position.set(0, -128, -4);
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

// Dev-only handle used by tools/digit.html to inspect one digit in isolation.
export const __debugFinger = buildFinger;

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
