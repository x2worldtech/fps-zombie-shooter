// ─── Ragdoll Pose Computation ────────────────────────────────────────────────
// Procedural Ragdoll — keine Physics-Engine. Bestimmt Pose anhand:
//  - elapsed: vergangene Zeit seit Tod (Sek)
//  - hitDirX, hitDirZ: normalisierte Welt-Richtung in die der Körper kippt
//  - groupYaw: aktueller Yaw der Wurzel-Group (für lokale Fall-Richtung)
//  - groundY: Y-Höhe des Bodens für die Wurzel-Group (wo sie hin sinkt)
//  - startY: Y-Höhe der Wurzel-Group beim Lebend-Zustand
//  - seed: Zufalls-Seed für leichte Pose-Variation pro Zombie
//
// Liefert Bone-/Group-Rotationen die EnemyMesh direkt auf die Refs anwendet.
// ─────────────────────────────────────────────────────────────────────────────

export interface RagdollPose {
  /** Welt-Yaw der Wurzel-Group (override) */
  groupYaw: number;
  /** Wurzel-Group Y-Position (interpoliert zwischen Stand- und Boden-Höhe) */
  groupY: number;
  /** Wurzel-Group X- und Z-Rotation für das Umkippen */
  groupPitch: number;
  groupRoll: number;
  /** Torso lokal (relativ zur Wurzel-Group) — leicht eingeknickt nach vorn */
  torsoPitch: number;
  torsoRoll: number;
  /** Kopf lokal — fällt nach unten/zur Seite */
  headPitch: number;
  headRoll: number;
  /** Arme — fallen schlaff, ziehen leicht in Fallrichtung */
  leftArmPitch: number;
  leftArmRoll: number;
  rightArmPitch: number;
  rightArmRoll: number;
  /** Beine — knicken in den Knien, gehen leicht in Spagat */
  leftLegPitch: number;
  leftLegRoll: number;
  rightLegPitch: number;
  rightLegRoll: number;
}

// Easing: ease-out cubic — anfangs schneller Fall, dann sanft auslaufen
function easeOutCubic(t: number): number {
  const c = 1 - t;
  return 1 - c * c * c;
}

