import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { buildHand, setExplode, setCurl } from './hand.js';
import { buildComponent } from './components.js';

const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Image-based lighting. Direct lights alone give metal a flat grey wash — what
// actually sells solder mask, tin plating and moulded epoxy is what they
// reflect. RoomEnvironment is a procedural studio box that ships with three, so
// this costs no download and no HDRI file.
let envCache = null;
function studioEnv(renderer) {
  if (envCache) return envCache;
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  envCache = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  return envCache;
}

// Studio lighting: a warm key from the front-right, a cool fill from the left,
// and a hard amber rim behind. The rim is what separates the part from a dark
// ground without needing a background plate.
function lightRig(scene, { warm = 0xffb27a, cool = 0x6f9ad6, rim = 0xff7a2f } = {}) {
  scene.add(new THREE.AmbientLight(0xffffff, 0.34));

  const hemi = new THREE.HemisphereLight(0x9fb6d6, 0x1a1410, 0.5);
  scene.add(hemi);

  const key = new THREE.DirectionalLight(warm, 2.5);
  key.position.set(4, 6, 5);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = 40;
  key.shadow.camera.left = -8;
  key.shadow.camera.right = 8;
  key.shadow.camera.top = 8;
  key.shadow.camera.bottom = -8;
  key.shadow.bias = -0.0012;
  scene.add(key);

  const fill = new THREE.DirectionalLight(cool, 0.85);
  fill.position.set(-6, 2, 3);
  scene.add(fill);

  const back = new THREE.DirectionalLight(rim, 1.9);
  back.position.set(-2, 3, -7);
  scene.add(back);

  return { key, fill, back };
}

function makeRenderer(canvas) {
  const r = new THREE.WebGLRenderer({
    canvas, antialias: true, alpha: true, powerPreference: 'high-performance',
  });
  r.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  r.outputColorSpace = THREE.SRGBColorSpace;
  r.toneMapping = THREE.ACESFilmicToneMapping;
  r.toneMappingExposure = 1.05;
  r.shadowMap.enabled = true;
  r.shadowMap.type = THREE.PCFSoftShadowMap;
  return r;
}

/* ------------------------------------------------------------- hero scene */

