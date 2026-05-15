import { useState } from "react";
import { ControlsScreen } from "./components/ControlsScreen";
import { GameScene } from "./components/Game/GameScene";
import { GameOver } from "./components/GameOver";
import { Leaderboard } from "./components/Leaderboard";
import { MainMenu } from "./components/MainMenu";
import { PlayerProfile } from "./components/PlayerProfile";
import { SocialsHub } from "./components/SocialsHub";
import { UsernameSetup } from "./components/UsernameSetup";
import { useInternetIdentity } from "./hooks/useInternetIdentity";
import { useGetUsername } from "./hooks/useUsername";

type Screen =
  | "menu"
  | "game"
  | "gameover"
  | "leaderboard"
  | "controls"
  | "profile"
  | "socials";

interface GameResult {
  score: number;
  wave: number;
  kills: number;
  headshots: number;
  shotsFired: number;
}

export default function App() {
  const [screen, setScreen] = useState<Screen>("menu");
  const { identity } = useInternetIdentity();
  const {
    data: username,
    refetch: refetchUsername,
    isLoading: usernameLoading,
  } = useGetUsername();
  const isAuthenticated = !!identity;
  // Show username setup if logged in but username not yet set (and query has resolved)
  const showUsernameSetup =
    isAuthenticated && !usernameLoading && username === null;
  const [gameResult, setGameResult] = useState<GameResult>({
    score: 0,
    wave: 0,
    kills: 0,
    headshots: 0,
    shotsFired: 0,
  });

  const handleStartGame = () => {
    setScreen("game");
  };

  const handleGameOver = (
    score: number,
    wave: number,
    kills: number,
    headshots: number,
    shotsFired: number,
  ) => {
    setGameResult({ score, wave, kills, headshots, shotsFired });
    setScreen("gameover");
  };

  const handleBackToMenu = () => {
    setScreen("menu");
  };

  const handleShowLeaderboard = () => {
    setScreen("leaderboard");
  };

  const handleShowControls = () => {
    setScreen("controls");
  };

  const handleShowProfile = () => {
    setScreen("profile");
  };

  const handleShowSocials = () => {
    setScreen("socials");
  };

  const handleRetry = () => {
    setScreen("game");
  };

  return (
    <div
      className="w-screen h-screen overflow-hidden"
      style={{ background: "#0a0500" }}
    >
      {showUsernameSetup && (
        <UsernameSetup
          onComplete={() => {
            refetchUsername();
          }}
        />
      )}
      {screen === "menu" && (
        <MainMenu
          onStartGame={handleStartGame}
          onShowLeaderboard={handleShowLeaderboard}
          onShowControls={handleShowControls}
          onShowProfile={handleShowProfile}
          onSocials={handleShowSocials}
        />
      )}

      {screen === "game" && <GameScene onGameOver={handleGameOver} />}

      {screen === "gameover" && (
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

      {screen === "leaderboard" && <Leaderboard onBack={handleBackToMenu} />}

      {screen === "controls" && <ControlsScreen onBack={handleBackToMenu} />}

      {screen === "profile" && <PlayerProfile onBack={handleBackToMenu} />}

      {screen === "socials" && <SocialsHub onBack={handleBackToMenu} />}
    </div>
  );
}
