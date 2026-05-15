import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import {
  type CollisionAABB,
  generateCollisionAABBs,
} from "../../utils/proceduralGeometry";
import { PACK_A_PUNCH_POSITION } from "./PackAPunchMachine";
import { generateWarzoneAABBs } from "./WarzoneEnvironment";

interface FirstPersonCameraProps {
  isLocked: boolean;
  onPlayerPositionUpdate: (pos: [number, number, number]) => void;
  onFire: () => void;
  isGameActive: boolean;
  isPaused: boolean;
  extraAABBs?: CollisionAABB[];
  /** Welt bestimmt welches Kollisions-Set aktiv ist */
  world: "desert" | "warzone";
  /** Right-mouse aim aktiv — verhindert Sprinten + Bob beim Zielen */
  isAiming?: boolean;
  /** Callback wenn sich der Movement-State ändert (für WeaponViewModel-Animation) */
  onMovementStateChange?: (state: {
    isMoving: boolean;
    isSprinting: boolean;
    /** Schritt-Phase: 0..2π Sinus-Welle entlang Schritte (für Waffen-Mit-Wackeln) */
    stepPhase: number;
  }) => void;
}

const MOVE_SPEED = 8;
const SPRINT_SPEED = 14;
const JUMP_VELOCITY = 6;
const GRAVITY = -18;
const PLAYER_HEIGHT = 1.7;
// Player collision radius (must match the margin used in generateCollisionAABBs)
const PLAYER_RADIUS = 0.4;
// Map-Grenzen-Radius (kreisförmig statt fehlerhafter Mountain-AABBs)
const MAP_BOUNDARY_RADIUS = 78;

// Pack-a-Punch machine AABB (fixed position, size ~1.4 x 1.1)
const PAP_HALF_W = 0.7 + PLAYER_RADIUS;
const PAP_HALF_D = 0.55 + PLAYER_RADIUS;

