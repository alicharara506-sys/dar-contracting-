// The "as built" sheet: the same site plan as plan-drawing.js, painted as an architect's rendered
// presentation plan (materials, water, lawn, trees and soft sun shadows). It uses the same world
// coordinates and the same SHEET frame, so laid over the CAD drawing it lines up to the centimetre.
// The Reality Lens on the hero shows this sheet through the drawing.
//
// drawFinishedPlan() paints the colour sheet. drawFinishedMask() paints a small mask for the shader:
// red = pool water (animated caustics), green = tree canopies (gentle sway).
import { SHEET, drawSitePlan } from './plan-drawing.js';
import { TREES, HEDGE } from './layout.js';

// Works on the page and inside the stage worker (no document there: OffscreenCanvas instead).
export const newCanvas = () => (typeof document !== 'undefined' ? document.createElement('canvas') : new OffscreenCanvas(1, 1));

const SUN = [0.9, 1.15]; // shadow offset in metres: sun from the north-west, shadows fall south-east

// Paint helpers in world metres, shared by the finished plan and the construction stages (plan-stages.js).
export function painter(canvas, s, seed = 11) {
  const { x0, z0, w, h } = SHEET;
  canvas.width = Math.round(w * s); canvas.height = Math.round(h * s);
  const g = canvas.getContext('2d');
  if (!g.roundRect) g.roundRect = function (x, y, w, h) { this.rect(x, y, w, h); };
  const X = x => (x - x0) * s, Y = z => (z - z0) * s, M = m => m * s;
  const r = mulberry(seed);

  const fill = (ax, bx, az, bz, c) => { g.fillStyle = c; g.fillRect(X(ax), Y(az), M(bx - ax), M(bz - az)); };
  const rect = (ax, bx, az, bz, c, wd) => { g.strokeStyle = c; g.lineWidth = Math.max(1, M(wd)); g.strokeRect(X(ax), Y(az), M(bx - ax), M(bz - az)); };
  const line = (ax, az, bx, bz, c, wd) => { g.strokeStyle = c; g.lineWidth = Math.max(1, M(wd)); g.beginPath(); g.moveTo(X(ax), Y(az)); g.lineTo(X(bx), Y(bz)); g.stroke(); };
  const circle = (cx, cz, rad, c) => { g.fillStyle = c; g.beginPath(); g.arc(X(cx), Y(cz), M(rad), 0, Math.PI * 2); g.fill(); };
  const clip = (ax, bx, az, bz, fn) => { g.save(); g.beginPath(); g.rect(X(ax), Y(az), M(bx - ax), M(bz - az)); g.clip(); fn(); g.restore(); };
  // speckle noise: n dots of colour c inside a rect
  const speckle = (ax, bx, az, bz, n, c, size = 0.08) => {
    g.fillStyle = c;
    for (let i = 0; i < n; i++) { const x = ax + r() * (bx - ax), z = az + r() * (bz - az); g.fillRect(X(x), Y(z), M(size), M(size)); }
  };
  // soft shadow of a rect or circle, cast by the sun
  const shadowRect = (ax, bx, az, bz, k = 1, a = 0.28) => {
    g.save(); g.filter = `blur(${M(0.35)}px)`; g.fillStyle = `rgba(30,32,24,${a})`;
    g.fillRect(X(ax + SUN[0] * k), Y(az + SUN[1] * k), M(bx - ax), M(bz - az)); g.restore();
  };
  const shadowCircle = (cx, cz, rad, k = 1, a = 0.3) => {
    g.save(); g.filter = `blur(${M(0.4)}px)`; circle(cx + SUN[0] * k, cz + SUN[1] * k, rad, `rgba(28,34,20,${a})`); g.restore();
  };
  // tiled floor: base colour, joints every (tx, tz) m, slight tone variation per tile
  const tiles = (ax, bx, az, bz, tx, tz, base, joint, vary = 0.04) => {
    fill(ax, bx, az, bz, base);
    clip(ax, bx, az, bz, () => {
      for (let x = ax; x < bx; x += tx) for (let z = az; z < bz; z += tz) {
        const v = (r() - 0.5) * vary; g.fillStyle = v > 0 ? `rgba(255,255,255,${v})` : `rgba(0,0,0,${-v})`;
        g.fillRect(X(x), Y(z), M(tx), M(tz));
      }
      g.strokeStyle = joint; g.lineWidth = Math.max(0.6, M(0.015)); g.beginPath();
      for (let x = ax; x <= bx; x += tx) { g.moveTo(X(x), Y(az)); g.lineTo(X(x), Y(bz)); }
      for (let z = az; z <= bz; z += tz) { g.moveTo(X(ax), Y(z)); g.lineTo(X(bx), Y(z)); }
      g.stroke();
    });
  };
  // marble: warm white with soft grey veins
  const marble = (ax, bx, az, bz) => {
    tiles(ax, bx, az, bz, 1.2, 1.2, '#efe9e0', 'rgba(150,140,125,0.35)', 0.03);
    clip(ax, bx, az, bz, () => {
      g.lineCap = 'round';
      for (let i = 0; i < (bx - ax) * (bz - az) * 0.35; i++) {
        const x = ax + r() * (bx - ax), z = az + r() * (bz - az), len = 1 + r() * 3, a = r() * Math.PI;
        g.strokeStyle = `rgba(120,112,100,${0.06 + r() * 0.1})`; g.lineWidth = Math.max(0.5, M(0.02 + r() * 0.03));
        g.beginPath(); g.moveTo(X(x), Y(z));
        g.bezierCurveTo(X(x + Math.cos(a) * len * 0.3 + (r() - 0.5)), Y(z + Math.sin(a) * len * 0.3 + (r() - 0.5)), X(x + Math.cos(a) * len * 0.7 + (r() - 0.5)), Y(z + Math.sin(a) * len * 0.7), X(x + Math.cos(a) * len), Y(z + Math.sin(a) * len));
        g.stroke();
      }
    });
  };
  // oak planks running along x
  const oak = (ax, bx, az, bz) => {
    fill(ax, bx, az, bz, '#c99a68');
    clip(ax, bx, az, bz, () => {
      for (let z = az; z < bz; z += 0.2) {
        let x = ax - r() * 2;
        while (x < bx) {
          const len = 1.2 + r() * 1.2, v = (r() - 0.5) * 0.12;
          g.fillStyle = v > 0 ? `rgba(255,236,200,${v})` : `rgba(70,40,15,${-v})`;
          g.fillRect(X(x), Y(z), M(len), M(0.2));
          line(x, z, x, z + 0.2, 'rgba(90,55,25,0.35)', 0.012);
          x += len;
        }
        line(ax, z, bx, z, 'rgba(90,55,25,0.3)', 0.01);
      }
    });
  };
  const lawn = (ax, bx, az, bz, base = '#86a25c', stripe = 2.2) => {
    fill(ax, bx, az, bz, base);
    clip(ax, bx, az, bz, () => {
      for (let x = ax, i = 0; x < bx; x += stripe, i++) if (i % 2) fill(x, x + stripe, az, bz, 'rgba(255,255,220,0.06)');
      speckle(ax, bx, az, bz, (bx - ax) * (bz - az) * 22, 'rgba(60,80,30,0.18)', 0.07);
      speckle(ax, bx, az, bz, (bx - ax) * (bz - az) * 10, 'rgba(220,235,170,0.16)', 0.06);
    });
  };
  const stone = (ax, bx, az, bz) => { // dry-laid stone: random blocks
    fill(ax, bx, az, bz, '#b9a98a');
    clip(ax, bx, az, bz, () => {
      const horiz = bx - ax > bz - az;
      for (let a = horiz ? ax : az; a < (horiz ? bx : bz); a += 0.35 + r() * 0.5) {
        const v = (r() - 0.5) * 0.25; g.fillStyle = v > 0 ? `rgba(255,245,220,${v})` : `rgba(60,45,25,${-v})`;
        if (horiz) { g.fillRect(X(a), Y(az), M(0.6), M(bz - az)); line(a, az, a, bz, 'rgba(70,58,40,0.45)', 0.02); }
        else { g.fillRect(X(ax), Y(a), M(bx - ax), M(0.6)); line(ax, a, bx, a, 'rgba(70,58,40,0.45)', 0.02); }
      }
    });
  };

  return { g, s, X, Y, M, r, fill, rect, line, circle, clip, speckle, shadowRect, shadowCircle, tiles, marble, oak, lawn, stone };
}

