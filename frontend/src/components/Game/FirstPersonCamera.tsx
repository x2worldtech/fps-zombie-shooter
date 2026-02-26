import { useRef, useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import {
  generateCollisionAABBs,
  generateMountainCollisionAABBs,
  CollisionAABB,
} from '../../utils/proceduralGeometry';
import { PACK_A_PUNCH_POSITION } from './PackAPunchMachine';

interface FirstPersonCameraProps {
  isLocked: boolean;
  onPlayerPositionUpdate: (pos: [number, number, number]) => void;
  onFire: () => void;
  isGameActive: boolean;
}

const MOVE_SPEED = 8;
const SPRINT_SPEED = 14;
const JUMP_VELOCITY = 6;
const GRAVITY = -18;
const PLAYER_HEIGHT = 1.7;
// Player collision radius (must match the margin used in generateCollisionAABBs)
const PLAYER_RADIUS = 0.4;

// Pack-a-Punch machine AABB (fixed position, size ~1.4 x 1.1)
const PAP_HALF_W = 0.7 + PLAYER_RADIUS;
const PAP_HALF_D = 0.55 + PLAYER_RADIUS;

export function FirstPersonCamera({
  isLocked,
  onPlayerPositionUpdate,
  onFire,
  isGameActive,
}: FirstPersonCameraProps) {
  const { camera } = useThree();

  // Pre-generate collision AABBs once (deterministic, same seed)
  const collisionAABBs = useMemo<CollisionAABB[]>(() => {
    const aabbs = generateCollisionAABBs(PLAYER_RADIUS);

    // Add Pack-a-Punch machine AABB
    const [px, , pz] = PACK_A_PUNCH_POSITION;
    aabbs.push({
      minX: px - PAP_HALF_W,
      maxX: px + PAP_HALF_W,
      minZ: pz - PAP_HALF_D,
      maxZ: pz + PAP_HALF_D,
    });

    // Add mountain ring collision AABBs
    const mountainAABBs = generateMountainCollisionAABBs(PLAYER_RADIUS);
    aabbs.push(...mountainAABBs);

    return aabbs;
  }, []);

  const keysRef = useRef({
    w: false, a: false, s: false, d: false,
    shift: false, space: false,
  });
  const yawRef = useRef(0);
  const pitchRef = useRef(0);
  const velocityYRef = useRef(0);
  const isGroundedRef = useRef(true);
  const posRef = useRef(new THREE.Vector3(0, PLAYER_HEIGHT, 0));
  const mouseDownRef = useRef(false);
  const lastFireRef = useRef(0);

  useEffect(() => {
    camera.position.copy(posRef.current);
  }, [camera]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isLocked) return;
      const sensitivity = 0.002;
      yawRef.current -= e.movementX * sensitivity;
      pitchRef.current -= e.movementY * sensitivity;
      pitchRef.current = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, pitchRef.current));
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isGameActive) return;
      switch (e.code) {
        case 'KeyW': keysRef.current.w = true; break;
        case 'KeyA': keysRef.current.a = true; break;
        case 'KeyS': keysRef.current.s = true; break;
        case 'KeyD': keysRef.current.d = true; break;
        case 'ShiftLeft': case 'ShiftRight': keysRef.current.shift = true; break;
        case 'Space':
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
        case 'KeyW': keysRef.current.w = false; break;
        case 'KeyA': keysRef.current.a = false; break;
        case 'KeyS': keysRef.current.s = false; break;
        case 'KeyD': keysRef.current.d = false; break;
        case 'ShiftLeft': case 'ShiftRight': keysRef.current.shift = false; break;
      }
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (e.button === 0) mouseDownRef.current = true;
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (e.button === 0) mouseDownRef.current = false;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isLocked, isGameActive]);

  useFrame((_, delta) => {
    if (!isGameActive) return;

    const keys = keysRef.current;
    const speed = keys.shift ? SPRINT_SPEED : MOVE_SPEED;

    // Apply rotation
    const euler = new THREE.Euler(pitchRef.current, yawRef.current, 0, 'YXZ');
    camera.quaternion.setFromEuler(euler);

    // Movement direction
    const forward = new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(0, yawRef.current, 0));
    const right = new THREE.Vector3(1, 0, 0).applyEuler(new THREE.Euler(0, yawRef.current, 0));

    const moveDir = new THREE.Vector3();
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
          resolvedX > aabb.minX && resolvedX < aabb.maxX &&
          oldZ > aabb.minZ && oldZ < aabb.maxZ
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
          resolvedX > aabb.minX && resolvedX < aabb.maxX &&
          resolvedZ > aabb.minZ && resolvedZ < aabb.maxZ
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

    // Clamp to arena (soft fallback, mountains should stop player first)
    const maxDist = 62;
    const dist = Math.sqrt(posRef.current.x ** 2 + posRef.current.z ** 2);
    if (dist > maxDist) {
      posRef.current.x *= maxDist / dist;
      posRef.current.z *= maxDist / dist;
    }

    camera.position.copy(posRef.current);

    // Auto-fire when mouse held
    if (mouseDownRef.current && isLocked) {
      const now = Date.now();
      if (now - lastFireRef.current > 50) {
        lastFireRef.current = now;
        onFire();
      }
    }

    onPlayerPositionUpdate([posRef.current.x, posRef.current.y, posRef.current.z]);
  });

  return null;
}
