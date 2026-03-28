# FPS Zombie Shooter – UI Overhaul & Space Asteroid Background

## Current State
- MainMenu uses Oswald font, CoD-style plain text menu items, explosion glow + 60 debris particles as background animation
- ControlsScreen, PlayerProfile, Leaderboard, GameOver all use old Borderlands/toon style: `font-bangers`, `toon-btn` CSS classes, comic outlines (WebkitTextStroke thick), blocky box borders, emoji-heavy headers
- None of the secondary menus match the premium cinematic AAA look of the main menu

## Requested Changes (Diff)

### Add
- Space/asteroid background to the MainMenu: deep space (near-black with subtle star field), large rocky asteroids of varying sizes tumbling through space with rotation animation, smaller asteroid debris/rocks also drifting, subtle nebula glow in background. Replaces the current orange explosion glow + flat debris particles.

### Modify
- **ControlsScreen**: Remove all toon/Borderlands styling. Apply CoD zombie premium style: dark #060606 background, Oswald font for headings, Sora/system for body, military panel aesthetic, sharp clean borders (1-2px solid dark red or white at low opacity), no thick WebkitTextStroke, no comic outlines. Back button styled like main menu nav items (plain text with hover glow) or a clean military button.
- **PlayerProfile**: Same premium style overhaul. Remove font-bangers/toon-btn. Use Oswald for headings, Sora for data. XP bar gets a sleek PBR-style look. StatCards redesigned without box-shadow comic offsets.
- **Leaderboard**: Same premium style overhaul. Remove font-bangers/toon-btn. Clean dark panel, Oswald titles, Sora rows, gold/silver/bronze accents kept but styled cleanly without comic outlines.
- **GameOver**: Same premium style overhaul. GAME OVER title in large Oswald, blood-red color, glow effect (text-shadow) NOT WebkitTextStroke comic style. Stats panel sleek. Buttons clean military style.
- All menus share a consistent dark atmospheric background (deep black + subtle dark red/amber radial glow) to match the main menu aesthetic.

### Remove
- All `font-bangers` usage in secondary menus
- All `toon-btn`, `toon-btn-red`, `toon-btn-yellow`, `toon-btn-green` class usage in secondary menus
- All `WebkitTextStroke` thick comic outlines in secondary menus
- All `boxShadow: "8px 8px 0"` hard-offset comic shadows
- Orange explosion glow in MainMenu background
- Flat dark 2D debris particles in MainMenu (replaced by 3D-style asteroid objects)

## Implementation Plan
1. Overhaul MainMenu debris background: replace 60 flat debris divs with asteroid objects — varied polygon shapes (using CSS clip-path or border-radius combinations), rotation animations, varying speeds, sizes (small/medium/large), subtle rock texture via box-shadow and gradients, on a deep space background with small star dots
2. Overhaul ControlsScreen: apply premium dark CoD style throughout
3. Overhaul PlayerProfile: apply premium dark CoD style throughout
4. Overhaul Leaderboard: apply premium dark CoD style throughout
5. Overhaul GameOver: apply premium dark CoD style throughout
6. Ensure all menus use Oswald (headings/titles) + Sora or system-ui (body text), consistent color palette (white text, dark red accents #7a0f0f, orange highlights #FF7A00)