// Land around the plot (dry hillside, scrub) and the road along the south boundary.
export function paintGround(P, L) {
  const { x0, z0, w, h } = SHEET;
  const { r, fill, speckle, circle, shadowCircle } = P;
  // ---------- land around the plot: dry Lebanese hillside, scrub and stones ----------
  fill(x0, x0 + w, z0, z0 + h, '#d3c6a6');
  speckle(x0, x0 + w, z0, z0 + h, w * h * 6, 'rgba(120,100,60,0.18)', 0.12);
  speckle(x0, x0 + w, z0, z0 + h, w * h * 3, 'rgba(255,250,235,0.25)', 0.1);
  for (let i = 0; i < 110; i++) { // scrub
    const x = x0 + r() * w, z = z0 + r() * h;
    if (x > L.PLOT[0] - 1 && x < L.PLOT[1] + 1 && z > L.PLOT[2] - 1 && z < L.PLOT[3] + 1) continue;
    const rad = 0.2 + r() * 0.45; shadowCircle(x, z, rad, 0.4, 0.2); circle(x, z, rad, `rgba(${100 + r() * 30},${112 + r() * 20},${70 + r() * 15},0.85)`);
  }
  // road along the south boundary
  const [px0, px1, pz0, pz1] = L.PLOT;
  fill(x0, x0 + w, pz1 + 0.4, pz1 + 4.6, '#5d5c58');
  speckle(x0, x0 + w, pz1 + 0.4, pz1 + 4.6, w * 4 * 14, 'rgba(255,255,255,0.08)', 0.06);
  for (let x = x0; x < x0 + w; x += 3) fill(x, x + 1.6, pz1 + 2.45, pz1 + 2.55, 'rgba(240,230,200,0.75)');

}

