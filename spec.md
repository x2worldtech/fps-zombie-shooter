# Specification

## Summary
**Goal:** Significantly increase the XP thresholds required for each player level-up (levels 1–55) so that progression takes considerably longer, with steeply scaling costs at higher levels.

**Planned changes:**
- Update the backend XP/level progression system with much higher, steeply scaling XP thresholds for all 55 levels (at least 2–3× higher overall).
- Update `frontend/src/utils/levelSystem.ts` to mirror the new backend XP thresholds exactly for all 55 levels.

**User-visible outcome:** Players need substantially more XP to level up, with higher levels requiring disproportionately more XP. The PlayerProfile screen (level display, XP progress bar, XP boundaries) correctly reflects the new thresholds.
