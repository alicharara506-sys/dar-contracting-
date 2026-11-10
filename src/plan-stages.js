// The build in plan view, stage by stage, for the lens's time dial. Each stage is painted on the same
// world grid as the CAD sheet (plan-drawing.js) and the finished plan (plan-finished.js), so turning the
// dial changes what is built, never where it is.
//
//   0 Setting out · 1 Earthworks · 2 Foundations · 3 Structure · 4 Blockwork · 5 Services · 6 Handover
// Stage 6 is drawFinishedPlan(). drawTrades() paints the X-ray layers for the trade view:
// red = structure, green = plumbing, blue = electrical (coloured in the shader).
import { SHEET } from './plan-drawing.js';
import { painter, paintGround, drawFinishedPlan } from './plan-finished.js';
import { TREES, HEDGE, WALLS, VPIT } from './layout.js';

export const STAGE_COUNT = 7;

// ---------- services routes (world metres), shared by the Services stage and the X-ray view ----------
const DB = [8.6, -9.4]; // distribution board in the service corridor
export const ROUTES = {
  // water main from the street, along the drive, into the villa; manifold along the north wall
  water: [
    [[-19.4, 22.6], [-19.4, -2.6], [-10.6, -2.6], [-10.6, -13.6], [12.6, -13.6]],
    [[-9.6, -13.6], [-9.6, -13.2]], [[2.6, -13.6], [2.6, -13.5]], [[8.5, -13.6], [8.5, -13.4]], [[9.2, -13.6], [9.2, -13.4]],
    [[10.1, -13.6], [10.1, -13.5]], [[12.6, -13.6], [12.6, -7.6], [12.1, -7.6]], [[12.6, -8.3], [13.4, -8.3]],
    [[-8.3, -13.6], [-8.3, -13.5]], // vanity
    [[-10.3, -13.25], [12.3, -13.25]], [[4.5, -13.25], [4.5, -10.4]], // hot water loop, kitchen island
    [[-10.6, -6.4], [-2, -6.4], [-2, -4.6]], [[13.4, -6.4], [12.6, -6.4], [12.6, -7.6]], // salon wet bar, family-room bar feed
    [[-10.6, 0.9], [-10.6, 10.3], [12.2, 10.3]], [[2.6, 10.3], [2.6, 9.9]], [[-6.2, 10.3], [-6.2, 4.4]], // terrace taps and outdoor shower
  ],
  drain: [
    [[-9.65, -13.1], [-9.65, -12.6], [15, -12.6]], [[2.6, -13.4], [2.6, -12.6]], [[8.8, -13.3], [8.8, -12.6]],
    [[12.1, -7.5], [13.6, -7.5], [13.6, -12.6]], [[15, -12.6], [15, 10.8], [15, 22.6]],
    [[-10, 0.7], [15, 0.7]], ...[-10, -4, 2, 8, 14].map(x => [[x, 0], [x, 0.7]]), // rainwater: downpipes on the glass facade to a storm drain
    [[-2, 3.3], [11.6, 3.3], [11.6, 0.7]], [[-2, 10.6], [-2, 3.3]], // terrace channel drains
  ],
  pool: [
    [[10, 4.8], [11.4, 4.8], [11.4, 9.6]], [[10, 8.2], [11.4, 8.2]], // skimmers to the plant room
    [[11.4, 9.6], [-4.6, 9.6], [-4.6, 6.5], [-4, 6.5]], [[3, 9.6], [3, 9]], // returns
  ],
  irrigation: [
    [[-16, 14], [15, 14]], [[-16, 17.2], [15, 17.2]], [[-16, 20.4], [15, 20.4]], [[-16, 14], [-16, 20.4]],
  ],
  power: [
    [[-17.6, 22.6], [-17.6, -3.2], [-10.4, -3.2], [-10.4, -7.35], [8.6, -7.35], DB],
    [[-17.6, 15], [15.2, 15], [15.2, -3], [17, -3]], // garden loop and courts feeder
    [[17, -3], [17, -21], [29, -21], [29, 6], [17, 6], [17, -3]],
    [[17, 6], [17, 21], [29, 21], [29, 9], [17, 9]],
    [[-17.6, 2], [-4.8, 2], [-4.8, 3.4], [10.8, 3.4], [10.8, 9.8]], // terrace and pool lights
  ],
  // ceiling points (homeruns from the DB) and outdoor lights
  points: [[-6, -3.5], [-6, -5.8], [2.5, -3.5], [10.2, -3.5], [10.2, -5.8], [-7, -10.4], [4.5, -11.2], [-1.5, -10], [12.4, -12.3], [9.3, -12.2], [10, -7.9], [12.5, -8.2], [-9, -12.8], [-12, -11]],
  outdoor: [[17, -21], [29, -21], [17, 6], [29, 6], [17, 9], [29, 9], [17, 21], [29, 21], [-4, 4.2], [-4, 8.8], [10, 4.2], [10, 8.8], [-17.6, 6], [-17.6, 12], [-17.6, 18], [-12, 10], [-12, 16], [14, 14], [-2, 18], [7, 19]],
  DB,
};

