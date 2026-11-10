// Partners: "Global expertise. Local delivery." shown literally. A dot-matrix globe in night tones (land from
// Natural Earth, baked into /globe/land.png) turns slowly; an arc of light runs from the United Kingdom, home
// of DCP, to Lebanon, where DAR and HEK.HOUSE build. Hovering a partner card turns the globe to that partner's
// home and lights it; the globe can also be dragged. The partners' own figures count up when they appear.
import * as THREE from 'three';

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const UK = [51.5, -0.13], LB = [33.89, 35.5];
const toVec = ([lat, lon], r = 1) => {
  const φ = THREE.MathUtils.degToRad(90 - lat), λ = THREE.MathUtils.degToRad(lon + 180);
  return new THREE.Vector3(-r * Math.sin(φ) * Math.cos(λ), r * Math.cos(φ), r * Math.sin(φ) * Math.sin(λ));
};
// the globe's turn (about y) and tilt (about x) that bring a place to the front
const facing = ([lat, lon]) => ({ yaw: THREE.MathUtils.degToRad(-lon - 90), pitch: THREE.MathUtils.degToRad(lat) });

const DOT_VERT = /* glsl */ `
  attribute float aSeed;
  uniform float uTime, uSize, uDpr;
  uniform vec3 uFocus; uniform float uFocusOn;
  uniform vec3 uHome;            // Lebanon, always warm
  uniform vec3 uWaveFrom; uniform float uWaveAge;
  varying float vLight, vWarm, vFacing;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vec3 n = normalize(wp.xyz);
    vec4 mv = viewMatrix * wp;
    vFacing = dot(n, normalize(cameraPosition - wp.xyz));
    // twinkle, a warm pool round the focus, a home glow round Lebanon, and a wave running out over the land
    float tw = 0.75 + 0.25 * sin(uTime * (0.6 + aSeed * 1.6) + aSeed * 40.0);
    float f = exp(-pow(distance(position, uFocus) / 0.22, 2.0)) * uFocusOn;
    float home = exp(-pow(distance(position, uHome) / 0.09, 2.0));
    float d = distance(position, uWaveFrom), r = uWaveAge * 1.1;
    float wave = exp(-pow((d - r) / 0.07, 2.0)) * (1.0 - smoothstep(0.4, 1.9, uWaveAge)) * step(0.0, uWaveAge);
    vWarm = clamp(f + home + wave * 0.9, 0.0, 1.0);
    vLight = tw * (0.55 + 0.45 * vFacing) + f * 0.9 + home + wave;
    gl_PointSize = uSize * uDpr * (1.0 + vWarm * 0.8) * (4.1 / -mv.z);   // a few px, a touch larger nearer the camera
    gl_Position = projectionMatrix * mv;
  }
`;
const DOT_FRAG = /* glsl */ `
  varying float vLight, vWarm, vFacing;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float a = smoothstep(0.5, 0.18, length(c));
    vec3 cool = vec3(0.72, 0.68, 0.64), warm = vec3(1.0, 0.5, 0.22);
    vec3 col = mix(cool, warm, vWarm) * vLight;
    a *= smoothstep(-0.05, 0.35, vFacing) * (0.45 + 0.55 * clamp(vLight, 0.0, 1.0));
    if (a < 0.01) discard;
    gl_FragColor = vec4(col, a);
  }
`;
// the body: dark, with a terracotta rim of light
const BODY_VERT = /* glsl */ `
  varying vec3 vN, vV;
  void main() { vec4 wp = modelMatrix * vec4(position, 1.0); vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - wp.xyz); gl_Position = projectionMatrix * viewMatrix * wp; }
`;
const BODY_FRAG = /* glsl */ `
  varying vec3 vN, vV;
  void main() {
    float rim = pow(1.0 - max(dot(vN, vV), 0.0), 3.0);
    vec3 col = vec3(0.055, 0.052, 0.05) + vec3(0.85, 0.32, 0.12) * rim * 0.9;
    gl_FragColor = vec4(col, 1.0);
  }
`;
// the arc: a faint line with a comet of light running along it
const ARC_VERT = /* glsl */ `
  attribute float aT; varying float vT;
  void main() { vT = aT; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const ARC_FRAG = /* glsl */ `
  uniform float uHead, uOn; varying float vT;
  void main() {
    float tail = smoothstep(uHead - 0.32, uHead, vT) * step(vT, uHead + 0.002);
    float head = exp(-pow((vT - uHead) / 0.012, 2.0));
    vec3 col = mix(vec3(0.95, 0.42, 0.16), vec3(1.0, 0.85, 0.65), head);
    float a = (0.18 + tail * 0.8 + head) * uOn;
    gl_FragColor = vec4(col, a);
  }
