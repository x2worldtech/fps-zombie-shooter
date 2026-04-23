import { useEffect, useRef, useState } from "react";
import type { PointsNotification } from "../../hooks/useEnemySystem";
import { JUGGERNOG_COSTS } from "../../hooks/useJuggernogSystem";
import type { WaveState } from "../../hooks/useWaveSystem";
import {
  UPGRADE_COSTS,
  WEAPON_CONFIGS,
  type WeaponState,
} from "../../types/weapon";
import type { WorldType } from "./GameScene";
import { SniperScope } from "./SniperScope";

function useFullscreen() {
  const [isFullscreen, setIsFullscreen] = useState(false);
  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);
  const toggle = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };
  return { isFullscreen, toggle };
}

function HUDFullscreenButton() {
  const { isFullscreen, toggle } = useFullscreen();
  return (
    <button
      type="button"
      data-ocid="hud-fullscreen-toggle"
      onClick={toggle}
      title={isFullscreen ? "Vollbild beenden" : "Vollbild"}
      className="pointer-events-auto"
      style={{
        background: "rgba(10,5,0,0.75)",
        border: "2px solid #0a0505",
        boxShadow: "3px 3px 0 #0a0505",
        cursor: "pointer",
        fontFamily: "'Oswald', sans-serif",
        fontWeight: 600,
        fontSize: "0.68rem",
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        color: "rgba(255,255,255,0.82)",
        display: "flex",
        alignItems: "center",
        gap: "5px",
        padding: "5px 8px",
        transition: "color 0.15s ease, border-color 0.15s ease",
        lineHeight: 1,
      }}
      onMouseEnter={(e) => {
        const btn = e.currentTarget as HTMLButtonElement;
        btn.style.color = "#FF7A00";
        btn.style.borderColor = "#FF7A00";
      }}
      onMouseLeave={(e) => {
        const btn = e.currentTarget as HTMLButtonElement;
        btn.style.color = "rgba(255,255,255,0.82)";
        btn.style.borderColor = "#0a0505";
      }}
    >
      <span style={{ fontSize: "1rem", lineHeight: 1 }}>
        {isFullscreen ? "⊠" : "⛶"}
      </span>
      <span>{isFullscreen ? "VOLLBILD BEENDEN" : "VOLLBILD"}</span>
    </button>
  );
}

interface HUDProps {
  health: number;
  maxHealth: number;
  weaponState: WeaponState;
  waveState: WaveState;
  score: number;
  points: number;
  killStreak: number;
  isDamaged: boolean;
  pointsNotifications: PointsNotification[];
  nearPackAPunch: boolean;
  nearJuggernog?: boolean;
  nearNuclearMachine?: boolean;
  nearSpeedCola?: boolean;
  upgradeMessage: string | null;
  juggernogPurchaseCount?: number;
  isAiming?: boolean;
  currentWorld?: WorldType;
  nearPortal?: boolean;
}

function HealthBar({
  health,
  maxHealth,
}: { health: number; maxHealth: number }) {
  const pct = health / maxHealth;
  const barColor = pct > 0.5 ? "#cc2222" : pct > 0.25 ? "#ff8800" : "#ff2200";

  return (
    <div className="flex flex-col gap-1">
      <div className="hud-text text-xl" style={{ color: "#ffcc88" }}>
        ❤ HEALTH
      </div>
      <div
        className="relative h-5 w-48"
        style={{
          background: "#1a0a0a",
          border: "2px solid #0a0505",
          boxShadow: "2px 2px 0 #0a0505",
        }}
      >
        <div
          className="h-full transition-all duration-100"
          style={{
            width: `${pct * 100}%`,
            background: barColor,
            boxShadow: `0 0 8px ${barColor}`,
          }}
        />
        <div
          className="absolute inset-0 flex items-center justify-center hud-text text-sm"
          style={{ color: "#fff" }}
        >
          {health}/{maxHealth}
        </div>
      </div>
    </div>
  );
}

