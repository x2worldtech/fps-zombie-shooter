import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import {
  playNuclearImpact,
  playNuclearSiren,
  playRocketApproach,
} from "../../utils/audioSynthesis";
import { WARZONE_BUILDING_DEFS } from "./WarzoneEnvironment";

const IMPACT_POINT = new THREE.Vector3(-80, 0, -80);
const ROCKET_START = new THREE.Vector3(200, 800, -300);
const ROCKET_TRAVEL_S = 9;

interface DebrisChunk {
  id: number;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  rotation: THREE.Euler;
  angularV: THREE.Vector3;
  scale: number;
  born: number;
  lifespan: number;
  variant: 0 | 1 | 2;
}

interface FalloutParticle {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  scale: number;
  born: number;
  lifespan: number;
}

interface NuclearEventProps {
  active: boolean;
  onComplete: () => void;
  playerPosRef: React.MutableRefObject<[number, number, number]>;
  destroyedBuildingIds: React.MutableRefObject<Set<number>>;
  flashRef: React.RefObject<HTMLDivElement | null>;
  onCountdownUpdate: (count: number | null, showHUD: boolean) => void;
}

// ── Einzelnes Trümmerstück mit Rauchspur ──────────────────────────────────────
function DebrisMesh({
  chunk,
  elapsed,
}: {
  chunk: DebrisChunk;
  elapsed: number;
}) {
  const age = elapsed - chunk.born;
  if (age < 0 || age > chunk.lifespan) return null;
  const t = age / chunk.lifespan;
  const gravity = 0.5 * 18 * age * age;
  const pos = new THREE.Vector3(
    chunk.position.x + chunk.velocity.x * age,
    chunk.position.y + chunk.velocity.y * age - gravity,
    chunk.position.z + chunk.velocity.z * age,
  );
  const rx = chunk.rotation.x + chunk.angularV.x * age;
  const ry = chunk.rotation.y + chunk.angularV.y * age;
  const rz = chunk.rotation.z + chunk.angularV.z * age;
  const opacity = Math.max(0, 1 - t);

  const color =
    chunk.variant === 0
      ? "#3a3228"
      : chunk.variant === 1
        ? "#1a1208"
        : "#4a4238";
  const emissive = chunk.variant === 1 ? "#ff3300" : "#000000";
  const emissiveIntensity = chunk.variant === 1 ? Math.max(0, 1.5 - t * 2) : 0;

  return (
    <group>
      <mesh
        position={[pos.x, pos.y, pos.z]}
        rotation={[rx, ry, rz]}
        scale={chunk.scale}
      >
        <boxGeometry args={[1, 0.6, 0.8]} />
        <meshStandardMaterial
          color={color}
          roughness={0.95}
          emissive={emissive}
          emissiveIntensity={emissiveIntensity}
          transparent
          opacity={opacity}
          depthWrite={false}
        />
      </mesh>
      <mesh
        position={[
          pos.x - chunk.velocity.x * 0.15 * age,
          pos.y - chunk.velocity.y * 0.15 * age + gravity * 0.7,
          pos.z - chunk.velocity.z * 0.15 * age,
        ]}
        scale={chunk.scale * (0.6 + t * 1.5)}
      >
        <sphereGeometry args={[0.4, 5, 4]} />
        <meshBasicMaterial
          color="#3a3028"
          transparent
          opacity={Math.max(0, 0.4 - t * 0.4)}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

// ── Hauptkomponente Nuklear-Event ─────────────────────────────────────────────
export function NuclearEvent({
  active,
  onComplete,
  destroyedBuildingIds,
  flashRef,
  onCountdownUpdate,
}: NuclearEventProps) {
  const { camera } = useThree();
  const startTimeRef = useRef<number | null>(null);
  const sirenStopRef = useRef<(() => void) | null>(null);
  const rocketStopRef = useRef<(() => void) | null>(null);
  const shakeRef = useRef({ active: false, intensity: 0, end: 0 });
  const completedRef = useRef(false);
  const debrisRef = useRef<DebrisChunk[]>([]);
  const debrisIdRef = useRef(0);

  // 3D refs
  const rocketGroupRef = useRef<THREE.Group>(null);
  const exhaustGroupRef = useRef<THREE.Group>(null);
  const trailGroupRef = useRef<THREE.Group>(null);

  const fireballCoreRef = useRef<THREE.Mesh>(null);
  const fireballMidRef = useRef<THREE.Mesh>(null);
  const fireballOuterRef = useRef<THREE.Mesh>(null);

  const stemInnerRef = useRef<THREE.Mesh>(null);
  const stemOuterRef = useRef<THREE.Mesh>(null);

  const capInnerRef = useRef<THREE.Group>(null);
  const capMidRef = useRef<THREE.Group>(null);
  const capOuterRef = useRef<THREE.Group>(null);
  const capTopRef = useRef<THREE.Group>(null);

  const condensationRingRef = useRef<THREE.Mesh>(null);
  const dustSkirtRef = useRef<THREE.Mesh>(null);
  const dustSkirtInnerRef = useRef<THREE.Mesh>(null);

  const shockwaveRef = useRef<THREE.Mesh>(null);
  const shockwave2Ref = useRef<THREE.Mesh>(null);
  const groundFlashRef = useRef<THREE.Mesh>(null);

  const nuclearLightRef = useRef<THREE.PointLight>(null);
  const flashLightRef = useRef<THREE.PointLight>(null);

  const lensFlareRef = useRef<THREE.Sprite>(null);

  // Prozedurale Lens-Flare-Textur
  const lensFlareTexture = useMemo(() => {
    const size = 256;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      const grad = ctx.createRadialGradient(
        size / 2,
        size / 2,
        0,
        size / 2,
        size / 2,
        size / 2,
      );
      grad.addColorStop(0, "rgba(255,255,255,1)");
      grad.addColorStop(0.15, "rgba(255,240,180,0.95)");
      grad.addColorStop(0.4, "rgba(255,140,40,0.55)");
      grad.addColorStop(0.7, "rgba(180,40,0,0.18)");
      grad.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, size, size);
      ctx.globalCompositeOperation = "lighter";
      ctx.strokeStyle = "rgba(255,220,140,0.4)";
      ctx.lineWidth = 2;
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(size / 2, size / 2);
        ctx.lineTo(
          size / 2 + Math.cos(a) * size * 0.48,
          size / 2 + Math.sin(a) * size * 0.48,
        );
        ctx.stroke();
      }
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
  }, []);

  // Fallout-Partikel
  const FALLOUT_COUNT = 80;
  const falloutMeshRef = useRef<THREE.InstancedMesh>(null);
  const falloutParticles = useRef<FalloutParticle[]>([]);
  const falloutDummy = useMemo(() => new THREE.Object3D(), []);
  const falloutZero = useMemo(() => new THREE.Matrix4().makeScale(0, 0, 0), []);

  const showCountdownHUDRef = useRef(false);
  const [elapsed, setElapsed] = useState(0);
  const [debrisSnapshot, setDebrisSnapshot] = useState<DebrisChunk[]>([]);
  const onCountdownUpdateRef = useRef(onCountdownUpdate);
  useEffect(() => {
    onCountdownUpdateRef.current = onCountdownUpdate;
  });

  const flashActiveRef = useRef(false);
  const impactFiredRef = useRef(false);
  const destroyedSet = useRef(new Set<number>());

  // ── Reset bei deaktivieren ───────────────────────────────────────────────────
  useEffect(() => {
    if (!active) {
      startTimeRef.current = null;
      completedRef.current = false;
      impactFiredRef.current = false;
      flashActiveRef.current = false;
      showCountdownHUDRef.current = false;
      destroyedSet.current.clear();
      debrisRef.current = [];
      falloutParticles.current = [];
      sirenStopRef.current?.();
      sirenStopRef.current = null;
      rocketStopRef.current?.();
      rocketStopRef.current = null;
      onCountdownUpdate(null, false);
      setDebrisSnapshot([]);
      const flashEl = flashRef.current;
      if (flashEl) {
        flashEl.style.transition = "none";
        flashEl.style.opacity = "0";
        flashEl.style.display = "none";
        flashEl.style.visibility = "hidden";
      }
      flashActiveRef.current = false;
      return;
    }

    startTimeRef.current = performance.now() / 1000;
    completedRef.current = false;
    impactFiredRef.current = false;
    flashActiveRef.current = false;
    showCountdownHUDRef.current = true;
    destroyedSet.current.clear();
    debrisRef.current = [];
    falloutParticles.current = [];
    onCountdownUpdate(10, true);

    try {
      const stop = playNuclearSiren();
      sirenStopRef.current = stop;
    } catch (_) {}
  }, [active, flashRef, onCountdownUpdate]);

  const triggerWhiteFlash = () => {
    if (flashActiveRef.current) return;
    flashActiveRef.current = true;
    const el = flashRef.current;
    if (!el) return;

    el.style.display = "block";
    el.style.visibility = "visible";
    el.style.transition = "none";
    el.style.opacity = "1";
    void el.offsetHeight;

    setTimeout(() => {
      if (!el) return;
      el.style.transition = "opacity 1.5s ease-out";
      el.style.opacity = "0";
    }, 200);

    setTimeout(() => {
      if (!el) return;
      el.style.display = "none";
      el.style.visibility = "hidden";
      el.style.opacity = "0";
      el.style.transition = "none";
      flashActiveRef.current = false;
    }, 1900);
  };

  const spawnFalloutBurst = (originY: number) => {
    for (let i = 0; i < FALLOUT_COUNT / 2; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = 20 + Math.random() * 80;
      falloutParticles.current.push({
        pos: new THREE.Vector3(
          IMPACT_POINT.x + Math.cos(angle) * r,
          originY + Math.random() * 30,
          IMPACT_POINT.z + Math.sin(angle) * r,
        ),
        vel: new THREE.Vector3(
          (Math.random() - 0.5) * 1.5,
          -1.5 - Math.random() * 2.0,
          (Math.random() - 0.5) * 1.5,
        ),
        scale: 0.4 + Math.random() * 1.2,
        born: performance.now() / 1000,
        lifespan: 8 + Math.random() * 4,
      });
    }
    // Limit
    if (falloutParticles.current.length > FALLOUT_COUNT) {
      falloutParticles.current = falloutParticles.current.slice(-FALLOUT_COUNT);
    }
  };

  useFrame((_, delta) => {
    if (!active || startTimeRef.current === null) return;

    const now = performance.now() / 1000;
    const t = now - startTimeRef.current;

    setElapsed(t);

    // ── PHASE 1: Countdown ─────────────────────────────────────────────────────
    if (t < 10) {
      const remaining = Math.ceil(10 - t);
      onCountdownUpdateRef.current(remaining, true);
    }
    if (t >= 10 && showCountdownHUDRef.current) {
      showCountdownHUDRef.current = false;
      onCountdownUpdateRef.current(null, false);
    }

    // ── PHASE 2: Raketen-Anflug ───────────────────────────────────────────────
    if (t >= 1 && t < 10) {
      const rocketT = Math.min(1, (t - 1) / ROCKET_TRAVEL_S);
      const rPos = ROCKET_START.clone().lerp(IMPACT_POINT, rocketT);

      if (rocketGroupRef.current) {
        rocketGroupRef.current.visible = true;
        rocketGroupRef.current.position.copy(rPos);
        const dir = IMPACT_POINT.clone().sub(rPos).normalize();
        const up = new THREE.Vector3(0, 1, 0);
        const quat = new THREE.Quaternion().setFromUnitVectors(up, dir);
        rocketGroupRef.current.quaternion.copy(quat);
      }

      if (t >= 1 && t < 1.1 && !rocketStopRef.current) {
        try {
          const stop = playRocketApproach(9000);
          rocketStopRef.current = stop;
        } catch (_) {}
      }
    } else if (t >= 10 && rocketGroupRef.current) {
      rocketGroupRef.current.visible = false;
    } else if (t < 1 && rocketGroupRef.current) {
      rocketGroupRef.current.visible = false;
    }

    // ── PHASE 3: Impact ───────────────────────────────────────────────────────
    if (t >= 10 && !impactFiredRef.current) {
      impactFiredRef.current = true;

      sirenStopRef.current?.();
      sirenStopRef.current = null;
      rocketStopRef.current?.();
      rocketStopRef.current = null;

      shakeRef.current = { active: true, intensity: 6.5, end: now + 4.5 };

      triggerWhiteFlash();

      if (groundFlashRef.current) {
        groundFlashRef.current.visible = true;
      }
      if (flashLightRef.current) {
        flashLightRef.current.intensity = 1500;
        flashLightRef.current.visible = true;
      }

      try {
        playNuclearImpact();
      } catch (_) {}

      setTimeout(() => spawnFalloutBurst(60), 2500);
      setTimeout(() => spawnFalloutBurst(80), 5000);
    }

    // ── Camera Shake (Mehrfrequenz) ───────────────────────────────────────────
    if (shakeRef.current.active) {
      if (now < shakeRef.current.end) {
        const shakeStart = shakeRef.current.end - 4.5;
        const decay = 1 - (now - shakeStart) / 4.5;
        const i = shakeRef.current.intensity * Math.max(0, decay);
        const lowT = now * 6;
        const lowShakeX = Math.sin(lowT) * Math.cos(lowT * 1.3) * 0.5;
        const lowShakeY = Math.sin(lowT * 1.7) * 0.3;
        const lowShakeZ = Math.cos(lowT * 0.9) * 0.4;
        camera.position.x +=
          (lowShakeX + (Math.random() - 0.5) * 0.6) * i * 0.2;
        camera.position.y +=
          (lowShakeY + (Math.random() - 0.5) * 0.4) * i * 0.12;
        camera.position.z +=
          (lowShakeZ + (Math.random() - 0.5) * 0.6) * i * 0.2;
      } else {
        shakeRef.current.active = false;
      }
    }

    // Initial-Flash-Light schnell ausblenden
    const fl = flashLightRef.current;
    if (fl && fl.intensity > 0) {
      fl.intensity *= 0.85;
      if (fl.intensity < 1) {
        fl.intensity = 0;
        fl.visible = false;
      }
    }

    // Ground-Flash ausblenden
    if (groundFlashRef.current?.visible) {
      const gfMat = groundFlashRef.current.material as THREE.MeshBasicMaterial;
      gfMat.opacity = Math.max(0, gfMat.opacity - 0.04);
      const sc = (groundFlashRef.current.scale.x || 1) + 1.2;
      groundFlashRef.current.scale.set(sc, 1, sc);
      if (gfMat.opacity <= 0) {
        groundFlashRef.current.visible = false;
        gfMat.opacity = 0.95;
        groundFlashRef.current.scale.set(1, 1, 1);
      }
    }

    // Lens-Flare (sichtbar 0.5s nach Impact, fadet über 4s)
    if (lensFlareRef.current) {
      if (t >= 10 && t < 14.5) {
        lensFlareRef.current.visible = true;
        const lt = (t - 10) / 4.5;
        const sc = 60 + Math.sin(lt * 8) * 4;
        lensFlareRef.current.scale.set(sc, sc, 1);
        const mat = lensFlareRef.current.material as THREE.SpriteMaterial;
        mat.opacity = Math.max(0, 1 - lt) * 0.95;
      } else {
        lensFlareRef.current.visible = false;
      }
    }

    // ── PHASE 4: Pilzwolke ─────────────────────────────────────────────────────
    if (t >= 10.2) {
      const ct = t - 10.2;

      const fbBase = Math.min(28, ct * 28);
      const pulse = 1 + Math.sin(ct * 12) * 0.06;

      if (fireballCoreRef.current) {
        fireballCoreRef.current.scale.setScalar(fbBase * 0.55 * pulse);
        fireballCoreRef.current.visible = true;
        const m = fireballCoreRef.current
          .material as THREE.MeshStandardMaterial;
        const fadeT = Math.min(1, ct / 4);
        m.emissiveIntensity = Math.max(0.3, 12 - ct * 1.8);
        m.color.setRGB(
          1.0,
          Math.max(0.7, 1.0 - fadeT * 0.3),
          Math.max(0.4, 0.9 - fadeT * 0.5),
        );
        m.emissive.setRGB(
          1.0,
          Math.max(0.5, 1.0 - fadeT * 0.5),
          Math.max(0.1, 0.6 - fadeT * 0.5),
        );
      }
      if (fireballMidRef.current) {
        fireballMidRef.current.scale.setScalar(fbBase * 0.85);
        fireballMidRef.current.visible = true;
        const m = fireballMidRef.current.material as THREE.MeshStandardMaterial;
        const fadeT = Math.min(1, ct / 4);
        m.emissiveIntensity = Math.max(0.2, 8 - ct * 1.5);
        m.color.setRGB(
          1.0,
          Math.max(0.4, 0.9 - fadeT * 0.5),
          Math.max(0.1, 0.4 - fadeT * 0.4),
        );
        m.emissive.setRGB(1.0, Math.max(0.2, 0.7 - fadeT * 0.5), 0);
        m.opacity = Math.max(0.2, 0.85 - fadeT * 0.5);
      }
      if (fireballOuterRef.current) {
        fireballOuterRef.current.scale.setScalar(fbBase * 1.15);
        fireballOuterRef.current.visible = true;
        const m = fireballOuterRef.current
          .material as THREE.MeshStandardMaterial;
        const fadeT = Math.min(1, ct / 4);
        m.opacity = Math.max(0, 0.55 - fadeT * 0.45);
        m.color.setRGB(0.9, Math.max(0.3, 0.6 - fadeT * 0.4), 0.1);
      }

      if (stemInnerRef.current && stemOuterRef.current) {
        stemInnerRef.current.visible = true;
        stemOuterRef.current.visible = true;
        const stemH = Math.min(85, ct * 18);

        stemInnerRef.current.scale.set(1, stemH / 10, 1);
        stemInnerRef.current.position.set(
          IMPACT_POINT.x,
          stemH / 2,
          IMPACT_POINT.z,
        );
        const m1 = stemInnerRef.current.material as THREE.MeshStandardMaterial;
        const smokeT = Math.min(1, ct / 6);
        m1.color.setRGB(1.0 - smokeT * 0.7, 0.4 - smokeT * 0.35, 0);
        m1.emissive.setRGB(0.9 - smokeT * 0.8, 0.25 - smokeT * 0.2, 0);
        m1.emissiveIntensity = Math.max(0, 2.5 - smokeT * 2.0);
        m1.opacity = Math.min(0.9, ct * 1.5);

        stemOuterRef.current.scale.set(1.6, stemH / 10, 1.6);
        stemOuterRef.current.position.set(
          IMPACT_POINT.x,
          stemH / 2 + 4,
          IMPACT_POINT.z,
        );
        const m2 = stemOuterRef.current.material as THREE.MeshStandardMaterial;
        m2.color.setRGB(
          0.4 - smokeT * 0.2,
          0.3 - smokeT * 0.18,
          0.22 - smokeT * 0.15,
        );
        m2.opacity = Math.min(0.7, ct * 1.0);
      }

      const capStartT = 1.8;
      if (ct > capStartT) {
        const capT = Math.min(1, (ct - capStartT) / 5);
        const capY = 80 + capT * 22;

        if (capInnerRef.current) {
          capInnerRef.current.visible = true;
          capInnerRef.current.position.set(
            IMPACT_POINT.x,
            capY,
            IMPACT_POINT.z,
          );
          const r = 8 + capT * 30;
          capInnerRef.current.scale.setScalar(r / 30);
          capInnerRef.current.rotation.y = ct * 0.04;
        }
        if (capMidRef.current) {
          capMidRef.current.visible = true;
          capMidRef.current.position.set(
            IMPACT_POINT.x,
            capY + 2,
            IMPACT_POINT.z,
          );
          const r = 18 + capT * 50;
          capMidRef.current.scale.setScalar(r / 30);
          capMidRef.current.rotation.y = -ct * 0.03;
        }
        if (capOuterRef.current) {
          capOuterRef.current.visible = true;
          capOuterRef.current.position.set(
            IMPACT_POINT.x,
            capY + 4,
            IMPACT_POINT.z,
          );
          const r = 28 + capT * 65;
          capOuterRef.current.scale.setScalar(r / 30);
          capOuterRef.current.rotation.y = ct * 0.02;
        }
        if (capTopRef.current) {
          capTopRef.current.visible = true;
          capTopRef.current.position.set(
            IMPACT_POINT.x,
            capY + 18 + capT * 8,
            IMPACT_POINT.z,
          );
          const r = 12 + capT * 24;
          capTopRef.current.scale.setScalar(r / 30);
          capTopRef.current.rotation.y = -ct * 0.06;
        }
      }

      if (condensationRingRef.current && ct > 1.8) {
        condensationRingRef.current.visible = true;
        const ringT = Math.min(1, (ct - 1.8) / 1.8);
        const innerR = 25 + ringT * 75;
        const outerR = innerR + 10;
        condensationRingRef.current.scale.set(outerR / 50, 1, outerR / 50);
        condensationRingRef.current.position.set(
          IMPACT_POINT.x,
          62,
          IMPACT_POINT.z,
        );
        const ringMat = condensationRingRef.current
          .material as THREE.MeshStandardMaterial;
        ringMat.opacity = Math.max(0, 0.85 - ringT * 0.7);
      }

      if (dustSkirtRef.current) {
        dustSkirtRef.current.visible = true;
        const dustT = Math.min(1, ct / 4);
        const dustR = dustT * 140;
        dustSkirtRef.current.scale.set(dustR / 60, 1, dustR / 60);
        dustSkirtRef.current.position.set(IMPACT_POINT.x, 0.5, IMPACT_POINT.z);
        const dustMat = dustSkirtRef.current
          .material as THREE.MeshStandardMaterial;
        dustMat.opacity = Math.max(0, 0.75 - dustT * 0.25);
      }
      if (dustSkirtInnerRef.current) {
        dustSkirtInnerRef.current.visible = true;
        const dustT = Math.min(1, ct / 3.5);
        const dustR = dustT * 90;
        dustSkirtInnerRef.current.scale.set(dustR / 60, 1, dustR / 60);
        dustSkirtInnerRef.current.position.set(
          IMPACT_POINT.x,
          1.5,
          IMPACT_POINT.z,
        );
        const dustMat = dustSkirtInnerRef.current
          .material as THREE.MeshStandardMaterial;
        dustMat.opacity = Math.max(0, 0.85 - dustT * 0.3);
      }

      if (nuclearLightRef.current) {
        const lDecay = Math.max(0, 1 - ct / 14);
        nuclearLightRef.current.intensity = 320 * lDecay;
        nuclearLightRef.current.visible = true;
        const cT = Math.min(1, ct / 8);
        nuclearLightRef.current.color.setRGB(
          1.0,
          Math.max(0.3, 0.9 - cT * 0.5),
          Math.max(0.1, 0.5 - cT * 0.4),
        );
      }
    }

    // ── PHASE 5: Schockwelle & Buildings ──────────────────────────────────────
    if (t >= 10.5) {
      const swT = t - 10.5;
      const swRadius = Math.min(300, swT * 75);

      if (shockwaveRef.current) {
        shockwaveRef.current.visible = true;
        shockwaveRef.current.scale.set(swRadius / 5, 1, swRadius / 5);
        shockwaveRef.current.position.set(IMPACT_POINT.x, 0.3, IMPACT_POINT.z);
        const swMat = shockwaveRef.current
          .material as THREE.MeshStandardMaterial;
        swMat.opacity = Math.max(0, 0.65 - swT * 0.12);
      }
      if (shockwave2Ref.current && swT > 0.4) {
        shockwave2Ref.current.visible = true;
        const sw2Radius = Math.min(280, (swT - 0.4) * 65);
        shockwave2Ref.current.scale.set(sw2Radius / 5, 1, sw2Radius / 5);
        shockwave2Ref.current.position.set(IMPACT_POINT.x, 0.5, IMPACT_POINT.z);
        const swMat = shockwave2Ref.current
          .material as THREE.MeshStandardMaterial;
        swMat.opacity = Math.max(0, 0.45 - (swT - 0.4) * 0.08);
      }

      WARZONE_BUILDING_DEFS.forEach((def, idx) => {
        if (destroyedSet.current.has(idx)) return;
        const dx = def.x - IMPACT_POINT.x;
        const dz = def.z - IMPACT_POINT.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist <= swRadius) {
          destroyedSet.current.add(idx);
          destroyedBuildingIds.current.add(idx);

          const numChunks = 16 + Math.floor(Math.random() * 10);
          for (let c = 0; c < numChunks; c++) {
            const angle = Math.random() * Math.PI * 2;
            const outward = 4 + Math.random() * 10;
            const upward = 6 + Math.random() * 14;
            const r = Math.random();
            const variant: 0 | 1 | 2 = r < 0.5 ? 0 : r < 0.8 ? 1 : 2;
            debrisRef.current.push({
              id: debrisIdRef.current++,
              position: new THREE.Vector3(def.x, def.groundY, def.z),
              velocity: new THREE.Vector3(
                Math.cos(angle) * outward * 0.5,
                upward,
                Math.sin(angle) * outward * 0.5,
              ),
              rotation: new THREE.Euler(
                Math.random() * Math.PI,
                Math.random() * Math.PI,
                Math.random() * Math.PI,
              ),
              angularV: new THREE.Vector3(
                (Math.random() - 0.5) * 6,
                (Math.random() - 0.5) * 6,
                (Math.random() - 0.5) * 6,
              ),
              scale: 0.3 + Math.random() * 1.4,
              born: t,
              lifespan: 2 + Math.random() * 2.0,
              variant,
            });
          }
          setDebrisSnapshot([...debrisRef.current]);
        }
      });
    }

    // ── Fallout-Partikel rendern ───────────────────────────────────────────────
    if (falloutMeshRef.current) {
      let drawn = 0;
      for (const p of falloutParticles.current) {
        const age = now - p.born;
        if (age >= p.lifespan || drawn >= FALLOUT_COUNT) continue;
        p.pos.addScaledVector(p.vel, delta);
        if (p.pos.y < 0.05) p.pos.y = 0.05;

        const fade = 1 - age / p.lifespan;
        const sc = p.scale * (0.5 + fade * 0.5);
        falloutDummy.position.copy(p.pos);
        falloutDummy.scale.setScalar(sc);
        falloutDummy.rotation.set(age * 0.5, age * 0.7, 0);
        falloutDummy.updateMatrix();
        falloutMeshRef.current.setMatrixAt(drawn, falloutDummy.matrix);
        drawn++;
      }
      for (let i = drawn; i < FALLOUT_COUNT; i++) {
        falloutMeshRef.current.setMatrixAt(i, falloutZero);
      }
      falloutMeshRef.current.instanceMatrix.needsUpdate = true;
    }

    if (t >= 22 && !completedRef.current) {
      completedRef.current = true;
      onComplete();
    }
  });

  if (!active) return null;

  return (
    <>
      {/* ── Rakete ─────────────────────────────────────────────── */}
      <group ref={rocketGroupRef} visible={false}>
        <mesh position={[0, 0, 0]}>
          <cylinderGeometry args={[0.8, 1.2, 18, 12]} />
          <meshStandardMaterial
            color="#b0b8c0"
            roughness={0.3}
            metalness={0.8}
          />
        </mesh>
        <mesh position={[0, 10, 0]}>
          <coneGeometry args={[0.8, 5, 12]} />
          <meshStandardMaterial
            color="#9aa0a8"
            roughness={0.3}
            metalness={0.7}
          />
        </mesh>
        {[0, 1, 2, 3].map((i) => {
          const angle = (i / 4) * Math.PI * 2;
          return (
            <mesh
              key={i}
              position={[Math.cos(angle) * 1.1, -7, Math.sin(angle) * 1.1]}
              rotation={[0, angle, Math.PI / 6]}
            >
              <boxGeometry args={[0.15, 4, 2.2]} />
              <meshStandardMaterial
                color="#8a9098"
                roughness={0.4}
                metalness={0.7}
              />
            </mesh>
          );
        })}
        <mesh ref={exhaustGroupRef} position={[0, -9.5, 0]}>
          <coneGeometry args={[1.0, 4, 12]} />
          <meshStandardMaterial
            color="#ff8800"
            emissive="#ff4400"
            emissiveIntensity={4.0}
            transparent
            opacity={0.85}
          />
        </mesh>
        <pointLight
          position={[0, -10, 0]}
          intensity={80}
          distance={60}
          color="#ff6600"
        />
        <group ref={trailGroupRef}>
          {Array.from({ length: 12 }, (_, i) => -12 - i * 4).map((y) => (
            <mesh key={y} position={[0, y, 0]}>
              <sphereGeometry args={[0.6 + ((-y - 12) / 4) * 0.15, 6, 4]} />
              <meshStandardMaterial
                color="#ffffff"
                transparent
                opacity={Math.max(0, 0.4 - ((-y - 12) / 4) * 0.03)}
                depthWrite={false}
              />
            </mesh>
          ))}
        </group>
      </group>

      {/* ── Feuerball: 3 Schichten ── */}
      <mesh
        ref={fireballCoreRef}
        position={[IMPACT_POINT.x, 5, IMPACT_POINT.z]}
        visible={false}
      >
        <sphereGeometry args={[1, 24, 18]} />
        <meshStandardMaterial
          color="#fff4cc"
          emissive="#ffaa44"
          emissiveIntensity={12}
          transparent
          opacity={0.95}
          depthWrite={false}
        />
      </mesh>
      <mesh
        ref={fireballMidRef}
        position={[IMPACT_POINT.x, 5, IMPACT_POINT.z]}
        visible={false}
      >
        <sphereGeometry args={[1, 20, 16]} />
        <meshStandardMaterial
          color="#ff8800"
          emissive="#ff5500"
          emissiveIntensity={8}
          transparent
          opacity={0.85}
          depthWrite={false}
        />
      </mesh>
      <mesh
        ref={fireballOuterRef}
        position={[IMPACT_POINT.x, 5, IMPACT_POINT.z]}
        visible={false}
      >
        <sphereGeometry args={[1, 16, 12]} />
        <meshStandardMaterial
          color="#cc4400"
          transparent
          opacity={0.5}
          depthWrite={false}
        />
      </mesh>

      {/* ── Stamm: 2 Schichten ── */}
      <mesh
        ref={stemInnerRef}
        position={[IMPACT_POINT.x, 40, IMPACT_POINT.z]}
        visible={false}
      >
        <cylinderGeometry args={[3, 8, 10, 16, 1, true]} />
        <meshStandardMaterial
          color="#cc4400"
          emissive="#882200"
          emissiveIntensity={2}
          transparent
          opacity={0.88}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      <mesh
        ref={stemOuterRef}
        position={[IMPACT_POINT.x, 40, IMPACT_POINT.z]}
        visible={false}
      >
        <cylinderGeometry args={[5, 12, 10, 14, 1, true]} />
        <meshStandardMaterial
          color="#3a3028"
          transparent
          opacity={0.55}
          side={THREE.DoubleSide}
          depthWrite={false}
          roughness={1}
        />
      </mesh>

      {/* ── Pilzkappe: 4 Schichten ── */}
      <group ref={capInnerRef} visible={false}>
        {Array.from({ length: 8 }, (_, i) => ({
          angle: (i / 8) * Math.PI * 2,
        })).map(({ angle }) => {
          const r = 18;
          return (
            <mesh
              key={angle}
              position={[Math.cos(angle) * r, 0, Math.sin(angle) * r]}
            >
              <sphereGeometry args={[12, 10, 8]} />
              <meshStandardMaterial
                color="#aa4400"
                emissive="#ff5500"
                emissiveIntensity={1.4}
                roughness={1}
                transparent
                opacity={0.85}
                depthWrite={false}
              />
            </mesh>
          );
        })}
        <mesh position={[0, 0, 0]}>
          <sphereGeometry args={[20, 12, 10]} />
          <meshStandardMaterial
            color="#cc5500"
            emissive="#ff6600"
            emissiveIntensity={1.6}
            transparent
            opacity={0.75}
            depthWrite={false}
          />
        </mesh>
      </group>
      <group ref={capMidRef} visible={false}>
        {Array.from({ length: 12 }, (_, i) => ({
          angle: (i / 12) * Math.PI * 2,
          colorIdx: i % 3,
        })).map(({ angle, colorIdx }) => {
          const r = 28;
          const color =
            colorIdx === 0 ? "#7a4020" : colorIdx === 1 ? "#5a3018" : "#4a2818";
          return (
            <mesh
              key={angle}
              position={[Math.cos(angle) * r, 0, Math.sin(angle) * r]}
            >
              <sphereGeometry args={[15, 10, 8]} />
              <meshStandardMaterial
                color={color}
                roughness={1}
                transparent
                opacity={0.72}
                depthWrite={false}
              />
            </mesh>
          );
        })}
      </group>
      <group ref={capOuterRef} visible={false}>
        {Array.from({ length: 16 }, (_, i) => ({
          angle: (i / 16) * Math.PI * 2,
          colorIdx: i % 3,
        })).map(({ angle, colorIdx }) => {
          const r = 38;
          const color =
            colorIdx === 0 ? "#3a2818" : colorIdx === 1 ? "#2a2018" : "#252018";
          return (
            <mesh
              key={angle}
              position={[Math.cos(angle) * r, 0, Math.sin(angle) * r]}
            >
              <sphereGeometry args={[16, 10, 8]} />
              <meshStandardMaterial
                color={color}
                roughness={1}
                transparent
                opacity={0.6}
                depthWrite={false}
              />
            </mesh>
          );
        })}
      </group>
      <group ref={capTopRef} visible={false}>
        {Array.from({ length: 8 }, (_, i) => ({
          angle: (i / 8) * Math.PI * 2,
        })).map(({ angle }) => {
          const r = 14;
          return (
            <mesh
              key={angle}
              position={[Math.cos(angle) * r, 0, Math.sin(angle) * r]}
            >
              <sphereGeometry args={[10, 8, 6]} />
              <meshStandardMaterial
                color="#3a3028"
                roughness={1}
                transparent
                opacity={0.55}
                depthWrite={false}
              />
            </mesh>
          );
        })}
        <mesh position={[0, 4, 0]}>
          <sphereGeometry args={[14, 10, 8]} />
          <meshStandardMaterial
            color="#3a3028"
            roughness={1}
            transparent
            opacity={0.5}
            depthWrite={false}
          />
        </mesh>
      </group>

      {/* ── Kondensationsring (Mach-Wolke) ── */}
      <mesh
        ref={condensationRingRef}
        rotation={[-Math.PI / 2, 0, 0]}
        visible={false}
      >
        <torusGeometry args={[50, 8, 6, 32]} />
        <meshStandardMaterial
          color="#ddeeff"
          transparent
          opacity={0.5}
          depthWrite={false}
        />
      </mesh>

      {/* ── Dust-Skirt (zwei Schichten) ── */}
      <mesh
        ref={dustSkirtInnerRef}
        rotation={[-Math.PI / 2, 0, 0]}
        visible={false}
      >
        <circleGeometry args={[60, 32]} />
        <meshStandardMaterial
          color="#c89a6a"
          transparent
          opacity={0.7}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh ref={dustSkirtRef} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
        <circleGeometry args={[60, 32]} />
        <meshStandardMaterial
          color="#a08060"
          transparent
          opacity={0.6}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* ── Boden-Flash ── */}
      <mesh
        ref={groundFlashRef}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[IMPACT_POINT.x, 0.4, IMPACT_POINT.z]}
        visible={false}
      >
        <circleGeometry args={[40, 32]} />
        <meshBasicMaterial
          color="#ffffff"
          transparent
          opacity={0.95}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* ── Schockwellen ── */}
      <mesh ref={shockwaveRef} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
        <torusGeometry args={[5, 1.8, 6, 56]} />
        <meshStandardMaterial
          color="#cce0ff"
          transparent
          opacity={0.65}
          depthWrite={false}
          emissive="#88aaff"
          emissiveIntensity={0.4}
        />
      </mesh>
      <mesh ref={shockwave2Ref} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
        <torusGeometry args={[5, 1.2, 6, 48]} />
        <meshStandardMaterial
          color="#aaccff"
          transparent
          opacity={0.45}
          depthWrite={false}
        />
      </mesh>

      {/* ── Lichter ── */}
      <pointLight
        ref={nuclearLightRef}
        position={[IMPACT_POINT.x, 30, IMPACT_POINT.z]}
        intensity={0}
        distance={600}
        color="#ff8800"
        visible={false}
      />
      <pointLight
        ref={flashLightRef}
        position={[IMPACT_POINT.x, 8, IMPACT_POINT.z]}
        intensity={0}
        distance={1500}
        color="#ffffff"
        visible={false}
      />

      {/* ── Lens-Flare ── */}
      <sprite
        ref={lensFlareRef}
        position={[IMPACT_POINT.x, 25, IMPACT_POINT.z]}
        visible={false}
      >
        <spriteMaterial
          map={lensFlareTexture}
          transparent
          depthWrite={false}
          depthTest={false}
          blending={THREE.AdditiveBlending}
        />
      </sprite>

      {/* ── Fallout-Partikel ── */}
      <instancedMesh
        ref={falloutMeshRef}
        args={[undefined, undefined, FALLOUT_COUNT]}
        frustumCulled={false}
      >
        <sphereGeometry args={[0.4, 5, 4]} />
        <meshStandardMaterial
          color="#5a4a38"
          roughness={1}
          transparent
          opacity={0.7}
          depthWrite={false}
        />
      </instancedMesh>

      {/* ── Trümmer ── */}
      {debrisSnapshot.map((chunk) => (
        <DebrisMesh key={chunk.id} chunk={chunk} elapsed={elapsed} />
      ))}
    </>
  );
}

