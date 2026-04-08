export const sandVertexShader = `
  varying vec2 vUv;
  varying float vHeight;

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
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

export const sandFragmentShader = `
  varying vec2 vUv;
  varying float vHeight;

  void main() {
    // Warm sandy tones
    vec3 sandLight = vec3(0.85, 0.72, 0.45);
    vec3 sandDark = vec3(0.62, 0.48, 0.28);
    vec3 color = mix(sandDark, sandLight, clamp(vHeight * 0.4 + 0.5, 0.0, 1.0));

    // Subtle stripe pattern for dune effect
    float stripe = sin(vUv.x * 80.0 + vHeight * 5.0) * 0.03;
    color += stripe;

    gl_FragColor = vec4(color, 1.0);
  }
`;
