// Engine-facing attribute traits, derived once (in the bridge) from the
// manager's 36 FM-style PlayerAttributes (1-20). Each trait is a 0..1 composite
// shaped for a specific decision the zone engine makes, so the full match sim
// reads richer signals than the flat 7-stat shim (PlayerStats) ever could —
// pace vs acceleration, finishing vs long shots, marking vs tackling, etc.
//
// IMPORTANT (sandbox determinism): EnginePlayer.attr is OPTIONAL. The sandbox
// presets build EnginePlayers from the 7 stats only (no attr), so every effector
// reads `p.attr?.trait ?? <legacy 7-stat expression>`. With attr absent the
// composites are bypassed and the legacy formula runs unchanged → scenario
// timelines stay byte-for-byte identical. No trait introduces RNG.
import type { PlayerAttributes } from '../data/playerAttributes';

export interface EngineAttributes {
  // Attacking
  finishingSkill: number; // shot accuracy / conversion (incl. heading)
  shotPower: number;      // pace + reach on the strike (long shots)
  penaltySkill: number;   // penalty conversion
  setPieceSkill: number;  // direct free-kick quality
  passSkill: number;      // ground/through pass success + selection
  crossSkill: number;     // delivery into the box
  dribbleSkill: number;   // beating a man 1v1
  // Defending
  tackleSkill: number;        // winning the ball in a challenge
  markSkill: number;          // off-ball positioning / reading
  tackleCleanliness: number;  // NOT giving away the foul (high = clean)
  // Athletic
  acceleration: number;   // burst over a few metres (catching/escaping)
  topSpeed: number;       // sustained running speed
  strength: number;       // physical component of a duel (incl. aerial)
  resilience: number;     // resisting injury from a hard challenge
  // Goalkeeping
  gkReflex: number;       // shot-stopping reaction / reach
}

const n = (v: number) => Math.max(0, Math.min(1, v / 20));

// Weighted blend of normalised (0..1) attributes. Weights are expected to sum
// to 1 so the result stays in 0..1 and is comparable to the legacy stat/99.
const mix = (...pairs: [number, number][]) =>
  pairs.reduce((s, [w, v]) => s + w * v, 0);

export function engineAttributesFrom(a: PlayerAttributes): EngineAttributes {
  const t = a.technical, m = a.mental, p = a.physical;
  return {
    finishingSkill: mix(
      [0.42, n(t.finishing)], [0.20, n(m.composure)], [0.18, n(t.technique)], [0.20, n(t.heading)],
    ),
    shotPower: mix(
      [0.55, n(t.longShots)], [0.30, n(t.finishing)], [0.15, n(p.strength)],
    ),
    penaltySkill: mix(
      [0.60, n(t.penaltyTaking)], [0.40, n(m.composure)],
    ),
    setPieceSkill: mix(
      [0.55, n(t.freeKicks)], [0.25, n(t.technique)], [0.20, n(t.finishing)],
    ),
    passSkill: mix(
      [0.42, n(t.passing)], [0.24, n(m.decisions)], [0.18, n(m.vision)], [0.16, n(t.technique)],
    ),
    crossSkill: mix(
      [0.55, n(t.crossing)], [0.25, n(t.technique)], [0.20, n(t.firstTouch)],
    ),
    dribbleSkill: mix(
      [0.38, n(t.dribbling)], [0.20, n(p.agility)], [0.16, n(t.firstTouch)], [0.14, n(p.balance)], [0.12, n(m.flair)],
    ),
    tackleSkill: mix(
      [0.60, n(t.tackling)], [0.22, n(m.anticipation)], [0.18, n(p.strength)],
    ),
    markSkill: mix(
      [0.40, n(t.marking)], [0.30, n(m.positioning)], [0.20, n(m.anticipation)], [0.10, n(m.concentration)],
    ),
    // High aggression lowers cleanliness → more fouls conceded.
    tackleCleanliness: mix(
      [0.40, n(t.tackling)], [0.28, n(m.composure)], [0.17, n(m.anticipation)], [0.15, 1 - n(m.aggression)],
    ),
    acceleration: mix(
      [0.60, n(p.acceleration)], [0.40, n(p.pace)],
    ),
    topSpeed: mix(
      [0.60, n(p.pace)], [0.40, n(p.acceleration)],
    ),
    strength: mix(
      [0.60, n(p.strength)], [0.25, n(p.jumping)], [0.15, n(m.bravery)],
    ),
    resilience: mix(
      [0.45, n(p.strength)], [0.30, n(p.naturalFitness)], [0.25, n(m.bravery)],
    ),
    gkReflex: mix(
      [0.30, n(p.agility)], [0.22, n(m.anticipation)], [0.18, n(m.concentration)], [0.16, n(m.positioning)], [0.14, n(m.composure)],
    ),
  };
}
