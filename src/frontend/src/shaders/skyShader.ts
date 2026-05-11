/**
 * Desert sky shader with anchored sun position.
 *
 * Receives the sun direction as a uniform (normalized vector pointing
 * toward the sun). The sky gradient runs from warm orange at the horizon
 * to deeper red-purple at the zenith, and a soft glow surrounds the
 * sun's actual angular position — keeping the visual sun, the shader's
 * glow, and the directionalLight's shadow direction all in sync.
 */

export const skyVertexShader = `
  varying vec3 vWorldPosition;

  void main() {
    vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const skyFragmentShader = `
  varying vec3 vWorldPosition;
  uniform vec3 uSunDir;   // normalized direction toward the sun

  void main() {
    // Vertical gradient
    float t = clamp((vWorldPosition.y + 50.0) / 200.0, 0.0, 1.0);

    // Warm desert sky: bright orange at horizon → deeper red-purple at zenith
    vec3 horizon = vec3(0.96, 0.55, 0.22);
    vec3 midSky  = vec3(0.78, 0.32, 0.16);
    vec3 zenith  = vec3(0.32, 0.10, 0.18);

    vec3 color;
    if (t < 0.4) {
      color = mix(horizon, midSky, t / 0.4);
    } else {
      color = mix(midSky, zenith, (t - 0.4) / 0.6);
    }

    // Angular distance to the sun
    vec3 dirToPixel = normalize(vWorldPosition);
    float sunDot = max(0.0, dot(dirToPixel, normalize(uSunDir)));

    // Tight inner glow (close to the sun itself)
    float innerGlow = pow(sunDot, 32.0);
    color += vec3(1.0, 0.85, 0.55) * innerGlow * 0.9;

    // Wide warm glow around the sun (atmosphere scattering)
    float wideGlow = pow(sunDot, 4.0);
    color += vec3(1.0, 0.55, 0.18) * wideGlow * 0.4;

    // Soft horizon haze
    float horizonFade = pow(max(0.0, 1.0 - t * 3.0), 2.0);
    color += vec3(1.0, 0.6, 0.15) * horizonFade * 0.15;

    gl_FragColor = vec4(color, 1.0);
  }
`;
