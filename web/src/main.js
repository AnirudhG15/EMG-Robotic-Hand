import gsap from 'gsap';
import ScrollTrigger from 'gsap/ScrollTrigger';
import { createHeroScene, createPartScene, REDUCED } from './three/scene.js';
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

/* ================================================================= hero */

const heroCanvas = $('#hero-canvas');
const hero = createHeroScene(heroCanvas);
scenes.push({ canvas: heroCanvas, frame: hero.frame });

if (!REDUCED) {
  window.addEventListener('pointermove', (e) => {
    hero.state.pointer.x = (e.clientX / window.innerWidth - 0.5) * 2;
    hero.state.pointer.y = (e.clientY / window.innerHeight - 0.5) * 2;
  }, { passive: true });

  gsap.from('.hero-inner > *', {
    y: 26, opacity: 0, duration: 0.9, stagger: 0.09, ease: 'power2.out', delay: 0.15,
  });
  gsap.fromTo(hero.state, { curl: 0.55 }, { curl: 0, duration: 2.4, ease: 'power3.out' });
}

/* ======================================================== exploded view */
// Each beat highlights one subsystem, and `hue` drives the card accent, the
// chips, and the emissive rim on the matching 3D parts — so the colour in the
// card and the colour in the model are the same statement.

const BEATS = [
  {
    at: 0, hue: 'var(--violet)', subs: [],
    eyebrow: 'Assembly', title: 'Seventeen printed parts',
    body: 'The real InMoov geometry, exactly as it comes off the print bed. Scroll and the whole arm comes apart.',
    chips: ['Closed'],
  },
  {
    at: 0.26, hue: 'var(--violet)', subs: ['shell'],
    eyebrow: 'Forearm', title: 'A shell in four halves',
    body: 'Two barrel sections, each printed as a top and bottom half, closed by an end cap. This is the volume the servos and the analog board live inside.',
    chips: ['robpart2V4', 'robpart3V4', 'robpart4V4', 'robpart5V4', 'robcap3V2'],
  },
  {
    at: 0.48, hue: 'var(--violet)', subs: ['wrist', 'palm'],
    eyebrow: 'Wrist and palm', title: 'Where the tendons turn',
    body: 'Two wrist plates carry the rotation joint; the palm is a base plate and a top cover with the tendon channels routed between them.',
    chips: ['WristlargeV4', 'WristsmallV4', 'topsurface6', 'topsurfaceUP6'],
  },
  {
    at: 0.7, hue: 'var(--pink)', subs: ['finger'],
    eyebrow: 'Digits', title: 'Five fingers, printed flat',
    body: 'Each digit ships as a plate of loose phalanges and joint pins, assembled with the bolts and strung with braided line.',
    chips: ['thumb5', 'Index3', 'Majeure3', 'ringfinger3', 'Auriculaire3', 'coverfinger1'],
  },
  {
    at: 0.88, hue: 'var(--cyan)', subs: ['electronics', 'hardware'],
    eyebrow: 'Mounting', title: 'Bracket and fasteners',
    body: 'A frame bracket carries the board inside the forearm; the bolts and spacers pin every finger joint.',
    chips: ['ardiuinosupport', 'Bolt_entretoise7'],
  },
];

const bCard = $('#build-card');
const bEyebrow = $('#build-eyebrow');
const bTitle = $('#build-title');
const bBody = $('#build-body');
const bReadout = $('#build-readout');
const bFill = $('#build-progress-fill');

let activeBeat = -1;
function setBeat(i) {
  if (i === activeBeat) return;
  activeBeat = i;
  const b = BEATS[i];

  bCard.style.setProperty('--beat-hue', b.hue);
  hero.highlight(b.subs);

  const swap = () => {
    bEyebrow.textContent = b.eyebrow;
    bTitle.textContent = b.title;
    bBody.textContent = b.body;
    bReadout.innerHTML = b.chips.map((c) => `<span>${c}</span>`).join('');
  };

  if (REDUCED) { swap(); return; }
  gsap.to(bCard.children, {
    opacity: 0, y: -8, duration: 0.2, stagger: 0.03, ease: 'power1.in',
    onComplete: () => {
      swap();
      gsap.to(bCard.children, { opacity: 1, y: 0, duration: 0.34, stagger: 0.05, ease: 'power2.out' });
    },
  });
}
setBeat(0);

ScrollTrigger.create({
  trigger: '#build',
  start: 'top top',
  end: 'bottom bottom',
  scrub: REDUCED ? false : 1.1,
  onUpdate: (self) => {
    const p = self.progress;
    hero.state.targetExplode = p;
    hero.state.targetSpin = p * 1.15;
    bFill.style.height = `${p * 100}%`;
    let i = 0;
    for (let k = 0; k < BEATS.length; k++) if (p >= BEATS[k].at - 0.02) i = k;
    setBeat(i);
  },
});

ScrollTrigger.create({
  trigger: '#top',
  start: 'top top',
  endTrigger: '#build',
  end: 'bottom bottom',
  pin: '.hero-canvas',
  pinSpacing: false,
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
