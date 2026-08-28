// Dev-only check: reduced motion, keyboard focus, and heading order.
import { chromium } from 'playwright';

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell' });

// Reduced motion — pinned sections must still render their final state.
const rm = await b.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
const p = await rm.newPage();
const errs = [];
p.on('pageerror', (e) => errs.push(e.message));
await p.goto('http://localhost:4173/', { waitUntil: 'networkidle' });
await p.waitForTimeout(2000);
await p.screenshot({ path: '/tmp/shots/rm-hero.png' });
await p.evaluate(() => document.querySelector('#parts').scrollIntoView({ block: 'start' }));
await p.waitForTimeout(1200);
await p.screenshot({ path: '/tmp/shots/rm-parts.png' });

// Nothing should be left invisible by the reveal class under reduced motion.
const hidden = await p.evaluate(() =>
  [...document.querySelectorAll('.reveal')]
    .filter((el) => getComputedStyle(el).opacity === '0').length);

const headings = await p.evaluate(() =>
  [...document.querySelectorAll('h1,h2,h3')].map((h) => h.tagName));

const focusables = await p.evaluate(() =>
  document.querySelectorAll('a[href], button, [tabindex]:not([tabindex="-1"])').length);

const noAlt = await p.evaluate(() =>
  [...document.querySelectorAll('img')].filter((i) => !i.alt).length);

const canvasLabelled = await p.evaluate(() =>
  [...document.querySelectorAll('canvas')]
    .every((c) => c.hasAttribute('aria-hidden') || c.hasAttribute('aria-label')));

console.log('reduced-motion hidden elements :', hidden, hidden === 0 ? 'OK' : 'FAIL');
console.log('h1 count                      :', headings.filter((h) => h === 'H1').length);
console.log('heading order                 :', headings.slice(0, 8).join(' '));
console.log('focusable controls            :', focusables);
console.log('images missing alt            :', noAlt);
console.log('every canvas labelled/hidden  :', canvasLabelled ? 'OK' : 'FAIL');
console.log('page errors                   :', errs.length ? errs.join('; ') : 'none');

await b.close();
