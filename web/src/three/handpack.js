import * as THREE from 'three';

// Loads the packed real InMoov geometry (tools/pack-meshes.py).
//
// Positions arrive quantized to Int16 against each island's own bounding box,
// so a part's precision scales with its size rather than with the scene. Undo
// is a dequantize plus computeVertexNormals — the OBJs carry no normals, and
// recomputing gives clean faceted shading on printed parts.

const DEQ = 1 / 65535;

function islandGeometry(buf, isl) {
  const q = new Int16Array(buf, isl.v, isl.nv * 3);
  const pos = new Float32Array(isl.nv * 3);
  const [mnx, mny, mnz] = isl.min;
  const sx = isl.max[0] - mnx;
  const sy = isl.max[1] - mny;
  const sz = isl.max[2] - mnz;

  for (let i = 0; i < isl.nv; i++) {
    const o = i * 3;
    pos[o] = mnx + (q[o] + 32768) * DEQ * sx;
    pos[o + 1] = mny + (q[o + 1] + 32768) * DEQ * sy;
    pos[o + 2] = mnz + (q[o + 2] + 32768) * DEQ * sz;
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setIndex(new THREE.BufferAttribute(new Uint16Array(buf, isl.i, isl.nt * 3), 1));
  g.computeVertexNormals();
  return g;
}

// Returns Map<partId, { group, size, center }>. Each group holds one mesh per
// island, already recentred on the part's own bounds so callers can position by
// the part rather than by wherever it sat on the print plate.
export async function loadHandPack(material) {
  // The single-file build inlines the pack on window rather than shipping two
  // side files, so prefer that when present.
  let manifest, buf;
  if (typeof window !== 'undefined' && window.__HANDPACK) {
    manifest = window.__HANDPACK.manifest;
    const bin = atob(window.__HANDPACK.b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    buf = bytes.buffer;
  } else {
    [manifest, buf] = await Promise.all([
      fetch('handpack.json').then((r) => r.json()),
      fetch('handpack.bin').then((r) => r.arrayBuffer()),
    ]);
  }

  const out = new Map();
  for (const part of manifest.parts) {
    const group = new THREE.Group();
    group.name = part.id;

    const mn = [Infinity, Infinity, Infinity];
    const mx = [-Infinity, -Infinity, -Infinity];
    for (const isl of part.islands) {
      for (let i = 0; i < 3; i++) {
        if (isl.min[i] < mn[i]) mn[i] = isl.min[i];
        if (isl.max[i] > mx[i]) mx[i] = isl.max[i];
      }
    }
    const ctr = mn.map((v, i) => (v + mx[i]) / 2);

    for (const isl of part.islands) {
      const m = new THREE.Mesh(islandGeometry(buf, isl), material);
      m.castShadow = true;
      m.receiveShadow = true;
      group.add(m);
    }
    group.position.set(-ctr[0], -ctr[1], -ctr[2]);

    const holder = new THREE.Group();
    holder.name = part.id;
    holder.add(group);

    out.set(part.id, {
      group: holder,
      size: mx.map((v, i) => v - mn[i]),
      center: ctr,
      islands: part.islands.length,
    });
  }
  return out;
}
