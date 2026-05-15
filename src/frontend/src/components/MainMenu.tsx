import { useInternetIdentity } from "@caffeineai/core-infrastructure";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { GlobalChatWidget } from "./GlobalChatWidget";
import { MenuAsteroidField } from "./MenuAsteroidField";

function useFullscreen() {
  const [isFullscreen, setIsFullscreen] = useState(false);
  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);
  const toggle = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };
  return { isFullscreen, toggle };
}

function FullscreenButton() {
  const { isFullscreen, toggle } = useFullscreen();
  return (
    <button
      type="button"
      data-ocid="fullscreen-toggle"
      onClick={toggle}
      title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
      style={{
        position: "absolute",
        top: "16px",
        right: "20px",
        zIndex: 30,
        background: "transparent",
        border: "none",
        cursor: "pointer",
        fontFamily: "'Oswald', sans-serif",
        fontWeight: 600,
        fontSize: "0.75rem",
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        color: "rgba(255,255,255,0.82)",
        display: "flex",
        alignItems: "center",
        gap: "6px",
        padding: "6px 8px",
        transition: "color 0.15s ease",
        lineHeight: 1,
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLButtonElement).style.color = "#FF7A00";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.color =
          "rgba(255,255,255,0.82)";
      }}
    >
      <span style={{ fontSize: "1.1rem", lineHeight: 1 }}>
        {isFullscreen ? "⊠" : "⛶"}
      </span>
      <span>{isFullscreen ? "Exit Fullscreen" : "Fullscreen"}</span>
    </button>
  );
}

interface MainMenuProps {
  onStartGame: () => void;
  onShowLeaderboard: () => void;
  onShowControls: () => void;
  onShowProfile: () => void;
  onSocials: () => void;
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

// ── COMPONENT ──
export function MainMenu({
  onStartGame,
  onShowLeaderboard,
  onShowControls,
  onShowProfile,
  onSocials,
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
    { label: "SOCIALS", action: onSocials },
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

      {/* ── Z3-Z5: REALISTIC 3D ASTEROID FIELD ──
       * Ersetzt die alten CSS-clip-path-Asteroiden durch echte 3D-Geometrie:
       * - Verzerrte Icosahedrons mit prozeduralem Noise = felsige Oberfläche
       * - Echte 3D-Rotation um zufällige Achsen (statt 2D-Spin)
       * - Lineare Drift mit Wrap-Around (statt sinusförmigem Hin-und-Her)
       * - Beleuchtung von rechts oben (passend zum warmen Glow im Hintergrund)
       * - 3 Tiefen-Layer (far/mid/near) für echtes Parallax */}
      <MenuAsteroidField />

      {/* ── FULLSCREEN BUTTON — top-right ── */}
      <FullscreenButton />

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

      {/* ── GLOBAL CHAT WIDGET ── */}
      <GlobalChatWidget onOpenFullscreen={onSocials} />

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
