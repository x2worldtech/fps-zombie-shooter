export function SniperScope() {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        pointerEvents: "none",
        userSelect: "none",
      }}
    >
      {/* SVG overlay: black surround with circular aperture */}
      <svg
        width="100%"
        height="100%"
        style={{ position: "absolute", inset: 0 }}
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="Sniper scope overlay"
      >
        <defs>
          <mask id="scope-mask">
            {/* White = visible, Black = hidden */}
            <rect width="100%" height="100%" fill="white" />
            <circle cx="50%" cy="50%" r="38vh" fill="black" />
          </mask>
          <radialGradient id="scope-vignette" cx="50%" cy="50%" r="50%">
            <stop offset="70%" stopColor="black" stopOpacity="0" />
            <stop offset="100%" stopColor="black" stopOpacity="0.85" />
          </radialGradient>
        </defs>

        {/* Black surround outside the circle */}
        <rect width="100%" height="100%" fill="black" mask="url(#scope-mask)" />

        {/* Vignette inside the circle */}
        <circle cx="50%" cy="50%" r="38vh" fill="url(#scope-vignette)" />

        {/* Outer scope ring */}
        <circle
          cx="50%"
          cy="50%"
          r="38vh"
          fill="none"
          stroke="rgba(180,180,180,0.6)"
          strokeWidth="2"
        />
        {/* Inner reticle ring */}
        <circle
          cx="50%"
          cy="50%"
          r="5vh"
          fill="none"
          stroke="rgba(200,230,200,0.5)"
          strokeWidth="0.8"
        />

        {/* Crosshair lines */}
        {/* Horizontal left */}
        <line
          x1="calc(50% - 38vh)"
          y1="50%"
          x2="calc(50% - 6vh)"
          y2="50%"
          stroke="rgba(220,240,220,0.9)"
          strokeWidth="1"
        />
        {/* Horizontal right */}
        <line
          x1="calc(50% + 6vh)"
          y1="50%"
          x2="calc(50% + 38vh)"
          y2="50%"
          stroke="rgba(220,240,220,0.9)"
          strokeWidth="1"
        />
        {/* Vertical top */}
        <line
          x1="50%"
          y1="calc(50% - 38vh)"
          x2="50%"
          y2="calc(50% - 6vh)"
          stroke="rgba(220,240,220,0.9)"
          strokeWidth="1"
        />
        {/* Vertical bottom */}
        <line
          x1="50%"
          y1="calc(50% + 6vh)"
          x2="50%"
          y2="calc(50% + 38vh)"
          stroke="rgba(220,240,220,0.9)"
          strokeWidth="1"
        />

        {/* Mil-dots on horizontal axis */}
        {[-28, -20, -12, 12, 20, 28].map((vhOffset) => (
          <circle
            key={`h-${vhOffset}`}
            cx={`calc(50% + ${vhOffset}vh)`}
            cy="50%"
            r="2"
            fill="rgba(220,240,220,0.8)"
          />
        ))}
        {/* Mil-dots on vertical axis */}
        {[-28, -20, -12, 12, 20, 28].map((vhOffset) => (
          <circle
            key={`v-${vhOffset}`}
            cx="50%"
            cy={`calc(50% + ${vhOffset}vh)`}
            r="2"
            fill="rgba(220,240,220,0.8)"
          />
        ))}

        {/* Center dot */}
        <circle cx="50%" cy="50%" r="1.5" fill="rgba(255,80,80,0.9)" />

        {/* Elevation turret markings (small ticks on right side) */}
        {[-3, -2, -1, 0, 1, 2, 3].map((n) => (
          <line
            key={`et-${n}`}
            x1={`calc(50% + 38vh - ${n === 0 ? 16 : 10}px)`}
            y1={`calc(50% + ${n * 4}vh)`}
            x2="calc(50% + 38vh)"
            y2={`calc(50% + ${n * 4}vh)`}
            stroke="rgba(200,220,200,0.5)"
            strokeWidth="0.8"
          />
        ))}

        {/* Lens scratch / dust overlay */}
        <circle
          cx="calc(50% - 8vh)"
          cy="calc(50% - 14vh)"
          r="0.3vh"
          fill="rgba(255,255,255,0.05)"
        />
        <circle
          cx="calc(50% + 15vh)"
          cy="calc(50% + 10vh)"
          r="0.2vh"
          fill="rgba(255,255,255,0.04)"
        />
      </svg>

      {/* Lens tint */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          width: "76vh",
          height: "76vh",
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(10,30,10,0.08) 0%, rgba(0,15,5,0.18) 100%)",
          pointerEvents: "none",
        }}
      />

      {/* Dividing lines (scope tube cross-shadow) */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(to right, transparent calc(50% - 0.5px), rgba(0,0,0,0.2) calc(50% - 0.5px), rgba(0,0,0,0.2) calc(50% + 0.5px), transparent calc(50% + 0.5px))",
          pointerEvents: "none",
          mixBlendMode: "multiply",
        }}
      />
    </div>
  );
}
