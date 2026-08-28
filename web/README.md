# EMG Robotic Hand — website

Interactive site for the EMG-controlled robotic hand. Vanilla Three.js and GSAP
on Vite; no framework, no backend, deploys as static files.

```bash
cd web
npm install
npm run dev      # http://localhost:5173
npm run build    # → dist/
npm run preview  # serve the build on :4173
```

## What is on the page

| Section | What it does |
| --- | --- |
| Hero | The hand, lit and slowly drifting. Copy left, model right. |
| Build | Scroll-scrubbed exploded view. The forearm splits, servos and boards separate, copy changes with each beat. |
| Signal chain | The six analog stages. A canvas scope draws the waveform as it appears *at that stage*; click a stage or scroll through them. |
| Parts | Every BOM component as a rotating 3D model with an explanation of what it is and why it is in the design. |
| Decisions | The four engineering rationale writeups from the root README. |
| BOM | Full bill of materials and cost. |

## The hand is placeholder geometry

`src/three/hand.js` builds a stand-in, not the real InMoov assembly. What is
already correct is the **structure**: every part is a separately named object
with its own pivot and an explicit `userData.explode` travel vector.

```
forearm.shell.upper   forearm.shell.lower   palm.core   palm.routing
servo.{thumb,index,middle,ring,pinky}       pcb.afe     mcu.esp32
finger.<name>.{prox,mid,dist}               tendon.<name>            wrist
```

To swap in real geometry: load the GLB, match those names, and reuse the same
travel vectors. `setExplode()` and `setCurl()` need no changes — the
choreography in `src/three/scene.js` and the scroll beats in `src/main.js` are
written against the names, not the meshes.

## The components are modelled, not photographed

`src/three/components.js` builds each BOM part procedurally from its package
dimensions — MSOP-8, DIP-8, DO-35, the MG90S, the dev board, the electrode.
No downloaded assets, so there is no licensing question, and they stay sharp at
any zoom. `buildComponent()` normalises every part to the same on-screen size so
one camera framing suits all of them.

Adding a part: write a builder, register it in `BUILDERS`, then add an entry to
`src/data/parts.js` with a matching `model` key.

## Content lives in one place

`src/data/parts.js` holds the components, the bill of materials, the signal
chain, and the design decisions. Every figure in it comes from the root
`README.md` and `hardware/pcb/bom.csv`. The 3D scene, the tables, and the copy
all read from it — edit once and every surface updates.

## Waveforms are synthetic

The scope trace is generated in `src/main.js` (`sample()`), not recorded. It is
shaped to show what each stage *does* — drift present then removed, hum present
then filtered, rectification, envelope extraction — but it is not measured data.
Replace it with real captures when they exist; `scripts/generate_test_signal.py`
in the repo root already produces suitable input.

## Accessibility

`prefers-reduced-motion` is honoured throughout: scrub and pin are disabled, the
model holds still, and every section renders its final state. Verified with
`node a11y.mjs` against a running preview.

## Dev scripts

`shot.mjs` and `a11y.mjs` are development checks, not part of the build. They
drive the preview server with Playwright to capture screenshots and verify
reduced motion, heading order, and focusable controls.

```bash
npm run preview           # in one shell
node shot.mjs /tmp/shots  # screenshots at several scroll depths
node a11y.mjs             # reduced motion + a11y report
```

## Single-file build

`pack-artifact.mjs` folds `dist/` into one self-contained HTML file — useful for
sharing a preview without hosting anything.

```bash
npm run build
node pack-artifact.mjs emg-hand-site.html
```

Three.js no longer ships a UMD build, so the library is inlined rather than
pulled from a CDN. The result has no network dependency apart from the webfonts.
