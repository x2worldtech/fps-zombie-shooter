export const skyVertexShader = `
  varying vec3 vWorldPosition;

  void main() {
    vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const skyFragmentShader = `
  varying vec3 vWorldPosition;

  void main() {
    // Normalize y to 0..1 range
    float t = clamp((vWorldPosition.y + 50.0) / 200.0, 0.0, 1.0);

    // Desert sky: burnt orange at horizon -> deep red-purple at zenith
    vec3 horizon = vec3(0.95, 0.45, 0.15);
    vec3 midSky = vec3(0.75, 0.25, 0.12);
    vec3 zenith = vec3(0.35, 0.08, 0.18);

    vec3 color;
    if (t < 0.4) {
      color = mix(horizon, midSky, t / 0.4);
    } else {
      color = mix(midSky, zenith, (t - 0.4) / 0.6);
    }

    // Sun glow near horizon
    float sunGlow = pow(max(0.0, 1.0 - t * 3.0), 2.0);
    color += vec3(1.0, 0.6, 0.1) * sunGlow * 0.4;

    gl_FragColor = vec4(color, 1.0);
  }
`;
