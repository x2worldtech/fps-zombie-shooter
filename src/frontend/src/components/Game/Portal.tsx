import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

export const DESERT_PORTAL_POSITION: [number, number, number] = [20, 0, 0];
export const WARZONE_PORTAL_POSITION: [number, number, number] = [0, 0, 20];
export const PORTAL_INTERACT_RANGE = 3.0;

interface PortalProps {
  position: [number, number, number];
  theme: "warzone" | "desert";
  onActivate: () => void;
  showPrompt: boolean;
}

// ─── Shared vertex shader ──────────────────────────────────────────────────
const portalVertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// ─── Warzone portal: electric blue/purple demonic vortex ───────────────────
const warzoneVortexFrag = `
  uniform float uTime;
  varying vec2 vUv;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p);
    vec2 u = f*f*(3.0-2.0*f);
    return mix(mix(hash(i),hash(i+vec2(1,0)),u.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x),u.y);
  }
  float fbm(vec2 p) {
    float v=0.0; float a=0.5;
    for(int i=0;i<5;i++){ v+=a*noise(p); p=p*2.1+vec2(1.7,9.2); a*=0.5; }
    return v;
  }

  void main() {
    vec2 uv = vUv - 0.5;
    // Scale for oval/tall shape (vUv is on a plane, so we just use as-is)
    float r = length(uv);
    float angle = atan(uv.y, uv.x);

    // Multi-layer swirl: inner fast, outer slow
    float swirl1 = angle + uTime * 2.4 - r * 8.0;
    float swirl2 = angle - uTime * 1.1 - r * 12.0;
    float swirl3 = angle + uTime * 0.6 - r * 4.0;

    vec2 uv1 = vec2(cos(swirl1), sin(swirl1)) * r * 0.5 + 0.5;
    vec2 uv2 = vec2(cos(swirl2), sin(swirl2)) * r * 0.5 + 0.5;
    vec2 uv3 = vec2(cos(swirl3), sin(swirl3)) * r * 0.5 + 0.5;

    float n1 = fbm(uv1 * 5.0 + uTime * 0.3);
    float n2 = fbm(uv2 * 8.0 - uTime * 0.5);
    float n3 = noise(uv3 * 14.0 + uTime * 0.8);

    // UV distortion for fluid warp
    vec2 distort = vec2(
      fbm(uv * 3.0 + uTime * 0.2) - 0.5,
      fbm(uv * 3.0 + vec2(5.2,1.3) + uTime * 0.2) - 0.5
    ) * 0.12;
    vec2 warpUv = uv + distort;
    float wr = length(warpUv);

    // Energy streaks / scanlines rotating around center
    float streak = sin(angle * 6.0 + uTime * 3.5) * 0.5 + 0.5;
    streak = pow(streak, 4.0) * (1.0 - smoothstep(0.3, 0.5, r));

    // Core pulse
    float corePulse = 0.5 + 0.5 * sin(uTime * 4.0);
    float core = (1.0 - smoothstep(0.0, 0.18, wr)) * (0.8 + 0.2 * corePulse);

    // Color layers: white-blue core → electric blue → deep purple → void edge
    vec3 coreCol   = vec3(0.85, 0.95, 1.0);
    vec3 innerCol  = vec3(0.05, 0.35, 1.0);   // electric blue
    vec3 midCol    = vec3(0.28, 0.0, 0.85);   // deep purple
    vec3 outerCol  = vec3(0.05, 0.0, 0.22);   // void dark purple
    vec3 edgeCol   = vec3(0.0, 0.0, 0.08);    // near-black edge

    float t1 = smoothstep(0.0, 0.2, wr);
    float t2 = smoothstep(0.15, 0.35, wr);
    float t3 = smoothstep(0.3, 0.48, wr);

    vec3 col = mix(coreCol, innerCol, t1);
    col = mix(col, midCol, t2 * (0.6 + 0.4 * n1));
    col = mix(col, outerCol, t3 * (0.7 + 0.3 * n2));
    col = mix(col, edgeCol, smoothstep(0.40, 0.5, wr));

    // Add energy streaks (cyan-white)
    col += vec3(0.4, 0.8, 1.0) * streak * 0.6;
    // Add FBM turbulence highlight
    col += vec3(0.1, 0.3, 0.9) * n3 * (1.0 - wr * 2.0) * 0.35;
    // Add core glow
    col += coreCol * core * 1.2;
    // Emissive boost near center
    col *= 1.0 + (1.0 - smoothstep(0.0, 0.3, wr)) * 1.5;

    float alpha = 1.0 - smoothstep(0.44, 0.5, wr);
    gl_FragColor = vec4(col, alpha * 0.96);
  }
`;

