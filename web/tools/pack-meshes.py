#!/usr/bin/env python3
"""Pack hardware/Right_Hand_Parts/*.obj into one compact binary for the site.

STL-derived OBJs are triangle soup: every vertex is repeated per face and the
files carry ~6x redundancy. This tool welds vertices, splits each part into its
connected islands (print plates hold several loose pieces per file), quantizes
positions to Int16 against each island's bounding box, and writes:

  web/public/handpack.bin   — island vertex/index blocks, little-endian
  web/public/handpack.json  — manifest: parts -> islands -> {offsets, bbox}

Runtime cost to undo: dequantize to Float32, computeVertexNormals. ~80 MB of
OBJ becomes ~2 MB of pack.

Also records the hinge pin bore found in each piece (tools/find-pivots.py), so
the runtime can join finger segments at the pivot they actually turn on.

Needs numpy for the bore search.  Run from web/:

    pip install numpy && python3 tools/pack-meshes.py
"""

import json
import os
import struct
import sys
from collections import defaultdict
from importlib.machinery import SourceFileLoader

import numpy as np

# Hinge-bore detection lives next door; assembly needs the pin positions to join
# segments where they actually pivot instead of by bounding-box overlap.
pivots = SourceFileLoader(
    'pivots', os.path.join(os.path.dirname(__file__), 'find-pivots.py')).load_module()

SRC = os.path.join(os.path.dirname(__file__), '..', '..', 'hardware', 'Right_Hand_Parts')
OUT = os.path.join(os.path.dirname(__file__), '..', 'public')

# Islands below this vertex count are debris (support stubs, stray shells) and
# add draw calls without adding silhouette.
MIN_ISLAND_VERTS = 40


def parse_obj(path):
    verts = []
    faces = []
    with open(path, 'rb') as f:
        for line in f:
            if line.startswith(b'v '):
                p = line.split()
                verts.append((float(p[1]), float(p[2]), float(p[3])))
            elif line.startswith(b'f '):
                idx = [int(t.split(b'/')[0]) - 1 for t in line.split()[1:]]
                for k in range(1, len(idx) - 1):  # fan-triangulate quads+
                    faces.append((idx[0], idx[k], idx[k + 1]))
    return verts, faces


def weld(verts, faces):
    key = {}
    remap = []
    out = []
    for v in verts:
        k = (round(v[0], 2), round(v[1], 2), round(v[2], 2))
        j = key.get(k)
        if j is None:
            j = len(out)
            key[k] = j
            out.append(v)
        remap.append(j)
    fs = []
    for a, b, c in faces:
        a, b, c = remap[a], remap[b], remap[c]
        if a != b and b != c and a != c:
            fs.append((a, b, c))
    return out, fs


def split_islands(nverts, faces):
    parent = list(range(nverts))

    def find(a):
        while parent[a] != a:
            parent[a] = parent[parent[a]]
            a = parent[a]
        return a

    for a, b, c in faces:
        ra, rb, rc = find(a), find(b), find(c)
        if ra != rb:
            parent[ra] = rb
        if find(ra) != rc:
            parent[find(ra)] = rc

    groups = defaultdict(list)
    for fi, (a, _b, _c) in enumerate(faces):
        groups[find(a)].append(fi)
    return list(groups.values())


def main():
    os.makedirs(OUT, exist_ok=True)
    manifest = {'parts': []}
    blob = bytearray()

    for fn in sorted(os.listdir(SRC)):
        if not fn.endswith('.obj'):
            continue
        pid = fn.replace('.stl.obj', '')
        verts, faces = weld(*parse_obj(os.path.join(SRC, fn)))
        islands = split_islands(len(verts), faces)

        part = {'id': pid, 'islands': []}
        for isl in islands:
            used = sorted({i for fi in isl for i in faces[fi]})
            if len(used) < MIN_ISLAND_VERTS:
                continue
            local = {g: l for l, g in enumerate(used)}
            pts = [verts[g] for g in used]
            mn = [min(p[i] for p in pts) for i in range(3)]
            mx = [max(p[i] for p in pts) for i in range(3)]
            span = [max(mx[i] - mn[i], 1e-6) for i in range(3)]

            v_off = len(blob)
            for p in pts:
                blob += struct.pack(
                    '<3h',
                    *(int(round((p[i] - mn[i]) / span[i] * 65535)) - 32768 for i in range(3)),
                )
            i_off = len(blob)
            for fi in isl:
                a, b, c = faces[fi]
                blob += struct.pack('<3H', local[a], local[b], local[c])

            entry = {
                'v': v_off, 'nv': len(pts),
                'i': i_off, 'nt': len(isl),
                'min': [round(x, 3) for x in mn],
                'max': [round(x, 3) for x in mx],
            }

            # Hinge bore, in coordinates centred on the island's bounding box --
            # the same frame the runtime meshes arrive in. The pin runs along
            # local X on every jointed piece in this hand, so that is the only
            # axis worth searching.
            Vi = np.asarray(pts, dtype=np.float64)
            Fi = np.asarray([[local[a], local[b], local[c]]
                             for a, b, c in (faces[fi] for fi in isl)], dtype=np.int64)
            bore = pivots.find_bore(Vi, Fi, axis=0)
            if bore is not None:
                mid = [(mn[k] + mx[k]) / 2 for k in range(3)]
                entry['bore'] = {
                    'c': [round(bore['c'][k] - mid[k], 3) for k in range(3)],
                    'r': bore['r'], 'span': bore['span'],
                }
            part['islands'].append(entry)
        # Big islands first so runtime can treat [0] as the main body.
        part['islands'].sort(key=lambda s: -s['nv'])
        manifest['parts'].append(part)
        print(f"{pid:20s} islands {len(part['islands']):2d}  "
              f"verts {sum(s['nv'] for s in part['islands']):6d}  "
              f"tris {sum(s['nt'] for s in part['islands']):6d}")

    with open(os.path.join(OUT, 'handpack.bin'), 'wb') as f:
        f.write(blob)
    with open(os.path.join(OUT, 'handpack.json'), 'w') as f:
        json.dump(manifest, f, separators=(',', ':'))
    print(f"\nhandpack.bin  {len(blob)/1e6:.2f} MB")
    print(f"handpack.json {os.path.getsize(os.path.join(OUT,'handpack.json'))/1e3:.1f} kB")


if __name__ == '__main__':
    sys.exit(main())
