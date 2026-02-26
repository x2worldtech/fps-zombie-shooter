import { useState, useEffect, useRef } from 'react';
import { useLeaderboard } from '../hooks/useLeaderboard';
import { useUpdateProfile } from '../hooks/useQueries';
import { useInternetIdentity } from '../hooks/useInternetIdentity';

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
  const updateProfile = useUpdateProfile();
  const statsSavedRef = useRef(false);

  const isAuthenticated = !!identity;

  // Submit session stats to backend when authenticated
  useEffect(() => {
    if (!isAuthenticated || statsSavedRef.current) return;
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
        },
      }
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
          background: 'radial-gradient(ellipse at 50% 50%, rgba(150,0,0,0.15) 0%, transparent 70%)',
        }}
      />

      <div
        className="relative z-10 flex flex-col items-center gap-6 px-10 py-8 w-full max-w-md"
        style={{
          background: 'rgba(8,2,0,0.95)',
          border: '4px solid #0a0505',
          boxShadow: '8px 8px 0 #0a0505',
        }}
      >
        {/* Title */}
        <div
          className="font-bangers text-7xl text-center"
          style={{
            color: '#cc0000',
            WebkitTextStroke: '3px #0a0505',
            textShadow: '5px 5px 0 #0a0505',
            letterSpacing: '0.05em',
          }}
        >
          GAME OVER
        </div>

        {/* Stats */}
        <div
          className="w-full flex flex-col gap-3 px-4 py-4"
          style={{
            background: 'rgba(20,8,0,0.8)',
            border: '2px solid #2a1000',
          }}
        >
          <div className="flex justify-between items-center">
            <span className="font-bangers text-2xl" style={{ color: '#ff8800', letterSpacing: '0.05em' }}>
              FINAL SCORE
            </span>
            <span className="font-bangers text-3xl" style={{ color: '#ffcc00', WebkitTextStroke: '1px #0a0505' }}>
              {score.toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="font-bangers text-2xl" style={{ color: '#ff8800', letterSpacing: '0.05em' }}>
              WAVE REACHED
            </span>
            <span className="font-bangers text-3xl" style={{ color: '#ffcc00', WebkitTextStroke: '1px #0a0505' }}>
              {wave}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="font-bangers text-xl" style={{ color: '#cc8844', letterSpacing: '0.05em' }}>
              KILLS
            </span>
            <span className="font-bangers text-2xl" style={{ color: '#ffaa44' }}>
              {kills}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="font-bangers text-xl" style={{ color: '#cc8844', letterSpacing: '0.05em' }}>
              HEADSHOTS
            </span>
            <span className="font-bangers text-2xl" style={{ color: '#ffaa44' }}>
              {headshots}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="font-bangers text-xl" style={{ color: '#cc8844', letterSpacing: '0.05em' }}>
              SHOTS FIRED
            </span>
            <span className="font-bangers text-2xl" style={{ color: '#ffaa44' }}>
              {shotsFired}
            </span>
          </div>
        </div>

        {/* Stats saved indicator */}
        {isAuthenticated && (
          <div className="w-full text-center">
            {updateProfile.isPending && (
              <span className="font-bangers text-lg" style={{ color: '#aaaaaa', letterSpacing: '0.05em' }}>
                ⏳ SAVING STATS...
              </span>
            )}
            {statsSaved && (
              <span className="font-bangers text-lg" style={{ color: '#44ff88', WebkitTextStroke: '1px #0a0505' }}>
                ✓ STATS SAVED!
              </span>
            )}
            {statsSaveError && (
              <span className="font-bangers text-lg" style={{ color: '#ff4444' }}>
                ✗ COULD NOT SAVE STATS
              </span>
            )}
          </div>
        )}

        {/* Score submission — authenticated only */}
        {isAuthenticated ? (
          !submitted ? (
            <div className="w-full flex flex-col gap-3">
              <div
                className="font-bangers text-xl text-center"
                style={{ color: '#cc8844', letterSpacing: '0.05em' }}
              >
                ENTER YOUR NAME
              </div>
              <input
                type="text"
                value={playerName}
                onChange={e => setPlayerName(e.target.value.slice(0, 16))}
                onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); }}
                placeholder="YOUR NAME (max 16)"
                maxLength={16}
                className="w-full px-4 py-2 text-center font-oswald text-lg"
                style={{
                  background: 'rgba(30,15,0,0.9)',
                  border: '3px solid #cc8800',
                  color: '#ffcc88',
                  outline: 'none',
                  boxShadow: '3px 3px 0 #0a0505',
                }}
              />
              <button
                className="toon-btn toon-btn-yellow w-full"
                onClick={handleSubmit}
                disabled={isSubmitting || !playerName.trim()}
                style={{ opacity: (!playerName.trim() || isSubmitting) ? 0.5 : 1 }}
              >
                {isSubmitting ? 'SUBMITTING...' : '📤 SUBMIT SCORE'}
              </button>
            </div>
          ) : (
            <div
              className="font-bangers text-2xl text-center"
              style={{ color: '#44ff44', WebkitTextStroke: '1px #0a0505' }}
            >
              ✓ SCORE SUBMITTED!
            </div>
          )
        ) : (
          /* Unauthenticated — prompt to sign in */
          <div
            className="w-full flex flex-col items-center gap-2 px-4 py-4"
            style={{
              background: 'rgba(30,15,0,0.7)',
              border: '2px dashed #cc8800',
            }}
          >
            <span
              className="font-bangers text-2xl text-center"
              style={{ color: '#ffcc00', WebkitTextStroke: '1px #0a0505', letterSpacing: '0.05em' }}
            >
              🔒 LEADERBOARD LOCKED
            </span>
            <span
              className="font-oswald text-sm text-center"
              style={{ color: '#cc8844' }}
            >
              Sign in with Internet Identity to submit your score to the leaderboard and save your stats!
            </span>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex flex-col gap-3 w-full">
          <button className="toon-btn toon-btn-yellow w-full" onClick={onRetry}>
            🔄 RETRY
          </button>
          <button className="toon-btn w-full" onClick={onShowLeaderboard}>
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
