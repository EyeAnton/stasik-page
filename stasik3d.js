// 3D-модель Стасика (M5Stack Basic v2.7) по официальному чертежу, единицы — миллиметры.
// Экран — живая прошивка: эмулятор работает в скрытом iframe (emu/), его canvas идёт текстурой.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';

// ---------- Размеры (docs.m5stack.com, module size.jpg) ----------
const W = 54;            // 54 × 54 в плане, углы R5, рёбра R1
const H_BAT = 4.4;       // нижний модуль-батарея
const H = 17;            // общая толщина (основной блок 12,6)
const SCREEN = { w: 40.8, h: 30.6, y: -0.15 };            // 2" 320×240, отступ сверху 12 мм
const KEYS = { w: 7.8, h: 5, y: -20.8, x: [-12, 0, 11.8] };

// ---------- Материалы ----------
const M = {
  body:  new THREE.MeshStandardMaterial({ color: 0x1e1f22, roughness: 0.55 }),
  bat:   new THREE.MeshStandardMaterial({ color: 0x151618, roughness: 0.7 }),
  glass: new THREE.MeshStandardMaterial({ color: 0x030304, roughness: 0.12, envMapIntensity: 0.35 }),
  key:   new THREE.MeshStandardMaterial({ color: 0xc8c9cc, roughness: 0.35, metalness: 0.25 }),
  red:   new THREE.MeshStandardMaterial({ color: 0xd0312b, roughness: 0.45 }),
  metal: new THREE.MeshStandardMaterial({ color: 0xa4a6aa, roughness: 0.3, metalness: 0.9 }),
  hole:  new THREE.MeshBasicMaterial({ color: 0x050506 }),
  rubber:new THREE.MeshStandardMaterial({ color: 0x101012, roughness: 0.9 }),
  // блик стекла поверх экрана: чёрный + аддитивное смешивание = только отражения
  sheen: new THREE.MeshStandardMaterial({ color: 0x000000, roughness: 0.08, transparent: true,
           blending: THREE.AdditiveBlending, depthWrite: false, envMapIntensity: 0.12 }),
};

// ---------- Геометрия ----------
function rrect(w, h, r) {
  const s = new THREE.Shape(), x = w / 2 - r, y = h / 2 - r;
  s.absarc(x, y, r, 0, Math.PI / 2);
  s.absarc(-x, y, r, Math.PI / 2, Math.PI);
  s.absarc(-x, -y, r, Math.PI, Math.PI * 1.5);
  s.absarc(x, -y, r, Math.PI * 1.5, Math.PI * 2);
  return s;
}

// Скруглённая плита w×h с радиусом r в плане и фаской bevel, толщина depth, лежит на z = 0..depth.
function slab(w, h, r, depth, bevel, mat) {
  const g = new THREE.ExtrudeGeometry(rrect(w - 2 * bevel, h - 2 * bevel, Math.max(r - bevel, 0.05)), {
    depth: depth - 2 * bevel, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel,
    bevelSegments: 4, curveSegments: 20,
  });
  g.translate(0, 0, bevel);
  return new THREE.Mesh(g, mat);
}

function box(sx, sy, sz, r, mat, x, y, z) {
  const m = new THREE.Mesh(new RoundedBoxGeometry(sx, sy, sz, 3, Math.min(r, sx / 2, sy / 2, sz / 2)), mat);
  m.position.set(x, y, z);
  return m;
}

// Ряд гнёзд разъёма: чёрная планка + квадратные отверстия с шагом 2,54.
function header(n, axis, x, y, z, normal) {
  const g = new THREE.Group();
  const len = n * 2.54;
  const along = axis === 'y' ? [0.3, len, 2.5] : [len, 0.3, 2.5];
  g.add(box(...along, 0.1, M.hole, x, y, z));
  const holes = new THREE.InstancedMesh(new THREE.BoxGeometry(normal === 'x' ? 0.32 : 1, normal === 'x' ? 1 : 0.32, 1), M.rubber, n);
  const m = new THREE.Matrix4();
  for (let i = 0; i < n; i++) {
    const t = (i - (n - 1) / 2) * 2.54;
    m.makeTranslation(axis === 'y' ? x : x + t, axis === 'y' ? y + t : y, z);
    holes.setMatrixAt(i, m);
  }
  g.add(holes);
  return g;
}

