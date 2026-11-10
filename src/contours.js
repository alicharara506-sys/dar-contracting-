// The night contour field behind the content sections: a living topographic map in the same contour language as
// the hero's land. The lines drift slowly, light up under the cursor like a lamp, glow softly round the section's
// focus element, and a ripple runs out from it when pulse() is called. Skipped on low-power devices.
import * as THREE from 'three';

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const VERT = /* glsl */ `void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const FRAG = /* glsl */ `
  precision highp float;
  uniform vec2 uRes; uniform float uDpr, uTime;
  uniform vec2 uMouse; uniform float uMouseOn;
  uniform vec4 uPanel;            // panel rect, CSS px in this canvas
  uniform vec3 uPulse;            // ripple centre (px) and its age (s)
  uniform float uWarm;            // 1 terracotta, 0 a cool steel grey
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
  }
  float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += a * vnoise(p); p = mat2(1.6, 1.2, -1.2, 1.6) * p + 7.3; a *= 0.5; } return s; }
  float sdBox(vec2 d, vec2 b) { vec2 q = abs(d) - b; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0); }
  void main() {
    vec2 p = vec2(gl_FragCoord.x, uRes.y * uDpr - gl_FragCoord.y) / uDpr;
    float h = fbm(p * 0.0024 + vec2(uTime * 0.012, -uTime * 0.008)) * 11.0 + p.y * 0.0015;
    float fw = max(fwidth(h), 1e-4);
    float minor = 1.0 - smoothstep(0.5, 1.5, abs(fract(h - 0.5) - 0.5) / fw);
    float major = 1.0 - smoothstep(0.6, 1.8, abs(fract(h / 5.0 - 0.5) - 0.5) / (fw / 5.0));
    vec3 ink = vec3(0.067), terra = mix(vec3(0.46, 0.52, 0.6), vec3(0.85, 0.31, 0.12), uWarm);
    vec3 col = ink;
    // the panel sits in a terracotta glow; lines near it a touch brighter
    vec2 pc = uPanel.xy + uPanel.zw * 0.5;
    float pd = max(sdBox(p - pc, uPanel.zw * 0.5), 0.0);
    float near = exp(-pd / 320.0);
    col += terra * 0.11 * exp(-pd / 220.0) + terra * 0.05 * near;
    float base = minor * 0.045 + major * 0.085;
    col = mix(col, vec3(1.0), base * (0.55 + 0.6 * near));
    // the cursor: a terracotta lamp over the lines
    float spot = exp(-pow(length(p - uMouse) / 240.0, 2.0)) * uMouseOn;
    col += terra * spot * 0.06;
    col = mix(col, terra * 1.3, max(minor, major * 1.2) * spot * 0.6);
    // the ripple from the panel when the service changes
    float age = uPulse.z, r = age * 820.0;
    float ring = exp(-pow((length(p - uPulse.xy) - r) / 70.0, 2.0)) * (1.0 - smoothstep(0.2, 1.7, age)) * step(0.0, age);
    col = mix(col, terra * 1.4, max(minor, major) * ring * 0.75);
    col += terra * ring * 0.035;
    col += (hash(p + fract(uTime) * 37.0) - 0.5) * 0.012;  // grain
    gl_FragColor = vec4(col, 1.0);
  }
`;


export function createContours(section, { focus = null, reduced = false, lowPower = false } = {}) {
  const canvas = section.querySelector('.sec-bg');
  if (!canvas || lowPower) return null;
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false }); } catch (e) { return null; }
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  const dpr = Math.min(devicePixelRatio || 1, 1.5); renderer.setPixelRatio(dpr);
  const U = { uRes: { value: new THREE.Vector2(1, 1) }, uDpr: { value: dpr }, uTime: { value: 0 }, uMouse: { value: new THREE.Vector2(-1e4, -1e4) }, uMouseOn: { value: 0 }, uPanel: { value: new THREE.Vector4() }, uPulse: { value: new THREE.Vector3(0, 0, -1) }, uWarm: { value: 1 } };
  const scene = new THREE.Scene(), cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: U, depthTest: false })));
  const size = () => { const r = canvas.getBoundingClientRect(); renderer.setSize(Math.max(1, r.width), Math.max(1, r.height), false); U.uRes.value.set(r.width, r.height); };
  new ResizeObserver(size).observe(section);
  const mouse = { x: -1e4, y: -1e4, on: 0, in: false };
  addEventListener('pointermove', e => { mouse.x = e.clientX; mouse.y = e.clientY; mouse.in = e.pointerType === 'mouse'; }, { passive: true });
  let on = false, last = performance.now(), pulseAt = -1e9, pulseFrom = null, warm = 1, warmTarget = 1;
  const t0 = performance.now();
  const draw = now => {
    if (!on) return; requestAnimationFrame(draw);
    const dt = clamp((now - last) / 1000, 0, 0.05); last = now;
    const r = canvas.getBoundingClientRect(), fr = (focus || section).getBoundingClientRect();
    const inside = mouse.in && mouse.y > r.top && mouse.y < r.bottom;
    mouse.on += ((inside ? 1 : 0) - mouse.on) * (1 - Math.exp(-dt * 6));
    U.uMouse.value.set(mouse.x - r.left, mouse.y - r.top); U.uMouseOn.value = mouse.on;
    U.uPanel.value.set(fr.left - r.left, fr.top - r.top, fr.width, fr.height);
    const pr = (pulseFrom || focus || section).getBoundingClientRect();
    U.uPulse.value.set(pr.left - r.left + pr.width / 2, pr.top - r.top + pr.height / 2, (now - pulseAt) / 1000);
    warm += (warmTarget - warm) * (1 - Math.exp(-dt * 3)); U.uWarm.value = warm;
    U.uTime.value = reduced ? 0 : (now - t0) / 1000;
    renderer.render(scene, cam);
  };
  new IntersectionObserver(([e]) => {
    if (e.isIntersecting && !on) { on = true; size(); last = performance.now(); requestAnimationFrame(draw); }
    else if (!e.isIntersecting) on = false;
  }).observe(section);
  return {
    pulse(from = null) { pulseFrom = from; pulseAt = performance.now(); },
    setWarm(v) { warmTarget = v; },
  };
}
