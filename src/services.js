// Trade explorer: the four services shown live on the villa's own plan, in one panel.
//   Finishing   the bare shell and the finished villa side by side; the split follows the cursor
//   Plumbing    X-ray of the water supply and drainage, with water pulsing out through the runs
//   Electrical  the villa at night: the wiring glows and the lights come on room by room
//   Design & PM the drawing, then the build stage by stage along a timeline you can point at
// The tabs play through on their own (a thin bar shows the time) until you pick one; a scan line wipes
// the panel from one service to the next. Everything is painted from the same drawings as the hero.
import * as THREE from 'three';
import { SHEET } from './plan-drawing.js';
import { drawFinishedMask } from './plan-finished.js';
import { drawStage, drawTrades } from './plan-stages.js';
import { LAYOUT } from './layout.js';
import { createContours } from './contours.js';

const KEYS = ['fin', 'plu', 'ele', 'dpm'];
const DWELL = { fin: 7, plu: 6.5, ele: 6.5, dpm: 9 }; // seconds per tab when it plays by itself
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = t => t * t * (3 - 2 * t);

const VERT = /* glsl */ `void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const FRAG = /* glsl */ `
  precision highp float;
  uniform sampler2D tFin, tShell, tTr, tMask, tA, tB;
  uniform vec2 uRes; uniform float uDpr, uTime, uRtl;
  uniform int uFrom, uTo;        // views either side of the scan line
  uniform float uSwitch;         // scan line position 0..1 (1 = the new view everywhere)
  uniform float uWipe;           // finishing: where the split sits (uv.x)
  uniform float uMix, uLights;   // design: dissolve between tA and tB; electrical: how many lights are on
  uniform vec2 uHover; uniform float uHoverOn;
  uniform vec4 uWorld;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
  }
  vec3 ghost(vec3 c) { return vec3(dot(c, vec3(0.299, 0.587, 0.114))) * vec3(0.15, 0.18, 0.24) + vec3(0.03, 0.04, 0.065); }

  vec3 view(int m, vec2 uv, vec2 w) {
    float spot = exp(-pow(length((uv - uHover) * vec2(uRes.x / uRes.y, 1.0)) / 0.16, 2.0)) * uHoverOn;
    if (m == 0) {                                   // finishing: shell | finished
      float s = mix(uv.x, 1.0 - uv.x, uRtl);
      float k = smoothstep(uWipe - 0.0015, uWipe + 0.0015, s);
      vec3 shell = texture2D(tShell, uv).rgb, fin = texture2D(tFin, uv).rgb;
      shell = mix(shell, vec3(dot(shell, vec3(0.33))), 0.25) * 0.94;   // the shell reads a little flatter
      return mix(shell, fin, k);                     // shell first, finished after the split
    }
    if (m == 1 || m == 2) {
      vec3 fin = texture2D(tFin, uv).rgb, tr = texture2D(tTr, uv).rgb;
      float d = length(w - vec2(8.6, -9.4));
      float pulse = 0.62 + 0.38 * sin(uTime * 3.2 - d * 0.85);
      if (m == 1) {                                 // plumbing: X-ray, water pulsing out from the supply
        vec3 c = ghost(fin) * (1.0 + spot * 1.2);
        float flow = smoothstep(0.55, 1.0, sin(uTime * 2.4 - d * 1.6)) * 0.6;
        return c + tr.g * vec3(0.2, 0.62, 1.0) * (pulse + flow) * (1.7 + spot * 1.6) + tr.g * spot * vec3(0.5, 0.8, 1.0) * 0.6;
      }
      // electrical: night, the wiring glows amber and the lights come on room by room
      vec4 mk = texture2D(tMask, uv);
      float order = vnoise(w * 0.12) * 0.7 + hash(floor(w * 0.25)) * 0.3;
      float on = smoothstep(order - 0.05, order + 0.05, uLights * 1.1 - 0.05);
      vec3 night = fin * vec3(0.19, 0.23, 0.40);
      float lights = mk.b * on;
      night += fin * lights * vec3(1.45, 1.1, 0.72) + lights * vec3(0.2, 0.12, 0.04);
      night += mk.r * vec3(0.04, 0.42, 0.58) * 0.8;
      night *= 1.0 + spot * 0.9;
      return night + tr.b * vec3(1.0, 0.72, 0.16) * pulse * (1.3 + spot * 1.8);
    }
    // design & project management: the drawing, then the build, stage by stage; work arrives in patches
    float n = vnoise(w * 0.35) * 0.65 + vnoise(w * 1.6) * 0.35;
    float k = smoothstep(n - 0.06, n + 0.06, uMix * 1.12 - 0.06);
    return mix(texture2D(tA, uv).rgb, texture2D(tB, uv).rgb, k);
  }

  void main() {
    vec2 uv = vec2(gl_FragCoord.x / (uRes.x * uDpr), 1.0 - gl_FragCoord.y / (uRes.y * uDpr));
    vec2 w = uWorld.xy + uv * uWorld.zw;
    float s = mix(uv.x, 1.0 - uv.x, uRtl);
    float edge = s - uSwitch;
    vec3 col;
    if (uSwitch >= 1.0 || uFrom == uTo) col = view(uTo, uv, w);
    else if (edge > 0.02) col = view(uFrom, uv, w);
    else if (edge < -0.02) col = view(uTo, uv, w);
    else col = mix(view(uTo, uv, w), view(uFrom, uv, w), smoothstep(-0.004, 0.004, edge));
    // the scan line: a bright terracotta seam with a soft trail
    float seam = (exp(-pow(edge * uRes.x / 1.6, 2.0)) + 0.35 * exp(-abs(edge) * uRes.x / 26.0) * step(edge, 0.0)) * step(uSwitch, 0.999) * step(0.001, uSwitch);
    col = mix(col, vec3(0.95, 0.42, 0.18), clamp(seam, 0.0, 1.0) * 0.9);
    // no frame: the plot stays solid and the land around it frays out into the page, along an uneven
    // edge traced by a thin terracotta line, so the plan sits in the contour field rather than in a card
    vec2 lo = vec2(8.0) / uWorld.zw, hi = vec2(68.0, 52.0) / uWorld.zw;
    float outM = length(max(max(lo - uv, uv - hi), 0.0) * uWorld.zw);          // metres outside the plot walls
    float fray = vnoise(w * 0.16) * 0.6 + vnoise(w * 0.55) * 0.4;
    float e = outM - (1.5 + fray * 4.5);
    float a = 1.0 - smoothstep(-1.2, 1.2, e);
    float line = exp(-pow(e / 0.3, 2.0)) * 0.85 + exp(-max(e, 0.0) / 1.2) * 0.06 * step(0.0, e);
    float s2 = line * (1.0 - a);
    gl_FragColor = vec4(col * a + vec3(0.92, 0.4, 0.16) * s2, a + s2);   // premultiplied, onto a clear canvas
  }
