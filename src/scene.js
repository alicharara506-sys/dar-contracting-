// DAR 3D preview: a modern Lebanese villa (with pool, parking and a mini football pitch) built
// stage by stage as scroll progress p goes from 0 to 1. This is the animatic for the Higgsfield film:
// the camera moves and stage order here are the ones the AI footage will follow.
// Everything is procedural geometry; each part registers an updater that reads p.
import * as THREE from 'three';
import { drawSitePlan, SHEET } from './plan-drawing.js';

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = t => t * t * (3 - 2 * t);
const easeOut = t => 1 - Math.pow(1 - t, 3);
export const seg = (p, a, b) => clamp((p - a) / (b - a));

// Stage windows on the 0..1 scroll timeline. main.js uses the same table for the text panels.
export const STAGES = [
  { id: 'plan', a: 0, b: 0.09 },
  { id: 'land', a: 0.09, b: 0.14 },
  { id: 'excavation', a: 0.14, b: 0.22 },
  { id: 'foundation', a: 0.22, b: 0.3 },
  { id: 'structure', a: 0.3, b: 0.46 },
  { id: 'masonry', a: 0.46, b: 0.54 },
  { id: 'mep', a: 0.54, b: 0.68 },
  { id: 'finishing', a: 0.68, b: 0.8 },
  { id: 'outdoor', a: 0.8, b: 0.9 },
  { id: 'handover', a: 0.9, b: 1 },
];

const ORANGE = 0xd94f1e;
const L1 = 3.6, L2 = 7.0, SL = 0.3; // floor levels (top of slab) and slab thickness
const CX = [-10, -4, 2, 8, 14], CZ = [-14, -7, 0]; // column grid: 6 m bays, 7 m deep
// Site layout [x0, x1, z0, z1]. +z faces the street and the camera.
const VILLA = [-10, 14, -14, 0]; // 24 x 14 m ground floor (336 m2)
const UPPER = [-14, 14, -14, 0]; // first floor cantilevers 4 m to the west, over the entry porch
const VPIT = [-11, 15, -15, 1];
const POOL = [-4, 10, 4, 9];
const TENNIS = [17, 29, -21, 6]; // full tennis court 10.97 x 23.77 m with run-off, fenced
const BASKET = [17, 29, 9, 21]; // basketball half court 12 x 12 m
const CARPORT = [-27, -15, -14, -4];
const DRIVE = [-24, -18, -4, 22];
const PLOT = [-30, 30, -22, 22];

const KEYS = [
  [0.0, [-1, 84, 7], [-1, 0, -1]],
  [0.08, [-1, 68, 20], [-1, 0, -2]],
  [0.14, [46, 13, 56], [0, 6, -10]],
  [0.22, [30, 17, 32], [3, -1, -4]],
  [0.3, [26, 22, 28], [3, 0, -5]],
  [0.46, [-36, 16, 30], [2, 4, -6]],
  [0.54, [24, 11, 24], [2, 3, -7]],
  [0.59, [7, 10, 10], [2, 0.5, -7]],
  [0.65, [2, 13, -2], [2, 0, -8]],
  [0.69, [12, 7, 16], [2, 2, -7]],
  [0.8, [36, 12, 34], [3, 3, -4]],
  [0.9, [-8, 15, 42], [4, 1, -1]],
  [1.0, [44, 21, 48], [3, 2, -3]],
];
// Phone (portrait) camera work: a tall frame needs different shots, not the wide shots squeezed.
// Steeper angles so the depth of the plot fills the height, views along the villa's length so its
// 14 m depth fills the width, and the subject placed in the upper part, above the text card.
const KEYS_PORTRAIT = [
  [0.0, [2, 80, 8], [2, 0, -2]],
  [0.08, [2, 70, 26], [2, 0, -2]],
  [0.14, [8, 30, 46], [2, 0, -1]],
  [0.22, [16, 30, 30], [2, -2, -7]],
  [0.3, [10, 36, 24], [2, -1, -7]],
  [0.46, [46, 22, 6], [1, 3, -7]],
  [0.54, [30, 15, 18], [2, 3, -7]],
  [0.59, [8, 14, 10], [2, 0.5, -7]],
  [0.65, [2, 22, -4], [2, 0, -8]],
  [0.69, [14, 11, 20], [2, 2, -7]],
  [0.8, [30, 16, 36], [3, 4, -5]],
  [0.9, [6, 44, 58], [3, 0, 5]],
  [1.0, [64, 50, 10], [3, 0, -1]],
];

