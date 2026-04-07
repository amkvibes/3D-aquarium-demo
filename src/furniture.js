/**
 * furniture.js — simple box-geometry furniture for all 8 rooms.
 *
 * Coordinate system matches house.js:
 *   C = [-19, -5, 7, 19]   column x-boundaries
 *   R = [-19, -5, 9, 19]   row    z-boundaries
 *   WALL_H = 6
 *
 * Safe clearance: all pieces kept ≥ 1 unit from any wall centre
 * (≥ 0.84 units from wall face), doorways left clear.
 *
 * Box helper: box(scene, mat, cx, cz, bottomY, width, height, depth)
 *   cx/cz = horizontal centre, bottomY = floor level (0 = sitting on floor),
 *   width along X, height along Y, depth along Z.
 */
import * as THREE from 'three';

// ── Shared materials ───────────────────────────────────────────────────────────
const WOOD    = new THREE.MeshStandardMaterial({ color: 0xc8a882, roughness: 0.85, metalness: 0.0 });
const GRAY    = new THREE.MeshStandardMaterial({ color: 0xcecece, roughness: 0.75, metalness: 0.02 });
const WHITE   = new THREE.MeshStandardMaterial({ color: 0xf4f2ee, roughness: 0.65, metalness: 0.0 });
const CUSHION = new THREE.MeshStandardMaterial({ color: 0xe6ddd2, roughness: 0.90, metalness: 0.0 });
const DARK    = new THREE.MeshStandardMaterial({ color: 0x383836, roughness: 0.55, metalness: 0.08 });

function box(scene, mat, cx, cz, y, w, h, d) {
  // y = bottom of piece (0 = floor).  Mesh origin at vertical centre.
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(cx, y + h * 0.5, cz);
  scene.add(m);
}

