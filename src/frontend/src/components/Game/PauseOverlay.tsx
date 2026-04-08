interface PauseOverlayProps {
  onResume: () => void;
}

export function PauseOverlay({ onResume }: PauseOverlayProps) {
  return (
    <div
      className="absolute inset-0 flex items-center justify-center"
      style={{
        background: "rgba(3,4,10,0.88)",
        zIndex: 50,
      }}
    >
      <div
        className="flex flex-col items-center gap-8 px-16 py-12"
        style={{
          background: "rgba(5,6,14,0.97)",
          border: "1px solid rgba(255,255,255,0.12)",
          boxShadow:
            "0 0 60px rgba(0,0,0,0.9), inset 0 1px 0 rgba(255,255,255,0.05)",
        }}
      >
        <div
          style={{
            fontFamily: "'Oswald', sans-serif",
            fontWeight: 700,
            fontSize: "clamp(3rem, 6vw, 4.5rem)",
            letterSpacing: "0.12em",
            color: "rgba(255,255,255,0.92)",
            textTransform: "uppercase",
            textShadow: "2px 2px 16px rgba(0,0,0,0.95)",
          }}
        >
          PAUSED
        </div>
        <div
          style={{
            fontFamily: "'Oswald', sans-serif",
            fontWeight: 400,
            fontSize: "1rem",
            letterSpacing: "0.22em",
            color: "rgba(255,255,255,0.35)",
            textTransform: "uppercase",
          }}
        >
          Press ESC or click to resume
        </div>
        <button
          type="button"
          className="cod-premium-btn"
          style={{
            fontSize: "1rem",
            padding: "12px 40px",
            letterSpacing: "0.18em",
          }}
          onClick={onResume}
        >
          RESUME
        </button>
      </div>
    </div>
  );
}
