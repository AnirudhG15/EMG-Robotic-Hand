import gsap from 'gsap';
import ScrollTrigger from 'gsap/ScrollTrigger';
import { createHeroScene, createPartScene, REDUCED } from './three/scene.js';
import { PARTS, GROUPS, BOM, DECISIONS, CHAIN } from './data/parts.js';

gsap.registerPlugin(ScrollTrigger);

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

/* ===================================================== shared render loop */
// One rAF for both canvases. Scenes whose canvas is offscreen are skipped, so
// the parts viewer costs nothing while the hero is in view.

const scenes = [];
function onScreen(canvas) {
  const r = canvas.getBoundingClientRect();
  return r.bottom > -200 && r.top < window.innerHeight + 200;
}
function loop(t) {
  for (const s of scenes) if (onScreen(s.canvas)) s.frame(t);
  requestAnimationFrame(loop);
}

/* ================================================================== nav */

const nav = $('#nav');
ScrollTrigger.create({
  start: 'top -40',
  onUpdate: (self) => nav.setAttribute('data-scrolled', String(self.scroll() > 40)),
  onToggle: (self) => nav.setAttribute('data-scrolled', String(self.isActive)),
});

$$('.nav-links a').forEach((a) => {
  const id = a.getAttribute('href').slice(1);
  const el = document.getElementById(id);
  if (!el) return;
  ScrollTrigger.create({
    trigger: el,
    start: 'top 40%',
    end: 'bottom 40%',
    onToggle: (self) => a.setAttribute('aria-current', String(self.isActive)),
  });
});

/* ================================================================= hero */

const heroCanvas = $('#hero-canvas');
const hero = createHeroScene(heroCanvas);
scenes.push({ canvas: heroCanvas, frame: hero.frame });

// Subtle parallax on pointer — clamped so the model never swings far.
if (!REDUCED) {
  window.addEventListener('pointermove', (e) => {
    hero.state.pointer.x = (e.clientX / window.innerWidth - 0.5) * 2;
    hero.state.pointer.y = (e.clientY / window.innerHeight - 0.5) * 2;
  }, { passive: true });
}

// Opening beat.
if (!REDUCED) {
  gsap.from('.hero-inner > *', {
    y: 26, opacity: 0, duration: 0.9, stagger: 0.09, ease: 'power2.out', delay: 0.15,
  });
  gsap.fromTo(hero.state,
    { spin: -0.85, curl: 0.55 },
    { spin: 0, curl: 0, duration: 2.6, ease: 'power2.out' });
}

/* ======================================================== exploded view */

const BEATS = [
  {
    at: 0.0,
    eyebrow: 'Assembly',
    title: 'Inside the forearm',
    body: 'The housing splits along its length. Everything that makes the hand work is mounted inside it — nothing sits in the fingers themselves.',
    chips: ['Shell closed'],
  },
  {
    at: 0.28,
    eyebrow: 'Shell',
    title: 'A 2 mm printed housing',
    body: 'Roughly 350 grams of PLA, printed hollow with an open servo-access side, internal mounting bosses, and channels for the tendon lines.',
    chips: ['forearm.shell.upper', 'forearm.shell.lower'],
  },
  {
    at: 0.55,
    eyebrow: 'Actuation',
    title: 'Five servos, five tendons',
    body: 'MG90S micro servos sit in a staggered bank to fit the taper of the forearm. Each pulls a braided line to one finger; elastic cord returns it.',
    chips: ['servo.thumb', 'servo.index', 'servo.middle', 'servo.ring', 'servo.pinky'],
  },
  {
    at: 0.78,
    eyebrow: 'Electronics',
    title: 'The front end and the brain',
    body: 'The analog board conditions the electrode signal; the ESP32-S3 digitises the envelope, applies the threshold, and drives all five PWM channels.',
    chips: ['pcb.afe', 'mcu.esp32'],
  },
  {
    at: 1.0,
    eyebrow: 'Complete',
    title: 'Twenty-two parts',
    body: 'Every piece named, with its own pivot and travel vector — the structure real InMoov geometry drops straight into.',
    chips: ['Fully exploded'],
  },
];

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
  const swap = () => {
    bEyebrow.textContent = b.eyebrow;
    bTitle.textContent = b.title;
    bBody.textContent = b.body;
    bReadout.innerHTML = b.chips
      .map((c) => `<span data-on="true">${c}</span>`).join('');
  };
  if (REDUCED) { swap(); return; }
  gsap.to('.build-copy > *', {
    opacity: 0, y: -8, duration: 0.22, stagger: 0.03, ease: 'power1.in',
    onComplete: () => {
      swap();
      gsap.to('.build-copy > *', { opacity: 1, y: 0, duration: 0.34, stagger: 0.05, ease: 'power2.out' });
    },
  });
}
setBeat(0);

ScrollTrigger.create({
  trigger: '#build',
  start: 'top top',
  end: 'bottom bottom',
  scrub: REDUCED ? false : 0.7,
  onUpdate: (self) => {
    const p = self.progress;
    hero.state.explode = p;
    hero.state.spin = p * 1.15;
    bFill.style.height = `${p * 100}%`;

    let i = 0;
    for (let k = 0; k < BEATS.length; k++) if (p >= BEATS[k].at - 0.02) i = k;
    setBeat(i);
  },
});

// The hero canvas is fixed behind the build track, so it stays visible while
// the copy scrolls. Pin it rather than duplicating the scene.
ScrollTrigger.create({
  trigger: '#top',
  start: 'top top',
  endTrigger: '#build',
  end: 'bottom bottom',
  pin: '.hero-canvas',
  pinSpacing: false,
});

/* ========================================================= signal chain */

