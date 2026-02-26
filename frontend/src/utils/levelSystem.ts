/**
 * Level system utility — mirrors the backend XP threshold logic.
 * Levels 1–55, using the same formula: threshold[i] = 100 + i*(i+1)*80
 */

// 55 thresholds (index 0 = XP needed to reach level 2, etc.)
export const levelXpThresholds: number[] = Array.from({ length: 55 }, (_, i) =>
  100 + i * (i + 1) * 80
);

/**
 * Returns the current level (1–55) for a given total XP amount.
 */
export function calculateLevel(totalXP: number): number {
  let level = 1;
  for (let i = 0; i < levelXpThresholds.length; i++) {
    if (totalXP >= levelXpThresholds[i]) {
      level = i + 2; // threshold[0] unlocks level 2, etc.
    } else {
      break;
    }
  }
  return Math.min(level, 55);
}

/**
 * Returns the XP threshold at the start of the current level.
 */
export function getXpForCurrentLevel(totalXP: number): number {
  const level = calculateLevel(totalXP);
  if (level <= 1) return 0;
  return levelXpThresholds[level - 2]; // threshold index for the previous level boundary
}

/**
 * Returns the XP threshold needed to reach the next level.
 * Returns Infinity if already at max level.
 */
export function getXpForNextLevel(totalXP: number): number {
  const level = calculateLevel(totalXP);
  if (level >= 55) return Infinity;
  return levelXpThresholds[level - 1]; // threshold index for the current level boundary
}

/**
 * Returns progress (0–100) toward the next level.
 */
export function getProgressToNextLevel(totalXP: number): number {
  const level = calculateLevel(totalXP);
  if (level >= 55) return 100;
  const currentLevelXp = getXpForCurrentLevel(totalXP);
  const nextLevelXp = getXpForNextLevel(totalXP);
  const range = nextLevelXp - currentLevelXp;
  if (range <= 0) return 100;
  return Math.min(100, Math.max(0, ((totalXP - currentLevelXp) / range) * 100));
}
