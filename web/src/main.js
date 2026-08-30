import gsap from 'gsap';
import ScrollTrigger from 'gsap/ScrollTrigger';
import { createPartScene } from './three/scene.js';
import { createExplorer, REDUCED } from './three/explorer.js';
import { HAND_INFO } from './data/hand-info.js';
import { PARTS, GROUPS, GROUP_HEX, BOM, DECISIONS, CHAIN } from './data/parts.js';

gsap.registerPlugin(ScrollTrigger);

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

/* ===================================================== shared render loop */
// One rAF for both canvases. A canvas inside a hidden tab measures 0×0, so the
// visibility test skips it and the parts viewer costs nothing until opened.

const scenes = [];
function onScreen(canvas) {
  const r = canvas.getBoundingClientRect();
  if (r.width === 0 || r.height === 0) return false;
  return r.bottom > -200 && r.top < window.innerHeight + 200;
}
function loop(t) {
  for (const s of scenes) if (onScreen(s.canvas)) s.frame(t);
  requestAnimationFrame(loop);
}

/* ============================================================= explorer */

const stageCanvas = $('#hand-canvas');
const hint = $('#hover-hint');
const inspect = $('#inspect');
const stats = $('#stage-stats');
const cue = $('.scroll-cue');

let lastPointer = { x: 0, y: 0 };
stageCanvas.addEventListener('pointermove', (e) => {
  lastPointer = { x: e.clientX, y: e.clientY };
}, { passive: true });

function showHint(info) {
  if (!info) { hint.hidden = true; return; }
  const r = stageCanvas.getBoundingClientRect();
  hint.hidden = false;
  hint.textContent = info.label;
  hint.style.setProperty('--hint-hue', `#${info.hue.toString(16).padStart(6, '0')}`);
  hint.style.left = `${lastPointer.x - r.left}px`;
  hint.style.top = `${lastPointer.y - r.top}px`;
}

function showInspect(info) {
  const open = !!info;
  stats.setAttribute('data-hidden', String(open));
  document.body.setAttribute('data-selected', String(open));
  if (!open) { inspect.hidden = true; return; }

  const d = HAND_INFO[info.info];
  if (!d) { inspect.hidden = true; return; }
  const hue = `#${info.hue.toString(16).padStart(6, '0')}`;

  inspect.hidden = false;
  inspect.style.setProperty('--sel-hue', hue);
  $('#inspect-kind').textContent = d.kind;
  $('#inspect-title').textContent = info.label || d.title;
  $('#inspect-body').textContent = d.body;
  $('#inspect-why').textContent = d.why;
  $('#inspect-facts').innerHTML = d.facts
    .map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');

  if (!REDUCED) {
    gsap.fromTo(inspect,
      { opacity: 0, x: 24 },
      { opacity: 1, x: 0, duration: 0.42, ease: 'power3.out' });
  }
}

/* ---------------------------------------------------------- parts index */

const SUB_LABEL = {
  shell: 'Forearm', wrist: 'Wrist', palm: 'Palm', finger: 'Digits',
  cover: 'Covers', electronics: 'Electronics', hardware: 'Hardware',
};
const SUB_ORDER = ['finger', 'cover', 'palm', 'wrist', 'shell', 'electronics', 'hardware'];

const indexPanel = $('#index');
const indexList = $('#index-list');
const indexBtn = $('#ctl-index');
const loader = $('#loader');

function buildIndex(parts) {
  const hex = (h) => `#${h.toString(16).padStart(6, '0')}`;
  const groups = new Map();
  for (const p of parts) {
    if (!groups.has(p.sub)) groups.set(p.sub, []);
    groups.get(p.sub).push(p);
  }
  indexList.innerHTML = SUB_ORDER
    .filter((sub) => groups.has(sub))
    .map((sub) => {
      const rows = groups.get(sub).map((p) => `
        <button type="button" class="index-item" role="option" aria-selected="false"
                data-id="${p.id}" style="--i-hue: ${hex(p.hue)}">
          <span class="index-swatch" aria-hidden="true"></span>${p.label}
        </button>`).join('');
      const h = hex(groups.get(sub)[0].hue);
      return `<p class="index-group" style="--g-hue: ${h}">${SUB_LABEL[sub] || sub} · ${groups.get(sub).length}</p>${rows}`;
    }).join('');
}

