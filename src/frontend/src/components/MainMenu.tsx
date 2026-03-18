import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useInternetIdentity } from "../hooks/useInternetIdentity";

interface MainMenuProps {
  onStartGame: () => void;
  onShowLeaderboard: () => void;
  onShowControls: () => void;
  onShowProfile: () => void;
}

const BLOOD_DRIPS = Array.from({ length: 14 }, (_, i) => ({
  id: i,
  left: `${(i * 7.3 + 2) % 98}%`,
  height: `${40 + ((i * 17) % 80)}px`,
  width: `${3 + (i % 4)}px`,
  delay: `${(i * 0.6) % 4}s`,
  duration: `${8 + (i % 5)}s`,
  opacity: 0.55 + (i % 4) * 0.1,
}));

const ASH_PARTICLES = Array.from({ length: 28 }, (_, i) => ({
  id: i,
  left: `${(i * 3.7 + 1) % 100}%`,
  size: 1 + (i % 3),
  delay: `${(i * 0.35) % 7}s`,
  duration: `${9 + (i % 7)}s`,
  opacity: 0.12 + (i % 5) * 0.06,
}));

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
  const titleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 60);
    return () => clearTimeout(t);
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

  const truncatePrincipal = (principal: string) => {
    if (principal.length <= 12) return principal;
    return `${principal.slice(0, 6)}...${principal.slice(-4)}`;
  };

  return (
    <div
      className="relative w-full h-full flex flex-col items-center justify-center overflow-hidden"
      style={{ background: "#080400" }}
    >
      {/* BACKGROUND */}
      <div
        className="absolute inset-0 z-0"
        style={{
          backgroundImage:
            "url(/assets/generated/menu-bg-banner.dim_1920x1080.png)",
          backgroundSize: "cover",
          backgroundPosition: "center top",
          backgroundRepeat: "no-repeat",
          filter: "brightness(0.4) saturate(0.8)",
        }}
      />

      {/* DARK OVERLAY — deep cinematic black */}
      <div
        className="absolute inset-0 z-1 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 90% 80% at 50% 35%, rgba(10,2,0,0.3) 0%, rgba(5,1,0,0.75) 60%, rgba(2,0,0,0.97) 100%)",
        }}
      />

      {/* BOTTOM FADE */}
      <div
        className="absolute bottom-0 left-0 right-0 z-1 pointer-events-none"
        style={{
          height: "40%",
          background: "linear-gradient(to top, #040100 0%, transparent 100%)",
        }}
      />

      {/* TOP FADE */}
      <div
        className="absolute top-0 left-0 right-0 z-1 pointer-events-none"
        style={{
          height: "25%",
          background:
            "linear-gradient(to bottom, #040100 0%, transparent 100%)",
        }}
      />

      {/* SCAN LINES */}
      <div
        className="absolute inset-0 z-2 pointer-events-none"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.04) 2px, rgba(0,0,0,0.04) 4px)",
        }}
      />

      {/* BLOOD DRIPS — top */}
      <div className="absolute top-0 left-0 right-0 z-3 pointer-events-none overflow-hidden">
        {BLOOD_DRIPS.map((d) => (
          <div
            key={d.id}
            className="menu-blood-drip absolute top-0 rounded-b-full"
            style={{
              left: d.left,
              width: `${d.width}px`,
              height: `${d.height}px`,
              background:
                "linear-gradient(to bottom, rgba(140,0,0,0.9) 0%, rgba(80,0,0,0.6) 70%, transparent 100%)",
              animationDelay: d.delay,
              animationDuration: d.duration,
              opacity: d.opacity,
            }}
          />
        ))}
      </div>

      {/* ASH PARTICLES */}
      <div className="absolute inset-0 z-4 pointer-events-none overflow-hidden">
        {ASH_PARTICLES.map((p) => (
          <div
            key={p.id}
            className="menu-ash absolute rounded-full"
            style={{
              left: p.left,
              bottom: "-10px",
              width: `${p.size}px`,
              height: `${p.size}px`,
              background: `rgba(200, 80, 20, ${p.opacity})`,
              animationDelay: p.delay,
              animationDuration: p.duration,
            }}
          />
        ))}
      </div>

      {/* SCREEN FLICKER */}
      <div
        className="menu-flicker absolute inset-0 z-3 pointer-events-none"
        style={{ background: "rgba(180,20,0,0.012)" }}
      />

      {/* ── AUTH — top right ── */}
      <div className="absolute top-5 right-5 z-20 flex flex-col items-end gap-2">
        {isAuthenticated && identity && (
          <div
            style={{
              fontFamily: "'Oswald', sans-serif",
              fontSize: "0.72rem",
              fontWeight: 600,
              letterSpacing: "0.08em",
              color: "rgba(255,200,80,0.85)",
              background: "rgba(0,0,0,0.75)",
              border: "1px solid rgba(180,100,0,0.5)",
              padding: "4px 10px",
            }}
          >
            {truncatePrincipal(identity.getPrincipal().toString())}
          </div>
        )}
        <button
          type="button"
          onClick={handleAuth}
          disabled={isLoggingIn}
          className="menu-auth-btn"
          style={{
            fontFamily: "'Oswald', sans-serif",
            fontWeight: 700,
            fontSize: "0.78rem",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            padding: "6px 16px",
            background: isAuthenticated
              ? "rgba(5,0,0,0.9)"
              : "rgba(120,10,0,0.88)",
            border: `1px solid ${isAuthenticated ? "rgba(180,30,0,0.7)" : "rgba(220,40,0,0.85)"}`,
            color: isAuthenticated ? "rgba(200,60,40,0.9)" : "#ff9977",
            cursor: isLoggingIn ? "not-allowed" : "pointer",
            opacity: isLoggingIn ? 0.5 : 1,
            transition: "all 0.15s",
            boxShadow: isAuthenticated ? "none" : "0 0 10px rgba(200,30,0,0.3)",
          }}
        >
          {isLoggingIn
            ? "SIGNING IN..."
            : isAuthenticated
              ? "SIGN OUT"
              : "SIGN IN"}
        </button>
      </div>

      {/* ── TITLE ── */}
      <div
        ref={titleRef}
        className={`relative z-10 flex flex-col items-center mb-10 transition-all duration-800 ${
          mounted ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-10"
        }`}
      >
        {/* Title glow ambient */}
        <div
          className="menu-title-pulse absolute pointer-events-none"
          style={{
            inset: "-40px",
            background:
              "radial-gradient(ellipse 80% 70% at 50% 50%, rgba(200,20,0,0.22) 0%, transparent 70%)",
            filter: "blur(24px)",
          }}
        />

        {/* Main title */}
        <div
          style={{
            fontFamily: "'Bangers', cursive",
            fontSize: "clamp(5rem, 15vw, 10rem)",
            lineHeight: 0.9,
            letterSpacing: "0.04em",
            color: "#d42000",
            WebkitTextStroke: "2px #000",
            textShadow:
              "0 0 40px rgba(220,20,0,0.9), 0 0 80px rgba(180,0,0,0.55), 4px 4px 0 #000, -1px -1px 0 #000",
            position: "relative",
            textAlign: "center",
          }}
        >
          DESERT
        </div>
        <div
          style={{
            fontFamily: "'Bangers', cursive",
            fontSize: "clamp(5rem, 15vw, 10rem)",
            lineHeight: 0.9,
            letterSpacing: "0.04em",
            color: "#ff6600",
            WebkitTextStroke: "2px #000",
            textShadow:
              "0 0 35px rgba(255,80,0,0.8), 0 0 70px rgba(220,40,0,0.4), 4px 4px 0 #000, -1px -1px 0 #000",
            position: "relative",
            textAlign: "center",
          }}
        >
          DEAD
        </div>

        {/* Subtitle */}
        <div
          style={{
            marginTop: "8px",
            fontFamily: "'Oswald', sans-serif",
            fontWeight: 700,
            fontSize: "clamp(0.7rem, 2vw, 1rem)",
            letterSpacing: "0.4em",
            color: "rgba(200,80,30,0.8)",
            textTransform: "uppercase",
          }}
        >
          FPS ZOMBIE SHOOTER
        </div>

        {/* Horizontal rule */}
        <div
          style={{
            marginTop: "14px",
            width: "clamp(180px, 35vw, 280px)",
            height: "1px",
            background:
              "linear-gradient(to right, transparent, rgba(200,30,0,0.9), rgba(255,80,0,0.7), rgba(200,30,0,0.9), transparent)",
            boxShadow: "0 0 8px rgba(220,30,0,0.6)",
          }}
        />
      </div>

      {/* ── MENU BUTTONS ── */}
      <div
        className={`relative z-10 flex flex-col gap-3 items-center transition-all duration-700 delay-200 ${
          mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
        }`}
      >
        {/* PRIMARY: START GAME */}
        <button
          type="button"
          className="menu-primary-btn"
          onClick={onStartGame}
        >
          <span className="menu-primary-btn-shine" />
          <span className="menu-primary-btn-label">▶ START GAME</span>
        </button>

        {/* SECONDARY buttons */}
        <button
          type="button"
          className="menu-secondary-btn"
          onClick={onShowLeaderboard}
        >
          <span className="menu-secondary-btn-icon">🏆</span>
          <span>LEADERBOARD</span>
        </button>

        {isAuthenticated && (
          <button
            type="button"
            className="menu-secondary-btn menu-secondary-btn--blue"
            onClick={onShowProfile}
          >
            <span className="menu-secondary-btn-icon">👤</span>
            <span>MY PROFILE</span>
          </button>
        )}

        <button
          type="button"
          className="menu-secondary-btn menu-secondary-btn--dim"
          onClick={onShowControls}
        >
          <span className="menu-secondary-btn-icon">🎮</span>
          <span>CONTROLS</span>
        </button>
      </div>

      {/* tagline */}
      <div
        className={`relative z-10 mt-8 transition-all duration-700 delay-400 ${
          mounted ? "opacity-100" : "opacity-0"
        }`}
        style={{
          fontFamily: "'Oswald', sans-serif",
          fontSize: "0.68rem",
          letterSpacing: "0.28em",
          color: "rgba(150,40,20,0.65)",
          textTransform: "uppercase",
        }}
      >
        ☠ &nbsp; SURVIVE THE ENDLESS HORDE &nbsp; ☠
      </div>

      {/* FOOTER */}
      <div
        className="absolute bottom-3 left-0 right-0 text-center z-10"
        style={{
          fontFamily: "'Oswald', sans-serif",
          fontSize: "0.65rem",
          color: "rgba(120,50,20,0.55)",
          letterSpacing: "0.04em",
        }}
      >
        Built with ❤ using{" "}
        <a
          href={`https://caffeine.ai/?utm_source=Caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname || "desert-dead-fps")}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "rgba(180,80,30,0.7)", textDecoration: "underline" }}
        >
          caffeine.ai
        </a>{" "}
        · © {new Date().getFullYear()}
      </div>
    </div>
  );
}
