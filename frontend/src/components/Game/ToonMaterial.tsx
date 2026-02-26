import { useRef } from 'react';
import * as THREE from 'three';
import { toonVertexShader, toonFragmentShader } from '../../shaders/toonShader';

interface ToonMaterialProps {
  color: string;
  hitFlash?: number;
}

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
