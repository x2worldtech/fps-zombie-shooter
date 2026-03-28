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

function StatCard({
  label,
  value,
  icon,
}: { label: string; value: string | number; icon: string }) {
  return (
    <div
      className="flex flex-col items-center gap-1 px-4 py-3"
      style={{
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.09)",
        boxShadow: "0 4px 16px rgba(0,0,0,0.5)",
      }}
    >
      <span style={{ fontSize: "1.25rem", lineHeight: 1 }}>{icon}</span>
      <span
        style={{
          fontFamily: "'Oswald', sans-serif",
          fontWeight: 700,
          fontSize: "1.6rem",
          color: "#FF7A00",
          letterSpacing: "0.04em",
          lineHeight: 1.1,
        }}
      >
        {typeof value === "number" ? value.toLocaleString() : value}
      </span>
      <span
        style={{
          fontFamily: "'Sora', system-ui, sans-serif",
          fontWeight: 400,
          fontSize: "0.7rem",
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "rgba(255,255,255,0.4)",
          textAlign: "center",
        }}
      >
        {label}
      </span>
    </div>
  );
}

export function PlayerProfile({ onBack }: PlayerProfileProps) {
  const { identity } = useInternetIdentity();
  const { data: profile, isLoading, isError } = useGetOrCreateProfile();

  const truncatePrincipal = (principal: string) => {
    if (principal.length <= 16) return principal;
    return `${principal.slice(0, 8)}...${principal.slice(-6)}`;
  };

  const totalXP = profile ? Number(profile.totalPoints) : 0;
  const currentLevel = profile ? Number(profile.currentLevel) : 1;
  const progress = getProgressToNextLevel(totalXP);
  const xpForCurrent = getXpForCurrentLevel(totalXP);
  const xpForNext = getXpForNextLevel(totalXP);
  const isMaxLevel = currentLevel >= 55;

  const xpInCurrentLevel = totalXP - xpForCurrent;
  const xpNeededForLevel = isMaxLevel ? 0 : xpForNext - xpForCurrent;

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
        className="relative z-10 flex flex-col items-center gap-5 px-8 py-8 w-full max-w-lg overflow-y-auto"
        style={{
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.1)",
          boxShadow:
            "0 4px 40px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.04)",
          maxHeight: "90vh",
        }}
      >
        {/* Header */}
        <div className="w-full flex flex-col items-center gap-2">
          <div
            style={{
              fontFamily: "'Oswald', sans-serif",
              fontWeight: 700,
              fontSize: "2.6rem",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.95)",
              textShadow:
                "0 0 30px rgba(255,100,0,0.25), 0 2px 8px rgba(0,0,0,0.8)",
            }}
          >
            PLAYER PROFILE
          </div>

          {identity && (
            <div
              style={{
                fontFamily: "'Sora', system-ui, sans-serif",
                fontSize: "0.72rem",
                padding: "4px 12px",
                background: "rgba(255,122,0,0.08)",
                border: "1px solid rgba(255,122,0,0.3)",
                color: "rgba(255,122,0,0.75)",
                letterSpacing: "0.05em",
              }}
            >
              {truncatePrincipal(identity.getPrincipal().toString())}
            </div>
          )}
        </div>

        {/* Divider */}
        <div
          style={{
            width: "100%",
            height: "1px",
            background:
              "linear-gradient(90deg, transparent, rgba(255,122,0,0.5), transparent)",
          }}
        />

        {/* Loading / Error states */}
        {isLoading && (
          <div
            data-ocid="profile.loading_state"
            style={{
              fontFamily: "'Sora', system-ui, sans-serif",
              fontSize: "1rem",
              color: "rgba(255,255,255,0.5)",
              letterSpacing: "0.05em",
              animation: "pulse 1.5s ease-in-out infinite",
            }}
          >
            LOADING PROFILE...
          </div>
        )}

        {isError && (
          <div
            data-ocid="profile.error_state"
            style={{
              fontFamily: "'Sora', system-ui, sans-serif",
              fontSize: "0.9rem",
              color: "#ff4444",
              textAlign: "center",
            }}
          >
            COULD NOT LOAD PROFILE
          </div>
        )}

        {profile && !isLoading && (
          <>
            {/* Level display */}
            <div
              className="w-full flex flex-col items-center gap-3 px-6 py-5"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,122,0,0.25)",
                boxShadow: "0 0 20px rgba(255,122,0,0.06)",
              }}
            >
              <div className="flex items-baseline gap-3">
                <span
                  style={{
                    fontFamily: "'Oswald', sans-serif",
                    fontWeight: 700,
                    fontSize: "4rem",
                    color: "#FF7A00",
                    letterSpacing: "0.04em",
                    lineHeight: 1,
                    textShadow: "0 0 20px rgba(255,122,0,0.4)",
                  }}
                >
                  LVL {currentLevel}
                </span>
                <span
                  style={{
                    fontFamily: "'Oswald', sans-serif",
                    fontWeight: 400,
                    fontSize: "1.4rem",
                    color: "rgba(255,255,255,0.3)",
                  }}
                >
                  / 55
                </span>
              </div>

              {/* XP Progress bar */}
              <div className="w-full flex flex-col gap-1">
                <div className="flex justify-between items-center">
                  <span
                    style={{
                      fontFamily: "'Sora', system-ui, sans-serif",
                      fontSize: "0.72rem",
                      color: "rgba(255,255,255,0.45)",
                      letterSpacing: "0.04em",
                    }}
                  >
                    {isMaxLevel
                      ? "MAX LEVEL"
                      : `XP: ${xpInCurrentLevel.toLocaleString()} / ${xpNeededForLevel.toLocaleString()}`}
                  </span>
                  <span
                    style={{
                      fontFamily: "'Oswald', sans-serif",
                      fontWeight: 600,
                      fontSize: "0.8rem",
                      color: "#FF7A00",
                    }}
                  >
                    {isMaxLevel ? "100%" : `${Math.round(progress)}%`}
                  </span>
                </div>
                {/* Track */}
                <div
                  className="w-full relative overflow-hidden"
                  style={{
                    height: "6px",
                    background: "rgba(255,255,255,0.07)",
                    border: "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  <div
                    className="h-full transition-all duration-500"
                    style={{
                      width: `${isMaxLevel ? 100 : progress}%`,
                      background: isMaxLevel
                        ? "linear-gradient(90deg, #FF7A00, #ffcc00)"
                        : "linear-gradient(90deg, #cc4400, #FF7A00)",
                      boxShadow: "0 0 8px rgba(255,122,0,0.5)",
                    }}
                  />
                </div>
                {!isMaxLevel && (
                  <div className="text-right">
                    <span
                      style={{
                        fontFamily: "'Sora', system-ui, sans-serif",
                        fontSize: "0.68rem",
                        color: "rgba(255,255,255,0.28)",
                      }}
                    >
                      {(xpForNext - totalXP).toLocaleString()} XP to next level
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Stats label */}
            <div
              style={{
                fontFamily: "'Oswald', sans-serif",
                fontWeight: 600,
                fontSize: "0.75rem",
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                color: "rgba(255,255,255,0.3)",
                alignSelf: "flex-start",
              }}
            >
              CAREER STATS
            </div>

            {/* Stats grid */}
            <div className="w-full grid grid-cols-2 gap-2">
              <StatCard
                label="Total Kills"
                value={Number(profile.totalKills)}
                icon="💀"
              />
              <StatCard
                label="Total Rounds"
                value={Number(profile.totalRounds)}
                icon="🌊"
              />
              <StatCard
                label="Headshots"
                value={Number(profile.totalHeadshots)}
                icon="🎯"
              />
              <StatCard
                label="Shots Fired"
                value={Number(profile.totalShots)}
                icon="🔫"
              />
              <div className="col-span-2">
                <StatCard
                  label="Total Points (XP)"
                  value={Number(profile.totalPoints)}
                  icon="⭐"
                />
              </div>
            </div>

            {/* Accuracy stat */}
            {Number(profile.totalShots) > 0 && (
              <div
                className="w-full flex justify-between items-center px-4 py-2"
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.07)",
                }}
              >
                <span
                  style={{
                    fontFamily: "'Oswald', sans-serif",
                    fontWeight: 600,
                    fontSize: "0.85rem",
                    letterSpacing: "0.08em",
                    color: "rgba(255,255,255,0.5)",
                    textTransform: "uppercase",
                  }}
                >
                  Headshot Accuracy
                </span>
                <span
                  style={{
                    fontFamily: "'Oswald', sans-serif",
                    fontWeight: 700,
                    fontSize: "1.1rem",
                    color: "#FF7A00",
                  }}
                >
                  {Number(profile.totalShots) > 0
                    ? `${Math.round((Number(profile.totalHeadshots) / Number(profile.totalKills || 1)) * 100)}%`
                    : "—"}
                </span>
              </div>
            )}
          </>
        )}

        {/* Divider */}
        <div
          style={{
            width: "100%",
            height: "1px",
            background:
              "linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)",
          }}
        />

        {/* Back button */}
        <button
          type="button"
          className="cod-premium-btn-danger w-full"
          data-ocid="profile.back.button"
          onClick={onBack}
        >
          ← BACK TO MENU
        </button>
      </div>
    </div>
  );
}
