#!/usr/bin/env python3
"""Locate the hinge pin holes in each printed piece.

Stacking finger segments by bounding-box overlap is a guess, and it shows: the
joints either gap or interpenetrate, and nothing lines up with the pin it is
supposed to turn on. The pieces carry the answer -- every phalanx has a moulded
pin hole at each end -- so this finds those holes and writes their axes and
centres into the pack. Assembly then places segment i+1 so its proximal hole
sits exactly on segment i's distal hole, which is what a real pin does.

Method: a pin hole is a cylindrical *void*, so its wall normals point inward,
toward the hole's axis. For every vertex whose normal is roughly perpendicular
to a candidate axis, step along the normal by a trial radius and vote for the
point you land on. Concave surfaces (holes) make every wall vertex land on the
same centre and pile up votes; convex surfaces (the outside of a knuckle) send
their votes flying apart. The peak of the accumulator is the hole.
"""

import math
import os
import random
import sys
from collections import defaultdict

import numpy as np

sys.path.insert(0, os.path.dirname(__file__))

R_MIN, R_MAX = 0.9, 2.4     # printed pin bores on this hand: 2-4 mm across, in mm
FIT_TOL = 0.35              # how close a wall vertex must sit to the fitted circle
MIN_WALL = 6                # wall vertices needed before a fit is believable
MIN_ARC = 3.0               # radians of bore wall that must be present
TRIALS = 4000


def vertex_normals(V, F):
    fn = np.cross(V[F[:, 1]] - V[F[:, 0]], V[F[:, 2]] - V[F[:, 0]])
    N = np.zeros_like(V)
    for k in range(3):
        np.add.at(N, F[:, k], fn)
    n = np.linalg.norm(N, axis=1, keepdims=True)
    return N / np.maximum(n, 1e-9)


def _circumcircle(p, q, r):
    (ax, ay), (bx, by), (cx, cy) = p, q, r
    d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by))
    if abs(d) < 1e-9:
        return None
    a2, b2, c2 = ax * ax + ay * ay, bx * bx + by * by, cx * cx + cy * cy
    ux = (a2 * (by - cy) + b2 * (cy - ay) + c2 * (ay - by)) / d
    uy = (a2 * (cx - bx) + b2 * (ax - cx) + c2 * (bx - ax)) / d
    return ux, uy, math.hypot(ax - ux, ay - uy)


def find_bore(V, F, axis=0, seed=7):
    """The hinge pin bore, as a circle in the plane perpendicular to `axis`.

    These STLs are coarse -- a phalanx is under 400 vertices, so a bore wall is
    maybe sixteen of them. That is far too sparse to vote into an accumulator,
    but plenty for RANSAC: fit a circle through three wall vertices, keep the fit
    that the most vertices agree with. What separates a bore from the outside of
    a knuckle is which way the walls face, so a vertex only counts as an inlier
    if its normal points back at the centre. Convex surfaces are then excluded by
    construction, however round they are.
    """
    N = vertex_normals(V, F)
    u, v = [k for k in range(3) if k != axis]
    wall = np.abs(N[:, axis]) < 0.4          # surfaces running along the bore
    if wall.sum() < MIN_WALL:
        return None

    P = V[wall][:, [u, v]]
    D = N[wall][:, [u, v]]
    D = D / np.maximum(np.linalg.norm(D, axis=1, keepdims=True), 1e-9)
    n = len(P)

    rng = random.Random(seed)
    best = None
    for _ in range(TRIALS):
        c = _circumcircle(*(P[i] for i in rng.sample(range(n), 3)))
        if c is None:
            continue
        cu, cv, r = c
        if not (R_MIN <= r <= R_MAX):
            continue
        on = np.abs(np.hypot(P[:, 0] - cu, P[:, 1] - cv) - r) < FIT_TOL
        toc = np.stack([cu - P[:, 0], cv - P[:, 1]], 1)
        toc = toc / np.maximum(np.linalg.norm(toc, axis=1, keepdims=True), 1e-9)
        ok = on & ((D * toc).sum(1) > 0.7)   # walls facing the centre
        if ok.sum() < MIN_WALL:
            continue
        ang = np.sort(np.arctan2(P[ok][:, 1] - cv, P[ok][:, 0] - cu))
        gaps = np.append(np.diff(ang), ang[0] + 2 * math.pi - ang[-1])
        arc = 2 * math.pi - gaps.max()
        if arc < MIN_ARC:
            continue
        score = int(ok.sum()) + arc
        if best is None or score > best[0]:
            along = V[wall][ok][:, axis]
            c3 = [0.0, 0.0, 0.0]
            c3[u], c3[v] = cu, cv
            c3[axis] = float((along.min() + along.max()) / 2)
            best = (score, c3, float(r), float(along.max() - along.min()))
    if best is None:
        return None
    _, c3, r, span = best
    return {'c': [round(x, 3) for x in c3], 'r': round(r, 3), 'span': round(span, 2)}
