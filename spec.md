# Specification

## Summary
**Goal:** Fix the Start Game flow and ESC pause menu behavior in the FPS Zombie Shooter so that starting a game enters gameplay directly without a pause overlay, and ESC correctly toggles the pause state during gameplay.

**Planned changes:**
- Ensure clicking "Start Game" from the main menu transitions to active gameplay with the PauseOverlay hidden and no pause state active.
- Implement ESC key toggle during active gameplay: pressing ESC pauses the game (freezes enemies, timers, player actions) and shows PauseOverlay; pressing ESC again or clicking resume dismisses the overlay and resumes all game systems.
- Restrict ESC key pause behavior so it has no effect on the main menu or game-over screen.

**User-visible outcome:** Players can click "Start Game" and immediately begin playing without any pause menu appearing. During gameplay, pressing ESC pauses the game and shows the pause overlay; pressing ESC again or clicking resume continues the game normally.
