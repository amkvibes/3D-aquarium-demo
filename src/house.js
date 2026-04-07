/**
 * house.js — builds the L-shaped dollhouse floor plan.
 *
 * Grid layout (8 rooms, top-right cell absent = L-shape):
 *
 *       -19   -5    7   19
 *  -19   +----+----+
 *        | R1 | R2 |   ← top row: only left 2 columns
 *   -5   +----+----+----+
 *        | R3 | R4 | R5 |
 *    9   +----+----+----+
 *        | R6 | R7 | R8 |
 *   19   +----+----+----+
 */
import * as THREE from 'three';

// ── Constants ─────────────────────────────────────────────────────────────────
export const WALL_H  = 6;     // wall height
const WALL_T  = 0.32;         // wall thickness
const DOOR_W  = 3.8;          // doorway width (fish passage)

// Window cutout dimensions
const WIN_W   = 3.5;                   // opening width
const WIN_BOT = WALL_H * 0.23;         // ≈1.38  sill height
const WIN_TOP = WALL_H * 0.87;         // ≈5.22  lintel height

const C = [-19, -5,  7, 19];  // column x-boundaries
const R = [-19, -5,  9, 19];  // row    z-boundaries

// ── Fish movement bounds (L-shape) ────────────────────────────────────────────
export const HOUSE_BOUNDS = {
  xMin: C[0] + 0.5, xMax: C[3] - 0.5,
  yMin: 0.4,        yMax: WALL_H - 0.6,
  zMin: R[0] + 0.5, zMax: R[3] - 0.5,
  notchX: C[2],
  notchZ: R[1],
};

// ── Wall material — clean white, solid ────────────────────────────────────────
const wallMat = new THREE.MeshStandardMaterial({
  color:    0xf5f5f3,   // warm white
  roughness: 0.55,
  metalness: 0.0,
  side: THREE.DoubleSide,
});

// ── Low-level helpers ─────────────────────────────────────────────────────────
function box(scene, x, y, z, w, h, d) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
  m.position.set(x, y, z);
  scene.add(m);
}

// Solid wall along the X-axis (constant z)
function wallX(scene, x1, x2, z) {
  box(scene, (x1+x2)/2, WALL_H/2, z, x2-x1, WALL_H, WALL_T);
}

// Wall along X-axis with a doorway centred at doorCx
function wallXDoor(scene, x1, x2, z, doorCx) {
  const l = doorCx - DOOR_W/2, r = doorCx + DOOR_W/2;
  if (l > x1) box(scene, (x1+l)/2, WALL_H/2, z, l-x1, WALL_H, WALL_T);
  if (r < x2) box(scene, (r+x2)/2, WALL_H/2, z, x2-r, WALL_H, WALL_T);
}

// Solid wall along the Z-axis (constant x)
function wallZ(scene, x, z1, z2) {
  box(scene, x, WALL_H/2, (z1+z2)/2, WALL_T, WALL_H, z2-z1);
}

// Wall along Z-axis with doorway centred at doorCz
function wallZDoor(scene, x, z1, z2, doorCz) {
  const l = doorCz - DOOR_W/2, r = doorCz + DOOR_W/2;
  if (l > z1) box(scene, x, WALL_H/2, (z1+l)/2, WALL_T, WALL_H, l-z1);
  if (r < z2) box(scene, x, WALL_H/2, (r+z2)/2, WALL_T, WALL_H, z2-r);
}