indexList.addEventListener('click', (e) => {
  const b = e.target.closest('.index-item');
  if (b) explorer.selectById(b.dataset.id);
});
indexList.addEventListener('pointerover', (e) => {
  const b = e.target.closest('.index-item');
  explorer.hoverById(b ? b.dataset.id : null);
});
indexList.addEventListener('pointerleave', () => explorer.hoverById(null));
// Keyboard users get the same preview as the mouse.
indexList.addEventListener('focusin', (e) => {
  const b = e.target.closest('.index-item');
  if (b) explorer.hoverById(b.dataset.id);
});

function toggleIndex(open) {
  indexPanel.hidden = !open;
  indexBtn.setAttribute('aria-expanded', String(open));
  document.body.setAttribute('data-index-open', String(open));
  if (open && !REDUCED) {
    gsap.fromTo(indexPanel, { opacity: 0, y: 14 },
      { opacity: 1, y: 0, duration: 0.34, ease: 'power3.out' });
  }
}
indexBtn.addEventListener('click', () => toggleIndex(indexPanel.hidden));
$('#index-close').addEventListener('click', () => toggleIndex(false));

/* ---------------------------------------------------------------- scene */

const explorer = createExplorer(stageCanvas, {
  onHover: showHint,
  onSelect: (info) => {
    showInspect(info);
    if (info) xrayBtn.setAttribute('aria-pressed', String(info.sub === 'electronics' || xray));
    $$('.index-item').forEach((b) => b.setAttribute(
      'aria-selected', String(!!info && b.dataset.id === info.id)));
  },
  onReady: (parts) => {
    buildIndex(parts);
    loader.setAttribute('data-done', 'true');
    setTimeout(() => { loader.hidden = true; }, 700);
  },
  onError: () => {
    loader.querySelector('p').textContent = 'Could not load the model';
  },
});
scenes.push({ canvas: stageCanvas, frame: explorer.frame });
if (import.meta.env.DEV) window.__explorer = explorer; // dev-only camera probe

$('#inspect-close').addEventListener('click', () => explorer.select(null));
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') explorer.select(null);
});

const xrayBtn = $('#ctl-xray');
let xray = false;
xrayBtn.addEventListener('click', () => {
  xray = !xray;
  xrayBtn.setAttribute('aria-pressed', String(xray));
  explorer.setXray(xray ? 1 : 0);
});

$('#ctl-reset').addEventListener('click', () => {
  explorer.resetView();
  xray = false;
  xrayBtn.setAttribute('aria-pressed', 'false');
  explorer.setXray(0);
});

if (!REDUCED) {
  gsap.from('.stage-head > *', {
    y: 26, opacity: 0, duration: 0.9, stagger: 0.09, ease: 'power3.out', delay: 0.2,
  });
  gsap.from('.stage-controls', {
    opacity: 0, duration: 0.8, delay: 0.9, ease: 'power2.out', clearProps: 'opacity',
  });
}

/* -------------------------------------------------- scroll drives explode */

const stageEl = $('.stage');
const chapters = $('#chapters');
const stageHead = $('.stage-head');

// Four chapters across the track, with a lead-in before the first so the hero
// is not interrupted the instant the page moves.
const CHAP_START = 0.14;
const chapterAt = (p) => (p < CHAP_START ? -1
  : Math.min(3, Math.floor(((p - CHAP_START) / (1 - CHAP_START)) * 4)));

let lastChapter = -2;

