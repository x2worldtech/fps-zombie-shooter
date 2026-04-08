import { useRef } from "react";
import * as THREE from "three";
import { toonFragmentShader, toonVertexShader } from "../../shaders/toonShader";

// biome-ignore lint: pre-existing issue
interface ToonMaterialProps {
  color: string;
  hitFlash?: number;
}

// Standard PBR material (no cell-shading) — used for zombies
// Includes a subtle undead emissive glow so bloom picks up the zombie
export function useStandardMaterial(color: string, hitFlash = 0) {
  const materialRef = useRef<THREE.MeshStandardMaterial | null>(null);

  if (!materialRef.current) {
    materialRef.current = new THREE.MeshStandardMaterial({
      color: new THREE.Color(color),
      roughness: 0.8,
      metalness: 0.1,
      // Subtle undead glow — picked up by the bloom pass for atmosphere
      emissive: new THREE.Color(0.13, 0.0, 0.0),
      emissiveIntensity: 0.1,
    });
  }

  if (materialRef.current) {
    materialRef.current.color.set(color);
    if (hitFlash > 0) {
      // Hit flash overrides the resting undead glow
      materialRef.current.emissive.setRGB(
        hitFlash * 0.7,
        hitFlash * 0.08,
        hitFlash * 0.08,
      );
      materialRef.current.emissiveIntensity = 1.0;
    } else {
      // Return to subtle undead glow at rest
      materialRef.current.emissive.setRGB(0.13, 0.0, 0.0);
      materialRef.current.emissiveIntensity = 0.1;
    }
  }

  return materialRef.current;
}

// Kept for environment cell-shading (not used by zombies)
export function useToonMaterial(color: string, hitFlash = 0) {
  const materialRef = useRef<THREE.ShaderMaterial | null>(null);

  const colorVec = new THREE.Color(color);

  if (!materialRef.current) {
    materialRef.current = new THREE.ShaderMaterial({
      vertexShader: toonVertexShader,
      fragmentShader: toonFragmentShader,
      uniforms: {
        uColor: { value: colorVec },
        uLightDir: { value: new THREE.Vector3(0.5, 1.0, 0.3).normalize() },
        uHitFlash: { value: hitFlash },
      },
    });
  }

  if (materialRef.current) {
    (materialRef.current.uniforms.uColor.value as THREE.Color).set(color);
    materialRef.current.uniforms.uHitFlash.value = hitFlash;
  }

  return materialRef.current;
}

export function useOutlineMaterial(thickness = 0.08) {
  const materialRef = useRef<THREE.ShaderMaterial | null>(null);

  if (!materialRef.current) {
    materialRef.current = new THREE.ShaderMaterial({
      vertexShader: `
        uniform float uOutlineThickness;
        void main() {
          vec3 newPosition = position + normal * uOutlineThickness;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
        }
      `,
      fragmentShader: `
        void main() {
          gl_FragColor = vec4(0.05, 0.03, 0.02, 1.0);
        }
      `,
      uniforms: {
        uOutlineThickness: { value: thickness },
      },
      side: THREE.BackSide,
    });
  }

  return materialRef.current;
}