// X-axis wall with one or more rectangular window openings
// winCxs = array of window centre x positions
function wallXWindows(scene, x1, x2, z, winCxs) {
  const sorted = [...winCxs].sort((a, b) => a - b);
  let cursor = x1;
  const lintelH = WALL_H - WIN_TOP;

  for (const wcx of sorted) {
    const wl = wcx - WIN_W / 2;
    const wr = wcx + WIN_W / 2;
    // Full-height section to the left of this window
    if (wl > cursor) box(scene, (cursor + wl) / 2, WALL_H / 2, z, wl - cursor, WALL_H, WALL_T);
    // Sill (below opening)
    box(scene, wcx, WIN_BOT / 2, z, WIN_W, WIN_BOT, WALL_T);
    // Lintel (above opening)
    box(scene, wcx, WIN_TOP + lintelH / 2, z, WIN_W, lintelH, WALL_T);
    cursor = wr;
  }
  // Remainder to the right of the last window
  if (cursor < x2) box(scene, (cursor + x2) / 2, WALL_H / 2, z, x2 - cursor, WALL_H, WALL_T);
}

// Z-axis wall with window openings at winCzs positions
function wallZWindows(scene, x, z1, z2, winCzs) {
  const sorted = [...winCzs].sort((a, b) => a - b);
  let cursor = z1;
  const lintelH = WALL_H - WIN_TOP;

  for (const wcz of sorted) {
    const wl = wcz - WIN_W / 2;
    const wr = wcz + WIN_W / 2;
    if (wl > cursor) box(scene, x, WALL_H / 2, (cursor + wl) / 2, WALL_T, WALL_H, wl - cursor);
    // Sill
    box(scene, x, WIN_BOT / 2, wcz, WALL_T, WIN_BOT, WIN_W);
    // Lintel
    box(scene, x, WIN_TOP + lintelH / 2, wcz, WALL_T, lintelH, WIN_W);
    cursor = wr;
  }
  if (cursor < z2) box(scene, x, WALL_H / 2, (cursor + z2) / 2, WALL_T, WALL_H, z2 - cursor);
}

