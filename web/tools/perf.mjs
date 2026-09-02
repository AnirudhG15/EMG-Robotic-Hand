// Frame cost of the background field, measured on its own: the WebGL hero is
// software-rendered here and would drown everything else out.
import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell' });
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
await p.goto('about:blank');
await p.addScriptTag({ path: 'dist/assets/' + (await p.evaluate(() => 1), '') }).catch(() => {});
// Drive the module directly against a bare canvas.
const ms = await p.evaluate(async (src) => {
  const mod = await import('data:text/javascript;base64,' + btoa(unescape(encodeURIComponent(src))));
  const c = document.createElement('canvas');
  c.style.width = '1440px'; c.style.height = '900px';
  Object.defineProperty(c, 'clientWidth', { value: 1440 });
  Object.defineProperty(c, 'clientHeight', { value: 900 });
  document.body.appendChild(c);
  const field = mod.createCircuit(c, {});
  for (let i = 0; i < 20; i++) field.frame(16.7);          // warm up
  const t0 = performance.now();
  for (let i = 0; i < 120; i++) field.frame(16.7);
  return (performance.now() - t0) / 120;
}, await (await import('node:fs/promises')).readFile('src/circuit.js', 'utf8'));
console.log('field draw cost:', ms.toFixed(2), 'ms/frame  (budget at 60fps is 16.7)');
await b.close();
