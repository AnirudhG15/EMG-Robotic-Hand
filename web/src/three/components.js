import * as THREE from 'three';

// Procedural models of the real BOM parts. Built from geometry rather than
// downloaded assets: no licensing question, they recolour with the theme, and
// they stay sharp at any zoom.
//
// Every builder returns a THREE.Group centred near the origin and sized to sit
// comfortably inside a ~2.6 unit sphere, so one camera framing suits them all.

const C = {
  // Package epoxy is lifted well off the page background — a true-to-life near
  // black renders as an unreadable silhouette on a dark ground. Leads are kept
  // bright, since lead/body contrast is what makes a chip legible at a glance.
  body: 0x30343c,
  bodyLight: 0x424852,
  pin: 0xdfe4ec,
  pinDark: 0xa8b0bb,
  gold: 0xd8a24a,
  amber: 0xff7a2f,
  amberDim: 0x8a3d12,
  teal: 0x36b3a6,
  pcb: 0x123028,
  pcbLight: 0x1d4a3d,
  white: 0xe8eaee,
  red: 0xd8392b,
  blue: 0x2f5fb8,
  grey: 0x8a9099,
};

const matBody = () => new THREE.MeshStandardMaterial({ color: C.body, roughness: 0.42, metalness: 0.3 });
const matMetal = (c = C.pin) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.28, metalness: 0.92 });
const matPlastic = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.62, metalness: 0.05 });
const matGlow = (c = C.amber) => new THREE.MeshStandardMaterial({
  color: c, emissive: c, emissiveIntensity: 1.5, roughness: 0.4, metalness: 0,
});

