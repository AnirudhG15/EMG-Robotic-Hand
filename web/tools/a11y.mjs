// Dev-only check: reduced motion, tab semantics, keyboard focus, heading order.
import { chromium } from 'playwright';

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell' });

const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
const p = await ctx.newPage();
const errs = [];
p.on('pageerror', (e) => errs.push(e.message));
await p.addInitScript(() => { window.__forceQuality = true; });
await p.goto('http://localhost:4173/', { waitUntil: 'networkidle' });
await p.waitForTimeout(12000);
await p.screenshot({ path: '/tmp/shots2/rm-hero.png' });

// Every panel must render fully once opened, with nothing stranded at opacity 0.
const panelReport = [];
for (const id of ['chain', 'parts', 'decisions', 'bom']) {
  await p.evaluate((t) => document.querySelector(`#tab-${t}`).click(), id);
  await p.waitForTimeout(2500);
  const r = await p.evaluate((t) => {
    const panel = document.querySelector(`#panel-${t}`);
    const hidden = [...panel.querySelectorAll('*')]
      .filter((el) => getComputedStyle(el).opacity === '0').length;
    return { visible: !panel.hidden, h: panel.getBoundingClientRect().height, hidden };
  }, id);
  panelReport.push(`${id}: visible=${r.visible} height=${Math.round(r.h)} zero-opacity=${r.hidden}`);
}
await p.screenshot({ path: '/tmp/shots2/rm-bom.png' });

// Exactly one tab selected, and roving tabindex on the rest.
const tabState = await p.evaluate(() => {
  const tabs = [...document.querySelectorAll('[role="tab"]')].filter((t) => t.closest('#tablist'));
  return {
    total: tabs.length,
    selected: tabs.filter((t) => t.getAttribute('aria-selected') === 'true').length,
    focusable: tabs.filter((t) => t.tabIndex === 0).length,
    panelsLabelled: tabs.every((t) => {
      const panel = document.getElementById(t.getAttribute('aria-controls'));
      return panel && panel.getAttribute('aria-labelledby') === t.id;
    }),
  };
});

const headings = await p.evaluate(() =>
  [...document.querySelectorAll('h1,h2,h3')]
    .filter((h) => h.offsetParent !== null).map((h) => h.tagName));

const canvasOk = await p.evaluate(() =>
  [...document.querySelectorAll('canvas')]
    .every((c) => c.hasAttribute('aria-hidden') || c.hasAttribute('aria-label')));

const noAlt = await p.evaluate(() =>
  [...document.querySelectorAll('img')].filter((i) => !i.alt).length);

console.log('--- reduced motion ---');
panelReport.forEach((l) => console.log('  ' + l));
console.log('--- tabs ---');
console.log(`  ${tabState.total} tabs, ${tabState.selected} selected, ${tabState.focusable} in tab order`);
console.log('  panels labelled by their tab:', tabState.panelsLabelled ? 'OK' : 'FAIL');
console.log('--- document ---');
console.log('  h1 count:', headings.filter((h) => h === 'H1').length);
console.log('  visible heading order:', headings.join(' '));
console.log('  canvases labelled/hidden:', canvasOk ? 'OK' : 'FAIL');
console.log('  images missing alt:', noAlt);
console.log('  page errors:', errs.length ? errs.join('; ') : 'none');

await b.close();
