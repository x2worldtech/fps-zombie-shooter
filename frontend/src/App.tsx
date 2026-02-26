import { useState } from 'react';
import { MainMenu } from './components/MainMenu';
import { GameScene } from './components/Game/GameScene';
import { GameOver } from './components/GameOver';
import { Leaderboard } from './components/Leaderboard';
import { ControlsScreen } from './components/ControlsScreen';
import { PlayerProfile } from './components/PlayerProfile';

type Screen = 'menu' | 'game' | 'gameover' | 'leaderboard' | 'controls' | 'profile';

interface GameResult {
  score: number;
  wave: number;
  kills: number;
  headshots: number;
  shotsFired: number;
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('menu');
  const [gameResult, setGameResult] = useState<GameResult>({
    score: 0,
    wave: 0,
    kills: 0,
    headshots: 0,
    shotsFired: 0,
  });

  const handleStartGame = () => {
    setScreen('game');
  };

  const handleGameOver = (score: number, wave: number, kills: number, headshots: number, shotsFired: number) => {
    setGameResult({ score, wave, kills, headshots, shotsFired });
    setScreen('gameover');
  };

  const handleBackToMenu = () => {
    setScreen('menu');
  };

  const handleShowLeaderboard = () => {
    setScreen('leaderboard');
  };

  const handleShowControls = () => {
    setScreen('controls');
  };

  const handleShowProfile = () => {
    setScreen('profile');
  };

  const handleRetry = () => {
    setScreen('game');
  };

  return (
    <div className="w-screen h-screen overflow-hidden" style={{ background: '#0a0500' }}>
      {screen === 'menu' && (
        <MainMenu
          onStartGame={handleStartGame}
          onShowLeaderboard={handleShowLeaderboard}
          onShowControls={handleShowControls}
          onShowProfile={handleShowProfile}
        />
      )}

      {screen === 'game' && (
        <GameScene onGameOver={handleGameOver} />
      )}

      {screen === 'gameover' && (
        <GameOver
          score={gameResult.score}
          wave={gameResult.wave}
          kills={gameResult.kills}
          headshots={gameResult.headshots}
          shotsFired={gameResult.shotsFired}
          onRetry={handleRetry}
          onMainMenu={handleBackToMenu}
          onShowLeaderboard={handleShowLeaderboard}
        />
      )}

      {screen === 'leaderboard' && (
        <Leaderboard onBack={handleBackToMenu} />
      )}

      {screen === 'controls' && (
        <ControlsScreen onBack={handleBackToMenu} />
      )}

      {screen === 'profile' && (
        <PlayerProfile onBack={handleBackToMenu} />
      )}
    </div>
  );
}
