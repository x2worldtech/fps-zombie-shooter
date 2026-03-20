# FPS Zombie Shooter

## Current State
The game has three weapon sounds synthesized via Web Audio API in `audioSynthesis.ts`. The machine gun (`assaultRifleShot`) was previously upgraded to a 5-layer sound with sub-bass thud, mid-frequency punch, sharp crack, noise sweep, and mechanical bolt clank. The pistol and shotgun sounds are still using the old simple 2-layer implementation.

## Requested Changes (Diff)

### Add
- Nothing new

### Modify
- `pistolShot()`: Upgrade from 2-layer to 5-layer system — sharp crack, mechanical slide, sub-bass pop, high-freq snap, and ejected brass clink for a realistic Beretta M9 sound
- `shotgunShot()`: Upgrade from 2-layer to 5-layer system — massive sub-bass boom, mid-body explosion noise, sharp pellet crack, low-rumble tail, and pump-action mechanical clank

### Remove
- Nothing

## Implementation Plan
1. Rewrite `pistolShot()` with 5 audio layers for impact and realism
2. Rewrite `shotgunShot()` with 5 audio layers for massive impact and bass depth
