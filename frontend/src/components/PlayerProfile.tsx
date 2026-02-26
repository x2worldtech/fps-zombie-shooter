import { useGetOrCreateProfile } from '../hooks/useQueries';
import { useInternetIdentity } from '../hooks/useInternetIdentity';
import { calculateLevel, getProgressToNextLevel, getXpForNextLevel, getXpForCurrentLevel, levelXpThresholds } from '../utils/levelSystem';

interface PlayerProfileProps {
  onBack: () => void;
}

function StatCard({ label, value, icon }: { label: string; value: string | number; icon: string }) {
  return (
    <div
      className="flex flex-col items-center gap-1 px-4 py-3"
      style={{
        background: 'rgba(20,8,0,0.85)',
        border: '2px solid #2a1000',
        boxShadow: '3px 3px 0 #0a0505',
      }}
    >
      <span className="text-2xl">{icon}</span>
      <span
        className="font-bangers text-2xl"
        style={{ color: '#ffcc00', WebkitTextStroke: '1px #0a0505', letterSpacing: '0.05em' }}
      >
        {typeof value === 'number' ? value.toLocaleString() : value}
      </span>
      <span
        className="font-oswald text-xs uppercase tracking-widest text-center"
        style={{ color: '#cc8844' }}
      >
        {label}
      </span>
    </div>
  );
}

