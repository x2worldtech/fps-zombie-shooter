# Specification

## Summary
**Goal:** Improve the 3D zombie models in the FPS Zombie Shooter to look like Call of Duty-style zombies with more detailed geometry, necrotic aesthetics, and iconic lurching animations.

**Planned changes:**
- Redesign the `StandardZombie` mesh in `EnemyMesh.tsx` with separate head, torso, arms, and legs segments; skull-like head with sunken/hollow eye sockets; torn dark-brown/black clothing geometry; pale greenish-grey toon-shaded skin; dark red blood accents
- Redesign the `BossZombie` mesh in `EnemyMesh.tsx` with a bulkier/larger body, asymmetric oversized shoulders and elongated arms, deformed enlarged skull, emissive glowing red eye geometry, exposed rib/bone geometry on the chest, and a darker decayed skin tone
- Add a forward torso lean (~15–25 degrees) and side-to-side arm sway/lurch animation to both zombie types, driven by the existing `useFrame` animation system
- Preserve all existing hit flash, death fade, and walking bob animation logic

**User-visible outcome:** Both zombie types now look and move like classic Call of Duty-style undead enemies, with detailed necrotic geometry, torn clothing, glowing boss eyes, and an iconic lurching walk animation.
