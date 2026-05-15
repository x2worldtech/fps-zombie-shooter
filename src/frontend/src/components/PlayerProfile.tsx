import { useEffect, useState } from "react";
import { useInternetIdentity } from "../hooks/useInternetIdentity";
import { useGetOrCreateProfile } from "../hooks/useQueries";
import {
  getProgressToNextLevel,
  getXpForCurrentLevel,
  getXpForNextLevel,
} from "../utils/levelSystem";

interface PlayerProfileProps {
  onBack: () => void;
}

// ─── Konstanten ─────────────────────────────────────────────────────────────
// 36 ticks für den circular progress ring — alle 10° einer
const TICK_DEGREES: number[] = [];
for (let d = 0; d < 360; d += 10) TICK_DEGREES.push(d);

// ─── SVG Icons (custom, militärisch — keine Emojis) ─────────────────────────
const IconSkull = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
    <title>Kills</title>
    <path d="M12 2C7 2 4 5 4 9.5c0 2.4 1 4.4 2.5 5.7V18a1 1 0 0 0 1 1h1v2h2v-2h3v2h2v-2h1a1 1 0 0 0 1-1v-2.8C19.5 13.9 20 11.9 20 9.5 20 5 17 2 12 2Z" />
    <circle cx="9" cy="10" r="1.5" fill="currentColor" />
    <circle cx="15" cy="10" r="1.5" fill="currentColor" />
    <path d="M10 15h4M11 15v2M13 15v2" />
  </svg>
);

const IconCrosshair = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
    <title>Headshots</title>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
    <circle cx="12" cy="12" r="0.8" fill="currentColor" />
  </svg>
);

const IconBullets = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
    <title>Shots</title>
    <path d="M5 8h3v8H5zM10 6h3v12h-3zM15 9h3v6h-3z" />
    <circle cx="6.5" cy="5" r="1" fill="currentColor" />
    <circle cx="11.5" cy="3" r="1" fill="currentColor" />
    <circle cx="16.5" cy="6" r="1" fill="currentColor" />
  </svg>
);

const IconWave = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
    <title>Rounds</title>
    <path d="M2 12c2-3 4-3 6 0s4 3 6 0 4-3 6 0M2 6c2-3 4-3 6 0s4 3 6 0 4-3 6 0M2 18c2-3 4-3 6 0s4 3 6 0 4-3 6 0" />
  </svg>
);

const IconStar = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <title>XP</title>
    <path d="M12 2 L14.5 8.5 L21.5 9 L16 13.5 L17.5 20.5 L12 17 L6.5 20.5 L8 13.5 L2.5 9 L9.5 8.5 Z" />
  </svg>
);

const IconAccuracy = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
    <title>Accuracy</title>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="6" />
    <circle cx="12" cy="12" r="3" fill="currentColor" />
  </svg>
);

const IconKD = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
    <title>K/D Ratio</title>
    <path d="M3 17l6-6 4 4 8-8M21 7v5h-5" />
  </svg>
);

const IconPerRound = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
    <title>Avg per Round</title>
    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

// ─── Animated Counter (zählt von 0 zum Zielwert) ────────────────────────────
function useAnimatedCount(target: number, durationMs = 1000): number {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (target === 0) {
      setVal(0);
      return;
    }
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      // ease-out-cubic für angenehmen Stop am Ende
      const eased = 1 - (1 - t) ** 3;
      setVal(Math.round(target * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs]);
  return val;
}

