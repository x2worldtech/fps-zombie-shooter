/**
 * Level system utility — mirrors the backend XP threshold logic.
 * Levels 1–55, using the same hardcoded steep progression as the backend.
 * Index i = XP needed to advance from level (i+1) to level (i+2).
 */

// 55 thresholds matching backend hardXPThresholds exactly
export const levelXpThresholds: number[] = [
  1000,              // Level 1 → 2
  3000,              // Level 2 → 3
  9000,              // Level 3 → 4
  27000,             // Level 4 → 5
  81000,             // Level 5 → 6
  243000,            // Level 6 → 7
  729000,            // Level 7 → 8
  2187000,           // Level 8 → 9
  6560000,           // Level 9 → 10
  19000000,          // Level 10 → 11
  50000000,          // Level 11 → 12
  100000000,         // Level 12 → 13
  150000000,         // Level 13 → 14
  210000000,         // Level 14 → 15
  300000000,         // Level 15 → 16
  500000000,         // Level 16 → 17
  1000000000,        // Level 17 → 18
  2000000000,        // Level 18 → 19
  5000000000,        // Level 19 → 20
  10000000000,       // Level 20 → 21
  30000000000,       // Level 21 → 22
  60000000000,       // Level 22 → 23
  90000000000,       // Level 23 → 24
  150000000000,      // Level 24 → 25
  300000000000,      // Level 25 → 26
  500000000000,      // Level 26 → 27
  1000000000000,     // Level 27 → 28
  1800000000000,     // Level 28 → 29
  2500000000000,     // Level 29 → 30
  4000000000000,     // Level 30 → 31
  5700000000000,     // Level 31 → 32
  7500000000000,     // Level 32 → 33
  9000000000000,     // Level 33 → 34
  12000000000000,    // Level 34 → 35
  17000000000000,    // Level 35 → 36
  23000000000000,    // Level 36 → 37
  32000000000000,    // Level 37 → 38
  40000000000000,    // Level 38 → 39
  48000000000000,    // Level 39 → 40
  57000000000000,    // Level 40 → 41
  67000000000000,    // Level 41 → 42
  80000000000000,    // Level 42 → 43
  120000000000000,   // Level 43 → 44
  200000000000000,   // Level 44 → 45
  350000000000000,   // Level 45 → 46
  500000000000000,   // Level 46 → 47
  850000000000000,   // Level 47 → 48
  1050000000000000,  // Level 48 → 49
  1500000000000000,  // Level 49 → 50
  3000000000000000,  // Level 50 → 51
  5000000000000000,  // Level 51 → 52
  10000000000000000, // Level 52 → 53
  30000000000000000, // Level 53 → 54
  80000000000000000, // Level 54 → 55
];

/**
 * Returns the current level (1–55) for a given total XP amount.
 * Mirrors the backend binary-search calculateLevel logic.
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
  return levelXpThresholds[level - 2];
}

/**
 * Returns the XP threshold needed to reach the next level.
 * Returns Infinity if already at max level.
 */
export function getXpForNextLevel(totalXP: number): number {
  const level = calculateLevel(totalXP);
  if (level >= 55) return Infinity;
  return levelXpThresholds[level - 1];
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
