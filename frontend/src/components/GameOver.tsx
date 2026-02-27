import { useState, useEffect, useRef } from 'react';
import { useLeaderboard } from '../hooks/useLeaderboard';
import { useUpdateProfile } from '../hooks/useQueries';
import { useInternetIdentity } from '../hooks/useInternetIdentity';
import { useActor } from '../hooks/useActor';

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
  const [playerName, setPlayerName] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [statsSaved, setStatsSaved] = useState(false);
  const [statsSaveError, setStatsSaveError] = useState(false);
  const { submitScore, isSubmitting } = useLeaderboard();
  const { identity } = useInternetIdentity();
  const { actor, isFetching: actorFetching } = useActor();
  const updateProfile = useUpdateProfile();
  const statsSavedRef = useRef(false);

  const isAuthenticated = !!identity;
  const actorReady = !!actor && !actorFetching;

  // Submit session stats to backend when authenticated and actor is ready
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
          // Allow retry if it failed
          statsSavedRef.current = false;
        },
      }
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, actorReady]);

  const handleSubmit = async () => {
    if (!isAuthenticated || !playerName.trim()) return;
    const name = playerName.trim().slice(0, 16);
    try {
      await submitScore({ name, score, wave });
      setSubmitted(true);
    } catch (err) {
      console.error('Failed to submit score:', err);
    }
  };

  return (
    <div
      className="relative w-full h-full flex flex-col items-center justify-center overflow-hidden"
      style={{
        background: 'linear-gradient(180deg, #0a0000 0%, #1a0500 50%, #0a0000 100%)',
      }}
    >
      {/* Blood splatter effect */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at 50% 0%, rgba(120,0,0,0.4) 0%, transparent 60%)',
        }}
      />

      <div
        className="relative z-10 flex flex-col items-center gap-5 px-8 py-8 w-full max-w-md"
        style={{
          background: 'rgba(8,0,0,0.97)',
          border: '4px solid #0a0505',
          boxShadow: '8px 8px 0 #0a0505',
        }}
      >
        {/* Title */}
        <div
          className="font-bangers text-6xl text-center"
          style={{
            color: '#ff2200',
            WebkitTextStroke: '3px #0a0505',
            textShadow: '4px 4px 0 #0a0505',
            letterSpacing: '0.05em',
          }}
        >
          GAME OVER
        </div>

        {/* Stats */}
        <div
          className="w-full grid grid-cols-2 gap-3"
          style={{
            background: 'rgba(20,5,0,0.8)',
            border: '2px solid #2a0a00',
            padding: '12px',
          }}
        >
          <div className="flex flex-col items-center">
            <span className="font-bangers text-3xl" style={{ color: '#ffcc00', WebkitTextStroke: '1px #0a0505' }}>
              {score.toLocaleString()}
            </span>
            <span className="font-oswald text-xs uppercase tracking-widest" style={{ color: '#cc8844' }}>Score</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="font-bangers text-3xl" style={{ color: '#ff8800', WebkitTextStroke: '1px #0a0505' }}>
              {wave}
            </span>
            <span className="font-oswald text-xs uppercase tracking-widest" style={{ color: '#cc8844' }}>Wave</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="font-bangers text-3xl" style={{ color: '#ff4444', WebkitTextStroke: '1px #0a0505' }}>
              {kills}
            </span>
            <span className="font-oswald text-xs uppercase tracking-widest" style={{ color: '#cc8844' }}>Kills</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="font-bangers text-3xl" style={{ color: '#44ff88', WebkitTextStroke: '1px #0a0505' }}>
              {headshots}
            </span>
            <span className="font-oswald text-xs uppercase tracking-widest" style={{ color: '#cc8844' }}>Headshots</span>
          </div>
        </div>

        {/* Stats save status */}
        {isAuthenticated && (
          <div className="w-full">
            {!statsSaved && !statsSaveError && (
              <div
                className="w-full flex items-center justify-center gap-2 px-3 py-2"
                style={{ background: 'rgba(20,10,0,0.7)', border: '1px solid #2a1500' }}
              >
                <span className="font-oswald text-sm animate-pulse" style={{ color: '#cc8844' }}>
                  ⏳ Saving stats...
                </span>
              </div>
            )}
            {statsSaved && (
              <div
                className="w-full flex items-center justify-center gap-2 px-3 py-2"
                style={{ background: 'rgba(0,30,0,0.7)', border: '1px solid #004400' }}
              >
                <span className="font-oswald text-sm" style={{ color: '#44ff88' }}>
                  ✓ Stats saved to your profile!
                </span>
              </div>
            )}
            {statsSaveError && (
              <div
                className="w-full flex items-center justify-center gap-2 px-3 py-2"
                style={{ background: 'rgba(30,0,0,0.7)', border: '1px solid #440000' }}
              >
                <span className="font-oswald text-sm" style={{ color: '#ff4444' }}>
                  ✗ Could not save stats. Try again later.
                </span>
              </div>
            )}
          </div>
        )}

        {/* Score submission */}
        {isAuthenticated ? (
          !submitted ? (
            <div className="w-full flex flex-col gap-3">
              <div
                className="font-bangers text-xl text-center"
                style={{ color: '#ffcc00', letterSpacing: '0.05em' }}
              >
                SUBMIT YOUR SCORE
              </div>
              <input
                type="text"
                maxLength={16}
                placeholder="ENTER NAME (max 16 chars)"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                className="w-full px-3 py-2 font-oswald text-base outline-none"
                style={{
                  background: 'rgba(20,8,0,0.9)',
                  border: '2px solid #cc8800',
                  color: '#ffcc00',
                  letterSpacing: '0.05em',
                }}
              />
              <button
                className="toon-btn toon-btn-yellow w-full"
                onClick={handleSubmit}
                disabled={isSubmitting || !playerName.trim()}
              >
                {isSubmitting ? '⏳ SUBMITTING...' : '🏆 SUBMIT SCORE'}
              </button>
            </div>
          ) : (
            <div
              className="w-full flex items-center justify-center gap-2 px-3 py-3"
              style={{ background: 'rgba(0,30,0,0.7)', border: '2px solid #004400' }}
            >
              <span className="font-bangers text-xl" style={{ color: '#44ff88', letterSpacing: '0.05em' }}>
                ✓ SCORE SUBMITTED!
              </span>
            </div>
          )
        ) : (
          <div
            className="w-full flex flex-col items-center gap-2 px-3 py-3"
            style={{ background: 'rgba(20,8,0,0.7)', border: '2px dashed #cc8800' }}
          >
            <span style={{ fontSize: '1.5rem' }}>🔒</span>
            <span className="font-oswald text-sm text-center" style={{ color: '#cc8844' }}>
              Sign in to submit your score to the leaderboard and save your stats!
            </span>
          </div>
        )}

        {/* Action buttons */}
        <div className="w-full flex flex-col gap-2">
          <button className="toon-btn toon-btn-green w-full" onClick={onRetry}>
            🔄 PLAY AGAIN
          </button>
          <button className="toon-btn toon-btn-yellow w-full" onClick={onShowLeaderboard}>
            🏆 LEADERBOARD
          </button>
          <button className="toon-btn toon-btn-red w-full" onClick={onMainMenu}>
            🏠 MAIN MENU
          </button>
        </div>
      </div>
    </div>
  );
}