// ─── Hauptkomponente ─────────────────────────────────────────────────────────
export function PlayerProfile({ onBack }: PlayerProfileProps) {
  const { identity } = useInternetIdentity();
  const { data: profile, isLoading, isError } = useGetOrCreateProfile();

  const truncatePrincipal = (principal: string) => {
    if (principal.length <= 20) return principal;
    return `${principal.slice(0, 10)}…${principal.slice(-8)}`;
  };

  const totalXP = profile ? Number(profile.totalPoints) : 0;
  const currentLevel = profile ? Number(profile.currentLevel) : 1;
  const progress = getProgressToNextLevel(totalXP);
  const xpForCurrent = getXpForCurrentLevel(totalXP);
  const xpForNext = getXpForNextLevel(totalXP);
  const isMaxLevel = currentLevel >= 55;

  const xpInCurrentLevel = totalXP - xpForCurrent;
  const xpNeededForLevel = isMaxLevel ? 0 : xpForNext - xpForCurrent;

  const totalKills = profile ? Number(profile.totalKills) : 0;
  const totalRounds = profile ? Number(profile.totalRounds) : 0;
  const totalHeadshots = profile ? Number(profile.totalHeadshots) : 0;
  const totalShots = profile ? Number(profile.totalShots) : 0;

  // Animated counters
  const aKills = useAnimatedCount(totalKills, 1200);
  const aRounds = useAnimatedCount(totalRounds, 1200);
  const aHeadshots = useAnimatedCount(totalHeadshots, 1200);
  const aShots = useAnimatedCount(totalShots, 1200);
  const aXP = useAnimatedCount(totalXP, 1400);
  const aLevel = useAnimatedCount(currentLevel, 800);

  // Derived metrics
  const accuracy =
    totalShots > 0 ? Math.round((totalKills / totalShots) * 100) : 0;
  const headshotPct =
    totalKills > 0 ? Math.round((totalHeadshots / totalKills) * 100) : 0;
  const kdRatio = totalRounds > 0 ? (totalKills / totalRounds).toFixed(2) : "—";
  const avgKillsPerRound =
    totalRounds > 0 ? (totalKills / totalRounds).toFixed(1) : "—";

  // Rank-Stufen — gibt visuelle Stufen statt nur Zahl
  const rankInfo = getRankInfo(currentLevel);

  return (
    <div
      className="fixed inset-0 flex flex-col overflow-hidden"
      style={{
        background:
          "radial-gradient(ellipse at 50% 0%, rgba(80,15,5,0.18) 0%, #050505 60%)",
        fontFamily: "'Sora', system-ui, sans-serif",
      }}
    >
      {/* Hexagon-Pattern Hintergrund */}
      <HexBackground />

      {/* Scanlines */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.06) 3px, rgba(0,0,0,0.06) 4px)",
          zIndex: 1,
          mixBlendMode: "multiply",
        }}
      />

      {/* Vignette */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.7) 100%)",
          zIndex: 2,
        }}
      />

      {/* ─── HEADER BAR ───────────────────────────────────────────────────── */}
      <div
        className="relative z-10 flex items-center justify-between px-8 py-5"
        style={{
          borderBottom: "1px solid rgba(255,122,0,0.18)",
          background:
            "linear-gradient(180deg, rgba(255,122,0,0.04) 0%, transparent 100%)",
        }}
      >
        <button
          type="button"
          onClick={onBack}
          data-ocid="profile.back.button"
          className="group flex items-center gap-3 px-4 py-2 transition-colors"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.12)",
            color: "rgba(255,255,255,0.85)",
            fontFamily: "'Oswald', sans-serif",
            fontWeight: 600,
            fontSize: "0.85rem",
            letterSpacing: "0.15em",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(255,122,0,0.12)";
            e.currentTarget.style.borderColor = "rgba(255,122,0,0.4)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "rgba(255,255,255,0.04)";
            e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)";
          }}
        >
          <span style={{ fontSize: "1.2rem", lineHeight: 1 }}>‹</span>
          BACK TO MENU
        </button>

        <div className="flex items-center gap-3">
          <div
            style={{
              width: "8px",
              height: "8px",
              background: "#FF7A00",
              boxShadow: "0 0 8px #FF7A00",
              animation: "pulse 2s ease-in-out infinite",
            }}
          />
          <span
            style={{
              fontFamily: "'Oswald', sans-serif",
              fontWeight: 700,
              fontSize: "1.8rem",
              letterSpacing: "0.4em",
              color: "rgba(255,255,255,0.95)",
              textShadow: "0 0 20px rgba(255,122,0,0.3)",
            }}
          >
            COMBAT RECORD
          </span>
          <div
            style={{
              width: "8px",
              height: "8px",
              background: "#FF7A00",
              boxShadow: "0 0 8px #FF7A00",
              animation: "pulse 2s ease-in-out infinite",
            }}
          />
        </div>

        {identity && (
          <div
            className="flex items-center gap-2 px-3 py-2"
            style={{
              background: "rgba(255,122,0,0.08)",
              border: "1px solid rgba(255,122,0,0.25)",
              fontFamily: "'JetBrains Mono', 'Courier New', monospace",
              fontSize: "0.7rem",
              color: "rgba(255,180,80,0.85)",
              letterSpacing: "0.05em",
            }}
          >
            <span
              style={{
                color: "rgba(255,255,255,0.4)",
                fontSize: "0.65rem",
              }}
            >
              ID
            </span>
            <span>{truncatePrincipal(identity.getPrincipal().toString())}</span>
          </div>
        )}
      </div>

      {/* ─── BODY ─────────────────────────────────────────────────────────── */}
      <div className="relative z-10 flex-1 overflow-y-auto">
        {isLoading && (
          <div
            data-ocid="profile.loading_state"
            className="h-full flex items-center justify-center"
            style={{
              fontFamily: "'Oswald', sans-serif",
              fontSize: "1.3rem",
              color: "rgba(255,255,255,0.5)",
              letterSpacing: "0.3em",
              animation: "pulse 1.5s ease-in-out infinite",
            }}
          >
            ◆ LOADING COMBAT RECORD ◆
          </div>
        )}

        {isError && (
          <div
            data-ocid="profile.error_state"
            className="h-full flex items-center justify-center"
            style={{
              fontFamily: "'Oswald', sans-serif",
              fontSize: "1.1rem",
              color: "#ff4444",
              letterSpacing: "0.2em",
            }}
          >
            ⚠ COULD NOT LOAD PROFILE ⚠
          </div>
        )}

        {profile && !isLoading && (
          <div
            className="grid gap-6 px-8 py-6 mx-auto"
            style={{
              maxWidth: "1600px",
              gridTemplateColumns: "minmax(320px, 380px) 1fr",
            }}
          >
            {/* ─── LEFT COLUMN: Avatar / Level / Rank ─────────────────── */}
            <div className="flex flex-col gap-5">
              {/* Big Level Badge with circular XP ring */}
              <div
                className="relative flex flex-col items-center gap-4 p-6"
                style={panelStyle}
              >
                <PanelCorners />
                <SectionLabel>OPERATIVE STATUS</SectionLabel>

                {/* Circular Level Badge */}
                <CircularLevelBadge
                  level={aLevel}
                  progress={isMaxLevel ? 100 : progress}
                  isMaxLevel={isMaxLevel}
                  rankColor={rankInfo.color}
                />

                {/* Rank tag */}
                <div
                  className="px-4 py-1.5"
                  style={{
                    background: `linear-gradient(90deg, transparent, ${rankInfo.color}33, transparent)`,
                    borderTop: `1px solid ${rankInfo.color}66`,
                    borderBottom: `1px solid ${rankInfo.color}66`,
                    fontFamily: "'Oswald', sans-serif",
                    fontWeight: 700,
                    fontSize: "1.1rem",
                    letterSpacing: "0.3em",
                    color: rankInfo.color,
                    textShadow: `0 0 12px ${rankInfo.color}88`,
                  }}
                >
                  {rankInfo.name}
                </div>

                {/* XP details */}
                <div className="w-full flex justify-between text-center">
                  <div>
                    <div
                      style={{
                        fontFamily: "'Oswald', sans-serif",
                        fontWeight: 700,
                        fontSize: "1.4rem",
                        color: "#FF7A00",
                      }}
                    >
                      {aXP.toLocaleString()}
                    </div>
                    <div
                      style={{
                        fontSize: "0.65rem",
                        color: "rgba(255,255,255,0.4)",
                        letterSpacing: "0.18em",
                        textTransform: "uppercase",
                      }}
                    >
                      Total XP
                    </div>
                  </div>
                  <div
                    style={{
                      width: "1px",
                      background:
                        "linear-gradient(180deg, transparent, rgba(255,255,255,0.2), transparent)",
                    }}
                  />
                  <div>
                    <div
                      style={{
                        fontFamily: "'Oswald', sans-serif",
                        fontWeight: 700,
                        fontSize: "1.4rem",
                        color: "rgba(255,255,255,0.85)",
                      }}
                    >
                      {isMaxLevel ? "—" : xpNeededForLevel.toLocaleString()}
                    </div>
                    <div
                      style={{
                        fontSize: "0.65rem",
                        color: "rgba(255,255,255,0.4)",
                        letterSpacing: "0.18em",
                        textTransform: "uppercase",
                      }}
                    >
                      Next Level
                    </div>
                  </div>
                </div>
              </div>

              {/* Performance Score Card */}
              <div className="relative p-5" style={panelStyle}>
                <PanelCorners />
                <SectionLabel>PERFORMANCE</SectionLabel>
                <div className="mt-3 flex flex-col gap-3">
                  <PerformanceRow
                    label="Combat Effectiveness"
                    value={accuracy}
                    suffix="%"
                    max={100}
                  />
                  <PerformanceRow
                    label="Precision Index"
                    value={headshotPct}
                    suffix="%"
                    max={100}
                  />
                </div>
              </div>
            </div>

            {/* ─── RIGHT COLUMN: Stats Grid + XP Progress ─────────────── */}
            <div className="flex flex-col gap-5">
              {/* Linear XP Progress (additional, more detailed) */}
              <div className="p-5" style={panelStyle}>
                <PanelCorners />
                <div className="flex justify-between items-baseline">
                  <SectionLabel>EXPERIENCE PROGRESSION</SectionLabel>
                  <span
                    style={{
                      fontFamily: "'Oswald', sans-serif",
                      fontSize: "0.95rem",
                      fontWeight: 600,
                      color: "#FF7A00",
                      letterSpacing: "0.05em",
                    }}
                  >
                    {isMaxLevel
                      ? "MAXIMUM RANK"
                      : `${Math.round(progress)}% COMPLETE`}
                  </span>
                </div>
                <XPBar
                  progress={isMaxLevel ? 100 : progress}
                  isMaxLevel={isMaxLevel}
                />
                <div
                  className="flex justify-between mt-2"
                  style={{
                    fontFamily: "'JetBrains Mono', 'Courier New', monospace",
                    fontSize: "0.72rem",
                    color: "rgba(255,255,255,0.5)",
                  }}
                >
                  <span>
                    LVL {currentLevel} ▸ {xpInCurrentLevel.toLocaleString()} XP
                  </span>
                  <span>
                    {isMaxLevel
                      ? "—"
                      : `${(xpForNext - totalXP).toLocaleString()} XP TO LVL ${currentLevel + 1}`}
                  </span>
                </div>
              </div>

              {/* Career Stats */}
              <div className="p-5" style={panelStyle}>
                <PanelCorners />
                <SectionLabel>CAREER STATISTICS</SectionLabel>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
                  <StatTile
                    label="ZOMBIE KILLS"
                    value={aKills}
                    icon={<IconSkull />}
                    accent="#FF7A00"
                  />
                  <StatTile
                    label="HEADSHOTS"
                    value={aHeadshots}
                    icon={<IconCrosshair />}
                    accent="#ffaa44"
                  />
                  <StatTile
                    label="SHOTS FIRED"
                    value={aShots}
                    icon={<IconBullets />}
                    accent="#dd6622"
                  />
                  <StatTile
                    label="ROUNDS SURVIVED"
                    value={aRounds}
                    icon={<IconWave />}
                    accent="#cc4400"
                  />
                </div>
              </div>

              {/* Performance metrics */}
              <div className="p-5" style={panelStyle}>
                <PanelCorners />
                <SectionLabel>COMBAT METRICS</SectionLabel>
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mt-4">
                  <MetricTile
                    label="Hit Rate"
                    value={`${accuracy}%`}
                    icon={<IconAccuracy />}
                  />
                  <MetricTile
                    label="Headshot Ratio"
                    value={`${headshotPct}%`}
                    icon={<IconCrosshair />}
                  />
                  <MetricTile
                    label="Kills / Round"
                    value={String(avgKillsPerRound)}
                    icon={<IconPerRound />}
                  />
                  <MetricTile
                    label="K/D Trend"
                    value={String(kdRatio)}
                    icon={<IconKD />}
                  />
                  <MetricTile
                    label="Total XP"
                    value={aXP.toLocaleString()}
                    icon={<IconStar />}
                  />
                  <MetricTile
                    label="Avg XP/Round"
                    value={
                      totalRounds > 0
                        ? Math.round(totalXP / totalRounds).toLocaleString()
                        : "—"
                    }
                    icon={<IconStar />}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
      `}</style>
    </div>
  );
}

// ─── Sub-Komponenten ─────────────────────────────────────────────────────────

const panelStyle: React.CSSProperties = {
  background:
    "linear-gradient(180deg, rgba(20,12,8,0.85) 0%, rgba(8,5,3,0.95) 100%)",
  border: "1px solid rgba(255,122,0,0.18)",
  boxShadow: "0 8px 32px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.04)",
  position: "relative",
};

/** Eckmarkierungen wie auf Mil-Spec-Dokumenten */
function PanelCorners() {
  const cornerStyle: React.CSSProperties = {
    position: "absolute",
    width: "12px",
    height: "12px",
    borderColor: "rgba(255,122,0,0.5)",
    pointerEvents: "none",
  };
  return (
    <>
      <div
        style={{
          ...cornerStyle,
          top: 0,
          left: 0,
          borderTop: "2px solid",
          borderLeft: "2px solid",
        }}
      />
      <div
        style={{
          ...cornerStyle,
          top: 0,
          right: 0,
          borderTop: "2px solid",
          borderRight: "2px solid",
        }}
      />
      <div
        style={{
          ...cornerStyle,
          bottom: 0,
          left: 0,
          borderBottom: "2px solid",
          borderLeft: "2px solid",
        }}
      />
      <div
        style={{
          ...cornerStyle,
          bottom: 0,
          right: 0,
          borderBottom: "2px solid",
          borderRight: "2px solid",
        }}
      />
    </>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontFamily: "'Oswald', sans-serif",
        fontWeight: 600,
        fontSize: "0.72rem",
        letterSpacing: "0.32em",
        color: "rgba(255,180,80,0.7)",
        textTransform: "uppercase",
      }}
    >
      ▸ {children}
    </div>
  );
}

/** Kreisförmiger Level-Badge mit SVG-Progress-Ring */
function CircularLevelBadge({
  level,
  progress,
  isMaxLevel,
  rankColor,
}: {
  level: number;
  progress: number;
  isMaxLevel: boolean;
  rankColor: string;
}) {
  const size = 200;
  const radius = 88;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <title>Level Progress</title>
        {/* Background ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth="6"
        />
        {/* Tick marks (36 ticks, 4 major every 90°) */}
        {TICK_DEGREES.map((deg) => {
          const angle = (deg / 360) * Math.PI * 2 - Math.PI / 2;
          const isMajor = deg % 90 === 0;
          const r1 = radius + 8;
          const r2 = isMajor ? radius + 14 : radius + 11;
          return (
            <line
              key={`tick-${deg}`}
              x1={size / 2 + Math.cos(angle) * r1}
              y1={size / 2 + Math.sin(angle) * r1}
              x2={size / 2 + Math.cos(angle) * r2}
              y2={size / 2 + Math.sin(angle) * r2}
              stroke={isMajor ? rankColor : "rgba(255,255,255,0.18)"}
              strokeWidth={isMajor ? "1.5" : "1"}
            />
          );
        })}
        {/* Progress ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={rankColor}
          strokeWidth="6"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{
            transition: "stroke-dashoffset 1.2s cubic-bezier(0.16, 1, 0.3, 1)",
            filter: `drop-shadow(0 0 8px ${rankColor}aa)`,
          }}
        />
        {/* Inner decorative ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius - 18}
          fill="none"
          stroke={`${rankColor}44`}
          strokeWidth="1"
        />
      </svg>

      {/* Center text */}
      <div
        className="absolute inset-0 flex flex-col items-center justify-center"
        style={{ pointerEvents: "none" }}
      >
        <div
          style={{
            fontFamily: "'Oswald', sans-serif",
            fontWeight: 400,
            fontSize: "0.7rem",
            letterSpacing: "0.4em",
            color: "rgba(255,255,255,0.4)",
            textTransform: "uppercase",
          }}
        >
          Level
        </div>
        <div
          style={{
            fontFamily: "'Oswald', sans-serif",
            fontWeight: 700,
            fontSize: "5rem",
            lineHeight: 1,
            color: rankColor,
            textShadow: `0 0 24px ${rankColor}aa, 0 2px 8px rgba(0,0,0,0.8)`,
            letterSpacing: "-0.02em",
          }}
        >
          {level}
        </div>
        <div
          style={{
            fontFamily: "'Oswald', sans-serif",
            fontWeight: 400,
            fontSize: "0.7rem",
            letterSpacing: "0.3em",
            color: "rgba(255,255,255,0.4)",
          }}
        >
          {isMaxLevel ? "PRESTIGE" : "OF 55"}
        </div>
      </div>
    </div>
  );
}

/** Premium Stat-Tile */
function StatTile({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  accent: string;
}) {
  return (
    <div
      className="relative flex flex-col gap-2 p-4 group transition-all"
      style={{
        background:
          "linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%)",
        border: "1px solid rgba(255,255,255,0.08)",
        overflow: "hidden",
      }}
    >
      {/* Top accent bar */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "2px",
          background: `linear-gradient(90deg, transparent, ${accent}, transparent)`,
        }}
      />
      {/* Icon background */}
      <div
        style={{
          width: "32px",
          height: "32px",
          color: accent,
          opacity: 0.85,
        }}
      >
        {icon}
      </div>
      <div
        style={{
          fontFamily: "'Oswald', sans-serif",
          fontWeight: 700,
          fontSize: "2rem",
          lineHeight: 1,
          color: "rgba(255,255,255,0.95)",
          letterSpacing: "-0.01em",
        }}
      >
        {value.toLocaleString()}
      </div>
      <div
        style={{
          fontFamily: "'Oswald', sans-serif",
          fontWeight: 500,
          fontSize: "0.7rem",
          letterSpacing: "0.18em",
          color: "rgba(255,255,255,0.5)",
        }}
      >
        {label}
      </div>
    </div>
  );
}

/** Compact Metric Tile for ratios/percentages */
function MetricTile({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div
      className="flex items-center gap-3 px-3 py-2.5"
      style={{
        background: "rgba(255,255,255,0.025)",
        border: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <div
        style={{
          width: "22px",
          height: "22px",
          color: "rgba(255,180,80,0.7)",
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div
          style={{
            fontSize: "0.62rem",
            color: "rgba(255,255,255,0.45)",
            letterSpacing: "0.15em",
            textTransform: "uppercase",
            fontFamily: "'Oswald', sans-serif",
          }}
        >
          {label}
        </div>
        <div
          style={{
            fontFamily: "'Oswald', sans-serif",
            fontWeight: 700,
            fontSize: "1.1rem",
            color: "rgba(255,255,255,0.92)",
            lineHeight: 1.1,
          }}
        >
          {value}
        </div>
      </div>
    </div>
  );
}

/** XP-Bar with shimmer animation */
function XPBar({
  progress,
  isMaxLevel,
}: { progress: number; isMaxLevel: boolean }) {
  return (
    <div
      className="relative w-full mt-3 overflow-hidden"
      style={{
        height: "14px",
        background: "rgba(255,255,255,0.06)",
        border: "1px solid rgba(255,122,0,0.18)",
        boxShadow: "inset 0 1px 3px rgba(0,0,0,0.7)",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: `${progress}%`,
          background: isMaxLevel
            ? "linear-gradient(90deg, #FF7A00, #ffcc00, #FF7A00)"
            : "linear-gradient(90deg, #cc3300 0%, #FF7A00 50%, #ffaa44 100%)",
          boxShadow:
            "0 0 12px rgba(255,122,0,0.6), inset 0 1px 0 rgba(255,255,255,0.3)",
          transition: "width 1.2s cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      />
      {/* Shimmer overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)",
          width: "30%",
          animation: "shimmer 3s linear infinite",
        }}
      />
      {/* Tick marks at 25/50/75 */}
      {[25, 50, 75].map((p) => (
        <div
          key={p}
          style={{
            position: "absolute",
            left: `${p}%`,
            top: "20%",
            bottom: "20%",
            width: "1px",
            background: "rgba(0,0,0,0.4)",
          }}
        />
      ))}
    </div>
  );
}

/** Performance row (stat + bar) */
function PerformanceRow({
  label,
  value,
  suffix,
  max,
}: {
  label: string;
  value: number;
  suffix?: string;
  max: number;
}) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between items-baseline">
        <span
          style={{
            fontFamily: "'Oswald', sans-serif",
            fontWeight: 500,
            fontSize: "0.8rem",
            letterSpacing: "0.1em",
            color: "rgba(255,255,255,0.6)",
            textTransform: "uppercase",
          }}
        >
          {label}
        </span>
        <span
          style={{
            fontFamily: "'Oswald', sans-serif",
            fontWeight: 700,
            fontSize: "1.05rem",
            color: "#ffaa44",
          }}
        >
          {value}
          {suffix}
        </span>
      </div>
      <div
        style={{
          height: "4px",
          background: "rgba(255,255,255,0.06)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${pct}%`,
            background: "linear-gradient(90deg, #cc4400, #ffaa44)",
            transition: "width 1s cubic-bezier(0.16, 1, 0.3, 1)",
            boxShadow: "0 0 6px rgba(255,170,68,0.5)",
          }}
        />
      </div>
    </div>
  );
}

/** Hexagon-Pattern Hintergrund */
function HexBackground() {
  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{
        opacity: 0.08,
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='52' viewBox='0 0 60 52'%3E%3Cpath fill='none' stroke='%23ff7a00' stroke-width='1' d='M30 0 L60 17 L60 35 L30 52 L0 35 L0 17 Z'/%3E%3C/svg%3E\")",
        backgroundSize: "60px 52px",
        zIndex: 0,
      }}
    />
  );
}

// ─── Rang-Stufen ─────────────────────────────────────────────────────────────
function getRankInfo(level: number): { name: string; color: string } {
  if (level >= 55) return { name: "PRESTIGE COMMANDER", color: "#ffd700" };
  if (level >= 45) return { name: "ELITE OPERATOR", color: "#ff8800" };
  if (level >= 35) return { name: "VETERAN", color: "#ff6600" };
  if (level >= 25) return { name: "SERGEANT", color: "#ff7a00" };
  if (level >= 15) return { name: "SPECIALIST", color: "#dd6622" };
  if (level >= 8) return { name: "CORPORAL", color: "#cc6644" };
  if (level >= 3) return { name: "PRIVATE", color: "#aa5544" };
  return { name: "RECRUIT", color: "#888888" };
}