// ---------- props: machines, people, materials ----------
function props(P) {
  const { g, X, Y, M, fill, circle, shadowRect, shadowCircle, line } = P;
  const rot = (x, z, a, fn) => { g.save(); g.translate(X(x), Y(z)); g.rotate(a); fn(); g.restore(); };
  const box = (ax, az, w, d, c, rr = 0.1) => { g.fillStyle = c; g.beginPath(); g.roundRect(M(ax), M(az), M(w), M(d), M(rr)); g.fill(); };
  return {
    excavator(x, z, a = 0, arm = 0.6) {
      shadowRect(x - 1.4, x + 1.4, z - 1.6, z + 1.6, 0.5, 0.3);
      rot(x, z, a, () => {
        box(-1.4, -1.6, 0.55, 3.2, '#2b2b2b', 0.15); box(0.85, -1.6, 0.55, 3.2, '#2b2b2b', 0.15); // tracks
        g.rotate(arm);
        box(-1.1, -1.2, 2.2, 2.3, '#f2b31b', 0.3); box(-1.0, -1.15, 0.9, 0.95, '#2d3a40', 0.1); // body, cab
        box(-0.1, -4.6, 0.32, 3.5, '#e2a312', 0.08); box(-0.45, -5.3, 1.0, 0.75, '#3a3a3a', 0.12); // boom, bucket
        box(-0.9, 0.7, 1.8, 0.45, '#3a3a3a', 0.08); // counterweight
      });
    },
    truck(x, z, a = 0, bed = '#8d7b62') {
      shadowRect(x - 1.25, x + 1.25, z - 3.6, z + 3.6, 0.5, 0.3);
      rot(x, z, a, () => { box(-1.25, -3.6, 2.5, 1.9, '#f4f4f2', 0.3); box(-1.05, -3.3, 2.1, 0.7, '#2d3a40', 0.1); box(-1.25, -1.5, 2.5, 5.1, '#6c6e70', 0.15); box(-1.05, -1.3, 2.1, 4.7, bed, 0.2); });
    },
    mixer(x, z, a = 0) {
      shadowRect(x - 1.25, x + 1.25, z - 3.8, z + 3.8, 0.5, 0.3);
      rot(x, z, a, () => {
        box(-1.25, -3.8, 2.5, 1.9, '#d94f1e', 0.3); box(-1.05, -3.5, 2.1, 0.7, '#2d3a40', 0.1); box(-1.25, -1.7, 2.5, 5.5, '#555', 0.15);
        const gr = g.createLinearGradient(M(-1.1), 0, M(1.1), 0); gr.addColorStop(0, '#9aa0a5'); gr.addColorStop(0.5, '#f1f3f4'); gr.addColorStop(1, '#8a9095');
        g.fillStyle = gr; g.beginPath(); g.ellipse(0, M(1.0), M(1.1), M(2.4), 0, 0, Math.PI * 2); g.fill();
        g.strokeStyle = 'rgba(217,79,30,.8)'; g.lineWidth = M(0.12); for (let i = -1; i <= 1; i++) { g.beginPath(); g.moveTo(M(-1), M(1 + i * 0.9)); g.lineTo(M(1), M(1 + i * 0.9 + 0.6)); g.stroke(); }
      });
    },
    crane(x, z, a, len = 34) { // tower crane: mast, jib with lattice, counter-jib with weights, trolley + hook
      g.save(); g.filter = `blur(${M(0.5)}px)`; g.globalAlpha = 0.22; rot(x + 2.4, z + 3, a, () => { g.fillStyle = '#1d2418'; g.fillRect(M(-9), M(-0.5), M(len + 9), M(1)); }); g.restore();
      rot(x, z, a, () => {
        g.fillStyle = '#f2b31b'; g.fillRect(M(-1), M(-1), M(2), M(2)); g.fillStyle = '#2d3a40'; g.fillRect(M(-0.6), M(-0.6), M(1.2), M(1.2));
        g.strokeStyle = '#f2b31b'; g.lineWidth = Math.max(1, M(0.12));
        g.beginPath(); g.moveTo(M(0.9), M(-0.55)); g.lineTo(M(len), M(-0.2)); g.moveTo(M(0.9), M(0.55)); g.lineTo(M(len), M(0.2)); g.stroke();
        g.lineWidth = Math.max(1, M(0.06)); g.beginPath();
        for (let t = 1, i = 0; t < len; t += 1.1, i++) { const w2 = 0.55 - (t / len) * 0.35; g.moveTo(M(t), M(i % 2 ? -w2 : w2)); g.lineTo(M(t + 1.1), M(i % 2 ? w2 : -w2)); }
        g.stroke();
        g.fillStyle = '#f2b31b'; g.fillRect(M(-9), M(-0.6), M(8), M(1.2)); g.fillStyle = '#9b9a95'; g.fillRect(M(-9), M(-0.9), M(2.6), M(1.8));
        g.fillStyle = '#2b2b2b'; g.fillRect(M(len * 0.62), M(-0.45), M(0.9), M(0.9));
      });
    },
    worker(x, z, c = '#f7f5ef') { shadowCircle(x, z, 0.28, 0.2, 0.35); circle(x, z, 0.32, '#3d4a57'); circle(x - 0.04, z - 0.04, 0.2, c); },
    pallets(x, z, nx, nz, c = '#b9b3a6') {
      for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
        const ax = x + i * 1.3, az = z + j * 1.3; shadowRect(ax, ax + 1.1, az, az + 1.1, 0.35, 0.3); fill(ax, ax + 1.1, az, az + 1.1, c);
        for (let k = 1; k < 3; k++) { line(ax + k * 0.37, az, ax + k * 0.37, az + 1.1, 'rgba(80,75,65,.35)', 0.015); line(ax, az + k * 0.37, ax + 1.1, az + k * 0.37, 'rgba(80,75,65,.35)', 0.015); }
      }
    },
    pile(x, z, rad, c1 = '#c9b58f', c2 = '#9c8763') {
      shadowCircle(x, z, rad, 0.6, 0.3);
      const gr = g.createRadialGradient(X(x - rad * 0.3), Y(z - rad * 0.3), M(rad * 0.1), X(x), Y(z), M(rad));
      gr.addColorStop(0, c1); gr.addColorStop(1, c2); g.fillStyle = gr; g.beginPath(); g.arc(X(x), Y(z), M(rad), 0, Math.PI * 2); g.fill();
    },
  };
}

