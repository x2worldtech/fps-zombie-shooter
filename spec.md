# Specification

## Summary
**Goal:** Fix the in-game audio system so all sound effects play correctly during gameplay.

**Planned changes:**
- Diagnose and fix the Web Audio API `AudioContext` initialization in `audioSynthesis.ts` and/or `useGameAudio.ts`
- Ensure the `AudioContext` is properly resumed after the first user gesture (click/keypress) to satisfy browser autoplay policies
- Wire up all synthesized sound callbacks to the correct game events in `GameScene.tsx`: gunshots (pistol, shotgun, assault rifle), zombie growls, player hit, pickup collected, wave start, and wave cleared

**User-visible outcome:** All in-game sound effects play at the correct moments during gameplay after the first user interaction, with no audio-related console errors.