ScrollTrigger.create({
  trigger: '#build',
  start: 'top top',
  end: 'bottom bottom',
  scrub: REDUCED ? false : 1.1,
  onUpdate: (self) => {
    const p = self.progress;
    explorer.setExplode(p);
    // The teardown is also a camera move: the model turns about a third of a
    // turn and settles a little lower as it opens, so the parts that separate
    // last are not hidden behind the ones that went first.
    explorer.setScrollPose(p);
    cue.setAttribute('data-hidden', String(p > 0.02));

    // The headline steps aside once parts start moving through where it sits,
    // and the chapter narration takes over that space.
    // The headline has to be fully gone before the first chapter arrives, not
    // merely faint: two overlapping paragraphs at low opacity read as a bug.
    const headOut = Math.max(0, 1 - p * 9);
    stageHead.style.opacity = String(headOut);
    stageHead.style.visibility = headOut < 0.01 ? 'hidden' : 'visible';
    stageHead.style.transform = `translateY(${-p * 46}px)`;
    // The bottom haze lifts as the model opens — half the parts travel down
    // into it, and hiding them there would defeat the whole scroll.
    stageEl.style.setProperty('--stage-fade', (1 - p * 0.88).toFixed(3));

    const c = chapterAt(p);
    if (c !== lastChapter) {
      lastChapter = c;
      chapters.setAttribute('data-active', String(c));
    }
  },
});

const nav = $('#nav');
ScrollTrigger.create({
  start: 'top -40',
  onUpdate: (self) => nav.setAttribute('data-scrolled', String(self.scroll() > 40)),
});

/* ================================================================= tabs */

const tablist = $('#tablist');
const tabs = $$('[role="tab"]', tablist);
const panels = tabs.map((t) => document.getElementById(t.getAttribute('aria-controls')));

function selectTab(id, { focus = false } = {}) {
  tabs.forEach((t, i) => {
    const on = t.id === `tab-${id}`;
    t.setAttribute('aria-selected', String(on));
    t.tabIndex = on ? 0 : -1;
    panels[i].hidden = !on;
    if (on && focus) t.focus();
  });
  // Panel heights differ, so every pinned trigger below needs remeasuring.
  ScrollTrigger.refresh();

  // Content animates on tab switch rather than on scroll: a panel that starts
  // hidden never fires a scroll trigger, and would open at zero opacity.
  if (REDUCED) return;
  const panel = panels[tabs.findIndex((t) => t.id === `tab-${id}`)];
  if (!panel) return;
  gsap.fromTo(panel.children,
    { opacity: 0, y: 18 },
    { opacity: 1, y: 0, duration: 0.5, stagger: 0.07, ease: 'power3.out', clearProps: 'transform' });
}

tablist.addEventListener('click', (e) => {
  const t = e.target.closest('[role="tab"]');
  if (t) selectTab(t.id.replace('tab-', ''));
});

tablist.addEventListener('keydown', (e) => {
  const i = tabs.findIndex((t) => t.getAttribute('aria-selected') === 'true');
  let n = null;
  if (e.key === 'ArrowRight') n = (i + 1) % tabs.length;
  if (e.key === 'ArrowLeft') n = (i - 1 + tabs.length) % tabs.length;
  if (e.key === 'Home') n = 0;
  if (e.key === 'End') n = tabs.length - 1;
  if (n === null) return;
  e.preventDefault();
  selectTab(tabs[n].id.replace('tab-', ''), { focus: true });
});

// Nav buttons open the matching tab, then scroll to it.
$('#nav-links').addEventListener('click', (e) => {
  const scrollTo = e.target.closest('[data-scrollto]');
  if (scrollTo) {
    window.scrollTo({ top: 0, behavior: REDUCED ? 'auto' : 'smooth' });
    return;
  }
  const b = e.target.closest('[data-goto]');
  if (!b) return;
  selectTab(b.dataset.goto);
  tablist.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth', block: 'start' });
});

/* ========================================================= signal chain */

const chainList = $('#chain-list');
const scope = $('#scope');
const sctx = scope.getContext('2d');
const scopeStage = $('#scope-stage');
const scopeAmp = $('#scope-amp');

const AMPS = ['1–5 mV', '20–100 mV', '20–100 mV', '1–5 V', '1–5 V', '0–5 V'];

chainList.innerHTML = CHAIN.map((c, i) => `
  <li>
    <button class="chain-step" role="tab" aria-selected="${i === 0}" data-stage="${i}">
      <span class="chain-n">STAGE ${String(c.n).padStart(2, '0')}</span>
      <span class="chain-name">${c.name}</span>
      <span class="chain-spec">${c.spec} &nbsp;·&nbsp; ${c.part}</span>
      <p class="chain-detail">${c.detail}</p>
    </button>
  </li>`).join('');

