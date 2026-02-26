import { useInternetIdentity } from '../hooks/useInternetIdentity';
import { useQueryClient } from '@tanstack/react-query';

interface MainMenuProps {
  onStartGame: () => void;
  onShowLeaderboard: () => void;
  onShowControls: () => void;
  onShowProfile: () => void;
}

export function MainMenu({ onStartGame, onShowLeaderboard, onShowControls, onShowProfile }: MainMenuProps) {
  const { login, clear, loginStatus, identity } = useInternetIdentity();
  const queryClient = useQueryClient();
  const isAuthenticated = !!identity;
  const isLoggingIn = loginStatus === 'logging-in';

  const handleAuth = async () => {
    if (isAuthenticated) {
      await clear();
      queryClient.clear();
    } else {
      try {
        await login();
      } catch (error: any) {
        if (error?.message === 'User is already authenticated') {
          await clear();
          setTimeout(() => login(), 300);
        }
      }
    }
  };

  const truncatePrincipal = (principal: string) => {
    if (principal.length <= 12) return principal;
    return `${principal.slice(0, 6)}...${principal.slice(-4)}`;
  };

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
            background: 'radial-gradient(ellipse at 50% 30%, rgba(180,80,20,0.3) 0%, transparent 70%)',
          }}
        />
      </div>

      {/* Auth panel — top right */}
      <div className="absolute top-4 right-4 z-20 flex flex-col items-end gap-2">
        {isAuthenticated && identity && (
          <div
            className="font-oswald text-xs px-3 py-1"
            style={{
              background: 'rgba(8,2,0,0.9)',
              border: '2px solid #cc8800',
              color: '#ffcc88',
              boxShadow: '3px 3px 0 #0a0505',
              letterSpacing: '0.05em',
            }}
          >
            🔑 {truncatePrincipal(identity.getPrincipal().toString())}
          </div>
        )}
        <button
          onClick={handleAuth}
          disabled={isLoggingIn}
          className="font-bangers text-base px-4 py-2 transition-all"
          style={{
            background: isAuthenticated ? 'rgba(30,10,0,0.9)' : 'rgba(180,80,0,0.85)',
            border: `2px solid ${isAuthenticated ? '#cc4400' : '#ff8800'}`,
            color: isAuthenticated ? '#ff6644' : '#ffcc00',
            boxShadow: '3px 3px 0 #0a0505',
            letterSpacing: '0.08em',
            opacity: isLoggingIn ? 0.6 : 1,
            cursor: isLoggingIn ? 'not-allowed' : 'pointer',
          }}
        >
          {isLoggingIn ? '⏳ SIGNING IN...' : isAuthenticated ? '🚪 SIGN OUT' : '🔑 SIGN IN'}
        </button>
      </div>

      {/* Title */}
      <div className="relative z-10 flex flex-col items-center gap-2 mb-12">
        <div
          className="font-bangers text-8xl md:text-9xl text-center"
          style={{
            color: '#ff8800',
            WebkitTextStroke: '4px #0a0505',
            textShadow: '6px 6px 0 #0a0505, -2px -2px 0 #0a0505',
            letterSpacing: '0.05em',
            lineHeight: 1,
          }}
        >
          DESERT
        </div>
        <div
          className="font-bangers text-8xl md:text-9xl text-center"
          style={{
            color: '#cc2200',
            WebkitTextStroke: '4px #0a0505',
            textShadow: '6px 6px 0 #0a0505, -2px -2px 0 #0a0505',
            letterSpacing: '0.05em',
            lineHeight: 1,
          }}
        >
          DEAD
        </div>
        <div
          className="font-bangers text-4xl"
          style={{
            color: '#ffcc00',
            WebkitTextStroke: '2px #0a0505',
            textShadow: '3px 3px 0 #0a0505',
            letterSpacing: '0.2em',
          }}
        >
          FPS ZOMBIE SHOOTER
        </div>
      </div>

      {/* Menu buttons */}
      <div className="relative z-10 flex flex-col gap-4 items-center">
        <button
          className="toon-btn toon-btn-yellow w-64 text-center"
          onClick={onStartGame}
        >
          ▶ START GAME
        </button>
        <button
          className="toon-btn w-64 text-center"
          onClick={onShowLeaderboard}
        >
          🏆 LEADERBOARD
        </button>
        {isAuthenticated && (
          <button
            className="toon-btn w-64 text-center"
            style={{ background: 'oklch(0.28 0.08 200)', color: 'oklch(0.90 0.12 200)', border: '3px solid oklch(0.45 0.12 200)' }}
            onClick={onShowProfile}
          >
            👤 MY PROFILE
          </button>
        )}
        <button
          className="toon-btn w-64 text-center"
          style={{ background: 'oklch(0.35 0.06 45)', color: 'oklch(0.95 0.03 90)' }}
          onClick={onShowControls}
        >
          🎮 CONTROLS
        </button>
      </div>

      {/* Footer */}
      <div
        className="absolute bottom-4 left-0 right-0 text-center toon-text text-sm"
        style={{ color: 'oklch(0.45 0.05 50)' }}
      >
        Built with ❤ using{' '}
        <a
          href={`https://caffeine.ai/?utm_source=Caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname || 'desert-dead-fps')}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: 'oklch(0.62 0.18 48)', textDecoration: 'underline' }}
        >
          caffeine.ai
        </a>
        {' '}· © {new Date().getFullYear()}
      </div>
    </div>
  );
}
