import { useEffect, useState } from "react";
import { useLeaderboard } from "../hooks/useLeaderboard";

interface LeaderboardProps {
  onBack: () => void;
}

// ─── SVG Icons (custom, militärisch) ─────────────────────────────────────────
const IconCrown = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <title>1st place</title>
    <path d="M3 8l3 9h12l3-9-5 3.5L12 5 7 11.5 3 8z" />
    <circle cx="3" cy="8" r="1.4" />
    <circle cx="21" cy="8" r="1.4" />
    <circle cx="12" cy="5" r="1.4" />
    <rect x="5" y="18" width="14" height="2" rx="0.3" />
  </svg>
);

const IconMedalSilver = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <title>2nd place</title>
    <path d="M7 2l3 6h4l3-6h-3l-2 4-2-4H7z" />
    <circle cx="12" cy="15" r="6.5" />
    <circle cx="12" cy="15" r="3.5" fill="rgba(0,0,0,0.4)" />
  </svg>
);

const IconMedalBronze = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <title>3rd place</title>
    <path d="M7 2l3 6h4l3-6h-3l-2 4-2-4H7z" />
    <circle cx="12" cy="15" r="6.5" />
    <circle cx="12" cy="15" r="3.5" fill="rgba(0,0,0,0.4)" />
  </svg>
);

const IconScore = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
    <title>Score</title>
    <path d="M12 2 L14.5 8.5 L21.5 9 L16 13.5 L17.5 20.5 L12 17 L6.5 20.5 L8 13.5 L2.5 9 L9.5 8.5 Z" />
  </svg>
);

const IconWave = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
    <title>Wave</title>
    <path d="M2 12c2-3 4-3 6 0s4 3 6 0 4-3 6 0M2 6c2-3 4-3 6 0s4 3 6 0 4-3 6 0M2 18c2-3 4-3 6 0s4 3 6 0 4-3 6 0" />
  </svg>
);

const IconLock = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
    <title>Lock</title>
    <rect x="5" y="11" width="14" height="9" rx="1.5" />
    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </svg>
);

const IconTrophy = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <title>Trophy</title>
    <path d="M7 4h10v3a5 5 0 0 1-10 0V4z" />
    <path d="M3 5h4v3a3 3 0 0 1-3-3zM21 5h-4v3a3 3 0 0 0 3-3z" />
    <path d="M9 13h6v3H9zM8 16h8v2H8z" />
    <rect x="6" y="18" width="12" height="2" rx="0.3" />
  </svg>
);

