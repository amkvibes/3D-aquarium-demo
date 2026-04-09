import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { fishVertexShader, fishFragmentShader } from './fishShaders.js';
import { buildHouse, HOUSE_BOUNDS, WALL_H } from './house.js';
import { buildWaterSurface, buildBubbles, updateEffects } from './effects.js';
import { buildFurniture } from './furniture.js';
import { wallSteering, hardWallClamp } from './navigation.js';

// ─── Renderer ────────────────────────────────────────────────────────────────
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

// ─── Scene ───────────────────────────────────────────────────────────────────
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xeefafa);          // bright aqua-white sky
scene.fog = new THREE.FogExp2(0xd0f2f0, 0.0035);       // very soft turquoise haze

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
controls.target.set(0, WALL_H / 2, 0);
controls.enableDamping    = true;
controls.dampingFactor    = 0.06;
controls.autoRotate       = false;
controls.minDistance      = 1;
controls.maxDistance      = 130;
controls.maxPolarAngle    = Math.PI * 0.78;

// ─── Bright aquarium lighting ─────────────────────────────────────────────────
// Strong ambient so fish colours pop throughout all rooms
scene.add(new THREE.AmbientLight(0xd0f0f0, 2.8));

// Primary sun from above — bright white, simulates midday light through water
const sunLight = new THREE.DirectionalLight(0xffffff, 2.2);
sunLight.position.set(-10, 60, -20);
scene.add(sunLight);

// Soft warm fill from the front-right — removes harsh shadows
const fillLight = new THREE.DirectionalLight(0xfff0e8, 0.9);
fillLight.position.set(30, 25, 30);
scene.add(fillLight);

// ─── Build house ──────────────────────────────────────────────────────────────
buildHouse(scene);

// ─── Underwater effects ───────────────────────────────────────────────────────
buildWaterSurface(scene);
buildBubbles(scene);

// ─── Fish type definitions ────────────────────────────────────────────────────
// swimSpeed is the BASE — each fish instance multiplies by a random factor for variety.
// Big fish are slow and majestic; small fish dart quickly.
const FISH_TYPES = {
  MediumFishA: { fishLength: 10, fishWaveLength: -2,   fishBendAmount: 2.0,  tailSpeed: 0.4,  swimSpeed: 1.4, turnRate: 2.2,  scale: 0.24 },
  MediumFishB: { fishLength: 10, fishWaveLength: -2,   fishBendAmount: 2.0,  tailSpeed: 1.2,  swimSpeed: 1.3, turnRate: 2.2,  scale: 0.32 },
  SmallFishA:  { fishLength: 10, fishWaveLength: 1,    fishBendAmount: 2.0,  tailSpeed: 4.0,  swimSpeed: 2.2, turnRate: 5.0,  scale: 0.60 },
};

const SCHOOL_CONFIG = [
  { type: 'SmallFishA',  count: 120 },
  { type: 'MediumFishA', count:  40 },
  { type: 'MediumFishB', count:  40 },
];

// ─── Lighting uniform shared across all fish materials ────────────────────────
const LIGHT_WORLD_POS = new THREE.Vector3(-10, 60, -20);

// ─── Tropical colour palette ──────────────────────────────────────────────────
// Values > 1.0 boost brightness so mid-tone textures become vivid.
const TROPICAL_PALETTE = [
  new THREE.Vector3(2.2, 0.55, 0.08),  // clownfish orange
  new THREE.Vector3(2.2, 1.7,  0.05),  // yellow / gold
  new THREE.Vector3(0.1, 0.65, 2.4),   // electric blue
  new THREE.Vector3(0.1, 2.0,  0.75),  // green / teal
  new THREE.Vector3(2.2, 0.08, 0.15),  // red / crimson
  new THREE.Vector3(1.3, 0.1,  2.4),   // purple
  new THREE.Vector3(2.2, 0.18, 1.3),   // hot pink
  new THREE.Vector3(0.1, 2.0,  2.2),   // cyan
];

