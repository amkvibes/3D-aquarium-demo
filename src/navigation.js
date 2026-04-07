/**
 * navigation.js — wall-aware fish steering for the L-shaped dollhouse.
 *
 * Two exported functions used per-fish per-frame:
 *
 *   wallSteering(pos, vel, lookAhead)
 *     Returns a steering vector that points AWAY from any solid wall the fish
 *     is heading toward, with strength proportional to proximity.
 *     Doorway gaps are detected from the predicted crossing point so fish
 *     swim through openings rather than being turned away from them.
 *
 *   hardWallClamp(pos, vel)
 *     Fallback: if a fish somehow ends up inside a wall segment, push it back
 *     out and damp the component of velocity into the wall.  Should rarely
 *     fire when steering is applied first.
 */
import * as THREE from 'three';
import { HOUSE_BOUNDS } from './house.js';

// ── House grid constants (must stay in sync with house.js) ───────────────────
const C = [-19, -5,  7, 19];   // column x-boundaries
const R = [-19, -5,  9, 19];   // row    z-boundaries
const DOOR_W = 3.8;
const DW2    = DOOR_W / 2;

// Door gap [lo, hi] centred between two adjacent boundary values
const gap = (a, b) => [(a + b) / 2 - DW2, (a + b) / 2 + DW2];

// ── Wall table ────────────────────────────────────────────────────────────────
// Each entry describes one axis-aligned wall plane:
//   axis  — 'x' or 'z': the axis the wall is perpendicular to
//   pos   — position on that axis
//   lo/hi — extent of the wall along the PARALLEL axis
//   gaps  — [[lo,hi], ...] open doorway ranges along the parallel axis
//
// Reading 'x' walls: a fish at position p crosses the wall by changing p.x.
//   lo/hi restrict which z-values the wall covers.
//   gaps are z-ranges that are open.
// Reading 'z' walls: symmetric with x↔z.

export const WALLS = [
  // ── Outer perimeter ────────────────────────────────────────────────────────
  { axis: 'x', pos: C[0], lo: R[0], hi: R[3], gaps: [] },        // west  x=-19
  { axis: 'x', pos: C[3], lo: R[1], hi: R[3], gaps: [] },        // east  x=19
  { axis: 'x', pos: C[2], lo: R[0], hi: R[1], gaps: [] },        // east-top (L-notch right)  x=7, z∈[-19,-5]
  { axis: 'z', pos: R[0], lo: C[0], hi: C[2], gaps: [] },        // north  z=-19
  { axis: 'z', pos: R[3], lo: C[0], hi: C[3], gaps: [] },        // south  z=19
  { axis: 'z', pos: R[1], lo: C[2], hi: C[3], gaps: [] },        // inner-L step  z=-5, x∈[7,19]

  // ── Inner walls with doorways ──────────────────────────────────────────────
  // x = -5: full height, three door segments (one per row)
  { axis: 'x', pos: C[1], lo: R[0], hi: R[3],
    gaps: [gap(R[0], R[1]), gap(R[1], R[2]), gap(R[2], R[3])] },

  // x = 7: inner portion only (z ∈ [-5, 19]), two door segments
  { axis: 'x', pos: C[2], lo: R[1], hi: R[3],
    gaps: [gap(R[1], R[2]), gap(R[2], R[3])] },

  // z = -5: left two columns (x ∈ [-19, 7]), two door segments
  { axis: 'z', pos: R[1], lo: C[0], hi: C[2],
    gaps: [gap(C[0], C[1]), gap(C[1], C[2])] },

  // z = 9: full width, three door segments
  { axis: 'z', pos: R[2], lo: C[0], hi: C[3],
    gaps: [gap(C[0], C[1]), gap(C[1], C[2]), gap(C[2], C[3])] },
];

// ── Steering ──────────────────────────────────────────────────────────────────
const _v = new THREE.Vector3();   // reused return value (callers must not store)

