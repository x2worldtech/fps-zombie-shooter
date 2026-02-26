import { useLeaderboard } from '../hooks/useLeaderboard';

interface LeaderboardProps {
  onBack: () => void;
}

const RANK_COLORS = ['#ffd700', '#c0c0c0', '#cd7f32'];
const RANK_LABELS = ['🥇', '🥈', '🥉'];

export function Leaderboard({ onBack }: LeaderboardProps) {
  const { leaderboard, isLoading } = useLeaderboard();

  return (
    <div
      className="relative w-full h-full flex flex-col items-center justify-center overflow-hidden"
      style={{
        background: 'linear-gradient(180deg, #1a0800 0%, #2d1200 40%, #1a0800 100%)',
      }}
    >
      <div
        className="flex flex-col items-center gap-5 px-8 py-8 w-full max-w-lg"
        style={{
          background: 'rgba(10,5,0,0.95)',
          border: '4px solid #0a0505',
          boxShadow: '8px 8px 0 #0a0505',
        }}
      >
        {/* Title */}
        <div
          className="font-bangers text-5xl"
          style={{
            color: '#ffcc00',
            WebkitTextStroke: '2px #0a0505',
            textShadow: '4px 4px 0 #0a0505',
            letterSpacing: '0.1em',
          }}
        >
          🏆 LEADERBOARD
        </div>

        {/* Auth notice */}
        <div
          className="w-full flex items-center gap-2 px-3 py-2"
          style={{
            background: 'rgba(40,20,0,0.7)',
            border: '2px dashed #cc8800',
          }}
        >
          <span style={{ fontSize: '1rem' }}>🔒</span>
          <span
            className="font-oswald text-sm"
            style={{ color: '#cc8844' }}
          >
            Only scores from signed-in players are shown on this leaderboard.
          </span>
        </div>

        {/* Header row */}
        <div
          className="w-full grid gap-2 px-3 py-2"
          style={{
            gridTemplateColumns: '40px 1fr 100px 80px',
            background: 'rgba(80,40,0,0.6)',
            border: '2px solid #4a2800',
          }}
        >
          <span className="font-bangers text-sm" style={{ color: '#ff8800' }}>#</span>
          <span className="font-bangers text-sm" style={{ color: '#ff8800' }}>NAME</span>
          <span className="font-bangers text-sm text-right" style={{ color: '#ff8800' }}>SCORE</span>
          <span className="font-bangers text-sm text-right" style={{ color: '#ff8800' }}>WAVE</span>
        </div>

        {/* Entries */}
        <div className="w-full flex flex-col gap-1 max-h-80 overflow-y-auto">
          {isLoading ? (
            <div className="text-center py-8 font-bangers text-2xl" style={{ color: '#cc8844' }}>
              LOADING...
            </div>
          ) : leaderboard.length === 0 ? (
            <div className="text-center py-8 font-bangers text-2xl" style={{ color: '#cc8844' }}>
              NO SCORES YET!
              <div className="font-oswald text-base mt-2" style={{ color: '#886644' }}>
                Be the first to survive the desert!
              </div>
            </div>
          ) : (
            leaderboard.map((entry, i) => (
              <div
                key={i}
                className="w-full grid gap-2 px-3 py-2 items-center"
                style={{
                  gridTemplateColumns: '40px 1fr 100px 80px',
                  background: i < 3 ? `rgba(${i === 0 ? '80,60,0' : i === 1 ? '50,50,50' : '60,35,10'},0.5)` : 'rgba(20,10,0,0.5)',
                  border: `1px solid ${i < 3 ? RANK_COLORS[i] + '44' : '#2a1500'}`,
                }}
              >
                <span
                  className="font-bangers text-xl"
                  style={{ color: i < 3 ? RANK_COLORS[i] : '#886644' }}
                >
                  {i < 3 ? RANK_LABELS[i] : `${i + 1}`}
                </span>
                <span
                  className="font-oswald font-semibold text-base truncate"
                  style={{ color: i < 3 ? RANK_COLORS[i] : '#cc8844' }}
                >
                  {entry.playerName}
                </span>
                <span
                  className="font-bangers text-lg text-right"
                  style={{ color: '#ffcc00' }}
                >
                  {Number(entry.score).toLocaleString()}
                </span>
                <span
                  className="font-bangers text-lg text-right"
                  style={{ color: '#ff8800' }}
                >
                  W{Number(entry.wave)}
                </span>
              </div>
            ))
          )}
        </div>

        <button className="toon-btn toon-btn-red w-48" onClick={onBack}>
          ← BACK
        </button>
      </div>
    </div>
  );
}