export function drawStage(canvas, L, s, i) {
  if (i >= 6) return drawFinishedPlan(canvas, L, s);
  const P = painter(canvas, s, 20 + i);
  const { g, X, Y, M, r, fill, rect, line, circle, clip, speckle, shadowRect, shadowCircle, tiles, stone } = P;
  const T = props(P);
  const [px0, px1, pz0, pz1] = L.PLOT, [vx0, vx1, vz0, vz1] = L.VILLA, [ux0] = L.UPPER;
  const [qx0, qx1, qz0, qz1] = L.POOL, [dx0, dx1, ddz0, dz1] = L.DRIVE, [cx0, cx1, cz0, cz1] = L.CARPORT;
  const earth = (ax, bx, az, bz, c, n = 14) => { fill(ax, bx, az, bz, c); speckle(ax, bx, az, bz, (bx - ax) * (bz - az) * n, 'rgba(90,70,40,0.2)', 0.09); speckle(ax, bx, az, bz, (bx - ax) * (bz - az) * n * 0.5, 'rgba(255,250,235,0.22)', 0.08); };
  const concrete = (ax, bx, az, bz, c = '#bebbb4', panel = 2.4) => {
    tiles(ax, bx, az, bz, panel, panel / 2, c, 'rgba(90,88,82,0.35)', 0.05);
    speckle(ax, bx, az, bz, (bx - ax) * (bz - az) * 10, 'rgba(70,68,62,0.12)', 0.05);
  };
  const pit = (ax, bx, az, bz, c) => { // dug ground, with the north and west faces shading the floor
    earth(ax, bx, az, bz, c, 18);
    for (let k = 0; k < 6; k++) { const d = k * 0.25; fill(ax, bx, az + d, az + d + 0.25, `rgba(40,28,14,${0.32 - k * 0.05})`); fill(ax + d, ax + d + 0.25, az, bz, `rgba(40,28,14,${0.26 - k * 0.04})`); }
    rect(ax, bx, az, bz, 'rgba(60,42,22,0.55)', 0.06);
  };
  const tracks = (ax, bx, az, bz) => clip(ax, bx, az, bz, () => {
    for (let k = 0; k < 7; k++) { const z = az + r() * (bz - az), a = (r() - 0.5) * 0.6; g.save(); g.translate(X(ax), Y(z)); g.rotate(a); g.fillStyle = 'rgba(60,40,20,0.12)'; for (let x = 0; x < M(bx - ax); x += M(0.35)) { g.fillRect(x, 0, M(0.2), M(0.5)); g.fillRect(x, M(1.9), M(0.2), M(0.5)); } g.restore(); }
  });
  const rebar = (ax, bx, az, bz, step = 0.25, c = 'rgba(122,62,32,0.75)') => clip(ax, bx, az, bz, () => {
    g.strokeStyle = c; g.lineWidth = Math.max(0.8, M(0.035)); g.beginPath();
    for (let x = ax; x <= bx; x += step) { g.moveTo(X(x), Y(az)); g.lineTo(X(x), Y(bz)); }
    for (let z = az; z <= bz; z += step) { g.moveTo(X(ax), Y(z)); g.lineTo(X(bx), Y(z)); }
    g.stroke();
  });
  const peg = (x, z) => { fill(x - 0.12, x + 0.12, z - 0.12, z + 0.12, '#d94f1e'); };
  const string = (ax, bx, az, bz) => { g.save(); g.setLineDash([M(0.3), M(0.15)]); rect(ax, bx, az, bz, 'rgba(255,255,255,0.95)', 0.08); g.restore(); for (const x of [ax, bx]) for (const z of [az, bz]) peg(x, z); };
  const treeFence = () => { g.save(); g.setLineDash([M(0.25), M(0.2)]); for (const [x, z, rr] of TREES) { g.strokeStyle = '#d94f1e'; g.lineWidth = M(0.06); g.beginPath(); g.arc(X(x), Y(z), M(rr + 0.6), 0, Math.PI * 2); g.stroke(); } g.restore(); };
  const trees = () => {
    const canopy = (x, z, rad, k) => {
      for (let layer = 0; layer < 3; layer++) {
        const rr = rad * (1 - layer * 0.22), c = [[78, 112, 58], [96, 128, 70], [112, 136, 82]][layer];
        g.fillStyle = `rgb(${c[0] + k},${c[1] + k},${c[2] + k})`; g.beginPath(); g.arc(X(x - layer * 0.12 * rad), Y(z - layer * 0.12 * rad), M(rr), 0, Math.PI * 2); g.fill();
      }
    };
    for (const [x, z, rr] of TREES) shadowCircle(x, z, rr, 1.6, 0.32);
    for (const [x, z, rr] of TREES) canopy(x, z, rr, -6);
  };
  const walls = (c, joints = true) => {
    for (const [ax, bx, az, bz] of WALLS) shadowRect(ax, bx, az, bz, 0.35, 0.35);
    for (const [ax, bx, az, bz] of WALLS) {
      fill(ax, bx, az, bz, c);
      if (!joints) continue;
      const along = bx - ax > bz - az;
      for (let t = along ? ax : az; t < (along ? bx : bz); t += 0.4) along ? line(t, az, t, bz, 'rgba(50,44,36,0.6)', 0.02) : line(ax, t, bx, t, 'rgba(50,44,36,0.6)', 0.02);
    }
  };
  const columns = (c = '#7d7a73') => { for (const x of L.CX) for (const z of L.CZ) { shadowRect(x - 0.2, x + 0.2, z - 0.2, z + 0.2, 0.45, 0.4); fill(x - 0.2, x + 0.2, z - 0.2, z + 0.2, c); } };
  const boundary = c => { const t = 0.4; for (const [ax, bx, az, bz] of [[px0, px1, pz0 - t / 2, pz0 + t / 2], [px0 - t / 2, px0 + t / 2, pz0, pz1], [px1 - t / 2, px1 + t / 2, pz0, pz1], [px0, dx0, pz1 - t / 2, pz1 + t / 2], [dx1, px1, pz1 - t / 2, pz1 + t / 2]]) { shadowRect(ax, bx, az, bz, 0.5, 0.25); fill(ax, bx, az, bz, c); } };
  const RW = 0.5, xT = 15.6;
  const RETAIN = [[-17, 8.2, 11.2, 11.2 + RW], [10.4, xT, 11.2, 11.2 + RW], [xT, xT + RW, pz0 + 0.2, 6.5], [xT, xT + RW, 8.1, pz1 - 0.2], [17, px1 - 0.2, 8.6, 8.6 + RW]];
  const scaffold = () => {
    const o = 0.9, a = [ux0 - o, vx1 + o, vz0 - o, vz1 + o];
    for (const [ax, bx, az, bz] of [[a[0], a[1], a[2] - 0.7, a[2]], [a[0], a[1], a[3], a[3] + 0.7], [a[0] - 0.7, a[0], a[2], a[3]], [a[1], a[1] + 0.7, a[2], a[3]]]) {
      fill(ax, bx, az, bz, 'rgba(176,138,85,0.85)');
      const along = bx - ax > bz - az;
      for (let t = along ? ax : az; t < (along ? bx : bz); t += 2) along ? line(t, az, t, bz, '#4f5d6b', 0.06) : line(ax, t, bx, t, '#4f5d6b', 0.06);
      rect(ax, bx, az, bz, '#4f5d6b', 0.05);
    }
  };
  const pipes = (alpha = 1) => { // services on the slab, in their real colours
    const poly = (pts, c, wd, dash) => { g.save(); if (dash) g.setLineDash(dash.map(M)); g.strokeStyle = c; g.lineWidth = M(wd); g.lineJoin = 'round'; g.globalAlpha = alpha; g.beginPath(); pts.forEach(([x, z], k) => (k ? g.lineTo(X(x), Y(z)) : g.moveTo(X(x), Y(z)))); g.stroke(); g.restore(); };
    ROUTES.drain.forEach(p => poly(p, '#8a8f94', 0.16));
    ROUTES.water.forEach(p => poly(p, '#2f7bd2', 0.08));
    ROUTES.pool.forEach(p => poly(p, '#2f7bd2', 0.1, [0.4, 0.2]));
    ROUTES.power.forEach(p => poly(p, '#f2a516', 0.07));
    g.save(); g.globalAlpha = alpha; g.strokeStyle = '#f2a516'; g.lineWidth = M(0.05);
    for (const [x, z] of ROUTES.points) { g.beginPath(); g.moveTo(X(DB[0]), Y(DB[1])); g.quadraticCurveTo(X((x + DB[0]) / 2), Y(Math.min(z, DB[1]) - 1.5), X(x), Y(z)); g.stroke(); fill(x - 0.15, x + 0.15, z - 0.15, z + 0.15, '#f2a516'); }
    g.restore();
    fill(DB[0] - 0.3, DB[0] + 0.3, DB[1] - 0.2, DB[1] + 0.2, '#2b2b2b');
  };

  // ---------- land ----------
  paintGround(P, L);
  if (i === 0) earth(px0, px1, pz0, pz1, '#d9cdae', 6);
  else {
    earth(px0, px1, pz0, pz1, '#cdbf9f', 10);            // top platform: cut and compacted
    earth(-17, xT, 11.7, pz1, '#bfae8b', 12);             // garden terrace −1.50
    earth(xT, px1, pz0, pz1, '#c4b597', 10);              // courts terraces
  }

  if (i === 0) {
    // ---------- 01 setting out: string lines, pegs, spray marks, a surveyor ----------
    string(vx0, vx1, vz0, vz1); string(ux0, vx0, vz0, vz1); string(qx0, qx1, qz0, qz1);
    string(...L.TENNIS); string(...L.BASKET); string(...L.CARPORT); string(dx0, dx1, ddz0, dz1);
    g.save(); g.setLineDash([M(0.6), M(0.3)]); rect(px0 + 0.1, px1 - 0.1, pz0 + 0.1, pz1 - 0.1, 'rgba(217,79,30,0.8)', 0.06); g.restore();
    for (const x of L.CX) for (const z of L.CZ) { line(x - 0.35, z - 0.35, x + 0.35, z + 0.35, '#fff', 0.08); line(x - 0.35, z + 0.35, x + 0.35, z - 0.35, '#fff', 0.08); }
    for (const [ax, bx, az, bz] of RETAIN) { g.save(); g.setLineDash([M(0.4), M(0.3)]); line(ax, (az + bz) / 2, bx, (az + bz) / 2, 'rgba(255,255,255,0.9)', 0.08); line((ax + bx) / 2, az, (ax + bx) / 2, bz, 'rgba(255,255,255,0.9)', 0.08); g.restore(); }
    // total station on a tripod + surveyor, and the prism pole
    shadowCircle(-13.5, 4, 0.7, 0.6, 0.25);
    for (let k = 0; k < 3; k++) { const a = k * 2.1; line(-13.5, 4, -13.5 + Math.cos(a) * 0.7, 4 + Math.sin(a) * 0.7, '#f2b31b', 0.07); }
    fill(-13.7, -13.3, 3.8, 4.2, '#f2b31b'); T.worker(-14.4, 4.6); T.worker(-3.5, -3, '#d94f1e');
    trees(); treeFence();
    return;
  }

  // ---------- pits, drive base, court pads ----------
  tiles(dx0, dx1, ddz0, dz1, 0.5, 0.5, '#b8ae9c', 'rgba(255,255,255,0)', 0.08); // gravel sub-base
  speckle(dx0, dx1, ddz0, dz1, (dx1 - dx0) * (dz1 - ddz0) * 40, 'rgba(70,60,50,0.3)', 0.07);
  for (const [ax, bx, az, bz] of [L.TENNIS, L.BASKET]) { fill(ax, bx, az, bz, i >= 5 ? '#3b3d3f' : '#c2bbac'); speckle(ax, bx, az, bz, (bx - ax) * (bz - az) * 25, i >= 5 ? 'rgba(255,255,255,0.08)' : 'rgba(80,70,55,0.25)', 0.07); }

  if (i <= 2) pit(VPIT[0], VPIT[1], VPIT[2], VPIT[3], '#ad9067');
  pit(qx0 - 0.6, qx1 + 0.6, qz0 - 0.6, qz1 + 0.6, '#a2845c');
  if (i === 1) { tracks(VPIT[0], VPIT[1], VPIT[2], VPIT[3]); tracks(-26, -14, -16, 22); }

  // ---------- retaining walls: footings first, then stone ----------
  for (const [ax, bx, az, bz] of RETAIN) {
    if (i === 2) { fill(ax - 0.3, bx + 0.3, az - 0.3, bz + 0.3, '#c9c6be'); rebar(ax - 0.3, bx + 0.3, az - 0.3, bz + 0.3, 0.2); }
    if (i >= 3) { shadowRect(ax, bx, az, bz, 0.9, 0.35); stone(ax, bx, az, bz); }
  }
  if (i >= 3) boundary(i >= 5 ? '#ebe6dc' : '#b9b6ae');

  // ---------- villa ----------
  if (i === 2) {
    // blinding, footings, ground-beam formwork, slab rebar going down
    concrete(vx0, vx1, vz0, vz1, '#cfccc4', 4);
    for (const x of L.CX) for (const z of L.CZ) { fill(x - 0.9, x + 0.9, z - 0.9, z + 0.9, '#a9a59c'); rebar(x - 0.9, x + 0.9, z - 0.9, z + 0.9, 0.18); fill(x - 0.2, x + 0.2, z - 0.2, z + 0.2, '#6d5240'); }
    for (const z of L.CZ) { fill(vx0, vx1, z - 0.25, z + 0.25, '#c49a62'); fill(vx0, vx1, z - 0.15, z + 0.15, '#7a6b5c'); }
    for (const x of L.CX) { fill(x - 0.25, x + 0.25, vz0, vz1, '#c49a62'); fill(x - 0.15, x + 0.15, vz0, vz1, '#7a6b5c'); }
    rebar(2, vx1, vz0, vz1, 0.3);
    rebar(qx0 - 0.4, qx1 + 0.4, qz0 - 0.4, qz1 + 0.4, 0.3);
    T.mixer(-21, 2, Math.PI); T.excavator(-6, 8.5, -0.4, 0.8);
    for (const [x, z] of [[-4, -9], [3.4, -3], [9, -11], [12, -4], [-8, -2]]) T.worker(x, z, r() > 0.5 ? '#d94f1e' : '#f7f5ef');
    T.pile(-26, 13, 2.6); T.pile(-23.5, 17.5, 1.8);
  }
  if (i >= 3) {
    // backfilled platform, ground slab, columns, stair core and lift shaft
    concrete(ux0, vx1, vz0, vz1, i >= 5 ? '#c7c3bb' : '#bdbab3', 2.4);
    columns();
    fill(-3.85, -1.05, -13.85, -8.1, '#a8a49c'); fill(-3.6, -1.3, -13.6, -8.35, '#c6c2ba');
    for (let z = -12.4; z <= -8.2; z += 0.28) line(-3.6, z, -1.3, z, 'rgba(80,78,72,0.5)', 0.02);
    fill(-0.85, 0.85, -13.85, -12.15, '#8e8b84'); fill(-0.65, 0.65, -13.65, -12.35, '#5c5a55');
    // beams above, dashed
    g.save(); g.setLineDash([M(0.4), M(0.25)]);
    for (const z of L.CZ) line(ux0, z, vx1, z, 'rgba(60,58,54,0.55)', 0.05);
    for (const x of L.CX) line(x, vz0, x, vz1, 'rgba(60,58,54,0.55)', 0.05);
    g.restore();
    // pool: concrete shell, then waterproofed and tiled
    fill(qx0 - 0.3, qx1 + 0.3, qz0 - 0.3, qz1 + 0.3, '#a9a59d');
    fill(qx0, qx1, qz0, qz1, i >= 5 ? '#8fc5d2' : '#b8b4ac');
    if (i >= 5) tiles(qx0, qx1, qz0, qz1, 0.5, 0.5, '#9fd0db', 'rgba(255,255,255,0.4)', 0.03);
  }
  if (i === 3) {
    for (const [x, z] of [[-14, -14], [-14, 0]]) fill(x - 0.2, x + 0.2, z - 0.2, z + 0.2, '#7d7a73'); // cantilever columns
    // formwork props for the first-floor slab over the east bays
    for (let x = 8.6; x < 14; x += 1.2) for (let z = -13.4; z < 0; z += 1.2) circle(x, z, 0.08, '#5a6b7a');
    fill(8.2, 14, -14, -12.8, 'rgba(196,154,98,0.9)'); fill(8.2, 14, -1.2, 0, 'rgba(196,154,98,0.9)');
    T.crane(-12, 5, -0.55, 36); T.mixer(-21, 0, Math.PI); T.pallets(-8.5, 2.5, 2, 2, '#9c9890');
    for (const [x, z] of [[-6, -9], [0, -3], [5, -10], [10, -5], [12.5, -9.5], [-2, -5.5]]) T.worker(x, z, r() > 0.4 ? '#d94f1e' : '#f7f5ef');
  }
  if (i === 4) {
    walls('#9d8f7b'); scaffold();
    T.crane(-12, 5, 0.25, 36); T.pallets(-8, 2.5, 3, 2); T.pallets(4, 2.5, 2, 2); T.pile(-23, 14, 1.8, '#e4d7b8', '#c4b28d');
    for (const [x, z] of [[-6, -6.4], [2, -7.6], [9, -6.5], [12, -11], [-9, -11], [4.6, -13]]) T.worker(x, z, r() > 0.4 ? '#d94f1e' : '#f7f5ef');
    T.truck(-21, 4, Math.PI, '#b9b3a6');
  }
  if (i === 5) {
    pipes(); walls('#f1eee8', false);
    // terrace: sand bed going down; garden: topsoil; driveway edge kerbs set
    earth(-10, 14, 0.2, 10.6, '#d9c9a2', 8); fill(qx0 - 0.6, qx1 + 0.6, qz0 - 0.6, qz1 + 0.6, '#efe9dd'); fill(qx0, qx1, qz0, qz1, '#8fc5d2');
    tiles(qx0, qx1, qz0, qz1, 0.5, 0.5, '#9fd0db', 'rgba(255,255,255,0.4)', 0.03);
    earth(-17, xT, 11.7, pz1, '#6e5a43', 18);
    fill(dx0 - 0.2, dx0, ddz0, dz1, '#e7e2d8'); fill(dx1, dx1 + 0.2, ddz0, dz1, '#e7e2d8');
    T.pile(-1, 6, 1.4, '#e8dcbf', '#c9b994'); T.pallets(-8.5, 3, 2, 1, '#e6d9c2');
    for (const [x, z] of [[-6, -4], [3, -10], [10, -3], [-2, 6.5], [5, 16]]) T.worker(x, z, r() > 0.4 ? '#d94f1e' : '#f7f5ef');
    T.truck(-21, 6, Math.PI, '#d6c8a5');
  }
  if (i <= 2 && i >= 1) { T.excavator(3, -6, 0.3, -0.9); T.truck(-21, 8, Math.PI); T.pile(-26, 13, 2.6); for (const [x, z] of [[-6, -10], [8, -3]]) T.worker(x, z); }

  trees();
  if (i <= 4) treeFence();
  for (const [x, z, rr] of HEDGE) if (i >= 5) { shadowCircle(x, z, rr * 0.6, 0.4, 0.25); circle(x, z, rr * 0.6, '#5d7b44'); } // young hedge planted
}