function box(w, h, d, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function cyl(rt, rb, h, mat, seg = 24) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

// Bevelled slab — reads far better than a bare box under a rim light.
function slab(w, h, d, mat) {
  const s = new THREE.Shape();
  const r = Math.min(w, d) * 0.08;
  s.moveTo(-w / 2 + r, -d / 2);
  s.lineTo(w / 2 - r, -d / 2);
  s.quadraticCurveTo(w / 2, -d / 2, w / 2, -d / 2 + r);
  s.lineTo(w / 2, d / 2 - r);
  s.quadraticCurveTo(w / 2, d / 2, w / 2 - r, d / 2);
  s.lineTo(-w / 2 + r, d / 2);
  s.quadraticCurveTo(-w / 2, d / 2, -w / 2, d / 2 - r);
  s.lineTo(-w / 2, -d / 2 + r);
  s.quadraticCurveTo(-w / 2, -d / 2, -w / 2 + r, -d / 2);
  const g = new THREE.ExtrudeGeometry(s, {
    depth: h, bevelEnabled: true, bevelThickness: h * 0.12,
    bevelSize: h * 0.12, bevelSegments: 2, curveSegments: 6,
  });
  g.rotateX(-Math.PI / 2);
  g.translate(0, -h / 2, 0);
  const m = new THREE.Mesh(g, mat);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

// Gull-wing lead, as found on MSOP/SOIC packages.
function gullPin(len, mat) {
  const g = new THREE.Group();
  const a = box(0.075, 0.04, 0.16, mat, 0, 0, 0.08);
  const b = box(0.075, 0.15, 0.04, mat, 0, -0.08, 0.17);
  const c = box(0.075, 0.04, len, mat, 0, -0.15, 0.17 + len / 2);
  g.add(a, b, c);
  return g;
}

/* ---------------------------------------------------------------- packages */

function msop8() {
  const g = new THREE.Group();
  const body = slab(0.9, 0.3, 0.62, matBody());
  g.add(body);

  // Pin-1 dimple and laser-etched marking.
  const dot = cyl(0.05, 0.05, 0.045, matPlastic(0x0f1115), 18);
  dot.position.set(-0.33, 0.155, -0.2);
  g.add(dot);

  // Two lines of part marking. Faint, but it is the difference between a chip
  // and an anonymous slab at this framing.
  const etch = matPlastic(0x8d95a1);
  g.add(box(0.42, 0.01, 0.05, etch, 0.03, 0.152, -0.07));
  g.add(box(0.3, 0.01, 0.04, etch, -0.03, 0.152, 0.06));

  // Gull-wing leads. Rotating +90° about Y maps the pin's local +z to world +x,
  // so the right-hand bank takes +PI/2 and the left-hand bank -PI/2. Reversing
  // these folds every lead back inside the package, where they vanish.
  for (let i = 0; i < 4; i++) {
    const z = -0.21 + i * 0.14;

    const right = gullPin(0.26, matMetal());
    right.rotation.y = Math.PI / 2;
    right.position.set(0.45, 0, z);
    g.add(right);

    const left = gullPin(0.26, matMetal());
    left.rotation.y = -Math.PI / 2;
    left.position.set(-0.45, 0, z);
    g.add(left);
  }
  g.scale.setScalar(1.55);
  return g;
}

function dip8() {
  const g = new THREE.Group();
  g.add(slab(1.3, 0.36, 0.78, matBody()));

  const notch = cyl(0.12, 0.12, 0.1, matPlastic(0x0a0c0f), 20);
  notch.rotation.x = Math.PI / 2;
  notch.position.set(-0.65, 0.15, 0);
  notch.scale.z = 0.5;
  g.add(notch);

  for (let i = 0; i < 4; i++) {
    const x = -0.45 + i * 0.3;
    [-1, 1].forEach((s) => {
      const pin = box(0.09, 0.42, 0.045, matMetal(C.pinDark), x, -0.3, s * 0.4);
      pin.rotation.x = s * 0.14;
      g.add(pin);
    });
  }
  g.scale.setScalar(1.2);
  return g;
}

function diode() {
  const g = new THREE.Group();
  const glass = new THREE.MeshPhysicalMaterial({
    color: 0x2a2f36, roughness: 0.16, metalness: 0,
    transmission: 0.55, thickness: 0.5, ior: 1.5,
  });
  const b = cyl(0.24, 0.24, 0.92, glass, 32);
  b.rotation.z = Math.PI / 2;
  g.add(b);

  // Cathode band.
  const band = cyl(0.252, 0.252, 0.14, matPlastic(0xe6e8ec), 32);
  band.rotation.z = Math.PI / 2;
  band.position.x = -0.3;
  g.add(band);

  [-1, 1].forEach((s) => {
    const lead = cyl(0.045, 0.045, 0.85, matMetal(), 12);
    lead.rotation.z = Math.PI / 2;
    lead.position.x = s * 0.88;
    g.add(lead);
  });
  g.scale.setScalar(1.35);
  return g;
}

function resistor(bands = [C.amber, C.body, C.red]) {
  const g = new THREE.Group();
  const b = cyl(0.26, 0.26, 0.86, matPlastic(0xcdb894), 32);
  b.rotation.z = Math.PI / 2;
  g.add(b);
  bands.forEach((c, i) => {
    const ring = cyl(0.272, 0.272, 0.1, matPlastic(c), 32);
    ring.rotation.z = Math.PI / 2;
    ring.position.x = -0.26 + i * 0.19;
    g.add(ring);
  });
  [-1, 1].forEach((s) => {
    const lead = cyl(0.042, 0.042, 0.8, matMetal(), 12);
    lead.rotation.z = Math.PI / 2;
    lead.position.x = s * 0.83;
    g.add(lead);
  });
  return g;
}

function filmCap(w = 0.75, h = 0.9) {
  const g = new THREE.Group();
  const body = slab(w, 0.34, h, matPlastic(0xd9a13c));
  body.rotation.x = Math.PI / 2;
  g.add(body);
  [-1, 1].forEach((s) => {
    const lead = cyl(0.042, 0.042, 0.62, matMetal(), 12);
    lead.position.set(s * 0.2, -0.6, 0);
    g.add(lead);
  });
  return g;
}

/* --------------------------------------------------------------- assemblies */

// Shared substrate for the filter-stage cards.
function boardBase(w = 2.5, d = 1.7) {
  const g = new THREE.Group();
  const b = slab(w, 0.11, d, matPlastic(C.pcb));
  g.add(b);
  const trace = new THREE.MeshStandardMaterial({
    color: C.gold, roughness: 0.3, metalness: 0.85,
  });
  for (let i = 0; i < 5; i++) {
    const t = box(w * 0.82, 0.015, 0.035, trace, 0, 0.062, -0.55 + i * 0.28);
    g.add(t);
  }
  return g;
}

function filterCard({ r = [C.amber, C.body, C.red], capW = 0.75, glow = C.amber } = {}) {
  const g = new THREE.Group();
  g.add(boardBase());

  const res = resistor(r);
  res.position.set(-0.6, 0.2, -0.3);
  g.add(res);

  const cap = filmCap(capW, 0.9);
  cap.position.set(0.62, 0.32, 0.25);
  g.add(cap);

  const op = dip8();
  op.scale.setScalar(0.62);
  op.position.set(-0.1, 0.18, 0.42);
  g.add(op);

  // Signal-path indicator.
  const dot = cyl(0.075, 0.075, 0.03, matGlow(glow), 16);
  dot.position.set(1.02, 0.08, -0.62);
  g.add(dot);

  return g;
}

function electrode() {
  const g = new THREE.Group();

  const pad = cyl(0.95, 1.05, 0.16, matPlastic(0xf2ede6), 40);
  g.add(pad);

  const gel = cyl(0.52, 0.52, 0.2, matPlastic(0x9fb8c4), 32);
  gel.position.y = 0.05;
  g.add(gel);

  const stud = cyl(0.19, 0.24, 0.3, matMetal(0xd6d9de), 24);
  stud.position.y = 0.24;
  g.add(stud);
  const cap = cyl(0.27, 0.19, 0.12, matMetal(0xd6d9de), 24);
  cap.position.y = 0.44;
  g.add(cap);

  // Lead wire, drawn as a tube so it catches light like the rest.
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.5, 0),
    new THREE.Vector3(0.5, 0.78, 0.28),
    new THREE.Vector3(1.35, 0.55, -0.15),
    new THREE.Vector3(2.0, 0.9, 0.3),
  ]);
  const wire = new THREE.Mesh(
    new THREE.TubeGeometry(curve, 40, 0.075, 10, false),
    matPlastic(C.red),
  );
  wire.castShadow = true;
  g.add(wire);

  g.position.x = -0.5;
  return g;
}