const chainList = $('#chain-list');
const scope = $('#scope');
const sctx = scope.getContext('2d');
const scopeStage = $('#scope-stage');
const scopeAmp = $('#scope-amp');

const AMPS = ['1–5 mV', '20–100 mV', '20–100 mV', '1–5 V', '1–5 V', '0–5 V', '1–5 V'];

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

// Deterministic pseudo-random so the trace is stable frame to frame.
function noise(x) {
  const s = Math.sin(x * 12.9898) * 43758.5453;
  return (s - Math.floor(s)) * 2 - 1;
}

// Burst envelope: two contractions per cycle.
function burst(x) {
  const a = Math.exp(-Math.pow((x - 0.3) * 7, 2));
  const b = Math.exp(-Math.pow((x - 0.72) * 5.5, 2));
  return Math.min(1, a + b * 0.85);
}

// Signal as it appears after stage `st`.
function sample(x, st, t) {
  const env = burst(x);
  const raw = (noise(x * 220 + t * 0.5) * 0.55 + noise(x * 640 + t) * 0.45) * env;
  const drift = Math.sin(x * 3.1 + t * 0.35) * 0.42;
  const hum = Math.sin(x * 78 + t * 2) * 0.09;

  switch (st) {
    case 0: return raw * 0.5 + drift + hum;        // amplified, drift + hum intact
    case 1: return raw * 0.62 + hum * 0.35;        // drift removed
    case 2: return raw * 0.95 + hum * 0.2;         // amplified hard
    case 3: return raw * 0.92;                     // band-limited, hum gone
    case 4: return Math.abs(raw) * 0.95;           // rectified
    case 5: return env * 0.82;                     // envelope
    default: return raw;
  }
}

function drawScope(t) {
  const W = scope.width, H = scope.height;
  sctx.clearRect(0, 0, W, H);

  const mid = H / 2;
  const css = getComputedStyle(document.documentElement);
  const sig = css.getPropertyValue('--signal').trim() || '#ff7a2f';
  const dim = css.getPropertyValue('--ink-faint').trim() || '#646c75';

  // Zero line.
  sctx.strokeStyle = dim;
  sctx.globalAlpha = 0.32;
  sctx.lineWidth = 1;
  sctx.beginPath();
  sctx.moveTo(0, stage === 4 || stage === 5 ? H - 26 : mid);
  sctx.lineTo(W, stage === 4 || stage === 5 ? H - 26 : mid);
  sctx.stroke();
  sctx.globalAlpha = 1;

  const base = stage === 4 || stage === 5 ? H - 26 : mid;
  const scale = stage === 4 || stage === 5 ? (H - 52) : (H / 2 - 22);

  // Glow pass, then the crisp trace on top.
  for (const pass of [{ w: 6, a: 0.16 }, { w: 1.7, a: 1 }]) {
    sctx.beginPath();
    sctx.strokeStyle = sig;
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

// Scope has its own ticker so it keeps running independent of the 3D scenes.
(function scopeLoop() {
  if (onScreen(scope)) {
    if (!REDUCED) phase += 0.016;
    drawScope(phase);
  }
  requestAnimationFrame(scopeLoop);
})();

// Walk the chain automatically as the section scrolls.
ScrollTrigger.create({
  trigger: '#chain',
  start: 'top 60%',
  end: 'bottom bottom',
  scrub: true,
  onUpdate: (self) => {
    const i = Math.min(CHAIN.length - 1, Math.floor(self.progress * CHAIN.length));
    if (i !== stage) selectStage(i);
  },
});

/* =============================================================== parts */

const partCanvas = $('#part-canvas');
const partScene = createPartScene(partCanvas);
scenes.push({ canvas: partCanvas, frame: partScene.frame });

const filterEl = $('#parts-filter');
const listEl = $('#parts-list');
const detailEl = $('#part-detail');
const badgeEl = $('#part-badge');

let filter = 'all';
let selected = PARTS[0].id;

filterEl.innerHTML = [{ id: 'all', label: 'All' }, ...GROUPS]
  .map((g) => `<button role="tab" data-group="${g.id}" aria-selected="${g.id === 'all'}">${g.label}</button>`)
  .join('');

function renderList() {
  const items = PARTS.filter((p) => filter === 'all' || p.group === filter);
  listEl.innerHTML = items.map((p) => `
    <li>
      <button class="part-btn" data-id="${p.id}" aria-selected="${p.id === selected}">
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

  $$('.part-btn').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.id === id)));
  partScene.show(p.model);

  badgeEl.innerHTML = `<b>${p.designator}</b><span>${p.package}</span>`;

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
    <p class="pnote" data-safety="${!!p.safety}">${p.note}</p>`;

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

// Drag to spin.
{
  const v = $('.parts-viewer');
  let down = false, lastX = 0;
  v.addEventListener('pointerdown', (e) => {
    down = true; lastX = e.clientX; v.setPointerCapture(e.pointerId);
  });
  v.addEventListener('pointermove', (e) => {
    if (!down) return;
    partScene.state.drag += (e.clientX - lastX) * 0.01;
    lastX = e.clientX;
  });
  const up = () => { down = false; };
  v.addEventListener('pointerup', up);
  v.addEventListener('pointercancel', up);
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

if (!REDUCED) {
  $$('.sec-head, .chain-scope, .parts-layout, .decision, .table-scroll, .placeholder-note .wrap')
    .forEach((el) => {
      el.classList.add('reveal');
      gsap.to(el, {
        opacity: 1, y: 0, duration: 0.7, ease: 'power2.out',
        scrollTrigger: { trigger: el, start: 'top 88%', toggleActions: 'play none none reverse' },
      });
    });
}

requestAnimationFrame(loop);
ScrollTrigger.refresh();