let stage = 0;
let phase = 0;

function noise(x) {
  const s = Math.sin(x * 12.9898) * 43758.5453;
  return (s - Math.floor(s)) * 2 - 1;
}
function burst(x) {
  const a = Math.exp(-Math.pow((x - 0.3) * 7, 2));
  const b = Math.exp(-Math.pow((x - 0.72) * 5.5, 2));
  return Math.min(1, a + b * 0.85);
}

// The signal as it appears after stage `st`.
function sample(x, st, t) {
  const env = burst(x);
  const raw = (noise(x * 220 + t * 0.5) * 0.55 + noise(x * 640 + t) * 0.45) * env;
  const drift = Math.sin(x * 3.1 + t * 0.35) * 0.42;
  const hum = Math.sin(x * 78 + t * 2) * 0.09;

  switch (st) {
    case 0: return raw * 0.5 + drift + hum;   // amplified; drift and hum intact
    case 1: return raw * 0.62 + hum * 0.35;   // drift removed
    case 2: return raw * 0.95 + hum * 0.2;    // amplified hard
    case 3: return raw * 0.92;                // band-limited, hum gone
    case 4: return Math.abs(raw) * 0.95;      // rectified
    case 5: return env * 0.82;                // envelope
    default: return raw;
  }
}

// Trace colour walks the accent spectrum as the signal is conditioned: amber
// while it is raw analog, cyan by the time it is ready for the ADC.
const TRACE = ['#FF9A4D', '#FFB35C', '#FFC768', '#A8E64A', '#5FDCC0', '#35CFE8'];

function drawScope(t) {
  const W = scope.width, H = scope.height;
  sctx.clearRect(0, 0, W, H);

  const rectified = stage === 4 || stage === 5;
  const base = rectified ? H - 26 : H / 2;
  const scale = rectified ? H - 52 : H / 2 - 22;
  const col = TRACE[stage];

  sctx.strokeStyle = '#736DA0';
  sctx.globalAlpha = 0.35;
  sctx.lineWidth = 1;
  sctx.beginPath();
  sctx.moveTo(0, base);
  sctx.lineTo(W, base);
  sctx.stroke();
  sctx.globalAlpha = 1;

  for (const pass of [{ w: 9, a: 0.13 }, { w: 4, a: 0.2 }, { w: 1.8, a: 1 }]) {
    sctx.beginPath();
    sctx.strokeStyle = col;
    sctx.globalAlpha = pass.a;
    sctx.lineWidth = pass.w;
    sctx.lineJoin = 'round';
    for (let px = 0; px <= W; px += 2) {
      const x = px / W;
      const y = base - sample(x, stage, t) * scale;
      px === 0 ? sctx.moveTo(px, y) : sctx.lineTo(px, y);
    }
    sctx.stroke();
  }
  sctx.globalAlpha = 1;
}

function selectStage(i) {
  stage = i;
  $$('.chain-step').forEach((b, k) => b.setAttribute('aria-selected', String(k === i)));
  scopeStage.textContent = `Stage ${i + 1} — ${CHAIN[i].name}`;
  scopeAmp.textContent = AMPS[i];
  scopeAmp.style.color = TRACE[i];
}

chainList.addEventListener('click', (e) => {
  const b = e.target.closest('.chain-step');
  if (b) selectStage(Number(b.dataset.stage));
});
chainList.addEventListener('keydown', (e) => {
  if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
  e.preventDefault();
  const next = (stage + (e.key === 'ArrowRight' ? 1 : -1) + CHAIN.length) % CHAIN.length;
  selectStage(next);
  $$('.chain-step')[next].focus();
});
selectStage(0);

(function scopeLoop() {
  if (onScreen(scope)) {
    if (!REDUCED) phase += 0.016;
    drawScope(phase);
  }
  requestAnimationFrame(scopeLoop);
})();

/* =============================================================== parts */

const partCanvas = $('#part-canvas');
const partScene = createPartScene(partCanvas);
scenes.push({ canvas: partCanvas, frame: partScene.frame });

const viewer = $('#parts-viewer');
const filterEl = $('#parts-filter');
const listEl = $('#parts-list');
const detailEl = $('#part-detail');
const badgeEl = $('#part-badge');
const partsLayout = $('.parts-layout');