export function drawFinishedPlan(canvas, L, s) {
  const P = painter(canvas, s);
  const { g, X, Y, M, r, fill, rect, line, circle, clip, speckle, shadowRect, shadowCircle, tiles, marble, oak, lawn, stone } = P;
  paintGround(P, L);
  const [px0, px1, pz0, pz1] = L.PLOT;

  // ---------- the plot: lawn on every terrace ----------
  lawn(px0, px1, pz0, pz1);
  lawn(-17, 15.6, 11.7, pz1, '#7d9a55'); // garden terrace, one level down: a touch deeper green

  // ---------- driveway: interlocking pavers ----------
  const [dx0, dx1, ddz0, dz1] = L.DRIVE;
  tiles(dx0, dx1, ddz0, dz1 + 0.6, 0.3, 0.6, '#aaa49a', 'rgba(70,65,58,0.35)', 0.07);
  fill(dx0 - 0.2, dx0, ddz0, dz1, '#e7e2d8'); fill(dx1, dx1 + 0.2, ddz0, dz1, '#e7e2d8'); // kerbs
  // sliding gate
  fill(dx0, dx1, pz1 - 0.08, pz1 + 0.08, '#2c2c2c');

  // ---------- boundary wall ----------
  const t = 0.4;
  for (const [ax, bx, az, bz] of [[px0, px1, pz0 - t / 2, pz0 + t / 2], [px0 - t / 2, px0 + t / 2, pz0, pz1], [px1 - t / 2, px1 + t / 2, pz0, pz1], [px0, dx0, pz1 - t / 2, pz1 + t / 2], [dx1, px1, pz1 - t / 2, pz1 + t / 2]]) {
    shadowRect(ax, bx, az, bz, 0.5, 0.25); fill(ax, bx, az, bz, '#f1ede4'); rect(ax, bx, az, bz, 'rgba(90,85,75,0.5)', 0.02);
  }

  // ---------- top platform: travertine terrace around the pool, stepping stones ----------
  const [qx0, qx1, qz0, qz1] = L.POOL;
  tiles(-10, 14, 0, 10.6, 0.8, 0.4, '#e6d9c2', 'rgba(150,130,100,0.35)', 0.05);
  tiles(-13.6, -10, -14, 0, 0.8, 0.4, '#e6d9c2', 'rgba(150,130,100,0.35)', 0.05); // entry porch under the cantilever
  for (let x = L.CARPORT[1] + 0.8; x < L.UPPER[0] + 0.2; x += 1.4) { shadowRect(x, x + 0.9, -9.95, -9.25, 0.15, 0.2); fill(x, x + 0.9, -9.95, -9.25, '#ddd3c0'); }

  // ---------- pool: coping, water, steps ----------
  fill(qx0 - 0.6, qx1 + 0.6, qz0 - 0.6, qz1 + 0.6, '#f4efe4');
  rect(qx0 - 0.6, qx1 + 0.6, qz0 - 0.6, qz1 + 0.6, 'rgba(140,125,100,0.4)', 0.02);
  const water = g.createLinearGradient(X(qx0), Y(qz0), X(qx1), Y(qz1));
  water.addColorStop(0, '#5cc1cc'); water.addColorStop(0.5, '#38a3b9'); water.addColorStop(1, '#2b8aa6');
  g.fillStyle = water; g.fillRect(X(qx0), Y(qz0), M(qx1 - qx0), M(qz1 - qz0));
  g.save(); g.filter = `blur(${M(0.25)}px)`; rect(qx0 + 0.1, qx1 - 0.1, qz0 + 0.1, qz1 - 0.1, 'rgba(10,60,80,0.35)', 0.25); g.restore(); // depth at the walls
  for (let i = 0; i < 3; i++) fill(qx0, qx0 + 1.6, qz0 + i * 0.35, qz0 + (i + 1) * 0.35, `rgba(255,255,255,${0.32 - i * 0.08})`); // steps
  // loungers with towels, parasol
  for (const lx of [-7.6, -6.6]) {
    shadowRect(lx, lx + 0.75, 4.4, 6.35, 0.25, 0.25);
    g.fillStyle = '#fbf9f4'; g.beginPath(); g.roundRect(X(lx), Y(4.4), M(0.75), M(1.95), M(0.1)); g.fill();
    fill(lx + 0.12, lx + 0.63, 4.9, 6.1, lx < -7 ? '#d94f1e' : '#2f4f5e');
  }
  shadowCircle(-5.6, 3.6, 1.2, 1.6, 0.25); circle(-5.6, 3.6, 1.2, '#f2ece0');
  g.strokeStyle = 'rgba(150,135,110,0.5)'; g.lineWidth = M(0.02);
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; g.beginPath(); g.moveTo(X(-5.6), Y(3.6)); g.lineTo(X(-5.6 + Math.cos(a) * 1.2), Y(3.6 + Math.sin(a) * 1.2)); g.stroke(); }

  // ---------- covered terrace furniture ----------
  fill(-8, -5.4, 0.8, 1.9, '#7b5a40'); for (const x of [-7.6, -6.7, -5.8]) { circle(x, 0.45, 0.2, '#efe8dc'); circle(x, 2.25, 0.2, '#efe8dc'); }
  fill(8, 11, 0.7, 1.4, '#e9e2d6'); fill(9, 10, 1.7, 2.3, '#7b5a40');

  // ---------- villa: shadow, then the ground floor as finished ----------
  const [vx0, vx1, vz0, vz1] = L.VILLA, [ux0] = L.UPPER;
  shadowRect(ux0, vx1, vz0, vz1, 2.2, 0.32);
  marble(vx0, vx1, vz0, vz1);
  oak(6, vx1, -7, vz1); // family living
  tiles(1, 8, vz0, -7, 0.6, 0.6, '#d9d6d0', 'rgba(120,118,112,0.45)', 0.03); // kitchen
  tiles(8, vx1, vz0, -7, 0.3, 0.3, '#e4dfd5', 'rgba(120,115,105,0.4)', 0.03); // service wing
  // salon: rug, two linen sofas, armchairs, travertine coffee table
  fill(-9, -3, -6.3, -0.9, '#bfae92'); rect(-8.85, -3.15, -6.15, -1.05, 'rgba(255,255,255,0.35)', 0.05);
  for (const [ax, bx, az, bz] of [[-7.7, -4.3, -6.05, -5.15], [-7.7, -4.3, -2.05, -1.15]]) { shadowRect(ax, bx, az, bz, 0.12, 0.3); fill(ax, bx, az, bz, '#ebe4d8'); fill(ax + 0.1, bx - 0.1, az + 0.1, bz - 0.1, '#f4efe6'); }
  for (const [ax, bx] of [[-9.35, -8.55], [-3.45, -2.65]]) { shadowRect(ax, bx, -4, -3.2, 0.12, 0.3); fill(ax, bx, -4, -3.2, '#4d4c48'); }
  shadowRect(-6.8, -5.2, -4.15, -3.05, 0.1, 0.25); fill(-6.8, -5.2, -4.15, -3.05, '#e2d3b8');
  circle(-6, -3.6, 0.22, '#5f7f4f'); // plant on the table
  // dining: walnut table, chairs, sideboard
  for (const x of [1.0, 1.9, 2.8, 3.7]) { fill(x - 0.05, x + 0.4, -4.6, -4.15, '#d8cdbd'); fill(x - 0.05, x + 0.4, -2.85, -2.4, '#d8cdbd'); }
  fill(0.05, 0.5, -3.7, -3.3, '#d8cdbd'); fill(4.5, 4.95, -3.7, -3.3, '#d8cdbd');
  shadowRect(0.6, 4.4, -4.05, -2.95, 0.12, 0.3); fill(0.6, 4.4, -4.05, -2.95, '#6e4c33');
  for (let x = 0.7; x < 4.4; x += 0.12) line(x, -4.0, x + 0.05, -3.0, 'rgba(40,25,15,0.15)', 0.01);
  fill(1.2, 2.8, -6.9, -6.45, '#3c3a37');
  // family living: charcoal L sofa, coffee table, armchair, TV unit
  fill(8.1, 12.3, -5.85, -4.95, '#5a5b5e'); fill(12.45, 13.35, -5.0, -2.4, '#5a5b5e');
  fill(8.25, 12.15, -5.7, -5.4, '#6c6d70');
  fill(9.3, 10.7, -3.9, -2.9, '#e6dccb'); circle(8.6, -2.4, 0.45, '#b56b45'); fill(6.2, 6.55, -6.5, -4, '#2d2c2a');
  // kitchen: quartz counters, island, stools, fridge
  fill(1.2, 7.8, -13.85, -13.25, '#f5f3ef'); fill(7.2, 7.8, -13.25, -10.4, '#f5f3ef');
  fill(2.0, 3.2, -13.75, -13.35, '#b8bcc0'); fill(1.2, 2.0, -12.4, -10.9, '#c8c9cb');
  shadowRect(2.9, 6.1, -10.95, -9.85, 0.12, 0.25); fill(2.9, 6.1, -10.95, -9.85, '#f7f5f1');
  for (const x of [3.5, 4.5, 5.5]) circle(x, -9.55, 0.2, '#7b5a40');
  // service wing furniture
  fill(12.9, 13.75, -13.8, -11.9, '#efe8dc'); fill(10.8, 11.8, -11, -10.4, '#b99f7f');
  // stair and lift
  fill(-3.75, -1.15, -13.75, -8.2, '#e2dbd0');
  for (let z = -12.4; z <= -8.2; z += 0.28) { line(-3.75, z, -2.55, z, 'rgba(110,100,85,0.5)', 0.015); line(-2.35, z, -1.15, z, 'rgba(110,100,85,0.5)', 0.015); }
  fill(-0.75, 0.75, -13.75, -12.25, '#9fa3a6');
  // glazing along the south and side facades: a light blue band
  fill(vx0, vx1, vz1 - 0.2, vz1 - 0.02, 'rgba(150,205,225,0.9)');
  fill(vx0 + 0.02, vx0 + 0.2, -7, vz1, 'rgba(150,205,225,0.9)'); fill(vx1 - 0.2, vx1 - 0.02, -7, vz1, 'rgba(150,205,225,0.9)');
  // indoor plants
  for (const [x, z] of [[-9.4, -1.3], [-2.5, -6.5], [13.5, -6.6], [-5, -13.3]]) circle(x, z, 0.3, '#4f7342');

  // ---------- covered parking: concrete, cars, ATV, timber pergola ----------
  const [cx0, cx1, cz0, cz1] = L.CARPORT;
  tiles(cx0, cx1, cz0, cz1, 2, 2, '#cdc9c1', 'rgba(110,105,95,0.35)', 0.04);
  const car = (cx, body, roof) => {
    const w2 = 0.95, l2 = 2.35, cz = (cz0 + cz1) / 2;
    shadowRect(cx - w2, cx + w2, cz - l2, cz + l2, 0.25, 0.35);
    g.fillStyle = body; g.beginPath(); g.roundRect(X(cx - w2), Y(cz - l2), M(w2 * 2), M(l2 * 2), M(0.45)); g.fill();
    g.fillStyle = '#1f2a33'; g.beginPath(); g.roundRect(X(cx - 0.75), Y(cz - 1.15), M(1.5), M(2.35), M(0.3)); g.fill();
    g.fillStyle = roof; g.beginPath(); g.roundRect(X(cx - 0.68), Y(cz - 0.55), M(1.36), M(1.25), M(0.2)); g.fill();
    fill(cx - 0.8, cx - 0.5, cz - l2 + 0.05, cz - l2 + 0.18, '#fff6d8'); fill(cx + 0.5, cx + 0.8, cz - l2 + 0.05, cz - l2 + 0.18, '#fff6d8');
  };
  car(cx0 + 2, '#f3f3f1', '#e4e4e2'); car(cx0 + 6, '#202224', '#2c2e31');
  const az = (cz0 + cz1) / 2, ax = cx0 + 10;
  for (const [ddx, ddz] of [[-0.62, -0.72], [0.38, -0.72], [-0.62, 0.42], [0.38, 0.42]]) fill(ax + ddx, ax + ddx + 0.24, az + ddz, az + ddz + 0.42, '#1b1b1b');
  g.fillStyle = '#c0392b'; g.beginPath(); g.roundRect(X(ax - 0.42), Y(az - 1), M(0.84), M(2), M(0.2)); g.fill();
  fill(ax - 0.2, ax + 0.2, az - 0.1, az + 0.65, '#222');
  // pergola: timber beams, slats that let light through
  shadowRect(cx0, cx1, cz0, cz1, 1.4, 0.12);
  g.globalAlpha = 0.82;
  for (let z = cz0 + 0.3; z < cz1; z += 0.6) fill(cx0, cx1, z - 0.07, z + 0.07, '#8a5d3b');
  for (let x = cx0; x <= cx1 + 0.01; x += 4) fill(x - 0.12, x + 0.12, cz0, cz1, '#6f472b');
  g.globalAlpha = 1;

  // ---------- courts ----------
  const [tx0, tx1, tz0, tz1] = L.TENNIS, tcx = (tx0 + tx1) / 2, tcz = (tz0 + tz1) / 2;
  fill(tx0, tx1, tz0, tz1, '#4f8065');
  const ddx = 10.97 / 2, ddz = 23.77 / 2, sx = ddx - 1.37, sv = 6.4;
  fill(tcx - ddx, tcx + ddx, tcz - ddz, tcz + ddz, '#2f6c9f');
  speckle(tx0, tx1, tz0, tz1, (tx1 - tx0) * (tz1 - tz0) * 10, 'rgba(255,255,255,0.05)', 0.06);
  const W = '#f7f7f2', lw = 0.07;
  rect(tcx - ddx, tcx + ddx, tcz - ddz, tcz + ddz, W, lw);
  line(tcx - sx, tcz - ddz, tcx - sx, tcz + ddz, W, lw); line(tcx + sx, tcz - ddz, tcx + sx, tcz + ddz, W, lw);
  line(tcx - sx, tcz - sv, tcx + sx, tcz - sv, W, lw); line(tcx - sx, tcz + sv, tcx + sx, tcz + sv, W, lw); line(tcx, tcz - sv, tcx, tcz + sv, W, lw);
  line(tcx - ddx - 0.45, tcz, tcx + ddx + 0.45, tcz, '#111', 0.08);
  rect(tx0, tx1, tz0, tz1, 'rgba(25,30,28,0.7)', 0.05); // fence
  for (const x of [tx0, tx1]) for (const z of [tz0, tz1]) circle(x, z, 0.2, '#222');

  const [bx0, bx1, bz0, bz1] = L.BASKET, bcx = (bx0 + bx1) / 2;
  fill(bx0, bx1, bz0, bz1, '#2f5e83');
  fill(bx0 + 0.3, bx1 - 0.3, bz0 + 0.3, bz1 - 0.3, '#c46a43');
  const base = bz1 - 0.3, hz = base - 1.575;
  fill(bcx - 2.45, bcx + 2.45, base - 5.8, base, '#2f5e83');
  g.strokeStyle = W; g.lineWidth = M(lw);
  rect(bx0 + 0.3, bx1 - 0.3, bz0 + 0.3, bz1 - 0.3, W, lw); rect(bcx - 2.45, bcx + 2.45, base - 5.8, base, W, lw);
  g.beginPath(); g.arc(X(bcx), Y(base - 5.8), M(1.8), 0, Math.PI * 2); g.stroke();
  g.beginPath(); g.arc(X(bcx), Y(hz), M(6.75), Math.PI + 0.16, -0.16); g.stroke();
  line(bx0 + 0.9, base, bx0 + 0.9, hz - 0.95, W, lw); line(bx1 - 0.9, base, bx1 - 0.9, hz - 0.95, W, lw);
  line(bcx - 0.9, base - 1.2, bcx + 0.9, base - 1.2, '#111', 0.1); g.strokeStyle = '#e8562a'; g.lineWidth = M(0.05);
  g.beginPath(); g.arc(X(bcx), Y(hz), M(0.23), 0, Math.PI * 2); g.stroke();

  // ---------- stone retaining walls and stairs between the terraces ----------
  const RW = 0.5, xT = 15.6;
  for (const [ax2, bx2, az2, bz2] of [[-17, 8.2, 11.2, 11.2 + RW], [10.4, xT, 11.2, 11.2 + RW], [xT, xT + RW, pz0 + t / 2, 6.5], [xT, xT + RW, 8.1, pz1 - t / 2], [17, px1 - t / 2, 8.6, 8.6 + RW]]) {
    shadowRect(ax2, bx2, az2, bz2, 0.9, 0.35); stone(ax2, bx2, az2, bz2);
  }
  const stairs = (ax2, bx2, az2, bz2, n, alongZ) => {
    fill(ax2, bx2, az2, bz2, '#ddd2bd');
    for (let i = 0; i <= n; i++) {
      if (alongZ) { const z = az2 + ((bz2 - az2) * i) / n; line(ax2, z, bx2, z, 'rgba(110,95,70,0.55)', 0.025); }
      else { const x = ax2 + ((bx2 - ax2) * i) / n; line(x, az2, x, bz2, 'rgba(110,95,70,0.55)', 0.025); }
    }
  };
  stairs(8.2, 10.4, 11.2, 13.9, 9, true); stairs(xT, 21.4, 6.5, 8.1, 18, false); stairs(xT + RW, 17, 8.6, 11.3, 9, true);

  // ---------- garden: flower beds with lavender and bougainvillea, a gravel path ----------
  g.save(); g.lineCap = 'round'; g.strokeStyle = '#e3d8c3'; g.lineWidth = M(1.1);
  g.beginPath(); g.moveTo(X(9.3), Y(13.9)); g.bezierCurveTo(X(8), Y(17), X(2), Y(15), X(-3), Y(16.5)); g.stroke(); g.restore();
  const bed = (cx, cz, rx, rz, colors) => {
    g.fillStyle = '#6d5a43'; g.beginPath(); g.ellipse(X(cx), Y(cz), M(rx), M(rz), 0, 0, Math.PI * 2); g.fill();
    for (let i = 0; i < rx * rz * 40; i++) {
      const a = r() * Math.PI * 2, d = Math.sqrt(r());
      circle(cx + Math.cos(a) * rx * d * 0.92, cz + Math.sin(a) * rz * d * 0.92, 0.09 + r() * 0.08, colors[(r() * colors.length) | 0]);
    }
  };
  bed(-8, 15.6, 3, 1.1, ['#8d7bb8', '#a08fcc', '#6e8c4e']);
  bed(5, 19.5, 2.4, 0.9, ['#c2457a', '#d9649a', '#6e8c4e']);
  bed(12, 17.5, 1.4, 1.4, ['#e9c46a', '#f1d488', '#6e8c4e']);

  // ---------- trees: soft shadows first, then lumpy layered canopies ----------
  const canopy = (x, z, rad, k) => {
    const n = Math.max(7, Math.round(rad * 7)), c = [[78, 112, 58], [96, 128, 70], [112, 136, 82]];
    for (let layer = 0; layer < 3; layer++) {
      const rr = rad * (1 - layer * 0.22), [cr, cg, cb] = c[layer];
      g.fillStyle = `rgb(${cr + k},${cg + k},${cb + k})`; g.beginPath();
      for (let i = 0; i <= n; i++) {
        const a = (i / n) * Math.PI * 2, wob = 1 + Math.sin(i * 2.7 + x) * 0.07;
        const px = x + Math.cos(a) * rr * wob - layer * 0.12 * rad, pz = z + Math.sin(a) * rr * wob - layer * 0.12 * rad;
        i ? g.lineTo(X(px), Y(pz)) : g.moveTo(X(px), Y(pz));
      }
      g.fill();
    }
    speckle(x - rad, x + rad, z - rad, z + rad, rad * rad * 18, 'rgba(30,50,20,0.18)', 0.09);
  };
  for (const [x, z, rr] of HEDGE) shadowCircle(x, z, rr, 0.5, 0.3);
  for (const [x, z, rr] of TREES) shadowCircle(x, z, rr, 1.6, 0.32);
  for (const [x, z, rr] of HEDGE) canopy(x, z, rr, -18);
  for (const [x, z, rr] of TREES) canopy(x, z, rr, (r() - 0.5) * 16);

  // ---------- the drawing's linework, printed lightly over the colour (presentation-plan style) ----------
  const ink = newCanvas();
  drawSitePlan(ink, L, s);
  g.save(); g.globalCompositeOperation = 'multiply';
  g.globalAlpha = 0.22; g.drawImage(ink, 0, 0);
  g.beginPath(); g.rect(X(vx0), Y(vz0), M(vx1 - vx0), M(vz1 - vz0)); g.clip(); // walls read stronger inside the villa
  g.globalAlpha = 0.6; g.drawImage(ink, 0, 0);
  g.restore();
}

