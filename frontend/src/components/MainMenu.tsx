import { useInternetIdentity } from '../hooks/useInternetIdentity';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';

interface MainMenuProps {
  onStartGame: () => void;
  onShowLeaderboard: () => void;
  onShowControls: () => void;
  onShowProfile: () => void;
}

// Floating dust mote data
const DUST_MOTES = Array.from({ length: 22 }, (_, i) => ({
  id: i,
  left: `${(i * 4.7 + 3) % 100}%`,
  size: 2 + (i % 4),
  delay: `${(i * 0.43) % 5}s`,
  duration: `${5 + (i % 6)}s`,
  opacity: 0.15 + (i % 5) * 0.07,
}));

// Zombie silhouette SVG path (simple walking figure)
const ZOMBIE_PATH =
  'M50,10 C55,10 58,14 58,19 C58,24 55,28 50,28 C45,28 42,24 42,19 C42,14 45,10 50,10 Z M38,32 C38,30 40,29 42,29 L44,29 L46,50 L40,70 L36,90 L44,90 L48,72 L50,60 L52,72 L56,90 L64,90 L60,70 L54,50 L56,29 L58,29 C60,29 62,30 62,32 L65,55 L72,55 L70,32 C70,27 66,24 62,24 L38,24 C34,24 30,27 30,32 L28,55 L35,55 Z';

