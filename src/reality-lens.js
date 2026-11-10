// Reality Lens renderer: one full-screen shader quad.
// Layers, back to front:
//   1. the hillside around the plot as a relief model in paper tones, hill-shaded by a sun that follows the
//      cursor, with contour lines that glow under it; the sheet casts a soft shadow on it. At dusk the land goes
//      moonlit blue and village lights come on across the valley;
//   2. the CAD sheet, drawn in by a plotter sweep on load;
//   3. inside the lens: the site at the stage chosen on the time dial (patchy dissolve between stages),
//      magnified like a loupe with edge refraction and chromatic fringing; live caustics in the pool and a
//      slight sway in the trees; optional dusk grade with lights; optional X-ray of one trade;
//   4. CAD crosshair lines running out from the lens rim.
import * as THREE from 'three';
import { SHEET } from './plan-drawing.js';

const VERT = /* glsl */ `
  void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const FRAG = /* glsl */ `
  precision highp float;
  uniform sampler2D tPlan, tA, tB, tMask, tTrades, tLand, tPhoto;
  uniform float uMix;       // dissolve from stage A to stage B, 0..1
  uniform float uFinished;  // how much of the visible stage is the finished villa (lights, water)
  uniform vec3 uTrade;      // X-ray weights: structure, plumbing, electrical
  uniform float uDusk;
  uniform vec2 uRes;        // viewport, CSS px
  uniform float uDpr;
  uniform vec4 uSheet;      // sheet rect on screen: x, y, w, h (CSS px)
  uniform vec4 uWorld;      // sheet in world metres: x0, z0, w, h
  uniform vec2 uLens;       // lens centre, CSS px
  uniform float uR;         // lens radius, CSS px
  uniform float uZoom;      // loupe magnification (1 = none)
  uniform float uBarrel;    // edge refraction strength
  uniform float uCross;     // crosshair opacity
  uniform float uDraw;      // plotter sweep 0..1
  uniform float uRtl;       // 1 in Arabic: the plotter runs right to left
  uniform float uGrid;      // land fade-in 0..1 (and out, for the hand-off to the film)
  uniform vec2 uSun;        // sun direction across the screen (x right, y down); follows the cursor
  uniform vec2 uMouse;      // cursor, CSS px
  uniform mat3 uH;          // screen (CSS px) -> sheet uv; a plain scale and offset until the drawing starts to land
  uniform float uT;         // scroll hand-off 0..1: the drawing lands on the real plot, then becomes the photo
  uniform vec4 uPhoto;      // where the film's first frame sits on screen: x, y, w, h (CSS px)
  uniform float uTime;
  uniform vec3 uPaper, uInk, uAccent;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

  // cheap tileable water caustics
  float caustic(vec2 p, float t) {
    vec2 i = p; float c = 1.0; float inten = 0.005;
    for (int n = 0; n < 4; n++) {
      float tt = t * (1.0 - (3.5 / float(n + 1)));
      i = p + vec2(cos(tt - i.x) + sin(tt + i.y), sin(tt - i.y) + cos(tt + i.x));
      c += 1.0 / length(vec2(p.x / (sin(i.x + tt) / inten), p.y / (cos(i.y + tt) / inten)));
    }
    c /= 4.0; c = 1.17 - pow(max(c, 0.0), 1.4);
    return clamp(pow(abs(c), 8.0), 0.0, 1.0);
  }

  float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
  }
  // stage A -> B: material arrives in patches, like work progressing across the site
  float dissolve(vec2 w) {
    float n = vnoise(w * 0.35) * 0.65 + vnoise(w * 1.6) * 0.35;
    return smoothstep(n - 0.06, n + 0.06, uMix * 1.12 - 0.06);
  }
  vec3 stageAt(vec2 uv, float k) { return mix(texture2D(tA, uv).rgb, texture2D(tB, uv).rgb, k); }

  float sdBox(vec2 d, vec2 b) { vec2 q = abs(d) - b; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0); }

  bool inside01(vec2 uv) { return uv.x >= 0.0 && uv.y >= 0.0 && uv.x <= 1.0 && uv.y <= 1.0; }

  void main() {
    vec2 p = vec2(gl_FragCoord.x, uRes.y * uDpr - gl_FragCoord.y) / uDpr; // CSS px, origin top-left
    vec3 hp = uH * vec3(p, 1.0);
    vec2 uv = hp.xy / hp.z;                       // the sheet plane, possibly tilted in perspective
    vec2 world = uWorld.xy + uv * uWorld.zw;
    float pxm = 1.0 / max(length(dFdx(world)) * uDpr, 1e-4); // CSS px per metre, here
    float d = length(p - uLens);

    // ---- 1. the land around the sheet: a relief model of the hillside, lit by a sun that follows the cursor ----
    vec2 q = (p / uRes - 0.5) * vec2(uRes.x / uRes.y, 1.0);
    float vignette = smoothstep(1.05, 0.15, length(q * vec2(0.85, 1.15)));
    // the land rises outward from the sheet on load
    float reach = smoothstep(uGrid * 1.7, uGrid * 1.7 - 0.45, length((uv - 0.5) * vec2(1.0, 0.8))) * uGrid;
    // distances to the sheet are measured on the sheet plane, so shadows and fades tilt with it
    vec2 hs = uSheet.zw * 0.5, sp = (uv - 0.5) * uSheet.zw;
    float near = exp(-max(sdBox(sp, hs), 0.0) / (uSheet.z * 0.45)); // the model is crisp around the sheet, calm at the edges
    vec2 flatP = uSheet.xy + uv * uSheet.zw;                            // where this point of the plane sat before tilting
    vec4 land4 = texture2D(tLand, vec2(flatP.x / uRes.x, 1.0 - flatP.y / uRes.y)); // baked once per layout: height, slope
    float h0 = land4.r;
    float relief = 1.1 * reach * mix(0.3, 1.0, near);
    vec3 n = normalize(vec3(-land4.g * relief, -land4.b * relief, 1.0));
    vec3 L = normalize(vec3(uSun, 0.8));
    float lit = dot(n, L);
    float shade = lit - L.z;                                   // < 0 turned away from the sun, > 0 facing it
    float nightK = uDusk * uGrid;
    // day: warm paper, slopes in warm shadow and soft highlight, valleys a touch deeper
    vec3 day = uPaper;
    day = mix(day, day * vec3(0.82, 0.76, 0.68), smoothstep(0.0, 0.5, -shade) * 0.5);
    day = mix(day, vec3(1.0, 0.997, 0.99), smoothstep(0.0, 0.3, shade) * 0.55);
    day *= 1.0 - 0.04 * smoothstep(0.0, -40.0, h0) * reach;
    day += vec3(0.03, 0.018, 0.0) * dot(normalize(q + 1e-4), uSun) * smoothstep(0.1, 0.9, length(q)) * reach; // sun side warmer
    // night: moonlit blue land
    vec3 night = vec3(0.07, 0.09, 0.145) * (0.55 + 1.6 * clamp(lit, 0.0, 1.0)) + vec3(0.0, 0.004, 0.012);
    night *= 1.0 - 0.25 * smoothstep(0.0, -40.0, h0);
    vec3 col = mix(uPaper, mix(day, night, uDusk), reach);
    col = mix(uPaper, col, max(reach, nightK));
    // contour lines every 3 m, a heavier one every 15 m; they glow terracotta under the cursor
    float hc = h0 / 3.0, fw = max(fwidth(hc), 1e-4);
    float cl = 1.0 - smoothstep(0.5, 1.5, abs(fract(hc - 0.5) - 0.5) / fw);
    float hi = h0 / 15.0, fwi = max(fwidth(hi), 1e-4);
    float ci = 1.0 - smoothstep(0.6, 1.8, abs(fract(hi - 0.5) - 0.5) / fwi);
    float spot = exp(-pow(length(p - uMouse) / 230.0, 2.0));
    vec3 lineC = mix(uInk, vec3(0.75, 0.84, 1.0), uDusk);
    float la = max(cl * 0.07, ci * 0.13) * mix(0.45, 1.0, near) * reach;
    col = mix(col, lineC, la * (1.0 - spot * 0.6));
    col = mix(col, uAccent * mix(1.0, 1.25, uDusk), max(cl, ci) * spot * 0.55 * reach);
    // village lights across the valley at night
    if (nightK > 0.01) {
      vec2 gc = world / 6.0, ci0 = floor(gc);
      float glowL = 0.0;
      for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
        vec2 c = ci0 + vec2(float(i), float(j));
        float r1 = hash(c), r2 = hash(c + 17.17), r3 = hash(c + 41.3);
        vec2 cw = (c + vec2(r1, r2)) * 6.0;
        float town = max(smoothstep(0.4, 0.62, vnoise(cw * 0.03 + 5.0)) * smoothstep(30.0, -10.0, h0), 0.07);
        if (r3 > town * 0.95) continue;
        float dpx = length(world - cw) * pxm;
        float tw = 0.75 + 0.25 * sin(uTime * (1.5 + r1 * 3.0) + r2 * 40.0);
        glowL += (exp(-dpx * dpx / 2.2) + exp(-dpx / 7.0) * 0.18) * tw * (0.6 + r1 * 0.6);
      }
      col += glowL * vec3(1.0, 0.72, 0.38) * nightK * reach;
    }

    // ---- 2. CAD sheet with plotter sweep ----
    // no hard rectangle: the paper frays into the land along an uneven edge traced by a thin terracotta line
    // (the same language as the Services plan); the drawing itself sits well inside the fray
    float dEdge = min(min(uv.x, 1.0 - uv.x) * uWorld.z, min(uv.y, 1.0 - uv.y) * uWorld.w);   // metres in from the sheet edge
    float frayN = vnoise(world * 0.07 + 3.0) * 0.7 + vnoise(world * 0.2) * 0.3;
    float fe = (0.4 + frayN * 2.6) - dEdge;                  // > 0: torn away, < 0: paper
    float paperA = 1.0 - smoothstep(-0.7, 0.7, fe);           // a soft fade, not a cut
    if (inside01(uv) && paperA > 0.0) {
      vec3 plan = texture2D(tPlan, uv).rgb;
      vec3 sheetC = mix(uPaper, uPaper * vec3(0.97, 0.94, 0.87), nightK);  // at night the sheet sits under a warm desk lamp
      float sx = mix(uv.x, 1.0 - uv.x, uRtl);
      float drawn = step(sx, uDraw);
      vec3 paper = mix(sheetC, sheetC * min(plan / uPaper, vec3(1.0)), drawn);
      float head = (1.0 - smoothstep(0.0, 2.0, abs(sx - uDraw) * uSheet.z)) * step(uDraw, 0.999) * step(0.001, uDraw);
      paper = mix(paper, uAccent, head);
      col = mix(col, paper, paperA);
    }
    // the torn edge: a thin terracotta line and a soft shadow on the land just outside it
    float onLand = step(0.0, fe) * reach;
    col *= 1.0 - 0.06 * exp(-max(fe, 0.0) * 1.2) * onLand;
    col = mix(col, uAccent, exp(-pow(fe * pxm / 0.9, 2.0)) * 0.45 * reach);   // ~1 px wide at any zoom

    // ---- 3. the lens ----
    if (uR > 0.5) {
      float k = clamp(d / uR, 0.0, 1.0);
      vec2 luv = (uLens - uSheet.xy) / uSheet.zw;
      float scale = (1.0 / uZoom) * (1.0 + uBarrel * k * k * k);   // fisheye: less magnified at the rim
      vec2 ruv = luv + (uv - luv) * scale;
      vec4 m = texture2D(tMask, ruv);
      // canopy sway and water wobble
      ruv += m.g * 0.0006 * vec2(sin(uTime * 1.1 + ruv.y * 90.0), cos(uTime * 0.9 + ruv.x * 70.0));
      ruv += m.r * 0.0009 * vec2(sin(uTime * 1.8 + ruv.y * 320.0), cos(uTime * 1.5 + ruv.x * 260.0));
      float edge = smoothstep(0.72, 1.0, k);
      vec2 dir = (ruv - luv);
      vec2 rw = uWorld.xy + ruv * uWorld.zw;
      float dk = dissolve(rw);
      vec3 real;
      real.r = stageAt(ruv + dir * 0.018 * edge, dk).r;
      real.g = stageAt(ruv, dk).g;
      real.b = stageAt(ruv - dir * 0.018 * edge, dk).b;
      float caus = caustic(mod(rw * 0.9, 6.28318) - 250.0, uTime * 0.55);
      real += m.r * uFinished * caus * 0.45 * vec3(0.85, 1.0, 1.0);
      // dusk: blue hour grade, then the lights come on (only once the villa is finished)
      vec3 night = real * vec3(0.19, 0.23, 0.40);
      float lights = m.b * uFinished;
      night += real * lights * vec3(1.45, 1.1, 0.72) + lights * vec3(0.2, 0.12, 0.04);
      night += m.r * uFinished * vec3(0.04, 0.42, 0.58) * (0.75 + caus * 0.8);
      real = mix(real, night, uDusk);
      // X-ray by trade: the site goes dark and the chosen services glow, with current pulsing outward
      float xr = max(uTrade.x, max(uTrade.y, uTrade.z));
      if (xr > 0.001) {
        vec3 tr = texture2D(tTrades, ruv).rgb;
        float pulse = 0.7 + 0.3 * sin(uTime * 3.0 - length(rw - vec2(8.6, -9.4)) * 0.9);
        vec3 ghost = vec3(dot(real, vec3(0.299, 0.587, 0.114))) * vec3(0.16, 0.19, 0.25) + vec3(0.035, 0.045, 0.07);
        vec3 glowc = tr.r * uTrade.x * vec3(0.92, 0.95, 1.0) + tr.g * uTrade.y * vec3(0.2, 0.62, 1.0) * pulse + tr.b * uTrade.z * vec3(1.0, 0.72, 0.16) * pulse;
        real = mix(real, ghost, xr) + glowc * 1.9;
      }
      real *= 1.0 - 0.18 * pow(k, 6.0);                          // glass darkens at the rim
      real += (1.0 - smoothstep(0.0, 0.9, length(p - uLens - vec2(-0.35, -0.45) * uR) / uR)) * 0.06; // soft highlight
      float inLens = 1.0 - smoothstep(uR - 1.0, uR + 0.5, d);
      vec2 e2 = min(ruv, 1.0 - ruv);
      float feather = smoothstep(0.0, 0.035, min(e2.x, e2.y * 1.27));   // the as-built sheet fades into the paper at its edges
      col = mix(col, real, inLens * feather);
      // contact shadow just outside the rim
      col *= 1.0 - 0.14 * step(uR, d) * exp(-max(d - uR, 0.0) / 9.0);
      // ---- 4. crosshair from the rim outward ----
      float dashX = step(0.45, fract(p.x / 7.0)), dashY = step(0.45, fract(p.y / 7.0));
      float lx = (1.0 - smoothstep(0.0, 1.0, abs(p.x - uLens.x))) * dashY;
      float ly = (1.0 - smoothstep(0.0, 1.0, abs(p.y - uLens.y))) * dashX;
      float outside = smoothstep(uR + 14.0, uR + 30.0, d);
      col = mix(col, uInk, max(lx, ly) * outside * uCross * 0.22 * vignette);
    }

    // a little afternoon shade: leaves of a tree just off the top corner, swaying, by day only
    vec2 lp = p / 240.0; float sway = sin(uTime * 0.55) * 0.12 + sin(uTime * 1.3) * 0.03;
    float leaves = vnoise(lp * 2.6 + vec2(sway, sway * 0.5) + 3.0) * 0.6 + vnoise(lp * 6.5 + vec2(-sway * 1.6, sway) + 9.0) * 0.4;
    vec2 corner = vec2(mix(uRes.x, 0.0, uRtl), 0.0);
    float canopy = smoothstep(0.85, 0.1, length((p - corner) / uRes.y));
    col *= 1.0 - smoothstep(0.5, 0.64, leaves) * canopy * 0.085 * (1.0 - uDusk) * uGrid * (1.0 - uT);

    // ---- 5. hand-off: the drawing has landed on the real plot; the land around turns into the real
    // hillside (farthest first), then the paper burns away from the villa outward, leaving its ink lines
    // glowing on the ground for a moment, over the chalk marks they were set out from ----
    if (uT > 0.0) {
      vec2 puv = (p - uPhoto.xy) / uPhoto.zw;
      vec3 photo = inside01(puv) ? texture2D(tPhoto, puv).rgb : vec3(0.051);
      float nz = vnoise(p / 70.0) * 0.65 + vnoise(p / 24.0) * 0.35;
      vec2 plotLo = vec2(8.0, 8.0) / uWorld.zw, plotHi = vec2(68.0, 52.0) / uWorld.zw; // the plot walls on the sheet
      vec2 pd = max(max(plotLo - uv, uv - plotHi), 0.0) * uSheet.zw;
      float outside = length(pd);
      float inPlot = 1.0 - smoothstep(0.0, 2.0, outside);
      float thOut = 0.12 + 0.3 * clamp(1.0 - outside / (uSheet.z * 0.55), 0.0, 1.0);
      float thIn = 0.44 + 0.36 * length((uv - vec2(0.5, 0.36)) * vec2(1.27, 1.0)) / 0.95;
      float th = mix(thOut, thIn, inPlot);
      float fr = uT + (nz - 0.5) * 0.08 - th;
      float rv = smoothstep(-0.025, 0.025, fr);
      float fpx = abs(fr) / max(fwidth(fr), 1e-5);      // distance to the edge in pixels
      // the drawing's ink, projected as light onto the ground; it fades as the photo settles
      vec3 plan = texture2D(tPlan, clamp(uv, 0.0, 1.0)).rgb;
      float ink = smoothstep(0.1, 0.5, 1.0 - dot(plan, vec3(0.3333)) / 0.96) * inPlot * step(0.0, min(min(uv.x, uv.y), 1.0 - max(uv.x, uv.y)));
      float lf = 1.0 - smoothstep(0.8, 0.96, uT);
      vec3 landed = photo + ink * lf * vec3(1.0, 0.96, 0.9) * 0.85;
      // a thin terracotta seam runs along the edge where paper turns into ground
      float front = exp(-fpx * fpx / 3.0) * 0.8 + 0.12 * exp(-fpx / 5.0); // a 2-3 px line with a little glow
      col = mix(col, landed, rv);
      col = mix(col, uAccent * 1.15 + vec3(0.08, 0.05, 0.0), clamp(front, 0.0, 1.0) * 0.9 * step(0.0005, uT) * (1.0 - smoothstep(0.9, 1.0, uT)));
    }

    // paper grain
    col += (hash(p + fract(uTime) * 61.0) - 0.5) * 0.018 * (1.0 - uT);
    gl_FragColor = vec4(col, 1.0);
  }