export function createHeroScene(canvas) {
  const renderer = makeRenderer(canvas);
  const scene = new THREE.Scene();
  scene.environment = studioEnv(renderer);
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);

  lightRig(scene);

  const hand = buildHand();
  hand.rotation.y = -0.5;
  hand.rotation.x = 0.16;
  scene.add(hand);

  // Beat highlighting. Each scroll beat names a subsystem; its parts take an
  // emissive rim in that beat's hue so the card's chips and the model agree.
  const HL = {
    shell: { match: (n) => n.startsWith('forearm.shell') || n === 'palm.core', hex: 0xA78BFA },
    servo: { match: (n) => n.startsWith('servo.'), hex: 0xFF7BB0 },
    board: { match: (n) => n === 'pcb.afe' || n === 'mcu.esp32', hex: 0x35CFE8 },
  };
  const lit = [];
  function highlight(group) {
    lit.forEach((m) => { m.emissive.setHex(0x000000); m.emissiveIntensity = 0; });
    lit.length = 0;
    const rule = HL[group];
    if (!rule) return;
    hand.traverse((o) => {
      if (!o.isMesh && !o.isGroup) return;
      let n = o.name;
      if (!n) { let p = o.parent; while (p && !p.name) p = p.parent; n = p ? p.name : ''; }
      if (!rule.match(n)) return;
      o.traverse((c) => {
        if (!c.isMesh || !c.material || !('emissive' in c.material)) return;
        c.material.emissive.setHex(rule.hex);
        c.material.emissiveIntensity = 0.42;
        lit.push(c.material);
      });
    });
  }

  // Catch shadows without painting a visible floor.
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(40, 40),
    new THREE.ShadowMaterial({ opacity: 0.34 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -2.6;
  floor.receiveShadow = true;
  scene.add(floor);

  // Scroll writes targets; the frame loop eases the live values toward them
  // with a time-based exponential. This is what makes the animation feel
  // fluid — the 3D state glides between scroll events instead of stepping
  // with them, and fast flicks settle instead of snapping.
  const state = {
    explode: 0, targetExplode: 0,
    curl: 0,
    spin: -0.85, targetSpin: 0,
    pointer: new THREE.Vector2(),
  };
  const target = new THREE.Vector3();
  let lastT = 0;

  function resize() {
    const w = canvas.clientWidth || 1;
    const h = canvas.clientHeight || 1;
    if (canvas.width !== w * renderer.getPixelRatio() || canvas.height !== h * renderer.getPixelRatio()) {
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
  }

  function frame(t) {
    resize();

    const dt = Math.min(50, lastT ? t - lastT : 16.7);
    lastT = t;
    // ~140 ms response; REDUCED snaps instantly so motion never lags input.
    const a = REDUCED ? 1 : 1 - Math.exp(-dt * 0.0072);
    state.explode += (state.targetExplode - state.explode) * a;
    state.spin += (state.targetSpin - state.spin) * a;

    setExplode(hand, state.explode);
    setCurl(hand, state.curl);

    // Wide screens put the copy on the left, so bias the camera target left to
    // push the model into the right half. Narrow screens centre it and let the
    // scrim carry legibility instead. The bias relaxes as the assembly opens,
    // or the spread parts would walk off the right edge.
    const wide = canvas.clientWidth > 900;
    const bias = wide ? -2.45 * (1 - state.explode * 0.72) : 0;

    // Camera pulls back and lifts as the assembly opens.
    // A portrait viewport has far less horizontal room for the spread parts, so
    // it needs a longer pullback than the width difference alone suggests.
    const d = wide
      ? 8.6 + state.explode * 5.4
      : 10.4 + state.explode * 11.0;
    const lift = 1.1 + state.explode * 2.2;
    camera.position.set(
      Math.sin(state.spin) * d + state.pointer.x * 0.7,
      lift - state.pointer.y * 0.5,
      Math.cos(state.spin) * d,
    );
    target.set(bias, state.explode * 0.25, -0.6);
    camera.lookAt(target);

    if (!REDUCED) hand.rotation.y = -0.5 + Math.sin(t * 0.00012) * 0.06;

    renderer.render(scene, camera);
  }

  return { renderer, scene, camera, hand, state, frame, resize, highlight };
}

/* -------------------------------------------------- component carousel */

export function createPartScene(canvas) {
  const renderer = makeRenderer(canvas);
  const scene = new THREE.Scene();
  scene.environment = studioEnv(renderer);
  scene.environmentIntensity = 1.15;
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
  camera.position.set(0, 1.15, 5.0);
  camera.lookAt(0, 0, 0);

  const rig = lightRig(scene, { warm: 0xffd0a8, rim: 0xff9a4d });

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(30, 30),
    new THREE.ShadowMaterial({ opacity: 0.3 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -1.9;
  floor.receiveShadow = true;
  scene.add(floor);

  const holder = new THREE.Group();
  scene.add(holder);

  const cache = new Map();
  let current = null;
  const state = { spin: 0, targetSpin: 0, drag: 0, entering: 0 };

  // The rim light takes the part's subsystem hue, so the 3D view carries the
  // same colour coding as the list beside it.
  function show(model, hex) {
    if (current) holder.remove(current);
    if (!cache.has(model)) cache.set(model, buildComponent(model));
    current = cache.get(model);
    holder.add(current);
    state.entering = 1;
    if (hex) rig.back.color.set(hex);
  }

  function resize() {
    const w = canvas.clientWidth || 1;
    const h = canvas.clientHeight || 1;
    if (canvas.width !== w * renderer.getPixelRatio() || canvas.height !== h * renderer.getPixelRatio()) {
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
  }

  function frame(t) {
    resize();
    if (current) {
      if (!REDUCED) state.spin += 0.0045;
      const s = state.spin + state.drag;
      current.rotation.y = s;
      current.rotation.x = Math.sin(s * 0.5) * 0.13 + 0.2;

      // Drop-in on change.
      if (state.entering > 0) {
        state.entering = Math.max(0, state.entering - 0.045);
        const e = state.entering;
        current.position.y = e * e * 1.5;
        current.scale.setScalar(1 - e * e * 0.25);
      } else {
        current.position.y = REDUCED ? 0 : Math.sin(t * 0.0009) * 0.07;
        current.scale.setScalar(1);
      }
    }
    renderer.render(scene, camera);
  }

  return { renderer, show, frame, resize, state };
}

export { REDUCED };
