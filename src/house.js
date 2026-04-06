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

const C = [-19, -5,  7, 19];  // column x-boundaries
const R = [-19, -5,  9, 19];  // row    z-boundaries

// ── Fish movement bounds (L-shape) ────────────────────────────────────────────
export const HOUSE_BOUNDS = {
  xMin: C[0] + 0.5, xMax: C[3] - 0.5,
  yMin: 0.4,        yMax: WALL_H - 0.6,
  zMin: R[0] + 0.5, zMax: R[3] - 0.5,
  // The notch: if x > notchX AND z < notchZ, the cell is absent
  notchX: C[2],
  notchZ: R[1],
};

// ── Materials ─────────────────────────────────────────────────────────────────
const wallMat = new THREE.MeshStandardMaterial({
  color:             0x7fd4f5,
  emissive:          0x1a3d5c,
  emissiveIntensity: 0.12,
  transparent:       true,
  opacity:           0.28,
  side:              THREE.DoubleSide,
  depthWrite:        false,
  roughness:         0.05,
  metalness:         0.08,
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

// ── House builder ─────────────────────────────────────────────────────────────
export function buildHouse(scene) {
  const [c0, c1, c2, c3] = C;  // -19, -5, 7, 19
  const [r0, r1, r2, r3] = R;  // -19, -5, 9, 19

  // ── Floors (8 rooms, each slightly different teal-blue shade) ─────────────
  const fColors = [
    0x0c3d52, // R1  Living Room
    0x093545, // R2  Kitchen
    0x0d4258, // R3  Master Bedroom
    0x0b3c4e, // R4  Master Bathroom
    0x0e4455, // R5  Bedroom 2
    0x09303f, // R6  Bedroom 3
    0x0c3f50, // R7  Hallway / Bathroom
    0x0d4256, // R8  Office
  ];

  const floorPairs = [
    [c0,r0,c1,r1, 0], [c1,r0,c2,r1, 1],             // top row  (R1, R2)
    [c0,r1,c1,r2, 2], [c1,r1,c2,r2, 3], [c2,r1,c3,r2, 4], // mid row  (R3-5)
    [c0,r2,c1,r3, 5], [c1,r2,c2,r3, 6], [c2,r2,c3,r3, 7], // bot row  (R6-8)
  ];
  for (const [x1,z1,x2,z2,ci] of floorPairs) {
    const mat = new THREE.MeshStandardMaterial({
      color: fColors[ci], roughness: 0.9, metalness: 0.05,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(x2-x1, z2-z1), mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set((x1+x2)/2, 0, (z1+z2)/2);
    scene.add(mesh);
  }

  // ── Outer walls (no doorways — solid perimeter) ───────────────────────────
  wallX(scene, c0, c2, r0);   // north  (top of R1, R2)
  wallZ(scene, c2, r0, r1);   // east-top  (right of R2)
  wallX(scene, c2, c3, r1);   // inner L-step  (top of R5 — the L notch)
  wallZ(scene, c3, r1, r3);   // east main  (right of R5, R8)
  wallX(scene, c0, c3, r3);   // south  (bottom of R6, R7, R8)
  wallZ(scene, c0, r0, r3);   // west  (left side)

  // ── Inner walls with centred doorways ────────────────────────────────────
  // Vertical (x = c1 = -5): divides col-0 from col-1
  wallZDoor(scene, c1, r0, r1, (r0+r1)/2); // R1 | R2 door at z = -12
  wallZDoor(scene, c1, r1, r2, (r1+r2)/2); // R3 | R4 door at z =   2
  wallZDoor(scene, c1, r2, r3, (r2+r3)/2); // R6 | R7 door at z =  14

  // Vertical (x = c2 = 7): divides col-1 from col-2 (main body only)
  wallZDoor(scene, c2, r1, r2, (r1+r2)/2); // R4 | R5 door at z =   2
  wallZDoor(scene, c2, r2, r3, (r2+r3)/2); // R7 | R8 door at z =  14

  // Horizontal (z = r1 = -5): divides row-0 from row-1 (left two cols only)
  wallXDoor(scene, c0, c1, r1, (c0+c1)/2); // R1 | R3 door at x = -12
  wallXDoor(scene, c1, c2, r1, (c1+c2)/2); // R2 | R4 door at x =   1

  // Horizontal (z = r2 = 9): divides row-1 from row-2 (full width)
  wallXDoor(scene, c0, c1, r2, (c0+c1)/2); // R3 | R6 door at x = -12
  wallXDoor(scene, c1, c2, r2, (c1+c2)/2); // R4 | R7 door at x =   1
  wallXDoor(scene, c2, c3, r2, (c2+c3)/2); // R5 | R8 door at x =  13

  // ── Per-room point lights (underwater blue/teal palette) ─────────────────
  const roomLight = (x, z, hex, intensity = 1.8) => {
    const pl = new THREE.PointLight(hex, intensity, 22, 2);
    pl.position.set(x, WALL_H - 1.0, z);
    scene.add(pl);
  };
  roomLight((c0+c1)/2, (r0+r1)/2, 0x66bbff);  // R1
  roomLight((c1+c2)/2, (r0+r1)/2, 0x44aadd);  // R2
  roomLight((c0+c1)/2, (r1+r2)/2, 0x5599ff);  // R3
  roomLight((c1+c2)/2, (r1+r2)/2, 0x44ccdd);  // R4
  roomLight((c2+c3)/2, (r1+r2)/2, 0x33ddcc);  // R5
  roomLight((c0+c1)/2, (r2+r3)/2, 0x3399bb);  // R6
  roomLight((c1+c2)/2, (r2+r3)/2, 0x44bbcc);  // R7
  roomLight((c2+c3)/2, (r2+r3)/2, 0x55aadd);  // R8

  // ── Ocean floor (large dark plane under the house) ────────────────────────
  const gnd = new THREE.Mesh(
    new THREE.PlaneGeometry(200, 200),
    new THREE.MeshStandardMaterial({ color: 0x020c16, roughness: 1, metalness: 0 }),
  );
  gnd.rotation.x = -Math.PI / 2;
  gnd.position.y = -0.05;
  scene.add(gnd);
}