// ─── Desert portal: hellfire orange/red ───────────────────────────────────
const desertVortexFrag = `
  uniform float uTime;
  varying vec2 vUv;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p);
    vec2 u = f*f*(3.0-2.0*f);
    return mix(mix(hash(i),hash(i+vec2(1,0)),u.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x),u.y);
  }
  float fbm(vec2 p) {
    float v=0.0; float a=0.5;
    for(int i=0;i<5;i++){ v+=a*noise(p); p=p*2.1+vec2(1.7,9.2); a*=0.5; }
    return v;
  }

  void main() {
    vec2 uv = vUv - 0.5;
    float r = length(uv);
    float angle = atan(uv.y, uv.x);

    // Counter-rotating swirl layers for hellfire feel
    float swirl1 = angle - uTime * 2.0 - r * 9.0;
    float swirl2 = angle + uTime * 1.3 - r * 6.0;
    float swirl3 = angle - uTime * 0.8 - r * 15.0;

    vec2 uv1 = vec2(cos(swirl1), sin(swirl1)) * r * 0.5 + 0.5;
    vec2 uv2 = vec2(cos(swirl2), sin(swirl2)) * r * 0.5 + 0.5;
    vec2 uv3 = vec2(cos(swirl3), sin(swirl3)) * r * 0.5 + 0.5;

    float n1 = fbm(uv1 * 4.5 + uTime * 0.25);
    float n2 = fbm(uv2 * 7.0 - uTime * 0.4);
    float n3 = noise(uv3 * 12.0 + uTime * 0.9);

    // UV distortion for boiling effect
    vec2 distort = vec2(
      fbm(uv * 4.0 + uTime * 0.3) - 0.5,
      fbm(uv * 4.0 + vec2(3.3, 7.1) + uTime * 0.3) - 0.5
    ) * 0.1;
    vec2 warpUv = uv + distort;
    float wr = length(warpUv);

    // Fire streak spokes
    float streak = sin(angle * 5.0 - uTime * 4.0) * 0.5 + 0.5;
    streak = pow(streak, 3.0) * (1.0 - smoothstep(0.25, 0.5, r));

    // Core pulse
    float corePulse = 0.5 + 0.5 * sin(uTime * 3.5);
    float core = (1.0 - smoothstep(0.0, 0.15, wr)) * (0.85 + 0.15 * corePulse);

    // Color: white-yellow core → intense orange → deep red → dark smoke
    vec3 coreCol   = vec3(1.0, 0.98, 0.85);
    vec3 innerCol  = vec3(1.0, 0.45, 0.0);   // hot orange
    vec3 midCol    = vec3(0.75, 0.05, 0.0);   // deep red
    vec3 outerCol  = vec3(0.22, 0.0, 0.0);    // dark red
    vec3 edgeCol   = vec3(0.05, 0.0, 0.0);    // near-black smoke

    float t1 = smoothstep(0.0, 0.18, wr);
    float t2 = smoothstep(0.14, 0.32, wr);
    float t3 = smoothstep(0.28, 0.46, wr);

    vec3 col = mix(coreCol, innerCol, t1);
    col = mix(col, midCol, t2 * (0.65 + 0.35 * n1));
    col = mix(col, outerCol, t3 * (0.7 + 0.3 * n2));
    col = mix(col, edgeCol, smoothstep(0.40, 0.5, wr));

    // Fire streaks (yellow-orange)
    col += vec3(1.0, 0.7, 0.1) * streak * 0.5;
    // FBM embers
    col += vec3(1.0, 0.3, 0.0) * n3 * (1.0 - wr * 2.0) * 0.3;
    // Core bloom
    col += coreCol * core * 1.3;
    col *= 1.0 + (1.0 - smoothstep(0.0, 0.28, wr)) * 1.4;

    float alpha = 1.0 - smoothstep(0.44, 0.5, wr);
    gl_FragColor = vec4(col, alpha * 0.96);
  }
`;