function rng(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

export function createScene(canvas, { lowPower = false, onHover = () => {} } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !lowPower, powerPreference: 'high-performance' });
  // Phones have 3x screens: render at 2x so lines and text stay sharp (1.5x looked blurry).
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const SKY_PLAN = new THREE.Color(0xe2e0da), SKY_DAY = new THREE.Color(0xdbe4ea), SKY_DUSK = new THREE.Color(0x1d2534);
  scene.background = SKY_PLAN.clone();
  scene.fog = new THREE.Fog(SKY_DAY.clone(), 140, 420);
  const camera = new THREE.PerspectiveCamera(38, 1, 0.3, 900);

  const hemi = new THREE.HemisphereLight(0xf6f2ea, 0x8a7a62, 1.15);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff1dc, 2.7);
  sun.position.set(38, 60, 30);
  sun.castShadow = true;
  sun.shadow.mapSize.set(lowPower ? 1024 : 2048, lowPower ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, near: 10, far: 160 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  scene.add(sun);
  const SUN_DAY = new THREE.Color(0xfff1dc), SUN_DUSK = new THREE.Color(0xffb88a);
  const HEMI_DAY = new THREE.Color(0xf6f2ea), HEMI_DUSK = new THREE.Color(0x8ea2c8);

  const U = []; // updaters (p, time)
  const R = rng(11);

  // ---------- helpers ----------
  const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...o });
  function box(w, h, d, mat, x = 0, y = 0, z = 0, anchor = 'bottom', parent = scene) {
    const g = new THREE.BoxGeometry(w, h, d);
    if (anchor === 'bottom') g.translate(0, h / 2, 0);
    if (anchor === 'left') g.translate(w / 2, h / 2, 0);
    const m = new THREE.Mesh(g, mat);
    m.position.set(x, y, z);
    m.castShadow = m.receiveShadow = true;
    parent.add(m);
    return m;
  }
  const rect = ([x0, x1, z0, z1]) => ({ w: x1 - x0, d: z1 - z0, cx: (x0 + x1) / 2, cz: (z0 + z1) / 2 });
  function grow(m, a, b, axis = 'y', fn = easeOut) {
    U.push(p => {
      const t = fn(seg(p, a, b));
      m.visible = t > 0.001;
      m.scale[axis] = Math.max(t, 0.001);
    });
  }
  // Fade in (scale) between a and b, out between c and d.
  function life(obj, a, b, c = 2, d = 3) {
    U.push(p => {
      const t = easeOut(seg(p, a, b)) * (1 - easeOut(seg(p, c, d)));
      obj.visible = t > 0.001;
      obj.scale.setScalar(Math.max(t, 0.001));
    });
  }

  // ---------- textures ----------
  const soilTex = canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#ab9a7c'; g.fillRect(0, 0, w, h);
    const r = rng(3);
    for (let i = 0; i < 9000; i++) {
      const v = r();
      g.fillStyle = v < 0.5 ? 'rgba(120,104,80,.35)' : v < 0.8 ? 'rgba(190,176,150,.35)' : 'rgba(100,118,70,.35)';
      g.fillRect(r() * w, r() * h, 1 + r() * 3, 1 + r() * 3);
    }
  }, true);
  soilTex.repeat.set(1 / 9, 1 / 9);
  const blockTex = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#bdbab2'; g.fillRect(0, 0, w, h);
    const r = rng(9);
    for (let i = 0; i < 3000; i++) { g.fillStyle = `rgba(90,90,85,${r() * 0.15})`; g.fillRect(r() * w, r() * h, 2, 2); }
    g.strokeStyle = '#8e8a82'; g.lineWidth = 3;
    for (let row = 0; row < 8; row++) {
      const y = row * 32; g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke();
      for (let x = (row % 2) * 32; x < w; x += 64) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 32); g.stroke(); }
    }
  }, true);
  blockTex.repeat.set(3, 1);
  // Lebanese cream sandstone, irregular coursed ashlar
  const stoneTex = canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#b9a78a'; g.fillRect(0, 0, w, h);
    const r = rng(21), cols = ['#e6d6b8', '#dcc9a6', '#efe2c8', '#d6c19c', '#e9dbbf'];
    let y = 0;
    while (y < h) {
      const rowH = 36 + r() * 30; let x = -r() * 60;
      while (x < w) {
        const bw = 60 + r() * 90;
        g.fillStyle = cols[(r() * cols.length) | 0];
        g.fillRect(x + 3, y + 3, bw - 6, rowH - 6);
        for (let k = 0; k < 40; k++) { g.fillStyle = `rgba(120,95,60,${r() * 0.12})`; g.fillRect(x + r() * bw, y + r() * rowH, 2, 2); }
        x += bw;
      }
      y += rowH;
    }
  }, true);
  stoneTex.repeat.set(2.5, 0.9);
  const paverTex = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#6f6a64'; g.fillRect(0, 0, w, h);
    const r = rng(13), cols = ['#a49c90', '#968e83', '#ada597', '#8f877d'];
    for (let row = 0; row < 8; row++) for (let i = -1; i < 5; i++) {
      g.fillStyle = cols[(r() * cols.length) | 0];
      g.fillRect(i * 64 + (row % 2) * 32 + 2, row * 32 + 2, 60, 28);
    }
  }, true);
  const tileTex = canvasTex(512, 512, (g, w, h) => {
    const r = rng(17);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
      g.fillStyle = `hsl(36, 18%, ${86 + r() * 6}%)`; g.fillRect(i * 128, j * 128, 128, 128);
      g.strokeStyle = 'rgba(150,135,115,.35)'; g.lineWidth = 1.5;
      for (let k = 0; k < 5; k++) { g.beginPath(); g.moveTo(i * 128 + r() * 128, j * 128); g.bezierCurveTo(i * 128 + r() * 128, j * 128 + 40, i * 128 + r() * 128, j * 128 + 90, i * 128 + r() * 128, j * 128 + 128); g.stroke(); }
    }
    g.strokeStyle = '#cfc6b8'; g.lineWidth = 3;
    for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * 128, 0); g.lineTo(i * 128, h); g.stroke(); g.beginPath(); g.moveTo(0, i * 128); g.lineTo(w, i * 128); g.stroke(); }
  }, true);
  tileTex.repeat.set(5, 3);
  // Hard tennis court, 12 x 27 m surface: green run-off, blue court, regulation lines (doubles 10.97 x 23.77 m).
  const tennisTex = canvasTex(480, 1080, (g, w, h) => {
    const k = w / 12; // px per metre
    g.fillStyle = '#3d6f55'; g.fillRect(0, 0, w, h);
    const cx0 = (12 - 10.97) / 2 * k, cz0 = (27 - 23.77) / 2 * k, cw = 10.97 * k, ch = 23.77 * k, mid = h / 2;
    g.fillStyle = '#2f5d8c'; g.fillRect(cx0, cz0, cw, ch);
    g.strokeStyle = '#f5f5f2'; g.lineWidth = 0.06 * k;
    g.strokeRect(cx0, cz0, cw, ch); // doubles
    const s = 1.37 * k; g.beginPath(); g.moveTo(cx0 + s, cz0); g.lineTo(cx0 + s, cz0 + ch); g.moveTo(cx0 + cw - s, cz0); g.lineTo(cx0 + cw - s, cz0 + ch); g.stroke(); // singles
    const sv = 6.4 * k; g.beginPath(); g.moveTo(cx0 + s, mid - sv); g.lineTo(cx0 + cw - s, mid - sv); g.moveTo(cx0 + s, mid + sv); g.lineTo(cx0 + cw - s, mid + sv);
    g.moveTo(w / 2, mid - sv); g.lineTo(w / 2, mid + sv); g.moveTo(w / 2, cz0); g.lineTo(w / 2, cz0 + 0.2 * k); g.moveTo(w / 2, cz0 + ch); g.lineTo(w / 2, cz0 + ch - 0.2 * k); g.stroke();
  });
  // Basketball half court, 12 x 12 m acrylic surface; the hoop end is the south (+z) edge, drawn at the bottom.
  const basketTex = canvasTex(600, 600, (g, w, h) => {
    const k = w / 12;
    g.fillStyle = '#b8603a'; g.fillRect(0, 0, w, h);
    const by = h - 0.3 * k; // baseline
    g.fillStyle = '#8e4428'; g.fillRect(w / 2 - 2.45 * k, by - 5.8 * k, 4.9 * k, 5.8 * k); // key
    g.strokeStyle = '#f5f5f2'; g.lineWidth = 0.06 * k;
    g.strokeRect(0.3 * k, 0.3 * k, w - 0.6 * k, by - 0.3 * k);
    g.strokeRect(w / 2 - 2.45 * k, by - 5.8 * k, 4.9 * k, 5.8 * k);
    g.beginPath(); g.arc(w / 2, by - 5.8 * k, 1.8 * k, 0, Math.PI * 2); g.stroke(); // free-throw circle
    const hy = by - 1.575 * k; // hoop centre
    g.beginPath(); g.arc(w / 2, hy, 6.75 * k, Math.PI + 0.16, -0.16); g.stroke(); // three-point arc
    g.beginPath(); g.moveTo(0.9 * k, by); g.lineTo(0.9 * k, hy - 0.95 * k); g.moveTo(w - 0.9 * k, by); g.lineTo(w - 0.9 * k, hy - 0.95 * k); g.stroke();
    g.beginPath(); g.arc(w / 2, hy, 1.25 * k, Math.PI, 0); g.stroke(); // restricted area
  });
  const netTex = canvasTex(128, 128, (g, w, h) => {
    g.clearRect(0, 0, w, h); g.strokeStyle = 'rgba(30,30,30,0.9)'; g.lineWidth = 3;
    for (let i = 0; i <= 8; i++) { g.beginPath(); g.moveTo(i * 16, 0); g.lineTo(i * 16, h); g.stroke(); g.beginPath(); g.moveTo(0, i * 16); g.lineTo(w, i * 16); g.stroke(); }
  }, true);

  // ---------- terrain with holes for the villa raft and the pool ----------
  const groundShape = new THREE.Shape();
  groundShape.moveTo(-400, -400); groundShape.lineTo(400, -400); groundShape.lineTo(400, 400); groundShape.lineTo(-400, 400);
  // Shape y maps to world -z after rotateX(-PI/2), so holes use -z.
  for (const [x0, x1, z0, z1] of [VPIT, POOL]) {
    const h = new THREE.Path();
    h.moveTo(x0, -z1); h.lineTo(x0, -z0); h.lineTo(x1, -z0); h.lineTo(x1, -z1);
    groundShape.holes.push(h);
  }
  const gg = new THREE.ShapeGeometry(groundShape); gg.rotateX(-Math.PI / 2);
  const ground = new THREE.Mesh(gg, std(0xffffff, { map: soilTex }));
  ground.receiveShadow = true; scene.add(ground);

  // Pits: a surface that sinks, with soil walls around it. Pool walls turn to concrete later.
  const pitWallMat = std(0x8f7d62), poolShellMat = std(0x8f7d62);
  const plotDark = new THREE.Color(0x8d7c66), white = new THREE.Color(0xffffff), concreteCol = new THREE.Color(0xbdbab3);
  function pit(rc, depth, a, b, wallMat, until) {
    const { w, d, cx, cz } = rect(rc);
    const tex = soilTex.clone(); tex.repeat.set(w / 9, d / 9); tex.offset.set(rc[0] / 9, -rc[3] / 9); tex.needsUpdate = true;
    const floorG = new THREE.PlaneGeometry(w, d); floorG.rotateX(-Math.PI / 2);
    const floor = new THREE.Mesh(floorG, std(0xffffff, { map: tex })); floor.position.set(cx, 0, cz); floor.receiveShadow = true; scene.add(floor);
    [[cx, rc[2], w, 0.2], [cx, rc[3], w, 0.2], [rc[0], cz, 0.2, d], [rc[1], cz, 0.2, d]].forEach(([x, z, ww, dd]) => box(ww, depth + 0.1, dd, wallMat, x, -depth - 0.1, z));
    U.push(p => {
      const t = smooth(seg(p, a, b));
      floor.position.y = -depth * t + 0.002;
      floor.material.color.copy(white).lerp(plotDark, t);
      floor.visible = p < until;
    });
    return floor;
  }
  pit(VPIT, 1.8, 0.15, 0.2, pitWallMat, 0.29);
  const poolFloor = pit(POOL, 1.7, 0.17, 0.21, poolShellMat, 9);
  U.push(p => {
    const t = smooth(seg(p, 0.27, 0.3));
    poolShellMat.color.copy(new THREE.Color(0x8f7d62)).lerp(concreteCol, t);
    if (t > 0) poolFloor.material.color.copy(plotDark).lerp(concreteCol, t);
    if (p > 0.81) poolFloor.material.color.lerp(new THREE.Color(0x7fc8dc), smooth(seg(p, 0.81, 0.83)));
  });

  // ---------- Lebanese setting: mountains, sea, neighbours, pines and olives ----------
  const mtnMat = std(0x7f8b6c, { flatShading: true, roughness: 1 });
  for (let i = 0; i < 9; i++) {
    const m = new THREE.Mesh(new THREE.ConeGeometry(60 + R() * 50, 40 + R() * 45, 7), mtnMat);
    m.position.set(-220 + i * 60 + R() * 20, 0, -230 - R() * 80); m.rotation.y = R() * 3; scene.add(m);
  }
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(400, 900).rotateX(-Math.PI / 2), std(0x2f6f9a, { roughness: 0.25, metalness: 0.2 }));
  sea.position.set(-330, -0.4, 0); scene.add(sea);
  const landscape = []; // hidden under the blueprint at the start
  U.push(p => landscape.forEach(o => (o.visible = p > 0.07)));
  const neighbourMat = [std(0xe9e1d0), std(0xdcd2bd), std(0xf1ebde)], tankMat = std(0x1f1f1f);
  [[-60, -50], [-75, -10], [55, -55], [70, -20], [-50, 45], [65, 40], [20, -70], [-20, -75]].forEach(([x, z], i) => {
    const w = 10 + R() * 8, h = 6 + R() * 7, d = 9 + R() * 6;
    landscape.push(box(w, h, d, neighbourMat[i % 3], x, 0, z), box(1.4, 1.4, 1.4, tankMat, x + w / 4, h, z - d / 4), box(1.4, 1.4, 1.4, tankMat, x - w / 4, h, z - d / 4));
  });
  const pineMat = std(0x3f5b37, { flatShading: true }), oliveMat = std(0x8a9a6a, { flatShading: true }), trunkMat = std(0x6b4f35);
  function tree(x, z, kind, s = 1) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.scale.setScalar(s);
    const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.22, kind === 'pine' ? 3 : 1.6).translate(0, kind === 'pine' ? 1.5 : 0.8, 0), trunkMat);
    const cr = kind === 'pine'
      ? new THREE.Mesh(new THREE.IcosahedronGeometry(2.2, 0).scale(1.3, 0.6, 1.3).translate(0, 3.6, 0), pineMat)
      : new THREE.Mesh(new THREE.IcosahedronGeometry(1.5, 1).scale(1.2, 0.8, 1.2).translate(0, 2.2, 0), oliveMat);
    tr.castShadow = cr.castShadow = true; g.add(tr, cr); scene.add(g); return g;
  }
  for (let i = 0; i < 40; i++) {
    const x = (R() - 0.5) * 200, z = (R() - 0.5) * 160;
    if (x > PLOT[0] - 4 && x < PLOT[1] + 4 && z > PLOT[2] - 4 && z < PLOT[3] + 4) continue;
    landscape.push(tree(x, z, R() < 0.5 ? 'pine' : 'olive', 0.8 + R() * 0.7));
  }
  // Scrub on the plot, cleared before excavation
  const shrubG = new THREE.IcosahedronGeometry(1, 0), shrubMat = std(0x6f7a4a), rockMat = std(0x9a9184);
  for (let i = 0; i < 40; i++) {
    const x = PLOT[0] + R() * 60, z = PLOT[2] + R() * 44, rock = R() < 0.35;
    const m = new THREE.Mesh(shrubG, rock ? rockMat : shrubMat);
    const s = rock ? 0.3 + R() * 0.5 : 0.5 + R() * 0.9;
    m.position.set(x, s * 0.4, z); m.scale.set(s, s * 0.7, s); m.castShadow = true; scene.add(m);
    const base = m.scale.clone();
    U.push(p => { const t = 1 - seg(p, 0.11, 0.15); m.visible = t > 0.01 && p > 0.07; m.scale.copy(base).multiplyScalar(Math.max(t, 0.01)); });
  }

  // ---------- 00 plan: a printed architectural sheet seen from above, then a white massing model ----------
  // The sheet is drawn once on a canvas (plan-drawing.js) from the same layout the 3D builds.
  const desk = new THREE.Mesh(new THREE.PlaneGeometry(320, 260).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xe2e0da, transparent: true }));
  desk.position.set(0, 0.03, 0); scene.add(desk);
  const sheetCanvas = document.createElement('canvas');
  const sheetTex = new THREE.CanvasTexture(sheetCanvas);
  sheetTex.colorSpace = THREE.SRGBColorSpace; sheetTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  // Sheet resolution: as sharp as the GPU allows (phones zoom into the villa, so they need it most).
  const sheetPxPerM = Math.min(52, Math.floor(renderer.capabilities.maxTextureSize / SHEET.w));
  const LAYOUT = { VILLA, UPPER, POOL, TENNIS, BASKET, CARPORT, DRIVE, PLOT, CX, CZ };
  const drawSheet = () => { drawSitePlan(sheetCanvas, LAYOUT, sheetPxPerM); sheetTex.needsUpdate = true; };
  drawSheet();
  // A plotter sweep draws the sheet in from left to right on load (independent of scroll).
  renderer.localClippingEnabled = true;
  const sweep = new THREE.Plane(new THREE.Vector3(-1, 0, 0), SHEET.x0);
  const sheetMat = new THREE.MeshStandardMaterial({ map: sheetTex, emissive: 0xffffff, emissiveMap: sheetTex, emissiveIntensity: 0.85, roughness: 1, transparent: true, clippingPlanes: [sweep] });
  const sheet = new THREE.Mesh(new THREE.PlaneGeometry(SHEET.w, SHEET.h).rotateX(-Math.PI / 2), sheetMat);
  sheet.position.set(SHEET.x0 + SHEET.w / 2, 0.06, SHEET.z0 + SHEET.h / 2); sheet.receiveShadow = true; scene.add(sheet);
  const t0 = performance.now(), reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  U.push(p => {
    const draw = reducedMotion ? 1 : smooth(Math.min(1, (performance.now() - t0) / 2400));
    sweep.constant = SHEET.x0 + SHEET.w * draw + 0.01;
    // The drawing goes straight to the real site: as the camera tilts down, the paper dissolves
    // into the empty plot underneath (no model is built on the paper).
    const fade = 1 - smooth(seg(p, 0.07, 0.12));
    sheetMat.opacity = desk.material.opacity = fade;
    sheet.visible = desk.visible = fade > 0.01;
    scene.background.copy(SKY_PLAN).lerp(SKY_DAY, smooth(seg(p, 0.07, 0.12)));
  });

  // ---------- 02 excavation: excavator and spoil heap ----------
  const exc = new THREE.Group(); scene.add(exc);
  const excYellow = std(0xf0a020, { roughness: 0.6 }), dark = std(0x2a2a2a);
  const add = (grp, mesh, x, y, z) => { mesh.position.set(x, y, z); mesh.castShadow = true; grp.add(mesh); return mesh; };
  add(exc, new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.9, 3), dark), 0, 0.45, 0);
  const upperBody = new THREE.Group(); upperBody.position.y = 0.9; exc.add(upperBody);
  add(upperBody, new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.2, 2.6), excYellow), -0.3, 0.6, 0);
  add(upperBody, new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.3, 1.2), std(0x334455, { roughness: 0.2, metalness: 0.4 })), 0.6, 1.8, 0.6);
  const boom = new THREE.Group(); boom.position.set(1.2, 1.0, -0.5); upperBody.add(boom);
  add(boom, new THREE.Mesh(new THREE.BoxGeometry(4, 0.45, 0.45).translate(2, 0, 0), excYellow), 0, 0, 0);
  const stick = new THREE.Group(); stick.position.set(4, 0, 0); boom.add(stick);
  add(stick, new THREE.Mesh(new THREE.BoxGeometry(0.35, 3, 0.35).translate(0, -1.5, 0), excYellow), 0, 0, 0);
  add(stick, new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.7, 0.9), dark), 0, -3.1, 0);
  U.push(p => {
    const inT = seg(p, 0.12, 0.15), outT = seg(p, 0.22, 0.25);
    exc.visible = inT > 0 && outT < 1;
    exc.position.set(22 - 4 * smooth(inT) + 40 * smooth(outT), 0, 3);
    exc.rotation.y = Math.PI * 0.85;
    const dig = seg(p, 0.15, 0.22);
    upperBody.rotation.y = Math.sin(dig * Math.PI * 6) * 0.7;
    boom.rotation.z = 0.35 + Math.sin(dig * Math.PI * 12) * 0.25;
    stick.rotation.z = -0.4 + Math.cos(dig * Math.PI * 12) * 0.3;
  });
  const heap = new THREE.Mesh(new THREE.ConeGeometry(6, 3.5, 9), std(0x9b8667, { flatShading: true }));
  heap.position.set(24, 0, 12); heap.castShadow = heap.receiveShadow = true; scene.add(heap);
  U.push(p => {
    const t = smooth(seg(p, 0.16, 0.22)) * (1 - smooth(seg(p, 0.26, 0.31)));
    heap.visible = t > 0.01; heap.scale.set(t, Math.max(t, 0.01), t); heap.position.y = 1.75 * t;
  });

  // ---------- 03 foundation: rebar mat then the raft pour ----------
  const reb = [];
  for (let x = VPIT[0] + 0.5; x <= VPIT[1] - 0.5; x += 0.8) reb.push(x, -1.2, VPIT[2] + 0.4, x, -1.2, VPIT[3] - 0.4);
  for (let z = VPIT[2] + 0.5; z <= VPIT[3] - 0.5; z += 0.8) reb.push(VPIT[0] + 0.4, -1.2, z, VPIT[1] - 0.4, -1.2, z);
  CX.forEach(x => CZ.forEach(z => { for (const dx of [-0.15, 0.15]) reb.push(x + dx, -1.2, z, x + dx, 1.4, z); }));
  const rebG = new THREE.BufferGeometry(); rebG.setAttribute('position', new THREE.Float32BufferAttribute(reb, 3));
  const rebar = new THREE.LineSegments(rebG, new THREE.LineBasicMaterial({ color: 0x9a4a2a }));
  scene.add(rebar);
  const rebCount = reb.length / 3;
  U.push(p => { const t = seg(p, 0.22, 0.25); rebar.visible = t > 0 && p < 0.305; rebar.geometry.setDrawRange(0, Math.floor((rebCount * t) / 2) * 2); });
  const concMat = std(0xc6c3bc, { roughness: 0.9 });
  const { w: pw, d: pd, cx: pcx, cz: pcz } = rect(VPIT);
  const raft = box(pw, 1.8, pd, concMat, pcx, -1.8, pcz);
  grow(raft, 0.25, 0.29, 'y', smooth);

  // Concrete pump truck: boom unfolds on each pour day (raft, first slab, roof slab)
  const pump = new THREE.Group(); pump.position.set(24, 0, -17); pump.rotation.y = Math.PI * 0.9; scene.add(pump);
  const pumpMat = std(0xeeeeee, { roughness: 0.5 }), pumpOrange = std(ORANGE, { roughness: 0.5 });
  add(pump, new THREE.Mesh(new THREE.BoxGeometry(9, 1.1, 2.5).translate(0, 1.2, 0), dark), 0, 0, 0);
  add(pump, new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.2, 2.4).translate(0, 1.8, 0), pumpMat), 3.8, 0, 0);
  for (const wx of [-3, -1.5, 3.4]) for (const wz of [-1.1, 1.1]) add(pump, new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.4, 14).rotateX(Math.PI / 2), dark), wx, 0.5, wz);
  const pb1 = new THREE.Group(); pb1.position.set(-1, 2.4, 0); pump.add(pb1);
  add(pb1, new THREE.Mesh(new THREE.BoxGeometry(9, 0.45, 0.45).translate(4.5, 0, 0), pumpOrange), 0, 0, 0);
  const pb2 = new THREE.Group(); pb2.position.set(9, 0, 0); pb1.add(pb2);
  add(pb2, new THREE.Mesh(new THREE.BoxGeometry(8, 0.38, 0.38).translate(4, 0, 0), pumpOrange), 0, 0, 0);
  const pb3 = new THREE.Group(); pb3.position.set(8, 0, 0); pb2.add(pb3);
  add(pb3, new THREE.Mesh(new THREE.BoxGeometry(0.18, 4, 0.18).translate(0, -2, 0), dark), 0, 0, 0);
  const POURS = [[0.24, 0.3], [0.345, 0.375], [0.415, 0.445]];
  U.push(p => {
    let on = 0;
    for (const [a, b] of POURS) on = Math.max(on, smooth(seg(p, a, a + 0.01)) * (1 - smooth(seg(p, b - 0.01, b))));
    pump.visible = p > 0.235 && p < 0.45;
    const unfold = on;
    pb1.rotation.z = 0.15 + 0.55 * unfold;
    pb2.rotation.z = -0.15 - 1.3 * unfold;
    pb3.rotation.z = 0.6 * unfold;
    pb1.rotation.y = 0.35 * Math.sin(p * 80) * unfold;
  });

  // ---------- 04 structure: columns, props + plywood deck, pour, rebar starters on the roof ----------
  const upper = []; // everything above the ground-floor ceiling, hidden for the cutaway
  const props = [];
  const plyCol = new THREE.Color(0xb98a52);
  function floorFrame(level, top, a, xs, extent, isUpper) {
    const h = top - SL - level;
    let i = 0;
    xs.forEach(x => CZ.forEach(z => {
      const c = box(0.4, h, 0.4, concMat, x, level, z);
      const s = a + (i++ / (xs.length * CZ.length)) * 0.018;
      grow(c, s, s + 0.01);
      if (isUpper) upper.push(c);
    }));
    // Lebanese slab: plywood deck on a forest of steel props, then the pour
    const { w, d, cx, cz } = rect(extent);
    const propMat = std(0x8a8f96, { metalness: 0.6, roughness: 0.4 });
    for (let x = extent[0] + 1; x < extent[1]; x += 2) for (let z = extent[2] + 1; z < extent[3]; z += 2) {
      const pr = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, h, 6).translate(0, h / 2, 0), propMat);
      pr.position.set(x, level, z); scene.add(pr); props.push(pr);
      U.push(p => { const t = seg(p, a + 0.028, a + 0.034) * (1 - seg(p, 0.47, 0.5)); pr.visible = t > 0.01 && !(cut > 0.5 && isUpper); pr.scale.y = Math.max(t, 0.01); });
      if (isUpper) upper.push(pr);
    }
    const slabMat = std(0xffffff, { roughness: 0.9 });
    const slab = box(w, SL, d, slabMat, extent[0], top - SL, cz, 'left');
    slab.geometry.translate(0, -SL / 2, 0);
    grow(slab, a + 0.032, a + 0.045, 'x', smooth);
    U.push(p => { const pour = smooth(seg(p, a + 0.048, a + 0.062)); slabMat.color.copy(plyCol).lerp(concreteCol, pour); });
    upper.push(slab);
    return slab;
  }
  floorFrame(0, L1, 0.3, CX, UPPER, false); // ground-floor columns + first-floor slab (with cantilever)
  floorFrame(L1, L2, 0.375, CX, UPPER, true); // first-floor columns + roof slab
  // Rebar starters left on the roof columns, the classic Lebanese "next floor" sight
  const starters = [];
  CX.forEach(x => CZ.forEach(z => { for (const dx of [-0.12, 0.12]) for (const dz of [-0.12, 0.12]) starters.push(x + dx, L2, z + dz, x + dx * 1.4, L2 + 1.1, z + dz * 1.4); }));
  const stG = new THREE.BufferGeometry(); stG.setAttribute('position', new THREE.Float32BufferAttribute(starters, 3));
  const starterLines = new THREE.LineSegments(stG, new THREE.LineBasicMaterial({ color: 0x8a4428 }));
  scene.add(starterLines); upper.push(starterLines);
  U.push(p => { starterLines.visible = p > 0.44 && p < 0.7 && cut < 0.5; });

  // Pool shell walls and the stair core rise with the structure
  // ---------- 05 masonry: hollow concrete blocks ----------
  const gfWallMat = std(0xffffff, { map: blockTex, transparent: true });
  const ffWallMat = std(0xffffff, { map: blockTex, transparent: true });
  const gfH = L1 - SL, ffH = L2 - SL - L1;
  // Ground floor (same layout as plan-drawing.js). North band z -14..-7: foyer + powder room, stair hall
  // + lift, kitchen, laundry + maid's room + bath. South band z -7..0: salon, dining, family living,
  // open to each other and glazed to the garden. Solid block only where rooms need it.
  const gfWalls = [
    box(24, gfH, 0.25, gfWallMat, 2, 0, -14), // north
    box(0.25, gfH, 3.5, gfWallMat, -10, 0, -12.25), box(0.25, gfH, 1.7, gfWallMat, -10, 0, -7.85), // west, entry door between
    box(0.25, gfH, 4, gfWallMat, 14, 0, -12), box(0.25, gfH, 1.8, gfWallMat, 14, 0, -7.9), // east, service door between
    box(4, gfH, 0.15, gfWallMat, -8, 0, -7), box(2, gfH, 0.15, gfWallMat, 2, 0, -7), box(8, gfH, 0.15, gfWallMat, 10, 0, -7), // north|south bands
    box(0.4, gfH, 0.12, gfWallMat, -9.8, 0, -11.6), box(1.0, gfH, 0.12, gfWallMat, -8.3, 0, -11.6), box(0.12, gfH, 2.4, gfWallMat, -7.8, 0, -12.8), // powder room, door between
    box(0.15, gfH, 5, gfWallMat, 1, 0, -11.5), box(0.15, gfH, 1, gfWallMat, 1, 0, -7.5), // stair hall | kitchen
    box(0.15, gfH, 4, gfWallMat, 8, 0, -12), box(0.15, gfH, 1.8, gfWallMat, 8, 0, -7.9), // kitchen | service corridor (door z -10..-8.8)
    box(1, gfH, 0.12, gfWallMat, 8.5, 0, -10), box(1.1, gfH, 0.12, gfWallMat, 10.45, 0, -10), box(2.1, gfH, 0.12, gfWallMat, 12.95, 0, -10), // laundry & maid's room doors
    box(0.12, gfH, 4, gfWallMat, 10.6, 0, -12), // laundry | maid's room
    box(0.4, gfH, 0.12, gfWallMat, 8.2, 0, -8.8), box(3.2, gfH, 0.12, gfWallMat, 10.8, 0, -8.8), box(0.8, gfH, 0.12, gfWallMat, 13.6, 0, -8.8), // store & maid's bath doors
    box(0.12, gfH, 1.8, gfWallMat, 11.6, 0, -7.9), // store | maid's bath
    box(0.3, gfH, 3.5, gfWallMat, 6, 0, -5.25), // TV wall between dining and family living
  ];
  const ffWalls = [
    box(28, ffH, 0.25, ffWallMat, 0, L1, -14), box(0.25, ffH, 7, ffWallMat, 14, L1, -10.5), box(0.2, ffH, 7, ffWallMat, 0, L1, -10.5),
  ];
  gfWalls.forEach((w, k) => grow(w, 0.465 + k * 0.004, 0.495 + k * 0.004));
  ffWalls.forEach((w, k) => { grow(w, 0.495 + k * 0.004, 0.525 + k * 0.004); upper.push(w); });
  const parapets = [];
  [[0, 0, 28.3, 0.25], [0, -14, 28.3, 0.25], [-14, -7, 0.25, 14], [14, -7, 0.25, 14]].forEach(([x, z, w, d]) => {
    const pp = box(w, 1.0, d, ffWallMat, x, L2, z); grow(pp, 0.525, 0.54); upper.push(pp); parapets.push(pp);
  });

  // ---------- 06 MEP in the floor (cutaway): pipes on the slab, sand fill, screed, marble tiles ----------
  let cut = 0;
  const pprMat = std(0x3f8f4f, { roughness: 0.5, emissive: 0x2f7f3f, emissiveIntensity: 0.3 }); // green PPR water
  const drainMat = std(0xb5b5b0, { roughness: 0.5 }); // grey PVC drain
  const condMat = std(ORANGE, { roughness: 0.6, emissive: ORANGE, emissiveIntensity: 0.35 }); // corrugated conduit
  const mep = [];
  const runX = (r, x0, x1, z, mat, y = 0.08) => { const len = x1 - x0; const g = new THREE.CylinderGeometry(r, r, len, 10).rotateZ(Math.PI / 2).translate(len / 2, 0, 0); const m = new THREE.Mesh(g, mat); m.position.set(x0, y, z); scene.add(m); mep.push(m); return m; };
  const runZ = (r, z0, z1, x, mat, y = 0.08) => { const len = z1 - z0; const g = new THREE.CylinderGeometry(r, r, len, 10).rotateX(Math.PI / 2).translate(0, 0, len / 2); const m = new THREE.Mesh(g, mat); m.position.set(x, y, z0); scene.add(m); mep.push(m); return m; };
  // Runs follow the wet rooms (powder room, kitchen, laundry, maid's bath) along the north band,
  // with branches south to floor boxes in the salon, dining and living.
  const runs = [
    [runX(0.06, -9.5, 13.5, -12.8, pprMat), 'x'], [runZ(0.06, -12.8, -1, 3, pprMat), 'z'], [runZ(0.06, -12.8, -9, 12.8, pprMat), 'z'],
    [runX(0.1, -9.5, 13.5, -13.4, drainMat, 0.1), 'x'], [runZ(0.1, -13.4, -9, -9, drainMat, 0.1), 'z'],
    [runX(0.05, -9.5, 13.5, -11.6, condMat), 'x'], [runZ(0.05, -11.6, -0.8, -6, condMat), 'z'], [runZ(0.05, -11.6, -0.8, 4, condMat), 'z'], [runZ(0.05, -11.6, -2, 11, condMat), 'z'],
    [runX(0.05, -8, 10, -2.5, condMat), 'x'],
  ];
  runs.forEach(([m, axis], i) => grow(m, 0.585 + i * 0.003, 0.605 + i * 0.003, axis));
  for (const [x, z] of [[-6, -0.8], [4, -0.8], [11, -2], [3, -1], [12.8, -8]]) {
    const bx = box(0.25, 0.18, 0.25, std(0x2b2b2b), x, 0.02, z); mep.push(bx); grow(bx, 0.6, 0.61);
  }
  const { w: vw, d: vd, cx: vcx, cz: vcz } = rect(VILLA);
  const sand = box(vw - 0.4, 0.2, vd - 0.4, std(0xd8c49a, { roughness: 1 }), vcx, 0, vcz); sand.castShadow = false;
  grow(sand, 0.615, 0.635, 'y', smooth);
  const screed = box(vw - 0.4, 0.04, vd - 0.4, std(0xa9a69f), vcx, 0.2, vcz); screed.castShadow = false;
  grow(screed, 0.635, 0.645, 'y');
  const marble = box(vw - 0.4, 0.03, vd - 0.4, std(0xffffff, { map: tileTex, roughness: 0.18, metalness: 0.05 }), VILLA[0] + 0.2, 0.24, vcz, 'left');
  marble.geometry.translate(0, -0.015, 0); marble.castShadow = false;
  grow(marble, 0.645, 0.67, 'x', smooth);
  U.push((p, time) => {
    cut = smooth(seg(p, 0.555, 0.585)) * (1 - smooth(seg(p, 0.675, 0.7)));
    const hide = cut > 0.5;
    upper.forEach(o => { if (o !== starterLines && !props.includes(o)) o.visible = o.visible && !hide; });
    const xr = cut * 0.78;
    gfWallMat.opacity = 1 - xr; gfWallMat.depthWrite = xr < 0.05;
    const pulse = 0.35 + 0.35 * Math.sin(time * 3);
    pprMat.emissiveIntensity = condMat.emissiveIntensity = p > 0.58 && p < 0.65 ? pulse : 0.1;
    mep.forEach(m => { if (p > 0.66) m.visible = false; });
  });

  // ---------- 07 finishing: stone cladding, white render, glass, timber louvers, roof kit ----------
  let finished = false;
  const ffFinal = new THREE.Color(0xf4f1ea);
  U.push(p => {
    const f = smooth(seg(p, 0.69, 0.72));
    const wantFin = f > 0;
    if (wantFin !== finished) {
      gfWallMat.map = wantFin ? stoneTex : blockTex; gfWallMat.needsUpdate = true;
      ffWallMat.map = wantFin ? null : blockTex; ffWallMat.needsUpdate = true;
      finished = wantFin;
    }
    ffWallMat.color.copy(white).lerp(ffFinal, f);
  });
  const glassM = (color, op) => {
    const m = std(color, { metalness: 0.35, roughness: 0.06, transparent: true, opacity: 0, emissive: 0xffc98a, emissiveIntensity: 0 });
    U.push(p => { m.opacity = op * seg(p, 0.72, 0.76); m.visible = p > 0.72; });
    return m;
  };
  // Glass on three sides, slim black frames, white "picture frame" edges, deep overhangs with LED
  // strips, a balcony with a glass railing, black vertical fins and planters (client reference photos).
  const gfGlass = glassM(0x9db8c6, 0.5), ffGlass = glassM(0x86a0ae, 0.58);
  const glassPanes = [
    box(23.6, gfH - 0.2, 0.06, gfGlass, 2, 0.25, 0.05), // ground floor, full south facade
    box(0.06, gfH - 0.2, 7, gfGlass, -10.1, 0.25, -3.5), // salon corner, west
    box(0.06, gfH - 0.2, 7, gfGlass, 14.1, 0.25, -3.5), // family living, east
  ];
  const upperPanes = [
    box(28, ffH - 0.2, 0.06, ffGlass, 0, L1 + 0.1, 0.02), // first floor, full south facade
    box(0.06, ffH - 0.2, 14, ffGlass, -14.05, L1 + 0.1, -7), // first floor, west (over the cantilever)
  ];
  glassPanes.concat(upperPanes).forEach(g => (g.castShadow = false));
  upperPanes.forEach(g => upper.push(g));
  const frameMat = std(0x1e1e1e, { metalness: 0.6, roughness: 0.35 });
  const louverMat = std(0x8a5a35, { roughness: 0.6 }); // timber, used by the carport pergola
  for (let x = -7.5; x < 14; x += 2.5) { const mu = box(0.07, gfH - 0.2, 0.1, frameMat, x, 0.25, 0.08); grow(mu, 0.72, 0.75); }
  for (const z of [-2.3, -4.7]) for (const x of [-10.12, 14.12]) { const mu = box(0.1, gfH - 0.2, 0.07, frameMat, x, 0.25, z); grow(mu, 0.72, 0.75); }
  for (let x = -11; x < 14; x += 3) { const mu = box(0.07, ffH - 0.2, 0.1, frameMat, x, L1 + 0.1, 0.06); grow(mu, 0.725, 0.755); upper.push(mu); }
  const whiteMat = std(0xf3f1ec, { roughness: 0.55 });
  const finishPieces = [];
  // first-floor balcony slab wrapping the south facade (it shades the covered terrace), glass railing on its edge
  finishPieces.push(box(28.4, 0.3, 2.6, whiteMat, 0, L1 - SL, 1.3));
  const railGlass = glassM(0xc4d6de, 0.45);
  const rail = box(28.4, 1.05, 0.05, railGlass, 0, L1, 2.58); rail.castShadow = false; upper.push(rail);
  // roof canopy overhang and the white frame returns at both ends
  finishPieces.push(box(29.2, 0.55, 3, whiteMat, 0, L2 - 0.55, 1.3));
  finishPieces.push(box(0.45, L2 - L1 + 0.6, 3, whiteMat, -14.4, L1 - 0.6, 1.3), box(0.45, L2 - L1 + 0.6, 3, whiteMat, 14.4, L1 - 0.6, 1.3));
  // LED strips under the overhangs (glow at dusk)
  const ledMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffe2b0, emissiveIntensity: 0.15 });
  const leds = [box(28.6, 0.04, 0.08, ledMat, 0, L2 - 0.6, 2.65), box(28, 0.04, 0.08, ledMat, 0, L1 - SL - 0.05, 2.45)];
  leds.forEach(l => { l.castShadow = false; finishPieces.push(l); });
  // black vertical fins in front of the east bedroom, as in the reference facade
  for (let x = 10.2; x < 14; x += 0.32) finishPieces.push(box(0.08, ffH - 0.3, 0.22, frameMat, x, L1 + 0.15, 0.45));
  // planters with hedges on the balcony, and on the cantilever
  const planterMat = std(0x2a2a2a, { roughness: 0.7 }), hedgeMat = std(0x4f7a3a, { flatShading: true });
  for (const [x, w] of [[-10.5, 5], [5, 3]]) {
    finishPieces.push(box(w, 0.55, 0.7, planterMat, x, L1, 1.6), box(w - 0.1, 0.45, 0.6, hedgeMat, x, L1 + 0.55, 1.6));
  }
  finishPieces.forEach((m, i) => { upper.push(m); grow(m, 0.73 + (i % 6) * 0.004, 0.76 + (i % 6) * 0.004); });
  // Furniture seen through the glass (salon, dining, family living, kitchen)
  const sofaMat = std(0x3b3b3d, { roughness: 0.9 }), woodMat = std(0x8a6a4c, { roughness: 0.6 }), islandMat = std(0xf2f0eb, { roughness: 0.4 });
  [
    box(3.4, 0.75, 0.9, sofaMat, -6, 0.25, -5.6), box(3.4, 0.75, 0.9, sofaMat, -6, 0.25, -1.6), box(1.6, 0.4, 1.1, woodMat, -6, 0.25, -3.6), // salon
    box(3.8, 0.75, 1.1, woodMat, 2.5, 0.25, -3.5), // dining for 10
    box(4.2, 0.75, 0.9, sofaMat, 10.2, 0.25, -5.4), box(0.9, 0.75, 2.6, sofaMat, 12.9, 0.25, -3.7), box(1.4, 0.4, 1, woodMat, 10, 0.25, -3.4), // family living
    box(3.2, 0.9, 1.1, islandMat, 4.5, 0.25, -10.4), box(6.6, 0.9, 0.6, islandMat, 4.5, 0.25, -13.55), // kitchen
  ].forEach(m => life(m, 0.76, 0.78));
  const solarMat = std(0x1d2a4a, { metalness: 0.5, roughness: 0.25 });
  for (let i = 0; i < 5; i++) for (let j = 0; j < 2; j++) {
    const sp = box(3.2, 0.08, 1.8, solarMat, -6 + i * 3.6, L2 + 0.7, -9 + j * 2.6, 'center'); sp.rotation.x = -0.4;
    life(sp, 0.76 + i * 0.004, 0.78 + i * 0.004); upper.push(sp);
  }
  const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 1.6, 16).translate(0, 0.8, 0), std(0x2b2b2b));
  tank.position.set(11, L2, -9); tank.castShadow = true; scene.add(tank); life(tank, 0.77, 0.79); upper.push(tank);
  // Interior: gypsum ceiling with downlights, seen through the glass at night
  const downMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff1d8, emissiveIntensity: 0.2 });
  for (let x = -8; x <= 12; x += 3) for (const z of [-11, -3.5]) { const dl = box(0.3, 0.02, 0.3, downMat, x, L1 - SL - 0.05, z); dl.castShadow = false; life(dl, 0.74, 0.76); }

  // ---------- 08 outdoor: pool, terrace, parking, mini football pitch, stone boundary wall ----------
  const deckMat = std(0xe8dcc4, { roughness: 0.7 });
  const deck = box(16, 0.12, 4.4, deckMat, 3, 0, 1.9); deck.castShadow = false; grow(deck, 0.8, 0.83, 'x');
  [[3, 3.7, 16, 0.6], [3, 9.3, 16, 0.6], [-4.3, 6.5, 0.6, 6.2], [10.3, 6.5, 0.6, 6.2]].forEach(([x, z, w, d]) => {
    const c = box(w, 0.14, d, deckMat, x, 0, z); c.castShadow = false; grow(c, 0.805, 0.83, w > 1 ? 'x' : 'z');
  });
  const { w: plw, d: pld, cx: plcx, cz: plcz } = rect(POOL);
  const waterMat = new THREE.MeshStandardMaterial({ color: 0x3fb4d6, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.86, emissive: 0x29c1e8, emissiveIntensity: 0 });
  const water = new THREE.Mesh(new THREE.PlaneGeometry(plw - 0.1, pld - 0.1).rotateX(-Math.PI / 2), waterMat);
  water.position.set(plcx, -1.6, plcz); scene.add(water);
  U.push((p, time) => {
    const t = smooth(seg(p, 0.82, 0.86));
    water.visible = t > 0.01; water.position.y = -1.6 + 1.45 * t + Math.sin(time * 1.5) * 0.01;
  });
  // Driveway pavers, carport pergola, cars
  const { w: dw, d: dd, cx: dcx, cz: dcz } = rect(DRIVE);
  const drive = box(dw, 0.06, dd, std(0xffffff, { map: paverTex }), dcx, 0, DRIVE[3], 'center');
  drive.geometry.translate(0, 0.03, -dd / 2); drive.castShadow = false; paverTex.repeat.set(2, 9);
  grow(drive, 0.81, 0.845, 'z', smooth);
  const { w: cw, d: cd, cx: ccx, cz: ccz } = rect(CARPORT);
  const cpTex = paverTex.clone(); cpTex.repeat.set(4, 3); cpTex.needsUpdate = true;
  const cpFloor = box(cw, 0.06, cd, std(0xffffff, { map: cpTex }), ccx, 0, ccz); cpFloor.castShadow = false; grow(cpFloor, 0.82, 0.845, 'x');
  const steel = std(0x262626, { metalness: 0.6, roughness: 0.4 });
  for (const x of [CARPORT[0] + 0.2, CARPORT[1] - 0.2]) for (const z of [CARPORT[2] + 0.2, CARPORT[3] - 0.2]) { const po = box(0.2, 2.8, 0.2, steel, x, 0, z); grow(po, 0.83, 0.845); }
  for (let z = CARPORT[2] + 0.3; z < CARPORT[3]; z += 0.6) { const sl = box(cw, 0.12, 0.25, louverMat, ccx, 2.8, z); grow(sl, 0.84, 0.86, 'x'); }
  const lineMat = new THREE.MeshBasicMaterial({ color: 0xf2f2ee });
  for (let x = CARPORT[0] + 4; x < CARPORT[1]; x += 4) { const ln = box(0.1, 0.01, cd - 1, lineMat, x, 0.065, ccz); ln.castShadow = false; grow(ln, 0.845, 0.85); }
  function car(color) {
    const g = new THREE.Group();
    const body = std(color, { metalness: 0.6, roughness: 0.3 }), glassC = std(0x1a2028, { metalness: 0.5, roughness: 0.1 });
    add(g, new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.7, 4.4).translate(0, 0.65, 0), body), 0, 0, 0);
    add(g, new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.6, 2.3).translate(0, 1.3, -0.2), glassC), 0, 0, 0);
    for (const x of [-0.85, 0.85]) for (const z of [-1.4, 1.4]) add(g, new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.25, 14).rotateZ(Math.PI / 2), dark), x, 0.36, z);
    scene.add(g); return g;
  }
  [[0xf2f2f2, CARPORT[0] + 2, 0.87], [0x1e1e20, CARPORT[0] + 6, 0.885]].forEach(([col, x, a]) => {
    const c = car(col);
    U.push(p => {
      const t = smooth(seg(p, a, a + 0.03));
      c.visible = t > 0;
      // drive in from the gate along the driveway, then turn into the bay
      const z = 24 - (24 - (ccz)) * t;
      c.position.set(t < 0.7 ? -21 : -21 + (x + 21) * smooth((t - 0.7) / 0.3), 0, z);
      c.rotation.y = 0;
    });
  });
  // Tennis court: hard court surface, net, fence, floodlights
  const { w: tw, d: td, cx: tcx, cz: tcz } = rect(TENNIS);
  const tennis = box(tw, 0.05, td, std(0xffffff, { map: tennisTex, roughness: 0.8 }), tcx, 0, tcz); tennis.castShadow = false;
  grow(tennis, 0.82, 0.85, 'z', smooth);
  const netMat = new THREE.MeshStandardMaterial({ map: netTex, transparent: true, alphaTest: 0.3, side: THREE.DoubleSide, roughness: 1 });
  const postMat = std(0x1f3d2c, { metalness: 0.5, roughness: 0.4 });
  const tnet = new THREE.Group(); tnet.position.set(tcx, 0, tcz); scene.add(tnet);
  const tnTex = netTex.clone(); tnTex.repeat.set(11.9 / 0.25, 1); tnTex.needsUpdate = true;
  add(tnet, new THREE.Mesh(new THREE.PlaneGeometry(11.9, 0.9).translate(0, 0.52, 0), netMat.clone()), 0, 0, 0).material.map = tnTex;
  add(tnet, new THREE.Mesh(new THREE.BoxGeometry(11.9, 0.06, 0.04), std(0xf5f5f2)), 0, 0.98, 0);
  for (const x of [-5.95, 5.95]) add(tnet, new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.07).translate(0, 0.535, 0), postMat), x, 0, 0);
  life(tnet, 0.85, 0.865);
  const fenceH = 3.5;
  [[tcx, TENNIS[2], tw, 0], [tcx, TENNIS[3], tw, 0], [TENNIS[0], tcz, td, Math.PI / 2], [TENNIS[1], tcz, td, Math.PI / 2]].forEach(([x, z, len, rot]) => {
    const t = netTex.clone(); t.repeat.set(len / 1.2, fenceH / 1.2); t.needsUpdate = true;
    const m = netMat.clone(); m.map = t;
    const net = new THREE.Mesh(new THREE.PlaneGeometry(len, fenceH).translate(0, fenceH / 2, 0), m);
    net.position.set(x, 0, z); net.rotation.y = rot; scene.add(net); grow(net, 0.855, 0.875);
  });
  // Basketball half court: surface, hoop with backboard
  const { w: bwid, d: bdep, cx: bcx, cz: bcz } = rect(BASKET);
  const basket = box(bwid, 0.05, bdep, std(0xffffff, { map: basketTex, roughness: 0.75 }), bcx, 0, bcz); basket.castShadow = false;
  grow(basket, 0.825, 0.855, 'z', smooth);
  const hoop = new THREE.Group(); hoop.position.set(bcx, 0, BASKET[3] - 0.3); scene.add(hoop);
  add(hoop, new THREE.Mesh(new THREE.BoxGeometry(0.18, 3.4, 0.18).translate(0, 1.7, 0), steel), 0, 0, 0.6);
  add(hoop, new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 1.4), steel), 0, 3.3, 0.05);
  add(hoop, new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.05, 0.05), std(0xf5f5f2, { roughness: 0.3 })), 0, 3.45, -0.6);
  add(hoop, new THREE.Mesh(new THREE.TorusGeometry(0.23, 0.02, 8, 24).rotateX(Math.PI / 2), std(ORANGE)), 0, 3.05, -0.9);
  life(hoop, 0.85, 0.87);
  // Floodlights: four on the tennis court, two on the basketball court
  const floodMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xf4f8ff, emissiveIntensity: 0 });
  const flood = (x, z, tx, tz) => {
    const pole = box(0.15, 6.5, 0.15, steel, x, 0, z); grow(pole, 0.86, 0.875);
    const head = box(0.9, 0.3, 0.5, floodMat, x, 6.5, z); head.lookAt(tx, 0, tz); grow(head, 0.865, 0.875);
  };
  for (const x of [TENNIS[0], TENNIS[1]]) for (const z of [TENNIS[2], TENNIS[3]]) flood(x, z, tcx, tcz);
  for (const x of [BASKET[0] + 0.3, BASKET[1] - 0.3]) flood(x, BASKET[2] + 0.5, bcx, bcz);
  // Modern boundary wall: white rendered plinth, black horizontal aluminium slats, white piers with
  // wall lights, and a matching slatted sliding gate on the driveway.
  const slatTex = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#121212'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 32) { g.fillStyle = '#2c2c2e'; g.fillRect(0, y + 4, w, 22); g.fillStyle = '#3a3a3d'; g.fillRect(0, y + 4, w, 3); }
  }, true);
  const renderMat = std(0xf1efea, { roughness: 0.7 });
  const wallLightMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffe2b0, emissiveIntensity: 0 });
  const wallSegs = [
    [PLOT[0], PLOT[1], PLOT[2], 'x'], [PLOT[2], PLOT[3], PLOT[0], 'z'], [PLOT[2], PLOT[3], PLOT[1], 'z'],
    [PLOT[0], DRIVE[0], PLOT[3], 'x'], [DRIVE[1], PLOT[1], PLOT[3], 'x'],
  ];
  const wallParts = [];
  wallSegs.forEach(([a, b, at, axis]) => {
    const len = b - a, mid = (a + b) / 2;
    const place = (m, along) => { if (axis === 'x') m.position.set(along, m.position.y, at); else m.position.set(at, m.position.y, along); };
    const sz = (lenA, h, thick) => (axis === 'x' ? [lenA, h, thick] : [thick, h, lenA]);
    const plinth = box(...sz(len, 0.55, 0.42), renderMat, 0, 0, 0); place(plinth, mid);
    const t = slatTex.clone(); t.repeat.set(len / 2, 1.3); t.needsUpdate = true;
    const slats = box(...sz(len, 1.3, 0.22), std(0xffffff, { map: t, roughness: 0.45, metalness: 0.4 }), 0, 0.55, 0); place(slats, mid);
    wallParts.push(plinth, slats);
    for (let s = a; s <= b + 0.01; s += len / Math.max(1, Math.round(len / 6))) {
      const pier = box(...sz(0.5, 2.0, 0.5), renderMat, 0, 0, 0); place(pier, s);
      const light = box(...sz(0.3, 0.05, 0.3), wallLightMat, 0, 2.0, 0); place(light, s); light.castShadow = false;
      wallParts.push(pier, light);
    }
  });
  wallParts.forEach((w, k) => grow(w, 0.8 + (k % 8) * 0.004, 0.83 + (k % 8) * 0.004));
  const gateTex = slatTex.clone(); gateTex.repeat.set(3, 1.8); gateTex.needsUpdate = true;
  const gate = box(6, 1.85, 0.12, std(0xffffff, { map: gateTex, roughness: 0.45, metalness: 0.4 }), (DRIVE[0] + DRIVE[1]) / 2, 0, PLOT[3]);
  U.push(p => { gate.visible = p > 0.84; gate.position.x = (DRIVE[0] + DRIVE[1]) / 2 + (p > 0.865 && p < 0.92 ? 6 * smooth(seg(p, 0.865, 0.875)) * (1 - smooth(seg(p, 0.905, 0.915))) : 0); });
  // Lawn (gazon) over the whole plot, with a cut-out for the pool; the land outside the wall greens up too.
  const grassTex = canvasTex(512, 512, (g, w, h) => {
    for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#5f9446' : '#67a04c'; g.fillRect((i * w) / 8, 0, w / 8, h); } // mowing stripes
    const r = rng(29);
    for (let i = 0; i < 9000; i++) { g.fillStyle = r() < 0.5 ? 'rgba(40,80,30,.18)' : 'rgba(150,190,110,.16)'; g.fillRect(r() * w, r() * h, 1 + r() * 2, 2 + r() * 3); }
  }, true);
  grassTex.repeat.set(1 / 16, 1 / 16);
  const lawnShape = new THREE.Shape();
  lawnShape.moveTo(PLOT[0] + 0.2, -(PLOT[3] - 0.2)); lawnShape.lineTo(PLOT[1] - 0.2, -(PLOT[3] - 0.2)); lawnShape.lineTo(PLOT[1] - 0.2, -(PLOT[2] + 0.2)); lawnShape.lineTo(PLOT[0] + 0.2, -(PLOT[2] + 0.2));
  const poolHole = new THREE.Path();
  poolHole.moveTo(POOL[0], -POOL[3]); poolHole.lineTo(POOL[0], -POOL[2]); poolHole.lineTo(POOL[1], -POOL[2]); poolHole.lineTo(POOL[1], -POOL[3]);
  lawnShape.holes.push(poolHole);
  const lawnMat = std(0xffffff, { map: grassTex, roughness: 1, transparent: true, opacity: 0 });
  const lawn = new THREE.Mesh(new THREE.ShapeGeometry(lawnShape).rotateX(-Math.PI / 2), lawnMat);
  lawn.position.y = 0.018; lawn.receiveShadow = true; scene.add(lawn);
  const soilTint = new THREE.Color(0xffffff), grassTint = new THREE.Color(0xb7cf8f);
  U.push(p => {
    const t = smooth(seg(p, 0.8, 0.85));
    lawn.visible = t > 0.01; lawnMat.opacity = t; lawnMat.depthWrite = t > 0.99;
    ground.material.color.copy(soilTint).lerp(grassTint, smooth(seg(p, 0.82, 0.88)));
  });
  const lamps = [];
  const lampMat = new THREE.MeshStandardMaterial({ color: 0xfff2d6, emissive: 0xffd9a0, emissiveIntensity: 0 });
  [[-12, 10, 'olive'], [-12, 16, 'olive'], [14, 14, 'olive'], [-2, 18, 'pine'], [8, 20, 'olive'], [-28, 18, 'pine'], [-28, -20, 'olive'], [12, -19, 'pine'], [-14, -19, 'olive']].forEach(([x, z, k], i) => {
    const t = tree(x, z, k, 0.9); life(t, 0.86 + i * 0.003, 0.885 + i * 0.003);
  });
  for (const [x, z] of [[-17, 6], [-17, 14], [-1, 11], [11, 11], [16, 4]]) {
    const l = new THREE.Group(); l.position.set(x, 0, z); scene.add(l);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 1).translate(0, 0.5, 0), steel);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 8).translate(0, 1.05, 0), lampMat);
    l.add(pole, head); lamps.push(l); life(l, 0.87, 0.89);
  }

  // ---------- 09 handover: dusk, every light on ----------
  const poolLight = new THREE.PointLight(0x5fd8ff, 0, 18, 1.6); poolLight.position.set(plcx, 0.5, plcz); scene.add(poolLight);
  const courtLight = new THREE.PointLight(0xeaf2ff, 0, 34, 1.4); courtLight.position.set(tcx, 7, tcz); scene.add(courtLight);
  const basketLight = new THREE.PointLight(0xeaf2ff, 0, 20, 1.5); basketLight.position.set(bcx, 6, bcz); scene.add(basketLight);
  const houseLight = new THREE.PointLight(0xffc27a, 0, 22, 1.5); houseLight.position.set(4, 2, -4); scene.add(houseLight);
  // First floor: warm interior light and ceiling downlights so the upper glass glows like the ground floor
  const upperLights = [new THREE.PointLight(0xffc27a, 0, 18, 1.4), new THREE.PointLight(0xffc27a, 0, 18, 1.4), new THREE.PointLight(0xffc27a, 0, 18, 1.4)];
  upperLights.forEach((l, i) => { l.position.set(-9 + i * 9, L1 + 2.2, -5); scene.add(l); });
  for (let x = -12; x <= 12; x += 3) for (const z of [-11.5, -6.5, -2]) {
    const dl = box(0.3, 0.02, 0.3, downMat, x, L2 - SL - 0.05, z); dl.castShadow = false; life(dl, 0.74, 0.76); upper.push(dl);
  }
  U.push(p => {
    const d = smooth(seg(p, 0.91, 0.99));
    if (p > 0.12) scene.background.copy(SKY_DAY).lerp(SKY_DUSK, d);
    scene.fog.color.copy(SKY_DAY).lerp(SKY_DUSK, d);
    sun.intensity = 2.7 - 1.9 * d; sun.color.copy(SUN_DAY).lerp(SUN_DUSK, d);
    hemi.intensity = 1.15 - 0.55 * d; hemi.color.copy(HEMI_DAY).lerp(HEMI_DUSK, d);
    gfGlass.emissiveIntensity = 1.3 * d; ffGlass.emissiveIntensity = 1.6 * d;
    upperLights.forEach(l => (l.intensity = 30 * d));
    wallLightMat.emissiveIntensity = 3 * d;
    downMat.emissiveIntensity = 0.2 + 2.2 * d;
    ledMat.emissiveIntensity = 0.15 + 3.2 * d;
    waterMat.emissiveIntensity = 0.9 * d;
    floodMat.emissiveIntensity = 3 * d; lampMat.emissiveIntensity = 3 * d;
    poolLight.intensity = 30 * d; courtLight.intensity = 50 * d; basketLight.intensity = 25 * d; houseLight.intensity = 25 * d;
  });

  // ---------- hover zones (after handover) ----------
  const zoneMat = new THREE.MeshBasicMaterial({ visible: false });
  const zones = [];
  const zone = (rc, h, data, y = 0) => { const { w, d, cx, cz } = rect(rc); const z = new THREE.Mesh(new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0), zoneMat); z.position.set(cx, y, cz); z.userData = data; scene.add(z); zones.push(z); };
  zone(UPPER, L2 + 1, { type: 'villa' });
  zone(POOL, 0.6, { type: 'pool' }, -0.3);
  zone(CARPORT, 3, { type: 'parking' });
  zone(TENNIS, 3.5, { type: 'tennis' });
  zone(BASKET, 3.5, { type: 'basket' });
  const hl = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: ORANGE, transparent: true, opacity: 0.22, depthWrite: false }));
  hl.visible = false; scene.add(hl);
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), pointer = { x: 0, y: 0, cx: 0, cy: 0, active: false };
  let hovered = null;

  // ---------- camera ----------
  // Two camera paths: wide (laptops, monitors) and tall (phones). The screen's shape picks the blend,
  // so a tablet or a half-width window gets an in-between shot.
  const curves = keys => ({
    pos: new THREE.CatmullRomCurve3(keys.map(k => new THREE.Vector3(...k[1])), false, 'centripetal'),
    tgt: new THREE.CatmullRomCurve3(keys.map(k => new THREE.Vector3(...k[2])), false, 'centripetal'),
  });
  const wideCam = curves(KEYS), tallCam = curves(KEYS_PORTRAIT);
  const camPos = new THREE.Vector3(), camTgt = new THREE.Vector3(), par = new THREE.Vector2(), parT = new THREE.Vector2();
  const tallPos = new THREE.Vector3(), tallTgt = new THREE.Vector3();
  const planPos = new THREE.Vector3(), planTgt = new THREE.Vector3();
  // 1 while the plan sheet is on screen (flat, fitted), easing to 0 as the camera tilts down to the land
  const planK = p => 1 - smooth(seg(p, 0.06, 0.13));
  // 0 on wide screens (aspect >= 1.15), 1 on phones (aspect <= 0.65)
  const tallness = () => smooth(clamp((1.15 - camera.aspect) / 0.5));
  function curvePoint(keys, cam, p, outPos, outTgt) {
    let i = 0;
    while (i < keys.length - 2 && p >= keys[i + 1][0]) i++;
    const l = clamp((p - keys[i][0]) / (keys[i + 1][0] - keys[i][0]));
    const u = (i + (l * 0.5 + smooth(l) * 0.5)) / (keys.length - 1);
    cam.pos.getPoint(u, outPos); cam.tgt.getPoint(u, outTgt);
  }
  function placeCamera(p) {
    curvePoint(KEYS, wideCam, p, camPos, camTgt);
    const tl = tallness();
    if (tl > 0.001) {
      curvePoint(KEYS_PORTRAIT, tallCam, p, tallPos, tallTgt);
      camPos.lerp(tallPos, tl); camTgt.lerp(tallTgt, tl);
      // very narrow phones (aspect < 0.5) step back a little more so the subject keeps its margins
      if (camera.aspect < 0.5) camPos.sub(camTgt).multiplyScalar(1 + (0.5 - camera.aspect) * 1.2).add(camTgt);
    }
    par.lerp(parT, 0.05);
    camPos.x += par.x * 2; camPos.y += par.y * 1.2;
    // Swipe to turn: rotate the camera around its target; it eases back to the planned view when released.
    yaw.v += (yaw.t - yaw.v) * 0.12;
    if (Math.abs(yaw.v) > 0.0005) {
      camPos.sub(camTgt);
      const c = Math.cos(yaw.v), s = Math.sin(yaw.v), x = camPos.x, z = camPos.z;
      camPos.x = x * c + z * s; camPos.z = -x * s + z * c;
      camPos.add(camTgt);
    }
    // The plan sheet is a flat drawing, not a 3D object: straight overhead, north up, no swipe/tilt,
    // and the camera height is chosen so the whole sheet fits the screen (contain) at any aspect ratio.
    const q = planK(p);
    if (q > 0.001) {
      const t = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
      // Wide screens: the whole sheet fits (contain), slid into the free space beside the text card.
      const H = Math.max((SHEET.h * 1.03) / (2 * t), (SHEET.w * 1.03) / (2 * t * camera.aspect));
      const spare = Math.max(0, (2 * H * t * camera.aspect - SHEET.w * 1.03) / 2);
      const wx = SHEET.x0 + SHEET.w / 2 + (rtl ? 1 : -1) * spare * 0.92, wz = SHEET.z0 + SHEET.h / 2;
      // Phones: frame the villa plan itself (house, terrace, pool) across the full width so it is large
      // and readable, sitting in the space above the text card; the rest of the sheet runs off the edges.
      const Hp = 34 / (2 * t * camera.aspect); // ~34 m of drawing across the screen width
      const px = 2, pz = -2.5; // villa + terrace + pool centred in the 3D area
      const tl = tallness();
      const sx = wx + (px - wx) * tl, sz = wz + (pz - wz) * tl, sh = H + (Hp - H) * tl;
      planPos.set(sx, sh, sz + 0.001); planTgt.set(sx, 0, sz);
      camPos.lerp(planPos, q); camTgt.lerp(planTgt, q);
    }
    // Explore mode: blend from the scroll path into a free orbit around the finished villa.
    orbit.blend += ((orbit.on ? 1 : 0) - orbit.blend) * 0.08;
    if (orbit.blend > 0.001) {
      orbit.az += (orbit.taz - orbit.az) * 0.15;
      orbit.el += (orbit.tel - orbit.el) * 0.15;
      orbit.dist += (orbit.tdist - orbit.dist) * 0.15;
      orbitPos.set(Math.cos(orbit.el) * Math.sin(orbit.az), Math.sin(orbit.el), Math.cos(orbit.el) * Math.cos(orbit.az)).multiplyScalar(orbit.dist).add(XT);
      camPos.lerp(orbitPos, orbit.blend); camTgt.lerp(XT, orbit.blend);
    }
    camera.position.copy(camPos); camera.lookAt(camTgt);
  }

  // ---------- explore mode: drag to orbit, pinch / wheel to zoom, pins for each part of the site ----------
  const yaw = { v: 0, t: 0, held: false, idle: 0 }; // swipe-to-turn during the scroll journey
  const XT = new THREE.Vector3(3, 2.5, -2); // orbit target: centre of the plot, slightly above ground
  const orbit = { az: 0, el: 0.5, dist: 62, taz: 0, tel: 0.5, tdist: 62, blend: 0, on: false, idle: 0 };
  const orbitPos = new THREE.Vector3(), tmpV = new THREE.Vector3();
  function setExplore(on) {
    if (on && !orbit.on) {
      // start the orbit exactly where the camera is, so entering is seamless
      tmpV.copy(camera.position).sub(XT);
      const len = tmpV.length();
      orbit.dist = orbit.tdist = clamp(len, 26, 90);
      orbit.az = orbit.taz = Math.atan2(tmpV.x, tmpV.z);
      orbit.el = orbit.tel = clamp(Math.asin(tmpV.y / len), 0.12, 1.3);
    }
    orbit.on = on; orbit.idle = 0;
    frameOffset();
  }
  const PINS = { villa: [2, 9.2, -7], pool: [3, 0.6, 6.5], parking: [-21, 3.4, -9], tennis: [23, 1.2, -7.5], basket: [23, 3.6, 15] };
  const pinV = new THREE.Vector3();
  function pinPositions() {
    const w = canvas.clientWidth, h = canvas.clientHeight, out = {};
    for (const [k, [x, y, z]] of Object.entries(PINS)) {
      pinV.set(x, y, z).project(camera);
      out[k] = { x: (pinV.x + 1) / 2 * w, y: (1 - pinV.y) / 2 * h, visible: pinV.z < 1 && Math.abs(pinV.x) < 1.05 && Math.abs(pinV.y) < 1.05 };
    }
    return out;
  }

  // ---------- language (no in-scene text for the villa; kept for API compatibility) ----------
  let rtl = false;
  // Redraw the sheet once web fonts are ready (main.js calls this after document.fonts.ready).
  function setLang(dict, isRtl) { rtl = isRtl; frameOffset(); drawSheet(); }

  // ---------- loop ----------
  let progress = 0, running = true, last = performance.now(), time = 0;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Shift the frame so the subject sits beside the text panel instead of behind it:
  // wide screens move the building sideways, portrait screens move it up above the panel,
  // squarish screens (tablets, split windows) do a little of both. When no text panel is on
  // screen (the finished villa, explore mode) the frame eases back to centre.
  let panelK = 1;
  function frameOffset() {
    const w = canvas.clientWidth, h = canvas.clientHeight, a = camera.aspect;
    const side = smooth(clamp((a - 0.85) / 0.45)); // 0 portrait .. 1 landscape (aspect >= 1.3)
    // Phone split layout: the 3D has its own area above the text, so nothing needs shifting.
    const split = h < window.innerHeight * 0.85;
    const k = orbit.on || split ? 0 : panelK;
    const ox = (rtl ? 1 : -1) * w * 0.13 * side * k, oy = h * 0.16 * (1 - side) * k;
    if (Math.abs(ox) + Math.abs(oy) < 0.5) camera.clearViewOffset(); else camera.setViewOffset(w, h, ox, oy, w, h);
    camera.updateProjectionMatrix();
  }
  // The canvas can change size without a window resize (phone split layout, explore mode going full screen).
  new ResizeObserver(() => resize()).observe(canvas);
  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // lens widens gradually from landscape (38°) to portrait (50°) instead of jumping at a square screen
    camera.fov = 38 + 12 * smooth(clamp((1.25 - camera.aspect) / 0.6));
    frameOffset();
  }
  function frame(now) {
    if (!running || paused) return;
    const dt = Math.min((now - last) / 1000, 0.05); last = now;
    if (!reduced) time += dt;
    // In explore mode the villa slowly turns by itself after 4 s without a touch.
    if (orbit.on) { orbit.idle += dt; if (orbit.idle > 4 && !reduced) orbit.taz += dt * 0.08; }
    // after a swipe is released, drift back to the storyboard angle
    if (!yaw.held) { yaw.idle += dt; if (yaw.idle > 1.2) yaw.t *= Math.pow(0.15, dt); }
    U.forEach(fn => fn(progress, time));
    // the text panels end before the handover stage, so the frame re-centres there
    // no shifted frame on the flat plan sheet (it fills the screen) or once the text panels end
    const k = (1 - smooth(seg(progress, 0.885, 0.93))) * (1 - planK(progress));
    if (Math.abs(k - panelK) > 0.001) { panelK = k; frameOffset(); }
    placeCamera(progress);
    // Portrait screens pull the camera further back; never let a neighbour's house or a tree block it.
    for (const o of landscape) if (o.visible && Math.hypot(o.position.x - camera.position.x, o.position.z - camera.position.z) < 24) o.visible = false;
    if (pointer.active && progress > 0.92) {
      ndc.set((pointer.x / canvas.clientWidth) * 2 - 1, -(pointer.y / canvas.clientHeight) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      const hit = ray.intersectObjects(zones, false)[0];
      const z = hit ? hit.object : null;
      if (z !== hovered) {
        hovered = z;
        if (z) {
          z.geometry.computeBoundingBox();
          const bb = z.geometry.boundingBox;
          hl.scale.set(bb.max.x - bb.min.x + 0.3, bb.max.y - bb.min.y + 0.1, bb.max.z - bb.min.z + 0.3);
          hl.position.set(z.position.x, z.position.y + (bb.max.y + bb.min.y) / 2, z.position.z);
        }
      }
      hl.visible = !!z;
      onHover(z ? z.userData : null, pointer.cx, pointer.cy);
    } else if (hovered || hl.visible) { hovered = null; hl.visible = false; onHover(null); }
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  resize();
  requestAnimationFrame(frame);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) running = false;
    else if (!running) { running = true; last = performance.now(); if (!paused) requestAnimationFrame(frame); }
  });

  // Paused while the film plays the tour; it only renders in explore mode.
  let paused = false;
  function setPaused(on) {
    if (on === paused) return;
    paused = on;
    if (!on && running) { last = performance.now(); resize(); requestAnimationFrame(frame); }
  }

  return {
    setPaused,
    setProgress: p => (progress = clamp(p)),
    setLang,
    resize,
    pointer(x, y, cx, cy, active = true) {
      Object.assign(pointer, { x, y, cx, cy, active });
      if (!reduced) parT.set((x / canvas.clientWidth - 0.5) * 2, -(y / canvas.clientHeight - 0.5) * 2);
    },
    leave() { pointer.active = false; parT.set(0, 0); },
    // phone tilt (device orientation), -1..1 on each axis, same parallax as the mouse
    tilt(x, y) { if (!reduced && !orbit.on) parT.set(clamp(x, -1, 1), clamp(y, -1, 1)); },
    setExplore,
    yawBy(dx) { yaw.t = clamp(yaw.t - dx * 0.008, -2.6, 2.6); yaw.held = true; yaw.idle = 0; },
    yawRelease() { yaw.held = false; yaw.idle = 0; },
    orbitBy(dx, dy) { orbit.taz -= dx * 0.006; orbit.tel = clamp(orbit.tel + dy * 0.004, 0.1, 1.3); orbit.idle = 0; },
    zoomBy(f) { orbit.tdist = clamp(orbit.tdist * f, 22, 95); orbit.idle = 0; },
    resetOrbit() { orbit.taz = 0.6; orbit.tel = 0.5; orbit.tdist = 62; orbit.idle = 0; },
    pinPositions,
  };
}