// Mask for the shader, small: red = pool water, green = tree canopies, blue = lights at dusk
// (warm interiors, glazing spill, porch, garden uplights, bollards, court floodlights).
export function drawFinishedMask(canvas, L, s = 10) {
  const { x0, z0, w, h } = SHEET;
  canvas.width = Math.round(w * s); canvas.height = Math.round(h * s);
  const g = canvas.getContext('2d');
  const X = x => (x - x0) * s, Y = z => (z - z0) * s;
  g.fillStyle = '#000'; g.fillRect(0, 0, canvas.width, canvas.height);
  g.globalCompositeOperation = 'lighter';
  const [qx0, qx1, qz0, qz1] = L.POOL;
  g.fillStyle = '#f00'; g.fillRect(X(qx0), Y(qz0), (qx1 - qx0) * s, (qz1 - qz0) * s);
  g.fillStyle = '#0f0';
  for (const [x, z, rr] of [...TREES, ...HEDGE]) { g.beginPath(); g.arc(X(x), Y(z), rr * s, 0, Math.PI * 2); g.fill(); }
  const light = (blur, fn) => { g.save(); g.filter = `blur(${blur * s}px)`; fn(); g.restore(); };
  const rect = (ax, bx, az, bz, v) => { g.fillStyle = `rgb(0,0,${Math.round(v * 255)})`; g.fillRect(X(ax), Y(az), (bx - ax) * s, (bz - az) * s); };
  const glow = (x, z, rad, v) => { const gr = g.createRadialGradient(X(x), Y(z), 0, X(x), Y(z), rad * s); gr.addColorStop(0, `rgba(0,0,255,${v})`); gr.addColorStop(1, 'rgba(0,0,255,0)'); g.fillStyle = gr; g.beginPath(); g.arc(X(x), Y(z), rad * s, 0, Math.PI * 2); g.fill(); };
  const [vx0, vx1, vz0, vz1] = L.VILLA;
  light(0.4, () => rect(vx0, vx1, vz0, vz1, 0.42));                  // warm interiors
  light(1.2, () => rect(vx0, vx1, vz1 - 0.2, vz1 + 1.8, 0.45));      // glazing spills onto the terrace
  light(0.8, () => rect(-13.6, -10, -12, -7.5, 0.6));                 // entry porch
  light(1.0, () => rect(...L.CARPORT, 0.3));                          // carport
  for (const [x, z, rr] of TREES) glow(x, z, rr * 1.2, 0.55);          // uplights
  for (let z = L.DRIVE[2]; z < L.DRIVE[3]; z += 4) { glow(L.DRIVE[0] - 0.4, z, 0.8, 0.5); glow(L.DRIVE[1] + 0.4, z, 0.8, 0.5); } // bollards
  for (const [ax, bx, az, bz] of [L.TENNIS, L.BASKET]) {
    light(1.5, () => rect(ax, bx, az, bz, 0.38));                      // floodlit courts
    for (const x of [ax, bx]) for (const z of [az, bz]) glow(x, z, 3, 0.5);
  }
  glow(-6.7, 1.3, 2.4, 0.5); glow(9.5, 1.5, 2.2, 0.45);                // covered terrace lamps
}

function mulberry(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