export function FirstPersonCamera({
  isLocked,
  onPlayerPositionUpdate,
  onFire,
  isGameActive,
  isPaused,
  extraAABBs = [],
  world,
  isAiming = false,
  onMovementStateChange,
}: FirstPersonCameraProps) {
  const { camera } = useThree();

  // Pre-generate collision AABBs once per world change
  const collisionAABBs = useMemo<CollisionAABB[]>(() => {
    // Pro Welt das richtige Building-Set (vorher: immer Desert + Mountain — falsch)
    const aabbs: CollisionAABB[] =
      world === "desert"
        ? generateCollisionAABBs(PLAYER_RADIUS)
        : generateWarzoneAABBs(PLAYER_RADIUS).map((a) => ({
            minX: a.minX,
            maxX: a.maxX,
            minZ: a.minZ,
            maxZ: a.maxZ,
          }));

    // Pack-a-Punch machine ist nur in Desert relevant — aber sicher ist sicher
    if (world === "desert") {
      const [px, , pz] = PACK_A_PUNCH_POSITION;
      aabbs.push({
        minX: px - PAP_HALF_W,
        maxX: px + PAP_HALF_W,
        minZ: pz - PAP_HALF_D,
        maxZ: pz + PAP_HALF_D,
      });
    }

    // Extra-AABBs (Nuclear Machine + Speed Cola in Warzone)
    aabbs.push(...extraAABBs);

    return aabbs;
  }, [extraAABBs, world]);

  const keysRef = useRef({
    w: false,
    a: false,
    s: false,
    d: false,
    shift: false,
    space: false,
  });
  const yawRef = useRef(0);
  const pitchRef = useRef(0);
  const velocityYRef = useRef(0);
  const isGroundedRef = useRef(true);
  const posRef = useRef(new THREE.Vector3(0, PLAYER_HEIGHT, 0));

  // ── PERF: stabile Vector3/Euler-Refs ─────────────────────────────────────
  // Vorher wurden in useFrame in jedem Tick 5× new Vector3 + 3× new Euler
  // erzeugt → 480+ GC-Allokationen/Sek nur durch die Kamera. Jetzt:
  // einmalige Allokation, in useFrame nur noch .set()/.applyEuler() darauf.
  const tmpEulerRef = useRef(new THREE.Euler(0, 0, 0, "YXZ"));
  const yawEulerRef = useRef(new THREE.Euler(0, 0, 0, "YXZ"));
  const rollEulerRef = useRef(new THREE.Euler(0, 0, 0, "YXZ"));
  const forwardRef = useRef(new THREE.Vector3());
  const rightVecRef = useRef(new THREE.Vector3());
  const moveDirRef = useRef(new THREE.Vector3());
  const bobOffsetRef = useRef(new THREE.Vector3());
  // PERF: stabiles Player-Position-Output-Tupel. Wird per-Frame in-place mutiert
  // und an onPlayerPositionUpdate gereicht. Vorher: neues Array pro Frame.
  // Da GameScene's playerPosRef.current = pos zuweist, hat playerPosRef.current
  // damit ab dem ersten Frame eine STABILE Referenz — was wiederum erlaubt,
  // dass memo'te Children wie PickupMesh die Position aus diesem Ref lesen
  // ohne dass Re-Renders durch Tupel-Wechsel ausgelöst werden.
  const playerPosOutRef = useRef<[number, number, number]>([
    0,
    PLAYER_HEIGHT,
    0,
  ]);
  // PERF: stabiles Payload-Object für onMovementStateChange — verhindert,
  // dass jeder Frame ein neues Objekt allokiert wird. Da der Parent dieses
  // Objekt nur einem Ref zuweist, ist Mutation der Felder unproblematisch.
  const movementStatePayloadRef = useRef({
    isMoving: false,
    isSprinting: false,
    stepPhase: 0,
  });

  // ── Movement-Animation-State ──
  // stepPhase: akkumulierte Schritt-Phase (rad). Erhöht sich proportional zur
  //   Geschwindigkeit. Bei sin(stepPhase) = full step rhythm (links/rechts).
  const stepPhaseRef = useRef(0);
  // Aktuelle Bob-Werte für smoothes Fade-In/Out wenn Bewegung startet/stoppt
  const bobYRef = useRef(0);
  const bobXRef = useRef(0);
  const bobRollRef = useRef(0);
  // Sprint-Intensität (0..1) für smooth Übergänge
  const sprintAmountRef = useRef(0);
  // Movement-State-Cache für Callbacks (vermeidet Re-Renders bei jedem Frame)
  const lastMovementStateRef = useRef({ isMoving: false, isSprinting: false });
  const mouseDownRef = useRef(false);

  useEffect(() => {
    camera.position.copy(posRef.current);
  }, [camera]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isLocked || isPaused) return;
      const sensitivity = 0.002;
      yawRef.current -= e.movementX * sensitivity;
      pitchRef.current -= e.movementY * sensitivity;
      pitchRef.current = Math.max(
        -Math.PI / 2.2,
        Math.min(Math.PI / 2.2, pitchRef.current),
      );
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isGameActive) return;
      switch (e.code) {
        case "KeyW":
          keysRef.current.w = true;
          break;
        case "KeyA":
          keysRef.current.a = true;
          break;
        case "KeyS":
          keysRef.current.s = true;
          break;
        case "KeyD":
          keysRef.current.d = true;
          break;
        case "ShiftLeft":
        case "ShiftRight":
          keysRef.current.shift = true;
          break;
        case "Space":
          e.preventDefault();
          if (isGroundedRef.current) {
            velocityYRef.current = JUMP_VELOCITY;
            isGroundedRef.current = false;
          }
          break;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      switch (e.code) {
        case "KeyW":
          keysRef.current.w = false;
          break;
        case "KeyA":
          keysRef.current.a = false;
          break;
        case "KeyS":
          keysRef.current.s = false;
          break;
        case "KeyD":
          keysRef.current.d = false;
          break;
        case "ShiftLeft":
        case "ShiftRight":
          keysRef.current.shift = false;
          break;
      }
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (e.button === 0) mouseDownRef.current = true;
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (e.button === 0) mouseDownRef.current = false;
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isLocked, isGameActive, isPaused]);

  useFrame((_, delta) => {
    // Freeze all movement and firing when paused
    if (!isGameActive || isPaused) {
      // Still clear movement keys so player doesn't lurch on resume
      keysRef.current.w = false;
      keysRef.current.a = false;
      keysRef.current.s = false;
      keysRef.current.d = false;
      mouseDownRef.current = false;
      return;
    }

    const keys = keysRef.current;
    // Sprint nur wenn nicht zielen UND nur bei Vorwärts-Bewegung (W gedrückt,
    // S nicht). Rückwärts-Sprint ist unrealistisch.
    const wantsSprint = keys.shift && !isAiming && keys.w && !keys.s;
    const speed = wantsSprint ? SPRINT_SPEED : MOVE_SPEED;

    // Apply rotation — wiederverwendeter Euler (PERF)
    const tmpEuler = tmpEulerRef.current;
    tmpEuler.set(pitchRef.current, yawRef.current, 0);
    camera.quaternion.setFromEuler(tmpEuler);

    // Movement direction — wiederverwendete Vector3/Euler statt new (PERF)
    const yawEuler = yawEulerRef.current;
    yawEuler.set(0, yawRef.current, 0);
    const forward = forwardRef.current.set(0, 0, -1).applyEuler(yawEuler);
    const right = rightVecRef.current.set(1, 0, 0).applyEuler(yawEuler);

    const moveDir = moveDirRef.current.set(0, 0, 0);
    if (keys.w) moveDir.add(forward);
    if (keys.s) moveDir.sub(forward);
    if (keys.a) moveDir.sub(right);
    if (keys.d) moveDir.add(right);

    if (moveDir.lengthSq() > 0) {
      moveDir.normalize().multiplyScalar(speed * delta);

      const oldX = posRef.current.x;
      const oldZ = posRef.current.z;
      const newX = oldX + moveDir.x;
      const newZ = oldZ + moveDir.z;

      // Resolve collision axis-by-axis for smooth sliding along walls
      let resolvedX = newX;
      let resolvedZ = newZ;

      for (const aabb of collisionAABBs) {
        // Test X movement (keep Z at old position)
        if (
          resolvedX > aabb.minX &&
          resolvedX < aabb.maxX &&
          oldZ > aabb.minZ &&
          oldZ < aabb.maxZ
        ) {
          // Push player out on X axis
          const overlapLeft = resolvedX - aabb.minX;
          const overlapRight = aabb.maxX - resolvedX;
          if (overlapLeft < overlapRight) {
            resolvedX = aabb.minX;
          } else {
            resolvedX = aabb.maxX;
          }
        }
      }

      for (const aabb of collisionAABBs) {
        // Test Z movement (use resolved X)
        if (
          resolvedX > aabb.minX &&
          resolvedX < aabb.maxX &&
          resolvedZ > aabb.minZ &&
          resolvedZ < aabb.maxZ
        ) {
          // Push player out on Z axis
          const overlapFront = resolvedZ - aabb.minZ;
          const overlapBack = aabb.maxZ - resolvedZ;
          if (overlapFront < overlapBack) {
            resolvedZ = aabb.minZ;
          } else {
            resolvedZ = aabb.maxZ;
          }
        }
      }

      posRef.current.x = resolvedX;
      posRef.current.z = resolvedZ;
    }

    // Gravity & jump
    velocityYRef.current += GRAVITY * delta;
    posRef.current.y += velocityYRef.current * delta;

    if (posRef.current.y <= PLAYER_HEIGHT) {
      posRef.current.y = PLAYER_HEIGHT;
      velocityYRef.current = 0;
      isGroundedRef.current = true;
    }

    // Clamp to arena — kreisförmiger weicher Rand statt fehlerhafter Mountain-AABBs
    // Desert: kleinerer Radius (Berge sind sichtbar bei R=60)
    // Warzone: größer (Häuser stehen bis z=±56, Spieler darf bis ~78 raus)
    const maxDist = world === "desert" ? 62 : MAP_BOUNDARY_RADIUS;
    const dist = Math.sqrt(posRef.current.x ** 2 + posRef.current.z ** 2);
    if (dist > maxDist) {
      posRef.current.x *= maxDist / dist;
      posRef.current.z *= maxDist / dist;
    }

    // ─── HEAD-BOB-ANIMATION (Lauf- und Sprint-Wackeln) ─────────────────────
    // Bestimmen wir, ob/wie schnell sich der Spieler bewegt
    const isMoving =
      isGroundedRef.current && (keys.w || keys.a || keys.s || keys.d);
    const isSprinting = isMoving && wantsSprint;

    // Sprint-Intensität smooth fading (Übergang von Walk ↔ Sprint)
    const targetSprintAmount = isSprinting ? 1 : 0;
    sprintAmountRef.current +=
      (targetSprintAmount - sprintAmountRef.current) * Math.min(delta * 8, 1);

    // Schritt-Phase akkumulieren — Frequenz abhängig von Movement-Speed.
    // Walk: ~2.5 Hz Step-Cycle, Sprint: ~3.8 Hz
    if (isMoving) {
      const stepHz = isSprinting ? 3.8 : 2.5;
      stepPhaseRef.current += delta * stepHz * Math.PI * 2;
    } else {
      // Kein Movement → Phase langsam zurück auf 0 dämpfen (kein hartes Stop)
      stepPhaseRef.current *= 0.92;
    }

    // ── Bob-Zielwerte berechnen ──
    let targetBobY = 0;
    let targetBobX = 0;
    let targetBobRoll = 0;

    if (isMoving) {
      // Walk-Bob-Stärke. Beim Aimen reduziert (steady aim).
      const aimFactor = isAiming ? 0.25 : 1.0;
      const sprintBoost = 1 + sprintAmountRef.current * 1.6; // Sprint = 2.6x stärker
      const bobStrength = aimFactor * sprintBoost;

      // Vertikal: zwei Bumps pro Step-Zyklus (links/rechts Fuß) → |sin|
      // Walk: ±2.5cm Y-Bewegung. Sprint: bis 6.5cm.
      targetBobY =
        Math.abs(Math.sin(stepPhaseRef.current)) * 0.025 * bobStrength;

      // Horizontal: ein Sway pro Step-Zyklus → sin direkt
      // Walk: ±1.5cm X-Bewegung. Sprint: bis 3.9cm.
      targetBobX = Math.sin(stepPhaseRef.current) * 0.015 * bobStrength;

      // Roll (Z-Rotation der Kamera): leichter Roll mit dem Sway
      // Walk: ±0.6°. Sprint: bis 1.6°.
      targetBobRoll = Math.sin(stepPhaseRef.current) * 0.011 * bobStrength;
    }

    // Smooth lerp zu den Zielwerten — verhindert hartes Snap beim Start/Stop
    bobYRef.current += (targetBobY - bobYRef.current) * Math.min(delta * 12, 1);
    bobXRef.current += (targetBobX - bobXRef.current) * Math.min(delta * 12, 1);
    bobRollRef.current +=
      (targetBobRoll - bobRollRef.current) * Math.min(delta * 12, 1);

    // Endposition der Kamera = pos + bob
    camera.position.copy(posRef.current);
    camera.position.y += bobYRef.current;
    // X-Bob in lokaler "right"-Richtung anwenden (nicht World-X)
    // PERF: bobOffsetRef statt right.clone() — keine Allokation pro Frame
    bobOffsetRef.current.copy(right).multiplyScalar(bobXRef.current);
    camera.position.add(bobOffsetRef.current);

    // Roll auf das bestehende Quaternion aufmodulieren — wiederverwendeter Euler
    if (Math.abs(bobRollRef.current) > 0.0001) {
      const rollEuler = rollEulerRef.current;
      rollEuler.set(pitchRef.current, yawRef.current, bobRollRef.current);
      camera.quaternion.setFromEuler(rollEuler);
    }

    // ── Movement-State an WeaponViewModel kommunizieren ──
    // PERF: wiederverwendetes Payload-Objekt — keine Allokation pro Frame
    if (onMovementStateChange) {
      const cached = lastMovementStateRef.current;
      if (cached.isMoving !== isMoving || cached.isSprinting !== isSprinting) {
        cached.isMoving = isMoving;
        cached.isSprinting = isSprinting;
      }
      const payload = movementStatePayloadRef.current;
      payload.isMoving = isMoving;
      payload.isSprinting = isSprinting;
      payload.stepPhase = stepPhaseRef.current;
      onMovementStateChange(payload);
    }

    // Auto-fire when mouse held – fire every frame and let tryFire's
    // time-based cooldown (useWeaponSystem) handle the actual rate limit.
    // This avoids the old 50 ms hardcoded interval that could drift with FPS.
    if (mouseDownRef.current && isLocked) {
      onFire();
    }

    // PERF: stabiles Output-Tupel — in-place mutieren, keine neue Array-
    // Allokation pro Frame.
    const out = playerPosOutRef.current;
    out[0] = posRef.current.x;
    out[1] = posRef.current.y;
    out[2] = posRef.current.z;
    onPlayerPositionUpdate(out);
  });

  return null;
}
