import { useEffect, useRef, useState } from "react";
import { useActor } from "../hooks/useActor";
import { useInternetIdentity } from "../hooks/useInternetIdentity";
import { useLeaderboard } from "../hooks/useLeaderboard";
import { useUpdateProfile } from "../hooks/useQueries";

interface GameOverProps {
  score: number;
  wave: number;
  kills: number;
  headshots: number;
  shotsFired: number;
  onRetry: () => void;
  onMainMenu: () => void;
  onShowLeaderboard: () => void;
}

export function GameOver({
  score,
  wave,
  kills,
  headshots,
  shotsFired,
  onRetry,
  onMainMenu,
  onShowLeaderboard,
}: GameOverProps) {
  const [statsSaved, setStatsSaved] = useState(false);
  const [statsSaveError, setStatsSaveError] = useState(false);
  const { submitScore } = useLeaderboard();
  const { identity } = useInternetIdentity();
  const { actor, isFetching: actorFetching } = useActor();
  const updateProfile = useUpdateProfile();
  const statsSavedRef = useRef(false);
  const scoreSubmittedRef = useRef(false);

  const isAuthenticated = !!identity;
  const actorReady = !!actor && !actorFetching;

  // Auto-submit highscore silently on mount when authenticated and actor ready
  // biome-ignore lint: pre-existing issue
  useEffect(() => {
    if (!isAuthenticated || !actorReady || scoreSubmittedRef.current) return;
    scoreSubmittedRef.current = true;
    submitScore({ score, wave }).catch((err) =>
      console.error("Failed to auto-submit score:", err),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, actorReady]);

  // Submit session stats to backend when authenticated and actor is ready
  // biome-ignore lint: pre-existing issue
  useEffect(() => {
    if (!isAuthenticated || !actorReady || statsSavedRef.current) return;
    statsSavedRef.current = true;

    updateProfile.mutate(
      {
        kills: BigInt(kills),
        headshots: BigInt(headshots),
        shots: BigInt(shotsFired),
        points: BigInt(score),
      },
      {
        onSuccess: () => {
          setStatsSaved(true);
          setStatsSaveError(false);
        },
        onError: () => {
          setStatsSaveError(true);
          statsSavedRef.current = false;
        },
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, actorReady]);

  return (
    <div
      className="relative w-full h-full flex flex-col items-center justify-center overflow-hidden"
      style={{
        background:
          "radial-gradient(ellipse at 50% 0%, rgba(140,0,0,0.22) 0%, #060606 55%)",
      }}
    >
      {/* Top blood glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 80% 30% at 50% 0%, rgba(180,0,0,0.18) 0%, transparent 60%)",
          zIndex: 0,
        }}
      />
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
        className="relative z-10 flex flex-col items-center gap-4 px-8 py-8 w-full max-w-md"
        style={{
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.1)",
          boxShadow:
            "0 4px 40px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.04)",
        }}
      >
        {/* Title */}
        <div
          data-ocid="gameover.panel"
          style={{
            fontFamily: "'Oswald', sans-serif",
            fontWeight: 700,
            fontSize: "clamp(3.5rem, 8vw, 5.5rem)",
            letterSpacing: "0.05em",
            textTransform: "uppercase",
            color: "#cc1111",
            textShadow:
              "0 0 40px rgba(220,0,0,0.6), 0 0 80px rgba(180,0,0,0.3), 0 4px 12px rgba(0,0,0,0.9)",
            lineHeight: 1,
          }}
        >
          GAME OVER
        </div>

        {/* Divider */}
        <div
          style={{
            width: "100%",
            height: "1px",
            background:
              "linear-gradient(90deg, transparent, rgba(200,20,20,0.5), transparent)",
          }}
        />

        {/* Stats */}
        <div className="w-full grid grid-cols-2 gap-2">
          {[
            {
              label: "Score",
              value: score.toLocaleString(),
              color: "rgba(255,255,255,0.92)",
            },
            { label: "Wave", value: String(wave), color: "#FF7A00" },
            { label: "Kills", value: String(kills), color: "#ff5555" },
            { label: "Headshots", value: String(headshots), color: "#44ee88" },
          ].map(({ label, value, color }) => (
            <div
              key={label}
              className="flex flex-col items-center py-3 px-2"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.07)",
              }}
            >
              <span
                style={{
                  fontFamily: "'Oswald', sans-serif",
                  fontWeight: 700,
                  fontSize: "2rem",
                  color,
                  lineHeight: 1.1,
                }}
              >
                {value}
              </span>
              <span
                style={{
                  fontFamily: "'Sora', system-ui, sans-serif",
                  fontSize: "0.68rem",
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: "rgba(255,255,255,0.35)",
                  marginTop: "2px",
                }}
              >
                {label}
              </span>
            </div>
          ))}
        </div>

        {/* Stats save status */}
        {isAuthenticated && (
          <div className="w-full">
            {!statsSaved && !statsSaveError && (
              <div
                data-ocid="gameover.loading_state"
                className="w-full flex items-center justify-center gap-2 px-3 py-2"
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <span
                  style={{
                    fontFamily: "'Sora', system-ui, sans-serif",
                    fontSize: "0.8rem",
                    color: "rgba(255,255,255,0.45)",
                    animation: "pulse 1.5s ease-in-out infinite",
                  }}
                >
                  Saving stats...
                </span>
              </div>
            )}
            {statsSaved && (
              <div
                data-ocid="gameover.success_state"
                className="w-full flex items-center justify-center gap-2 px-3 py-2"
                style={{
                  background: "rgba(20,80,20,0.1)",
                  border: "1px solid rgba(40,160,70,0.3)",
                }}
              >
                <span
                  style={{
                    fontFamily: "'Sora', system-ui, sans-serif",
                    fontSize: "0.8rem",
                    color: "#44ee88",
                  }}
                >
                  ✓ Stats saved to your profile
                </span>
              </div>
            )}
            {statsSaveError && (
              <div
                data-ocid="gameover.error_state"
                className="w-full flex items-center justify-center gap-2 px-3 py-2"
                style={{
                  background: "rgba(80,0,0,0.1)",
                  border: "1px solid rgba(200,30,30,0.3)",
                }}
              >
                <span
                  style={{
                    fontFamily: "'Sora', system-ui, sans-serif",
                    fontSize: "0.8rem",
                    color: "#ff5555",
                  }}
                >
                  ✗ Could not save stats. Try again later.
                </span>
              </div>
            )}
          </div>
        )}

        {/* Score auto-submitted silently — no UI feedback needed */}

        {/* Divider */}
        <div
          style={{
            width: "100%",
            height: "1px",
            background:
              "linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)",
          }}
        />

        {/* Action buttons */}
        <div className="w-full flex flex-col gap-2">
          <button
            type="button"
            className="cod-premium-btn-success w-full"
            data-ocid="gameover.primary_button"
            onClick={onRetry}
          >
            PLAY AGAIN
          </button>
          <button
            type="button"
            className="cod-premium-btn w-full"
            data-ocid="gameover.secondary_button"
            onClick={onShowLeaderboard}
          >
            LEADERBOARD
          </button>
          <button
            type="button"
            className="cod-premium-btn-danger w-full"
            data-ocid="gameover.cancel_button"
            onClick={onMainMenu}
          >
            MAIN MENU
          </button>
        </div>
      </div>
    </div>
  );
}