export function buildFurniture(scene) {

  // ════════════════════════════════════════════════════════════
  // R1 — Living Room   x∈[-19,-5]  z∈[-19,-5]
  //   safe zone: x∈[-18,-6]  z∈[-18,-6]
  //   doorways: east wall (x=-5) z∈[-13.9,-10.1]
  //             south wall (z=-5) x∈[-13.9,-10.1]
  // ════════════════════════════════════════════════════════════

  // Sofa — against north wall, centred in room
  box(scene, CUSHION, -12, -16.5,  0,   6.0, 1.0, 2.0);  // seat
  box(scene, CUSHION, -12, -17.4,  1.0, 6.0, 0.8, 0.3);  // backrest
  box(scene, CUSHION, -15.0, -16.5, 0, 0.4, 1.5, 2.0);  // left arm
  box(scene, CUSHION,  -9.0, -16.5, 0, 0.4, 1.5, 2.0);  // right arm

  // Coffee table in front of sofa
  box(scene, WOOD, -12, -14.2, 0, 2.5, 0.5, 1.2);

  // TV stand — left of south-wall doorway (door at x≈-12 ±1.9 in z=-5 wall)
  box(scene, DARK, -16.0, -6.4, 0, 3.5, 1.0, 0.6);  // unit
  box(scene, DARK, -16.0, -6.4, 1.0, 3.5, 0.08, 0.6); // screen face (flat slab)

  // ════════════════════════════════════════════════════════════
  // R2 — Kitchen   x∈[-5,7]  z∈[-19,-5]
  //   safe zone: x∈[-4,6]  z∈[-18,-6]
  //   doorways: west wall (x=-5) z∈[-13.9,-10.1]
  //             south wall (z=-5) x∈[-0.9,2.9]
  // ════════════════════════════════════════════════════════════

  // Kitchen counter along north wall
  box(scene, GRAY, 1, -17.6, 0, 9.0, 2.0, 1.0);   // worktop block
  box(scene, WHITE, 1, -17.6, 2.0, 9.0, 0.1, 1.0); // counter top surface

  // Dining table with two chairs — centre of room, below doorway z-range
  box(scene, WOOD, 1, -9.0, 0, 2.8, 1.4, 1.6);     // table
  box(scene, WOOD, -0.9, -9.0, 0, 1.0, 0.9, 1.0);  // chair left
  box(scene, WOOD,  2.9, -9.0, 0, 1.0, 0.9, 1.0);  // chair right
  // Chair backs
  box(scene, WOOD, -0.9, -9.4, 0.9, 1.0, 0.7, 0.15);
  box(scene, WOOD,  2.9, -9.4, 0.9, 1.0, 0.7, 0.15);

  // ════════════════════════════════════════════════════════════
  // R3 — Master Bedroom   x∈[-19,-5]  z∈[-5,9]
  //   safe zone: x∈[-18,-6]  z∈[-4,8]
  //   doorways: north wall (z=-5) x∈[-13.9,-10.1]
  //             east wall  (x=-5) z∈[0.1,3.9]
  //             south wall (z=9)  x∈[-13.9,-10.1]
  // ════════════════════════════════════════════════════════════

  // Double bed against west wall, centred on z
  box(scene, CUSHION, -15.5,  2.0, 0, 5.0, 1.4, 7.5);  // mattress
  box(scene, WHITE,   -15.5, -1.5, 1.4, 5.0, 0.25, 1.5); // pillow area
  box(scene, WOOD,    -17.7,  2.0, 0, 0.4, 2.0, 7.5);   // headboard

  // Nightstand
  box(scene, WOOD, -12.5, -1.5, 0, 2.0, 1.0, 2.0);

  // Wardrobe against east wall, above door zone (door at z∈[0.1,3.9])
  box(scene, WOOD, -7.5, 6.5, 0, 3.0, 4.0, 3.0);

  // ════════════════════════════════════════════════════════════
  // R4 — Master Bathroom   x∈[-5,7]  z∈[-5,9]
  //   safe zone: x∈[-4,6]  z∈[-4,8]
  //   doorways: all four walls have openings near x/z = ±1.9 of midpoint
  // ════════════════════════════════════════════════════════════

  // Bathtub in north-east corner (away from all door zones)
  box(scene, WHITE, 4.5, -2.0, 0, 3.0, 0.9, 3.5);      // tub body
  box(scene, GRAY,  4.5, -2.0, 0.9, 3.0, 0.15, 3.5);   // rim

  // Toilet in north-west corner
  box(scene, WHITE, -2.5, -3.0, 0, 1.4, 0.9, 1.8);

  // Vanity in south-east corner
  box(scene, GRAY,  4.5, 7.0, 0, 3.0, 1.4, 1.5);
  box(scene, WHITE, 4.5, 7.0, 1.4, 3.0, 0.1, 1.5);  // counter top

  // ════════════════════════════════════════════════════════════
  // R5 — Bedroom 2   x∈[7,19]  z∈[-5,9]
  //   safe zone: x∈[8,18]  z∈[-4,8]
  //   doorways: west wall (x=7)  z∈[0.1,3.9]
  //             south wall (z=9) x∈[11.1,14.9]
  // ════════════════════════════════════════════════════════════

  // Bed against east wall
  box(scene, CUSHION, 15.5,  2.0, 0, 5.0, 1.4, 7.5);
  box(scene, WHITE,   15.5, -1.5, 1.4, 5.0, 0.25, 1.5);  // pillows
  box(scene, WOOD,    17.8,  2.0, 0, 0.4, 2.0, 7.5);     // headboard

  // Dresser in north-west corner (away from door at z=9, x∈[11.1,14.9])
  box(scene, WOOD, 9.5, -3.0, 0, 3.0, 2.5, 2.0);

  // Nightstand
  box(scene, WOOD, 13.5, -1.5, 0, 2.0, 1.0, 2.0);

  // ════════════════════════════════════════════════════════════
  // R6 — Bedroom 3   x∈[-19,-5]  z∈[9,19]
  //   safe zone: x∈[-18,-6]  z∈[10,18]
  //   doorways: north wall (z=9)  x∈[-13.9,-10.1]
  //             east wall  (x=-5) z∈[12.1,15.9]
  // ════════════════════════════════════════════════════════════

  // Bed against south wall, in west half (clear of east-wall door)
  box(scene, CUSHION, -15.5, 16.0, 0, 4.5, 1.4, 5.0);
  box(scene, WHITE,   -15.5, 13.5, 1.4, 4.5, 0.25, 1.5);  // pillows
  box(scene, WOOD,    -15.5, 17.8, 0, 4.5, 1.5, 0.4);     // headboard

  // Dresser in north-east area
  box(scene, WOOD, -9.0, 11.0, 0, 3.5, 2.5, 2.0);

  // ════════════════════════════════════════════════════════════
  // R7 — Bathroom   x∈[-5,7]  z∈[9,19]
  //   safe zone: x∈[-4,6]  z∈[10,18]
  //   doorways: north wall (z=9) x∈[-0.9,2.9]
  //             west wall  (x=-5) z∈[12.1,15.9]
  //             east wall  (x=7)  z∈[12.1,15.9]
  // ════════════════════════════════════════════════════════════

  // Bathtub in south-east corner (clear of side-wall doors at z∈[12.1,15.9])
  box(scene, WHITE, 4.5, 16.5, 0, 3.0, 0.9, 4.0);
  box(scene, GRAY,  4.5, 16.5, 0.9, 3.0, 0.15, 4.0);

  // Toilet — north-west corner (below door zone)
  box(scene, WHITE, -2.5, 11.0, 0, 1.4, 0.9, 2.0);

  // Vanity — south-west corner
  box(scene, GRAY,  -2.0, 17.0, 0, 3.0, 1.4, 1.5);
  box(scene, WHITE, -2.0, 17.0, 1.4, 3.0, 0.1, 1.5);

  // ════════════════════════════════════════════════════════════
  // R8 — Office   x∈[7,19]  z∈[9,19]
  //   safe zone: x∈[8,18]  z∈[10,18]
  //   doorways: west wall (x=7)  z∈[12.1,15.9]
  //             north wall (z=9) x∈[11.1,14.9]
  // ════════════════════════════════════════════════════════════

  // L-shaped desk against north wall — split to straddle the doorway gap
  box(scene, WOOD, 9.5,  10.5, 0, 3.0, 1.5, 1.5);   // left section  x∈[8,11]
  box(scene, WOOD, 16.5, 10.5, 0, 3.5, 1.5, 1.5);   // right section x∈[14.75,18.25]
  // (gap x∈[11,14.75] covers the doorway at x∈[11.1,14.9])

  // Office chair in front of left desk
  box(scene, GRAY, 9.5, 12.0, 0, 1.5, 0.9, 1.5);    // seat
  box(scene, GRAY, 9.5, 12.7, 0.9, 1.5, 0.7, 0.15); // back

  // Bookshelf against south-east corner
  box(scene, WOOD, 16.0, 17.0, 0, 4.5, 4.0, 1.5);
}