function devboard() {
  const g = new THREE.Group();
  g.add(slab(3.0, 0.12, 1.35, matPlastic(C.pcb)));

  // Shielded module.
  const shield = slab(1.15, 0.2, 0.95, matMetal(0xc3c8d0));
  shield.position.set(-0.82, 0.16, 0);
  g.add(shield);

  // USB-C.
  const usb = box(0.42, 0.16, 0.28, matMetal(0x9aa1ab), 1.45, 0.14, 0);
  g.add(usb);

  // Castellated headers.
  for (let i = 0; i < 11; i++) {
    const x = -1.28 + i * 0.24;
    [-1, 1].forEach((s) => {
      g.add(box(0.11, 0.16, 0.11, matMetal(C.gold), x, 0.13, s * 0.56));
    });
  }

  // Status LED.
  const led = cyl(0.07, 0.07, 0.05, matGlow(C.teal), 14);
  led.position.set(0.55, 0.15, -0.4);
  g.add(led);

  // Crystal.
  const xt = slab(0.34, 0.13, 0.2, matMetal(0xb0b6bf));
  xt.position.set(0.35, 0.13, 0.32);
  g.add(xt);

  g.scale.setScalar(0.86);
  return g;
}

function servo() {
  const g = new THREE.Group();

  const body = slab(1.35, 1.1, 0.66, matPlastic(0x2b6fd4));
  g.add(body);

  // Mounting flanges.
  const fl = box(1.95, 0.14, 0.6, matPlastic(0x2b6fd4), 0, 0.3, 0);
  g.add(fl);
  [-1, 1].forEach((s) => {
    const hole = cyl(0.075, 0.075, 0.2, matPlastic(0x101318), 12);
    hole.position.set(s * 0.82, 0.3, 0);
    g.add(hole);
  });

  // Gearbox cap and output spline.
  const cap = slab(1.35, 0.22, 0.66, matPlastic(0x1f4f9a));
  cap.position.y = 0.62;
  g.add(cap);
  const boss = cyl(0.2, 0.2, 0.16, matPlastic(0x1f4f9a), 20);
  boss.position.set(-0.36, 0.78, 0);
  g.add(boss);
  const spline = cyl(0.11, 0.11, 0.2, matMetal(0xd0d4da), 16);
  spline.position.set(-0.36, 0.92, 0);
  g.add(spline);

  // Horn.
  const horn = box(0.66, 0.055, 0.13, matPlastic(0xe8eaee), -0.12, 1.0, 0);
  g.add(horn);

  // Lead-out cable.
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.68, -0.2, 0),
    new THREE.Vector3(1.25, -0.34, 0.12),
    new THREE.Vector3(1.85, -0.1, -0.1),
  ]);
  const cable = new THREE.Mesh(
    new THREE.TubeGeometry(curve, 30, 0.065, 8, false),
    matPlastic(0x33383f),
  );
  g.add(cable);

  g.scale.setScalar(0.92);
  return g;
}

