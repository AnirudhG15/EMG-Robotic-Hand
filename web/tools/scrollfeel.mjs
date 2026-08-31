// Is a wheel notch a jump or a ramp?
//
// Counting frames proves nothing here: headless runs on software WebGL at a
// couple of frames a second, so a one-second ramp collapses into two samples.
// What is frame-rate independent is the relationship between Lenis's target and
// its animated position — on any frame before the ramp finishes, the animated
// position must be strictly short of the target. A native scroll is already
// there on the first frame.
import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell' });
const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.addInitScript(() => { window.__forceQuality = true; });
await p.goto('http://localhost:5199/', { waitUntil: 'load' });
await p.waitForTimeout(9000);

await p.evaluate(() => {
  window.__t = [];
  const l = window.__lenis;
  const tick = () => {
    if (l) window.__t.push([+l.animatedScroll.toFixed(1), +l.targetScroll.toFixed(1)]);
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
});
await p.mouse.move(640, 450);
await p.mouse.wheel(0, 260);
await p.waitForTimeout(2000);

const trace = await p.evaluate(() => window.__t);
const active = trace.filter(([, t]) => t > 0);
const midRamp = active.filter(([a, t]) => a < t - 0.5);

const st = await p.evaluate(() => ({
  lenis: !!window.__lenis,
  reduced: matchMedia('(prefers-reduced-motion: reduce)').matches,
  settled: window.__lenis ? +(window.__lenis.animatedScroll - window.__lenis.targetScroll).toFixed(2) : null,
  explode: window.__explorer ? +window.__explorer.state.targetExplode.toFixed(3) : null,
  scrollY: Math.round(window.scrollY),
}));

console.log('trace (animated/target):', JSON.stringify(active.slice(0, 6)));
console.log('frames mid-ramp        :', midRamp.length,
  midRamp.length ? 'interpolating' : 'JUMPED — not smoothed');
console.log('settled on target      :', st.settled === 0 ? 'yes' : `no (off by ${st.settled})`);
console.log('scroll drove explode   :', st.explode > 0 ? `yes (${st.explode})` : 'NO');
console.log('state                  :', JSON.stringify(st));
console.log('errors                 :', errs.length ? errs.join('; ') : 'none');
await b.close();
