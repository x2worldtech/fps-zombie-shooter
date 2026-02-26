interface ControlsScreenProps {
  onBack: () => void;
}

const controls = [
  { key: 'W A S D', action: 'Move' },
  { key: 'MOUSE', action: 'Look Around' },
  { key: 'LEFT CLICK', action: 'Shoot' },
  { key: 'R', action: 'Reload' },
  { key: 'SHIFT', action: 'Sprint' },
  { key: 'SPACE', action: 'Jump' },
  { key: '1', action: 'Pistol' },
  { key: '2', action: 'Shotgun' },
  { key: '3', action: 'Assault Rifle' },
  { key: 'SCROLL', action: 'Switch Weapon' },
  { key: 'ESC', action: 'Pause / Resume' },
];

export function ControlsScreen({ onBack }: ControlsScreenProps) {
  return (
    <div
      className="relative w-full h-full flex flex-col items-center justify-center overflow-hidden"
      style={{
        background: 'linear-gradient(180deg, #1a0800 0%, #2d1200 40%, #1a0800 100%)',
      }}
    >
      <div
        className="flex flex-col items-center gap-6 px-10 py-8 w-full max-w-lg"
        style={{
          background: 'rgba(10,5,0,0.92)',
          border: '4px solid #0a0505',
          boxShadow: '8px 8px 0 #0a0505',
        }}
      >
        <div
          className="font-bangers text-5xl"
          style={{
            color: '#ff8800',
            WebkitTextStroke: '2px #0a0505',
            textShadow: '4px 4px 0 #0a0505',
            letterSpacing: '0.1em',
          }}
        >
          CONTROLS
        </div>

        <div className="w-full flex flex-col gap-2">
          {controls.map(({ key, action }) => (
            <div
              key={key}
              className="flex items-center justify-between px-4 py-2"
              style={{
                background: 'rgba(30,15,0,0.8)',
                border: '2px solid #2a1500',
              }}
            >
              <span
                className="font-bangers text-xl"
                style={{
                  color: '#ffcc00',
                  WebkitTextStroke: '1px #0a0505',
                  letterSpacing: '0.05em',
                  minWidth: '140px',
                }}
              >
                {key}
              </span>
              <span
                className="toon-text text-base"
                style={{ color: '#cc8844' }}
              >
                {action}
              </span>
            </div>
          ))}
        </div>

        <button className="toon-btn toon-btn-red w-48" onClick={onBack}>
          ← BACK
        </button>
      </div>
    </div>
  );
}