// Hash-basiertes Pseudo-Rand für stabile Variation pro (seed, channel)
function hash01(seed: number, ch: number): number {
  const x = Math.sin(seed * 12.9898 + ch * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * Tuning: Standard-Zombie Body-Höhe (ungefähr). Bestimmt wie tief der
 * Wurzel-Group beim Umfallen sinkt. Standard-Zombie steht bei y=1.2, im Liegen
 * ist die Wurzel-Group nahe am Boden (~0.25), damit Torso flach auf dem Boden
 * ruht. Boss steht bei y=1.5, im Liegen bei ~0.35.
 */
export function computeRagdollPose(
  elapsedSec: number,
  hitDirX: number,
  hitDirZ: number,
  initialYaw: number,
  startY: number,
  groundLyingY: number,
  seed: number,
  isBoss: boolean,
): RagdollPose {
  // Normalisierter Animations-Fortschritt 0..1
  const DURATION = 0.9; // Sekunden — muss zu RAGDOLL_DURATION_MS passen (900)
  const t = Math.min(1, Math.max(0, elapsedSec / DURATION));
  const e = easeOutCubic(t);

  // Welt-Fall-Richtung → in die Yaw der Wurzel-Group projizieren, damit wir
  // Pitch (vorwärts/rückwärts) und Roll (links/rechts) RELATIV zum Yaw bekommen.
  // Lebend hatte der Zombie sich zum Spieler ausgerichtet — initialYaw bleibt
  // im Tod als Roation.y bestehen.
  // forward des Zombies in Welt: (sin(yaw), cos(yaw)). right = (cos(yaw), -sin(yaw)).
  const fwdX = Math.sin(initialYaw);
  const fwdZ = Math.cos(initialYaw);
  const rgtX = Math.cos(initialYaw);
  const rgtZ = -Math.sin(initialYaw);
  // Dot-Products: wie stark fällt der Körper vorwärts vs. seitlich
  const fwdDot = hitDirX * fwdX + hitDirZ * fwdZ; // -1 = rückwärts, +1 = vorwärts
  const rgtDot = hitDirX * rgtX + hitDirZ * rgtZ; // -1 = links, +1 = rechts

  // Wurzel-Group: kippt um Pitch (vor/zurück) und Roll (seitlich).
  // Gesamt-Magnitude ~90° (π/2). Aufgeteilt nach Dot-Products.
  const totalTilt = (Math.PI / 2) * e;
  const groupPitch = totalTilt * fwdDot;
  const groupRoll = totalTilt * rgtDot;

  // Wurzel-Group sinkt zum Boden. Y interpoliert von startY zu groundLyingY.
  const groupY = startY + (groundLyingY - startY) * e;
  const groupYaw = initialYaw;

  // ── Limb-Posen (lokal) ──
  // Während der Animation kollabieren die Limbs aus der Lauf-Pose in die
  // Liege-Pose. Wir nehmen einfache Ziel-Werte und lerpen via `e` dorthin.
  //
  // Torso: knickt leicht nach vorne ein, damit der Bauch durchhängt
  const torsoTargetPitch = 0.15;
  const torsoTargetRoll = (hash01(seed, 1) - 0.5) * 0.2;
  // Kopf: kippt zur Seite und nach vorne, hängt schlaff
  const headTargetPitch = 0.4 + hash01(seed, 2) * 0.3;
  const headTargetRoll = (hash01(seed, 3) - 0.5) * 0.8;

  // Arme: kollabieren von "Zombie-Reach" (pitch ≈ -1.1) in schlaffe Hänge-Pose
  // Je nach Fallrichtung leicht asymmetrisch — der "obere" Arm fällt früher,
  // der "untere" wird unter den Körper geklemmt
  const armBase = 0.2 + hash01(seed, 4) * 0.3; // hängt leicht nach unten/seitlich
  const leftArmTargetPitch = armBase + rgtDot * 0.2;
  const leftArmTargetRoll = 0.4 + (hash01(seed, 5) - 0.5) * 0.4;
  const rightArmTargetPitch = armBase - rgtDot * 0.2;
  const rightArmTargetRoll = -0.4 + (hash01(seed, 6) - 0.5) * 0.4;

  // Beine: knicken in den Knien (wir haben aber nur eine Pitch-Achse pro Bein
  // im Mesh — also Bein klappt im Hüftgelenk leicht nach vorn). Spagat-
  // Variation gibt Realismus.
  const legSpread = (hash01(seed, 7) - 0.5) * 0.4;
  const leftLegTargetPitch = 0.3 + hash01(seed, 8) * 0.3 + fwdDot * 0.2;
  const leftLegTargetRoll = legSpread;
  const rightLegTargetPitch = 0.3 + hash01(seed, 9) * 0.3 + fwdDot * 0.2;
  const rightLegTargetRoll = -legSpread;

  // Limb-Easing leicht versetzt — Kopf und Arme fallen früher als die Beine,
  // damit es kaskadiert wirkt. Wir nutzen verschobene t-Werte mit Clamp.
  const tHead = Math.min(1, t * 1.3);
  const tArms = Math.min(1, t * 1.15);
  const tLegs = Math.min(1, t * 0.95);
  const eHead = easeOutCubic(tHead);
  const eArms = easeOutCubic(tArms);
  const eLegs = easeOutCubic(tLegs);

  // Boss-Anpassung: bulligerer Körper sinkt etwas anders — slight tweak nur
  // an Torso-Pitch, damit der dicke Bauch "ankommt"
  const bossTorsoBoost = isBoss ? 0.1 : 0;

  return {
    groupYaw,
    groupY,
    groupPitch,
    groupRoll,
    torsoPitch: torsoTargetPitch * e + bossTorsoBoost * e,
    torsoRoll: torsoTargetRoll * e,
    headPitch: headTargetPitch * eHead,
    headRoll: headTargetRoll * eHead,
    leftArmPitch: leftArmTargetPitch * eArms,
    leftArmRoll: leftArmTargetRoll * eArms,
    rightArmPitch: rightArmTargetPitch * eArms,
    rightArmRoll: rightArmTargetRoll * eArms,
    leftLegPitch: leftLegTargetPitch * eLegs,
    leftLegRoll: leftLegTargetRoll * eLegs,
    rightLegPitch: rightLegTargetPitch * eLegs,
    rightLegRoll: rightLegTargetRoll * eLegs,
  };
}
