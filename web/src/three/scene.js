import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { buildComponent } from './components.js';

const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Image-based lighting for the component viewer. Direct lights alone give metal
// a flat grey wash — what sells solder mask, tin plating and moulded epoxy is
// what they reflect. RoomEnvironment ships with three, so no HDRI download.
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
