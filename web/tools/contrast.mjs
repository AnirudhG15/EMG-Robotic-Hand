// Walks every text node's computed colour against its nearest painted ancestor
// background and reports anything under WCAG AA.
import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell' });
const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
await p.addInitScript(() => { window.__forceQuality = true; });
await p.goto('http://localhost:4173/', { waitUntil: 'load' });
await p.waitForTimeout(9000);

const check = async (label) => {
  const bad = await p.evaluate(() => {
    const lum = (c) => {
      const f = c.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
      return 0.2126 * f[0] + 0.7152 * f[1] + 0.0722 * f[2];
    };
    // Chrome serialises color-mix() as `color(srgb r g b / a)` with 0-1 floats,
    // while plain colours come back as `rgb(0-255 ...)`. Reading both as 0-255
    // makes every mixed background look near-black and fails the whole nav.
    const parse = (s) => {
      const n = (s.match(/[\d.]+/g) || []).map(Number);
      if (!n.length) return [];
      const k = s.startsWith('color(') ? 255 : 1;
      return [n[0] * k, n[1] * k, n[2] * k, ...(n.length > 3 ? [n[3]] : [])];
    };
    const over = (fg, bg) => {          // composite fg (with alpha) over bg
      const a = fg[3] === undefined ? 1 : fg[3];
      return [0, 1, 2].map((i) => fg[i] * a + bg[i] * (1 - a));
    };
    const bgOf = (el) => {
      let n = el, acc = null;
      while (n && n !== document.documentElement) {
        const c = parse(getComputedStyle(n).backgroundColor);
        if (c.length && (c[3] === undefined || c[3] > 0.02)) {
          acc = acc ? over(acc, c) : c;
          if (c[3] === undefined || c[3] >= 0.98) return acc.slice(0, 3);
        }
        n = n.parentElement;
      }
      return acc ? acc.slice(0, 3) : [255, 255, 255];
    };
    const out = [];
    for (const el of document.querySelectorAll('body *')) {
      if (!el.firstChild) continue;
      const hasText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
      if (!hasText) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity < 0.15) continue;
      if (cs.color === 'rgba(0, 0, 0, 0)' || cs.webkitTextFillColor === 'rgba(0, 0, 0, 0)') continue;
      if (!el.getClientRects().length) continue;
      const fg = over(parse(cs.color), bgOf(el));
      const bg = bgOf(el);
      const l1 = lum(fg), l2 = lum(bg);
      const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
      const px = parseFloat(cs.fontSize);
      const large = px >= 24 || (px >= 18.66 && +cs.fontWeight >= 700);
      const need = large ? 3 : 4.5;
      if (ratio < need) {
        out.push(`${ratio.toFixed(2)}:1 (need ${need}) ${el.tagName.toLowerCase()}.${(el.className || '').toString().split(' ')[0]} "${el.textContent.trim().slice(0, 34)}"`);
      }
    }
    return [...new Set(out)];
  });
  console.log(`--- ${label} --- ${bad.length ? bad.length + ' below AA' : 'all pass'}`);
  bad.slice(0, 14).forEach((l) => console.log('   ' + l));
};

await check('hero');
for (const t of ['chain', 'parts', 'decisions', 'bom']) {
  await p.evaluate((x) => document.querySelector(`#tab-${x}`).click(), t);
  await p.waitForTimeout(1400);
  await check(t);
}
await b.close();