// ── Countdown HUD — wird OUTSIDE der Canvas von GameScene gerendert ──────────
export function NuclearCountdownHUD({ count }: { count: number }) {
  return (
    <div
      className="fixed inset-0 pointer-events-none flex flex-col items-center justify-center"
      style={{ zIndex: 150 }}
    >
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 30%, rgba(180,0,0,0.45) 100%)",
          animation: "nuclearPulse 1s ease-in-out infinite",
        }}
      />
      <div className="relative flex flex-col items-center gap-3">
        <span
          style={{
            fontFamily: "'Oswald', sans-serif",
            fontSize: "1.2rem",
            letterSpacing: "0.25em",
            color: "#ff2222",
            textShadow: "0 0 20px #ff0000, 0 0 40px #ff0000",
            fontWeight: 700,
          }}
        >
          ⚠ NUCLEAR LAUNCH DETECTED ⚠
        </span>
        <span
          style={{
            fontFamily: "'Oswald', sans-serif",
            fontSize: count <= 3 ? "9rem" : "7rem",
            lineHeight: 1,
            color: count <= 3 ? "#ff4444" : "#cc0000",
            textShadow:
              count <= 3
                ? "0 0 30px #ff0000, 0 0 60px #ff0000, 0 0 100px #ff0000"
                : "0 0 20px #aa0000, 0 0 40px #880000",
            fontWeight: 900,
            letterSpacing: "0.05em",
            transition: "all 0.15s ease",
          }}
        >
          {count}
        </span>
        <span
          style={{
            fontFamily: "'Oswald', sans-serif",
            fontSize: "0.85rem",
            letterSpacing: "0.3em",
            color: "#ff666688",
            fontWeight: 400,
          }}
        >
          IMPACT IMMINENT
        </span>
      </div>
      <style>{`
        @keyframes nuclearPulse {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1.0; }
        }
      `}</style>
    </div>
  );
}