export function MainMenu({ onStartGame, onShowLeaderboard, onShowControls, onShowProfile }: MainMenuProps) {
  const { login, clear, loginStatus, identity } = useInternetIdentity();
  const queryClient = useQueryClient();
  const isAuthenticated = !!identity;
  const isLoggingIn = loginStatus === 'logging-in';
  const [mounted, setMounted] = useState(false);
  const titleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Stagger entrance
    const t = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(t);
  }, []);

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
      style={{ background: '#0d0500' }}
    >
      {/* ── BACKGROUND IMAGE ── */}
      <div
        className="absolute inset-0 z-0"
        style={{
          backgroundImage: 'url(/assets/generated/menu-bg-banner.dim_1920x1080.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center top',
          backgroundRepeat: 'no-repeat',
          filter: 'brightness(0.55) saturate(1.3)',
        }}
      />

      {/* ── GRADIENT VIGNETTE OVERLAY ── */}
      <div
        className="absolute inset-0 z-1 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 80% 70% at 50% 40%, transparent 30%, rgba(5,2,0,0.55) 70%, rgba(5,2,0,0.92) 100%)',
        }}
      />

      {/* ── BOTTOM DARK FADE ── */}
      <div
        className="absolute bottom-0 left-0 right-0 z-1 pointer-events-none"
        style={{
          height: '35%',
          background: 'linear-gradient(to top, rgba(5,2,0,0.97) 0%, transparent 100%)',
        }}
      />

      {/* ── TOP DARK FADE ── */}
      <div
        className="absolute top-0 left-0 right-0 z-1 pointer-events-none"
        style={{
          height: '20%',
          background: 'linear-gradient(to bottom, rgba(5,2,0,0.8) 0%, transparent 100%)',
        }}
      />

      {/* ── PARALLAX DUNE LAYERS ── */}
      <div className="absolute inset-0 z-2 pointer-events-none overflow-hidden">
        {/* Slow dune layer */}
        <div
          className="menu-parallax-slow absolute bottom-0 left-0"
          style={{
            width: '200%',
            height: '18%',
            background:
              'radial-gradient(ellipse 30% 100% at 15% 100%, rgba(80,35,5,0.45) 0%, transparent 100%), radial-gradient(ellipse 25% 100% at 45% 100%, rgba(60,25,5,0.4) 0%, transparent 100%), radial-gradient(ellipse 35% 100% at 75% 100%, rgba(90,40,8,0.45) 0%, transparent 100%)',
          }}
        />
        {/* Medium dune layer */}
        <div
          className="menu-parallax-medium absolute bottom-0 left-0"
          style={{
            width: '200%',
            height: '12%',
            background:
              'radial-gradient(ellipse 20% 100% at 25% 100%, rgba(40,15,2,0.6) 0%, transparent 100%), radial-gradient(ellipse 22% 100% at 60% 100%, rgba(50,20,3,0.55) 0%, transparent 100%), radial-gradient(ellipse 18% 100% at 88% 100%, rgba(35,12,2,0.6) 0%, transparent 100%)',
          }}
        />
      </div>

      {/* ── ZOMBIE SILHOUETTE ── */}
      <div className="absolute bottom-0 z-3 pointer-events-none overflow-hidden" style={{ width: '100%', height: '28%' }}>
        <div className="menu-zombie-walk absolute bottom-0" style={{ bottom: '8%' }}>
          <svg
            viewBox="0 0 100 100"
            width="60"
            height="60"
            style={{ opacity: 0.18, filter: 'blur(0.5px)' }}
          >
            <path d={ZOMBIE_PATH} fill="#1a0800" />
          </svg>
        </div>
        <div
          className="menu-zombie-walk-slow absolute bottom-0"
          style={{ bottom: '5%', animationDelay: '-8s' }}
        >
          <svg
            viewBox="0 0 100 100"
            width="40"
            height="40"
            style={{ opacity: 0.12, filter: 'blur(0.8px)' }}
          >
            <path d={ZOMBIE_PATH} fill="#1a0800" />
          </svg>
        </div>
      </div>

      {/* ── SCREEN FLICKER OVERLAY ── */}
      <div
        className="menu-flicker absolute inset-0 z-3 pointer-events-none"
        style={{ background: 'rgba(255,120,20,0.015)' }}
      />

      {/* ── DUST MOTES ── */}
      <div className="absolute inset-0 z-4 pointer-events-none overflow-hidden">
        {DUST_MOTES.map((mote) => (
          <div
            key={mote.id}
            className="menu-dust absolute rounded-full"
            style={{
              left: mote.left,
              bottom: '-10px',
              width: `${mote.size}px`,
              height: `${mote.size}px`,
              background: `rgba(255, 160, 60, ${mote.opacity})`,
              animationDelay: mote.delay,
              animationDuration: mote.duration,
            }}
          />
        ))}
      </div>

      {/* ── HEAT HAZE ── */}
      <div
        className="menu-heat-haze absolute inset-0 z-4 pointer-events-none"
        style={{
          background:
            'linear-gradient(to top, rgba(200,80,10,0.04) 0%, transparent 30%)',
        }}
      />

      {/* ── AUTH PANEL — top right ── */}
      <div className="absolute top-4 right-4 z-20 flex flex-col items-end gap-2">
        {isAuthenticated && identity && (
          <div
            className="font-oswald text-xs px-3 py-1"
            style={{
              background: 'rgba(8,2,0,0.92)',
              border: '2px solid rgba(200,120,0,0.7)',
              color: 'rgba(255,200,100,0.9)',
              boxShadow: '3px 3px 0 rgba(0,0,0,0.8), 0 0 8px rgba(200,100,0,0.3)',
              letterSpacing: '0.05em',
            }}
          >
            🔑 {truncatePrincipal(identity.getPrincipal().toString())}
          </div>
        )}
        <button
          onClick={handleAuth}
          disabled={isLoggingIn}
          className="font-bangers text-base px-4 py-2 transition-all menu-auth-btn"
          style={{
            background: isAuthenticated ? 'rgba(30,10,0,0.92)' : 'rgba(180,80,0,0.88)',
            border: `2px solid ${isAuthenticated ? 'rgba(200,60,0,0.8)' : 'rgba(255,140,0,0.9)'}`,
            color: isAuthenticated ? '#ff6644' : '#ffcc00',
            boxShadow: isAuthenticated
              ? '3px 3px 0 rgba(0,0,0,0.8)'
              : '3px 3px 0 rgba(0,0,0,0.8), 0 0 12px rgba(255,140,0,0.4)',
            letterSpacing: '0.08em',
            opacity: isLoggingIn ? 0.6 : 1,
            cursor: isLoggingIn ? 'not-allowed' : 'pointer',
          }}
        >
          {isLoggingIn ? '⏳ SIGNING IN...' : isAuthenticated ? '🚪 SIGN OUT' : '🔑 SIGN IN'}
        </button>
      </div>

      {/* ── TITLE ── */}
      <div
        ref={titleRef}
        className={`relative z-10 flex flex-col items-center gap-1 mb-10 transition-all duration-700 ${
          mounted ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-8'
        }`}
      >
        {/* Glow halo behind title */}
        <div
          className="menu-title-glow absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse 70% 60% at 50% 50%, rgba(220,80,10,0.35) 0%, transparent 70%)',
            filter: 'blur(18px)',
            transform: 'scale(1.4)',
          }}
        />

        <div
          className="font-bangers text-center relative"
          style={{
            fontSize: 'clamp(4.5rem, 14vw, 9rem)',
            color: '#ff8800',
            WebkitTextStroke: '4px #0a0505',
            textShadow:
              '6px 6px 0 #0a0505, -2px -2px 0 #0a0505, 0 0 40px rgba(255,120,0,0.8), 0 0 80px rgba(255,80,0,0.4)',
            letterSpacing: '0.06em',
            lineHeight: 1,
          }}
        >
          DESERT
        </div>
        <div
          className="font-bangers text-center relative"
          style={{
            fontSize: 'clamp(4.5rem, 14vw, 9rem)',
            color: '#cc2200',
            WebkitTextStroke: '4px #0a0505',
            textShadow:
              '6px 6px 0 #0a0505, -2px -2px 0 #0a0505, 0 0 40px rgba(200,20,0,0.9), 0 0 80px rgba(180,0,0,0.5)',
            letterSpacing: '0.06em',
            lineHeight: 1,
          }}
        >
          DEAD
        </div>

        {/* Subtitle bar */}
        <div
          className="relative mt-1 px-6 py-1"
          style={{
            background: 'rgba(8,2,0,0.75)',
            border: '2px solid rgba(200,100,0,0.6)',
            boxShadow: '0 0 20px rgba(200,80,0,0.4), 4px 4px 0 rgba(0,0,0,0.8)',
          }}
        >
          <div
            className="font-bangers text-center"
            style={{
              fontSize: 'clamp(1.1rem, 3.5vw, 2rem)',
              color: '#ffcc00',
              WebkitTextStroke: '1.5px #0a0505',
              textShadow: '2px 2px 0 #0a0505, 0 0 15px rgba(255,200,0,0.6)',
              letterSpacing: '0.25em',
            }}
          >
            ☠ FPS ZOMBIE SHOOTER ☠
          </div>
        </div>

        {/* Decorative divider */}
        <div className="flex items-center gap-3 mt-2">
          <div style={{ width: '60px', height: '2px', background: 'linear-gradient(to right, transparent, rgba(200,80,0,0.8))' }} />
          <div style={{ color: 'rgba(200,80,0,0.9)', fontSize: '1rem' }}>✦</div>
          <div style={{ width: '60px', height: '2px', background: 'linear-gradient(to left, transparent, rgba(200,80,0,0.8))' }} />
        </div>
      </div>

      {/* ── MENU BUTTONS ── */}
      <div
        className={`relative z-10 flex flex-col gap-3 items-center transition-all duration-700 delay-200 ${
          mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
        }`}
      >
        {/* PLAY button — biggest, most prominent */}
        <button
          className="menu-btn-play font-bangers uppercase tracking-widest"
          onClick={onStartGame}
          style={{
            fontSize: 'clamp(1.6rem, 4vw, 2.2rem)',
            width: 'clamp(240px, 40vw, 320px)',
            padding: '0.65rem 2rem',
            background: 'linear-gradient(135deg, rgba(220,100,0,0.95) 0%, rgba(180,60,0,0.95) 100%)',
            border: '3px solid #0a0505',
            color: '#ffee00',
            boxShadow: '5px 5px 0 #0a0505, 0 0 20px rgba(255,120,0,0.5)',
            WebkitTextStroke: '1px #0a0505',
            textShadow: '2px 2px 0 #0a0505, 0 0 12px rgba(255,220,0,0.6)',
            cursor: 'pointer',
            transition: 'transform 0.12s, box-shadow 0.12s, background 0.12s',
            userSelect: 'none',
          }}
        >
          ▶ START GAME
        </button>

        {/* Secondary buttons */}
        <button
          className="menu-btn-secondary font-bangers uppercase tracking-widest"
          onClick={onShowLeaderboard}
          style={{
            fontSize: 'clamp(1.2rem, 3vw, 1.6rem)',
            width: 'clamp(220px, 36vw, 290px)',
            padding: '0.5rem 1.5rem',
            background: 'rgba(12,5,0,0.88)',
            border: '3px solid rgba(200,80,0,0.75)',
            color: '#ff9944',
            boxShadow: '4px 4px 0 #0a0505, 0 0 12px rgba(200,80,0,0.25)',
            WebkitTextStroke: '1px #0a0505',
            textShadow: '2px 2px 0 #0a0505',
            cursor: 'pointer',
            transition: 'transform 0.12s, box-shadow 0.12s, border-color 0.12s, color 0.12s',
            userSelect: 'none',
          }}
        >
          🏆 LEADERBOARD
        </button>

        {isAuthenticated && (
          <button
            className="menu-btn-secondary font-bangers uppercase tracking-widest"
            onClick={onShowProfile}
            style={{
              fontSize: 'clamp(1.2rem, 3vw, 1.6rem)',
              width: 'clamp(220px, 36vw, 290px)',
              padding: '0.5rem 1.5rem',
              background: 'rgba(5,10,20,0.88)',
              border: '3px solid rgba(60,120,200,0.65)',
              color: '#88ccff',
              boxShadow: '4px 4px 0 #0a0505, 0 0 12px rgba(60,120,200,0.2)',
              WebkitTextStroke: '1px #0a0505',
              textShadow: '2px 2px 0 #0a0505',
              cursor: 'pointer',
              transition: 'transform 0.12s, box-shadow 0.12s, border-color 0.12s, color 0.12s',
              userSelect: 'none',
            }}
          >
            👤 MY PROFILE
          </button>
        )}

        <button
          className="menu-btn-secondary font-bangers uppercase tracking-widest"
          onClick={onShowControls}
          style={{
            fontSize: 'clamp(1.2rem, 3vw, 1.6rem)',
            width: 'clamp(220px, 36vw, 290px)',
            padding: '0.5rem 1.5rem',
            background: 'rgba(12,5,0,0.88)',
            border: '3px solid rgba(140,100,40,0.65)',
            color: '#ccaa66',
            boxShadow: '4px 4px 0 #0a0505, 0 0 12px rgba(140,100,40,0.2)',
            WebkitTextStroke: '1px #0a0505',
            textShadow: '2px 2px 0 #0a0505',
            cursor: 'pointer',
            transition: 'transform 0.12s, box-shadow 0.12s, border-color 0.12s, color 0.12s',
            userSelect: 'none',
          }}
        >
          🎮 CONTROLS
        </button>
      </div>

      {/* ── WAVE COUNTER BADGE ── */}
      <div
        className={`relative z-10 mt-6 transition-all duration-700 delay-300 ${
          mounted ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <div
          className="font-oswald text-xs tracking-widest uppercase"
          style={{ color: 'rgba(180,80,20,0.7)', textShadow: '1px 1px 0 rgba(0,0,0,0.8)' }}
        >
          ☠ Survive the endless horde ☠
        </div>
      </div>

      {/* ── FOOTER ── */}
      <div
        className="absolute bottom-3 left-0 right-0 text-center z-10"
        style={{
          fontFamily: 'Oswald, sans-serif',
          fontSize: '0.72rem',
          color: 'rgba(140,70,20,0.7)',
          letterSpacing: '0.04em',
        }}
      >
        Built with ❤ using{' '}
        <a
          href={`https://caffeine.ai/?utm_source=Caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname || 'desert-dead-fps')}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: 'rgba(200,100,30,0.85)', textDecoration: 'underline' }}
        >
          caffeine.ai
        </a>
        {' '}· © {new Date().getFullYear()}
      </div>
    </div>
  );
}
