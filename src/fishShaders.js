// Fish shaders for THREE.ShaderMaterial.
//
// ShaderMaterial auto-injects built-in uniforms and attributes in its preamble:
//   uniforms: modelMatrix, modelViewMatrix, projectionMatrix, viewMatrix,
//             normalMatrix, cameraPosition
//   attributes: position (vec3), normal (vec3), uv (vec2)
// Do NOT redeclare any of these — only declare custom ones.
// Three.js also upgrades GLSL1 syntax (attribute/varying/texture2D/gl_FragColor)
// to GLSL3 automatically, so we can use either style here.

export const fishVertexShader = /* glsl */ `
// ── Custom fish attributes (tangent-space basis stored in the asset) ────────
attribute vec3 a_tangent;
attribute vec3 a_binormal;

// ── Swim animation uniforms ────────────────────────────────────────────────
// Values from aquarium.js: BigFishA → length=10, waveLength=-1, bend=0.5
uniform float time;
uniform float fishLength;      // body length for normalising the Z position
uniform float fishWaveLength;  // wave frequency multiplier along the body
uniform float fishBendAmount;  // overall lateral bend scale

// ── Lighting ───────────────────────────────────────────────────────────────
uniform vec3 lightWorldPos;

// ── Varyings ───────────────────────────────────────────────────────────────
varying vec2 v_uv;
varying vec3 v_worldNormal;
varying vec3 v_worldTangent;
varying vec3 v_worldBinormal;
varying vec3 v_toLight;
varying vec3 v_toCamera;

void main() {
  // ── Swim deformation ── (directly from WebGL Aquarium fishVertexShader) ──
  // mult: normalised position along body — grows quadratically head→tail.
  // +Z = snout area, -Z = tail area (tail gets 2× faster growth).
  float mult = position.z > 0.0
    ? ( position.z / fishLength)
    : (-position.z / fishLength * 2.0);

  float s      = sin(time + mult * fishWaveLength);
  float offset = pow(mult, 2.0) * s * fishBendAmount;

  // Lateral (X-axis) bend in local fish space
  vec3 animPos = vec3(position) + vec3(offset, 0.0, 0.0);

  // ── World-space quantities ────────────────────────────────────────────────
  vec4 worldPos4 = modelMatrix * vec4(animPos, 1.0);
  v_toLight  = lightWorldPos - worldPos4.xyz;
  v_toCamera = cameraPosition - worldPos4.xyz;

  // mat3(modelMatrix) is correct for uniform-scale meshes
  mat3 m3        = mat3(modelMatrix);
  v_worldNormal  = normalize(m3 * vec3(normal));
  v_worldTangent = normalize(m3 * a_tangent);
  v_worldBinormal= normalize(m3 * a_binormal);

  v_uv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(animPos, 1.0);
}
`;

export const fishFragmentShader = /* glsl */ `
// ── Textures ────────────────────────────────────────────────────────────────
uniform sampler2D diffuseMap;
uniform sampler2D normalMapTex;

// ── Tropical colour tint (per-fish, multiplied onto the diffuse) ─────────────
uniform vec3 tintColor;

// ── Blinn-Phong lighting (matches original aquarium fragment shader) ─────────
uniform vec4  lightColor;
uniform vec4  ambient;
uniform vec4  specular;
uniform float shininess;
uniform float specularFactor;

// ── Varyings ────────────────────────────────────────────────────────────────
varying vec2 v_uv;
varying vec3 v_worldNormal;
varying vec3 v_worldTangent;
varying vec3 v_worldBinormal;
varying vec3 v_toLight;
varying vec3 v_toCamera;

// Direct port of the lit() helper from the original aquarium shader
vec4 lit(float l, float h, float m) {
  return vec4(1.0,
              max(l, 0.0),
              (l > 0.0) ? pow(max(0.0, h), m) : 0.0,
              1.0);
}

void main() {
  vec4 diffuseColor = texture2D(diffuseMap, v_uv);
  // Multiply tint onto the diffuse — preserves texture detail while shifting hue.
  // tintColor values > 1.0 boost brightness so even mid-tones become vivid.
  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * tintColor, 0.82);

  // Tangent-space normal map → world space (original aquarium technique)
  mat3 tangentToWorld = mat3(v_worldTangent, v_worldBinormal, v_worldNormal);
  vec4 normalSpec    = texture2D(normalMapTex, v_uv);
  vec3 tangentNormal = normalSpec.xyz - vec3(0.5);
  // Bias toward flat slightly (same tweak as the original)
  tangentNormal = normalize(tangentNormal + vec3(0.0, 0.0, 2.0));
  vec3 n = normalize(tangentToWorld * tangentNormal);

  vec3 surfaceToLight = normalize(v_toLight);
  vec3 surfaceToView  = normalize(v_toCamera);
  vec3 halfVector     = normalize(surfaceToLight + surfaceToView);

  vec4 litR = lit(dot(n, surfaceToLight), dot(n, halfVector), shininess);

  // Original aquarium lighting equation — unchanged
  gl_FragColor = vec4(
    (lightColor * (
      diffuseColor * litR.y +
      diffuseColor * ambient +
      specular * litR.z * specularFactor * normalSpec.a
    )).rgb,
    diffuseColor.a
  );
}
`;
