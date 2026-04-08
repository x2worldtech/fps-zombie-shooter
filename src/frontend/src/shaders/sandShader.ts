export const sandVertexShader = `
  varying vec2 vUv;
  varying float vHeight;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPos;

  // Simple hash function
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  // Value noise
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  void main() {
    vUv = uv;
    vec3 pos = position;
    // Dune displacement
    float n = noise(pos.xz * 0.05) * 2.0
            + noise(pos.xz * 0.12) * 0.8
            + noise(pos.xz * 0.3) * 0.3;
    pos.y += n;
    vHeight = n;

    // World-space position and approximate normal for specular
    vec4 worldPos = modelMatrix * vec4(pos, 1.0);
    vWorldPos = worldPos.xyz;
    // Approximate normal from dune gradient (mostly up, tilted by dune slope)
    vec3 approxNormal = normalize(vec3(0.0, 1.0, 0.0));
    vWorldNormal = normalize(mat3(modelMatrix) * approxNormal);

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

export const sandFragmentShader = `
  varying vec2 vUv;
  varying float vHeight;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPos;

  void main() {
    // Warm sandy tones — gold/amber desert palette
    vec3 sandLight = vec3(0.88, 0.74, 0.46);
    vec3 sandMid   = vec3(0.72, 0.56, 0.33);
    vec3 sandDark  = vec3(0.55, 0.40, 0.22);

    float t = clamp(vHeight * 0.38 + 0.5, 0.0, 1.0);
    vec3 color = t > 0.5
      ? mix(sandMid, sandLight, (t - 0.5) * 2.0)
      : mix(sandDark, sandMid,  t * 2.0);

    // Wind ripple stripes — subtle dune micro-detail
    float ripple1 = sin(vUv.x * 90.0 + vHeight * 6.0) * 0.018;
    float ripple2 = sin(vUv.y * 70.0 + vUv.x * 25.0 + vHeight * 4.0) * 0.012;
    color += ripple1 + ripple2;

    // Micro-grain noise
    float grain = fract(sin(dot(vUv * 512.0, vec2(12.9898, 78.233))) * 43758.5453);
    color += (grain - 0.5) * 0.022;

    // ── Blinn-Phong specular on dune crests ──────────────────────────────
    // Sun direction (matches the cinematic directional light position)
    vec3 sunDir = normalize(vec3(80.0, 120.0, 60.0));
    // Camera is at roughly (0, eye-height, 0) — use a fixed approximation
    vec3 toCamera = normalize(vec3(0.0, 1.0, 0.0));
    vec3 halfVec  = normalize(sunDir + toCamera);
    vec3 n        = normalize(vWorldNormal);

    float spec = pow(max(dot(n, halfVec), 0.0), 32.0);
    // Only light dune crests (high vHeight) with specular
    float crestMask = clamp((vHeight - 1.5) * 0.5, 0.0, 1.0);
    // Warm specular — sun color tint
    vec3 specColor = vec3(1.0, 0.92, 0.72) * spec * crestMask * 0.22;
    color += specColor;

    // Clamp
    color = clamp(color, 0.0, 1.0);

    gl_FragColor = vec4(color, 1.0);
  }
`;
