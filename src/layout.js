// The DAR concept villa's site layout, in world metres. Shared by the 3D scene, the CAD sheet
// (plan-drawing.js) and the "as built" rendered plan (plan-finished.js), so all three line up exactly.
// Rects are [x0, x1, z0, z1]; +z faces the street.
export const CX = [-10, -4, 2, 8, 14], CZ = [-14, -7, 0]; // column grid: 6 m bays, 7 m deep
export const VILLA = [-10, 14, -14, 0]; // 24 x 14 m ground floor (336 m2)
export const UPPER = [-14, 14, -14, 0]; // first floor cantilevers 4 m to the west, over the entry porch
export const VPIT = [-11, 15, -15, 1];
export const POOL = [-4, 10, 4, 9];
export const TENNIS = [17, 29, -21, 6]; // full tennis court 10.97 x 23.77 m with run-off, fenced
export const BASKET = [17, 29, 9, 21]; // basketball half court 12 x 12 m
export const CARPORT = [-27, -15, -14, -4];
export const DRIVE = [-24, -18, -4, 22];
export const PLOT = [-30, 30, -22, 22];
export const LAYOUT = { VILLA, UPPER, POOL, TENNIS, BASKET, CARPORT, DRIVE, PLOT, CX, CZ };

// Trees on the site plan: [x, z, canopy radius], plus the hedge of small trees along the north wall.
export const TREES = [[-12, 10, 1.6], [-12, 16, 1.4], [14, 14, 1.6], [-2, 18, 2.1], [-28, 18, 1.9], [-28, -20, 1.5], [12, -19, 2], [-14, -19, 1.6], [7, 19, 1.2], [8, 20, 1.3], [-10, -19.5, 1.1]];
export const HEDGE = [];
for (let x = -12; x < 14; x += 1.1) HEDGE.push([x, -20.6, 0.55]);

// Ground-floor walls [x0, x1, z0, z1]: block exterior (EW) on the north, entry and service sides,
// interior partitions (IW). Openings are the gaps. Used by the CAD sheet and the masonry stage.
const EW = 0.25, IW = 0.12;
const [vx0, vx1, vz0] = VILLA;
const wx = (a, b, z, t = IW) => [a, b, z - t / 2, z + t / 2]; // wall running along x at z
const wz = (a, b, x, t = IW) => [x - t / 2, x + t / 2, a, b]; // wall running along z at x
export const WALLS = [
  [vx0, vx1, vz0, vz0 + EW],
  [vx0, vx0 + EW, vz0, -10.5], [vx0, vx0 + EW, -8.7, -7], // west, double entry door -10.5..-8.7
  [vx1 - EW, vx1, vz0, -10], [vx1 - EW, vx1, -8.8, -7], // east, service door -10..-8.8
  wx(vx0, -6, -7, 0.15), wx(1, 3, -7, 0.15), wx(6, vx1, -7, 0.15), // band wall with openings to the living spaces
  wx(vx0, -9.6, -11.6), wx(-8.8, -7.8, -11.6), wz(vz0, -11.6, -7.8), // powder room
  wz(vz0, -9, 1, 0.15), wz(-8, -7, 1, 0.15), // stair hall | kitchen
  wz(vz0, -10, 8, 0.15), wz(-8.8, -7, 8, 0.15), // kitchen | service corridor
  wx(8, 9, -10), wx(9.9, 11, -10), wx(11.9, vx1, -10), wz(vz0, -10, 10.6), // laundry | maid's room
  wx(8, 8.4, -8.8), wx(9.2, 12.4, -8.8), wx(13.2, vx1, -8.8), wz(-8.8, -7, 11.6), // store | maid's bath
  [5.85, 6.15, -7, -3.5], // TV wall between dining and family living
];
