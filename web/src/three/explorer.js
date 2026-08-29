import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { loadHandPack } from './handpack.js';
import { buildHandAssembly, setExplode } from './assembly.js';

const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Every animated value is a target the frame loop eases toward with a
// time-based exponential, so input never steps the model — it glides. One
// helper keeps the response identical everywhere.
const ease = (cur, target, dt, speed) =>
  cur + (target - cur) * (1 - Math.exp(-dt * speed));

export function createExplorer(canvas, { onHover, onSelect, onReady, onError } = {}) {
  const renderer = new THREE.WebGLRenderer({
    canvas, antialias: true, alpha: true, powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.92;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 1, 6000);

  // Image-based lighting does most of the realism: printed PLA reads by what it
  // reflects, and direct lights alone leave it flat.
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();

  scene.add(new THREE.AmbientLight(0xffffff, 0.22));
  scene.add(new THREE.HemisphereLight(0xa9bde0, 0x1a1430, 0.42));

  const key = new THREE.DirectionalLight(0xfff0e2, 1.55);
  key.position.set(260, 420, 340);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.near = 80;
  key.shadow.camera.far = 1400;
  const S = 320;
  Object.assign(key.shadow.camera, { left: -S, right: S, top: S, bottom: -S });
  key.shadow.bias = -0.0008;
  key.shadow.normalBias = 1.2;
  scene.add(key);

  const fill = new THREE.DirectionalLight(0x8fa8ff, 0.6);
  fill.position.set(-380, 90, 180);
  scene.add(fill);

  const rim = new THREE.DirectionalLight(0xffa35c, 1.15);
  rim.position.set(-120, 200, -420);
  scene.add(rim);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(3000, 3000),
    new THREE.ShadowMaterial({ opacity: 0.42 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -330;
  floor.receiveShadow = true;
  scene.add(floor);

  /* ------------------------------------------------------------ composer */

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));

  // Ambient occlusion is what stops this reading as CG. Without it the gaps
  // between fingers, the inside of the shell and every joint crevice stay
  // uniformly lit and printed plastic has no depth. Radius is in scene units,
  // so it is set in millimetres like everything else.
  const gtao = new GTAOPass(scene, camera, 1, 1);
  gtao.output = GTAOPass.OUTPUT.Default;
  gtao.blendIntensity = 0.85;
  gtao.updateGtaoMaterial({
    radius: 14, distanceExponent: 1.4, thickness: 12,
    scale: 1.05, samples: 16, screenSpaceRadius: false,
  });
  composer.addPass(gtao);
  // Threshold above 1.0 so only emissive highlights bloom; printed PLA lit by
  // the key light must not.
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.55, 0.6, 1.15);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  /* --------------------------------------------------------------- state */

  const state = {
    yaw: -0.9, targetYaw: -0.35,
    pitch: 0.12, targetPitch: 0.06,
    dist: 1250, targetDist: 900,
    lift: -70, targetLift: -70,
    explode: 0, targetExplode: 0,
    xray: 0, targetXray: 0,
    autoSpin: true,
  };
  // Remembers whether the viewer asked for x-ray, so auto-opening the shell to
  // reveal an enclosed part can be undone without overriding their choice.
  let userXray = false;

  let hand = null;
  let items = [];
  let hovered = null;
  let selected = null;
  let lastT = 0;
  let ready = false;

  const BASE = { color: 0x9098ad, roughness: 0.62, metalness: 0.04 };

  loadHandPack(new THREE.MeshStandardMaterial(BASE)).then((parts) => {
    hand = buildHandAssembly(parts);
    scene.add(hand);
    items = hand.userData.items;

    // One material per item so hover, selection and x-ray can act on a single
    // part without touching the rest of the model.
    for (const it of items) {
      // transparent is fixed at creation: flipping it later needs a shader
      // recompile, which is why fading silently did nothing when it was toggled
      // per frame. depthWrite carries the cost instead — at full opacity these
      // still depth-sort like opaque geometry.
      const mat = new THREE.MeshStandardMaterial({ ...BASE, transparent: true });
      it.traverse((m) => {
        if (!m.isMesh) return;
        if (it.userData.sub === 'electronics') { m.userData.keepMat = true; return; }
        m.material = mat;
        m.castShadow = it.userData.sub === 'shell' || it.userData.sub === 'palm';
        m.receiveShadow = false;
      });
      it.userData.mat = it.userData.sub === 'electronics' ? null : mat;
    }
    ready = true;
    if (onReady) onReady(items.map((it) => ({
      id: it.userData.id,
      label: it.userData.label,
      sub: it.userData.sub,
      hue: it.userData.hue,
    })));
  }).catch((e) => {
    console.warn('handpack failed', e);
    if (onError) onError(e);
  });

  /* ------------------------------------------------------------ picking */

  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let pointerInside = false;

  function pick(cx, cy) {
    if (!items.length) return null;
    const r = canvas.getBoundingClientRect();
    ndc.x = ((cx - r.left) / r.width) * 2 - 1;
    ndc.y = -((cy - r.top) / r.height) * 2 + 1;
    ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObjects(items, true);
    if (!hits.length) return null;

    // Once the shells are see-through, clicking should reach what is visible
    // behind them, so skip a hit the viewer can no longer really see.
    const seeThrough = Math.max(state.xray, Math.min(1, state.explode * 1.6)) > 0.45;
    for (const h of hits) {
      let o = h.object;
      while (o && !o.userData.sub) o = o.parent;
      if (!o) continue;
      if (seeThrough && o.userData.sub === 'shell') continue;
      return o;
    }
    // Nothing but shells under the cursor — take the nearest one anyway.
    let o = hits[0].object;
    while (o && !o.userData.sub) o = o.parent;
    return o || null;
  }

  /* ------------------------------------------------------- pointer input */

  let dragging = false;
  let lastX = 0, lastY = 0, moved = 0;

  canvas.addEventListener('pointerdown', (e) => {
    dragging = true; moved = 0;
    lastX = e.clientX; lastY = e.clientY;
    state.autoSpin = false;
    canvas.setPointerCapture(e.pointerId);
  });

  canvas.addEventListener('pointermove', (e) => {
    pointerInside = true;
    if (dragging) {
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      moved += Math.abs(dx) + Math.abs(dy);
      state.targetYaw -= dx * 0.006;
      state.targetPitch = Math.max(-0.5, Math.min(0.7, state.targetPitch + dy * 0.004));
      lastX = e.clientX; lastY = e.clientY;
      return;
    }
    const hit = pick(e.clientX, e.clientY);
    if (hit !== hovered) {
      hovered = hit;
      canvas.style.cursor = hit ? 'pointer' : 'grab';
      if (onHover) onHover(hit ? hit.userData : null);
    }
  });

  canvas.addEventListener('pointerup', (e) => {
    dragging = false;
    if (moved < 6) {
      const hit = pick(e.clientX, e.clientY);
      select(hit);
    }
  });
  canvas.addEventListener('pointercancel', () => { dragging = false; });
  canvas.addEventListener('pointerleave', () => {
    pointerInside = false;
    if (hovered) { hovered = null; if (onHover) onHover(null); }
  });

  /* ---------------------------------------------------------- selection */

  const _box = new THREE.Box3();
  const _sph = new THREE.Sphere();

  function select(item) {
    selected = item || null;
    if (onSelect) onSelect(selected ? selected.userData : null);
    if (hovered) { hovered = null; if (onHover) onHover(null); }

    if (!selected) {
      state.targetLift = -70;
      state.targetDist = 900;
      state.targetXray = userXray ? 1 : 0;
      return;
    }
    state.autoSpin = false;

    // Electronics live inside the forearm. Selecting one and leaving the shell
    // opaque just puts the camera against a wall, so open it automatically.
    if (selected.userData.sub === 'electronics') state.targetXray = 1;
    else state.targetXray = userXray ? 1 : 0;

    // Frame by the part's own size. A fingertip and a forearm shell differ by
    // an order of magnitude, so a fixed distance crops one and loses the other.
    _box.setFromObject(selected);
    _box.getBoundingSphere(_sph);
    const fov = camera.fov * Math.PI / 180;
    const need = (_sph.radius * 2.6) / Math.tan(fov / 2);
    state.targetLift = _sph.center.y;
    state.targetDist = Math.max(300, Math.min(1000, need));
  }

  /* -------------------------------------------------------------- frame */

  function resize() {
    const w = canvas.clientWidth || 1;
    const h = canvas.clientHeight || 1;
    const dpr = renderer.getPixelRatio();
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      renderer.setSize(w, h, false);
      composer.setSize(w, h);
      gtao.setSize(w, h);
      bloom.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
  }

  const target = new THREE.Vector3();

  // Adaptive quality. GTAO and bloom are the two expensive passes; on a device
  // that cannot hold a smooth frame they are dropped in that order rather than
  // letting the whole scene stutter. Sampling starts after a warm-up so shader
  // compilation and the first upload do not count against it.
  let qualityFrames = 0;
  let slowFrames = 0;
  let tier = 2;
  function checkQuality(dt) {
    if (tier === 0) return;
    qualityFrames++;
    if (qualityFrames < 40) return;      // warm-up
    if (dt > 34) slowFrames++;
    if (qualityFrames < 130) return;     // ~2s sample
    if (slowFrames > 45) {
      tier--;
      if (tier === 1) gtao.enabled = false;
      else if (tier === 0) bloom.enabled = false;
    }
    qualityFrames = 40;
    slowFrames = 0;
  }

  function frame(t) {
    resize();
    const dt = Math.min(60, lastT ? t - lastT : 16.7);
    lastT = t;
    if (ready) checkQuality(dt);

    if (state.autoSpin && !REDUCED && !selected) state.targetYaw += dt * 0.00009;

    const k = REDUCED ? 60 : 0.0062;
    state.yaw = ease(state.yaw, state.targetYaw, dt, k);
    state.pitch = ease(state.pitch, state.targetPitch, dt, k);
    state.dist = ease(state.dist, state.targetDist, dt, k * 0.8);
    state.lift = ease(state.lift, state.targetLift, dt, k * 0.8);
    state.explode = ease(state.explode, state.targetExplode, dt, 0.0075);
    state.xray = ease(state.xray, state.targetXray, dt, 0.009);

    if (hand) {
      setExplode(hand, state.explode);

      // Shells fade as x-ray rises or the model opens, revealing the servos and
      // boards inside without having to hide them outright.
      const open = Math.max(state.xray, Math.min(1, state.explode * 1.6));
      for (const it of items) {
        const m = it.userData.mat;
        if (!m) continue;
        const isShell = it.userData.sub === 'shell';
        const dim = selected && selected !== it ? 0.5 : 1;
        const targetOp = isShell ? (1 - open * 0.82) * dim : dim;
        m.opacity = targetOp;
        m.depthWrite = targetOp > 0.9;

        const glow = it === hovered ? 0.16 : it === selected ? 0.34 : 0;
        m.emissive.setHex(it.userData.hue);
        m.emissiveIntensity = glow;
      }
    }

    // The camera pulls back as the model opens, or the spread parts leave frame.
    const d = state.dist * (1 + state.explode * 0.62);
    const cp = Math.cos(state.pitch);
    camera.position.set(
      Math.sin(state.yaw) * d * cp,
      state.lift + Math.sin(state.pitch) * d + 60,
      Math.cos(state.yaw) * d * cp,
    );

    // On a portrait viewport the detail panel is a bottom sheet covering the
    // lower half, so aim lower to push the model into the visible top half.
    const portrait = canvas.clientHeight > canvas.clientWidth * 1.15;
    const visH = 2 * d * Math.tan((camera.fov * Math.PI / 180) / 2);
    target.set(0, state.lift - (portrait ? visH * 0.16 : 0), 0);
    camera.lookAt(target);

    composer.render();
  }

  const byId = (id) => items.find((it) => it.userData.id === id) || null;

  return {
    state, frame, resize, select,
    get ready() { return ready; },
    selectById: (id) => select(byId(id)),
    hoverById: (id) => {
      const it = id ? byId(id) : null;
      if (it === hovered) return;
      hovered = it;
      if (onHover) onHover(it ? it.userData : null);
    },
    setExplode: (v) => { state.targetExplode = v; },
    setXray: (v) => { userXray = v > 0.5; state.targetXray = v; },
    resetView: () => {
      select(null);
      state.targetYaw = -0.35; state.targetPitch = 0.06; state.autoSpin = true;
    },
    get items() { return items; },
  };
}

export { REDUCED };
