import { chromium } from 'playwright';
const OUT = '/tmp/shots2';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell' });
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
const errs = [];
p.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message));
p.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('ERR_CONNECTION_RESET')) errs.push(m.text()); });

await p.goto('http://localhost:4173/', { waitUntil: 'networkidle' });
await p.waitForTimeout(2600);
await p.screenshot({ path: `${OUT}/01-hero.png` });

for (const [n, y] of [['02-explode-a', 1.5], ['03-explode-b', 2.6], ['04-explode-c', 3.3]]) {
  await p.evaluate((v) => window.scrollTo(0, v * window.innerHeight), y);
  await p.waitForTimeout(1500);
  await p.screenshot({ path: `${OUT}/${n}.png` });
}

for (const t of ['chain', 'parts', 'decisions', 'bom']) {
  await p.evaluate((id) => {
    document.querySelector(`#tab-${id}`).click();
    document.querySelector('#tablist').scrollIntoView({ block: 'start' });
  }, t);
  await p.waitForTimeout(1600);
  await p.screenshot({ path: `${OUT}/05-tab-${t}.png` });
}

// A couple of parts, to check the hue linkage.
await p.evaluate(() => document.querySelector('#tab-parts').click());
await p.waitForTimeout(800);
for (const id of ['mg90s', 'esp32', 'electrodes']) {
  await p.evaluate((i) => document.querySelector(`.part-btn[data-id="${i}"]`)?.click(), id);
  await p.waitForTimeout(1300);
  await p.screenshot({ path: `${OUT}/06-part-${id}.png` });
}

const overflow = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
console.log('horizontal overflow:', overflow);
console.log(errs.length ? 'ERRORS:\n' + errs.join('\n') : 'no errors');
await b.close();
