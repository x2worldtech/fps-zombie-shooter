import { useLeaderboard } from "../hooks/useLeaderboard";

interface LeaderboardProps {
  onBack: () => void;
}

const RANK_COLORS = ["#ffd700", "#c0c0c0", "#cd7f32"];
const RANK_LABELS = ["1ST", "2ND", "3RD"];

export function Leaderboard({ onBack }: LeaderboardProps) {
  const { leaderboard, isLoading, isError } = useLeaderboard();

  return (
    <div
      className="relative w-full h-full flex flex-col items-center justify-center overflow-hidden"
      style={{
        background:
          "radial-gradient(ellipse at 50% 30%, rgba(120,10,10,0.12) 0%, #060606 60%)",
      }}
    >
      {/* Scan-line texture */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.04) 2px, rgba(0,0,0,0.04) 4px)",
          zIndex: 0,
        }}
      />

      <div
        className="relative z-10 flex flex-col items-center gap-5 px-8 py-8 w-full max-w-lg"
        style={{
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.1)",
          boxShadow:
            "0 4px 40px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.04)",
        }}
      >
        {/* Title */}
        <div
          style={{
            fontFamily: "'Oswald', sans-serif",
            fontWeight: 700,
            fontSize: "2.8rem",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "rgba(255,255,255,0.95)",
            textShadow:
              "0 0 30px rgba(255,160,20,0.3), 0 2px 8px rgba(0,0,0,0.8)",
          }}
        >
          LEADERBOARD
        </div>

        {/* Divider */}
        <div
          style={{
            width: "100%",
            height: "1px",
            background:
              "linear-gradient(90deg, transparent, rgba(255,160,20,0.5), transparent)",
          }}
        />

        {/* Auth notice */}
        <div
          className="w-full flex items-center gap-2 px-3 py-2"
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.07)",
          }}
        >
          <span style={{ fontSize: "0.9rem" }}>🔒</span>
          <span
            style={{
              fontFamily: "'Sora', system-ui, sans-serif",
              fontSize: "0.78rem",
              color: "rgba(255,255,255,0.4)",
              letterSpacing: "0.02em",
            }}
          >
            Only scores from signed-in players are shown.
          </span>
        </div>

        {/* Header row */}
        <div
          className="w-full grid gap-2 px-3 py-2"
          style={{
            gridTemplateColumns: "44px 1fr 100px 72px",
            background: "rgba(255,255,255,0.04)",
            borderBottom: "1px solid rgba(255,122,0,0.25)",
          }}
        >
          {["#", "NAME", "SCORE", "WAVE"].map((h) => (
            <span
              key={h}
              style={{
                fontFamily: "'Oswald', sans-serif",
                fontWeight: 600,
                fontSize: "0.75rem",
                letterSpacing: "0.12em",
                color: "#FF7A00",
                textTransform: "uppercase",
                textAlign: h === "SCORE" || h === "WAVE" ? "right" : "left",
              }}
            >
              {h}
            </span>
          ))}
        </div>

        {/* Entries */}
        <div
          className="w-full flex flex-col gap-1 max-h-80 overflow-y-auto"
          data-ocid="leaderboard.list"
        >
          {isLoading ? (
            <div
              data-ocid="leaderboard.loading_state"
              className="text-center py-8"
              style={{
                fontFamily: "'Sora', system-ui, sans-serif",
                fontSize: "0.9rem",
                color: "rgba(255,255,255,0.4)",
              }}
            >
              Loading scores...
            </div>
          ) : isError ? (
            <div
              data-ocid="leaderboard.error_state"
              className="text-center py-8"
              style={{
                fontFamily: "'Sora', system-ui, sans-serif",
                fontSize: "0.85rem",
                color: "#ff4444",
              }}
            >
              Could not load scores. Try again later.
            </div>
          ) : leaderboard.length === 0 ? (
            <div
              data-ocid="leaderboard.empty_state"
              className="text-center py-8"
              style={{
                fontFamily: "'Sora', system-ui, sans-serif",
                color: "rgba(255,255,255,0.35)",
              }}
            >
              <div
                style={{
                  fontFamily: "'Oswald', sans-serif",
                  fontWeight: 700,
                  fontSize: "1.5rem",
                  letterSpacing: "0.08em",
                  color: "rgba(255,255,255,0.5)",
                  marginBottom: "6px",
                }}
              >
                NO SCORES YET
              </div>
              Be the first to survive the desert!
            </div>
          ) : (
            leaderboard.map((entry, i) => (
              <div
                // biome-ignore lint: pre-existing issue
                key={i}
                data-ocid={`leaderboard.item.${i + 1}`}
                className="w-full grid gap-2 px-3 py-2 items-center"
                style={{
                  gridTemplateColumns: "44px 1fr 100px 72px",
                  background:
                    i < 3
                      ? `rgba(${i === 0 ? "255,215,0" : i === 1 ? "192,192,192" : "205,127,50"},0.05)`
                      : "rgba(255,255,255,0.025)",
                  border: `1px solid ${
                    i < 3 ? `${RANK_COLORS[i]}30` : "rgba(255,255,255,0.05)"
                  }`,
                }}
              >
                <span
                  style={{
                    fontFamily: "'Oswald', sans-serif",
                    fontWeight: 700,
                    fontSize: i < 3 ? "0.75rem" : "1rem",
                    color: i < 3 ? RANK_COLORS[i] : "rgba(255,255,255,0.3)",
                    letterSpacing: i < 3 ? "0.05em" : "0",
                  }}
                >
                  {i < 3 ? RANK_LABELS[i] : `${i + 1}`}
                </span>
                <span
                  style={{
                    fontFamily: "'Oswald', sans-serif",
                    fontWeight: 600,
                    fontSize: "0.95rem",
                    color: i < 3 ? RANK_COLORS[i] : "rgba(255,255,255,0.75)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {entry.name}
                </span>
                <span
                  style={{
                    fontFamily: "'Oswald', sans-serif",
                    fontWeight: 600,
                    fontSize: "0.95rem",
                    textAlign: "right",
                    color: "rgba(255,255,255,0.85)",
                  }}
                >
                  {Number(entry.score).toLocaleString()}
                </span>
                <span
                  style={{
                    fontFamily: "'Oswald', sans-serif",
                    fontWeight: 600,
                    fontSize: "0.9rem",
                    textAlign: "right",
                    color: "#FF7A00",
                  }}
                >
                  W{Number(entry.wave)}
                </span>
              </div>
            ))
          )}
        </div>

        {/* Divider */}
        <div
          style={{
            width: "100%",
            height: "1px",
            background:
              "linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)",
          }}
        />

        <button
          type="button"
          className="cod-premium-btn-danger w-48"
          data-ocid="leaderboard.back.button"
          onClick={onBack}
        >
          ← BACK
        </button>
      </div>
    </div>
  );
}
