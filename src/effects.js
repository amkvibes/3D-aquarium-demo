/**
 * effects.js — underwater visual effects:
 *   buildCaustics(scene)      — animated light-pattern overlays on floors
 *   buildWaterSurface(scene)  — animated rippling plane at the top of walls
 *   buildBubbles(scene)       — rising particle streams in 4 rooms
 *   updateEffects(t, dt)      — call every frame
 */
import * as THREE from 'three';
import { WALL_H } from './house.js';

// Room layout matching house.js grid (C=[-19,-5,7,19], R=[-19,-5,9,19])
// [centerX, centerZ, width, depth]
const ROOMS = [
  [-12, -12, 14, 14],  // R1 Living Room
  [  1, -12, 12, 14],  // R2 Kitchen
  [-12,   2, 14, 14],  // R3 Master Bedroom
  [  1,   2, 12, 14],  // R4 Master Bathroom
  [ 13,   2, 12, 14],  // R5 Bedroom 2
  [-12,  14, 14, 10],  // R6 Bedroom 3
  [  1,  14, 12, 10],  // R7 Hallway/Bathroom
  [ 13,  14, 12, 10],  // R8 Office
];

// All time { value } handles to update in one sweep
const timeUniforms = [];

export function updateEffects(t, dt) {
  for (const u of timeUniforms) u.value = t;
  _updateBubbles(t, dt);
}

// ── Caustics ──────────────────────────────────────────────────────────────────
// Bright veiny caustic pattern via product of three sine waves.
// Additive-blended so it brightens whatever floor colour sits under it.

const causticVert = /* glsl */ `
varying vec2 v_uv;
void main() {
  v_uv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const causticFrag = /* glsl */ `
uniform float time;
varying vec2 v_uv;

float caustic(vec2 p, float t) {
  // Three overlapping sine interference layers — bright veins where they align
  float a = abs(sin(p.x * 3.4 + t * 1.05) * cos(p.y * 3.9 + t * 0.85));
  float b = abs(sin((p.x - p.y) * 2.7 + t * 1.30));
  float c = abs(cos((p.x + p.y) * 3.1 + t * 0.70));
  return clamp(a * b * c * 5.0, 0.0, 1.0);
}

void main() {
  // Scale UV so pattern repeats ~5 times across a room;
  // drift slowly so the whole floor shimmers
  vec2 p = v_uv * 5.0 + vec2(time * 0.04, time * 0.025);
  float c = caustic(p, time);
  // Warm gold-white like sunlight through shallow pool water
  vec3 col = mix(vec3(0.85, 0.78, 0.45), vec3(1.00, 0.97, 0.82), c);
  gl_FragColor = vec4(col * c, c * 0.22);
}
`;

export function buildCaustics(scene) {
  const timeU = { value: 0 };
  timeUniforms.push(timeU);

  const mat = new THREE.ShaderMaterial({
    uniforms: { time: timeU },
    vertexShader: causticVert,
    fragmentShader: causticFrag,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.FrontSide,
  });

  for (const [cx, cz, w, d] of ROOMS) {
    // Slightly inset so caustic planes don't clip wall bases
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.3, d - 0.3), mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(cx, 0.08, cz);
    scene.add(mesh);
  }
}

// ── Water surface ─────────────────────────────────────────────────────────────
// Two planes cover the L-shaped footprint at y = WALL_H.
// Vertex shader displaces Y to create ripples; fragment adds colour.

const waterVert = /* glsl */ `
uniform float time;
varying float v_wave;

void main() {
  vec3 p = position;
  float w =  sin(p.x * 0.65 + time * 1.20) * 0.14
           + sin(p.z * 0.50 + time * 0.95 + 0.9) * 0.09
           + sin((p.x * 0.40 + p.z * 0.60) + time * 0.75) * 0.07
           + sin((p.x - p.z) * 0.30 + time * 1.50) * 0.04;
  p.y += w;
  v_wave = w * 3.0 + 0.5;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}
`;

const waterFrag = /* glsl */ `
varying float v_wave;

void main() {
  float w = clamp(v_wave, 0.0, 1.0);
  // Bright Caribbean turquoise — pool-water look
  vec3 deep  = vec3(0.35, 0.82, 0.80);
  vec3 crest = vec3(0.75, 0.97, 0.95);
  vec3 col   = mix(deep, crest, w);
  gl_FragColor = vec4(col, 0.18 + w * 0.12);
}
`;

export function buildWaterSurface(scene) {
  const timeU = { value: 0 };
  timeUniforms.push(timeU);

  const mat = new THREE.ShaderMaterial({
    uniforms: { time: timeU },
    vertexShader: waterVert,
    fragmentShader: waterFrag,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
  });

  const y = WALL_H + 0.04;

  // Left two columns: x ∈ [-19, 7], z ∈ [-19, 19]  →  cx=-6, cz=0, w=26, d=38
  const m1 = new THREE.Mesh(new THREE.PlaneGeometry(26, 38, 26, 38), mat);
  m1.rotation.x = -Math.PI / 2;
  m1.position.set(-6, y, 0);
  scene.add(m1);

  // Right column (bottom 2 rows only): x ∈ [7, 19], z ∈ [-5, 19]  →  cx=13, cz=7, w=12, d=24
  const m2 = new THREE.Mesh(new THREE.PlaneGeometry(12, 24, 12, 24), mat);
  m2.rotation.x = -Math.PI / 2;
  m2.position.set(13, y, 7);
  scene.add(m2);
}

// ── Bubbles ───────────────────────────────────────────────────────────────────
// Four rooms get a stream of ~45 rising bubble particles each.

const BUBBLE_ROOMS = [ROOMS[0], ROOMS[2], ROOMS[4], ROOMS[7]]; // R1, R3, R5, R8
const BUBBLES_PER_ROOM = 45;

const bubbleGroups = [];

export function buildBubbles(scene) {
  for (const [cx, cz, w, d] of BUBBLE_ROOMS) {
    const count = BUBBLES_PER_ROOM;
    const pos   = new Float32Array(count * 3);
    const spd   = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      pos[i * 3]     = cx + (Math.random() - 0.5) * (w - 2.0);
      pos[i * 3 + 1] = Math.random() * WALL_H;
      pos[i * 3 + 2] = cz + (Math.random() - 0.5) * (d - 2.0);
      spd[i] = 0.35 + Math.random() * 0.75;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));

    const mat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.13,
      transparent: true,
      opacity: 0.60,
      depthWrite: false,
      sizeAttenuation: true,
    });

    const points = new THREE.Points(geo, mat);
    scene.add(points);
    bubbleGroups.push({ points, pos, spd, cx, cz, w, d });
  }
}

function _updateBubbles(t, dt) {
  for (const { points, pos, spd, cx, cz, w, d } of bubbleGroups) {
    const n = spd.length;
    for (let i = 0; i < n; i++) {
      // Rise
      pos[i * 3 + 1] += spd[i] * dt;
      // Gentle horizontal sway
      pos[i * 3]     += Math.sin(t * 1.8 + i * 1.37) * 0.004;

      // Reset to floor when bubble reaches water surface
      if (pos[i * 3 + 1] > WALL_H - 0.15) {
        pos[i * 3]     = cx + (Math.random() - 0.5) * (w - 2.0);
        pos[i * 3 + 1] = 0.1 + Math.random() * 0.4;
        pos[i * 3 + 2] = cz + (Math.random() - 0.5) * (d - 2.0);
      }
    }
    points.geometry.attributes.position.needsUpdate = true;
  }
}
