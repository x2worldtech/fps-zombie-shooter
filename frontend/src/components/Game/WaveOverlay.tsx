import { WaveState } from '../../hooks/useWaveSystem';

interface WaveOverlayProps {
  waveState: WaveState;
}

export function WaveOverlay({ waveState }: WaveOverlayProps) {
  if (waveState.phase === 'active' || waveState.phase === 'menu' || waveState.phase === 'gameover') {
    return null;
  }

  return (
    <div
      className="absolute inset-0 flex items-center justify-center pointer-events-none"
      style={{ zIndex: 20 }}
    >
      <div
        className="flex flex-col items-center gap-4 px-12 py-8"
        style={{
          background: 'rgba(10,5,0,0.88)',
          border: '4px solid #0a0505',
          boxShadow: '8px 8px 0 #0a0505',
        }}
      >
        {waveState.phase === 'countdown' && (
          <>
            <div
              className="font-bangers text-5xl"
              style={{
                color: '#ff8800',
                WebkitTextStroke: '2px #0a0505',
                textShadow: '3px 3px 0 #0a0505',
                letterSpacing: '0.05em',
              }}
            >
              WAVE {waveState.wave} INCOMING!
            </div>
            {waveState.hasBoss && (
              <div
                className="font-bangers text-2xl"
                style={{
                  color: '#ff2200',
                  WebkitTextStroke: '1px #0a0505',
                  textShadow: '2px 2px 0 #0a0505',
                }}
              >
                ⚠ BOSS ZOMBIE INCOMING ⚠
              </div>
            )}
            <div
              className="font-bangers text-8xl"
              style={{
                color: '#ffcc00',
                WebkitTextStroke: '3px #0a0505',
                textShadow: '4px 4px 0 #0a0505',
                animation: 'wave-in 0.3s ease-out',
              }}
            >
              {waveState.countdown}
            </div>
            <div className="toon-text text-lg" style={{ color: '#cc8844' }}>
              {waveState.enemyCount} ZOMBIES + {waveState.hasBoss ? '1 BOSS' : '0 BOSSES'}
            </div>
          </>
        )}

        {waveState.phase === 'cleared' && (
          <>
            <div
              className="font-bangers text-6xl"
              style={{
                color: '#44ff44',
                WebkitTextStroke: '2px #0a0505',
                textShadow: '3px 3px 0 #0a0505',
                letterSpacing: '0.05em',
              }}
            >
              WAVE CLEARED!
            </div>
            <div className="toon-text text-xl" style={{ color: '#ffcc88' }}>
              Next wave incoming...
            </div>
          </>
        )}
      </div>
    </div>
  );
}