export function buildStasik(screenTexture) {
  const dev = new THREE.Group();
  dev.name = 'Stasik';

  // корпус: основной блок и батарея
  const core = slab(W, W, 5, H - H_BAT, 1, M.body);
  core.position.z = H_BAT;
  const bat = slab(W - 0.2, W - 0.2, 4.9, H_BAT, 0.8, M.bat);
  dev.add(core, bat);

  // стекло, экран, блик
  const glass = slab(W - 2.4, W - 2.4, 3.8, 0.5, 0.2, M.glass);
  glass.position.z = H - 0.45;
  const screenMat = new THREE.MeshBasicMaterial({ map: screenTexture, toneMapped: false });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(SCREEN.w, SCREEN.h), screenMat);
  screen.position.set(0, SCREEN.y, H + 0.06);
  screen.name = 'screen';
  // блик повторяет скругление стекла — иначе его углы торчат за контур
  const sheen = new THREE.Mesh(new THREE.ShapeGeometry(rrect(W - 2.8, W - 2.8, 3.6), 20), M.sheen);
  sheen.position.z = H + 0.08;
  sheen.name = 'sheen';  // только для браузера: в glTF нет аддитивного смешивания
  dev.add(glass, screen, sheen);

  // кнопки A, B, C
  const keys = KEYS.x.map((x, i) => {
    const k = slab(KEYS.w, KEYS.h, 1.2, 1.4, 0.5, M.key);
    k.position.set(x, KEYS.y, H - 0.4);
    k.userData = { key: i, z: H - 0.4 };
    k.name = 'key' + 'ABC'[i];
    dev.add(k);
    return k;
  });

  // левый бок: питание, USB-C, Port A, ряд пинов на батарее
  const L = -W / 2;
  dev.add(box(1.6, 7.4, 3.4, 0.6, M.red, L - 0.2, 12.9, 9.6));
  dev.add(box(0.5, 8.9, 3.2, 1.5, M.metal, L, 0, 9.6));
  dev.add(box(0.6, 7.9, 2.3, 1.1, M.hole, L - 0.05, 0, 9.6));
  dev.add(box(0.4, 10.8, 4.6, 0.4, M.hole, L, -13.9, 9.6));
  dev.add(box(0.5, 9.6, 3.4, 0.3, M.red, L - 0.02, -13.9, 9.6));
  dev.add(header(16, 'y', L + 0.12, -1.5, 2.2, 'x'));

  // правый бок: решётка динамика и пины
  const R = W / 2;
  const dot = new THREE.CircleGeometry(0.55, 16).rotateY(Math.PI / 2);
  for (let row = 0; row < 13; row++) {
    const y = 18.1 - row * 2.03;
    const cols = row % 2 ? [10.7] : [8.4, 12.9];
    for (const z of cols) { const d = new THREE.Mesh(dot, M.hole); d.position.set(R + 0.02, y, z); dev.add(d); }
  }
  dev.add(header(16, 'y', R - 0.12, -1.5, 2.2, 'x'));

  // нижний торец: слот microSD, отверстие, пины; верхний — окно и отверстие
  const B = -W / 2, T = W / 2;
  dev.add(box(13.3, 0.6, 1.6, 0.6, M.hole, -6.9, B, 9.6));
  const pin = new THREE.CircleGeometry(0.8, 16).rotateX(Math.PI / 2);
  const p1 = new THREE.Mesh(pin, M.hole); p1.position.set(14, B - 0.02, 9.6); p1.rotation.x = Math.PI; dev.add(p1);
  dev.add(header(8, 'x', -0.2, B + 0.12, 2.2, 'y'));
  dev.add(box(14, 0.3, 8, 0.15, M.rubber, -9, T - 0.1, 9.9));
  const p2 = new THREE.Mesh(pin, M.hole); p2.position.set(14, T + 0.02, 8.1); dev.add(p2);
  dev.add(header(8, 'x', -0.2, T - 0.12, 2.2, 'y'));

  // дно: резиновые ножки и винты
  for (const [x, y] of [[-16, 16], [16, 16], [-16, -16], [16, -16]]) {
    const f = new THREE.Mesh(new THREE.CylinderGeometry(4.1, 4.1, 0.8, 32).rotateX(Math.PI / 2), M.rubber);
    f.position.set(x, y, -0.3); dev.add(f);
  }
  for (const x of [-22, 22]) {
    const s = new THREE.Mesh(new THREE.CircleGeometry(1.5, 20).rotateX(Math.PI), M.hole);
    s.position.set(x, -22, -0.02); dev.add(s);
  }

  dev.position.z = -H / 2;
  const root = new THREE.Group();
  root.add(dev);
  return { root, keys };
}

