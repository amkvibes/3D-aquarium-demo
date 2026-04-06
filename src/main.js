import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { fishVertexShader, fishFragmentShader } from './fishShaders.js';
import { buildHouse, HOUSE_BOUNDS, WALL_H } from './house.js';

// ─── Renderer ────────────────────────────────────────────────────────────────
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

// ─── Scene ───────────────────────────────────────────────────────────────────
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x020e1a);
scene.fog = new THREE.FogExp2(0x020e1a, 0.004);

// ─── Camera — isometric dollhouse view ───────────────────────────────────────
const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 500);
camera.position.set(20, 52, 48);
camera.lookAt(0, 2, 0);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ─── OrbitControls ────────────────────────────────────────────────────────────
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, WALL_H / 2, 0);   // orbit around house centre (mid-height)
controls.enableDamping    = true;
controls.dampingFactor    = 0.06;
controls.autoRotate       = true;
controls.autoRotateSpeed  = 0.45;         // ~800-second full rotation
controls.minDistance      = 15;
controls.maxDistance      = 130;
controls.maxPolarAngle    = Math.PI * 0.78; // prevent camera going below floor

// ─── House lighting ───────────────────────────────────────────────────────────
scene.add(new THREE.AmbientLight(0x1a3050, 0.9));

const sunLight = new THREE.DirectionalLight(0x6699cc, 1.1);
sunLight.position.set(-15, 40, -20);
scene.add(sunLight);

// ─── Build house ──────────────────────────────────────────────────────────────
buildHouse(scene);

// ─── Fish type definitions ────────────────────────────────────────────────────
// Shader params from the original WebGL Aquarium aquarium.js.
// Scales tuned so fish fit naturally through the 12–14 unit wide rooms.
const FISH_TYPES = {
  BigFishA:    { fishLength: 10, fishWaveLength: -1,   fishBendAmount: 0.5,  tailSpeed: 1.5,  swimSpeed: 2.2, turnRate: 0.8,  scale: 0.25 },
  BigFishB:    { fishLength: 10, fishWaveLength: -0.7, fishBendAmount: 0.3,  tailSpeed: 1.0,  swimSpeed: 2.6, turnRate: 0.8,  scale: 0.25 },
  MediumFishA: { fishLength: 10, fishWaveLength: -2,   fishBendAmount: 2.0,  tailSpeed: 1.0,  swimSpeed: 4.0, turnRate: 2.0,  scale: 0.60 },
  MediumFishB: { fishLength: 10, fishWaveLength: -2,   fishBendAmount: 2.0,  tailSpeed: 3.0,  swimSpeed: 3.5, turnRate: 2.0,  scale: 0.80 },
  SmallFishA:  { fishLength: 10, fishWaveLength: 1,    fishBendAmount: 2.0,  tailSpeed: 10.0, swimSpeed: 6.0, turnRate: 4.5,  scale: 1.50 },
};

// 17 fish total
const SCHOOL_CONFIG = [
  { type: 'BigFishA',    count: 1 },
  { type: 'BigFishB',    count: 1 },
  { type: 'MediumFishA', count: 3 },
  { type: 'MediumFishB', count: 4 },
  { type: 'SmallFishA',  count: 8 },
];

// ─── Lighting uniform shared across all fish materials ────────────────────────
const LIGHT_WORLD_POS = new THREE.Vector3(-15, 40, -20);

// ─── Material factory ─────────────────────────────────────────────────────────
function createFishMaterial(diffuseMap, normalMapTex, params) {
  return new THREE.ShaderMaterial({
    uniforms: {
      time:           { value: 0 },
      fishLength:     { value: params.fishLength },
      fishWaveLength: { value: params.fishWaveLength },
      fishBendAmount: { value: params.fishBendAmount },
      lightWorldPos:  { value: LIGHT_WORLD_POS },
      diffuseMap:     { value: diffuseMap },
      normalMapTex:   { value: normalMapTex },
      lightColor:     { value: new THREE.Vector4(0.9, 0.95, 1.1, 1.0) },
      ambient:        { value: new THREE.Vector4(0.18, 0.28, 0.48, 1.0) },
      specular:       { value: new THREE.Vector4(0.7, 0.85, 1.0, 1.0) },
      shininess:      { value: 50.0 },
      specularFactor: { value: 1.0 },
    },
    vertexShader:   fishVertexShader,
    fragmentShader: fishFragmentShader,
    side: THREE.FrontSide,
  });
}