`;

export function createPartners({ reduced = false, lowPower = false, coarse = false } = {}) {
  const root = document.querySelector('.pa-stage');
  if (!root) return null;
  const canvas = root.querySelector('.pa-globe');
  const cards = [...root.querySelectorAll('.pa-card')];
  const labels = { uk: root.querySelector('.pa-pin.uk'), lb: root.querySelector('.pa-pin.lb') };
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' }); }
  catch (e) { root.classList.add('no-gl'); countUp(); return {}; }
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  const dpr = Math.min(devicePixelRatio || 1, 2); renderer.setPixelRatio(dpr); renderer.setClearColor(0, 0);
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
  camera.position.set(0, 0, 4.1);
  const globe = new THREE.Group(); scene.add(globe);
  globe.add(new THREE.Mesh(new THREE.SphereGeometry(0.995, 72, 48), new THREE.ShaderMaterial({ vertexShader: BODY_VERT, fragmentShader: BODY_FRAG })));

  const DU = {
    uTime: { value: 0 }, uSize: { value: lowPower ? 3.4 : 2.8 }, uDpr: { value: dpr },
    uFocus: { value: new THREE.Vector3() }, uFocusOn: { value: 0 }, uHome: { value: toVec(LB) },
    uWaveFrom: { value: toVec(UK) }, uWaveAge: { value: -1 },
  };
  // land dots: an even spread over the sphere, kept where the map says land
  const img = new Image(); img.src = '/globe/land.png';
  img.decode().then(() => {
    const c = Object.assign(document.createElement('canvas'), { width: img.width, height: img.height });
    const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0);
    const px = g.getImageData(0, 0, c.width, c.height).data;
    const N = lowPower ? 16000 : 30000, pos = [], seed = [];
    const ga = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < N; i++) {
      const y = 1 - (i / (N - 1)) * 2, rr = Math.sqrt(1 - y * y), th = ga * i;
      const lat = THREE.MathUtils.radToDeg(Math.asin(y)), lon = ((THREE.MathUtils.radToDeg(th) % 360) + 540) % 360 - 180;
      const ix = Math.floor(((lon + 180) / 360) * c.width) % c.width, iy = Math.min(c.height - 1, Math.floor(((90 - lat) / 180) * c.height));
      if (px[(iy * c.width + ix) * 4] < 128) continue;
      const v = toVec([lat, lon], 1.004); pos.push(v.x, v.y, v.z); seed.push(Math.random());
      void rr;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('aSeed', new THREE.Float32BufferAttribute(seed, 1));
    globe.add(new THREE.Points(geo, new THREE.ShaderMaterial({ vertexShader: DOT_VERT, fragmentShader: DOT_FRAG, uniforms: DU, transparent: true, depthWrite: false })));
  }).catch(() => {});

  // the arc from the UK to Lebanon, lifted off the surface
  const a = toVec(UK), b = toVec(LB);
  const mid = a.clone().add(b).normalize().multiplyScalar(1.32);
  const curve = new THREE.QuadraticBezierCurve3(a.clone().multiplyScalar(1.005), mid, b.clone().multiplyScalar(1.005));
  const tube = new THREE.TubeGeometry(curve, 120, 0.0055, 6, false);
  { const n = tube.attributes.position.count, tt = new Float32Array(n), segs = 121, ring = 7;
    for (let i = 0; i < n; i++) tt[i] = Math.floor(i / ring) / (segs - 1);
    tube.setAttribute('aT', new THREE.BufferAttribute(tt, 1)); }
  const AU = { uHead: { value: 0 }, uOn: { value: 0 } };
  globe.add(new THREE.Mesh(tube, new THREE.ShaderMaterial({ vertexShader: ARC_VERT, fragmentShader: ARC_FRAG, uniforms: AU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })));
  // pulsing rings at both ends
  const ringMat = () => new THREE.MeshBasicMaterial({ color: 0xf0703a, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false });
  const rings = [UK, LB].map(p => {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.018, 0.024, 40), ringMat());
    const v = toVec(p, 1.008); m.position.copy(v); m.lookAt(v.clone().multiplyScalar(2)); globe.add(m);
    const dot = new THREE.Mesh(new THREE.CircleGeometry(0.012, 20), new THREE.MeshBasicMaterial({ color: 0xffb27a }));
    dot.position.copy(toVec(p, 1.009)); dot.lookAt(v.clone().multiplyScalar(2)); globe.add(dot);
    return m;
  });

  // ---------- turning: drift, drag with inertia, or face the hovered partner ----------
  const rest = (() => { const u = facing(UK), l = facing(LB); return { yaw: (u.yaw + l.yaw) / 2, pitch: 0.62 }; })();
  let yaw = rest.yaw + 0.9, pitch = rest.pitch, vyaw = 0, dragging = null, focus = null, lastInput = -1e9;
  root.addEventListener('pointerdown', e => {
    if (e.target.closest('.pa-card')) return;
    dragging = { x: e.clientX, y: e.clientY, yaw, pitch }; lastInput = performance.now();
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* optional */ }
  });
  addEventListener('pointermove', e => {
    if (!dragging) return;
    const k = 0.006, ny = dragging.yaw + (e.clientX - dragging.x) * k;
    vyaw = ny - yaw; yaw = ny; pitch = clamp(dragging.pitch + (e.clientY - dragging.y) * k, -0.2, 1.2); lastInput = performance.now();
  }, { passive: true });
  addEventListener('pointerup', () => { dragging = null; });
  cards.forEach(card => {
    const k = card.dataset.p;
    card.addEventListener('pointerenter', () => setFocus(k));
    card.addEventListener('pointerleave', () => setFocus(null));
    card.addEventListener('focusin', () => setFocus(k));
    card.addEventListener('focusout', () => setFocus(null));
    card.addEventListener('click', () => { if (coarse) setFocus(focus === k ? null : k); });
  });
  function setFocus(k) {
    if (k === focus) return;
    focus = k;
    cards.forEach(c => c.classList.toggle('on', c.dataset.p === k));
    root.dataset.focus = k || '';
    if (k === 'dcp') { DU.uWaveFrom.value.copy(toVec(UK)); waveAt = performance.now(); }
    if (k === 'hek') { DU.uWaveFrom.value.copy(toVec(LB)); waveAt = performance.now(); }
  }

  // ---------- the partners' own figures count up when they appear ----------
  function countUp() {
    root.querySelectorAll('[data-count]').forEach(el => {
      const to = +el.dataset.count, from = el.dataset.from ? +el.dataset.from : 0, suffix = el.dataset.suffix || '', t0 = performance.now(), dur = 1600;
      if (reduced) { el.textContent = to + suffix; return; }
      const step = now => { const p = clamp((now - t0) / dur), e = 1 - Math.pow(1 - p, 3); el.textContent = Math.round(from + (to - from) * e) + suffix; if (p < 1) requestAnimationFrame(step); };
      requestAnimationFrame(step);
    });
  }

  // ---------- size, labels, frame ----------
  function resize() {
    const r = canvas.getBoundingClientRect(); const w = Math.max(1, r.width), h = Math.max(1, r.height);
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(canvas);
  const tmp = new THREE.Vector3();
  function place(el, p) {
    tmp.copy(toVec(p, 1.02)).applyMatrix4(globe.matrixWorld);
    const front = tmp.clone().normalize().dot(camera.position.clone().sub(tmp).normalize()) > 0.12;
    tmp.project(camera);
    const r = canvas.getBoundingClientRect(), sr = root.getBoundingClientRect();
    el.style.transform = `translate(${(r.left - sr.left) + (tmp.x * 0.5 + 0.5) * r.width}px, ${(r.top - sr.top) + (-tmp.y * 0.5 + 0.5) * r.height}px)`;
    el.classList.toggle('back', !front);
    // if the label would run off the stage or under a partner card, it sits on the other side of its point
    const x = r.left + (tmp.x * 0.5 + 0.5) * r.width, y = r.top + (-tmp.y * 0.5 + 0.5) * r.height;
    const w = el.offsetWidth + 24, x0 = x, x1 = x + w;   // the chip sits to the right of its point in every language
    const blocked = x0 < sr.left + 8 || x1 > sr.right - 8 || cards.some(c => {
      const b = c.getBoundingClientRect();
      return x1 > b.left && x0 < b.right && y + 30 > b.top && y - 50 < b.bottom;
    });
    el.classList.toggle('flip', blocked);
  }

  let running = false, last = performance.now(), waveAt = -1e9, arcOn = 0, focusOn = 0, shown = false;
  const t0 = performance.now();
  function frame(now) {
    if (!running) return;
    requestAnimationFrame(frame);
    const dt = clamp((now - last) / 1000, 0, 0.05); last = now;
    const time = (now - t0) / 1000;
    // where to face
    if (!dragging) {
      if (focus) {
        const f = facing(focus === 'dcp' ? UK : LB);
        let d = f.yaw - yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
        yaw += d * (1 - Math.exp(-dt * 3)); pitch += (f.pitch - pitch) * (1 - Math.exp(-dt * 3)); vyaw = 0;
      } else if (now - lastInput > 2500) {
        // drift gently about the stretch between the two homes
        const target = rest.yaw + Math.sin(time * 0.12) * 0.7;
        let d = target - yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
        yaw += d * (1 - Math.exp(-dt * 0.6)); pitch += (rest.pitch - pitch) * (1 - Math.exp(-dt * 0.8));
      } else { yaw += vyaw; vyaw *= Math.exp(-dt * 3); }
    }
    globe.rotation.set(pitch, yaw, 0, 'XYZ');
    // focus glow and the arc
    focusOn += ((focus ? 1 : 0) - focusOn) * (1 - Math.exp(-dt * 5));
    DU.uFocusOn.value = focusOn;
    if (focus) DU.uFocus.value.copy(toVec(focus === 'dcp' ? UK : LB));
    arcOn += (1 - arcOn) * (1 - Math.exp(-dt * 1.5)); AU.uOn.value = arcOn;
    AU.uHead.value = reduced ? 1 : ((time * 0.32) % 1.35);
    DU.uWaveAge.value = (now - waveAt) / 1000;
    DU.uTime.value = reduced ? 0 : time;
    rings.forEach((m, i) => { const s = 1 + ((time * 0.8 + i * 0.5) % 1) * 2.2; m.scale.setScalar(s); m.material.opacity = 0.85 * (1 - ((time * 0.8 + i * 0.5) % 1)); });
    renderer.render(scene, camera);
    place(labels.uk, UK); place(labels.lb, LB);
  }
  new IntersectionObserver(([e]) => {
    if (e.isIntersecting) {
      if (!shown) { shown = true; countUp(); waveAt = performance.now() + 600; }
      if (!running) { running = true; resize(); last = performance.now(); requestAnimationFrame(frame); }
    } else running = false;
  }, { rootMargin: '0px 0px -15% 0px' }).observe(root);
  return {};
}
