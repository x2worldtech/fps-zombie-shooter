interface ControlsScreenProps {
  onBack: () => void;
}

const controls = [
  { key: "W A S D", action: "Move" },
  { key: "MOUSE", action: "Look Around" },
  { key: "LEFT CLICK", action: "Shoot" },
  { key: "R", action: "Reload" },
  { key: "SHIFT", action: "Sprint" },
  { key: "SPACE", action: "Jump" },
  { key: "1", action: "Pistol" },
  { key: "2", action: "Shotgun" },
  { key: "3", action: "Assault Rifle" },
  { key: "SCROLL", action: "Switch Weapon" },
  { key: "ESC", action: "Pause / Resume" },
];

export function ControlsScreen({ onBack }: ControlsScreenProps) {
  return (
    <div
      className="relative w-full h-full flex flex-col items-center justify-center overflow-hidden"
      style={{
        background:
          "radial-gradient(ellipse at 50% 30%, rgba(120,10,10,0.12) 0%, #060606 60%)",
      }}
    >
      {/* Subtle scan-line texture */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.04) 2px, rgba(0,0,0,0.04) 4px)",
          zIndex: 0,
        }}
      />

      <div
        className="relative z-10 flex flex-col items-center gap-6 px-10 py-8 w-full max-w-lg"
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
              "0 0 30px rgba(255,100,0,0.25), 0 2px 8px rgba(0,0,0,0.8)",
          }}
        >
          CONTROLS
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

        {/* Control rows */}
        <div className="w-full flex flex-col gap-2">
          {controls.map(({ key, action }) => (
            <div
              key={key}
              className="flex items-center justify-between px-4 py-2"
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.07)",
                transition: "background 0.1s",
              }}
            >
              <span
                style={{
                  fontFamily: "'Oswald', sans-serif",
                  fontWeight: 700,
                  fontSize: "1rem",
                  letterSpacing: "0.1em",
                  color: "#FF7A00",
                  minWidth: "140px",
                  textTransform: "uppercase",
                }}
              >
                {key}
              </span>
              <span
                style={{
                  fontFamily: "'Sora', system-ui, sans-serif",
                  fontWeight: 400,
                  fontSize: "0.875rem",
                  color: "rgba(255,255,255,0.6)",
                  letterSpacing: "0.02em",
                }}
              >
                {action}
              </span>
            </div>
          ))}
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
          data-ocid="controls.back.button"
          onClick={onBack}
        >
          ← BACK
        </button>
      </div>
    </div>
  );
}
