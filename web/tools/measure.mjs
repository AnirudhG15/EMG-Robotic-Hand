import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell' });
const p = await b.newPage({ viewport: { width: 900, height: 900 } });
p.on('pageerror', (e) => console.log('ERR', e.message));
await p.addInitScript(() => { window.__forceQuality = true; });
await p.goto('http://localhost:5199/', { waitUntil: 'load' });
await p.waitForTimeout(11000);
const out = await p.evaluate(() => {
  const e = window.__explorer;
  const THREE = window.__THREE;
  const items = e.items;
  const want = new Set(['Index3', 'Majeure3', 'thumb5', 'topsurface6', 'topsurfaceUP6']);
  const rows = [];
  for (const it of items) {
    if (it.name && it.children[0] && it.children[0].userData.length) {
      const f = it.children[0];
      rows.push(`>> ${it.name} natural=${f.userData.length.toFixed(1)} holderScale=(${it.scale.x.toFixed(3)}, ${it.scale.y.toFixed(3)}, ${it.scale.z.toFixed(3)})`);
    }
    if (!want.has(it.userData.id)) continue;
    it.traverse((o) => {
      if (!o.isGroup || !o.name || o.name.indexOf('.') < 0) return;
      const box = new THREE.Box3().setFromObject(o);
      if (!isFinite(box.min.x)) return;
      const c = box.getCenter(new THREE.Vector3());
      const s = box.getSize(new THREE.Vector3());
      rows.push(`${o.name.padEnd(26)} c=(${c.x.toFixed(1)}, ${c.y.toFixed(1)}, ${c.z.toFixed(1)})  size=(${s.x.toFixed(1)}, ${s.y.toFixed(1)}, ${s.z.toFixed(1)})  y:${box.min.y.toFixed(1)}..${box.max.y.toFixed(1)}  z:${box.min.z.toFixed(1)}..${box.max.z.toFixed(1)}`);
    });
    const box = new THREE.Box3().setFromObject(it);
    const s = box.getSize(new THREE.Vector3());
    rows.push(`== ${it.userData.id}  size=(${s.x.toFixed(1)}, ${s.y.toFixed(1)}, ${s.z.toFixed(1)})  y:${box.min.y.toFixed(1)}..${box.max.y.toFixed(1)}  z:${box.min.z.toFixed(1)}..${box.max.z.toFixed(1)}`);
  }
  return rows.join('\n');
});
console.log(out);
await b.close();
