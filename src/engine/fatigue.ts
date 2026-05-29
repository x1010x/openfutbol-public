import type { MatchState } from './types';

// In-match stamina decay (Bloque 2). The arrival fitness scaling
// (engineStatsFromPlayer) decides how athletic a player STARTS the match; this
// models them tiring as it runs. Effective speed/physical decay linearly with
// time on the pitch, scaled by how well the player endures: a high-endurance
// player barely slows (~6% by full time), a low-endurance one drops more
// (~22%). Technical stats (passing/shooting/dribbling/defending/goalkeeping)
// are left untouched — skill holds up under fatigue, legs don't (same rationale
// as the pre-match scaling in managerBridge).
//
// Endurance combines two things 50/50: the físico (enduranceBase, a permanent
// stat = how well the player lasts 90') modulated by the day's freshness
// (stamina, the current condition they arrive with). So a fit player who turns
// up tired still tires a bit faster, but the físico is what mainly decides
// staying power — not just how rested they happen to be today.
//
// Deterministic (no RNG): it never touches the random stream, so re-running
// generateTimeline with the same inputs reproduces the same timeline head — the
// Bloque 8 live-change replay stays exact.
//
// Self-initialising per player: the first tick a player is seen we capture its
// current (already arrival-scaled) speed/physical as the decay base and record
// its entry tick. Substitutes therefore tire from their OWN clock — a fresh sub
// who comes on at minute 70 is barely tired — with no extra wiring in
// applySubstitution.

// Fraction of speed/physical lost over a FULL match for a given endurance
// (0–99): e=99 → 0.06, e=0 → 0.22. Modest and directional, as the handoff
// intends.
function maxDrop(endurance: number): number {
  const e = Math.max(0, Math.min(99, endurance)) / 99;
  return 0.06 + 0.16 * (1 - e);
}

export function applyFatigue(state: MatchState, tick: number, totalTicks: number): void {
  if (totalTicks <= 0) return;
  for (const p of state.allPlayers) {
    if (p.baseSpeed === undefined) {
      p.baseSpeed = p.speed;
      p.basePhysical = p.physical;
      p.enteredTick = tick;
    }
    // Endurance = físico (permanent staying power) and the day's freshness,
    // averaged. Fall back to stamina (then 99) when físico isn't supplied.
    const fresh = p.stamina ?? 99;
    const endurance = 0.5 * (p.enduranceBase ?? fresh) + 0.5 * fresh;
    const played = Math.max(0, tick - (p.enteredTick ?? 0));
    const frac = Math.min(1, played / totalTicks);
    const factor = 1 - maxDrop(endurance) * frac;
    p.speed = (p.baseSpeed ?? p.speed) * factor;
    p.physical = (p.basePhysical ?? p.physical) * factor;
  }
}
