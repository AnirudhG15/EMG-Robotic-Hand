import * as THREE from 'three';

// Assembly layout for the real InMoov meshes.
//
// The OBJs are STL exports in PRINT position: every part sits centred at the
// origin, flat on the bed, in whatever orientation printed best. They carry no
// assembly transform, so nothing self-assembles — each part's rotation and
// position below is authored here.
//
// Arm space: +Z toward the fingertips, +Y up, millimetres.

const D = Math.PI / 180;

export const LAYOUT = [
  // ---- forearm: two shell sections, each split into a top and bottom half ----
  // The shells' tube axis is already local Z, so they need no yaw; the lower
  // half is rolled 180 degrees about Z so its arch opens upward and mates.
  { id: 'robpart4V4', sub: 'shell', rot: [0, 0, 0],   pos: [0,  23, -212], exp: [0,  150, -70] },
  { id: 'robpart5V4', sub: 'shell', rot: [0, 0, 180], pos: [0, -23, -212], exp: [0, -145, -70] },
  { id: 'robpart2V4', sub: 'shell', rot: [0, 0, 0],   pos: [0,  22, -110], exp: [0,  122, -20] },
  { id: 'robpart3V4', sub: 'shell', rot: [0, 0, 180], pos: [0, -22, -110], exp: [0, -118, -20] },
  { id: 'robcap3V2',  sub: 'shell', rot: [0, 0, 0],   pos: [0,   0, -272], exp: [0,   14, -190] },

  // ---- wrist: flat plates bridging forearm and palm ----
  { id: 'WristlargeV4', sub: 'wrist', rot: [90, 0, 0], pos: [0, 0, -34], exp: [-190, 46, -6] },
  { id: 'WristsmallV4', sub: 'wrist', rot: [90, 0, 0], pos: [0, 6,  16], exp: [ 190, 40, -2] },

  // ---- palm: base plate and top cover ----
  { id: 'topsurface6',   sub: 'palm', rot: [90, 0, 0], pos: [0, -12, 62], exp: [0, -125, 26] },
  { id: 'topsurfaceUP6', sub: 'palm', rot: [0, 0, 0],  pos: [0,  10, 62], exp: [0,  130, 26] },

  // ---- fingers: each file is a PRINT PLATE of loose segments, not an
  //      assembled finger, so these read as per-digit part clusters ----
  { id: 'thumb5',       sub: 'finger', rot: [90,  30, 0], pos: [-64, -4, 74],  exp: [-150, 30,  18] },
  { id: 'Index3',       sub: 'finger', rot: [90,   6, 0], pos: [-36,  6, 136], exp: [ -88, 70,  70] },
  { id: 'Majeure3',     sub: 'finger', rot: [90,   0, 0], pos: [-10,  7, 142], exp: [ -22, 84,  86] },
  { id: 'ringfinger3',  sub: 'finger', rot: [90,  -6, 0], pos: [ 16,  6, 136], exp: [  46, 76,  76] },
  { id: 'Auriculaire3', sub: 'finger', rot: [90, -13, 0], pos: [ 40,  4, 126], exp: [ 118, 56,  58] },
  { id: 'coverfinger1', sub: 'finger', rot: [90,   0, 0], pos: [  0, 26, 128], exp: [   0, 152,  92] },

  // ---- hardware ----
  { id: 'ardiuinosupport',  sub: 'electronics', rot: [90, 0, 0], pos: [0, 0, -170], exp: [195, 26, -50] },
  { id: 'Bolt_entretoise7', sub: 'hardware',    rot: [0, 0, 0],  pos: [0, -4, -60], exp: [-60, -130, 20] },
];

export const SUB_HUE = {
  shell: 0xB49AFF,
  wrist: 0xB49AFF,
  palm: 0xB49AFF,
  finger: 0xFF8ABB,
  electronics: 0x45D9F0,
  hardware: 0xB7F056,
};

// Cascade order — shells first, then wrist/palm, fingers, hardware last.
const SLOT = { shell: 0, wrist: 0.12, palm: 0.2, finger: 0.3, electronics: 0.42, hardware: 0.5 };

export function buildAssembly(parts) {
  const root = new THREE.Group();
  root.name = 'emg-hand.real';
  const items = [];

  for (const L of LAYOUT) {
    const p = parts.get(L.id);
    if (!p) { console.warn('missing part', L.id); continue; }
    const g = p.group;
    g.rotation.set(L.rot[0] * D, L.rot[1] * D, L.rot[2] * D);
    g.position.set(...L.pos);
    g.userData = {
      rest: new THREE.Vector3(...L.pos),
      explode: new THREE.Vector3(...L.exp),
      restRotY: L.rot[1] * D,
      twist: L.sub === 'finger' ? 0.18 : L.sub === 'shell' ? 0.1 : 0.05,
      stagger: SLOT[L.sub] ?? 0.2,
      sub: L.sub,
      id: L.id,
    };
    // Shadow cost scales with the shadow pass re-rendering everything. Only the
    // big shell and palm forms carry a readable shadow; the finger plates and
    // fasteners are small enough that theirs is noise, and coverfinger1 plus the
    // two palm surfaces alone are 156k of the model's 215k triangles.
    const casts = L.sub === 'shell' || L.sub === 'wrist';
    g.traverse((c) => {
      if (!c.isMesh) return;
      c.castShadow = casts;
      c.receiveShadow = false;
    });

    root.add(g);
    items.push(g);
  }

  root.userData.items = items;
  return root;
}

const MAX_STAGGER = 0.5;

export function setAssemblyExplode(root, t) {
  for (const o of root.userData.items) {
    let k = t * (1 + MAX_STAGGER) - o.userData.stagger;
    k = k < 0 ? 0 : k > 1 ? 1 : k;
    k = k * k * (3 - 2 * k);
    const r = o.userData.rest;
    const e = o.userData.explode;
    o.position.set(r.x + e.x * k, r.y + e.y * k, r.z + e.z * k);
    o.rotation.y = o.userData.restRotY + o.userData.twist * k;
  }
}
