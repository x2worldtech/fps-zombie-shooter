export const toonVertexShader = `
  varying vec3 vNormal;
  varying vec3 vViewPosition;
  varying vec3 vWorldPosition;

  void main() {
    vNormal = normalize(normalMatrix * normal);
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vViewPosition = -mvPosition.xyz;
    vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

export const toonFragmentShader = `
  uniform vec3 uColor;
  uniform vec3 uLightDir;
  uniform float uHitFlash;

  varying vec3 vNormal;
  varying vec3 vViewPosition;

  void main() {
    vec3 normal = normalize(vNormal);
    vec3 lightDir = normalize(uLightDir);

    float diffuse = dot(normal, lightDir);

    // Posterize into 4 steps (Borderlands style)
    float toon;
    if (diffuse > 0.7) toon = 1.0;
    else if (diffuse > 0.35) toon = 0.7;
    else if (diffuse > 0.0) toon = 0.45;
    else toon = 0.2;

    vec3 color = uColor * toon;

    // Rim light for extra toon pop
    vec3 viewDir = normalize(vViewPosition);
    float rim = 1.0 - max(dot(viewDir, normal), 0.0);
    rim = pow(rim, 3.0);
    color += uColor * rim * 0.3;

    // Hit flash: invert color
    if (uHitFlash > 0.0) {
      color = mix(color, vec3(1.0) - color, uHitFlash);
    }

    gl_FragColor = vec4(color, 1.0);
  }
`;

export const outlineVertexShader = `
  uniform float uOutlineThickness;

  void main() {
    vec3 newPosition = position + normal * uOutlineThickness;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
  }
`;

export const outlineFragmentShader = `
  void main() {
    gl_FragColor = vec4(0.05, 0.03, 0.02, 1.0);
  }
`;