// ─── Portal surface (oval/tall plane with swirl shader) ───────────────────
export function PortalSurface({ theme }: { theme: "warzone" | "desert" }) {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: portalVertexShader,
        fragmentShader:
          theme === "warzone" ? warzoneVortexFrag : desertVortexFrag,
        uniforms: { uTime: { value: 0 } },
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    [theme],
  );

  useFrame(() => {
    mat.uniforms.uTime.value = performance.now() * 0.001;
  });

  // Tall oval shape using a plane scaled to oval proportions
  return (
    <mesh scale={[1.0, 1.55, 1.0]}>
      <circleGeometry args={[1.2, 64]} />
      <primitive object={mat} attach="material" />
    </mesh>
  );
}

// ─── Particle system ───────────────────────────────────────────────────────
const PARTICLE_COUNT = 48;

interface ParticleState {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  life: number;
  maxLife: number;
  orbit: boolean;
  orbitAngle: number;
  orbitRadius: number;
  orbitSpeed: number;
  size: number;
}

function PortalParticles({ theme }: { theme: "warzone" | "desert" }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const particles = useRef<ParticleState[]>([]);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const particleColor =
    theme === "warzone"
      ? new THREE.Color(0.2, 0.5, 1.0)
      : new THREE.Color(1.0, 0.4, 0.05);

  const particleMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: particleColor,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
      }),
    [particleColor],
  );

  // Initialize particles
  useMemo(() => {
    particles.current = Array.from({ length: PARTICLE_COUNT }, (_, i) => {
      const isOrbit = i < 16;
      const angle = Math.random() * Math.PI * 2;
      const edgeR = 1.1 + Math.random() * 0.15;
      const heightOnPortal = (Math.random() - 0.5) * 3.5;
      return {
        pos: new THREE.Vector3(
          Math.cos(angle) * edgeR,
          1.9 + heightOnPortal,
          Math.sin(angle) * 0.05,
        ),
        vel: new THREE.Vector3(
          (Math.random() - 0.5) * 0.015,
          Math.random() * 0.02 + 0.005,
          (Math.random() - 0.5) * 0.01,
        ),
        life: Math.random(),
        maxLife: 1.5 + Math.random() * 2.0,
        orbit: isOrbit,
        orbitAngle: angle,
        orbitRadius: 1.15 + Math.random() * 0.4,
        orbitSpeed:
          (Math.random() > 0.5 ? 1 : -1) * (0.6 + Math.random() * 0.8),
        size: 0.025 + Math.random() * 0.055,
      };
    });
  }, []);

  useFrame((_, delta) => {
    if (!meshRef.current) return;

    particles.current.forEach((p, i) => {
      p.life += delta;

      if (p.orbit) {
        // Orbital wisps circling portal
        p.orbitAngle += p.orbitSpeed * delta;
        p.pos.x = Math.cos(p.orbitAngle) * p.orbitRadius;
        p.pos.y = 1.9 + Math.sin(p.orbitAngle * 0.5) * 1.6;
        p.pos.z = Math.sin(p.orbitAngle) * 0.12;
      } else {
        // Spark particles ejected outward + upward
        p.pos.addScaledVector(p.vel, 1.0);
        p.vel.y += 0.0002; // gentle float
      }

      // Respawn when life exceeds maxLife or drifted too far
      const distFromCenter = Math.sqrt(p.pos.x * p.pos.x + p.pos.z * p.pos.z);
      if (p.life > p.maxLife || distFromCenter > 3.5) {
        const angle = Math.random() * Math.PI * 2;
        const edgeR = 1.0 + Math.random() * 0.2;
        const ht = (Math.random() - 0.5) * 3.4;
        p.pos.set(Math.cos(angle) * edgeR, 1.9 + ht, Math.sin(angle) * 0.06);
        p.vel.set(
          Math.cos(angle) * (0.005 + Math.random() * 0.012),
          Math.random() * 0.015 + 0.004,
          Math.sin(angle) * (0.003 + Math.random() * 0.008),
        );
        p.life = 0;
        p.maxLife = 1.5 + Math.random() * 2.0;
        if (!p.orbit) p.orbitAngle = angle;
      }

      const lifeRatio = p.life / p.maxLife;
      const scale = p.size * (1.0 - lifeRatio * 0.6) * (p.orbit ? 1.5 : 1.0);

      dummy.position.copy(p.pos);
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      meshRef.current!.setMatrixAt(i, dummy.matrix);

      // Fade out over life
      const alpha = p.orbit
        ? 0.4 + 0.4 * Math.sin(p.orbitAngle * 2.0)
        : 1.0 - lifeRatio * 0.8;
      meshRef.current!.setColorAt(
        i,
        theme === "warzone"
          ? new THREE.Color(0.3 + lifeRatio * 0.2, 0.5 - lifeRatio * 0.3, 1.0)
          : new THREE.Color(1.0, 0.5 - lifeRatio * 0.3, 0.05 * alpha),
      );
    });

    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) {
      meshRef.current.instanceColor.needsUpdate = true;
    }
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, PARTICLE_COUNT]}
      frustumCulled={false}
    >
      <sphereGeometry args={[1.0, 4, 4]} />
      <primitive object={particleMat} attach="material" />
    </instancedMesh>
  );
}