// GLB = заголовок 12 байт + один JSON-чанк, выровненный пробелами до 4 байт
function packGLB(gltf) {
  let json = new TextEncoder().encode(JSON.stringify(gltf));
  const pad = (4 - (json.length % 4)) % 4;
  if (pad) { const p = new Uint8Array(json.length + pad).fill(0x20); p.set(json); json = p; }
  const out = new ArrayBuffer(20 + json.length);
  const v = new DataView(out);
  v.setUint32(0, 0x46546c67, true);          // 'glTF'
  v.setUint32(4, 2, true);
  v.setUint32(8, out.byteLength, true);
  v.setUint32(12, json.length, true);
  v.setUint32(16, 0x4e4f534a, true);         // 'JSON'
  new Uint8Array(out, 20).set(json);
  return out;
}

// ---------- Сцена ----------
export function mount({ canvas, emuFrame, onReady }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  const sun = new THREE.DirectionalLight(0xffffff, 1.2);
  sun.position.set(-60, 90, 120);
  scene.add(sun);

  // пока эмулятор грузится — заглушка
  const stub = document.createElement('canvas');
  stub.width = 320; stub.height = 240;
  const sc = stub.getContext('2d');
  sc.fillStyle = '#000'; sc.fillRect(0, 0, 320, 240);
  sc.fillStyle = '#555'; sc.font = '500 18px Montserrat, sans-serif'; sc.textAlign = 'center';
  sc.fillText('загрузка…', 160, 126);
  const tex = new THREE.CanvasTexture(stub);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;

  const { root, keys } = buildStasik(tex);
  scene.add(root);

  const camera = new THREE.PerspectiveCamera(30, 1, 1, 2000);
  camera.position.set(80, 44, 152);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.minDistance = 70;
  controls.maxDistance = 480;

  // эмулятор
  let emu = null;
  const hook = () => {
    const doc = emuFrame.contentDocument, src = doc && doc.getElementById('screen');
    if (!src) return;
    emu = emuFrame.contentWindow;
    tex.image = src;
    tex.needsUpdate = true;
    onReady && onReady();
  };
  emuFrame.addEventListener('load', hook);
  if (emuFrame.contentDocument?.readyState === 'complete') hook();

  // нажатия
  const held = [new Set(), new Set(), new Set()];
  function setKey(i, src, down) {
    const was = held[i].size > 0;
    down ? held[i].add(src) : held[i].delete(src);
    const on = held[i].size > 0;
    if (on === was) return;
    keys[i].position.z = keys[i].userData.z - (on ? 0.6 : 0);
    emu?.Module?._web_button?.(i, on ? 1 : 0);
  }

  const ray = new THREE.Raycaster(), ptr = new THREE.Vector2();
  function pick(e) {
    const r = canvas.getBoundingClientRect();
    ptr.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ptr, camera);
    const hit = ray.intersectObjects(keys, false)[0];
    return hit ? hit.object.userData.key : -1;
  }
  canvas.addEventListener('pointerdown', (e) => {
    const i = pick(e);
    if (i < 0) return;
    controls.enabled = false;
    canvas.setPointerCapture(e.pointerId);
    setKey(i, 'p' + e.pointerId, true);
    const up = () => { setKey(i, 'p' + e.pointerId, false); controls.enabled = true;
      canvas.removeEventListener('pointerup', up); canvas.removeEventListener('pointercancel', up); };
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
  });
  canvas.addEventListener('pointermove', (e) => { if (!e.buttons) canvas.style.cursor = pick(e) >= 0 ? 'pointer' : 'grab'; });

  // клавиатура — только когда Стасик в фокусе (кликнули по нему), иначе стрелки и пробел листают страницу
  canvas.tabIndex = 0;
  canvas.addEventListener('pointerdown', () => canvas.focus({ preventScroll: true }));
  const KEYMAP = { ArrowLeft: 0, KeyA: 0, ArrowDown: 1, KeyS: 1, Space: 1, ArrowRight: 2, KeyD: 2 };
  canvas.addEventListener('keydown', (e) => {
    const i = KEYMAP[e.code];
    if (i === undefined || e.metaKey || e.ctrlKey || e.altKey) return;
    e.preventDefault();
    if (!e.repeat) setKey(i, 'k' + e.code, true);
  });
  canvas.addEventListener('keyup', (e) => { const i = KEYMAP[e.code]; if (i !== undefined) setKey(i, 'k' + e.code, false); });
  canvas.addEventListener('blur', () => held.forEach((s, i) => { s.clear(); setKey(i, '', false); }));

  // колесо листает страницу, а не приближает; на сенсорном экране свайп тоже листает — крутить только мышью
  controls.enableZoom = false;
  if (matchMedia('(pointer: coarse)').matches) {
    controls.enableRotate = false;
    canvas.style.touchAction = 'pan-y';
  }

  // позы под разделы страницы: поворот корпуса и масштаб
  const POSES = {
    hero:     { ry: 0,             rx: 0,     s: 1 },
    hardware: { ry: 1.2,           rx: 0.12,  s: 1 },     // левый бок: питание, USB-C, Port A
    speed:    { ry: -0.32,         rx: 0.04,  s: 1.3 },   // крупно экран
    smooth:   { ry: -1.0,          rx: 0.1,   s: 1 },     // правый бок: решётка динамика
    remote:   { ry: Math.PI + 0.5, rx: -0.35, s: 0.95 },  // дно
  };
  const pose = { ...POSES.hero }, target = { ...POSES.hero };

  // кадр
  let lastTouch = -1e9;
  controls.addEventListener('start', () => { lastTouch = Infinity; });
  controls.addEventListener('end', () => { lastTouch = performance.now(); });
  let size = '';
  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (size === w + 'x' + h) return;
    size = w + 'x' + h;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    // на узком экране отодвигаем камеру, чтобы корпус помещался по ширине
    camera.position.setLength(178 * Math.max(1, 1.2 / camera.aspect));
  }
  let prevT = 0;
  renderer.setAnimationLoop((t) => {
    resize();
    // к позе — по времени, а не по кадрам: на слабом железе поворот не растягивается
    const k = 1 - Math.exp(-Math.min(t - prevT, 100) / 220);
    prevT = t;
    for (const n in pose) pose[n] += (target[n] - pose[n]) * k;
    // в покое Стасик слегка покачивается
    const idle = Math.min(Math.max((t - lastTouch - 2500) / 1500, 0), 1);
    root.rotation.y = pose.ry + Math.sin(t / 2600) * 0.18 * idle;
    root.rotation.x = pose.rx;
    root.scale.setScalar(pose.s);
    root.position.y = Math.sin(t / 1700) * 0.6 * idle;
    if (emu) tex.needsUpdate = true;
    controls.update();
    renderer.render(scene, camera);
  });

  return {
    setPose(name) { if (POSES[name]) Object.assign(target, POSES[name]); },
    // в .glb уходит текущий кадр экрана; canvas из iframe экспортёр не принимает
    // (instanceof из другого окна), поэтому кадр копируется в свой canvas
    async exportGLB() {
      const live = tex.image;
      const snap = document.createElement('canvas');
      snap.width = 320; snap.height = 240;
      snap.getContext('2d').drawImage(live, 0, 0, 320, 240);
      tex.image = snap;
      const sheen = root.getObjectByName('sheen');
      sheen.visible = false;
      try {
        // binary-режим экспортёра ждёт canvas.toBlob, который в headless Chrome не возвращается;
        // берём glTF-JSON (данные встроены data:URI) и сами кладём его в контейнер GLB
        const gltf = await new Promise((resolve, reject) =>
          new GLTFExporter().parse(root, resolve, reject, { binary: false }));
        return packGLB(gltf);
      } finally {
        sheen.visible = true;
        tex.image = live;
        tex.needsUpdate = true;
      }
    },
  };
}