// ─── Asset loader ──────────────────────────────────────────────────────────────
const textureLoader = new THREE.TextureLoader();

function loadTex(filename) {
  return new Promise((resolve) => {
    textureLoader.load(
      `/assets/${filename}`,
      (t) => { t.colorSpace = THREE.SRGBColorSpace; resolve(t); },
      undefined,
      () => resolve(null),
    );
  });
}

async function loadFishAsset(name) {
  const res  = await fetch(`/assets/${name}.js`);
  const json = await res.json();
  const { fields, textures } = json.models[0];

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position',   new THREE.BufferAttribute(new Float32Array(fields.position.data),  3));
  geo.setAttribute('normal',     new THREE.BufferAttribute(new Float32Array(fields.normal.data),    3));
  geo.setAttribute('uv',         new THREE.BufferAttribute(new Float32Array(fields.texCoord.data),  2));
  geo.setAttribute('a_tangent',  new THREE.BufferAttribute(new Float32Array(fields.tangent.data),   3));
  geo.setAttribute('a_binormal', new THREE.BufferAttribute(new Float32Array(fields.binormal.data),  3));
  geo.setIndex(new THREE.BufferAttribute(new Uint16Array(fields.indices.data), 1));

  geo.computeBoundingBox();
  const center = new THREE.Vector3();
  geo.boundingBox.getCenter(center);
  geo.translate(-center.x, -center.y, -center.z);

  const [diffuseMap, normalMapTex] = await Promise.all([
    textures.diffuse   ? loadTex(textures.diffuse)   : Promise.resolve(null),
    textures.normalMap ? loadTex(textures.normalMap) : Promise.resolve(null),
  ]);

  return { geo, diffuseMap, normalMapTex };
}

// ─── Random helpers ───────────────────────────────────────────────────────────
function randFloat(min, max) { return min + Math.random() * (max - min); }

// Random swim direction: mostly horizontal to stay within the low-ceiling rooms
function randomDir() {
  const angle = Math.random() * Math.PI * 2;
  const yTilt = randFloat(-0.12, 0.12);
  return new THREE.Vector3(Math.cos(angle), yTilt, Math.sin(angle)).normalize();
}

// Spawn position inside the L-shaped house (rejects the absent top-right cell)
function spawnInHouse() {
  const b = HOUSE_BOUNDS;
  const pad = 2.0;
  for (let attempt = 0; attempt < 60; attempt++) {
    const p = new THREE.Vector3(
      randFloat(b.xMin + pad, b.xMax - pad),
      randFloat(b.yMin + 0.3, b.yMax - 0.3),
      randFloat(b.zMin + pad, b.zMax - pad),
    );
    // Reject positions inside the L-notch (absent top-right cell)
    if (!(p.x > b.notchX - pad && p.z < b.notchZ + pad)) return p;
  }
  // Fallback: guaranteed inside main body
  return new THREE.Vector3(
    randFloat(b.xMin + pad, b.notchX - pad),
    randFloat(b.yMin + 0.3, b.yMax - 0.3),
    randFloat(b.notchZ + pad, b.zMax - pad),
  );
}