`;

// the land pass: height and slope of the hillside under each screen pixel, rendered only when the layout changes
const LAND_FRAG = /* glsl */ `
  precision highp float;
  uniform vec2 uRes; uniform vec4 uSheet, uWorld;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

  float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
  }

  float fbm(vec2 p) {
    float s = 0.0, a = 0.5;
    for (int i = 0; i < OCT; i++) { s += a * vnoise(p); p = mat2(1.6, 1.2, -1.2, 1.6) * p + 7.3; a *= 0.5; }
    return s;
  }
  // the hillside in metres: a general fall to the south-west (towards the valley and the coast), hills and ridges
  float land(vec2 w) {
    float h = 0.16 * w.x - 0.24 * w.y + 30.0 * fbm(w * 0.009 + 3.1);
    float r = 1.0 - abs(vnoise(w * 0.02 + 11.0) * 2.0 - 1.0);  // long ridges and gullies
    return h + 9.0 * r * r + 1.2 * vnoise(w * 0.11);           // and a little texture

  }
  void main() {
    vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
    vec2 world = uWorld.xy + (p - uSheet.xy) / uSheet.zw * uWorld.zw;
    float e = 1.0, h = land(world);
    gl_FragColor = vec4(h, (land(world + vec2(e, 0.0)) - h) / e, (land(world + vec2(0.0, e)) - h) / e, 1.0);
  }
