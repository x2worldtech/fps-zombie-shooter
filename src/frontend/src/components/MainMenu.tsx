import { useInternetIdentity } from "@caffeineai/core-infrastructure";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

interface MainMenuProps {
  onStartGame: () => void;
  onShowLeaderboard: () => void;
  onShowControls: () => void;
  onShowProfile: () => void;
}

// ── SEEDED PSEUDO-RANDOM ──
function seededRand(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

// ── STARS: very subtle, barely visible through warm haze ──
const BACKGROUND_STARS = Array.from({ length: 180 }, (_, i) => {
  const r = seededRand(i * 17 + 3);
  const x = r() * 100;
  const y = r() * 100;
  // Warm whites only — no blue/purple
  const colorRoll = r();
  const color =
    colorRoll < 0.7 ? "#fff8ee" : colorRoll < 0.88 ? "#ffecc8" : "#fff4d8";
  return {
    id: `bg-${i}`,
    left: x.toFixed(2),
    top: y.toFixed(2),
    size: (0.5 + r() * 0.7).toFixed(1),
    // Very subtle — max 0.25 opacity
    opacity: (0.06 + r() * 0.18).toFixed(2),
    color,
  };
});

// Mid stars — sparse, warm toned
const MID_STARS = Array.from({ length: 60 }, (_, i) => {
  const r = seededRand(i * 31 + 7);
  const x = r() * 100;
  const y = r() * 100;
  const color = r() < 0.75 ? "#fff8ee" : "#ffeac0";
  return {
    id: `mid-${i}`,
    left: x.toFixed(2),
    top: y.toFixed(2),
    size: (0.8 + r() * 0.9).toFixed(1),
    // Max 0.4 — barely visible
    opacity: (0.12 + r() * 0.22).toFixed(2),
    twinkleDuration: (5.0 + r() * 4.0).toFixed(1),
    twinkleDelay: (r() * 8.0).toFixed(1),
    color,
  };
});

// ── METEORITE SHAPES: 12-vertex jagged rocky silhouettes ──
const MET_SHAPES = [
  "polygon(22% 0%,45% 2%,68% 0%,88% 8%,100% 22%,98% 44%,100% 62%,90% 80%,76% 96%,55% 100%,34% 98%,14% 88%,2% 70%,0% 48%,4% 28%,10% 12%)",
  "polygon(35% 0%,58% 4%,78% 0%,94% 14%,100% 36%,96% 58%,100% 72%,84% 90%,64% 100%,40% 96%,20% 100%,6% 82%,0% 60%,4% 38%,0% 18%,18% 6%)",
  "polygon(48% 0%,70% 6%,90% 2%,100% 20%,94% 42%,100% 60%,88% 78%,70% 94%,48% 100%,28% 92%,10% 100%,0% 78%,6% 55%,0% 32%,12% 14%,30% 4%)",
  "polygon(18% 2%,40% 0%,62% 6%,82% 0%,98% 16%,100% 38%,92% 58%,100% 74%,82% 92%,58% 100%,36% 94%,16% 100%,2% 80%,0% 56%,8% 34%,0% 14%)",
  "polygon(30% 0%,52% 4%,74% 0%,92% 10%,100% 30%,96% 52%,100% 70%,86% 88%,66% 100%,44% 96%,22% 100%,6% 84%,0% 62%,6% 40%,0% 22%,14% 8%)",
  "polygon(42% 0%,62% 6%,84% 0%,96% 18%,100% 40%,92% 60%,100% 76%,80% 94%,58% 100%,36% 96%,16% 100%,4% 78%,0% 56%,8% 36%,0% 16%,22% 4%)",
  "polygon(26% 2%,48% 0%,70% 4%,90% 0%,100% 18%,96% 40%,100% 58%,88% 76%,70% 96%,48% 100%,26% 94%,8% 100%,0% 76%,4% 52%,0% 28%,12% 10%)",
  "polygon(38% 0%,60% 6%,80% 2%,96% 16%,100% 36%,94% 56%,100% 72%,84% 90%,62% 100%,40% 96%,20% 100%,4% 82%,0% 60%,6% 38%,0% 18%,20% 6%)",
  "polygon(14% 6%,36% 0%,58% 4%,80% 0%,96% 14%,100% 34%,94% 54%,100% 70%,86% 88%,64% 100%,42% 96%,22% 100%,6% 82%,0% 60%,6% 38%,0% 20%)",
  "polygon(50% 0%,72% 4%,92% 0%,100% 22%,96% 44%,100% 64%,86% 82%,68% 98%,46% 100%,26% 96%,8% 100%,0% 78%,6% 54%,0% 32%,10% 12%,30% 2%)",
  "polygon(32% 0%,54% 6%,76% 0%,94% 12%,100% 32%,92% 54%,100% 68%,82% 90%,60% 100%,38% 96%,18% 100%,4% 80%,0% 58%,8% 36%,0% 16%,18% 4%)",
  "polygon(44% 0%,66% 4%,86% 2%,98% 18%,100% 40%,90% 62%,100% 76%,78% 96%,56% 100%,34% 94%,14% 100%,2% 76%,0% 52%,8% 30%,0% 12%,24% 4%)",
];

// ── METEORITE GRADIENTS: very dark matte stone — NO glow, NO warmth ──
// Lit subtly from upper-left by the distant warm glow source
// Colors: near-black core (#0a0806), dark brown-gray mids (#1c1510, #201812)
// subtle highlight (#302820), all very understated
const MET_GRADIENTS = [
  "radial-gradient(ellipse at 30% 26%, #2a2018 0%, #1c1510 22%, #120e0a 52%, #0a0806 78%, #060402 100%)",
  "radial-gradient(ellipse at 26% 30%, #281e16 0%, #1a1410 20%, #110d09 50%, #090705 76%, #060402 100%)",
  "radial-gradient(ellipse at 34% 22%, #2e2419 0%, #1e1812 22%, #14100b 52%, #0b0907 78%, #070503 100%)",
  "radial-gradient(ellipse at 28% 34%, #241c13 0%, #181210 20%, #0f0c09 50%, #080607 76%, #050404 100%)",
  "radial-gradient(ellipse at 32% 28%, #302618 0%, #201810 22%, #150f0b 52%, #0c0908 78%, #070504 100%)",
  "radial-gradient(ellipse at 24% 24%, #2c2016 0%, #1c1610 20%, #12100a 50%, #0a0807 76%, #060504 100%)",
];

interface MeteorObj {
  id: string;
  layer: "far" | "mid" | "near";
  left: string;
  top: string;
  size: number;
  shape: string;
  gradient: string;
  driftVariant: number;
  duration: number;
  delay: number;
  opacity: string;
  glowColor: string | null;
}

// ── METEORITE OBJECTS: 110 total — denser field, clustered center-bottom/right ──
function buildMeteors(): MeteorObj[] {
  const r = seededRand(1337);
  const meteors: MeteorObj[] = [];

  // Helper: bias position toward center-right and center-bottom of screen
  const biasedPos = (
    rng: () => number,
    biasRight = false,
    biasBottom = false,
  ): [string, string] => {
    const rawX = rng();
    const rawY = rng();
    // 60% chance to cluster toward center-right/bottom
    const roll = rng();
    let x: number;
    let y: number;
    if (roll < 0.6) {
      // Cluster: right half (45–95%), bottom two-thirds (30–95%)
      x = biasRight ? 45 + rawX * 50 : rawX * 100;
      y = biasBottom ? 30 + rawY * 65 : rawY * 100;
    } else {
      x = rawX * 100;
      y = rawY * 100;
    }
    return [
      Math.min(100, Math.max(0, x)).toFixed(1),
      Math.min(100, Math.max(0, y)).toFixed(1),
    ];
  };

  // FAR layer: 45 tiny slow meteorites — more density, clustered right/bottom
  for (let i = 0; i < 45; i++) {
    const size = 3 + r() * 9;
    const dur = 60 + r() * 35;
    const drift = Math.floor(r() * MET_SHAPES.length);
    const layer = "far" as const;
    const [left, top] = biasedPos(r, true, true);
    meteors.push({
      id: `far-${i}`,
      layer,
      left,
      top,
      size: Math.round(size),
      shape: MET_SHAPES[drift % MET_SHAPES.length],
      gradient: MET_GRADIENTS[Math.floor(r() * MET_GRADIENTS.length)],
      driftVariant: drift % 12,
      duration: Math.round(dur),
      delay: -(r() * dur),
      // Far meteors lit softly by distant warm source
      opacity: (0.3 + r() * 0.28).toFixed(2),
      glowColor: null,
    });
  }

  // MID layer: 38 medium meteorites — clustered center-right
  for (let i = 0; i < 38; i++) {
    const size = 14 + r() * 28;
    const dur = 34 + r() * 22;
    const drift = Math.floor(r() * MET_SHAPES.length);
    const layer = "mid" as const;
    const [left, top] = biasedPos(r, true, true);
    meteors.push({
      id: `mid-${i}`,
      layer,
      left,
      top,
      size: Math.round(size),
      shape: MET_SHAPES[drift % MET_SHAPES.length],
      gradient: MET_GRADIENTS[Math.floor(r() * MET_GRADIENTS.length)],
      driftVariant: drift % 12,
      duration: Math.round(dur),
      delay: -(r() * dur),
      opacity: (0.5 + r() * 0.3).toFixed(2),
      glowColor: null,
    });
  }

  // NEAR layer: 27 large prominent meteorites — dark, matte, no glow
  for (let i = 0; i < 27; i++) {
    const size = 44 + r() * 65;
    const dur = 18 + r() * 18;
    const drift = Math.floor(r() * MET_SHAPES.length);
    const layer = "near" as const;
    const [left, top] = biasedPos(r, true, true);
    meteors.push({
      id: `near-${i}`,
      layer,
      left,
      top,
      size: Math.round(size),
      shape: MET_SHAPES[drift % MET_SHAPES.length],
      gradient: MET_GRADIENTS[Math.floor(r() * MET_GRADIENTS.length)],
      driftVariant: drift % 12,
      duration: Math.round(dur),
      delay: -(r() * dur),
      opacity: (0.72 + r() * 0.24).toFixed(2),
      // NO glow — dark matte rock
      glowColor: null,
    });
  }

  return meteors;
}

const METEORS = buildMeteors();
const FAR_METEORS = METEORS.filter((m) => m.layer === "far");
const MID_METEORS = METEORS.filter((m) => m.layer === "mid");
const NEAR_METEORS = METEORS.filter((m) => m.layer === "near");

// ── BOX SHADOW: only subtle inset depth for 3D form — NO outer glow ──
function meteorBoxShadow(layer: "far" | "mid" | "near", size: number): string {
  if (layer === "near") {
    return `inset ${Math.round(size * 0.06)}px ${Math.round(size * 0.06)}px ${Math.round(size * 0.18)}px rgba(255,220,160,0.07), inset -${Math.round(size * 0.1)}px -${Math.round(size * 0.1)}px ${Math.round(size * 0.28)}px rgba(0,0,0,0.9)`;
  }
  if (layer === "mid") {
    return "inset 2px 2px 7px rgba(255,210,140,0.05), inset -2px -2px 8px rgba(0,0,0,0.85)";
  }
  return "inset 1px 1px 3px rgba(255,200,120,0.03), inset -1px -1px 4px rgba(0,0,0,0.7)";
}

// ── COMPONENT ──
export function MainMenu({
  onStartGame,
  onShowLeaderboard,
  onShowControls,
  onShowProfile,
}: MainMenuProps) {
  const { login, clear, loginStatus, identity } = useInternetIdentity();
  const queryClient = useQueryClient();
  const isAuthenticated = !!identity;
  const isLoggingIn = loginStatus === "logging-in";
  const [mounted, setMounted] = useState(false);
  const [activeItem, setActiveItem] = useState(-1);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 80);
    return () => clearTimeout(t);
  }, []);

  // Auto-play main menu music
  useEffect(() => {
    const audio = new Audio("/assets/audio/Zombie3ogg-3.ogg");
    audio.loop = true;
    audio.volume = 0.45;
    audioRef.current = audio;
    const playPromise = audio.play();
    if (playPromise) {
      playPromise.catch(() => {
        const unlock = () => {
          audio.play().catch(() => {});
          document.removeEventListener("click", unlock);
          document.removeEventListener("keydown", unlock);
        };
        document.addEventListener("click", unlock);
        document.addEventListener("keydown", unlock);
      });
    }
    return () => {
      audio.pause();
      audio.src = "";
    };
  }, []);

  const handleAuth = async () => {
    if (isAuthenticated) {
      await clear();
      queryClient.clear();
    } else {
      try {
        await login();
      } catch (error: unknown) {
        if (
          error instanceof Error &&
          error.message === "User is already authenticated"
        ) {
          await clear();
          setTimeout(() => login(), 300);
        }
      }
    }
  };

  const menuItems = [
    { label: "START GAME", action: onStartGame },
    { label: "LEADERBOARD", action: onShowLeaderboard },
    ...(isAuthenticated
      ? [{ label: "MY PROFILE", action: onShowProfile }]
      : []),
    { label: "CONTROLS", action: onShowControls },
    {
      label: isLoggingIn
        ? "SIGNING IN..."
        : isAuthenticated
          ? "SIGN OUT"
          : "SIGN IN",
      action: handleAuth,
    },
  ];

  return (
    <div
      className="relative w-full h-full overflow-hidden"
      // Near-black with very faint warm tint — almost pure black
      style={{ background: "#050302" }}
    >
      {/* ── Z0: ATMOSPHERE LAYERS ── */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ zIndex: 0 }}
      >
        {/* PRIMARY WARM GOLDEN LIGHT SOURCE — dominant feature, center-right/upper-right
            Like a sun or massive explosion hidden behind the asteroid field */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 72% 60% at 72% 38%, rgba(255,138,18,0.32) 0%, rgba(240,115,12,0.20) 22%, rgba(200,88,10,0.12) 45%, rgba(140,58,8,0.05) 68%, transparent 85%)",
          }}
        />
        {/* Secondary amber glow — slightly wider, softer halo */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 90% 75% at 68% 42%, rgba(255,160,30,0.12) 0%, rgba(210,120,15,0.07) 40%, rgba(150,80,8,0.03) 65%, transparent 80%)",
          }}
        />
        {/* Warm brownish-golden atmospheric dust — lower half */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 100% 55% at 55% 100%, rgba(120,70,12,0.18) 0%, rgba(90,50,8,0.10) 35%, rgba(60,32,5,0.04) 62%, transparent 78%)",
          }}
        />
        {/* Right-edge amber haze — blends into light source */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 40% 100% at 100% 45%, rgba(180,95,15,0.12) 0%, rgba(130,65,10,0.06) 50%, transparent 75%)",
          }}
        />
        {/* Subtle center-bottom warm pooling */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 80% 40% at 60% 98%, rgba(100,55,8,0.13) 0%, rgba(70,38,5,0.06) 45%, transparent 70%)",
          }}
        />
      </div>

      {/* ── Z1: BACKGROUND STARS — barely visible ── */}
      <div
        className="absolute inset-0 pointer-events-none overflow-hidden"
        style={{ zIndex: 1 }}
      >
        {BACKGROUND_STARS.map((s) => (
          <div
            key={s.id}
            className="absolute rounded-full"
            style={{
              left: `${s.left}%`,
              top: `${s.top}%`,
              width: `${s.size}px`,
              height: `${s.size}px`,
              background: s.color,
              opacity: Number(s.opacity),
            }}
          />
        ))}
      </div>

      {/* ── Z2: MID STARS — subtle twinkle, barely visible ── */}
      <div
        className="absolute inset-0 pointer-events-none overflow-hidden"
        style={{ zIndex: 2 }}
      >
        {MID_STARS.map((s) => (
          <div
            key={s.id}
            className="absolute rounded-full"
            style={{
              left: `${s.left}%`,
              top: `${s.top}%`,
              width: `${s.size}px`,
              height: `${s.size}px`,
              background: s.color,
              opacity: Number(s.opacity),
              animation: `star-twinkle-mid ${s.twinkleDuration}s ease-in-out ${s.twinkleDelay}s infinite`,
            }}
          />
        ))}
      </div>

      {/* ── Z3: FAR METEORITES — tiny, dark, matte ── */}
      <div
        className="absolute inset-0 pointer-events-none overflow-hidden"
        style={{ zIndex: 3 }}
      >
        {FAR_METEORS.map((m) => (
          <div
            key={m.id}
            className="absolute"
            style={{
              left: `${m.left}%`,
              top: `${m.top}%`,
              width: `${m.size}px`,
              height: `${m.size}px`,
              background: m.gradient,
              clipPath: m.shape,
              opacity: Number(m.opacity),
              boxShadow: meteorBoxShadow("far", m.size),
              animationName: `met-drift-${m.driftVariant}`,
              animationDuration: `${m.duration}s`,
              animationDelay: `${m.delay}s`,
              animationTimingFunction: "linear",
              animationIterationCount: "infinite",
              willChange: "transform",
            }}
          />
        ))}
      </div>

      {/* ── Z4: MID METEORITES — medium, dark stone ── */}
      <div
        className="absolute inset-0 pointer-events-none overflow-hidden"
        style={{ zIndex: 4 }}
      >
        {MID_METEORS.map((m) => (
          <div
            key={m.id}
            className="absolute"
            style={{
              left: `${m.left}%`,
              top: `${m.top}%`,
              width: `${m.size}px`,
              height: `${m.size}px`,
              background: m.gradient,
              clipPath: m.shape,
              opacity: Number(m.opacity),
              boxShadow: meteorBoxShadow("mid", m.size),
              animationName: `met-drift-${m.driftVariant}`,
              animationDuration: `${m.duration}s`,
              animationDelay: `${m.delay}s`,
              animationTimingFunction: "linear",
              animationIterationCount: "infinite",
              willChange: "transform",
            }}
          />
        ))}
      </div>

      {/* ── Z5: NEAR METEORITES — large, prominent dark rocks ── */}
      <div
        className="absolute inset-0 pointer-events-none overflow-hidden"
        style={{ zIndex: 5 }}
      >
        {NEAR_METEORS.map((m) => (
          <div
            key={m.id}
            className="absolute"
            style={{
              left: `${m.left}%`,
              top: `${m.top}%`,
              width: `${m.size}px`,
              height: `${m.size}px`,
              background: m.gradient,
              clipPath: m.shape,
              opacity: Number(m.opacity),
              boxShadow: meteorBoxShadow("near", m.size),
              animationName: `met-drift-${m.driftVariant}`,
              animationDuration: `${m.duration}s`,
              animationDelay: `${m.delay}s`,
              animationTimingFunction: "linear",
              animationIterationCount: "infinite",
              willChange: "transform",
            }}
          />
        ))}
      </div>

      {/* ── Z6: WARM VIGNETTE — frames the scene, deepens edges ── */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          // Dark vignette with a warm amber tint at the inner ring
          background:
            "radial-gradient(ellipse 100% 95% at 50% 50%, transparent 25%, rgba(10,4,0,0.35) 55%, rgba(4,2,0,0.72) 80%, rgba(2,1,0,0.94) 100%)",
          zIndex: 6,
        }}
      />
      {/* Left-edge darkening so menu text pops */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "linear-gradient(to right, rgba(3,1,0,0.55) 0%, rgba(3,1,0,0.18) 28%, transparent 55%)",
          zIndex: 6,
        }}
      />
      {/* Bottom darkening */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "linear-gradient(to top, rgba(2,1,0,0.6) 0%, transparent 30%)",
          zIndex: 6,
        }}
      />

      {/* ── Z10+: MAIN CONTENT — left-aligned ── */}
      <div
        className="absolute inset-0 flex flex-col justify-center"
        style={{ paddingLeft: "clamp(40px, 8vw, 120px)", zIndex: 10 }}
      >
        {/* TITLE BLOCK */}
        <div
          style={{
            opacity: mounted ? 1 : 0,
            transform: mounted ? "translateY(0)" : "translateY(-20px)",
            transition: "opacity 0.6s ease, transform 0.6s ease",
            marginBottom: "clamp(24px, 4vh, 48px)",
          }}
        >
          <div
            style={{
              fontFamily: "'Oswald', sans-serif",
              fontWeight: 700,
              fontSize: "clamp(2.8rem, 7vw, 5.5rem)",
              lineHeight: 1.0,
              letterSpacing: "0.04em",
              color: "rgba(255,255,255,0.92)",
              textTransform: "uppercase",
              textShadow:
                "2px 2px 12px rgba(0,0,0,0.9), 0 0 30px rgba(0,0,0,0.6)",
            }}
          >
            DESERT
          </div>
          <div
            style={{
              fontFamily: "'Oswald', sans-serif",
              fontWeight: 700,
              fontSize: "clamp(4rem, 11vw, 8.5rem)",
              lineHeight: 0.92,
              letterSpacing: "0.03em",
              color: "#ffffff",
              textTransform: "uppercase",
              textShadow:
                "3px 3px 16px rgba(0,0,0,0.95), 0 0 40px rgba(0,0,0,0.7)",
            }}
          >
            DEAD
          </div>
          <div
            style={{
              marginTop: "10px",
              fontFamily: "'Oswald', sans-serif",
              fontWeight: 400,
              fontSize: "clamp(0.65rem, 1.4vw, 0.9rem)",
              letterSpacing: "0.35em",
              color: "rgba(255,255,255,0.35)",
              textTransform: "uppercase",
            }}
          >
            FPS ZOMBIE SHOOTER
          </div>
        </div>

        {/* MENU ITEMS — plain text CoD style */}
        <nav
          style={{
            opacity: mounted ? 1 : 0,
            transform: mounted ? "translateY(0)" : "translateY(16px)",
            transition: "opacity 0.6s ease 0.2s, transform 0.6s ease 0.2s",
          }}
        >
          {menuItems.map((item, idx) => (
            <button
              key={item.label}
              type="button"
              data-ocid={`menu.${item.label.toLowerCase().replace(/[^a-z0-9]/g, "_")}.button`}
              className="cod-menu-item"
              style={{
                color:
                  activeItem === idx ? "#FF7A00" : "rgba(255,255,255,0.82)",
                fontSize:
                  idx === 0
                    ? "clamp(1.6rem, 3.5vw, 2.3rem)"
                    : "clamp(1.2rem, 2.5vw, 1.75rem)",
                transition: "color 0.15s ease",
              }}
              onMouseEnter={() => setActiveItem(idx)}
              onMouseLeave={() => setActiveItem(-1)}
              onClick={item.action}
              disabled={isLoggingIn}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </div>

      {/* ── BOTTOM HINT BAR ── */}
      <div
        className="absolute bottom-0 left-0 right-0"
        style={{
          padding: "12px clamp(40px, 8vw, 120px)",
          zIndex: 10,
          opacity: mounted ? 1 : 0,
          transition: "opacity 0.6s ease 0.5s",
        }}
      >
        <div
          style={{
            fontFamily: "'Oswald', sans-serif",
            fontWeight: 400,
            fontSize: "0.72rem",
            letterSpacing: "0.18em",
            color: "rgba(255,255,255,0.22)",
            textTransform: "uppercase",
          }}
        >
          [ ENTER ] SELECT &nbsp;•&nbsp; [ ESC ] BACK &nbsp;•&nbsp; Built with ❤
          using{" "}
          <a
            href={`https://caffeine.ai/?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "rgba(255,122,0,0.5)", textDecoration: "none" }}
          >
            caffeine.ai
          </a>{" "}
          © {new Date().getFullYear()}
        </div>
      </div>
    </div>
  );
}