function AmmoDisplay({ weaponState }: { weaponState: WeaponState }) {
  const config = WEAPON_CONFIGS[weaponState.currentWeapon];
  const isEmpty = weaponState.currentAmmo === 0;

  const tierLabel =
    weaponState.upgradeTier > 0 ? (
      <span
        style={{
          color:
            weaponState.upgradeTier === 1
              ? "#44aaff"
              : weaponState.upgradeTier === 2
                ? "#cc44ff"
                : "#ffcc00",
          fontSize: "0.7rem",
          marginLeft: "4px",
        }}
      >
        ★{weaponState.upgradeTier}
      </span>
    ) : null;

  return (
    <div className="flex flex-col items-end gap-1">
      <div
        className="hud-text text-sm flex items-center"
        style={{ color: "#ffcc88" }}
      >
        {config.displayName}
        {tierLabel}
      </div>
      <div
        className="hud-text text-3xl"
        style={{ color: isEmpty ? "#ff2200" : "#ffcc00" }}
      >
        {weaponState.isReloading ? (
          <span style={{ color: "#ff8800", fontSize: "1.2rem" }}>
            RELOADING...
          </span>
        ) : (
          <>
            <span style={{ color: isEmpty ? "#ff2200" : "#fff" }}>
              {weaponState.currentAmmo}
            </span>
            <span style={{ color: "#888", fontSize: "1.2rem" }}>
              {" "}
              / {weaponState.reserveAmmo}
            </span>
          </>
        )}
      </div>
      <div className="flex gap-1">
        {[1, 2, 3, 4].map((n) => {
          const wName =
            n === 1
              ? "pistol"
              : n === 2
                ? "shotgun"
                : n === 3
                  ? "assault_rifle"
                  : "sniper_rifle";
          const isActive = weaponState.currentWeapon === wName;
          return (
            <div
              key={n}
              className="hud-text text-xs px-1"
              style={{
                background: isActive ? "#cc8800" : "#1a1a1a",
                border: `1px solid ${isActive ? "#ffcc00" : "#444"}`,
                color: isActive ? "#000" : "#888",
              }}
            >
              [{n}]
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Crosshair() {
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <div className="relative w-6 h-6">
        <div
          className="absolute top-1/2 left-0 right-0 h-0.5 -translate-y-1/2"
          style={{ background: "#fff", boxShadow: "0 0 3px #000" }}
        />
        <div
          className="absolute left-1/2 top-0 bottom-0 w-0.5 -translate-x-1/2"
          style={{ background: "#fff", boxShadow: "0 0 3px #000" }}
        />
        <div
          className="absolute top-1/2 left-1/2 w-1 h-1 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{ background: "#ff4400" }}
        />
      </div>
    </div>
  );
}

function PointsPopup({
  notifications,
}: { notifications: PointsNotification[] }) {
  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 20 }}
    >
      {notifications.map((notif) => {
        const age = (Date.now() - notif.timestamp) / 2000;
        const opacity = Math.max(0, 1 - age);
        const translateY = -age * 60;
        return (
          <div
            key={notif.id}
            className="absolute left-1/2 hud-text"
            style={{
              top: "45%",
              transform: `translateX(30px) translateY(${translateY}px)`,
              opacity,
              color: "#ffee00",
              fontSize: notif.isHeadshot ? "1.4rem" : "1.1rem",
              textShadow: "0 0 8px #ff8800, 2px 2px 0 #000",
              fontWeight: "bold",
              whiteSpace: "nowrap",
              transition: "none",
            }}
          >
            +{notif.amount}
            {notif.isHeadshot ? " 🎯 HEADSHOT!" : ""}
          </div>
        );
      })}
    </div>
  );
}

function PackAPunchPrompt({
  nearMachine,
  upgradeTier,
  points,
}: {
  nearMachine: boolean;
  upgradeTier: number;
  points: number;
}) {
  if (!nearMachine || upgradeTier >= 3) return null;

  const nextCost = UPGRADE_COSTS[upgradeTier];
  const canAfford = points >= nextCost;
  const tierNames = ["", "BLUE STEEL", "VOID PURPLE", "GOLDEN FURY"];
  const nextTierName = tierNames[upgradeTier + 1];

  return (
    <div
      className="absolute bottom-32 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
      style={{ zIndex: 20 }}
    >
      <div
        className="hud-text text-lg px-5 py-2 text-center"
        style={{
          background: "rgba(20,0,40,0.92)",
          border: `2px solid ${canAfford ? "#cc44ff" : "#660088"}`,
          boxShadow: `0 0 16px ${canAfford ? "#cc44ff88" : "#33003388"}, 3px 3px 0 #000`,
          color: canAfford ? "#ee88ff" : "#886699",
        }}
      >
        <div
          style={{ color: "#cc44ff", fontSize: "0.85rem", marginBottom: "2px" }}
        >
          ⚡ PACK-A-PUNCH MACHINE ⚡
        </div>
        <div>
          Press <span style={{ color: "#ffee00" }}>E</span> to upgrade →{" "}
          <span
            style={{
              color:
                upgradeTier + 1 === 1
                  ? "#44aaff"
                  : upgradeTier + 1 === 2
                    ? "#cc44ff"
                    : "#ffcc00",
            }}
          >
            {nextTierName}
          </span>
        </div>
        <div style={{ fontSize: "0.85rem", marginTop: "2px" }}>
          Cost:{" "}
          <span style={{ color: canAfford ? "#ffee00" : "#ff4444" }}>
            {nextCost.toLocaleString()} pts
          </span>{" "}
          | You have:{" "}
          <span style={{ color: "#ffee00" }}>
            {points.toLocaleString()} pts
          </span>
        </div>
      </div>
    </div>
  );
}

function JuggernogPrompt({
  nearMachine,
  purchaseCount,
  points,
}: {
  nearMachine: boolean;
  purchaseCount: number;
  points: number;
}) {
  if (!nearMachine) return null;

  if (purchaseCount >= 2) {
    return (
      <div
        className="absolute bottom-20 left-1/2 -translate-x-1/2"
        style={{ zIndex: 20 }}
      >
        <div
          className="hud-text text-lg px-5 py-2 text-center"
          style={{
            background: "rgba(20,0,0,0.92)",
            border: "2px solid #440000",
            boxShadow: "3px 3px 0 #000",
            color: "#664444",
          }}
        >
          <div
            style={{
              color: "#cc2222",
              fontSize: "0.85rem",
              marginBottom: "2px",
            }}
          >
            🍺 JUGGERNOG
          </div>
          <div>Bereits maximal aufgewertet!</div>
        </div>
      </div>
    );
  }

  const cost = JUGGERNOG_COSTS[purchaseCount];
  const canAfford = points >= cost;
  const nextMaxHp = purchaseCount === 0 ? 150 : 200;

  return (
    <div
      className="absolute bottom-20 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
      style={{ zIndex: 20 }}
    >
      <div
        className="hud-text text-lg px-5 py-2 text-center"
        style={{
          background: "rgba(40,0,0,0.92)",
          border: `2px solid ${canAfford ? "#ff4444" : "#660000"}`,
          boxShadow: `0 0 16px ${canAfford ? "#ff444488" : "#33000088"}, 3px 3px 0 #000`,
          color: canAfford ? "#ff8888" : "#886666",
        }}
      >
        <div
          style={{ color: "#ff2222", fontSize: "0.85rem", marginBottom: "2px" }}
        >
          🍺 JUGGERNOG
        </div>
        <div>
          Press <span style={{ color: "#ffee00" }}>F</span> to buy →{" "}
          <span style={{ color: "#ff6666" }}>Max HP: {nextMaxHp}</span>
        </div>
        <div style={{ fontSize: "0.85rem", marginTop: "2px" }}>
          Cost:{" "}
          <span style={{ color: canAfford ? "#ffee00" : "#ff4444" }}>
            {cost.toLocaleString()} pts
          </span>{" "}
          | You have:{" "}
          <span style={{ color: "#ffee00" }}>
            {points.toLocaleString()} pts
          </span>
        </div>
      </div>
    </div>
  );
}

function JuggernogPerkIndicator({ purchaseCount }: { purchaseCount: number }) {
  if (purchaseCount === 0) return null;

  return (
    <div
      className="flex flex-col items-center gap-0.5"
      title={`Juggernog Stufe ${purchaseCount}/2`}
    >
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-base border-2"
        style={{
          background:
            purchaseCount >= 2
              ? "linear-gradient(135deg, #cc0000, #880000)"
              : "linear-gradient(135deg, #ff2222, #cc0000)",
          borderColor: purchaseCount >= 2 ? "#ff4444" : "#ff6666",
          boxShadow:
            purchaseCount >= 2 ? "0 0 10px #ff0000" : "0 0 5px #ff4444",
          color: "#fff",
          fontSize: "1.1rem",
        }}
      >
        🍺
      </div>
      <div className="flex gap-0.5">
        {[0, 1].map((i) => (
          <div
            key={i}
            className="w-2 h-2 rounded-full"
            style={{
              backgroundColor: i < purchaseCount ? "#ff2222" : "#333333",
              border: "1px solid #555",
            }}
          />
        ))}
      </div>
      <div
        className="hud-text text-xs"
        style={{ color: "#ff8888", fontSize: "0.6rem" }}
      >
        JUGGERNOG
      </div>
    </div>
  );
}

function UpgradeMessage({ message }: { message: string | null }) {
  if (!message) return null;
  const isError = message.includes("enough") || message.includes("✗");
  return (
    <div
      className="absolute top-1/3 left-1/2 -translate-x-1/2 hud-text text-xl px-6 py-3 text-center"
      style={{
        background: isError ? "rgba(40,0,0,0.9)" : "rgba(20,0,40,0.9)",
        border: `2px solid ${isError ? "#ff2200" : "#cc44ff"}`,
        boxShadow: `0 0 20px ${isError ? "#ff220066" : "#cc44ff66"}, 3px 3px 0 #000`,
        color: isError ? "#ff6644" : "#ee88ff",
        zIndex: 25,
        animation: "wave-in 0.3s ease-out",
      }}
    >
      {message}
    </div>
  );
}

// CoD-style tally marks for rounds 1-5
function TallyMarks({ round }: { round: number }) {
  // Each group of 5: 4 vertical + 1 diagonal cross
  const tallies: { x1: number; y1: number; x2: number; y2: number }[] = [];

  const markCount = Math.min(round, 5);
  const W = 14; // spacing between marks
  const totalWidth = markCount <= 4 ? markCount * W : 4 * W + 18;

  for (let i = 0; i < markCount; i++) {
    if (i < 4) {
      // vertical tally with slight random tilt
      const offsetX = i * W + 6;
      const tilt = (i % 2 === 0 ? 1 : -1) * 2;
      tallies.push({
        x1: offsetX - tilt,
        y1: 3,
        x2: offsetX + tilt,
        y2: 29,
      });
    } else {
      // 5th mark: diagonal cross over first 4
      tallies.push({
        x1: 0,
        y1: 28,
        x2: 4 * W + 2,
        y2: 4,
      });
    }
  }

  return (
    <svg
      width={totalWidth + 10}
      height={36}
      style={{ overflow: "visible", display: "block" }}
    >
      <title>Round tally marks</title>
      {tallies.map((t) => (
        <line
          key={`${t.x1}-${t.y1}-${t.x2}-${t.y2}`}
          x1={t.x1}
          y1={t.y1}
          x2={t.x2}
          y2={t.y2}
          stroke="#8b0000"
          strokeWidth="3"
          strokeLinecap="round"
          style={{ filter: "drop-shadow(0 0 4px #8b000099)" }}
        />
      ))}
    </svg>
  );
}

// CoD-style round counter — top-left
function RoundCounter({ round }: { round: number }) {
  const useTally = round >= 1 && round <= 5;

  return (
    <div
      className="absolute top-4 left-4 flex flex-col items-start"
      style={{ zIndex: 15 }}
    >
      <div
        className="px-3 py-2"
        style={{
          background: "rgba(0,0,0,0.6)",
          border: "1px solid #3a0000",
          boxShadow: "0 0 12px #8b000044",
        }}
      >
        <div
          className="hud-text"
          style={{
            color: "#8b0000",
            fontSize: "0.6rem",
            letterSpacing: "0.2em",
            marginBottom: "4px",
            textShadow: "0 0 6px #8b000088",
          }}
        >
          ROUND
        </div>
        {useTally ? (
          <TallyMarks round={round} />
        ) : (
          <div
            className="hud-text"
            style={{
              color: "#8b0000",
              fontSize: "2.2rem",
              lineHeight: 1,
              textShadow: "0 0 8px #8b000088, 0 0 16px #8b000044",
              fontWeight: "bold",
              letterSpacing: "0.05em",
            }}
          >
            {round}
          </div>
        )}
      </div>
    </div>
  );
}

export function HUD({
  health,
  maxHealth,
  weaponState,
  waveState,
  score,
  points,
  killStreak,
  isDamaged,
  pointsNotifications,
  nearPackAPunch,
  nearJuggernog = false,
  nearNuclearMachine = false,
  nearSpeedCola = false,
  upgradeMessage,
  juggernogPurchaseCount = 0,
  isAiming = false,
  currentWorld = "desert",
  nearPortal = false,
}: HUDProps) {
  // Re-render notifications every frame for smooth animation
  const [, forceUpdate] = useState(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const tick = () => {
      if (pointsNotifications.length > 0) {
        forceUpdate((n) => n + 1);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [pointsNotifications.length]);

  return (
    <div
      className="absolute inset-0 pointer-events-none select-none"
      style={{ zIndex: 10 }}
    >
      {/* Damage vignette */}
      {isDamaged && (
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at center, transparent 40%, rgba(200,0,0,0.6) 100%)",
            animation: "damage-flash 0.5s ease-out forwards",
          }}
        />
      )}

      {/* Top left - CoD-style Round Counter */}
      <RoundCounter round={waveState.wave} />

      {/* Top center - Score & Kill streak */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1">
        <div
          className="hud-text text-xl px-3 py-0.5"
          style={{
            background: "rgba(10,5,0,0.75)",
            border: "2px solid #0a0505",
            color: "#ff8800",
          }}
        >
          SCORE: {score.toLocaleString()}
        </div>
        {killStreak >= 3 && (
          <div
            className="hud-text text-lg px-3 py-0.5"
            style={{
              background: "rgba(200,50,0,0.8)",
              border: "2px solid #0a0505",
              color: "#ffff00",
              animation: "wave-in 0.3s ease-out",
            }}
          >
            🔥 {killStreak}x KILL STREAK!
          </div>
        )}
      </div>

      {/* Top right - Points + Fullscreen */}
      <div
        className="absolute top-4 right-6 flex flex-col items-end gap-2"
        style={{ zIndex: 15 }}
      >
        <div
          className="hud-text text-lg px-3 py-1"
          style={{
            background: "rgba(10,5,0,0.8)",
            border: "2px solid #0a0505",
            boxShadow: "3px 3px 0 #0a0505",
            color: "#ffee00",
          }}
        >
          ⭐ {points.toLocaleString()} PTS
          {weaponState.upgradeTier > 0 && (
            <span
              style={{
                marginLeft: "8px",
                color:
                  weaponState.upgradeTier === 1
                    ? "#44aaff"
                    : weaponState.upgradeTier === 2
                      ? "#cc44ff"
                      : "#ffcc00",
                fontSize: "0.85rem",
              }}
            >
              {"★".repeat(weaponState.upgradeTier)}
            </span>
          )}
        </div>
        <HUDFullscreenButton />
      </div>

      {/* Bottom left - Health + Perks */}
      <div className="absolute bottom-6 left-6 flex flex-col gap-2">
        <div
          className="p-3"
          style={{
            background: "rgba(10,5,0,0.8)",
            border: "2px solid #0a0505",
            boxShadow: "3px 3px 0 #0a0505",
          }}
        >
          <HealthBar health={health} maxHealth={maxHealth} />
        </div>

        {/* Perk indicators */}
        {juggernogPurchaseCount > 0 && (
          <div
            className="p-2 flex gap-2 items-center"
            style={{
              background: "rgba(10,5,0,0.8)",
              border: "2px solid #0a0505",
              boxShadow: "3px 3px 0 #0a0505",
            }}
          >
            <JuggernogPerkIndicator purchaseCount={juggernogPurchaseCount} />
          </div>
        )}
      </div>

      {/* Bottom right - Ammo */}
      <div
        className="absolute bottom-6 right-6 p-3"
        style={{
          background: "rgba(10,5,0,0.8)",
          border: "2px solid #0a0505",
          boxShadow: "3px 3px 0 #0a0505",
        }}
      >
        <AmmoDisplay weaponState={weaponState} />
      </div>

      {/* Crosshair - hidden when sniping */}
      {!(weaponState.currentWeapon === "sniper_rifle" && isAiming) && (
        <Crosshair />
      )}

      {/* Sniper scope overlay */}
      {weaponState.currentWeapon === "sniper_rifle" && isAiming && (
        <SniperScope />
      )}

      {/* Points popup notifications */}
      <PointsPopup notifications={pointsNotifications} />

      {/* Pack-a-Punch interaction prompt */}
      <PackAPunchPrompt
        nearMachine={nearPackAPunch}
        upgradeTier={weaponState.upgradeTier}
        points={points}
      />

      {/* Juggernog interaction prompt */}
      <JuggernogPrompt
        nearMachine={nearJuggernog}
        purchaseCount={juggernogPurchaseCount}
        points={points}
      />

      {/* Portal interaction prompt */}
      {nearPortal && (
        <div
          className="absolute bottom-32 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
          data-ocid="portal.prompt"
          style={{ zIndex: 20 }}
        >
          <div
            className="hud-text text-lg px-5 py-2 text-center"
            style={{
              background:
                currentWorld === "desert"
                  ? "rgba(30,8,0,0.92)"
                  : "rgba(20,14,0,0.92)",
              border: `2px solid ${currentWorld === "desert" ? "#ff4400" : "#ffaa22"}`,
              boxShadow: `0 0 18px ${currentWorld === "desert" ? "#ff440066" : "#ffaa2266"}, 3px 3px 0 #000`,
              color: currentWorld === "desert" ? "#ff8855" : "#ffcc66",
            }}
          >
            <div
              style={{
                color: currentWorld === "desert" ? "#ff4400" : "#ffaa22",
                fontSize: "0.85rem",
                marginBottom: "3px",
                letterSpacing: "0.15em",
              }}
            >
              ⬡ PORTAL — {currentWorld === "desert" ? "WAR ZONE" : "DESERT"}
            </div>
            <div>
              Press <span style={{ color: "#ffee00" }}>E</span> to teleport
            </div>
          </div>
        </div>
      )}

      {/* Nuclear machine interaction prompt (warzone) */}
      {nearNuclearMachine && (
        <div
          className="absolute bottom-32 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
          data-ocid="nuclear_machine.prompt"
          style={{ zIndex: 20 }}
        >
          <div
            className="hud-text text-lg px-5 py-2 text-center"
            style={{
              background: "rgba(10,20,0,0.92)",
              border: "2px solid #44ff22",
              boxShadow: "0 0 18px #44ff2266, 3px 3px 0 #000",
              color: "#aaffaa",
            }}
          >
            <div
              style={{
                color: "#44ff22",
                fontSize: "0.85rem",
                marginBottom: "3px",
                letterSpacing: "0.15em",
              }}
            >
              ☢ NUCLEAR LAUNCH SYSTEM ☢
            </div>
            <div>
              Press <span style={{ color: "#ffee00" }}>E</span> to launch
            </div>
          </div>
        </div>
      )}

      {/* Speed Cola interaction prompt (warzone) */}
      {nearSpeedCola && (
        <div
          className="absolute bottom-32 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
          data-ocid="speed_cola.prompt"
          style={{ zIndex: 20 }}
        >
          <div
            className="hud-text text-lg px-5 py-2 text-center"
            style={{
              background: "rgba(0,20,5,0.92)",
              border: "2px solid #00ff55",
              boxShadow: "0 0 18px #00ff5566, 3px 3px 0 #000",
              color: "#aaffcc",
            }}
          >
            <div
              style={{
                color: "#00ff55",
                fontSize: "0.85rem",
                marginBottom: "3px",
                letterSpacing: "0.15em",
              }}
            >
              🥤 SPEED COLA
            </div>
            <div>
              Press <span style={{ color: "#ffee00" }}>E</span> — 3000 pts
            </div>
          </div>
        </div>
      )}

      {/* Bottom right — world name indicator */}
      <div
        className="absolute bottom-6 right-6 pb-14 flex flex-col items-end gap-1"
        style={{ zIndex: 12, pointerEvents: "none" }}
      >
        <div
          className="hud-text text-xs px-2 py-0.5"
          data-ocid="hud.world_label"
          style={{
            color:
              currentWorld === "desert"
                ? "rgba(255,180,60,0.55)"
                : "rgba(140,160,200,0.55)",
            letterSpacing: "0.2em",
            fontSize: "0.6rem",
          }}
        >
          {currentWorld === "desert" ? "DESERT" : "WAR ZONE"}
        </div>
      </div>

      {/* Upgrade / purchase message */}
      <UpgradeMessage message={upgradeMessage} />
    </div>
  );
}