// ---------- X-ray: R structure, G plumbing, B electrical, glowing lines on black ----------
export function drawTrades(canvas, L, s) {
  const { x0, z0, w, h } = SHEET;
  canvas.width = Math.round(w * s); canvas.height = Math.round(h * s);
  const g = canvas.getContext('2d');
  const X = x => (x - x0) * s, Y = z => (z - z0) * s, M = m => m * s;
  g.fillStyle = '#000'; g.fillRect(0, 0, canvas.width, canvas.height);
  g.globalCompositeOperation = 'lighter'; g.lineJoin = 'round'; g.lineCap = 'round';
  const pass = (draw) => { g.save(); g.filter = `blur(${M(0.45)}px)`; g.globalAlpha = 0.9; draw(3.2); g.restore(); g.save(); draw(1.7); g.restore(); };
  const poly = (pts, c, wd, dash) => { g.strokeStyle = c; g.lineWidth = M(wd); g.setLineDash(dash ? dash.map(M) : []); g.beginPath(); pts.forEach(([x, z], k) => (k ? g.lineTo(X(x), Y(z)) : g.moveTo(X(x), Y(z)))); g.stroke(); };
  const box = (ax, bx, az, bz, c, wd, dash) => poly([[ax, az], [bx, az], [bx, bz], [ax, bz], [ax, az]], c, wd, dash);
  const dot = (x, z, rad, c) => { g.fillStyle = c; g.beginPath(); g.arc(X(x), Y(z), M(rad), 0, Math.PI * 2); g.fill(); };

  const [vx0, vx1, vz0, vz1] = L.VILLA, [ux0] = L.UPPER, [qx0, qx1, qz0, qz1] = L.POOL;
  // structure (red)
  const R = 'rgb(255,0,0)', Rd = 'rgb(140,0,0)';
  pass(k => {
    for (const z of L.CZ) poly([[ux0, z], [vx1, z]], R, 0.14 * k);
    for (const x of L.CX) poly([[x, vz0], [x, vz1]], R, 0.14 * k);
    poly([[ux0, vz0], [ux0, vz1]], R, 0.14 * k);
    box(ux0, vx1, vz0, vz1, R, 0.08 * k);
    box(-3.85, -1.05, -13.85, -8.1, R, 0.08 * k); box(-0.85, 0.85, -13.85, -12.15, R, 0.08 * k);
    box(qx0 - 0.3, qx1 + 0.3, qz0 - 0.3, qz1 + 0.3, R, 0.1 * k); box(qx0, qx1, qz0, qz1, Rd, 0.06 * k);
    for (const [ax, bx, az, bz] of [[-17, 8.2, 11.2, 11.7], [10.4, 15.6, 11.2, 11.7], [15.6, 16.1, -21.8, 6.5], [15.6, 16.1, 8.1, 21.8], [17, 29.8, 8.6, 9.1]]) box(ax, bx, az, bz, R, 0.08 * k);
  });
  for (const x of [...L.CX, ux0]) for (const z of L.CZ) { g.fillStyle = R; g.fillRect(X(x - 0.22), Y(z - 0.22), M(0.44), M(0.44)); box(x - 0.9, x + 0.9, z - 0.9, z + 0.9, Rd, 0.04, [0.2, 0.15]); }
  // plumbing (green): supply solid, drains dashed and fainter, pool loop, irrigation dotted
  const G = 'rgb(0,255,0)', Gd = 'rgb(0,205,0)';
  pass(k => {
    ROUTES.water.forEach(p => poly(p, G, 0.09 * k));
    ROUTES.drain.forEach(p => poly(p, Gd, 0.14 * k, [0.5, 0.3]));
    ROUTES.pool.forEach(p => poly(p, G, 0.09 * k));
    ROUTES.irrigation.forEach(p => poly(p, Gd, 0.05 * k, [0.1, 0.4]));
  });
  for (const [x, z] of [[-9.65, -13.2], [-8.3, -13.5], [2.6, -13.5], [8.5, -13.4], [9.2, -13.4], [10.1, -13.5], [12.1, -7.6], [13.4, -8.3], [15, -12.6]]) dot(x, z, 0.2, G);
  box(10.9, 11.9, 9.2, 10.1, G, 0.06);
  // electrical (blue): mains and outdoor feeders, homeruns from the DB to every ceiling point
  const B = 'rgb(0,0,255)', Bd = 'rgb(0,0,150)';
  pass(k => {
    ROUTES.power.forEach(p => poly(p, B, 0.08 * k));
    g.strokeStyle = Bd; g.lineWidth = M(0.05 * k); g.setLineDash([]);
    for (const [x, z] of ROUTES.points) { g.beginPath(); g.moveTo(X(DB[0]), Y(DB[1])); g.quadraticCurveTo(X((x + DB[0]) / 2), Y(Math.min(z, DB[1]) - 1.5), X(x), Y(z)); g.stroke(); }
  });
  for (const [x, z] of ROUTES.points) { dot(x, z, 0.22, B); }
  for (const [x, z] of ROUTES.outdoor) dot(x, z, 0.28, B);
  g.fillStyle = B; g.fillRect(X(DB[0] - 0.35), Y(DB[1] - 0.25), M(0.7), M(0.5));
}
