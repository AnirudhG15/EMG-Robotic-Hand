/* ========================================================= the live board
 *
 * An ambient electrical field behind the whole page.
 *
 * The first version of this ran a single oscilloscope trace down the left
 * margin. It read as a squiggle stuck to the edge, because that is what it was:
 * one thin line with dots on it, competing with nothing and belonging to
 * nothing. Decoration at the edge of a page is decoration; atmosphere behind a
 * page is design.
 *
 * So this is a board, not a line. Three layers, back to front:
 *
 *   BLOOMS   Four very large, very soft pools of accent light drifting on slow
 *            Lissajous paths. They are the light in the room -- nothing reads
 *            as a shape, only as a temperature that moves.
 *   LATTICE  A routed copper field across the whole viewport: orthogonal runs
 *            with 45-degree chamfers on a 52 px pitch, vias where a route ends.
 *            Drawn once into an offscreen canvas and blitted, because it only
 *            changes on resize. Held at about 6% so it is texture, not pattern.
 *   CURRENT  Short bright packets running the routes, with a white core and a
 *            cyan halo, plus an occasional whole-route arc. This is the only
 *            layer with any real contrast, and it is never more than a few
 *            pixels wide.
 *
 * Everything is keyed off scroll velocity: the board idles when the page is
 * still and runs when it moves.
 */

const TAU = Math.PI * 2;

// Decoration, not text, so these sit at the vivid end of the palette rather
// than the contrast-checked hues the type uses.
const COPPER = 'rgba(43, 43, 245, 1)';
const ARC = '#22CCFF';
const SPARK = '#FF2D9B';
const BLOOM_HUES = [
  [43, 43, 245],     // indigo
  [0, 194, 255],     // cyan
  [255, 45, 155],    // magenta
  [124, 58, 237],    // violet
];

const PITCH = 52;
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

// Deterministic noise, so the board is the same every reload and does not
// reshuffle itself on resize.
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/* ------------------------------------------------------------- routing */

// One route: start at a grid node, walk a few segments, turning at right
// angles with a chamfer at each corner the way an autorouter does.
function route(rand, cols, rows) {
  const pts = [];
  let cx = Math.floor(rand() * cols);
  let cy = Math.floor(rand() * rows);
  let dir = rand() < 0.5 ? [1, 0] : [0, 1];
  if (rand() < 0.5) dir = [-dir[0], -dir[1]];
  const legs = 3 + Math.floor(rand() * 5);
  pts.push([cx, cy]);
  for (let i = 0; i < legs; i++) {
    const run = 1 + Math.floor(rand() * 5);
    cx += dir[0] * run;
    cy += dir[1] * run;
    cx = Math.max(-1, Math.min(cols + 1, cx));
    cy = Math.max(-1, Math.min(rows + 1, cy));
    pts.push([cx, cy]);
    dir = dir[0] !== 0 ? [0, rand() < 0.5 ? 1 : -1] : [rand() < 0.5 ? 1 : -1, 0];
  }
  return pts;
}

// Grid points to pixels, with the corners chamfered at 45 degrees.
function chamfer(grid, k = 11) {
  const out = [];
  for (let i = 0; i < grid.length; i++) {
    const p = [grid[i][0] * PITCH, grid[i][1] * PITCH];
    if (i === 0 || i === grid.length - 1) { out.push(p); continue; }
    const a = [grid[i - 1][0] * PITCH, grid[i - 1][1] * PITCH];
    const b = [grid[i + 1][0] * PITCH, grid[i + 1][1] * PITCH];
    const inDir = norm(p, a);
    const outDir = norm(p, b);
    out.push([p[0] + inDir[0] * k, p[1] + inDir[1] * k]);
    out.push([p[0] + outDir[0] * k, p[1] + outDir[1] * k]);
  }
  return out;
}
function norm(from, to) {
  const dx = to[0] - from[0], dy = to[1] - from[1];
  const l = Math.hypot(dx, dy) || 1;
  return [dx / l, dy / l];
}

