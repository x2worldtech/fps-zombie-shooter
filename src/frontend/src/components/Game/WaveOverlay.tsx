import type { WaveState } from "../../hooks/useWaveSystem";

interface WaveOverlayProps {
  waveState: WaveState;
}

export function WaveOverlay({ waveState }: WaveOverlayProps) {
  if (
    waveState.phase === "active" ||
    waveState.phase === "menu" ||
    waveState.phase === "gameover"
  ) {
    return null;
  }

  return (
    <div
      className="absolute inset-0 flex items-center justify-center pointer-events-none"
      style={{ zIndex: 20 }}
    >
      <div
        className="flex flex-col items-center gap-4 px-14 py-10"
        style={{
          background: "rgba(3,4,10,0.92)",
          border: "1px solid rgba(255,255,255,0.1)",
          boxShadow:
            "0 0 60px rgba(0,0,0,0.9), inset 0 1px 0 rgba(255,255,255,0.04)",
        }}
      >
        {waveState.phase === "countdown" && (
          <>
            <div
              style={{
                fontFamily: "'Oswald', sans-serif",
                fontWeight: 700,
                fontSize: "clamp(1.8rem, 3.5vw, 2.8rem)",
                letterSpacing: "0.18em",
                color: "#8b0000",
                textTransform: "uppercase",
                textShadow:
                  "0 0 20px rgba(139,0,0,0.6), 2px 2px 8px rgba(0,0,0,0.95)",
              }}
            >
              ROUND {waveState.wave}
            </div>
            <div
              style={{
                fontFamily: "'Oswald', sans-serif",
                fontWeight: 700,
                fontSize: "clamp(5rem, 12vw, 9rem)",
                lineHeight: 1,
                letterSpacing: "0.05em",
                color: "rgba(255,255,255,0.92)",
                textTransform: "uppercase",
                textShadow: "2px 2px 20px rgba(0,0,0,0.95)",
                animation: "wave-in 0.3s ease-out",
              }}
            >
              {waveState.countdown}
            </div>
          </>
        )}

        {waveState.phase === "cleared" && (
          <>
            <div
              style={{
                fontFamily: "'Oswald', sans-serif",
                fontWeight: 700,
                fontSize: "clamp(2.5rem, 5vw, 4rem)",
                letterSpacing: "0.12em",
                color: "rgba(255,255,255,0.92)",
                textTransform: "uppercase",
                textShadow:
                  "0 0 20px rgba(60,200,60,0.4), 2px 2px 10px rgba(0,0,0,0.95)",
              }}
            >
              ROUND CLEAR
            </div>
            <div
              style={{
                fontFamily: "'Oswald', sans-serif",
                fontWeight: 400,
                fontSize: "1rem",
                letterSpacing: "0.25em",
                color: "rgba(255,255,255,0.35)",
                textTransform: "uppercase",
              }}
            >
              Next round incoming...
            </div>
          </>
        )}
      </div>
    </div>
  );
}
