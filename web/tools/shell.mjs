// Renders one part from six axis directions, to see what is inside it.
//
// Written to settle whether the forearm shells carry any servo mounting: a
// fitted-circle measurement of each arch section said robpart2V4 has 10.6% of
// its vertices well inside the wall while robpart4V4 has 0.1%, and these views
// show what that is -- internal ribs in robpart2V4, a bare C-section in
// robpart3V4.
//
// Takes whatever part ids you pass; defaults to the two forearm halves.
// Needs the dev server on :5199.  node tools/shell.mjs [partId ...]
import { chromium } from 'playwright';

const parts = process.argv.slice(2);
const want = parts.length ? parts : ['robpart2V4', 'robpart3V4'];

const b = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell',
});
for (const part of want) {
  const p = await b.newPage({ viewport: { width: 1560, height: 340 }, deviceScaleFactor: 2 });
  p.on('pageerror', (e) => console.log('ERR', part, e.message));
  await p.goto(`http://localhost:5199/tools/islands.html?part=${part}&i=0`, { waitUntil: 'load' });
  await p.waitForFunction(() => window.__ready === true, { timeout: 60000 })
    .catch(() => console.log('timeout', part));
  await p.screenshot({ path: `/tmp/shots4/${part}.png` });
  await p.close();
  console.log(`/tmp/shots4/${part}.png`);
}
await b.close();