export function PlayerProfile({ onBack }: PlayerProfileProps) {
  const { identity } = useInternetIdentity();
  const { data: profile, isLoading, isError } = useGetOrCreateProfile();

  const truncatePrincipal = (principal: string) => {
    if (principal.length <= 16) return principal;
    return `${principal.slice(0, 8)}...${principal.slice(-6)}`;
  };

  const totalXP = profile ? Number(profile.totalPoints) : 0;
  const currentLevel = profile ? Number(profile.currentLevel) : 1;
  const progress = getProgressToNextLevel(totalXP);
  const xpForCurrent = getXpForCurrentLevel(totalXP);
  const xpForNext = getXpForNextLevel(totalXP);
  const isMaxLevel = currentLevel >= 55;

  const xpInCurrentLevel = totalXP - xpForCurrent;
  const xpNeededForLevel = isMaxLevel ? 0 : xpForNext - xpForCurrent;

  return (
    <div
      className="relative w-full h-full flex flex-col items-center justify-center overflow-hidden"
      style={{
        background: 'linear-gradient(180deg, #1a0800 0%, #2d1200 40%, #1a0800 100%)',
      }}
    >
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(8)].map((_, i) => (
          <div
            key={i}
            className="absolute bottom-0"
            style={{
              left: `${i * 13 + 2}%`,
              width: `${60 + (i % 3) * 30}px`,
              height: `${80 + (i % 4) * 60}px`,
              background: 'rgba(10,5,0,0.8)',
              border: '2px solid rgba(20,10,0,0.9)',
            }}
          />
        ))}
        <div
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(ellipse at 50% 30%, rgba(180,80,20,0.2) 0%, transparent 70%)',
          }}
        />
      </div>

      <div
        className="relative z-10 flex flex-col items-center gap-6 px-8 py-8 w-full max-w-lg overflow-y-auto"
        style={{
          background: 'rgba(8,2,0,0.95)',
          border: '4px solid #0a0505',
          boxShadow: '8px 8px 0 #0a0505',
          maxHeight: '90vh',
        }}
      >
        {/* Header */}
        <div className="w-full flex flex-col items-center gap-1">
          <div
            className="font-bangers text-5xl text-center"
            style={{
              color: '#ff8800',
              WebkitTextStroke: '3px #0a0505',
              textShadow: '4px 4px 0 #0a0505',
              letterSpacing: '0.05em',
            }}
          >
            👤 PLAYER PROFILE
          </div>
          {identity && (
            <div
              className="font-oswald text-xs px-3 py-1 mt-1"
              style={{
                background: 'rgba(20,8,0,0.9)',
                border: '1px solid #cc8800',
                color: '#cc8844',
                letterSpacing: '0.05em',
              }}
            >
              {truncatePrincipal(identity.getPrincipal().toString())}
            </div>
          )}
        </div>

        {/* Loading / Error states */}
        {isLoading && (
          <div className="font-bangers text-2xl" style={{ color: '#cc8844', letterSpacing: '0.05em' }}>
            ⏳ LOADING PROFILE...
          </div>
        )}

        {isError && (
          <div className="font-bangers text-xl text-center" style={{ color: '#ff4444' }}>
            ✗ COULD NOT LOAD PROFILE
          </div>
        )}

        {profile && !isLoading && (
          <>
            {/* Level display */}
            <div
              className="w-full flex flex-col items-center gap-3 px-6 py-5"
              style={{
                background: 'rgba(20,8,0,0.85)',
                border: '3px solid #cc8800',
                boxShadow: '4px 4px 0 #0a0505',
              }}
            >
              <div className="flex items-baseline gap-3">
                <span
                  className="font-bangers text-6xl"
                  style={{
                    color: '#ffcc00',
                    WebkitTextStroke: '2px #0a0505',
                    textShadow: '4px 4px 0 #0a0505',
                    letterSpacing: '0.05em',
                  }}
                >
                  LVL {currentLevel}
                </span>
                <span
                  className="font-bangers text-2xl"
                  style={{ color: '#cc8844', letterSpacing: '0.05em' }}
                >
                  / 55
                </span>
              </div>

              {/* XP Progress bar */}
              <div className="w-full flex flex-col gap-1">
                <div className="flex justify-between items-center">
                  <span className="font-oswald text-xs" style={{ color: '#cc8844', letterSpacing: '0.05em' }}>
                    {isMaxLevel ? 'MAX LEVEL' : `XP: ${xpInCurrentLevel.toLocaleString()} / ${xpNeededForLevel.toLocaleString()}`}
                  </span>
                  <span className="font-oswald text-xs" style={{ color: '#ff8800' }}>
                    {isMaxLevel ? '100%' : `${Math.round(progress)}%`}
                  </span>
                </div>
                <div
                  className="w-full h-4 relative overflow-hidden"
                  style={{
                    background: 'rgba(10,5,0,0.9)',
                    border: '2px solid #2a1000',
                    boxShadow: 'inset 2px 2px 0 rgba(0,0,0,0.5)',
                  }}
                >
                  <div
                    className="h-full transition-all duration-500"
                    style={{
                      width: `${isMaxLevel ? 100 : progress}%`,
                      background: isMaxLevel
                        ? 'linear-gradient(90deg, #ffcc00, #ff8800)'
                        : 'linear-gradient(90deg, #ff8800, #ffcc00)',
                      boxShadow: '0 0 8px rgba(255,180,0,0.6)',
                    }}
                  />
                </div>
                {!isMaxLevel && (
                  <div className="text-right">
                    <span className="font-oswald text-xs" style={{ color: '#886644' }}>
                      {(xpForNext - totalXP).toLocaleString()} XP to next level
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Stats grid */}
            <div className="w-full">
              <div
                className="font-bangers text-xl text-center mb-3"
                style={{ color: '#cc8844', letterSpacing: '0.1em' }}
              >
                ── CAREER STATS ──
              </div>
              <div className="grid grid-cols-2 gap-3">
                <StatCard label="Total Kills" value={Number(profile.totalKills)} icon="💀" />
                <StatCard label="Total Rounds" value={Number(profile.totalRounds)} icon="🌊" />
                <StatCard label="Headshots" value={Number(profile.totalHeadshots)} icon="🎯" />
                <StatCard label="Shots Fired" value={Number(profile.totalShots)} icon="🔫" />
                <div className="col-span-2">
                  <StatCard label="Total Points (XP)" value={Number(profile.totalPoints)} icon="⭐" />
                </div>
              </div>
            </div>

            {/* Accuracy stat */}
            {Number(profile.totalShots) > 0 && (
              <div
                className="w-full flex justify-between items-center px-4 py-2"
                style={{
                  background: 'rgba(20,8,0,0.7)',
                  border: '1px solid #2a1000',
                }}
              >
                <span className="font-bangers text-lg" style={{ color: '#cc8844', letterSpacing: '0.05em' }}>
                  HEADSHOT ACCURACY
                </span>
                <span className="font-bangers text-xl" style={{ color: '#ffaa44' }}>
                  {Number(profile.totalShots) > 0
                    ? `${Math.round((Number(profile.totalHeadshots) / Number(profile.totalKills || 1)) * 100)}%`
                    : '—'}
                </span>
              </div>
            )}
          </>
        )}

        {/* Back button */}
        <button
          className="toon-btn toon-btn-red w-full mt-2"
          onClick={onBack}
        >
          ← BACK TO MENU
        </button>
      </div>
    </div>
  );
}
