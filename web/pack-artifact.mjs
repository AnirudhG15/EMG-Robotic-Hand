// Packages dist/ into one self-contained HTML file.
//
// Three.js dropped its UMD builds, so there is no global-script version to pull
// from a CDN; everything is inlined instead. That also means the page has no
// network dependency at all apart from the webfonts.
//
//   npm run build && node pack-artifact.mjs [outfile]

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const dist = 'dist';
const out = process.argv[2] || 'emg-hand-site.html';

const assets = readdirSync(join(dist, 'assets'));
const jsFile = assets.find((f) => f.endsWith('.js'));
const cssFile = assets.find((f) => f.endsWith('.css'));

const js = readFileSync(join(dist, 'assets', jsFile), 'utf8');
const css = readFileSync(join(dist, 'assets', cssFile), 'utf8');
let html = readFileSync(join(dist, 'index.html'), 'utf8');

// Take the body content only — the artifact host supplies the document shell.
const body = html.match(/<body[^>]*>([\s\S]*?)<\/body>/)[1]
  .replace(/<script[^>]*type="module"[^>]*><\/script>/g, '')
  .replace(/<link[^>]*rel="stylesheet"[^>]*crossorigin[^>]*>/g, '')
  .trim();

// The artifact is one file, so the mesh pack rides inline as base64 instead of
// as two fetched side files.
const packJson = readFileSync(join(dist, 'handpack.json'), 'utf8');
const packB64 = readFileSync(join(dist, 'handpack.bin')).toString('base64');

// Take the font link from the built HTML so the two never drift apart.
const fonts = (html.match(/href="(https:\/\/fonts\.googleapis\.com\/css2[^"]+)"/) || [])[1];
if (!fonts) throw new Error('no Google Fonts link found in dist/index.html');

const page = `<title>EMG Robotic Hand</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${fonts}">
<style>
${css}
</style>

<script>
window.__HANDPACK = { manifest: ${packJson}, b64: "${packB64}" };
</script>

${body}

<script type="module">
${js}
</script>
`;

writeFileSync(out, page);
console.log(`${out} — ${(page.length / 1024 / 1024).toFixed(2)} MB`);