// ─── Bounce logic — L-shaped boundary ────────────────────────────────────────
function bounceInHouse(pos, vel) {
  const b = HOUSE_BOUNDS;
  let bounced = false;

  // Standard axis-aligned boundary check
  const check = (axis, lo, hi, sign) => {
    if (pos[axis] < lo) { pos[axis] = lo; if (vel[axis] < 0) vel[axis] *= -1; bounced = true; }
    if (pos[axis] > hi) { pos[axis] = hi; if (vel[axis] > 0) vel[axis] *= -1; bounced = true; }
  };
  check('x', b.xMin, b.xMax);
  check('y', b.yMin, b.yMax);
  check('z', b.zMin, b.zMax);

  // L-notch: if fish drifted into the absent top-right cell, push it out
  if (pos.x > b.notchX && pos.z < b.notchZ) {
    const overX = pos.x - b.notchX;
    const overZ = b.notchZ - pos.z;
    if (overX >= overZ) {
      // Closer to the notch's east wall: reflect west
      pos.x = b.notchX;
      if (vel.x > 0) vel.x *= -1;
    } else {
      // Closer to the notch's south wall: reflect south
      pos.z = b.notchZ;
      if (vel.z < 0) vel.z *= -1;
    }
    bounced = true;
  }

  if (bounced) {
    // Small random nudge so fish don't retrace their path
    vel.x += randFloat(-0.08, 0.08);
    vel.z += randFloat(-0.08, 0.08);
    vel.normalize();
  }
}

// ─── School state ─────────────────────────────────────────────────────────────
const school = [];

async function spawnSchool() {
  // Load all 5 fish types in parallel
  const assetNames = [...new Set(SCHOOL_CONFIG.map(c => c.type))];
  const assets = Object.fromEntries(
    await Promise.all(assetNames.map(async n => [n, await loadFishAsset(n)])),
  );
  console.log('All fish assets loaded');

  const spawnedPositions = [];
  const MIN_SEP = 4.5;

  for (const { type, count } of SCHOOL_CONFIG) {
    const { geo, diffuseMap, normalMapTex } = assets[type];
    const tp = FISH_TYPES[type];

    for (let i = 0; i < count; i++) {
      const mat  = createFishMaterial(diffuseMap, normalMapTex, tp);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.scale.setScalar(tp.scale);

      // Spread fish out at spawn
      let pos;
      for (let attempt = 0; attempt < 40; attempt++) {
        pos = spawnInHouse();
        if (spawnedPositions.every(p => p.distanceTo(pos) >= MIN_SEP)) break;
      }
      spawnedPositions.push(pos.clone());
      mesh.position.copy(pos);

      const vel       = randomDir();
      const facingDir = vel.clone();

      school.push({
        mesh,
        pos,
        vel,
        facingDir,
        swimSpeed:  tp.swimSpeed  * randFloat(0.8, 1.2),
        tailSpeed:  tp.tailSpeed,
        turnRate:   tp.turnRate,
        timeOffset: Math.random() * Math.PI * 2,
      });

      scene.add(mesh);
    }
  }

  console.log(`School ready: ${school.length} fish`);
}

// ─── Animation loop ───────────────────────────────────────────────────────────
const timer   = new THREE.Timer();
let lastTime  = 0;

function animate() {
  requestAnimationFrame(animate);
  timer.update();
  const t  = timer.getElapsed();
  const dt = Math.min(t - lastTime, 0.05);
  lastTime = t;

  for (const fish of school) {
    // Move
    fish.pos.addScaledVector(fish.vel, fish.swimSpeed * dt);
    bounceInHouse(fish.pos, fish.vel);

    // Smooth turn: lerp the facing vector toward the swim direction
    fish.facingDir.lerp(fish.vel, Math.min(1, fish.turnRate * dt)).normalize();

    // Update transform
    fish.mesh.position.copy(fish.pos);
    fish.mesh.rotation.y = Math.atan2(fish.facingDir.x, fish.facingDir.z);
    // Gentle nose-up/down when swimming toward ceiling/floor
    fish.mesh.rotation.x = -Math.asin(
      Math.max(-0.9, Math.min(0.9, fish.facingDir.y)),
    );

    // Swim animation: tailSpeed scales how fast the shader animates
    fish.mesh.material.uniforms.time.value =
      t * fish.tailSpeed + fish.timeOffset;
  }

  controls.update();
  renderer.render(scene, camera);
}

// ─── Boot ─────────────────────────────────────────────────────────────────────
spawnSchool().catch(console.error);
animate();