// ─── Main Portal component ─────────────────────────────────────────────────
export function Portal({
  position,
  theme,
  onActivate: _onActivate,
  showPrompt: _showPrompt,
}: PortalProps) {
  const groupRef = useRef<THREE.Group>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const ring2Ref = useRef<THREE.Mesh>(null);
  const haloRef = useRef<THREE.Mesh>(null);
  const groundGlowRef = useRef<THREE.Mesh>(null);
  const lightRef = useRef<THREE.PointLight>(null);
  const light2Ref = useRef<THREE.PointLight>(null);
  const keystoneRef = useRef<THREE.Mesh>(null);

  // ── Theme definitions ──
  const isWarzone = theme === "warzone";

  const glowColor = isWarzone
    ? new THREE.Color(0.15, 0.4, 1.0) // electric blue
    : new THREE.Color(1.0, 0.35, 0.02); // hellfire orange

  const glowColor2 = isWarzone
    ? new THREE.Color(0.5, 0.1, 1.0) // purple accent
    : new THREE.Color(0.9, 0.08, 0.0); // deep red accent

  const stoneColor = isWarzone ? "#1a1520" : "#1e1510";
  const stoneMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(stoneColor),
        roughness: 0.92,
        metalness: 0.08,
      }),
    [stoneColor],
  );

  // Iron trim with glowing cracks
  const ironMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(isWarzone ? "#0a0a18" : "#18100a"),
        roughness: 0.45,
        metalness: 0.82,
        emissive: glowColor,
        emissiveIntensity: 0.5,
      }),
    [isWarzone, glowColor],
  );

  // Glowing energy ring material
  const ringMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: glowColor,
        emissive: glowColor,
        emissiveIntensity: 3.0,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
      }),
    [glowColor],
  );

  // Secondary ring (different color)
  const ring2Mat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: glowColor2,
        emissive: glowColor2,
        emissiveIntensity: 2.0,
        transparent: true,
        opacity: 0.65,
        depthWrite: false,
      }),
    [glowColor2],
  );

  // Rune emissive material
  const runeMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: glowColor,
        emissive: glowColor,
        emissiveIntensity: 4.0,
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
      }),
    [glowColor],
  );

  // Halo backglow
  const haloMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: glowColor,
        transparent: true,
        opacity: 0.08,
        side: THREE.BackSide,
        depthWrite: false,
      }),
    [glowColor],
  );

  // Ground glow circle
  const groundGlowMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: glowColor,
        transparent: true,
        opacity: 0.22,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    [glowColor],
  );

  useFrame(() => {
    const t = performance.now() * 0.001;
    const pulse = 0.5 + 0.5 * Math.sin(t * 2.4);
    const fastPulse = 0.5 + 0.5 * Math.sin(t * 5.5);
    const slowPulse = 0.5 + 0.5 * Math.sin(t * 0.9);

    if (ringRef.current) {
      const m = ringRef.current.material as THREE.MeshStandardMaterial;
      m.emissiveIntensity = 2.5 + pulse * 3.5;
      m.opacity = 0.7 + pulse * 0.25;
    }
    if (ring2Ref.current) {
      const m = ring2Ref.current.material as THREE.MeshStandardMaterial;
      m.emissiveIntensity = 1.5 + fastPulse * 2.5;
      m.opacity = 0.4 + fastPulse * 0.35;
      // Counter-rotate
      ring2Ref.current.rotation.z = t * 0.6;
    }
    if (haloRef.current) {
      const m = haloRef.current.material as THREE.MeshBasicMaterial;
      m.opacity = 0.06 + slowPulse * 0.1;
      haloRef.current.scale.setScalar(1.0 + slowPulse * 0.08);
    }
    if (groundGlowRef.current) {
      const m = groundGlowRef.current.material as THREE.MeshBasicMaterial;
      m.opacity = 0.12 + pulse * 0.2;
      groundGlowRef.current.scale.setScalar(1.0 + pulse * 0.15);
    }
    if (lightRef.current) {
      lightRef.current.intensity = 3.0 + pulse * 3.5;
    }
    if (light2Ref.current) {
      light2Ref.current.intensity = 1.0 + fastPulse * 1.5;
    }
    if (keystoneRef.current) {
      const m = keystoneRef.current.material as THREE.MeshStandardMaterial;
      m.emissiveIntensity = 3.0 + pulse * 4.0;
    }
    // Portal group stays fixed in world space — no vertical bobbing
  });

  // Rune geometry: horizontal bars + vertical bar forming rune shapes
  const runeShapes: Array<{
    pos: [number, number, number];
    rot: [number, number, number];
    scale: [number, number, number];
    side: "left" | "right";
  }> = [
    // Left pillar runes (3 sets)
    {
      pos: [-1.42, 1.2, 0.18],
      rot: [0, 0, 0],
      scale: [0.22, 0.04, 0.03],
      side: "left",
    },
    {
      pos: [-1.42, 1.2, 0.18],
      rot: [0, 0, Math.PI / 2],
      scale: [0.22, 0.04, 0.03],
      side: "left",
    },
    {
      pos: [-1.42, 2.0, 0.18],
      rot: [0, 0, Math.PI / 6],
      scale: [0.28, 0.035, 0.03],
      side: "left",
    },
    {
      pos: [-1.42, 2.0, 0.18],
      rot: [0, 0, -Math.PI / 6],
      scale: [0.28, 0.035, 0.03],
      side: "left",
    },
    {
      pos: [-1.42, 2.75, 0.18],
      rot: [0, 0, 0],
      scale: [0.2, 0.04, 0.03],
      side: "left",
    },
    {
      pos: [-1.42, 2.6, 0.18],
      rot: [0, 0, Math.PI / 2],
      scale: [0.32, 0.04, 0.03],
      side: "left",
    },
    {
      pos: [-1.42, 2.9, 0.18],
      rot: [0, 0, Math.PI / 2],
      scale: [0.18, 0.04, 0.03],
      side: "left",
    },
    // Right pillar runes
    {
      pos: [1.42, 1.2, 0.18],
      rot: [0, 0, 0],
      scale: [0.22, 0.04, 0.03],
      side: "right",
    },
    {
      pos: [1.42, 1.2, 0.18],
      rot: [0, 0, Math.PI / 2],
      scale: [0.22, 0.04, 0.03],
      side: "right",
    },
    {
      pos: [1.42, 2.0, 0.18],
      rot: [0, 0, -Math.PI / 5],
      scale: [0.28, 0.035, 0.03],
      side: "right",
    },
    {
      pos: [1.42, 2.0, 0.18],
      rot: [0, 0, Math.PI / 5],
      scale: [0.28, 0.035, 0.03],
      side: "right",
    },
    {
      pos: [1.42, 2.75, 0.18],
      rot: [0, 0, 0],
      scale: [0.2, 0.04, 0.03],
      side: "right",
    },
    {
      pos: [1.42, 2.6, 0.18],
      rot: [0, 0, Math.PI / 2],
      scale: [0.32, 0.04, 0.03],
      side: "right",
    },
    {
      pos: [1.42, 2.9, 0.18],
      rot: [0, 0, Math.PI / 2],
      scale: [0.18, 0.04, 0.03],
      side: "right",
    },
  ];

  // Glowing crack lines along the arch
  const crackLines = [
    {
      pos: [-1.42, 1.6, 0.15] as [number, number, number],
      scale: [0.04, 3.2, 0.02] as [number, number, number],
    },
    {
      pos: [1.42, 1.6, 0.15] as [number, number, number],
      scale: [0.04, 3.2, 0.02] as [number, number, number],
    },
    {
      pos: [0, 3.3, 0.15] as [number, number, number],
      scale: [2.9, 0.04, 0.02] as [number, number, number],
    },
  ];

  const [px, py, pz] = position;

  return (
    <group position={[px, py, pz]}>
      <group ref={groupRef}>
        {/* ── Large halo backglow ── */}
        <mesh ref={haloRef} position={[0, 2.1, -0.12]}>
          <sphereGeometry args={[2.0, 20, 14]} />
          <primitive object={haloMat} attach="material" />
        </mesh>

        {/* ── Portal swirl surface (tall oval via scale) ── */}
        <group position={[0, 2.1, 0]}>
          <PortalSurface theme={theme} />
        </group>

        {/* ── Outer energy ring (main, oval-scaled) ── */}
        <mesh ref={ringRef} position={[0, 2.1, 0.02]} scale={[1.0, 1.55, 1.0]}>
          <torusGeometry args={[1.24, 0.055, 16, 72]} />
          <primitive object={ringMat} attach="material" />
        </mesh>

        {/* ── Secondary spinning ring (slightly inside, different color) ── */}
        <mesh ref={ring2Ref} position={[0, 2.1, 0.04]} scale={[1.0, 1.55, 1.0]}>
          <torusGeometry args={[1.18, 0.03, 12, 60]} />
          <primitive object={ring2Mat} attach="material" />
        </mesh>

        {/* ── Glowing crack trim lines on frame ── */}
        {crackLines.map((crack) => (
          <mesh
            key={`crack-${crack.pos[0]}-${crack.pos[1]}`}
            material={ironMat}
            position={crack.pos}
          >
            <boxGeometry args={crack.scale} />
          </mesh>
        ))}

        {/* ── Stone arch: left pillar ── */}
        <mesh material={stoneMat} position={[-1.42, 1.8, 0]} castShadow>
          <boxGeometry args={[0.32, 3.6, 0.32]} />
        </mesh>
        {/* Stone arch: right pillar */}
        <mesh material={stoneMat} position={[1.42, 1.8, 0]} castShadow>
          <boxGeometry args={[0.32, 3.6, 0.32]} />
        </mesh>
        {/* Stone arch: top header */}
        <mesh material={stoneMat} position={[0, 3.68, 0]} castShadow>
          <boxGeometry args={[3.2, 0.36, 0.32]} />
        </mesh>
        {/* Top arch inner detail (chamfer) */}
        <mesh material={ironMat} position={[0, 3.68, 0.17]}>
          <boxGeometry args={[3.0, 0.16, 0.04]} />
        </mesh>

        {/* ── Massive glowing keystone at top center ── */}
        <mesh
          ref={keystoneRef}
          position={[0, 3.85, 0.17]}
          rotation={[0, 0, Math.PI / 4]}
        >
          <boxGeometry args={[0.38, 0.38, 0.08]} />
          <meshStandardMaterial
            color={glowColor}
            emissive={glowColor}
            emissiveIntensity={4.0}
          />
        </mesh>
        <mesh position={[0, 3.85, 0.1]} rotation={[0, 0, Math.PI / 4]}>
          <boxGeometry args={[0.28, 0.28, 0.12]} />
          <primitive object={stoneMat} attach="material" />
        </mesh>

        {/* ── Pillar cap blocks (decorative) ── */}
        <mesh material={ironMat} position={[-1.42, 3.62, 0.18]}>
          <boxGeometry args={[0.38, 0.08, 0.06]} />
        </mesh>
        <mesh material={ironMat} position={[1.42, 3.62, 0.18]}>
          <boxGeometry args={[0.38, 0.08, 0.06]} />
        </mesh>

        {/* ── Rune markings on pillars ── */}
        {runeShapes.map((rune) => (
          <mesh
            key={`rune-${rune.side}-${rune.pos[1]}-${rune.rot[2].toFixed(3)}`}
            material={runeMat}
            position={rune.pos}
            rotation={rune.rot}
          >
            <boxGeometry args={rune.scale} />
          </mesh>
        ))}

        {/* ── Base plinth (layered for depth) ── */}
        <mesh material={stoneMat} position={[0, 0.22, 0]} castShadow>
          <boxGeometry args={[3.4, 0.44, 0.56]} />
        </mesh>
        <mesh material={stoneMat} position={[0, 0.06, 0]}>
          <boxGeometry args={[3.7, 0.12, 0.72]} />
        </mesh>
        {/* Plinth glowing edge trim */}
        <mesh material={ironMat} position={[0, 0.44, 0.3]}>
          <boxGeometry args={[3.4, 0.04, 0.04]} />
        </mesh>

        {/* ── Particles ── */}
        <PortalParticles theme={theme} />

        {/* ── Primary pulsing point light ── */}
        <pointLight
          ref={lightRef}
          position={[0, 2.1, 1.0]}
          intensity={4.0}
          distance={15}
          color={glowColor}
          castShadow={false}
        />

        {/* ── Secondary fill light from behind ── */}
        <pointLight
          ref={light2Ref}
          position={[0, 2.1, -1.0]}
          intensity={1.5}
          distance={8}
          color={glowColor2}
        />
      </group>

      {/* ── Ground glow circle (stays at y=0, no float) ── */}
      <mesh
        ref={groundGlowRef}
        position={[0, 0.02, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <circleGeometry args={[2.2, 48]} />
        <primitive object={groundGlowMat} attach="material" />
      </mesh>

      {/* ── Ground rune ring ── */}
      <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.6, 0.04, 8, 48]} />
        <meshBasicMaterial
          color={glowColor}
          transparent
          opacity={0.5}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}
