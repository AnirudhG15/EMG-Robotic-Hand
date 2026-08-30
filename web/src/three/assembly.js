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

// What is actually on a finger plate, and how it goes together.
//
// Rendering each island on its own (tools/islands.html) and then finding the
// moulded pin bores (tools/find-pivots.py) settles a question the bounding
// boxes could not. A long-finger plate holds:
//
//   3 CLEVIS pieces  — a tapering tube whose pin bore crosses the full width,
//                      because it passes through two prongs. These are the
//                      phalanges: 27, 22 and 17 mm on the index.
//   2 TONGUE pieces  — a short link whose bore crosses only a 7 mm tab. The tab
//                      drops into a clevis and takes the pin; the other end is
//                      swallowed by the next phalanx. These are the joints.
//   1 CAP            — the domed fingertip, no bore at all.
//
// The thumb plate is the same idea with two phalanges (which is anatomically
// right), one tongue, a cap, and two unpinned brackets that mount the digit to
// the palm. So nothing here is indexed by hand: the bore span classifies every
// piece, and the chain is assembled on the measured pin positions.
const CLEVIS_SPAN = 0.7;   // bore/width ratio above which a bore is two-pronged

function classify(s) {
  if (!s.bore) return 'cap';
  return s.bore.span > Math.max(s.size[0], s.size[1]) * CLEVIS_SPAN ? 'clevis' : 'tongue';
}

// Standing a piece up maps its local axes to world: +Z (print height) becomes
// the finger axis, and the pin bore's local X stays world X, so a digit flexes
// in the YZ plane exactly as the printed part is built to.
//   upright  (rot -90 about X): (x, y, z) -> ( x,  z, -y)
//   inverted (rot +90 about X): (x, y, z) -> ( x, -z,  y)
const boreOffset = (b, inverted) => (inverted
  ? new THREE.Vector3(b.c[0], -b.c[2], b.c[1])
  : new THREE.Vector3(b.c[0], b.c[2], -b.c[1]));

function place(mesh, vc, noseUp = false) {
  mesh.position.set(0, 0, 0);
  mesh.quaternion.copy(alignPrintAxisToY(vc, noseUp));
}

// Two chrome screw heads at the ends of a bore. Every photograph of one of these
// hands shows them, and they are the only non-printed thing on a finger.
function pinAt(g, name, p, bore) {
  const r = bore.r * 1.35;
  for (const side of [-1, 1]) {
    const head = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), jointMat);
    // Just inside the bore's ends, so the heads sit flush against the prongs
    // instead of hanging off the sides of the finger.
    head.position.set(p.x + side * bore.span * 0.42, p.y, p.z);
    head.castShadow = true;
    head.name = name;
    g.add(head);
  }
}

function buildFinger(part, id, { tipUp = true } = {}) {
  const g = new THREE.Group();
  g.name = `finger.${id}`;

  const kind = new Map(part.islands.map((s) => [s, classify(s)]));
  const byLen = (a, b) => b.size[2] - a.size[2];
  const clevis = part.islands.filter((s) => kind.get(s) === 'clevis').sort(byLen);
  const tongue = part.islands.filter((s) => kind.get(s) === 'tongue').sort(byLen);
  const caps = part.islands.filter((s) => kind.get(s) === 'cap');

  // The fingertip is the roundest cap; anything else left over is a bracket and
  // belongs to the palm, not to the digit.
  const roundness = (s) => Math.min(...s.size) / Math.max(...s.size);
  const tip = caps.length ? caps.reduce((a, b) => (roundness(b) > roundness(a) ? b : a)) : null;
  const spare = caps.filter((s) => s !== tip);

  const pins = [];
  let y = 0;                     // running base height of the next piece
  let x = 0, z = 0;              // running centreline, so joints stay coaxial
  let girth = Math.max(clevis[0]?.size[0] ?? 16, clevis[0]?.size[1] ?? 16);
  let bend = 0;

  clevis.forEach((s, i) => {
    const len = s.size[2];
    girth = Math.max(s.size[0], s.size[1]);

    place(s.mesh, s.vc);
    const h = new THREE.Group();
    h.name = `finger.${id}.phalanx${i}`;
    h.add(s.mesh);
    h.position.set(x, y + len / 2, z);
    // Each phalanx leans a few degrees further forward than the last, so an open
    // hand reads as relaxed rather than as a stack of blocks.
    h.rotation.x = -(bend += i ? 3.4 : 0) * D;
    g.add(h);

    if (!s.bore) { y += len; return; }
    const off = boreOffset(s.bore, false);
    const pin = new THREE.Vector3(x + off.x, y + len / 2 + off.y, z + off.z);
    pinAt(g, `finger.${id}.pin${i}`, pin, s.bore);
    pins.push(pin.y);

    const link = tongue[i];
    if (link && link.bore) {
      // The tongue drops into the clevis tab-first, so it is inverted, and its
      // own bore lands exactly on the pin just placed.
      place(link.mesh, link.vc, true);
      const lo = boreOffset(link.bore, true);
      const lh = new THREE.Group();
      lh.name = `finger.${id}.link${i}`;
      lh.add(link.mesh);
      lh.position.set(pin.x - lo.x, pin.y - lo.y, pin.z - lo.z);
      lh.rotation.x = -bend * D;
      g.add(lh);
    }
    // The next phalanx starts at the pin, because the pin IS its pivot. Starting
    // it higher leaves the link exposed as a strut and the digit reads skeletal;
    // starting it here, the hollow base swallows the link the way it does on the
    // real hand.
    x = pin.x; z = pin.z; y = pin.y;
  });

  // Domed tip, pressed onto the last clevis.
  if (tip) {
    const len = tip.size[2];
    place(tip.mesh, tip.vc, tipUp);
    const h = new THREE.Group();
    h.name = `finger.${id}.tip`;
    h.add(tip.mesh);
    // The cap has a socket about half its depth, so it seats over the last
    // clevis rather than sitting on the pin.
    h.position.set(x, y + len * 0.78, z);
    h.rotation.x = -bend * D;
    g.add(h);
    y += len * 1.2;
  }

  // Anything unpinned and un-domed is a mounting bracket. It sits at the base of
  // the digit, inside the palm shell, so it stays in the part count, the explode
  // and x-ray without cluttering the silhouette of a closed finger.
  spare.forEach((s, i) => {
    place(s.mesh, s.vc);
    const h = new THREE.Group();
    h.name = `finger.${id}.bracket${i}`;
    h.add(s.mesh);
    h.position.set((i - 0.5) * 11, -30, -7);
    h.scale.setScalar(0.62);
    g.add(h);
  });

  // Tendon: the braided line that closes the finger, up the palmar side (+Z)
  // and anchored behind the tip.
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, -6, girth * 0.34),
    new THREE.Vector3(0, pins[0] ?? 16, girth * 0.44),
    new THREE.Vector3(0, pins[1] ?? 34, girth * 0.40),
    new THREE.Vector3(x, y - 7, z + girth * 0.20),
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
  shell: { hue: 0x6D3BE0, slot: 0.00 },
  wrist: { hue: 0x6D3BE0, slot: 0.14 },
  palm: { hue: 0x6D3BE0, slot: 0.22 },
  finger: { hue: 0x2340D6, slot: 0.30 },
  cover: { hue: 0x2340D6, slot: 0.38 },
  electronics: { hue: 0x0E7490, slot: 0.44 },
  hardware: { hue: 0xB4470E, slot: 0.52 },
};

