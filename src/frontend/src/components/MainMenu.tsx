import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useInternetIdentity } from "../hooks/useInternetIdentity";

interface MainMenuProps {
  onStartGame: () => void;
  onShowLeaderboard: () => void;
  onShowControls: () => void;
  onShowProfile: () => void;
}

// ── STAR FIELD ──
const STARS = Array.from({ length: 120 }, (_, i) => ({
  id: i,
  left: ((i * 137.5 + 11) % 100).toFixed(2),
  top: ((i * 97.3 + 7) % 100).toFixed(2),
  size: 1 + (i % 2),
  opacity: (0.2 + ((i * 3) % 7) * 0.09).toFixed(2),
  twinkle: i % 5 === 0, // every 5th star twinkles
  twinkleDuration: (2.5 + (i % 8) * 0.4).toFixed(1),
  twinkleDelay: ((i * 0.23) % 4).toFixed(1),
}));

// ── ASTEROID SHAPES ──
const ASTEROID_SHAPES = [
  "polygon(20% 0%, 80% 5%, 100% 30%, 95% 75%, 75% 100%, 30% 98%, 5% 70%, 0% 25%)",
  "polygon(15% 5%, 70% 0%, 100% 25%, 90% 80%, 60% 100%, 20% 95%, 0% 60%, 5% 20%)",
  "polygon(50% 0%, 90% 20%, 100% 60%, 80% 100%, 30% 90%, 0% 50%, 10% 10%)",
  "polygon(25% 0%, 85% 10%, 100% 45%, 85% 90%, 45% 100%, 5% 75%, 0% 30%)",
  "polygon(40% 0%, 90% 15%, 100% 55%, 70% 100%, 20% 85%, 0% 40%, 15% 5%)",
  "polygon(10% 15%, 60% 0%, 100% 20%, 95% 70%, 65% 100%, 15% 95%, 0% 55%, 5% 15%)",
  "polygon(30% 0%, 75% 5%, 100% 35%, 90% 80%, 55% 100%, 10% 90%, 0% 50%, 8% 18%)",
  "polygon(45% 2%, 88% 18%, 98% 58%, 72% 98%, 22% 92%, 2% 62%, 12% 18%)",
];

const ASTEROID_GRADIENTS = [
  "radial-gradient(ellipse at 30% 28%, #5a5250 0%, #2e2a28 55%, #161412 100%)",
  "radial-gradient(ellipse at 38% 32%, #504840 0%, #28221e 55%, #121008 100%)",
  "radial-gradient(ellipse at 42% 26%, #484442 0%, #2a2826 55%, #181614 100%)",
  "radial-gradient(ellipse at 28% 35%, #524c48 0%, #302c28 55%, #1c1816 100%)",
  "radial-gradient(ellipse at 36% 30%, #464240 0%, #262220 55%, #141210 100%)",
];

// ── ASTEROID OBJECTS ──
const ASTEROIDS = Array.from({ length: 25 }, (_, i) => {
  const isLarge = i < 5;
  const isMedium = i >= 5 && i < 15;
  const size = isLarge
    ? 65 + ((i * 19) % 56)
    : isMedium
      ? 26 + ((i * 13) % 30)
      : 8 + ((i * 7) % 13);
  const driftVariant = i % 8;
  const duration = isLarge
    ? 40 + ((i * 11) % 25)
    : isMedium
      ? 25 + ((i * 7) % 20)
      : 15 + ((i * 5) % 12);
  const delay = -((i * 5.3) % duration);
  return {
    id: i,
    left: ((i * 83 + 9) % 95).toFixed(1),
    top: ((i * 67 + 13) % 90).toFixed(1),
    size,
    shape: ASTEROID_SHAPES[i % ASTEROID_SHAPES.length],
    gradient: ASTEROID_GRADIENTS[i % ASTEROID_GRADIENTS.length],
    driftVariant,
    duration,
    delay,
    boxShadow: isLarge
      ? "inset -4px -4px 12px rgba(0,0,0,0.7), inset 2px 2px 6px rgba(255,255,255,0.05)"
      : isMedium
        ? "inset -2px -2px 6px rgba(0,0,0,0.6)"
        : "inset -1px -1px 3px rgba(0,0,0,0.5)",
  };
});

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
  const [activeItem, setActiveItem] = useState(0);
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
      } catch (error: any) {
        if (error?.message === "User is already authenticated") {
          await clear();
          setTimeout(() => login(), 300);
        }
      }
    }
  };

  const menuItems = [
    { label: "START GAME", action: onStartGame, primary: true },
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
      muted: true,
    },
  ];

  return (
    <div
      className="relative w-full h-full overflow-hidden"
      style={{ background: "#03040a" }}
    >
      {/* ── DEEP SPACE NEBULA GLOW ── */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 65% 40%, rgba(30,20,80,0.18) 0%, rgba(15,8,40,0.10) 40%, transparent 70%)",
          zIndex: 0,
        }}
      />
      {/* secondary subtle nebula */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 50% 40% at 80% 70%, rgba(60,10,80,0.08) 0%, transparent 60%)",
          zIndex: 0,
        }}
      />

      {/* ── STAR FIELD ── */}
      <div
        className="absolute inset-0 pointer-events-none overflow-hidden"
        style={{ zIndex: 1 }}
      >
        {STARS.map((s) => (
          <div
            key={s.id}
            className="absolute rounded-full"
            style={{
              left: `${s.left}%`,
              top: `${s.top}%`,
              width: `${s.size}px`,
              height: `${s.size}px`,
              background: s.id % 7 === 0 ? "#a8c8ff" : "#ffffff",
              opacity: Number(s.opacity),
              animation: s.twinkle
                ? `star-twinkle ${s.twinkleDuration}s ease-in-out ${s.twinkleDelay}s infinite`
                : undefined,
            }}
          />
        ))}
      </div>

      {/* ── ASTEROID FIELD ── */}
      <div
        className="absolute inset-0 pointer-events-none overflow-hidden"
        style={{ zIndex: 2 }}
      >
        {ASTEROIDS.map((a) => (
          <div
            key={a.id}
            className="absolute"
            style={{
              left: `${a.left}%`,
              top: `${a.top}%`,
              width: `${a.size}px`,
              height: `${a.size}px`,
              background: a.gradient,
              clipPath: a.shape,
              boxShadow: a.boxShadow,
              animationName: `ast-drift-${a.driftVariant}`,
              animationDuration: `${a.duration}s`,
              animationDelay: `${a.delay}s`,
              animationTimingFunction: "linear",
              animationIterationCount: "infinite",
              willChange: "transform",
            }}
          />
        ))}
      </div>

      {/* ── DARK VIGNETTE edges ── */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 110% 100% at 50% 50%, transparent 35%, rgba(0,0,0,0.65) 75%, rgba(0,0,0,0.95) 100%)",
          zIndex: 3,
        }}
      />

      {/* ── MAIN CONTENT — left-aligned ── */}
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
                  idx === 0 || activeItem === idx
                    ? "#FF7A00"
                    : item.muted
                      ? "rgba(255,255,255,0.35)"
                      : "rgba(255,255,255,0.82)",
                fontSize:
                  idx === 0
                    ? "clamp(1.6rem, 3.5vw, 2.3rem)"
                    : "clamp(1.2rem, 2.5vw, 1.75rem)",
              }}
              onMouseEnter={() => setActiveItem(idx)}
              onMouseLeave={() => setActiveItem(0)}
              onClick={item.action}
              disabled={isLoggingIn && item.muted}
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
