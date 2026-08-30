// Dev-only visual check. Captures the page at several scroll depths and reports
// any console errors. Not part of the site build.
import { chromium } from 'playwright';

const OUT = process.argv[2] || '/tmp/shots';
const shots = [
  { name: '01-hero', y: 0 },
  { name: '02-explode-mid', y: 1.6 },
  { name: '03-explode-full', y: 3.2 },
  { name: '04-chain', y: 4.4 },
  { name: '05-parts', y: 5.6 },
  { name: '06-decisions', y: 7.0 },
];

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell' });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });

const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));

await page.goto('http://localhost:4173/', { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);

for (const s of shots) {
  await page.evaluate((vh) => window.scrollTo(0, vh * window.innerHeight), s.y);
  await page.waitForTimeout(1400);
  await page.screenshot({ path: `${OUT}/${s.name}.png` });
}

// Mobile pass.
const m = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
m.on('pageerror', (e) => errors.push('MOBILE PAGEERROR: ' + e.message));
await m.goto('http://localhost:4173/', { waitUntil: 'networkidle' });
await m.waitForTimeout(2000);
await m.screenshot({ path: `${OUT}/07-mobile-hero.png` });
await m.evaluate(() => window.scrollTo(0, 5.6 * window.innerHeight));
await m.waitForTimeout(1200);
await m.screenshot({ path: `${OUT}/08-mobile-parts.png` });

// Does the page scroll sideways anywhere?
const overflow = await page.evaluate(() =>
  document.documentElement.scrollWidth - document.documentElement.clientWidth);

console.log('horizontal overflow (px):', overflow);
console.log(errors.length ? 'CONSOLE ERRORS:\n' + errors.join('\n') : 'no console errors');

await browser.close();
