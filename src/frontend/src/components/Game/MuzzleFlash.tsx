import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

interface MuzzleFlashProps {
  /** Wenn sich diese Zahl ändert, wird ein neuer Flash getriggert */
  fireTimestamp: number;
  /** Position relativ zum Eltern-Group (sollte am Lauf-Ende sein) */
  position: [number, number, number];
  /** Skalierungsfaktor — Pistol ~1, Shotgun ~1.6, AR ~1.1, Sniper ~1.3 */
  scale?: number;
  /** Falls die Waffe einen kurzen Lauf hat (z.B. Pistole), Flash kompakter */
  compact?: boolean;
}

const FLASH_DURATION = 0.075; // Sekunden — sehr kurz für Realismus

interface Spark {
  vx: number;
  vy: number;
  vz: number;
  life: number;
}

/**
 * Realistisches Mündungsfeuer mit mehreren Layern:
 *  - Heller Plasma-Kern (additiv, 8-strahlig)
 *  - Sekundärer Glow (kurz davor, am Lauf-Ende)
 *  - 6-8 fliegende Funken (kleine Streifen die nach vorne+seitlich schießen)
 *  - Rauchpuff der nach dem Flash sichtbar bleibt
 *  - PointLight für Umgebungs-Beleuchtung
 *
 * Trigger über `fireTimestamp` — wenn sich die Zahl ändert, neuer Flash.
 * Das ist robuster als ein boolean weil mehrere schnelle Schüsse korrekt
 * behandelt werden.
 */