// ── House builder ─────────────────────────────────────────────────────────────
export function buildHouse(scene) {
  const [c0, c1, c2, c3] = C;  // -19, -5, 7, 19
  const [r0, r1, r2, r3] = R;  // -19, -5, 9, 19

  // ── Floors — bright turquoise/aqua pool tones ─────────────────────────────
  const fColors = [
    0x55d5d2,  // R1  Living Room
    0x4dcfcc,  // R2  Kitchen
    0x59d8d5,  // R3  Master Bedroom
    0x4fcaca,  // R4  Master Bathroom
    0x52d2cf,  // R5  Bedroom 2
    0x47c8c5,  // R6  Bedroom 3
    0x51ccca,  // R7  Hallway / Bathroom
    0x4dcece,  // R8  Office
  ];

  const floorPairs = [
    [c0,r0,c1,r1, 0], [c1,r0,c2,r1, 1],
    [c0,r1,c1,r2, 2], [c1,r1,c2,r2, 3], [c2,r1,c3,r2, 4],
    [c0,r2,c1,r3, 5], [c1,r2,c2,r3, 6], [c2,r2,c3,r3, 7],
  ];
  for (const [x1, z1, x2, z2, ci] of floorPairs) {
    const mat = new THREE.MeshStandardMaterial({
      color: fColors[ci], roughness: 0.7, metalness: 0.05,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(x2 - x1, z2 - z1), mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set((x1 + x2) / 2, 0, (z1 + z2) / 2);
    scene.add(mesh);
  }

  // ── Water volumes — semi-transparent turquoise fill, one per room ────────
  // Inset 0.28 units from each wall face to avoid z-fighting.
  const waterMat = new THREE.MeshStandardMaterial({
    color:       0x7fdbda,
    transparent: true,
    opacity:     0.28,
    side:        THREE.FrontSide,
    depthWrite:  false,
    roughness:   0.0,
    metalness:   0.0,
  });
  const INS = 0.28;  // inset from walls
  const waterRooms = [
    [c0, r0, c1, r1],  // R1
    [c1, r0, c2, r1],  // R2
    [c0, r1, c1, r2],  // R3
    [c1, r1, c2, r2],  // R4
    [c2, r1, c3, r2],  // R5
    [c0, r2, c1, r3],  // R6
    [c1, r2, c2, r3],  // R7
    [c2, r2, c3, r3],  // R8
  ];
  for (const [x1, z1, x2, z2] of waterRooms) {
    const w = (x2 - x1) - INS * 2;
    const d = (z2 - z1) - INS * 2;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, WALL_H, d), waterMat);
    mesh.position.set((x1 + x2) / 2, WALL_H / 2, (z1 + z2) / 2);
    scene.add(mesh);
  }

  // ── Outer walls with window openings ─────────────────────────────────────
  // North wall (top of R1, R2): 2 windows, one per room
  wallXWindows(scene, c0, c2, r0, [(c0+c1)/2, (c1+c2)/2]);

  // East-top wall (right of R2, short): 1 window
  wallZWindows(scene, c2, r0, r1, [(r0+r1)/2]);

  // Inner L-step (top of R5, faces outside notch): 1 window
  wallXWindows(scene, c2, c3, r1, [(c2+c3)/2]);

  // East main wall (right of R5, R8): 2 windows
  wallZWindows(scene, c3, r1, r3, [(r1+r2)/2, (r2+r3)/2]);

  // South wall (bottom of R6, R7, R8): 3 windows
  wallXWindows(scene, c0, c3, r3, [(c0+c1)/2, (c1+c2)/2, (c2+c3)/2]);

  // West wall (left side, all rows): 3 windows
  wallZWindows(scene, c0, r0, r3, [(r0+r1)/2, (r1+r2)/2, (r2+r3)/2]);

  // ── Inner walls with centred doorways ────────────────────────────────────
  wallZDoor(scene, c1, r0, r1, (r0+r1)/2);  // R1 | R2
  wallZDoor(scene, c1, r1, r2, (r1+r2)/2);  // R3 | R4
  wallZDoor(scene, c1, r2, r3, (r2+r3)/2);  // R6 | R7

  wallZDoor(scene, c2, r1, r2, (r1+r2)/2);  // R4 | R5
  wallZDoor(scene, c2, r2, r3, (r2+r3)/2);  // R7 | R8

  wallXDoor(scene, c0, c1, r1, (c0+c1)/2);  // R1 | R3
  wallXDoor(scene, c1, c2, r1, (c1+c2)/2);  // R2 | R4

  wallXDoor(scene, c0, c1, r2, (c0+c1)/2);  // R3 | R6
  wallXDoor(scene, c1, c2, r2, (c1+c2)/2);  // R4 | R7
  wallXDoor(scene, c2, c3, r2, (c2+c3)/2);  // R5 | R8

  // ── Per-room overhead lights — bright white daylight fill ─────────────────
  const roomLight = (x, z) => {
    const pl = new THREE.PointLight(0xffffff, 1.2, 26, 2);
    pl.position.set(x, WALL_H - 0.4, z);
    scene.add(pl);
  };
  roomLight((c0+c1)/2, (r0+r1)/2);  // R1
  roomLight((c1+c2)/2, (r0+r1)/2);  // R2
  roomLight((c0+c1)/2, (r1+r2)/2);  // R3
  roomLight((c1+c2)/2, (r1+r2)/2);  // R4
  roomLight((c2+c3)/2, (r1+r2)/2);  // R5
  roomLight((c0+c1)/2, (r2+r3)/2);  // R6
  roomLight((c1+c2)/2, (r2+r3)/2);  // R7
  roomLight((c2+c3)/2, (r2+r3)/2);  // R8

  // ── Ground plane — light turquoise outside the house ─────────────────────
  const gnd = new THREE.Mesh(
    new THREE.PlaneGeometry(200, 200),
    new THREE.MeshStandardMaterial({ color: 0xc8efee, roughness: 1, metalness: 0 }),
  );
  gnd.rotation.x = -Math.PI / 2;
  gnd.position.y = -0.05;
  scene.add(gnd);
}
