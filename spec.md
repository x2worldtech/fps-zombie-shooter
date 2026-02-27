# Specification

## Summary
**Goal:** Improve the three existing weapon models (pistol, shotgun, machine gun/assault rifle) in the FPS Zombie Shooter to more closely resemble real-world firearms with detailed geometry, while preserving the existing toon/Borderlands art style.

**Planned changes:**
- Redesign the pistol model in `WeaponViewModel.tsx` with a distinct slide, ejection port cutout, serrated grip geometry, curved trigger guard, barrel with muzzle opening, and proportions matching a real 9mm semi-automatic handgun
- Redesign the shotgun model in `WeaponViewModel.tsx` with a long cylindrical barrel, ventilated rib, pump/forend piece, boxy receiver with loading port, and proportions matching a real pump-action 12-gauge
- Redesign the assault rifle model in `WeaponViewModel.tsx` with a rectangular receiver, angled detachable box magazine, segmented handguard rails, flash hider, pistol grip, and charging handle matching a real assault rifle
- Apply consistent toon shading with Borderlands-style dark outlines to all new weapon sub-parts so details (ejection ports, rails, trigger guards) are clearly visible

**User-visible outcome:** All three weapons display with significantly more realistic and detailed 3D geometry in first-person view, with small parts like ejection ports, rails, and trigger guards clearly visible and outlined in the existing toon art style.
