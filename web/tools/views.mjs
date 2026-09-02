import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell' });
const VIEWS = [
  ['front',  { targetYaw: 0,     targetPitch: 0.00, targetDist: 300, targetLift: 55 }],
  ['back',   { targetYaw: 3.1416, targetPitch: 0.00, targetDist: 300, targetLift: 55 }],
  ['ulnar',  { targetYaw: 1.5708, targetPitch: 0.00, targetDist: 300, targetLift: 55 }],
  ['radial', { targetYaw: -1.5708, targetPitch: 0.00, targetDist: 300, targetLift: 55 }],
  ['top',    { targetYaw: 0,     targetPitch: 0.85, targetDist: 280, targetLift: 70 }],
  ['knuck',  { targetYaw: -0.35, targetPitch: 0.30, targetDist: 200, targetLift: 55 }],
];
for (const [name, st] of VIEWS) {
  const p = await b.newPage({ viewport: { width: 900, height: 1000 }, deviceScaleFactor: 2 });
  p.on('pageerror', (e) => console.log('ERR', e.message));
  await p.addInitScript(() => { window.__forceQuality = true; });
  await p.goto('http://localhost:5199/', { waitUntil: 'load' });
  await p.waitForTimeout(11000);
  await p.evaluate((s) => {
    const e = window.__explorer; if (!e) return;
    Object.assign(e.state, s); e.state.autoSpin = false;
    // hide the page chrome so nothing overlaps the model
    for (const sel of ['.stage-head', '.stage-controls', '.stage-stats', '.scroll-cue', '.nav', '.chapters'])
      document.querySelectorAll(sel).forEach((n) => (n.style.display = 'none'));
  }, st);
  await p.waitForTimeout(6000);
  await p.screenshot({ path: `/tmp/shots4/${name}.png`, animations: 'disabled', timeout: 60000 });
  await p.close();
}
await b.close(); console.log('ok');