`;

export function createServices({ reduced = false, coarse = false, lowPower = false } = {}) {
  const root = document.querySelector('.svx');
  if (!root) return null;
  const $ = s => root.querySelector(s);
  const panel = $('.svx-panel'), canvas = $('.svx-gl'), tabs = [...root.querySelectorAll('.svx-tab')];
  const layerEl = $('.svx-layer'), legendEl = $('.svx-legend'), hintEl = $('.svx-hint'), stageEl = $('.svx-stage');
  const wipeEl = $('.svx-wipe'), timeEl = $('.svx-time'), fillEl = $('.svx-fill'), ticksEl = $('.svx-ticks');
  const descEl = Object.assign(document.createElement('p'), { className: 'svx-desc' });
  panel.after(descEl);
  let t = {}, rtl = false;
  const tr = k => t[k] ?? k;

  // ---------- renderer ----------
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true, powerPreference: 'high-performance' }); }
  catch (e) { root.classList.add('no-gl'); return { setLang() {} }; }
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  renderer.setClearColor(0x000000, 0);
  const dpr = Math.min(devicePixelRatio || 1, lowPower ? 1.5 : 2);
  renderer.setPixelRatio(dpr);

  const SS = lowPower ? 10 : 14;
  const W = Math.round(SHEET.w * SS), H = Math.round(SHEET.h * SS);
  const blank = c => { const cv = Object.assign(document.createElement('canvas'), { width: W, height: H }); const g = cv.getContext('2d'); g.fillStyle = c; g.fillRect(0, 0, W, H); return cv; };
  const tex = img => { const x = new THREE.Texture(img); x.flipY = false; x.colorSpace = THREE.NoColorSpace; x.generateMipmaps = false; x.minFilter = THREE.LinearFilter; x.needsUpdate = true; return x; };
  const paper = blank('#f7f6f2');
  const mask = document.createElement('canvas'); drawFinishedMask(mask, LAYOUT);
  // the drawing, scaled onto a canvas the size of the painted stages, so every texture keeps one size on the GPU
  const cad = Object.assign(document.createElement('canvas'), { width: W, height: H });
  { const g = cad.getContext('2d'); g.fillStyle = '#f7f6f2'; g.fillRect(0, 0, W, H);
    const im = new Image(); im.decoding = 'async'; im.src = '/film/cad-sheet.jpg';
    im.decode().then(() => { g.drawImage(im, 0, 0, W, H); cad.dirty = true; }).catch(() => {}); }
  const T = { fin: tex(paper), shell: tex(paper), tr: tex(blank('#000')), mask: tex(mask), a: tex(paper), b: tex(paper) };
  const U = {
    tFin: { value: T.fin }, tShell: { value: T.shell }, tTr: { value: T.tr }, tMask: { value: T.mask }, tA: { value: T.a }, tB: { value: T.b },
    uRes: { value: new THREE.Vector2(1, 1) }, uDpr: { value: dpr }, uTime: { value: 0 }, uRtl: { value: 0 },
    uFrom: { value: 0 }, uTo: { value: 0 }, uSwitch: { value: 1 }, uWipe: { value: 0.5 }, uMix: { value: 0 }, uLights: { value: 0 },
    uHover: { value: new THREE.Vector2(-9, -9) }, uHoverOn: { value: 0 },
    uWorld: { value: new THREE.Vector4(SHEET.x0, SHEET.z0, SHEET.w, SHEET.h) },
  };
  const scene = new THREE.Scene(), cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: U, depthTest: false })));

  // ---------- painting: the stages and the X-ray, off the main thread, only once the section is near ----------
  const stages = new Array(7).fill(null);
  const setImg = (x, img) => { x.image = img; x.needsUpdate = true; };
  function got(job, i, img) {
    if (job === 'trades') setImg(T.tr, img);
    else {
      stages[i] = img;
      if (i === 6) setImg(T.fin, img);
      if (i === 4) setImg(T.shell, img);
    }
  }
  let painting = false;
  function paint() {
    if (painting) return; painting = true;
    const order = [{ job: 'stage', i: 6 }, { job: 'stage', i: 4 }, { job: 'trades', i: 0 }, ...[0, 1, 2, 3, 5].map(i => ({ job: 'stage', i }))];
    const onMain = list => {
      const idle = window.requestIdleCallback || (fn => setTimeout(fn, 60));
      const next = () => {
        const j = list.shift(); if (!j) return;
        const c = Object.assign(document.createElement('canvas'), { width: W, height: H });
        if (j.job === 'stage') drawStage(c, LAYOUT, SS, j.i); else drawTrades(c, LAYOUT, SS);
        got(j.job, j.i, c); idle(next, { timeout: 500 });
      };
      next();
    };
    if (typeof OffscreenCanvas === 'undefined') return onMain(order);
    try {
      const worker = new Worker(new URL('./stage-worker.js', import.meta.url), { type: 'module' });
      const left = new Map(order.map(o => [`${o.job}:${o.i}`, o]));
      worker.onmessage = ({ data }) => {
        if (data.error) { worker.terminate(); onMain([...left.values()]); return; }
        left.delete(`${data.job}:${data.i}`); got(data.job, data.i, data.bmp);
        // the worker stays alive: in Chrome its images live on the GPU and die with it
      };
      worker.onerror = () => { worker.terminate(); onMain([...left.values()]); };
      order.forEach(o => worker.postMessage({ ...o, s: SS }));
    } catch (e) { onMain(order); }
  }

  // ---------- tabs ----------
  let cur = 0, from = 0, sw = 1, dwell = 0, auto = !reduced, paused = false;
  function select(i, byUser) {
    if (byUser) auto = false;
    if (i === cur) return;
    from = cur; cur = i; sw = reduced ? 1 : 0; dwell = 0; designQ = 0; lights = 0;
    tabs.forEach((b, k) => { b.setAttribute('aria-selected', k === i); b.tabIndex = k === i ? 0 : -1; b.classList.toggle('done', false); });
    panel.setAttribute('aria-labelledby', tabs[i].id);
    panel.dataset.k = KEYS[i];
    ruleEl?.style.setProperty('--s', (i / 3).toFixed(3));
    ruleEl?.querySelectorAll('.sr-ticks i').forEach((x, k) => x.classList.toggle('on', k === i));
    backdrop?.pulse();
    labels();
  }
  tabs.forEach((b, i) => {
    b.addEventListener('click', () => select(i, true));
    b.addEventListener('keydown', e => {
      const step = { ArrowDown: 1, ArrowRight: rtl ? -1 : 1, ArrowUp: -1, ArrowLeft: rtl ? 1 : -1 }[e.key];
      if (!step) return;
      e.preventDefault(); const n = (i + step + tabs.length) % tabs.length; select(n, true); tabs[n].focus();
    });
  });
  function labels() {
    const k = KEYS[cur];
    layerEl.textContent = tr(`srv.${k}.t`);
    legendEl.textContent = tr(`sx.${k}.l`);
    hintEl.textContent = tr(k === 'fin' && coarse ? 'sx.fin.h.touch' : `sx.${k}.h`);
    descEl.textContent = tr(`srv.${k}.b`);
  }

  // ---------- pointer over the panel ----------
  const hover = { x: -9, y: -9, on: false };
  let hoverOn = 0, wipe = 0.5, designQ = 0, lights = 0, tlHover = -1;
  const toUV = e => { const r = panel.getBoundingClientRect(); return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height]; };
  panel.addEventListener('pointermove', e => {
    [hover.x, hover.y] = toUV(e); hover.on = true;
    if (e.pointerType !== 'mouse' && e.buttons === 0) return;
    const r = timeEl.getBoundingClientRect();
    tlHover = KEYS[cur] === 'dpm' && e.clientY >= r.top - 12 && e.clientY <= r.bottom + 8 ? clamp(((rtl ? r.right - e.clientX : e.clientX - r.left) / r.width)) : -1;
  }, { passive: true });
  panel.addEventListener('pointerenter', () => { paused = true; });
  panel.addEventListener('pointerleave', () => { paused = false; hover.on = false; tlHover = -1; });
  panel.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse') { auto = false; [hover.x, hover.y] = toUV(e); hover.on = true; } });
  root.querySelector('.svx-tabs').addEventListener('pointerenter', () => { paused = true; });
  root.querySelector('.svx-tabs').addEventListener('pointerleave', () => { paused = false; });

  // timeline ticks: the drawing plus the seven stages
  ticksEl.innerHTML = Array.from({ length: 8 }, (_, i) => `<i style="--k:${i / 7}"></i>`).join('');

  // ---------- size ----------
  let pw = 1, ph = 1;
  function resize() {
    const r = panel.getBoundingClientRect(); pw = Math.max(1, r.width); ph = Math.max(1, r.height);
    renderer.setSize(pw, ph, false); U.uRes.value.set(pw, ph);
  }
  new ResizeObserver(resize).observe(panel);

  // ---------- frame ----------
  let running = false, last = performance.now(), shownStage = -2;
  const t0 = performance.now();
  function frame(now) {
    if (!running) return;
    requestAnimationFrame(frame);
    const dt = clamp((now - last) / 1000, 0, 0.05); last = now;
    const time = (now - t0) / 1000;
    const k = KEYS[cur];
    // the scan line between services
    sw = Math.min(1, sw + dt / 0.75);
    U.uFrom.value = from; U.uTo.value = cur; U.uSwitch.value = smooth(sw);
    // auto play: the active tab's bar fills; then the next one
    if (auto && !paused) {
      dwell += dt / DWELL[k];
      if (dwell >= 1) { select((cur + 1) % KEYS.length, false); }
    }
    tabs.forEach((b, i) => b.style.setProperty('--fill', i === cur ? (auto ? clamp(dwell) : 1).toFixed(3) : '0'));
    // hover
    hoverOn += ((hover.on ? 1 : 0) - hoverOn) * (1 - Math.exp(-dt * 8));
    U.uHover.value.set(hover.x, hover.y); U.uHoverOn.value = hoverOn;
    // finishing: the split follows the cursor, or sweeps slowly by itself
    const wt = hover.on && k === 'fin' ? clamp(rtl ? 1 - hover.x : hover.x, 0.02, 0.98) : 0.5 + 0.28 * Math.sin(time * 0.7);
    wipe += (wt - wipe) * (1 - Math.exp(-dt * (hover.on ? 14 : 3)));
    U.uWipe.value = wipe;
    wipeEl.style.setProperty('--x', `${(rtl ? 1 - wipe : wipe) * 100}%`);
    // electrical: the lights come on over a few seconds
    lights = Math.min(1, lights + dt / 3.2); U.uLights.value = k === 'ele' ? smooth(lights) : 1;
    // design: the drawing, then the seven stages; hold on each, then dissolve
    if (k === 'dpm') {
      const target = tlHover >= 0 ? tlHover * 7 : null;
      designQ = target != null ? designQ + (target - designQ) * (1 - Math.exp(-dt * 8)) : Math.min(7, designQ + dt * (7 / (DWELL.dpm - 1.2)));
      const a = Math.min(Math.floor(designQ), 6), f = designQ - a;
      const img = i => (i === 0 ? cad : stages[i - 1]) || cad;
      if (T.a.image !== img(a) || (img(a) === cad && cad.dirty)) setImg(T.a, img(a));
      if (T.b.image !== img(a + 1)) setImg(T.b, img(a + 1));
      cad.dirty = false;
      U.uMix.value = smooth(clamp((f - 0.45) / 0.55));
      const shown = Math.round(designQ);
      if (shown !== shownStage) { shownStage = shown; stageEl.textContent = shown === 0 ? tr('sx.draw') : `${String(shown).padStart(2, '0')} · ${tr(`st.${shown - 1}`)}`; }
      fillEl.style.transform = `scaleX(${(designQ / 7).toFixed(4)})`;
    }
    U.uTime.value = reduced ? 1.5 : time;
    renderer.render(scene, cam);
  }
  // ---------- the backdrop: the shared contour field (contours.js); it ripples out from the panel on each change ----------
  const section = root.closest('section'), ruleEl = section?.querySelector('.svc-rule');
  const backdrop = section ? createContours(section, { focus: panel, reduced, lowPower }) : null;

  new IntersectionObserver(([e]) => {
    if (e.isIntersecting) { paint(); if (!running) { running = true; last = performance.now(); requestAnimationFrame(frame); } }
    else running = false;
  }, { rootMargin: '300px 0px' }).observe(panel);

  panel.dataset.k = KEYS[cur];
  // links elsewhere (the footer) open a service in the explorer
  document.querySelectorAll('[data-svx]').forEach(a => a.addEventListener('click', () => select(KEYS.indexOf(a.dataset.svx), true)));
  return {
    setLang(dict, isRtl) {
      t = dict; rtl = isRtl; U.uRtl.value = rtl ? 1 : 0; shownStage = -2; labels();
      ruleEl?.style.setProperty('--s', (cur / 3).toFixed(3));
      ruleEl?.querySelectorAll('.sr-ticks i').forEach((x, k) => x.classList.toggle('on', k === cur));
    },
  };
}
