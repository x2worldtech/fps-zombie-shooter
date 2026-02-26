interface PauseOverlayProps {
  onResume: () => void;
}

export function PauseOverlay({ onResume }: PauseOverlayProps) {
  return (
    <div
      className="absolute inset-0 flex items-center justify-center"
      style={{
        background: 'rgba(5,2,0,0.85)',
        zIndex: 50,
      }}
    >
      <div
        className="flex flex-col items-center gap-6 px-16 py-10"
        style={{
          background: 'rgba(15,8,0,0.95)',
          border: '4px solid #0a0505',
          boxShadow: '8px 8px 0 #0a0505',
        }}
      >
        <div
          className="font-bangers text-7xl"
          style={{
            color: '#ff8800',
            WebkitTextStroke: '3px #0a0505',
            textShadow: '4px 4px 0 #0a0505',
            letterSpacing: '0.1em',
          }}
        >
          PAUSED
        </div>
        <div className="toon-text text-xl" style={{ color: '#cc8844' }}>
          Press ESC or click to resume
        </div>
        <button className="toon-btn" onClick={onResume}>
          RESUME
        </button>
      </div>
    </div>
  );
}