let filter = 'all';
let selected = PARTS[0].id;

filterEl.innerHTML = [{ id: 'all', label: 'All', hex: '#F4F3FF' }, ...GROUPS]
  .map((g) => `<button type="button" data-group="${g.id}" style="--g-hue: ${g.hex}"
        aria-selected="${g.id === 'all'}">${g.label}</button>`)
  .join('');

function renderList() {
  const items = PARTS.filter((p) => filter === 'all' || p.group === filter);
  listEl.innerHTML = items.map((p) => `
    <li>
      <button class="part-btn" type="button" data-id="${p.id}"
              style="--p-hue: ${GROUP_HEX[p.group]}"
              aria-selected="${p.id === selected}">
        <span class="pn">${p.name}</span>
        <span class="pd">${p.designator}</span>
        <span class="ps">${p.subtitle}</span>
      </button>
    </li>`).join('');
  if (!items.some((p) => p.id === selected) && items.length) selectPart(items[0].id);
}

function selectPart(id) {
  selected = id;
  const p = PARTS.find((x) => x.id === id);
  if (!p) return;
  const hue = GROUP_HEX[p.group];

  $$('.part-btn').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.id === id)));

  // The subsystem hue drives the viewer glow, the badge, the heading and the note.
  partsLayout.style.setProperty('--p-hue', hue);
  viewer.style.setProperty('--p-hue', hue);
  partScene.show(p.model, hue);

  badgeEl.innerHTML = `<b>${p.designator}</b><span>${p.package}</span>`;

  detailEl.style.setProperty('--p-hue', hue);
  detailEl.innerHTML = `
    <h3>${p.headline}</h3>
    <p class="pdesc">${p.what}</p>
    <h4>Why it is here</h4>
    <p class="pwhy">${p.why}</p>
    <dl class="pspec">
      ${p.spec.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}
      <div><dt>Qty</dt><dd>${p.qty}</dd></div>
      <div><dt>Cost</dt><dd>${p.cost}</dd></div>
    </dl>
    <p class="pnote">${p.note}</p>`;

  if (!REDUCED) {
    gsap.fromTo(detailEl.children,
      { opacity: 0, y: 10 },
      { opacity: 1, y: 0, duration: 0.4, stagger: 0.04, ease: 'power2.out' });
  }
}

filterEl.addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  filter = b.dataset.group;
  $$('#parts-filter button').forEach((x) => x.setAttribute('aria-selected', String(x === b)));
  renderList();
});

listEl.addEventListener('click', (e) => {
  const b = e.target.closest('.part-btn');
  if (b) selectPart(b.dataset.id);
});

{
  let down = false, lastX = 0;
  viewer.addEventListener('pointerdown', (e) => {
    down = true; lastX = e.clientX; viewer.setPointerCapture(e.pointerId);
  });
  viewer.addEventListener('pointermove', (e) => {
    if (!down) return;
    partScene.state.drag += (e.clientX - lastX) * 0.01;
    lastX = e.clientX;
  });
  const up = () => { down = false; };
  viewer.addEventListener('pointerup', up);
  viewer.addEventListener('pointercancel', up);
}

renderList();
selectPart(selected);

/* =========================================================== decisions */

$('#decision-grid').innerHTML = DECISIONS
  .map((d) => `<article class="decision"><h3>${d.q}</h3><p>${d.a}</p></article>`)
  .join('');

/* ================================================================= bom */

$('#bom-body').innerHTML = BOM
  .map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`)
  .join('');

/* ============================================================= reveals */
// Only content outside the tab panels — a panel that starts hidden would never
// fire its trigger and would stay at opacity 0 once opened.

if (!REDUCED) {
  $$('.placeholder-note .wrap, .tablist').forEach((el) => {
    el.classList.add('reveal');
    gsap.to(el, {
      opacity: 1, y: 0, duration: 0.7, ease: 'power2.out',
      scrollTrigger: { trigger: el, start: 'top 90%', toggleActions: 'play none none reverse' },
    });
  });
}

requestAnimationFrame(loop);
ScrollTrigger.refresh();