// Fan of the four long digits across the knuckle line.
// The knuckle line, set from human hand anthropometry rather than by eye.
//
// A hand is not four fingers on a flat edge. Standard adult measurements, with
// hand breadth 87 mm and hand length 189 mm, put the metacarpal heads on a clear
// arc -- the index knuckle sits about 5 mm below the middle, the ring 4 mm, and
// the little finger a full 15 mm -- and give each digit a different length:
// index 74 mm from knuckle to tip, middle 82, ring 78, little 62. Getting the
// arc and those four lengths right is most of what makes a hand read as a hand.
//
// Everything below is those figures scaled by 0.976, the ratio of this palm's
// 84.9 mm width to the 87 mm the measurements assume, and expressed in the
// model's own frame (palm centre near x = -2).
//
// The palm has to match: 107 mm from the knuckle line to the wrist crease
// against 82 mm of middle finger. The printed palm plate is 108 mm tall, so the
// knuckle line sits 8 mm inside its top edge and the proportion comes out right.
const MCP_Y = 52;                 // middle-finger knuckle height
const FINGER_MM = { index: 72, middle: 80, ring: 76, pinky: 60.5 };

const DIGITS = [
  { id: 'index',  part: 'Index3',       x: -23.5, y: MCP_Y - 5,  z: 1,  tilt: -4, yaw: -3 },
  { id: 'middle', part: 'Majeure3',     x: -2,    y: MCP_Y,      z: 0,  tilt: 0,  yaw: 0 },
  { id: 'ring',   part: 'ringfinger3',  x: 17.5,  y: MCP_Y - 4,  z: -1, tilt: 5,  yaw: 3 },
  { id: 'pinky',  part: 'Auriculaire3', x: 36,    y: MCP_Y - 15, z: -3, tilt: 11, yaw: 7 },
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
    // Scaled to its anthropometric length rather than to a number picked by eye,
    // so the four fingertips land on the arc a real hand makes.
    holder.scale.setScalar(FINGER_MM[d.id] / f.userData.length);
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
    const f = buildFinger(th, 'thumb', { tipUp: false });
    const holder = new THREE.Group();
    holder.name = 'thumb5';
    holder.add(f);
    // The thumb is the one digit that leaves the palm plane. It sits low on the
    // radial side, swings out about 55 degrees, and rolls forward so its pad
    // faces the fingers rather than the camera — opposition is the whole point
    // of a thumb, and without the roll it reads as a fifth finger.
    // Opposition is the whole point of a thumb. Rolling it 38 degrees off the
    // palm's long axis and pitching it 50 degrees toward the viewer puts the
    // digit where a thumb sits on an open hand -- out to the radial side and
    // forward of the palm plane -- instead of lying flat beside the fingers.
    setEuler(holder, [38, 15, 30]);
    holder.position.set(-36, -6, 10);
    holder.scale.setScalar(1.05);
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
