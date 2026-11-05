// The opening shot: an architectural ground-floor + site plan of the DAR villa, drawn on a canvas
// in world metres (1 canvas unit = 1 m × s px), in the style of a printed CAD sheet:
// black ink on white paper, axis grid with bubbles, dimension strings, furniture, cars, trees, title block.
// The layout passed in is the same one the 3D scene builds, so the drawing matches the villa exactly.

const INK = '#1b1b1b', MID = '#5d5d5d', LIGHT = '#a3a09a', HAIR = '#c9c6bf', PAPER = '#f7f6f2', ORANGE = '#d94f1e';

export const SHEET = { x0: -38, z0: -30, w: 76, h: 60 };

export function drawSitePlan(canvas, L, s, font = 'Archivo, Arial, sans-serif') {
  const { x0, z0, w, h } = SHEET;
  canvas.width = Math.round(w * s); canvas.height = Math.round(h * s);
  const g = canvas.getContext('2d');
  // Older iOS Safari (before 16) has no roundRect: fall back to a plain rectangle so the sheet still draws.
  if (!g.roundRect) g.roundRect = function (x, y, w, h) { this.rect(x, y, w, h); };
  const X = x => (x - x0) * s, Y = z => (z - z0) * s, M = m => m * s;

  // Line weights and text are scaled up from true print size so the sheet reads at full-screen size.
  const stroke = (color, width, dash) => { g.strokeStyle = color; g.lineWidth = Math.max(1.5, M(width * 1.7)); g.setLineDash(dash ? dash.map(M) : []); };
  const line = (ax, az, bx, bz) => { g.beginPath(); g.moveTo(X(ax), Y(az)); g.lineTo(X(bx), Y(bz)); g.stroke(); };
  const rect = (ax, bx, az, bz) => g.strokeRect(X(ax), Y(az), M(bx - ax), M(bz - az));
  const fill = (ax, bx, az, bz, c) => { g.fillStyle = c; g.fillRect(X(ax), Y(az), M(bx - ax), M(bz - az)); };
  const circle = (cx, cz, r, doFill) => { g.beginPath(); g.arc(X(cx), Y(cz), M(r), 0, Math.PI * 2); doFill ? g.fill() : g.stroke(); };
  const text = (str, x, z, size, { align = 'center', weight = 500, color = INK, spacing = 0.12, rot = 0, base = 'middle' } = {}) => {
    g.save(); g.translate(X(x), Y(z)); if (rot) g.rotate(rot);
    g.fillStyle = color; g.font = `${weight} ${M(size * 1.2)}px ${font}`; g.textAlign = align; g.textBaseline = base;
    if ('letterSpacing' in g) g.letterSpacing = `${M(size * spacing)}px`;
    g.fillText(str, 0, 0); g.restore();
  };
  const hatch = (ax, bx, az, bz, step, color, width) => {
    g.save(); g.beginPath(); g.rect(X(ax), Y(az), M(bx - ax), M(bz - az)); g.clip();
    stroke(color, width);
    for (let d = -(bz - az); d < bx - ax; d += step) line(ax + d, bz, ax + d + (bz - az), az);
    g.restore();
  };

  // Paper
  g.fillStyle = PAPER; g.fillRect(0, 0, canvas.width, canvas.height);
  stroke(INK, 0.05); rect(-37, 37, -29, 29);
  stroke(INK, 0.02); rect(-36.6, 36.6, -28.6, 28.6);

  // ---------- axis grid with bubbles ----------
  const AX = [L.UPPER[0], ...L.CX], AZ = L.CZ, NUM = AX.map((_, i) => String(i + 1)), LET = ['A', 'B', 'C'];
  stroke(HAIR, 0.03, [0.6, 0.3]);
  AX.forEach(x => line(x, -26.2, x, 26.2));
  AZ.forEach(z => line(-34.6, z, 34.6, z));
  g.setLineDash([]);
  const bubble = (x, z, label) => { g.fillStyle = PAPER; circle(x, z, 0.75, true); stroke(INK, 0.04); circle(x, z, 0.75); text(label, x, z + 0.04, 0.7, { weight: 600, spacing: 0 }); };
  AX.forEach((x, i) => { bubble(x, -27.2, NUM[i]); bubble(x, 27.2, NUM[i]); });
  AZ.forEach((z, i) => { bubble(-35.6, z, LET[i]); bubble(35.6, z, LET[i]); });

  // ---------- dimension strings ----------
  const dimH = (a, b, z, label) => {
    stroke(MID, 0.025); line(a, z, b, z);
    for (const x of [a, b]) { line(x - 0.25, z + 0.25, x + 0.25, z - 0.25); stroke(LIGHT, 0.02); line(x, z - 0.5, x, z + 0.5); stroke(MID, 0.025); }
    text(label, (a + b) / 2, z - 0.42, 0.55, { color: MID, spacing: 0.05 });
  };
  const dimV = (a, b, x, label) => {
    stroke(MID, 0.025); line(x, a, x, b);
    for (const z of [a, b]) { line(x - 0.25, z + 0.25, x + 0.25, z - 0.25); stroke(LIGHT, 0.02); line(x - 0.5, z, x + 0.5, z); stroke(MID, 0.025); }
    text(label, x - 0.42, (a + b) / 2, 0.55, { color: MID, spacing: 0.05, rot: -Math.PI / 2 });
  };
  const fmt = v => v.toFixed(2);
  for (let i = 0; i < AX.length - 1; i++) dimH(AX[i], AX[i + 1], -24.6, fmt(AX[i + 1] - AX[i]));
  dimH(AX[0], AX[AX.length - 1], -25.6, fmt(AX[AX.length - 1] - AX[0]));
  for (let i = 0; i < AZ.length - 1; i++) dimV(AZ[i], AZ[i + 1], -33.2, fmt(AZ[i + 1] - AZ[i]));
  dimV(AZ[0], AZ[AZ.length - 1], -34.2, fmt(AZ[AZ.length - 1] - AZ[0]));
  dimH(L.PLOT[0], L.PLOT[1], 24.6, fmt(L.PLOT[1] - L.PLOT[0]));
  dimV(L.PLOT[2], L.PLOT[3], 33.2, fmt(L.PLOT[3] - L.PLOT[2]));

  // ---------- site: stone boundary wall and sliding gate ----------
  const [px0, px1, pz0, pz1] = L.PLOT, t = 0.4;
  const [dx0, dx1, , dz1] = L.DRIVE;
  // modern rendered boundary wall with slatted infill
  const wallSeg = (ax, bx, az, bz) => { fill(ax, bx, az, bz, PAPER); stroke(INK, 0.05); rect(ax, bx, az, bz); };
  wallSeg(px0, px1, pz0 - t / 2, pz0 + t / 2);
  wallSeg(px0 - t / 2, px0 + t / 2, pz0, pz1);
  wallSeg(px1 - t / 2, px1 + t / 2, pz0, pz1);
  wallSeg(px0, dx0, pz1 - t / 2, pz1 + t / 2);
  wallSeg(dx1, px1, pz1 - t / 2, pz1 + t / 2);
  stroke(INK, 0.06); line(dx0, pz1 + 0.5, dx1, pz1 + 0.5);
  stroke(MID, 0.025, [0.3, 0.2]); line(dx1, pz1 + 0.5, dx1 + 6, pz1 + 0.5); g.setLineDash([]);
  text('SLIDING GATE', (dx0 + dx1) / 2, pz1 + 1.3, 0.5, { color: MID });

  // ---------- driveway pavers ----------
  const [, , ddz0] = L.DRIVE;
  fill(dx0, dx1, ddz0, dz1, '#efede8');
  stroke(HAIR, 0.015);
  for (let x = dx0; x <= dx1; x += 0.6) line(x, ddz0, x, dz1);
  for (let z = ddz0; z <= dz1; z += 1.2) line(dx0, z, dx1, z);
  stroke(INK, 0.03); line(dx0, ddz0, dx0, dz1); line(dx1, ddz0, dx1, dz1);
  text('DRIVEWAY', (dx0 + dx1) / 2, 10, 0.75, { rot: -Math.PI / 2, weight: 600, spacing: 0.3 });
  stroke(INK, 0.04); line((dx0 + dx1) / 2, 17, (dx0 + dx1) / 2, 14); line((dx0 + dx1) / 2 - 0.4, 14.6, (dx0 + dx1) / 2, 14); line((dx0 + dx1) / 2 + 0.4, 14.6, (dx0 + dx1) / 2, 14);

  // ---------- covered parking: pergola, 3 bays, cars ----------
  const [cx0, cx1, cz0, cz1] = L.CARPORT;
  fill(cx0, cx1, cz0, cz1, '#f1efea');
  stroke(LIGHT, 0.015); for (let z = cz0 + 0.3; z < cz1; z += 0.6) line(cx0, z, cx1, z);
  stroke(INK, 0.04, [0.5, 0.25]); rect(cx0, cx1, cz0, cz1); g.setLineDash([]);
  stroke(INK, 0.035); for (let x = cx0 + 4; x < cx1; x += 4) line(x, cz0 + 0.4, x, cz1 - 0.4);
  g.fillStyle = INK; for (const x of [cx0 + 0.2, cx1 - 0.2]) for (const z of [cz0 + 0.2, cz1 - 0.2]) g.fillRect(X(x - 0.15), Y(z - 0.15), M(0.3), M(0.3));
  const car = cx => {
    const w2 = 0.95, l2 = 2.35, cz = (cz0 + cz1) / 2;
    g.fillStyle = PAPER; stroke(INK, 0.045);
    g.beginPath(); g.roundRect(X(cx - w2), Y(cz - l2), M(w2 * 2), M(l2 * 2), M(0.45)); g.fill(); g.stroke();
    stroke(INK, 0.03);
    g.beginPath(); g.roundRect(X(cx - 0.72), Y(cz - 1.05), M(1.44), M(2.2), M(0.3)); g.stroke();
    line(cx - 0.72, cz - 0.35, cx + 0.72, cz - 0.35); line(cx - 0.72, cz + 0.75, cx + 0.72, cz + 0.75);
    line(cx - w2, cz - 1.6, cx - w2 - 0.25, cz - 1.45); line(cx + w2, cz - 1.6, cx + w2 + 0.25, cz - 1.45);
  };
  car(cx0 + 2); car(cx0 + 6);
  // third bay: ATV (quad bike), top view: body, seat, handlebar, four wheels
  const atv = (ax) => {
    const az = (cz0 + cz1) / 2;
    g.fillStyle = INK; for (const [dx, dz] of [[-0.62, -0.72], [0.38, -0.72], [-0.62, 0.42], [0.38, 0.42]]) g.fillRect(X(ax + dx), Y(az + dz), M(0.24), M(0.42));
    g.fillStyle = PAPER; stroke(INK, 0.04);
    g.beginPath(); g.roundRect(X(ax - 0.42), Y(az - 1.0), M(0.84), M(2.0), M(0.2)); g.fill(); g.stroke();
    stroke(INK, 0.025); g.beginPath(); g.roundRect(X(ax - 0.2), Y(az - 0.1), M(0.4), M(0.75), M(0.12)); g.stroke();
    stroke(INK, 0.04); line(ax - 0.55, az - 0.55, ax + 0.55, az - 0.55);
  };
  atv(cx0 + 10);
  text('COVERED PARKING · 2 CARS + ATV', (cx0 + cx1) / 2, cz1 + 1, 0.55, { weight: 600, spacing: 0.15 });
  // stepping stones from the parking to the villa entrance
  g.fillStyle = '#e6e3dc'; stroke(MID, 0.02);
  for (let x = cx1 + 0.8; x < L.UPPER[0] + 0.2; x += 1.4) { g.fillRect(X(x), Y(-9.95), M(0.9), M(0.7)); g.strokeRect(X(x), Y(-9.95), M(0.9), M(0.7)); }

  // ---------- terrace and pool ----------
  const [qx0, qx1, qz0, qz1] = L.POOL;
  stroke(HAIR, 0.015); for (let z = 0.2; z < qz0; z += 0.3) line(-4, z, 10, z);
  text('TERRACE', 3, 2, 0.6, { weight: 600, spacing: 0.3 });
  stroke(INK, 0.04); rect(qx0 - 0.6, qx1 + 0.6, qz0 - 0.6, qz1 + 0.6);
  fill(qx0, qx1, qz0, qz1, '#e4e8e8');
  hatch(qx0, qx1, qz0, qz1, 0.5, '#c7cfd0', 0.015);
  stroke(INK, 0.05); rect(qx0, qx1, qz0, qz1);
  stroke(MID, 0.02); for (let i = 1; i <= 3; i++) line(qx0, qz0 + i * 0.35, qx0 + 1.6, qz0 + i * 0.35);
  line(qx0 + 1.6, qz0, qx0 + 1.6, qz0 + 1.05);
  text('POOL', (qx0 + qx1) / 2, (qz0 + qz1) / 2, 0.7, { weight: 600, spacing: 0.4, color: MID });
  text('14.00 × 5.00', (qx0 + qx1) / 2, (qz0 + qz1) / 2 + 0.9, 0.45, { color: MID });
  const lounger = (x, z) => { g.fillStyle = PAPER; stroke(INK, 0.03); g.fillRect(X(x), Y(z), M(0.75), M(1.95)); g.strokeRect(X(x), Y(z), M(0.75), M(1.95)); line(x, z + 0.55, x + 0.75, z + 0.55); };
  lounger(-7.6, 4.4); lounger(-6.6, 4.4);
  text('SUNDECK', -7, 7.2, 0.45, { color: MID });

  // ---------- garden ----------
  const r = mulberry(5);
  g.fillStyle = '#c8c4bb';
  for (let i = 0; i < 260; i++) { const x = -4 + r() * 14, z = 11 + r() * 9; g.fillRect(X(x), Y(z), M(0.06), M(0.06)); }
  text('GARDEN', 3, 15.5, 0.6, { weight: 600, spacing: 0.3, color: MID });

  // ---------- tennis court (doubles 10.97 x 23.77 m) ----------
  const [tx0, tx1, tz0, tz1] = L.TENNIS, tcx = (tx0 + tx1) / 2, tcz = (tz0 + tz1) / 2;
  fill(tx0, tx1, tz0, tz1, '#eef0ea');
  stroke(MID, 0.025, [0.25, 0.2]); rect(tx0, tx1, tz0, tz1); g.setLineDash([]); // fence line
  const dx = 10.97 / 2, dz = 23.77 / 2, sx = dx - 1.37, sv = 6.4;
  stroke(INK, 0.045); rect(tcx - dx, tcx + dx, tcz - dz, tcz + dz);
  stroke(INK, 0.03); line(tcx - sx, tcz - dz, tcx - sx, tcz + dz); line(tcx + sx, tcz - dz, tcx + sx, tcz + dz);
  line(tcx - sx, tcz - sv, tcx + sx, tcz - sv); line(tcx - sx, tcz + sv, tcx + sx, tcz + sv); line(tcx, tcz - sv, tcx, tcz + sv);
  line(tcx, tcz - dz, tcx, tcz - dz + 0.25); line(tcx, tcz + dz, tcx, tcz + dz - 0.25);
  stroke(INK, 0.06); line(tcx - dx - 0.45, tcz, tcx + dx + 0.45, tcz); // net
  g.fillStyle = INK; circle(tcx - dx - 0.45, tcz, 0.12, true); circle(tcx + dx + 0.45, tcz, 0.12, true);
  g.fillStyle = INK; for (const x of [tx0, tx1]) for (const z of [tz0, tz1]) circle(x, z, 0.2, true); // floodlights
  text('TENNIS COURT', tcx, tcz - 9.6, 0.5, { weight: 700, spacing: 0.15 });
  text('10.97 × 23.77 · HARD COURT', tcx, tcz + 9.6, 0.38, { color: MID });
  text('TERRACE LEVEL −3.00', tcx, tcz + 10.4, 0.38, { weight: 700, spacing: 0.1 });

  // ---------- basketball half court (12 x 12 m) ----------
  const [bx0, bx1, bz0, bz1] = L.BASKET, bcx = (bx0 + bx1) / 2;
  fill(bx0, bx1, bz0, bz1, '#f1ece6');
  stroke(INK, 0.045); rect(bx0 + 0.3, bx1 - 0.3, bz0 + 0.3, bz1 - 0.3);
  const base = bz1 - 0.3, hz = base - 1.575;
  stroke(INK, 0.03);
  rect(bcx - 2.45, bcx + 2.45, base - 5.8, base); // key
  circle(bcx, base - 5.8, 1.8); // free-throw circle
  g.beginPath(); g.arc(X(bcx), Y(hz), M(6.75), Math.PI + 0.16, -0.16); g.stroke(); // three-point arc
  line(bx0 + 0.9, base, bx0 + 0.9, hz - 0.95); line(bx1 - 0.9, base, bx1 - 0.9, hz - 0.95);
  g.beginPath(); g.arc(X(bcx), Y(hz), M(1.25), Math.PI, 0); g.stroke(); // restricted area
  stroke(INK, 0.06); line(bcx - 0.9, base - 1.2, bcx + 0.9, base - 1.2); // backboard
  stroke(INK, 0.03); circle(bcx, hz, 0.23); // rim
  g.fillStyle = INK; circle(bcx, base + 0.15, 0.12, true); // post
  text('BASKETBALL', bcx, bz0 + 1.05, 0.5, { weight: 700, spacing: 0.15 });
  text('HALF COURT 12.00 × 12.00', bcx, bz0 + 1.8, 0.38, { color: MID });
  text('TERRACE LEVEL −4.50', bcx, bz0 + 2.5, 0.38, { weight: 700, spacing: 0.1 });

  // ---------- hillside: the plot falls to the south and east, cut into stone terraces ----------
  // Top platform ±0.00 (villa, terrace, pool, parking) · garden −1.50 · tennis −3.00 · basketball −4.50.
  const RW = 0.5; // stone retaining wall thickness
  const retain = (ax, bx, az, bz) => {
    fill(ax, bx, az, bz, PAPER);
    hatch(ax, bx, az, bz, 0.22, LIGHT, 0.015);
    stroke(INK, 0.045); rect(ax, bx, az, bz);
  };
  const xT = 15.6; // wall between the house platform / garden and the courts
  // walls open where a stair passes through them
  retain(-17, 8.2, 11.2, 11.2 + RW); retain(10.4, xT, 11.2, 11.2 + RW); // platform → garden (stair 8.2–10.4)
  retain(xT, xT + RW, pz0 + t / 2, 6.5); retain(xT, xT + RW, 8.1, pz1 - t / 2); // platform and garden → courts (stair 6.5–8.1)
  retain(17.0, px1 - t / 2, 8.6, 8.6 + RW); // tennis → basketball (stair 16.1–17.0)
  // the south boundary also holds the garden above the road
  hatch(px0 + 0.2, px1 - 0.2, pz1 - t / 2, pz1 + t / 2, 0.22, LIGHT, 0.015);
  // stairs between the levels: treads, direction arrow pointing down
  const stairZ = (x0s, x1s, z0s, z1s, n) => { // flight running along z (down towards +z)
    g.fillStyle = PAPER; g.fillRect(X(x0s), Y(z0s), M(x1s - x0s), M(z1s - z0s));
    stroke(INK, 0.02); rect(x0s, x1s, z0s, z1s);
    for (let i = 1; i < n; i++) { const z = z0s + ((z1s - z0s) * i) / n; line(x0s, z, x1s, z); }
    const xm = (x0s + x1s) / 2; stroke(INK, 0.03); line(xm, z0s + 0.2, xm, z1s - 0.25); line(xm - 0.25, z1s - 0.55, xm, z1s - 0.25); line(xm + 0.25, z1s - 0.55, xm, z1s - 0.25);
  };
  const stairX = (x0s, x1s, z0s, z1s, n) => { // flight running along x (down towards +x)
    g.fillStyle = PAPER; g.fillRect(X(x0s), Y(z0s), M(x1s - x0s), M(z1s - z0s));
    stroke(INK, 0.02); rect(x0s, x1s, z0s, z1s);
    for (let i = 1; i < n; i++) { const x = x0s + ((x1s - x0s) * i) / n; line(x, z0s, x, z1s); }
    const zm = (z0s + z1s) / 2; stroke(INK, 0.03); line(x0s + 0.2, zm, x1s - 0.25, zm); line(x1s - 0.55, zm - 0.25, x1s - 0.25, zm); line(x1s - 0.55, zm + 0.25, x1s - 0.25, zm);
  };
  stairZ(8.2, 10.4, 11.2, 13.9, 9); // terrace → garden, 9 risers
  stairX(xT, 21.4, 6.5, 8.1, 18); // platform → tennis, 18 risers
  stairZ(xT + RW, 17.0, 8.6, 11.3, 9); // tennis → basketball, 9 risers
  // level datums: cross-in-circle + value + what sits there
  const datum = (x, z, value, what) => {
    g.fillStyle = PAPER; circle(x, z, 0.3, true); stroke(INK, 0.025); circle(x, z, 0.3);
    line(x - 0.3, z, x + 0.3, z); line(x, z - 0.3, x, z + 0.3);
    g.fillStyle = INK; g.beginPath(); g.moveTo(X(x), Y(z)); g.arc(X(x), Y(z), M(0.3), -Math.PI / 2, 0); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(X(x), Y(z)); g.arc(X(x), Y(z), M(0.3), Math.PI / 2, Math.PI); g.closePath(); g.fill();
    text(value, x + 0.5, z - 0.12, 0.42, { align: 'left', weight: 700, spacing: 0.05 });
    if (what) text(what, x + 0.5, z + 0.5, 0.3, { align: 'left', color: MID, spacing: 0.1 });
  };
  datum(-12.8, 2.6, '±0.00', 'TOP PLATFORM');
  datum(-15.8, 13.3, '−1.50', 'GARDEN TERRACE');
  datum(-15.2, 23.5, '−3.00', 'ROAD AT GATE');
  text('STONE RETAINING WALL · H 1.50', -7.5, 12.35, 0.3, { color: MID, spacing: 0.1 });
  text('STONE RETAINING WALL · H 3.00', xT - 0.45, -3.6, 0.3, { color: MID, spacing: 0.1, rot: -Math.PI / 2 });
  // fall of the natural ground (towards the valley)
  stroke(MID, 0.03);
  for (const [ax, az] of [[31.7, -14], [31.7, 4]]) { line(ax, az, ax, az + 3); line(ax - 0.3, az + 2.5, ax, az + 3); line(ax + 0.3, az + 2.5, ax, az + 3); }
  text('FALL', 31.7, -14.8, 0.32, { color: MID, weight: 600 });

  // ---------- villa ----------
  const [vx0, vx1, vz0, vz1] = L.VILLA, [ux0] = L.UPPER;
  // first floor above (cantilever) dashed
  stroke(MID, 0.03, [0.45, 0.25]); rect(ux0, vx1, vz0, vz1); g.setLineDash([]);
  text('LINE OF FIRST FLOOR ABOVE', (ux0 + vx0) / 2, -3.5, 0.4, { rot: -Math.PI / 2, color: MID, spacing: 0.1 });
  fill(vx0, vx1, vz0, vz1, '#fbfaf7');
  const W = 0.3, w2 = 0.15;
  const wall = (ax, bx, az, bz) => fill(Math.min(ax, bx), Math.max(ax, bx), Math.min(az, bz), Math.max(az, bz), INK);
  // ===== Ground floor: salon, dining, family living, kitchen, service wing (Lebanese villa programme) =====
  const EW = 0.25, IW = 0.12;
  const wx = (x0, x1, z, t = IW) => wall(x0, x1, z - t / 2, z + t / 2); // wall running along x at z
  const wz = (z0, z1, x, t = IW) => wall(x - t / 2, x + t / 2, z0, z1); // wall running along z at x
  // exterior: block only on the north (service) side, the entry side and behind the service rooms
  wall(vx0, vx1, vz0, vz0 + EW);
  wall(vx0, vx0 + EW, vz0, -10.5); wall(vx0, vx0 + EW, -8.7, -7); // west, double entry door -10.5..-8.7
  wall(vx1 - EW, vx1, vz0, -10); wall(vx1 - EW, vx1, -8.8, -7); // east, service door -10..-8.8
  // glazing: double line + mullions every 2.5 m
  const glazeH = (ax, bx, z) => { stroke(INK, 0.02); line(ax, z - 0.1, bx, z - 0.1); line(ax, z + 0.06, bx, z + 0.06); stroke(INK, 0.04); const n = Math.round((bx - ax) / 2.5); for (let i = 0; i <= n; i++) { const x = ax + ((bx - ax) * i) / n; line(x, z - 0.15, x, z + 0.12); } };
  const glazeV = (x, az, bz) => { stroke(INK, 0.02); line(x - 0.06, az, x - 0.06, bz); line(x + 0.1, az, x + 0.1, bz); stroke(INK, 0.04); const n = Math.round((bz - az) / 2.4); for (let i = 0; i <= n; i++) { const z = az + ((bz - az) * i) / n; line(x - 0.12, z, x + 0.15, z); } };
  glazeH(vx0, vx1, vz1 - 0.12); glazeV(vx0 + 0.12, -7, vz1); glazeV(vx1 - 0.12, -7, vz1);
  // interior walls
  wx(vx0, -6, -7, 0.15); wx(1, 3, -7, 0.15); wx(6, vx1, -7, 0.15); // band wall: openings to salon (-6..-4), hall, dining/kitchen (3..6)
  wx(vx0, -9.6, -11.6); wx(-8.8, -7.8, -11.6); wz(vz0, -11.6, -7.8); // powder room, door -9.6..-8.8
  wz(vz0, -9, 1, 0.15); wz(-8, -7, 1, 0.15); // stair hall | kitchen, door -9..-8
  wz(vz0, -10, 8, 0.15); wz(-8.8, -7, 8, 0.15); // kitchen | service corridor, door -10..-8.8
  wx(8, 9, -10); wx(9.9, 11, -10); wx(11.9, vx1, -10); wz(vz0, -10, 10.6); // laundry | maid's room
  wx(8, 8.4, -8.8); wx(9.2, 12.4, -8.8); wx(13.2, vx1, -8.8); wz(-8.8, -7, 11.6); // store | maid's bath
  wall(5.85, 6.15, -7, -3.5); // TV wall between dining and family living
  // structure: columns on the 6 x 7 m grid
  g.fillStyle = INK; L.CX.forEach(x => L.CZ.forEach(z => g.fillRect(X(x - 0.2), Y(z - 0.2), M(0.4), M(0.4))));
  // doors: leaf + swing arc
  const door = (hx, hz, len, a0, a1) => {
    stroke(INK, 0.022); g.beginPath(); g.arc(X(hx), Y(hz), M(len), a0, a1, a1 < a0); g.stroke();
    stroke(INK, 0.04); line(hx, hz, hx + Math.cos(a1) * len, hz + Math.sin(a1) * len);
  };
  door(vx0 + EW, -10.5, 0.9, 0, Math.PI / 2); door(vx0 + EW, -8.7, 0.9, 0, -Math.PI / 2); // double entry door
  door(-9.6, -11.6, 0.8, 0, -Math.PI / 2); // powder room
  door(1, -9, 1.0, Math.PI / 2, 0); // hall -> kitchen
  door(8, -10, 1.0, Math.PI / 2, 0); // kitchen -> service corridor
  door(9, -10, 0.9, 0, -Math.PI / 2); // laundry
  door(11, -10, 0.9, 0, -Math.PI / 2); // maid's room
  door(8.4, -8.8, 0.8, 0, Math.PI / 2); // store
  door(12.4, -8.8, 0.8, 0, Math.PI / 2); // maid's bath
  door(vx1 - EW, -10, 1.0, Math.PI / 2, Math.PI); // service entrance
  // entry porch steps under the cantilever + arrows
  stroke(INK, 0.025); for (const x of [-10.5, -10.9, -11.3]) line(x, -11.1, x, -8.1);
  text('ENTRY PORCH', -12.3, -12.1, 0.42, { weight: 600, spacing: 0.15 });
  stroke(INK, 0.035); line(-13.6, -9.6, -11.6, -9.6); line(-12.0, -9.85, -11.6, -9.6); line(-12.0, -9.35, -11.6, -9.6);
  text('SERVICE', vx1 + 0.85, -12.2, 0.32, { color: MID, weight: 600, rot: -Math.PI / 2 });
  stroke(INK, 0.03); line(vx1 + 1.35, -9.4, vx1 + 0.4, -9.4); line(vx1 + 0.8, -9.65, vx1 + 0.4, -9.4); line(vx1 + 0.8, -9.15, vx1 + 0.4, -9.4);

  stroke(INK, 0.028); g.fillStyle = PAPER;
  // ---- U-shaped stair (two 1.2 m flights, landing), break line, UP arrow; lift ----
  rect(-3.75, -2.55, -12.4, -8.2); rect(-2.35, -1.15, -12.4, -8.2); rect(-3.75, -1.15, -13.75, -12.4);
  stroke(INK, 0.018); for (let z = -12.4; z <= -8.2; z += 0.28) { line(-3.75, z, -2.55, z); line(-2.35, z, -1.15, z); }
  stroke(INK, 0.03); line(-3.75, -10.1, -1.15, -11.0); // break line
  line(-3.15, -8.5, -3.15, -12.9); line(-3.15, -12.9, -1.75, -12.9); line(-1.75, -12.9, -1.75, -9.4);
  line(-2.0, -9.8, -1.75, -9.4); line(-1.5, -9.8, -1.75, -9.4);
  text('UP', -3.15, -7.85, 0.36, { weight: 700 });
  stroke(INK, 0.03); rect(-0.75, 0.75, -13.75, -12.25); line(-0.75, -13.75, 0.75, -12.25); line(-0.75, -12.25, 0.75, -13.75);
  text('LIFT', 0, -11.8, 0.34, { color: MID, weight: 600 });
  // ---- foyer: coat closet with hanging rod, console ----
  stroke(INK, 0.028); rect(-7.6, -5.4, -13.75, -13.15); stroke(MID, 0.015, [0.15, 0.1]); line(-7.5, -13.45, -5.5, -13.45); g.setLineDash([]);
  stroke(INK, 0.028); rect(-9.7, -8.1, -7.5, -7.1);
  // ---- powder room: WC + vanity ----
  g.beginPath(); g.ellipse(X(-9.65), Y(-13.2), M(0.2), M(0.28), 0, 0, Math.PI * 2); g.stroke(); rect(-9.9, -9.45, -13.75, -13.45);
  rect(-8.6, -7.95, -13.75, -13.25); circle(-8.27, -13.5, 0.15);
  // ---- kitchen: L counter with double sink and hob, tall fridge/pantry, island with stools ----
  rect(1.2, 7.8, -13.85, -13.25); rect(7.2, 7.8, -13.25, -10.4);
  rect(2.0, 3.2, -13.75, -13.35); line(2.6, -13.75, 2.6, -13.35); // double sink
  for (const [x, z] of [[5.3, -13.68], [5.75, -13.68], [5.3, -13.42], [5.75, -13.42]]) circle(x, z, 0.12); // hob
  rect(1.2, 2.0, -12.4, -10.9); line(1.2, -12.4, 2.0, -10.9); text('REF', 1.6, -11.2, 0.28, { color: MID }); // fridge
  rect(2.9, 6.1, -10.95, -9.85);
  for (const x of [3.5, 4.5, 5.5]) circle(x, -9.55, 0.2); // stools
  // ---- service wing: laundry, maid's room, store, maid's bath ----
  rect(8.2, 8.8, -13.8, -13.2); circle(8.5, -13.5, 0.22); rect(8.9, 9.5, -13.8, -13.2); circle(9.2, -13.5, 0.22); // washer + dryer
  rect(9.7, 10.45, -13.8, -13.3); // utility sink
  rect(12.9, 13.75, -13.8, -11.9); rect(11.5, 11.9, -13.8, -13.4); rect(10.8, 11.8, -11.0, -10.4); // maid's bed, side table, desk
  stroke(MID, 0.015); for (let x = 8.3; x < 11.4; x += 0.6) line(x, -8.65, x, -7.15); stroke(INK, 0.028); // store shelving
  rect(13.0, 13.75, -8.65, -7.9); line(13.0, -8.65, 13.75, -7.9); line(13.75, -8.65, 13.0, -7.9); // shower
  g.beginPath(); g.ellipse(X(12.1), Y(-7.5), M(0.18), M(0.25), 0, 0, Math.PI * 2); g.stroke(); rect(11.8, 12.4, -7.35, -7.1);
  // ---- salon: two sofas facing, two armchairs, coffee table, rug ----
  stroke(MID, 0.018, [0.25, 0.15]); rect(-9.0, -3.0, -6.3, -0.9); g.setLineDash([]);
  stroke(INK, 0.028);
  rect(-7.7, -4.3, -6.05, -5.15); rect(-7.7, -4.3, -2.05, -1.15); rect(-6.8, -5.2, -4.15, -3.05);
  rect(-9.35, -8.55, -4.0, -3.2); rect(-3.45, -2.65, -4.0, -3.2);
  // ---- dining: table for 10, sideboard ----
  rect(0.6, 4.4, -4.05, -2.95);
  for (const x of [1.0, 1.9, 2.8, 3.7]) { rect(x - 0.05, x + 0.4, -4.6, -4.15); rect(x - 0.05, x + 0.4, -2.85, -2.4); }
  rect(0.05, 0.5, -3.7, -3.3); rect(4.5, 4.95, -3.7, -3.3);
  rect(1.2, 2.8, -6.9, -6.45);
  // ---- family living: L sofa, coffee table, armchair, TV unit on the TV wall ----
  rect(8.1, 12.3, -5.85, -4.95); rect(12.45, 13.35, -5.0, -2.4); rect(9.3, 10.7, -3.9, -2.9);
  circle(8.6, -2.4, 0.45); rect(6.2, 6.55, -6.5, -4.0);
  // ---- covered terrace furniture (under the balcony) ----
  stroke(MID, 0.022); rect(-8.0, -5.4, 0.8, 1.9); for (const x of [-7.6, -6.7, -5.8]) { circle(x, 0.45, 0.2); circle(x, 2.25, 0.2); }
  rect(8.0, 11.0, 0.7, 1.4); rect(9.0, 10.0, 1.7, 2.3);
  // ---- finished floor levels ----
  const level = (x, z, label) => { stroke(INK, 0.02); circle(x, z, 0.22); line(x - 0.22, z, x + 0.22, z); line(x, z - 0.22, x, z + 0.22); text(label, x + 0.35, z, 0.3, { align: 'left', color: MID, spacing: 0 }); };
  level(-1.5, -5.6, '+0.15'); level(-8.9, -8.3, '+0.15'); level(10.2, -9.4, '+0.15'); level(-3.4, 1.3, '±0.00');
  // ---- room tags: name + area ----
  const room = (name, x, z, area, size = 0.46) => { text(name, x, z, size, { weight: 700, spacing: 0.22 }); if (area) text(area, x, z + size * 1.2, size * 0.74, { color: MID }); };
  room('FOYER', -6.4, -9.6, '24 m²');
  room('W.C.', -8.9, -12.5, '', 0.3);
  room('HALL', -1.0, -7.75, '');
  room('KITCHEN', 4.5, -11.9, '42 m²');
  room('LAUNDRY', 9.3, -11.6, '10 m²', 0.3);
  room('MAID', 11.6, -12.7, '14 m²', 0.32);
  room('STORE', 9.9, -7.6, '', 0.3);
  room('BATH', 12.5, -8.35, '', 0.26);
  room('SALON  ·  56 m²', -6.0, -0.72, '', 0.4);
  room('DINING', 2.5, -5.4, '56 m²');
  room('FAMILY LIVING', 10.2, -1.6, '56 m²');

  // ---------- trees and hedges ----------
  const tree = (x, z, rad) => {
    g.fillStyle = 'rgba(247,246,242,0.85)';
    circle(x, z, rad, true);
    stroke(INK, 0.03);
    const n = Math.round(rad * 9);
    g.beginPath();
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2, am = (a0 + a1) / 2;
      const cx = x + Math.cos(am) * rad, cz = z + Math.sin(am) * rad;
      g.moveTo(X(x + Math.cos(a0) * rad), Y(z + Math.sin(a0) * rad));
      g.quadraticCurveTo(X(cx + Math.cos(am) * rad * 0.18), Y(cz + Math.sin(am) * rad * 0.18), X(x + Math.cos(a1) * rad), Y(z + Math.sin(a1) * rad));
    }
    g.stroke();
    stroke(MID, 0.02); circle(x, z, rad * 0.45);
    g.fillStyle = INK; circle(x, z, 0.08, true);
  };
  [[-12, 10, 1.6], [-12, 16, 1.4], [14, 14, 1.6], [-2, 18, 2.1], [-28, 18, 1.9], [-28, -20, 1.5], [12, -19, 2], [-14, -19, 1.6], [7, 19, 1.2], [8, 20, 1.3], [-10, -19.5, 1.1]].forEach(([x, z, rr]) => tree(x, z, rr));
  for (let x = -12; x < 14; x += 1.1) tree(x, -20.6, 0.55);

  // ---------- north arrow and scale bar ----------
  stroke(INK, 0.04); circle(-32.5, 18, 1.1);
  g.fillStyle = INK; g.beginPath(); g.moveTo(X(-32.5), Y(16.6)); g.lineTo(X(-32.05), Y(18.3)); g.lineTo(X(-32.5), Y(17.9)); g.closePath(); g.fill();
  text('N', -32.5, 15.9, 0.6, { weight: 700 });
  for (let i = 0; i < 4; i++) fill(-34.5 + i * 2.5, -32 + i * 2.5, 24.4, 24.8, i % 2 ? PAPER : INK);
  stroke(INK, 0.02); rect(-34.5, -24.5, 24.4, 24.8);
  ['0', '5', '10 m'].forEach((v, i) => text(v, -34.5 + i * 5, 25.4, 0.4, { color: MID }));

  // ---------- title block ----------
  const tb = [17, 36.6, 25.2, 28.6];
  stroke(INK, 0.04); rect(tb[0], tb[1], tb[2], tb[3]); line(25.6, tb[2], 25.6, tb[3]);
  // DAR mark
  stroke(ORANGE, 0.12); circle(18.6, 26.2, 0.38);
  g.fillStyle = ORANGE; g.fillRect(X(19.4), Y(25.6), M(0.16), M(2.4));
  text('DAR', 19.9, 26.7, 1.3, { align: 'left', weight: 800, spacing: 0.04 });
  text('TRADING & CONTRACTING', 19.9, 27.85, 0.28, { align: 'left', color: MID, spacing: 0.08 });
  text('PRIVATE VILLA', 26.1, 26.0, 0.55, { align: 'left', weight: 700, spacing: 0.12 });
  text('GROUND FLOOR & SITE PLAN', 26.1, 26.9, 0.45, { align: 'left', color: MID, spacing: 0.12 });
  text('SCALE 1:200   ·   A-101   ·   2026', 26.1, 27.8, 0.38, { align: 'left', color: MID, spacing: 0.1 });
}

function mulberry(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