// ─── Material factory ─────────────────────────────────────────────────────────
function createFishMaterial(diffuseMap, normalMapTex, params, tintColor) {
  return new THREE.ShaderMaterial({
    uniforms: {
      time:           { value: 0 },
      fishLength:     { value: params.fishLength },
      fishWaveLength: { value: params.fishWaveLength },
      fishBendAmount: { value: params.fishBendAmount },
      lightWorldPos:  { value: LIGHT_WORLD_POS },
      diffuseMap:     { value: diffuseMap },
      normalMapTex:   { value: normalMapTex },
      tintColor:      { value: tintColor },
      lightColor:     { value: new THREE.Vector4(1.0, 1.0, 1.0, 1.0) },
      ambient:        { value: new THREE.Vector4(0.55, 0.60, 0.62, 1.0) },
      specular:       { value: new THREE.Vector4(0.9, 0.95, 1.0, 1.0) },
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

// srgb=true for diffuse/colour maps, false for normal maps (must stay linear)
function loadTex(filename, srgb = true) {
  return new Promise((resolve) => {
    textureLoader.load(
      `${import.meta.env.BASE_URL}assets/${filename}`,
      (t) => {
        t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.LinearSRGBColorSpace;
        resolve(t);
      },
      undefined,
      () => resolve(null),
    );
  });
}

async function loadFishAsset(name) {
  const res  = await fetch(`${import.meta.env.BASE_URL}assets/${name}.js`);
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
    textures.diffuse   ? loadTex(textures.diffuse,   true)  : Promise.resolve(null),
    textures.normalMap ? loadTex(textures.normalMap,  false) : Promise.resolve(null),
  ]);

  return { geo, diffuseMap, normalMapTex };
}

// ─── Random helpers ───────────────────────────────────────────────────────────
function randFloat(min, max) { return min + Math.random() * (max - min); }

function randomDir() {
  const angle = Math.random() * Math.PI * 2;
  const yTilt = randFloat(-0.12, 0.12);
  return new THREE.Vector3(Math.cos(angle), yTilt, Math.sin(angle)).normalize();
}

function spawnInHouse() {
  const b = HOUSE_BOUNDS;
  const pad = 2.0;
  for (let attempt = 0; attempt < 60; attempt++) {
    const p = new THREE.Vector3(
      randFloat(b.xMin + pad, b.xMax - pad),
      randFloat(b.yMin + 0.3, b.yMax - 0.3),
      randFloat(b.zMin + pad, b.zMax - pad),
    );
    if (!(p.x > b.notchX - pad && p.z < b.notchZ + pad)) return p;
  }
  return new THREE.Vector3(
    randFloat(b.xMin + pad, b.notchX - pad),
    randFloat(b.yMin + 0.3, b.yMax - 0.3),
    randFloat(b.notchZ + pad, b.zMax - pad),
  );
}

// ─── Room definitions — 8 rooms in the L-shaped house ────────────────────────
// Wall centres: C = [-19,-5,7,19], R = [-19,-5,9,19]
const ROOMS = [
  { xMin: -19, xMax:  -5, zMin: -19, zMax:  -5 },  // R1 top-left
  { xMin:  -5, xMax:   7, zMin: -19, zMax:  -5 },  // R2 top-centre
  { xMin: -19, xMax:  -5, zMin:  -5, zMax:   9 },  // R3 mid-left
  { xMin:  -5, xMax:   7, zMin:  -5, zMax:   9 },  // R4 mid-centre
  { xMin:   7, xMax:  19, zMin:  -5, zMax:   9 },  // R5 mid-right
  { xMin: -19, xMax:  -5, zMin:   9, zMax:  19 },  // R6 bot-left
  { xMin:  -5, xMax:   7, zMin:   9, zMax:  19 },  // R7 bot-centre
  { xMin:   7, xMax:  19, zMin:   9, zMax:  19 },  // R8 bot-right
];

function spawnInRoom(room) {
  const pad = 2.0;
  const b   = HOUSE_BOUNDS;
  return new THREE.Vector3(
    randFloat(Math.max(room.xMin + pad, b.xMin), Math.min(room.xMax - pad, b.xMax)),
    randFloat(b.yMin + 0.3, b.yMax - 0.3),
    randFloat(Math.max(room.zMin + pad, b.zMin), Math.min(room.zMax - pad, b.zMax)),
  );
}

// Soft steering away from all room edges (including doorways — fish stay in their room).
const _roomSteer = new THREE.Vector3();
function roomSteering(pos, vel, room, lookAhead) {
  _roomSteer.set(0, 0, 0);
  const INNER = 0.8;
  const xlo = room.xMin + INNER, xhi = room.xMax - INNER;
  const zlo = room.zMin + INNER, zhi = room.zMax - INNER;

  if (vel.x < 0 && pos.x - xlo < lookAhead) _roomSteer.x += 1 - (pos.x - xlo) / lookAhead;
  if (vel.x > 0 && xhi - pos.x < lookAhead) _roomSteer.x -= 1 - (xhi - pos.x) / lookAhead;
  if (vel.z < 0 && pos.z - zlo < lookAhead) _roomSteer.z += 1 - (pos.z - zlo) / lookAhead;
  if (vel.z > 0 && zhi - pos.z < lookAhead) _roomSteer.z -= 1 - (zhi - pos.z) / lookAhead;

  return _roomSteer;
}

// Hard clamp — prevents any fish from crossing its room boundary.
// Position is corrected instantly; velocity is steered gradually toward the
// reflected direction so fish curve away from walls instead of snapping.
const _reflectTarget = new THREE.Vector3();
function roomHardClamp(pos, vel, room, dt) {
  const HARD = 0.55;
  const b = HOUSE_BOUNDS;
  const xlo = room.xMin + HARD, xhi = room.xMax - HARD;
  const zlo = room.zMin + HARD, zhi = room.zMax - HARD;
  const ylo = b.yMin,           yhi = b.yMax;

  // Build the reflected target in a scratch vector — don't touch vel yet.
  _reflectTarget.copy(vel);
  let hit = false;

  if (pos.x < xlo) { pos.x = xlo; if (_reflectTarget.x < 0) { _reflectTarget.x *= -1; hit = true; } }
  if (pos.x > xhi) { pos.x = xhi; if (_reflectTarget.x > 0) { _reflectTarget.x *= -1; hit = true; } }
  if (pos.z < zlo) { pos.z = zlo; if (_reflectTarget.z < 0) { _reflectTarget.z *= -1; hit = true; } }
  if (pos.z > zhi) { pos.z = zhi; if (_reflectTarget.z > 0) { _reflectTarget.z *= -1; hit = true; } }
  if (pos.y < ylo) { pos.y = ylo; if (_reflectTarget.y < 0) { _reflectTarget.y *= -1; hit = true; } }
  if (pos.y > yhi) { pos.y = yhi; if (_reflectTarget.y > 0) { _reflectTarget.y *= -1; hit = true; } }

  if (hit) {
    // Lerp vel toward the reflected direction — fish curves over ~0.3 s, not snaps.
    vel.lerp(_reflectTarget.normalize(), Math.min(1.0, dt * 6.0)).normalize();
  }
}

// ─── Loading screen helpers ───────────────────────────────────────────────────
const _fill = document.getElementById('loading-fill');
const _pct  = document.getElementById('loading-pct');

function setLoadProgress(fraction) {
  const pct = Math.round(fraction * 100);
  if (_fill) _fill.style.width = pct + '%';
  if (_pct)  _pct.textContent  = pct + '%';
}

function hideLoadingScreen() {
  const el = document.getElementById('loading');
  if (!el) return;
  el.classList.add('fade-out');
  el.addEventListener('transitionend', () => el.remove(), { once: true });
}

// ─── School state ─────────────────────────────────────────────────────────────
const school = [];

async function spawnSchool() {
  const assetNames = [...new Set(SCHOOL_CONFIG.map(c => c.type))];
  const total = assetNames.length;
  let loaded = 0;

  setLoadProgress(0.05);   // show immediate progress so bar isn't blank

  const assets = Object.fromEntries(
    await Promise.all(
      assetNames.map(async n => {
        const asset = await loadFishAsset(n);
        loaded++;
        setLoadProgress(0.05 + (loaded / total) * 0.90);
        return [n, asset];
      }),
    ),
  );

  const spawnedPositions = [];
  const MIN_SEP = 2.5;

  // Distribute fish proportionally to room floor area.
  // Areas: R1=196, R2=168, R3=196, R4=168, R5=168, R6=140, R7=120, R8=120 → total=1276
  // Counts scaled to 200 fish: [30,26,30,26,26,22,20,20]
  const ROOM_FISH_COUNTS = [30, 26, 30, 26, 26, 22, 20, 20];
  const roomAssignments = [];
  ROOM_FISH_COUNTS.forEach((n, idx) => {
    for (let k = 0; k < n; k++) roomAssignments.push(ROOMS[idx]);
  });
  // Shuffle so fish types are spread across all rooms, not bunched by type
  for (let i = roomAssignments.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [roomAssignments[i], roomAssignments[j]] = [roomAssignments[j], roomAssignments[i]];
  }
  let fishIdx = 0;

  for (const { type, count } of SCHOOL_CONFIG) {
    const { geo, diffuseMap, normalMapTex } = assets[type];
    const tp = FISH_TYPES[type];

    for (let i = 0; i < count; i++) {
      const room = roomAssignments[fishIdx++];

      const tint = TROPICAL_PALETTE[Math.floor(Math.random() * TROPICAL_PALETTE.length)];
      const mat  = createFishMaterial(diffuseMap, normalMapTex, tp, tint);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.scale.setScalar(tp.scale);

      let pos;
      for (let attempt = 0; attempt < 150; attempt++) {
        pos = spawnInRoom(room);
        if (spawnedPositions.every(p => p.distanceTo(pos) >= MIN_SEP)) break;
      }
      spawnedPositions.push(pos.clone());
      mesh.position.copy(pos);

      const vel       = randomDir();
      const facingDir = vel.clone();

      // Per-fish speed spread
      const isSmall = type.startsWith('Small');
      const speedMult = isSmall ? randFloat(0.7, 1.6) : randFloat(0.6, 1.4);
      const baseSpeed = tp.swimSpeed * speedMult;

      // Circle orbit params — unique per fish so paths don't overlap
      const roomCx  = (room.xMin + room.xMax) / 2;
      const roomCz  = (room.zMin + room.zMax) / 2;
      const halfW   = (room.xMax - room.xMin) / 2;
      const halfD   = (room.zMax - room.zMin) / 2;
      const circleCenter = new THREE.Vector2(
        roomCx + randFloat(-halfW * 0.25, halfW * 0.25),
        roomCz + randFloat(-halfD * 0.25, halfD * 0.25),
      );
      const maxR        = Math.min(halfW, halfD) * 0.55;
      const circleRadius = randFloat(2.0, Math.max(2.5, maxR));
      const orbitDir    = Math.random() < 0.5 ? 1 : -1;  // +1 CCW, -1 CW

      school.push({
        mesh,
        pos,
        vel,
        smoothVel:    vel.clone(),   // lerp buffer — movement follows this, never raw vel
        facingDir,
        room,
        circleCenter,
        circleRadius,
        orbitDir,
        swimSpeed:    baseSpeed,
        currentSpeed: baseSpeed,
        targetSpeed:  baseSpeed,     // lerp target — set by pause logic, never jumped to directly
        tailSpeed:    tp.tailSpeed * randFloat(0.75, 1.30),
        turnRate:     tp.turnRate,
        timeOffset:   Math.random() * Math.PI * 2,
        wanderPhase:  Math.random() * Math.PI * 2,  // used for gentle Y drift only
        pauseTimer:    0,
        pauseChance:   randFloat(0.0001, 0.0004),
        speedWaveFreq: randFloat(0.2, 0.6),   // cycles per second — slow, organic rhythm
        speedWavePhase: Math.random() * Math.PI * 2,
        speedWaveAmt:  randFloat(0.15, 0.28), // ±15–28 % of base speed
      });

      scene.add(mesh);
    }
  }

  setLoadProgress(1.0);
  // Short delay so the bar reaches 100% visibly before fading
  setTimeout(hideLoadingScreen, 300);
}

// ─── Animation loop ───────────────────────────────────────────────────────────
const timer  = new THREE.Timer();
let lastTime = 0;

function animate() {
  requestAnimationFrame(animate);
  timer.update();
  const t  = timer.getElapsed();
  const dt = Math.min(t - lastTime, 0.05);
  lastTime = t;

  // Fish movement & animation
  for (const fish of school) {

    // ── 1. Orbit steering — chase a look-ahead point on the fish's circle ───
    {
      const dx    = fish.pos.x - fish.circleCenter.x;
      const dz    = fish.pos.z - fish.circleCenter.z;
      const angle = Math.atan2(dz, dx);
      // Aim 0.5 rad ahead on the orbit so the fish smoothly follows the curve
      const tAngle = angle + fish.orbitDir * 0.5;
      const tx = fish.circleCenter.x + fish.circleRadius * Math.cos(tAngle);
      const tz = fish.circleCenter.z + fish.circleRadius * Math.sin(tAngle);
      const tdx = tx - fish.pos.x;
      const tdz = tz - fish.pos.z;
      const tLen = Math.sqrt(tdx * tdx + tdz * tdz);
      if (tLen > 0.01) {
        // Gentle vertical drift adds life without leaving the room
        const ty = Math.sin(t * 0.4 + fish.wanderPhase) * 0.06;
        const desired = new THREE.Vector3(tdx / tLen, ty, tdz / tLen).normalize();
        fish.vel.lerp(desired, fish.turnRate * dt * 1.5).normalize();
      }
    }

    // ── 2. Wall-avoidance steering (solid wall faces within the room) ───────
    {
      const lookAhead = 3.0 + fish.swimSpeed * 0.30;
      const steer = wallSteering(fish.pos, fish.vel, lookAhead);
      const steerMag = steer.length();
      if (steerMag > 0.001) {
        const alpha = Math.min(1.0, fish.turnRate * steerMag * dt * 6.0);
        fish.vel.lerp(steer.normalize(), alpha).normalize();
      }
    }

    // ── 2b. Room boundary steering — blocks doorways, keeps fish in their room
    {
      const steer = roomSteering(fish.pos, fish.vel, fish.room, 3.5);
      const mag = steer.length();
      if (mag > 0.001) {
        const alpha = Math.min(1.0, fish.turnRate * mag * dt * 8.0);
        fish.vel.lerp(steer.normalize(), alpha).normalize();
      }
    }

    // ── 2c. Smooth velocity — lerp the movement direction toward steering intent
    fish.smoothVel.lerp(fish.vel, Math.min(1.0, dt * 3.5)).normalize();

    // ── 3. Pause / speed management ─────────────────────────────────────────
    if (fish.pauseTimer > 0) {
      fish.pauseTimer -= dt;
      fish.targetSpeed = 0.0;
    } else {
      fish.targetSpeed = fish.swimSpeed *
        (1.0 + fish.speedWaveAmt * Math.sin(t * fish.speedWaveFreq + fish.speedWavePhase));
      if (Math.random() < fish.pauseChance) {
        fish.pauseTimer = randFloat(0.6, 2.8);
      }
    }
    // Lerp speed toward target — never jumps, always glides in/out
    fish.currentSpeed = THREE.MathUtils.lerp(fish.currentSpeed, fish.targetSpeed, Math.min(1.0, dt * 2.2));

    // ── 4. Move ─────────────────────────────────────────────────────────────
    fish.pos.addScaledVector(fish.smoothVel, fish.currentSpeed * dt);

    // ── 5. Hard boundary enforcement ────────────────────────────────────────
    roomHardClamp(fish.pos, fish.vel, fish.room, dt);  // room boundary, no doorway escape

    // ── 6. Visual orientation ───────────────────────────────────────────────
    fish.facingDir.lerp(fish.smoothVel, Math.min(1, fish.turnRate * dt)).normalize();

    fish.mesh.position.copy(fish.pos);
    fish.mesh.rotation.y = Math.atan2(fish.facingDir.x, fish.facingDir.z);
    fish.mesh.rotation.x = -Math.asin(
      Math.max(-0.9, Math.min(0.9, fish.facingDir.y)),
    );

    // ── 7. Tail animation — speed follows currentSpeed so paused fish slow down
    const animSpeed = fish.tailSpeed * (fish.currentSpeed / Math.max(fish.swimSpeed, 0.01));
    fish.mesh.material.uniforms.time.value = t * animSpeed + fish.timeOffset;
  }

  // Caustics, water surface, bubbles
  updateEffects(t, dt);

  controls.update();
  renderer.render(scene, camera);
}

// ─── Boot ─────────────────────────────────────────────────────────────────────
buildFurniture(scene);      // synchronous — pure geometry, no asset loading
spawnSchool().catch(console.error);

animate();