// ─── Animated Counter ────────────────────────────────────────────────────────
function useAnimatedCount(target: number, durationMs = 1200, delay = 0): number {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (target === 0) {
      setVal(0);
      return;
    }
    let raf = 0;
    let start = 0;
    const tick = (now: number) => {
      if (start === 0) start = now;
      const elapsed = now - start - delay;
      if (elapsed < 0) {
        raf = requestAnimationFrame(tick);
        return;
      }
      const t = Math.min(1, elapsed / durationMs);
      const eased = 1 - (1 - t) ** 3;
      setVal(Math.round(target * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs, delay]);
  return val;
}

// ─── Main component ──────────────────────────────────────────────────────────
export function Leaderboard({ onBack }: LeaderboardProps) {
  const { leaderboard, isLoading, isError } = useLeaderboard();

  // Top 3 + rest
  const top3 = leaderboard.slice(0, 3);
  const rest = leaderboard.slice(3);

  return (
    <div
      className="fixed inset-0 flex flex-col overflow-hidden"
      style={{
        background:
          "radial-gradient(ellipse at 50% 0%, rgba(80,15,5,0.18) 0%, #050505 60%)",
        fontFamily: "'Sora', system-ui, sans-serif",
      }}
    >
      {/* Hexagon-Pattern */}
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

      {/* ─── HEADER ─────────────────────────────────────────────────────── */}
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
          data-ocid="leaderboard.back.button"
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
          <div
            style={{
              width: "28px",
              height: "28px",
              color: "#ffd700",
              filter: "drop-shadow(0 0 6px rgba(255,215,0,0.6))",
            }}
          >
            <IconTrophy />
          </div>
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
            HALL OF FAME
          </span>
          <div
            style={{
              width: "28px",
              height: "28px",
              color: "#ffd700",
              filter: "drop-shadow(0 0 6px rgba(255,215,0,0.6))",
            }}
          >
            <IconTrophy />
          </div>
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

        <div
          className="flex items-center gap-2 px-3 py-2"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.12)",
            fontFamily: "'JetBrains Mono', 'Courier New', monospace",
            fontSize: "0.7rem",
            color: "rgba(255,180,80,0.7)",
            letterSpacing: "0.05em",
          }}
        >
          <span style={{ width: 14, height: 14 }}>
            <IconLock />
          </span>
          <span>SIGNED-IN PLAYERS ONLY</span>
        </div>
      </div>

      {/* ─── BODY ───────────────────────────────────────────────────────── */}
      <div className="relative z-10 flex-1 overflow-y-auto">
        {isLoading && (
          <div
            data-ocid="leaderboard.loading_state"
            className="h-full flex items-center justify-center"
            style={{
              fontFamily: "'Oswald', sans-serif",
              fontSize: "1.3rem",
              color: "rgba(255,255,255,0.5)",
              letterSpacing: "0.3em",
              animation: "pulse 1.5s ease-in-out infinite",
            }}
          >
            ◆ LOADING SCORES ◆
          </div>
        )}

        {isError && (
          <div
            data-ocid="leaderboard.error_state"
            className="h-full flex items-center justify-center"
            style={{
              fontFamily: "'Oswald', sans-serif",
              fontSize: "1.1rem",
              color: "#ff4444",
              letterSpacing: "0.2em",
            }}
          >
            ⚠ COULD NOT LOAD SCORES ⚠
          </div>
        )}

        {!isLoading && !isError && leaderboard.length === 0 && (
          <div
            data-ocid="leaderboard.empty_state"
            className="h-full flex flex-col items-center justify-center gap-3"
          >
            <div
              style={{
                width: "80px",
                height: "80px",
                color: "rgba(255,122,0,0.3)",
              }}
            >
              <IconTrophy />
            </div>
            <div
              style={{
                fontFamily: "'Oswald', sans-serif",
                fontWeight: 700,
                fontSize: "1.8rem",
                letterSpacing: "0.2em",
                color: "rgba(255,255,255,0.6)",
              }}
            >
              NO SCORES YET
            </div>
            <div
              style={{
                fontFamily: "'Sora', system-ui, sans-serif",
                fontSize: "0.95rem",
                color: "rgba(255,255,255,0.4)",
                letterSpacing: "0.05em",
              }}
            >
              Be the first to survive the desert.
            </div>
          </div>
        )}

        {!isLoading && !isError && leaderboard.length > 0 && (
          <div
            className="mx-auto px-8 py-6"
            style={{ maxWidth: "1400px" }}
          >
            {/* ── TOP 3 PODIUM ── */}
            {top3.length > 0 && <Top3Podium entries={top3} />}

            {/* ── REST LIST ── */}
            {rest.length > 0 && (
              <div className="mt-8">
                <SectionLabel>FURTHER COMBATANTS</SectionLabel>
                <div className="mt-3 flex flex-col gap-1.5">
                  {rest.map((entry, idx) => (
                    <RankRow
                      key={`row-${idx + 4}-${entry.playerName}`}
                      rank={idx + 4}
                      name={entry.playerName}
                      score={Number(entry.score)}
                      wave={Number(entry.wave)}
                      delay={idx * 50}
                    />
                  ))}
                </div>
              </div>
            )}
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
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

// ─── Top 3 Podium ────────────────────────────────────────────────────────────
interface Entry {
  playerName: string;
  score: bigint;
  wave: bigint;
}

function Top3Podium({ entries }: { entries: Entry[] }) {
  // Reorder for podium display: [2nd, 1st, 3rd] so 1st is in the middle
  const left = entries[1];
  const center = entries[0];
  const right = entries[2];

  return (
    <div>
      <SectionLabel>CHAMPIONS</SectionLabel>
      <div
        className="mt-4 grid gap-4 items-end"
        style={{
          gridTemplateColumns:
            entries.length === 1
              ? "1fr"
              : entries.length === 2
                ? "1fr 1fr"
                : "1fr 1.15fr 1fr",
        }}
      >
        {entries.length >= 2 && left && (
          <PodiumCard
            rank={2}
            name={left.playerName}
            score={Number(left.score)}
            wave={Number(left.wave)}
            heightPx={210}
          />
        )}
        {center && (
          <PodiumCard
            rank={1}
            name={center.playerName}
            score={Number(center.score)}
            wave={Number(center.wave)}
            heightPx={250}
          />
        )}
        {entries.length >= 3 && right && (
          <PodiumCard
            rank={3}
            name={right.playerName}
            score={Number(right.score)}
            wave={Number(right.wave)}
            heightPx={185}
          />
        )}
      </div>
    </div>
  );
}

function PodiumCard({
  rank,
  name,
  score,
  wave,
  heightPx,
}: {
  rank: 1 | 2 | 3;
  name: string;
  score: number;
  wave: number;
  heightPx: number;
}) {
  const colors = {
    1: { main: "#ffd700", glow: "#ffd700", accent: "#ffaa00" },
    2: { main: "#d8d8d8", glow: "#cccccc", accent: "#a0a0a0" },
    3: { main: "#cd7f32", glow: "#cd7f32", accent: "#a06020" },
  };
  const c = colors[rank];
  const Icon = rank === 1 ? IconCrown : rank === 2 ? IconMedalSilver : IconMedalBronze;

  const aScore = useAnimatedCount(score, 1500, rank * 150);

  return (
    <div
      className="relative flex flex-col"
      style={{
        animation: `fadeInUp 0.6s ease-out ${rank * 0.1}s both`,
      }}
    >
      <div
        className="relative flex flex-col items-center justify-end gap-3 px-4 pt-6 pb-5"
        style={{
          height: heightPx,
          background:
            rank === 1
              ? "linear-gradient(180deg, rgba(255,215,0,0.15) 0%, rgba(20,15,5,0.95) 50%, rgba(8,5,3,0.98) 100%)"
              : rank === 2
                ? "linear-gradient(180deg, rgba(220,220,220,0.13) 0%, rgba(15,15,15,0.95) 50%, rgba(5,5,5,0.98) 100%)"
                : "linear-gradient(180deg, rgba(205,127,50,0.13) 0%, rgba(15,10,5,0.95) 50%, rgba(8,5,3,0.98) 100%)",
          border: `1px solid ${c.main}55`,
          boxShadow: `0 8px 40px ${c.main}22, inset 0 1px 0 ${c.main}33`,
        }}
      >
        <PanelCorners color={c.main} />

        {/* Top accent stripe */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "3px",
            background: `linear-gradient(90deg, transparent, ${c.main}, transparent)`,
            boxShadow: `0 0 12px ${c.glow}`,
          }}
        />

        {/* Crown / Medal Icon */}
        <div
          style={{
            width: rank === 1 ? "64px" : "52px",
            height: rank === 1 ? "64px" : "52px",
            color: c.main,
            filter: `drop-shadow(0 0 16px ${c.glow}) drop-shadow(0 2px 4px rgba(0,0,0,0.5))`,
            marginTop: "auto",
          }}
        >
          <Icon />
        </div>

        {/* Rank Number */}
        <div
          style={{
            fontFamily: "'Oswald', sans-serif",
            fontWeight: 700,
            fontSize: rank === 1 ? "0.8rem" : "0.75rem",
            letterSpacing: "0.4em",
            color: c.main,
            textShadow: `0 0 8px ${c.glow}66`,
          }}
        >
          {rank === 1 ? "★ CHAMPION ★" : rank === 2 ? "RUNNER-UP" : "THIRD PLACE"}
        </div>

        {/* Player name */}
        <div
          className="w-full text-center px-1"
          style={{
            fontFamily: "'Oswald', sans-serif",
            fontWeight: 700,
            fontSize: rank === 1 ? "1.6rem" : "1.3rem",
            color: "rgba(255,255,255,0.95)",
            letterSpacing: "0.04em",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            textShadow: `0 0 18px ${c.glow}44, 0 2px 4px rgba(0,0,0,0.7)`,
          }}
        >
          {name}
        </div>

        {/* Score + Wave */}
        <div className="w-full flex justify-around items-center pt-1">
          <div className="flex flex-col items-center">
            <div
              style={{
                width: "16px",
                height: "16px",
                color: c.accent,
                marginBottom: "2px",
              }}
            >
              <IconScore />
            </div>
            <div
              style={{
                fontFamily: "'Oswald', sans-serif",
                fontWeight: 700,
                fontSize: rank === 1 ? "1.5rem" : "1.25rem",
                color: c.main,
                lineHeight: 1,
                textShadow: `0 0 12px ${c.glow}66`,
              }}
            >
              {aScore.toLocaleString()}
            </div>
            <div
              style={{
                fontSize: "0.6rem",
                color: "rgba(255,255,255,0.4)",
                letterSpacing: "0.18em",
                fontFamily: "'Oswald', sans-serif",
                marginTop: "2px",
              }}
            >
              SCORE
            </div>
          </div>
          <div
            style={{
              width: "1px",
              height: "32px",
              background: `linear-gradient(180deg, transparent, ${c.main}55, transparent)`,
            }}
          />
          <div className="flex flex-col items-center">
            <div
              style={{
                width: "16px",
                height: "16px",
                color: c.accent,
                marginBottom: "2px",
              }}
            >
              <IconWave />
            </div>
            <div
              style={{
                fontFamily: "'Oswald', sans-serif",
                fontWeight: 700,
                fontSize: rank === 1 ? "1.5rem" : "1.25rem",
                color: "rgba(255,255,255,0.92)",
                lineHeight: 1,
              }}
            >
              {wave}
            </div>
            <div
              style={{
                fontSize: "0.6rem",
                color: "rgba(255,255,255,0.4)",
                letterSpacing: "0.18em",
                fontFamily: "'Oswald', sans-serif",
                marginTop: "2px",
              }}
            >
              WAVE
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Rank Row (Plätze 4+) ────────────────────────────────────────────────────
function RankRow({
  rank,
  name,
  score,
  wave,
  delay,
}: {
  rank: number;
  name: string;
  score: number;
  wave: number;
  delay: number;
}) {
  const aScore = useAnimatedCount(score, 1000, delay);

  return (
    <div
      className="grid items-center gap-4 px-4 py-2.5"
      style={{
        gridTemplateColumns: "60px 1fr 140px 100px",
        background: "rgba(255,255,255,0.025)",
        borderLeft: "3px solid rgba(255,122,0,0.25)",
        animation: `fadeInUp 0.4s ease-out ${delay / 1000}s both`,
      }}
    >
      {/* Rank */}
      <div
        style={{
          fontFamily: "'Oswald', sans-serif",
          fontWeight: 700,
          fontSize: "1.4rem",
          color: "rgba(255,255,255,0.5)",
          letterSpacing: "0.02em",
        }}
      >
        #{rank}
      </div>

      {/* Name */}
      <div
        style={{
          fontFamily: "'Oswald', sans-serif",
          fontWeight: 600,
          fontSize: "1.05rem",
          color: "rgba(255,255,255,0.85)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          letterSpacing: "0.02em",
        }}
      >
        {name}
      </div>

      {/* Score */}
      <div className="flex items-center justify-end gap-2">
        <div
          style={{
            width: "14px",
            height: "14px",
            color: "rgba(255,180,80,0.55)",
          }}
        >
          <IconScore />
        </div>
        <span
          style={{
            fontFamily: "'Oswald', sans-serif",
            fontWeight: 700,
            fontSize: "1.05rem",
            color: "rgba(255,255,255,0.92)",
          }}
        >
          {aScore.toLocaleString()}
        </span>
      </div>

      {/* Wave */}
      <div className="flex items-center justify-end gap-2">
        <div
          style={{
            width: "14px",
            height: "14px",
            color: "rgba(255,180,80,0.55)",
          }}
        >
          <IconWave />
        </div>
        <span
          style={{
            fontFamily: "'Oswald', sans-serif",
            fontWeight: 700,
            fontSize: "1.05rem",
            color: "#FF7A00",
          }}
        >
          W{wave}
        </span>
      </div>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function PanelCorners({ color = "rgba(255,122,0,0.5)" }: { color?: string }) {
  const cs: React.CSSProperties = {
    position: "absolute",
    width: "12px",
    height: "12px",
    borderColor: color,
    pointerEvents: "none",
  };
  return (
    <>
      <div style={{ ...cs, top: 0, left: 0, borderTop: "2px solid", borderLeft: "2px solid" }} />
      <div style={{ ...cs, top: 0, right: 0, borderTop: "2px solid", borderRight: "2px solid" }} />
      <div style={{ ...cs, bottom: 0, left: 0, borderBottom: "2px solid", borderLeft: "2px solid" }} />
      <div style={{ ...cs, bottom: 0, right: 0, borderBottom: "2px solid", borderRight: "2px solid" }} />
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

function HexBackground() {
  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{
        opacity: 0.08,
        backgroundImage:
          'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'60\' height=\'52\' viewBox=\'0 0 60 52\'%3E%3Cpath fill=\'none\' stroke=\'%23ff7a00\' stroke-width=\'1\' d=\'M30 0 L60 17 L60 35 L30 52 L0 35 L0 17 Z\'/%3E%3C/svg%3E")',
        backgroundSize: "60px 52px",
        zIndex: 0,
      }}
    />
  );
}
