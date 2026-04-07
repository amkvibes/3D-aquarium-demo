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
controls.minDistance      = 15;
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
  BigFishA:    { fishLength: 10, fishWaveLength: -1,   fishBendAmount: 0.5,  tailSpeed: 1.5,  swimSpeed: 2.0, turnRate: 0.9,  scale: 0.25 },
  BigFishB:    { fishLength: 10, fishWaveLength: -0.7, fishBendAmount: 0.3,  tailSpeed: 1.0,  swimSpeed: 2.2, turnRate: 0.9,  scale: 0.25 },
  MediumFishA: { fishLength: 10, fishWaveLength: -2,   fishBendAmount: 2.0,  tailSpeed: 1.0,  swimSpeed: 3.5, turnRate: 2.2,  scale: 0.60 },
  MediumFishB: { fishLength: 10, fishWaveLength: -2,   fishBendAmount: 2.0,  tailSpeed: 3.0,  swimSpeed: 3.2, turnRate: 2.2,  scale: 0.80 },
  SmallFishA:  { fishLength: 10, fishWaveLength: 1,    fishBendAmount: 2.0,  tailSpeed: 10.0, swimSpeed: 5.5, turnRate: 5.0,  scale: 1.50 },
};

const SCHOOL_CONFIG = [
  { type: 'BigFishA',    count: 1 },
  { type: 'BigFishB',    count: 1 },
  { type: 'MediumFishA', count: 3 },
  { type: 'MediumFishB', count: 4 },
  { type: 'SmallFishA',  count: 8 },
];

// ─── Lighting uniform shared across all fish materials ────────────────────────
const LIGHT_WORLD_POS = new THREE.Vector3(-10, 60, -20);

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

// ─── Bounce logic — L-shaped boundary ────────────────────────────────────────
function bounceInHouse(pos, vel) {
  const b = HOUSE_BOUNDS;
  let bounced = false;

  const check = (axis, lo, hi) => {
    if (pos[axis] < lo) { pos[axis] = lo; if (vel[axis] < 0) vel[axis] *= -1; bounced = true; }
    if (pos[axis] > hi) { pos[axis] = hi; if (vel[axis] > 0) vel[axis] *= -1; bounced = true; }
  };
  check('x', b.xMin, b.xMax);
  check('y', b.yMin, b.yMax);
  check('z', b.zMin, b.zMax);

  if (pos.x > b.notchX && pos.z < b.notchZ) {
    const overX = pos.x - b.notchX;
    const overZ = b.notchZ - pos.z;
    if (overX >= overZ) {
      pos.x = b.notchX;
      if (vel.x > 0) vel.x *= -1;
    } else {
      pos.z = b.notchZ;
      if (vel.z < 0) vel.z *= -1;
    }
    bounced = true;
  }

  if (bounced) {
    vel.x += randFloat(-0.08, 0.08);
    vel.z += randFloat(-0.08, 0.08);
    vel.normalize();
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
  const MIN_SEP = 4.5;

  for (const { type, count } of SCHOOL_CONFIG) {
    const { geo, diffuseMap, normalMapTex } = assets[type];
    const tp = FISH_TYPES[type];

    for (let i = 0; i < count; i++) {
      const mat  = createFishMaterial(diffuseMap, normalMapTex, tp);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.scale.setScalar(tp.scale);

      let pos;
      for (let attempt = 0; attempt < 40; attempt++) {
        pos = spawnInHouse();
        if (spawnedPositions.every(p => p.distanceTo(pos) >= MIN_SEP)) break;
      }
      spawnedPositions.push(pos.clone());
      mesh.position.copy(pos);

      const vel       = randomDir();
      const facingDir = vel.clone();

      // Wide per-fish speed spread: big fish 0.5–1.1×, small fish 0.7–1.6×
      const isBig   = type.startsWith('Big');
      const isSmall = type.startsWith('Small');
      const speedMult = isBig
        ? randFloat(0.5, 1.1)
        : isSmall
          ? randFloat(0.7, 1.6)
          : randFloat(0.6, 1.4);
      const baseSpeed = tp.swimSpeed * speedMult;

      school.push({
        mesh,
        pos,
        vel,
        facingDir,
        swimSpeed:    baseSpeed,
        currentSpeed: baseSpeed,          // actual speed — varies during pauses
        tailSpeed:    tp.tailSpeed  * randFloat(0.75, 1.30),
        turnRate:     tp.turnRate,
        timeOffset:   Math.random() * Math.PI * 2,
        // Wandering (gentle sinusoidal meander)
        wanderFreq:   randFloat(0.3, 1.1),
        wanderPhase:  Math.random() * Math.PI * 2,
        wanderAmt:    randFloat(0.35, 1.1),  // lateral force amplitude (dt-scaled in loop)
        // Pausing
        pauseTimer:    0,
        pauseChance:   randFloat(0.0001, 0.0004),  // per-frame probability
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

    // ── 1. Wander — gentle sinusoidal meander perpendicular to travel ───────
    // Computed before wall steering so walls can override it cleanly.
    {
      const lateral = Math.sin(t * fish.wanderFreq + fish.wanderPhase) * fish.wanderAmt * dt;
      const px = -fish.vel.z;   // perpendicular to vel in XZ plane
      const pz =  fish.vel.x;
      fish.vel.x += px * lateral;
      fish.vel.z += pz * lateral;
      fish.vel.normalize();
    }

    // ── 2. Wall-avoidance steering ──────────────────────────────────────────
    // lookAhead scales with speed so fast fish react earlier.
    {
      const lookAhead = 3.0 + fish.swimSpeed * 0.30;
      const steer = wallSteering(fish.pos, fish.vel, lookAhead);
      const steerMag = steer.length();
      if (steerMag > 0.001) {
        const alpha = Math.min(1.0, fish.turnRate * steerMag * dt * 6.0);
        fish.vel.lerp(steer.normalize(), alpha).normalize();
      }
    }

    // ── 3. Pause / speed management ─────────────────────────────────────────
    if (fish.pauseTimer > 0) {
      fish.pauseTimer -= dt;
      // Slow to near-stop smoothly
      fish.currentSpeed = Math.max(0.05, fish.currentSpeed - fish.swimSpeed * dt * 2.5);
    } else {
      // Ramp back to full speed
      fish.currentSpeed = Math.min(fish.swimSpeed,
        fish.currentSpeed + fish.swimSpeed * dt * 1.2);
      // Random chance to start a pause
      if (Math.random() < fish.pauseChance) {
        fish.pauseTimer = randFloat(0.6, 2.8);
      }
    }

    // ── 4. Move ─────────────────────────────────────────────────────────────
    fish.pos.addScaledVector(fish.vel, fish.currentSpeed * dt);

    // ── 5. Hard boundary enforcement ────────────────────────────────────────
    bounceInHouse(fish.pos, fish.vel);   // outer L-shape
    hardWallClamp(fish.pos, fish.vel);   // inner walls

    // ── 6. Visual orientation ───────────────────────────────────────────────
    fish.facingDir.lerp(fish.vel, Math.min(1, fish.turnRate * dt)).normalize();

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
