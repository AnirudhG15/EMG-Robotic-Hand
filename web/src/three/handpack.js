import * as THREE from 'three';

// Loads the packed InMoov geometry (tools/pack-meshes.py).
//
// Positions arrive quantized to Int16 against each island's own bounding box,
// so precision scales with the island rather than with the scene. Undo is a
// dequantize plus computeVertexNormals — the OBJs carry no normals, and
// recomputing gives the crisp faceted shading printed parts actually have.
//
// Islands are exposed INDIVIDUALLY rather than merged. The source files are
// print plates: a finger arrives as six loose phalanx pieces laid out in a grid
// on the bed. Assembling a real hand means moving those pieces relative to each
// other, which is only possible if each one is its own mesh.

const DEQ = 1 / 65535;

function islandGeometry(buf, isl) {
  const q = new Int16Array(buf, isl.v, isl.nv * 3);
  const pos = new Float32Array(isl.nv * 3);
  const [mnx, mny, mnz] = isl.min;
  const sx = isl.max[0] - mnx;
  const sy = isl.max[1] - mny;
  const sz = isl.max[2] - mnz;
  // Centre each island on its own centroid so it can be posed by its middle.
  const cx = mnx + sx / 2, cy = mny + sy / 2, cz = mnz + sz / 2;

  for (let i = 0; i < isl.nv; i++) {
    const o = i * 3;
    pos[o]     = mnx + (q[o]     + 32768) * DEQ * sx - cx;
    pos[o + 1] = mny + (q[o + 1] + 32768) * DEQ * sy - cy;
    pos[o + 2] = mnz + (q[o + 2] + 32768) * DEQ * sz - cz;
  }

  // Vertex centroid, relative to the bounding-box centre. A printed part with a
  // fork at one end and a solid knuckle at the other carries most of its surface
  // on the solid end, so this offset says which way round the piece goes —
  // information the bounding box alone cannot give.
  let vx = 0, vy = 0, vz = 0;
  for (let i = 0; i < isl.nv; i++) {
    const o = i * 3;
    vx += pos[o]; vy += pos[o + 1]; vz += pos[o + 2];
  }
  vx /= isl.nv; vy /= isl.nv; vz /= isl.nv;

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setIndex(new THREE.BufferAttribute(new Uint16Array(buf, isl.i, isl.nt * 3), 1));
  g.computeVertexNormals();
  return { geometry: g, center: [cx, cy, cz], size: [sx, sy, sz], vc: [vx, vy, vz] };
}

async function fetchPack() {
  // The single-file build inlines the pack on window rather than shipping two
  // side files, so prefer that when present.
  if (typeof window !== 'undefined' && window.__HANDPACK) {
    const bin = atob(window.__HANDPACK.b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return [window.__HANDPACK.manifest, bytes.buffer];
  }
  return Promise.all([
    // Root-absolute: the pack lives in public/ and is served from the site root,
    // and the dev tool pages under /tools/ have to reach it too.
    fetch('/handpack.json').then((r) => r.json()),
    fetch('/handpack.bin').then((r) => r.arrayBuffer()),
  ]);
}

// Returns Map<partId, { islands: [{ mesh, size, center }], size, center }>.
// Each island mesh sits at its as-printed position, so a part rendered straight
// out of here looks exactly like its print plate.
export async function loadHandPack(material) {
  const [manifest, buf] = await fetchPack();
  const out = new Map();

  for (const part of manifest.parts) {
    const islands = [];
    const mn = [Infinity, Infinity, Infinity];
    const mx = [-Infinity, -Infinity, -Infinity];

    for (const isl of part.islands) {
      const { geometry, center, size, vc } = islandGeometry(buf, isl);
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(center[0], center[1], center[2]);
      mesh.castShadow = true;
      mesh.receiveShadow = false;
      // bore: the hinge pin hole found at pack time (tools/find-pivots.py),
      // in the same bounding-box-centred frame as the mesh. Its span says
      // whether the piece is a clevis (bore crosses the full width, through two
      // prongs) or a tongue (bore through a narrow tab that drops into one).
      islands.push({
        mesh, size, center, vc, bore: isl.bore || null,
        verts: isl.nv, tris: isl.nt,
      });
      for (let i = 0; i < 3; i++) {
        if (isl.min[i] < mn[i]) mn[i] = isl.min[i];
        if (isl.max[i] > mx[i]) mx[i] = isl.max[i];
      }
    }

    // Longest island first — the load-bearing piece of a print plate.
    islands.sort((a, b) => Math.max(...b.size) - Math.max(...a.size));

    out.set(part.id, {
      id: part.id,
      islands,
      size: mx.map((v, i) => v - mn[i]),
      center: mn.map((v, i) => (v + mx[i]) / 2),
    });
  }
  return out;
}