export function MuzzleFlash({
  fireTimestamp,
  position,
  scale = 1.0,
  compact = false,
}: MuzzleFlashProps) {
  const groupRef = useRef<THREE.Group>(null);
  const coreRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const starRef = useRef<THREE.Mesh>(null);
  const smokeRef = useRef<THREE.Mesh>(null);
  const lightRef = useRef<THREE.PointLight>(null);
  const sparkMeshRef = useRef<THREE.InstancedMesh>(null);

  const startRef = useRef(0);
  const elapsedRef = useRef(999); // sehr groß = inaktiv

  // Funken — pro Schuss neu zufällig, persistent zwischen Frames bis Flash vorbei
  const SPARK_COUNT = 8;
  const sparksRef = useRef<Spark[]>(
    Array.from({ length: SPARK_COUNT }, () => ({
      vx: 0,
      vy: 0,
      vz: 0,
      life: 0,
    })),
  );

  // 8-strahlige Star-Geometrie (kreuzförmiger Plus-Stern)
  const starGeometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const r = 1.0;
    const verts: number[] = [];
    // 4 Strahlen (Plus) als 8 Dreiecke
    const arms = 4;
    for (let i = 0; i < arms; i++) {
      const a = (i / arms) * Math.PI * 2;
      const a2 = ((i + 0.5) / arms) * Math.PI * 2;
      const a3 = ((i + 1) / arms) * Math.PI * 2;
      // Outer arm tip
      const tx = Math.cos(a) * r;
      const ty = Math.sin(a) * r;
      // Inner valley
      const vx = Math.cos(a2) * r * 0.28;
      const vy = Math.sin(a2) * r * 0.28;
      // Next outer
      const t2x = Math.cos(a3) * r;
      const t2y = Math.sin(a3) * r;
      // Center
      verts.push(0, 0, 0, tx, ty, 0, vx, vy, 0);
      verts.push(0, 0, 0, vx, vy, 0, t2x, t2y, 0);
    }
    g.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
    g.computeVertexNormals();
    return g;
  }, []);

  // Spark-Geometrie wird einmal erstellt
  const sparkDummy = useMemo(() => new THREE.Object3D(), []);
  const sparkZero = useMemo(() => new THREE.Matrix4().makeScale(0, 0, 0), []);

  // Trigger-Erkennung: nur wenn fireTimestamp sich ECHT ÄNDERT (nicht beim Mount).
  // Das schützt davor, dass beim Waffenwechsel der initiale lastFireTime-Wert
  // einen falschen Flash auslöst.
  const prevFireTimestampRef = useRef<number | null>(null);
  useEffect(() => {
    // Erster Render: nur Wert merken, keinen Flash auslösen
    if (prevFireTimestampRef.current === null) {
      prevFireTimestampRef.current = fireTimestamp;
      return;
    }
    // Kein Wechsel = kein Flash
    if (fireTimestamp === prevFireTimestampRef.current) return;
    prevFireTimestampRef.current = fireTimestamp;

    // 0 oder negativ = explizit kein Flash (Reset-Signal)
    if (fireTimestamp <= 0) return;

    startRef.current = performance.now() / 1000;
    elapsedRef.current = 0;

    // Funken neu zufällig
    for (const s of sparksRef.current) {
      // Hauptrichtung +Z (vom Lauf weg), mit Streuung
      const spreadX = (Math.random() - 0.5) * 4;
      const spreadY = (Math.random() - 0.5) * 3;
      const speedZ = -8 - Math.random() * 6; // negativ Z = vom Lauf weg
      s.vx = spreadX;
      s.vy = spreadY;
      s.vz = speedZ;
      s.life = 0;
    }
  }, [fireTimestamp]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    elapsedRef.current += delta;
    const t = elapsedRef.current;

    if (t >= FLASH_DURATION + 0.4) {
      // komplett aus
      if (coreRef.current) coreRef.current.visible = false;
      if (glowRef.current) glowRef.current.visible = false;
      if (starRef.current) starRef.current.visible = false;
      if (smokeRef.current) smokeRef.current.visible = false;
      if (lightRef.current) {
        lightRef.current.intensity = 0;
        lightRef.current.visible = false;
      }
      if (sparkMeshRef.current) {
        for (let i = 0; i < SPARK_COUNT; i++) {
          sparkMeshRef.current.setMatrixAt(i, sparkZero);
        }
        sparkMeshRef.current.instanceMatrix.needsUpdate = true;
      }
      return;
    }

    // Phase 1: Plasma-Flash (0–FLASH_DURATION)
    if (t < FLASH_DURATION) {
      const ft = t / FLASH_DURATION;
      // Schneller Anstieg dann Abfall (peak bei 30%)
      const intensity =
        ft < 0.3 ? ft / 0.3 : Math.max(0, 1 - (ft - 0.3) / 0.7);

      // Heller Kern
      if (coreRef.current) {
        coreRef.current.visible = true;
        // Flackern hochfrequent für realistisches Plasma-Gefühl
        const flicker = 0.85 + Math.random() * 0.3;
        const s = (compact ? 0.08 : 0.13) * scale * intensity * flicker;
        coreRef.current.scale.setScalar(s);
        const mat = coreRef.current.material as THREE.MeshBasicMaterial;
        mat.opacity = intensity;
      }
      // Sekundärer Glow (größer, transparenter)
      if (glowRef.current) {
        glowRef.current.visible = true;
        const s = (compact ? 0.18 : 0.28) * scale * intensity;
        glowRef.current.scale.setScalar(s);
        const mat = glowRef.current.material as THREE.MeshBasicMaterial;
        mat.opacity = intensity * 0.55;
      }
      // 8-strahliger Stern (rotiert leicht)
      if (starRef.current) {
        starRef.current.visible = true;
        const s = (compact ? 0.22 : 0.34) * scale * intensity;
        starRef.current.scale.setScalar(s);
        starRef.current.rotation.z = Math.random() * Math.PI;
        const mat = starRef.current.material as THREE.MeshBasicMaterial;
        mat.opacity = intensity * 0.85;
      }
      // PointLight für Umgebungs-Beleuchtung
      if (lightRef.current) {
        lightRef.current.visible = true;
        lightRef.current.intensity = intensity * 8;
      }
    } else {
      // Phase 1 vorbei → Plasma aus
      if (coreRef.current) coreRef.current.visible = false;
      if (glowRef.current) glowRef.current.visible = false;
      if (starRef.current) starRef.current.visible = false;
      if (lightRef.current) {
        lightRef.current.intensity = 0;
        lightRef.current.visible = false;
      }
    }

    // Phase 2: Rauch (von 0 bis ~0.4s)
    if (t < 0.4 && smokeRef.current) {
      smokeRef.current.visible = true;
      const st = t / 0.4;
      const s = (compact ? 0.12 : 0.18) * scale * (0.5 + st * 1.4);
      smokeRef.current.scale.setScalar(s);
      // Rauch driftet leicht nach vorne
      smokeRef.current.position.set(
        position[0],
        position[1] + st * 0.04,
        position[2] - st * 0.08,
      );
      const mat = smokeRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = Math.max(0, 0.45 * (1 - st));
    }

    // Funken
    if (sparkMeshRef.current) {
      for (let i = 0; i < SPARK_COUNT; i++) {
        const s = sparksRef.current[i];
        s.life += delta;
        if (s.life > 0.25) {
          sparkMeshRef.current.setMatrixAt(i, sparkZero);
          continue;
        }
        // Schwerkraft auf Funken
        s.vy -= 6 * delta;
        const px = position[0] + s.vx * s.life;
        const py = position[1] + s.vy * s.life;
        const pz = position[2] + s.vz * s.life;
        const fade = 1 - s.life / 0.25;
        const sz = scale * 0.025 * fade;
        // Funken in Bewegungsrichtung strecken
        const speed = Math.sqrt(s.vx * s.vx + s.vy * s.vy + s.vz * s.vz);
        const stretch = Math.min(4, 1 + speed * 0.1);
        sparkDummy.position.set(px, py, pz);
        // Z-Achse als Hauptachse (Capsule streckt entlang Y, also rotieren)
        const dir = new THREE.Vector3(s.vx, s.vy, s.vz).normalize();
        const quat = new THREE.Quaternion().setFromUnitVectors(
          new THREE.Vector3(0, 1, 0),
          dir,
        );
        sparkDummy.quaternion.copy(quat);
        sparkDummy.scale.set(sz, sz * stretch, sz);
        sparkDummy.updateMatrix();
        sparkMeshRef.current.setMatrixAt(i, sparkDummy.matrix);
      }
      sparkMeshRef.current.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <group ref={groupRef}>
      {/* Heller Plasma-Kern (additiv) */}
      <mesh ref={coreRef} position={position} visible={false}>
        <sphereGeometry args={[1, 8, 6]} />
        <meshBasicMaterial
          color="#ffffff"
          transparent
          opacity={1}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* Sekundärer Glow um den Kern (warm gelb-orange) */}
      <mesh ref={glowRef} position={position} visible={false}>
        <sphereGeometry args={[1, 8, 6]} />
        <meshBasicMaterial
          color="#ffaa44"
          transparent
          opacity={0.5}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* 8-strahliger Stern (frontal in Lauf-Richtung) */}
      <mesh
        ref={starRef}
        position={position}
        rotation={[0, 0, 0]}
        visible={false}
        geometry={starGeometry}
      >
        <meshBasicMaterial
          color="#ffd470"
          transparent
          opacity={0.85}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Rauchpuff (bleibt nach dem Flash) */}
      <mesh ref={smokeRef} position={position} visible={false}>
        <sphereGeometry args={[1, 6, 5]} />
        <meshBasicMaterial
          color="#aaa39a"
          transparent
          opacity={0.4}
          depthWrite={false}
        />
      </mesh>

      {/* PointLight für Umgebungs-Beleuchtung (sehr kurz, sehr hell) */}
      <pointLight
        ref={lightRef}
        position={position}
        color="#ffcc66"
        intensity={0}
        distance={4}
        decay={2}
        visible={false}
      />

      {/* Funken (instanced) */}
      <instancedMesh
        ref={sparkMeshRef}
        args={[undefined, undefined, SPARK_COUNT]}
        frustumCulled={false}
      >
        <capsuleGeometry args={[0.5, 1.5, 3, 5]} />
        <meshBasicMaterial
          color="#ffdd66"
          transparent
          opacity={0.9}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </instancedMesh>
    </group>
  );
}