function pcb() {
  const g = new THREE.Group();
  const board = slab(3.1, 0.14, 2.3, matPlastic(C.pcb));
  g.add(board);

  const trace = new THREE.MeshStandardMaterial({ color: C.gold, roughness: 0.3, metalness: 0.85 });

  // Signal path across the board, left to right — mirrors the real stage order.
  for (let i = 0; i < 7; i++) {
    g.add(box(0.34, 0.014, 0.04, trace, -1.25 + i * 0.42, 0.075, -0.62));
  }
  for (let i = 0; i < 5; i++) {
    g.add(box(0.04, 0.014, 0.5, trace, -0.9 + i * 0.45, 0.075, -0.1));
  }

  const u1 = msop8();
  u1.scale.setScalar(0.44);
  u1.position.set(-1.0, 0.1, 0.15);
  g.add(u1);

  [[-0.05, 0.35], [0.85, -0.35]].forEach(([x, z]) => {
    const op = dip8();
    op.scale.setScalar(0.42);
    op.position.set(x, 0.1, z);
    g.add(op);
  });

  [[-0.5, 0.7], [0.35, 0.75], [1.15, 0.55]].forEach(([x, z]) => {
    const r = resistor();
    r.scale.setScalar(0.42);
    r.position.set(x, 0.13, z);
    g.add(r);
  });

  [[-1.25, -0.35], [0.15, -0.75]].forEach(([x, z]) => {
    const c = filmCap(0.6, 0.7);
    c.scale.setScalar(0.5);
    c.position.set(x, 0.24, z);
    g.add(c);
  });

  // Input and output connectors.
  const j1 = box(0.5, 0.28, 0.24, matPlastic(0xe8eaee), -1.42, 0.2, -0.9);
  g.add(j1);
  const j3 = box(0.34, 0.24, 0.2, matPlastic(0xe8eaee), 1.42, 0.18, 0.85);
  g.add(j3);

  const dot = cyl(0.08, 0.08, 0.03, matGlow(), 16);
  dot.position.set(1.42, 0.1, -0.95);
  g.add(dot);

  g.scale.setScalar(0.84);
  return g;
}

function passives() {
  const g = new THREE.Group();
  g.add(boardBase(2.6, 1.9));

  // Four local decouplers close to where the op-amp pins would be.
  for (let i = 0; i < 4; i++) {
    const c = box(0.26, 0.3, 0.16, matPlastic(0xb08644), -0.85 + i * 0.56, 0.22, -0.45);
    c.castShadow = true;
    g.add(c);
  }
  // Two bulk electrolytics.
  [-0.5, 0.5].forEach((x) => {
    const can = cyl(0.28, 0.28, 0.52, matMetal(0x30363f), 24);
    can.position.set(x, 0.34, 0.5);
    g.add(can);
    const top = cyl(0.285, 0.285, 0.03, matPlastic(0x0d1013), 24);
    top.position.set(x, 0.6, 0.5);
    g.add(top);
  });

  return g;
}

const BUILDERS = {
  msop8,
  dip8,
  diode,
  devboard,
  servo,
  pcb,
  electrode,
  passives,
  'filter-hp': () => filterCard({ r: [C.grey, C.red, C.amber], capW: 0.85, glow: C.amber }),
  'filter-lp': () => filterCard({ r: [C.amber, C.amber, C.body], capW: 0.6, glow: C.amber }),
  'filter-gain': () => filterCard({ r: [C.body, C.amber, C.grey], capW: 0.5, glow: C.teal }),
  'filter-env': () => filterCard({ r: [C.amber, C.body, C.body], capW: 0.95, glow: C.teal }),
  'filter-ref': () => filterCard({ r: [C.red, C.red, C.grey], capW: 0.7, glow: C.red }),
};

// Every part is normalised to the same on-screen size, so a resistor and a
// dev board both fill the viewer and the camera never has to move.
const TARGET_SPAN = 3.3;

export function buildComponent(model) {
  const fn = BUILDERS[model] || BUILDERS.dip8;
  const g = fn();

  // Recentre on the bounding box so every part spins about its own middle.
  const bb = new THREE.Box3().setFromObject(g);
  const c = bb.getCenter(new THREE.Vector3());
  g.position.sub(c);

  const wrap = new THREE.Group();
  wrap.add(g);

  // Fit to the widest horizontal extent — parts are wider than they are tall,
  // and matching on width keeps the silhouette consistent as they rotate.
  const size = bb.getSize(new THREE.Vector3());
  const span = Math.max(size.x, size.z, size.y * 1.6);
  if (span > 0.001) wrap.scale.setScalar(TARGET_SPAN / span);

  return wrap;
}

export const COMPONENT_COLORS = C;
