/**
 * props.js — loads aquarium environment props from public/assets/ and
 * places them on the floors of specific rooms.
 *
 * Uses the same JSON format as fish assets. Props are rendered with
 * MeshStandardMaterial (diffuse + normal map) — no animation shader needed.
 */
import * as THREE from 'three';

const texLoader = new THREE.TextureLoader();

function loadTex(filename, srgb = true) {
  return new Promise(resolve => {
    texLoader.load(
      `${import.meta.env.BASE_URL}assets/${filename}`,
      t => { if (srgb) t.colorSpace = THREE.SRGBColorSpace; resolve(t); },
      undefined,
      () => resolve(null),
    );
  });
}

// Parse one asset JSON, return array of { geo, mat } (one per sub-mesh/model)
async function loadProp(name) {
  const res  = await fetch(`${import.meta.env.BASE_URL}assets/${name}.js`);
  const json = await res.json();

  return Promise.all(json.models.map(async ({ fields, textures }) => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(fields.position.data), 3));
    geo.setAttribute('normal',   new THREE.BufferAttribute(new Float32Array(fields.normal.data),   3));
    geo.setAttribute('uv',       new THREE.BufferAttribute(new Float32Array(fields.texCoord.data), 2));
    geo.setIndex(new THREE.BufferAttribute(new Uint16Array(fields.indices.data), 1));
    geo.computeBoundingBox();

    // Avoid using the same texture as both diffuse and normal map
    // (SeaweedA/B reference Seeweeds.png for both — skip normal in that case)
    const normalFile = textures.normalMap !== textures.diffuse ? textures.normalMap : null;

    const [map, normalMap] = await Promise.all([
      textures.diffuse ? loadTex(textures.diffuse, true)  : Promise.resolve(null),
      normalFile       ? loadTex(normalFile,        false) : Promise.resolve(null),
    ]);

    const mat = new THREE.MeshStandardMaterial({
      map,
      normalMap,
      roughness: 0.85,
      metalness: 0.05,
    });

    return { geo, mat };
  }));
}

// Place all sub-meshes of a prop at world (x, z), auto-scaled to targetHeight,
// sitting flush on the floor (y = 0).
function place(scene, models, x, z, targetHeight, rotY = 0) {
  for (const { geo, mat } of models) {
    const bb = geo.boundingBox;
    const naturalH = bb.max.y - bb.min.y;
    const scale    = naturalH > 0 ? targetHeight / naturalH : 1.0;
    // Lift so bounding-box bottom is at y = 0
    const yFloor   = -bb.min.y * scale;

    const mesh = new THREE.Mesh(geo, mat);
    mesh.scale.setScalar(scale);
    mesh.rotation.y = rotY;
    mesh.position.set(x, yFloor, z);
    scene.add(mesh);
  }
}

// ── Prop placement ────────────────────────────────────────────────────────────
// Room grid for reference (from house.js):
//   C = [-19, -5, 7, 19]  →  col boundaries
//   R = [-19, -5, 9, 19]  →  row boundaries
//
//   R1 centre (-12,-12)  R2 centre (1,-12)   [top row, 2 cols only]
//   R3 centre (-12,  2)  R4 centre (1,  2)   R5 centre (13, 2)
//   R6 centre (-12, 14)  R7 centre (1, 14)   R8 centre (13,14)

export async function loadProps(scene) {
  const [chest, coral, coralStoneA, coralStoneB, rockA, rockB, seaweedA, seaweedB, stone] =
    await Promise.all([
      loadProp('TreasureChest'),
      loadProp('Coral'),
      loadProp('CoralStoneA'),
      loadProp('CoralStoneB'),
      loadProp('RockA'),
      loadProp('RockB'),
      loadProp('SeaweedA'),
      loadProp('SeaweedB'),
      loadProp('Stone'),
    ]);

  // ── R1 Living Room — treasure chest + seaweed ─────────────────────────────
  place(scene, chest,    -16.5, -16.5, 1.4,  0.4);
  place(scene, seaweedA, -16.0, -7.5,  2.2,  1.1);
  place(scene, stone,    -7.5,  -7.5,  0.8,  2.3);

  // ── R2 Kitchen — coral ────────────────────────────────────────────────────
  place(scene, coral,    4.5,  -17.5, 2.0,  0.0);
  place(scene, coral,   -2.5,  -7.5,  1.5,  2.5);
  place(scene, rockA,    5.5,  -7.5,  1.1,  1.8);

  // ── R3 Master Bedroom — seaweed + rock ───────────────────────────────────
  place(scene, seaweedB, -16.5,  -3.5, 2.4,  0.0);
  place(scene, rockB,    -16.5,   7.5, 1.3,  2.0);
  place(scene, seaweedA, -7.5,   -3.0, 1.8,  3.5);

  // ── R4 Master Bathroom — coral stone ─────────────────────────────────────
  place(scene, coralStoneA, 5.0, -3.5, 1.9, 0.6);
  place(scene, stone,       -3.5,  7.5, 0.9, 1.5);

  // ── R5 Bedroom 2 — coral stone + seaweed ─────────────────────────────────
  place(scene, coralStoneB, 10.5, -3.5, 2.3, 1.0);
  place(scene, seaweedB,    17.5,  7.5, 2.1, 0.3);
  place(scene, rockA,       17.5, -3.5, 1.0, 2.7);

  // ── R6 Bedroom 3 — rocks + seaweed ───────────────────────────────────────
  place(scene, rockB,    -17.0, 10.5, 1.6, 0.5);
  place(scene, seaweedA, -7.5,  17.5, 2.0, 4.2);
  place(scene, stone,    -16.5, 17.5, 0.7, 1.9);

  // ── R7 Hallway / Bathroom — coral + rock ─────────────────────────────────
  place(scene, coral,   -2.5, 10.5, 1.7, 3.0);
  place(scene, rockA,    5.5, 17.5, 1.2, 0.9);

  // ── R8 Office — treasure chest + coral stone ─────────────────────────────
  place(scene, chest,       10.5, 17.5, 1.3, 1.8);
  place(scene, coralStoneA, 17.5, 17.5, 1.6, 0.2);
  place(scene, seaweedB,    17.5, 10.5, 1.9, 2.4);

  console.log('Props placed');
}