`;

// colours go to the shader as raw sRGB values (no linear conversion), to match the canvases exactly
const hex = c => { const n = parseInt(c.slice(1), 16); return new THREE.Vector3((n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255); };

export function createRealityLens(canvas, { plan, stage, mask, trades, photo, lowPower = false }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace; // canvases are already in display colour: pass through
  const dpr = Math.min(devicePixelRatio || 1, lowPower ? 1.5 : 2);
  renderer.setPixelRatio(dpr);

  const tex = c => {
    const t = new THREE.CanvasTexture(c);
    t.flipY = false; t.colorSpace = THREE.NoColorSpace;
    t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    return t;
  };
  // tA and tB hold the two stages either side of the dial; their canvases are swapped in, all the same size
  const tPlan = tex(plan), tA = tex(stage), tB = tex(stage), tMask = tex(mask), tTrades = tex(trades), tPhoto = tex(photo);

  const uniforms = {
    tPlan: { value: tPlan }, tA: { value: tA }, tB: { value: tB }, tMask: { value: tMask }, tTrades: { value: tTrades },
    uMix: { value: 0 }, uFinished: { value: 1 }, uTrade: { value: new THREE.Vector3() }, uDusk: { value: 0 },
    uRes: { value: new THREE.Vector2(1, 1) }, uDpr: { value: dpr },
    uSheet: { value: new THREE.Vector4(0, 0, 1, 1) },
    uWorld: { value: new THREE.Vector4(SHEET.x0, SHEET.z0, SHEET.w, SHEET.h) },
    uLens: { value: new THREE.Vector2(-999, -999) }, uR: { value: 0 },
    uZoom: { value: 1.25 }, uBarrel: { value: 0.12 }, uCross: { value: 1 },
    uDraw: { value: 0 }, uRtl: { value: 0 }, uGrid: { value: 0 }, uTime: { value: 0 },
    uH: { value: new THREE.Matrix3() }, uT: { value: 0 }, uPhoto: { value: new THREE.Vector4(0, 0, 1, 1) }, tPhoto: { value: tPhoto },
    uSun: { value: new THREE.Vector2(-0.6, -0.5) }, uMouse: { value: new THREE.Vector2(-1e4, -1e4) },
    uPaper: { value: hex('#f7f6f2') }, uInk: { value: hex('#1b1b1b') }, uAccent: { value: hex('#d94f1e') },
  };
  const landRT = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, format: THREE.RGBAFormat, depthBuffer: false });
  uniforms.tLand = { value: landRT.texture };
  const landU = { uRes: { value: new THREE.Vector2(1, 1) }, uSheet: { value: new THREE.Vector4() }, uWorld: uniforms.uWorld };
  const landScene = new THREE.Scene();
  landScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: LAND_FRAG, uniforms: landU, depthTest: false, defines: { OCT: lowPower ? 4 : 5 } })));
  const landKey = new THREE.Vector4(-1);
  const scene = new THREE.Scene();
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms, depthTest: false, defines: { OCT: lowPower ? 4 : 5 } })));

  function resize(w, h) { renderer.setSize(w, h, false); uniforms.uRes.value.set(w, h); }
  return {
    uniforms,
    resize,
    refresh(which) { ({ plan: tPlan, mask: tMask, trades: tTrades })[which].needsUpdate = true; },
    // point slot A or B at a stage canvas (same size as the others, so the GPU texture is reused)
    // img: a canvas or an ImageBitmap from the stage worker, all the same size
    setStage(slot, img) { const t = slot === 'A' ? tA : tB; if (t.image !== img || img.dirty) { t.image = img; t.needsUpdate = true; img.dirty = false; } },
    setTradesImage(img) { if (tTrades.image !== img || img.dirty) { tTrades.image = img; tTrades.needsUpdate = true; img.dirty = false; } },
    dispose() { landRT.dispose(); renderer.dispose(); },
    render(t) {
      uniforms.uTime.value = t;
      const sh = uniforms.uSheet.value, res = uniforms.uRes.value;
      if (!landKey.equals(sh) || landU.uRes.value.x !== res.x || landU.uRes.value.y !== res.y) {
        // one CSS px per texel is plenty: the land is smooth and the GPU filters it
        landKey.copy(sh); landU.uSheet.value.copy(sh); landU.uRes.value.copy(res);
        landRT.setSize(Math.max(1, Math.round(res.x)), Math.max(1, Math.round(res.y)));
        renderer.setRenderTarget(landRT); renderer.render(landScene, cam); renderer.setRenderTarget(null);
      }
      renderer.render(scene, cam);
    },
  };
}