// Cumulative arc length, so a packet can travel at a constant speed rather
// than jumping between segments of different lengths.
function measure(pts) {
  const acc = [0];
  for (let i = 1; i < pts.length; i++) {
    acc.push(acc[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  }
  return acc;
}
function at(pts, acc, d) {
  const total = acc[acc.length - 1];
  const t = ((d % total) + total) % total;
  let i = 1;
  while (i < acc.length && acc[i] < t) i++;
  const seg = acc[i] - acc[i - 1] || 1;
  const f = (t - acc[i - 1]) / seg;
  const a = pts[i - 1], b = pts[i] || pts[i - 1];
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
}

/* ------------------------------------------------------------------ module */

export function createCircuit(canvas, { reduced = false } = {}) {
  const ctx = canvas.getContext('2d', { alpha: true });
  const still = document.createElement('canvas');
  const sctx = still.getContext('2d');

  let w = 0, h = 0, dpr = 1;
  let routes = [];
  let packets = [];
  let arcs = [];
  let arcClock = 0;

  const state = { flow: 0, t: 0, depth: 0 };

  function build() {
    const cols = Math.ceil(w / PITCH) + 2;
    const rows = Math.ceil(h / PITCH) + 2;
    const rand = rng(0x5eed);
    const count = Math.round((w * h) / 26000);          // density, not a count
    routes = [];
    for (let i = 0; i < count; i++) {
      const pts = chamfer(route(rand, cols, rows)).map(([x, y]) => [x - PITCH, y - PITCH]);
      routes.push({ pts, acc: measure(pts) });
    }

    // Static layer: copper and vias, drawn once.
    still.width = canvas.width;
    still.height = canvas.height;
    sctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    sctx.clearRect(0, 0, w, h);
    sctx.lineJoin = 'round';
    sctx.lineCap = 'round';
    sctx.strokeStyle = COPPER;

    for (const r of routes) {
      sctx.globalAlpha = 0.062;
      sctx.lineWidth = 1.4;
      sctx.beginPath();
      sctx.moveTo(r.pts[0][0], r.pts[0][1]);
      for (let i = 1; i < r.pts.length; i++) sctx.lineTo(r.pts[i][0], r.pts[i][1]);
      sctx.stroke();

      // A via is a plated hole: a ring, not a dot.
      for (const end of [r.pts[0], r.pts[r.pts.length - 1]]) {
        sctx.globalAlpha = 0.10;
        sctx.lineWidth = 1.6;
        sctx.beginPath();
        sctx.arc(end[0], end[1], 4.2, 0, TAU);
        sctx.stroke();
      }
    }
    sctx.globalAlpha = 1;

    packets = routes.slice(0, Math.min(22, routes.length)).map((r, i) => ({
      r, d: (i * 137.5) % r.acc[r.acc.length - 1],
      speed: 0.10 + (i % 4) * 0.035,
      len: 16 + (i % 3) * 9,
    }));
  }

  function resize() {
    const cw = canvas.clientWidth || window.innerWidth;
    const ch = canvas.clientHeight || window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 1.6);
    canvas.width = Math.round(cw * dpr);
    canvas.height = Math.round(ch * dpr);
    w = cw; h = ch;
    build();
  }

  // Each bloom is baked once into a small sprite and then blitted. Building the
  // gradient and filling the viewport four times a frame is about twenty
  // megapixels of fill at this size -- enough to cost frames on an integrated
  // GPU -- and a soft radial is exactly the thing that survives being drawn at
  // a fraction of the resolution and scaled up.
  const SPRITE = 192;
  const bloomSprites = BLOOM_HUES.map(([r, g, b]) => {
    const c = document.createElement('canvas');
    c.width = c.height = SPRITE;
    const g2 = c.getContext('2d');
    const grad = g2.createRadialGradient(SPRITE / 2, SPRITE / 2, 0, SPRITE / 2, SPRITE / 2, SPRITE / 2);
    grad.addColorStop(0, `rgba(${r},${g},${b},1)`);
    grad.addColorStop(0.55, `rgba(${r},${g},${b},0.34)`);
    grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
    g2.fillStyle = grad;
    g2.fillRect(0, 0, SPRITE, SPRITE);
    return c;
  });

  function drawBlooms() {
    const R = Math.hypot(w, h) * 0.46;
    for (let i = 0; i < bloomSprites.length; i++) {
      const p = state.t * 0.11 + i * 1.7;
      const x = w * (0.5 + 0.42 * Math.sin(p * 0.63 + i));
      const y = h * (0.5 + 0.40 * Math.sin(p * 0.41 + i * 2.1));
      ctx.globalAlpha = 0.125 + 0.03 * Math.sin(p * 0.9);
      ctx.drawImage(bloomSprites[i], x - R, y - R, R * 2, R * 2);
    }
    ctx.globalAlpha = 1;
  }

  function drawPacket(r, d, len, alpha, colour) {
    const a = at(r.pts, r.acc, d);
    const b = at(r.pts, r.acc, d - len);
    const grad = ctx.createLinearGradient(b[0], b[1], a[0], a[1]);
    grad.addColorStop(0, 'rgba(34,204,255,0)');
    grad.addColorStop(1, colour);
    ctx.strokeStyle = grad;
    ctx.globalAlpha = alpha;
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.moveTo(b[0], b[1]);
    ctx.lineTo(a[0], a[1]);
    ctx.stroke();
    ctx.lineWidth = 1.3;
    ctx.globalAlpha = alpha * 0.9;
    ctx.strokeStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(at(r.pts, r.acc, d - len * 0.42)[0], at(r.pts, r.acc, d - len * 0.42)[1]);
    ctx.lineTo(a[0], a[1]);
    ctx.stroke();
  }

  function frame(dt) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    if (!reduced) state.t += dt * 0.001;

    drawBlooms();

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.drawImage(still, 0, 0);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    if (reduced) { ctx.globalAlpha = 1; return; }

    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    const rate = 0.24 + state.flow * 1.5;
    for (const p of packets) {
      p.d += dt * p.speed * rate;
      drawPacket(p.r, p.d, p.len, 0.5, ARC);
    }

    // Every so often a whole route lights up and fades -- the flash.
    arcClock += dt;
    if (arcClock > 1400 && routes.length) {
      arcClock = 0;
      arcs.push({ r: routes[Math.floor(Math.random() * routes.length)], life: 1 });
      if (arcs.length > 2) arcs.shift();
    }
    for (const a of arcs) {
      a.life -= dt * 0.0011;
      const k = clamp01(a.life);
      ctx.globalAlpha = k * 0.5;
      ctx.strokeStyle = SPARK;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(a.r.pts[0][0], a.r.pts[0][1]);
      for (let i = 1; i < a.r.pts.length; i++) ctx.lineTo(a.r.pts[i][0], a.r.pts[i][1]);
      ctx.stroke();
    }
    arcs = arcs.filter((a) => a.life > 0);
    ctx.globalAlpha = 1;
  }

  resize();
  return {
    frame,
    resize,
    setFlow(v) { state.flow = clamp01(v); },
    setProgress(p) { state.depth = clamp01(p); },
    get active() { return true; },
    get stage() { return 0; },
  };
}
