import { useFrame } from "@react-three/fiber";
import type React from "react";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

interface BloodParticlesProps {
  position: [number, number, number];
  direction: [number, number, number];
  intensity?: number;
  onComplete?: () => void;
}

type ParticleKind = "droplet" | "mist" | "chunk";

interface Particle {
  velocity: THREE.Vector3;
  pos: THREE.Vector3;
  life: number;
  maxLife: number;
  scale: number;
  startScale: number;
  kind: ParticleKind;
  rot: number;
  rotSpeed: number;
  hasLanded: boolean;
}

/**
 * Aufgewertete Blut-Partikel:
 *  - 3 Mesh-Layer: Tropfen (Capsules, gestreckt entlang Velocity), Mist/Spray
 *    (additive Sphären), Fleisch-Chunks (Boxen, nur bei Dismemberment)
 *  - Frische Wunde glüht kurz rot (PointLight, 120ms)
 *  - Tropfen werden beim Aufprall flach gedrückt (Splash)
 *  - Farb-Interpolation hellrot → dunkel-braun über Lebenszeit
 */
const BloodParticles: React.FC<BloodParticlesProps> = ({
  position,
  direction,
  intensity = 1.0,
  onComplete,
}) => {
  const dropletRef = useRef<THREE.InstancedMesh>(null);
  const mistRef = useRef<THREE.InstancedMesh>(null);
  const chunkRef = useRef<THREE.InstancedMesh>(null);
  const completed = useRef(false);

  const dropletCount = Math.floor(14 + 12 * intensity);
  const mistCount = Math.floor(10 + 8 * intensity);
  const chunkCount = intensity >= 1.5 ? Math.floor(4 + 4 * intensity) : 0;
  const totalCount = dropletCount + mistCount + chunkCount;

  const freshColor = useMemo(() => new THREE.Color("#d20000"), []);
  const midColor = useMemo(() => new THREE.Color("#7a0000"), []);
  const oldColor = useMemo(() => new THREE.Color("#3a0a0a"), []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: einmalige Initialisierung
  const particles = useMemo<Particle[]>(() => {
    const dir = new THREE.Vector3(...direction).normalize();
    const up =
      Math.abs(dir.y) < 0.9
        ? new THREE.Vector3(0, 1, 0)
        : new THREE.Vector3(1, 0, 0);
    const right = new THREE.Vector3().crossVectors(dir, up).normalize();
    const upPerp = new THREE.Vector3().crossVectors(right, dir).normalize();

    const make = (
      kind: ParticleKind,
      speedRange: [number, number],
      spreadMul: number,
      lifeRange: [number, number],
      scaleRange: [number, number],
    ): Particle => {
      const spread = (Math.PI / 4) * (1 + intensity * 0.25) * spreadMul;
      const theta = (Math.random() - 0.5) * spread * 2;
      const phi = (Math.random() - 0.5) * spread * 2;
      const speed =
        speedRange[0] + Math.random() * (speedRange[1] - speedRange[0]);

      const vel = dir
        .clone()
        .addScaledVector(right, Math.sin(theta))
        .addScaledVector(upPerp, Math.sin(phi))
        .normalize()
        .multiplyScalar(speed);

      vel.y += kind === "mist" ? 1.5 : kind === "droplet" ? 0.8 : 0.4;

      const startScale =
        scaleRange[0] + Math.random() * (scaleRange[1] - scaleRange[0]);

      return {
        velocity: vel,
        pos: new THREE.Vector3(...position),
        life: 0,
        maxLife: lifeRange[0] + Math.random() * (lifeRange[1] - lifeRange[0]),
        scale: startScale,
        startScale,
        kind,
        rot: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 8,
        hasLanded: false,
      };
    };

    const out: Particle[] = [];
    for (let i = 0; i < dropletCount; i++) {
      out.push(
        make(
          "droplet",
          [3.5, 7.0 + 2 * intensity],
          1.0,
          [0.7, 1.4],
          [0.04, 0.09 + intensity * 0.02],
        ),
      );
    }
    for (let i = 0; i < mistCount; i++) {
      out.push(make("mist", [1.5, 4.5], 1.6, [0.35, 0.8], [0.025, 0.06]));
    }
    for (let i = 0; i < chunkCount; i++) {
      out.push(make("chunk", [2.5, 5.0], 0.8, [1.5, 2.6], [0.08, 0.16]));
    }
    return out;
  }, []);

  const dummy = useMemo(() => new THREE.Object3D(), []);
  const zeroMatrix = useMemo(() => new THREE.Matrix4().makeScale(0, 0, 0), []);
  const tmpColor = useMemo(() => new THREE.Color(), []);

  const dropletParticles = useMemo(
    () => particles.filter((p) => p.kind === "droplet"),
    [particles],
  );
  const mistParticles = useMemo(
    () => particles.filter((p) => p.kind === "mist"),
    [particles],
  );
  const chunkParticles = useMemo(
    () => particles.filter((p) => p.kind === "chunk"),
    [particles],
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: einmalige Initialisierung
  useEffect(() => {
    const setupRef = (ref: THREE.InstancedMesh | null, list: Particle[]) => {
      if (!ref) return;
      for (let i = 0; i < list.length; i++) {
        const p = list[i];
        dummy.position.copy(p.pos);
        dummy.rotation.set(p.rot, p.rot * 0.7, 0);
        dummy.scale.setScalar(p.scale);
        dummy.updateMatrix();
        ref.setMatrixAt(i, dummy.matrix);
        ref.setColorAt(i, freshColor);
      }
      ref.instanceMatrix.needsUpdate = true;
      if (ref.instanceColor) ref.instanceColor.needsUpdate = true;
    };
    setupRef(dropletRef.current, dropletParticles);
    setupRef(mistRef.current, mistParticles);
    setupRef(chunkRef.current, chunkParticles);
  }, []);

  useFrame((_, delta) => {
    if (completed.current) return;

    const updateGroup = (
      ref: THREE.InstancedMesh | null,
      list: Particle[],
    ): boolean => {
      if (!ref) return true;
      let allDone = true;

      for (let i = 0; i < list.length; i++) {
        const p = list[i];
        p.life += delta;

        if (p.life < p.maxLife) {
          allDone = false;

          if (p.kind === "mist") {
            p.velocity.y -= 5.5 * delta;
            p.velocity.multiplyScalar(1 - 1.4 * delta);
          } else if (p.kind === "chunk") {
            p.velocity.y -= 14 * delta;
          } else {
            p.velocity.y -= 11 * delta;
          }

          p.pos.addScaledVector(p.velocity, delta);
          p.rot += p.rotSpeed * delta;

          if (p.pos.y < 0.02) {
            p.pos.y = 0.02;
            if (!p.hasLanded) {
              p.hasLanded = true;
              if (p.kind === "droplet") {
                p.scale = p.startScale * 1.4;
                p.velocity.y = Math.abs(p.velocity.y) * 0.08;
                p.velocity.x *= 0.4;
                p.velocity.z *= 0.4;
                p.rotSpeed = 0;
              } else if (p.kind === "chunk") {
                p.velocity.y = Math.abs(p.velocity.y) * 0.18;
                p.velocity.x *= 0.55;
                p.velocity.z *= 0.55;
                p.rotSpeed *= 0.3;
              } else {
                p.velocity.set(0, 0, 0);
              }
            } else {
              p.velocity.y = Math.abs(p.velocity.y) * 0.05;
              p.velocity.x *= 0.6;
              p.velocity.z *= 0.6;
            }
          }

          const t = p.life / p.maxLife;
          let s: number;
          if (p.kind === "mist") {
            s = p.startScale * (1 + t * 0.6) * (1 - t * 0.85);
          } else if (p.kind === "chunk") {
            s = p.scale * (1 - t * 0.25);
          } else {
            s = p.scale * (1 - t * 0.35);
          }

          dummy.position.copy(p.pos);
          if (p.kind === "droplet" && !p.hasLanded) {
            const speed = p.velocity.length();
            const stretch = Math.min(2.5, 1 + speed * 0.15);
            const dirN = p.velocity.clone().normalize();
            const quat = new THREE.Quaternion().setFromUnitVectors(
              new THREE.Vector3(0, 1, 0),
              dirN,
            );
            dummy.quaternion.copy(quat);
            dummy.scale.set(s, s * stretch, s);
          } else if (p.kind === "droplet" && p.hasLanded) {
            dummy.rotation.set(-Math.PI / 2, 0, p.rot);
            dummy.scale.set(s * 1.3, s * 0.15, s * 1.3);
          } else if (p.kind === "chunk") {
            dummy.rotation.set(p.rot, p.rot * 0.6, p.rot * 0.3);
            dummy.scale.set(s, s * (0.65 + Math.sin(p.rot) * 0.1), s * 0.85);
          } else {
            dummy.rotation.set(0, 0, 0);
            dummy.scale.setScalar(Math.max(0.001, s));
          }
          dummy.updateMatrix();
          ref.setMatrixAt(i, dummy.matrix);

          if (p.kind === "mist") {
            tmpColor.copy(freshColor).lerp(midColor, t);
          } else {
            const cT = Math.min(1, t * 1.2);
            if (cT < 0.5) {
              tmpColor.copy(freshColor).lerp(midColor, cT * 2);
            } else {
              tmpColor.copy(midColor).lerp(oldColor, (cT - 0.5) * 2);
            }
          }
          ref.setColorAt(i, tmpColor);
        } else {
          ref.setMatrixAt(i, zeroMatrix);
        }
      }

      ref.instanceMatrix.needsUpdate = true;
      if (ref.instanceColor) ref.instanceColor.needsUpdate = true;
      return allDone;
    };

    const d1 = updateGroup(dropletRef.current, dropletParticles);
    const d2 = updateGroup(mistRef.current, mistParticles);
    const d3 = updateGroup(chunkRef.current, chunkParticles);

    if (d1 && d2 && d3 && !completed.current) {
      completed.current = true;
      onComplete?.();
    }
  });

  return (
    <group>
      <instancedMesh
        ref={dropletRef}
        args={[undefined, undefined, dropletCount]}
        frustumCulled={false}
      >
        <capsuleGeometry args={[0.5, 1.0, 3, 5]} />
        <meshStandardMaterial
          color="#ffffff"
          vertexColors
          roughness={0.3}
          metalness={0.1}
          emissive="#440000"
          emissiveIntensity={0.35}
        />
      </instancedMesh>

      {mistCount > 0 && (
        <instancedMesh
          ref={mistRef}
          args={[undefined, undefined, mistCount]}
          frustumCulled={false}
        >
          <sphereGeometry args={[1, 5, 4]} />
          <meshBasicMaterial
            color="#ffffff"
            vertexColors
            transparent
            opacity={0.7}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </instancedMesh>
      )}

      {chunkCount > 0 && (
        <instancedMesh
          ref={chunkRef}
          args={[undefined, undefined, chunkCount]}
          frustumCulled={false}
        >
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial
            color="#ffffff"
            vertexColors
            roughness={0.6}
            metalness={0.0}
            emissive="#220000"
            emissiveIntensity={0.2}
          />
        </instancedMesh>
      )}

      <FreshWoundFlash position={position} active={totalCount > 0} />
    </group>
  );
};

/** Kurzer roter Lichtblitz zum Wundzeitpunkt (~120ms) — verstärkt den Treffer */
const FreshWoundFlash: React.FC<{
  position: [number, number, number];
  active: boolean;
}> = ({ position, active }) => {
  const lightRef = useRef<THREE.PointLight>(null);
  const ageRef = useRef(0);

  useFrame((_, delta) => {
    if (!lightRef.current || !active) return;
    ageRef.current += delta;
    const t = ageRef.current;
    if (t < 0.12) {
      lightRef.current.intensity = 8 * (1 - t / 0.12);
    } else {
      lightRef.current.intensity = 0;
      lightRef.current.visible = false;
    }
  });

  if (!active) return null;
  return (
    <pointLight
      ref={lightRef}
      position={position}
      color="#ff2222"
      intensity={8}
      distance={3.5}
      decay={2}
    />
  );
};

export default BloodParticles;