/**
 * Returns an un-normalised avoidance vector for the fish.
 * The vector's magnitude encodes urgency (0 → far from any wall, 1 → right at it).
 *
 * @param {THREE.Vector3} pos       fish world position
 * @param {THREE.Vector3} vel       fish velocity direction (unit vector)
 * @param {number}        lookAhead metres to probe ahead
 */
export function wallSteering(pos, vel, lookAhead) {
  _v.set(0, 0, 0);

  for (const wall of WALLS) {
    const isX    = wall.axis === 'x';
    const pCoord = isX ? pos.x : pos.z;    // perpendicular to wall
    const pParal = isX ? pos.z : pos.x;    // parallel to wall
    const vPerp  = isX ? vel.x : vel.z;
    const vParal = isX ? vel.z : vel.x;

    // Which side of the wall is the fish on?
    const dist = pCoord - wall.pos;
    const side = dist >= 0 ? 1 : -1;

    // Skip if fish is moving away from this wall
    if (vPerp * side >= 0) continue;

    const absDist = Math.abs(dist);
    if (absDist > lookAhead) continue;

    // Skip if fish is outside the wall's span along the parallel axis
    if (pParal < wall.lo || pParal > wall.hi) continue;

    // Predict the fish's parallel-axis coordinate when it reaches the wall
    const crossParal = Math.abs(vPerp) > 0.02
      ? pParal + vParal * (absDist / Math.abs(vPerp))
      : pParal;

    // If the crossing point lands in a doorway gap, don't steer
    if (wall.gaps.some(([lo, hi]) => crossParal > lo && crossParal < hi)) continue;

    // Ramp: full strength inside ONSET, falls off to 0 at lookAhead distance
    const ONSET = 1.2;
    const t = absDist <= ONSET
      ? 1.0
      : 1.0 - (absDist - ONSET) / Math.max(lookAhead - ONSET, 0.01);

    if (isX) _v.x += side * t;
    else     _v.z += side * t;
  }

  // ── Soft floor / ceiling repulsion (Y axis) ───────────────────────────────
  const b  = HOUSE_BOUNDS;
  const YL = 1.5;
  if (vel.y < 0 && pos.y - b.yMin < YL) _v.y += (1 - (pos.y - b.yMin) / YL) * 0.7;
  if (vel.y > 0 && b.yMax - pos.y < YL) _v.y -= (1 - (b.yMax - pos.y) / YL) * 0.7;

  return _v;
}

// ── Hard clamp ────────────────────────────────────────────────────────────────
const HARD = 0.40;   // minimum clearance from any wall face

/**
 * Pushes a fish that has penetrated a wall back to a safe position and damps
 * the velocity component heading into the wall.
 */
export function hardWallClamp(pos, vel) {
  for (const wall of WALLS) {
    const isX    = wall.axis === 'x';
    const pParal = isX ? pos.z : pos.x;

    if (pParal < wall.lo || pParal > wall.hi) continue;

    const pCoord  = isX ? pos.x : pos.z;
    const dist    = pCoord - wall.pos;
    const absDist = Math.abs(dist);

    if (absDist >= HARD) continue;

    // Inside a doorway? Leave the fish alone.
    if (wall.gaps.some(([lo, hi]) => pParal > lo && pParal < hi)) continue;

    // Push back out and reflect/damp perpendicular velocity
    const side = dist >= 0 ? 1 : -1;
    if (isX) {
      pos.x = wall.pos + side * (HARD + 0.01);
      if (vel.x * side < 0) { vel.x = Math.abs(vel.x) * side * 0.4; }
    } else {
      pos.z = wall.pos + side * (HARD + 0.01);
      if (vel.z * side < 0) { vel.z = Math.abs(vel.z) * side * 0.4; }
    }
    // Small random nudge to escape degenerate head-on approach
    vel.x += (Math.random() - 0.5) * 0.12;
    vel.z += (Math.random() - 0.5) * 0.12;
    vel.normalize();
  }
}
