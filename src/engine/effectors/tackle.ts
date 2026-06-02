// Tackling and off-ball aggression. checkTackle runs whenever a defender is
// within range of the carrier; checkOffBallAggression runs every tick for
// defenders inside a post-failed-tackle provocation window. Both delegate the
// foul consequences to executeFoul.

import type { TeamSide } from '../../types/match';
import type { MatchState } from '../types';
import type { EnginePlayer } from '../zoneEngine';
import { foulCommitted } from '../duels';
import { emit as stateEmit, snap as stateSnap, roleOf } from '../state';
import { executeFoul } from './foul';
import { clamp, KICK_FREEZE_MS } from './shared';
import type { EffectorDeps } from './shared';

const TACKLE_DIST       = 0.035;
const TRANSITION_TICKS  = 6;
// Fase 5 — off-ball aggression by provocation
const AGGRESSION_WINDOW_MS = 3000;
const AGGRESSION_TICK_PROB = 0.005;
const AGGRESSION_RADIUS    = 0.06;

export function checkTackle(state: MatchState, t: number, deps: EffectorDeps): boolean {
  const carrier = state.playerMap.get(state.carrierId)!;
  const cSide: TeamSide = state.homeSet.has(state.carrierId) ? 'home' : 'away';
  const opps = cSide === 'home' ? state.awayPlayers : state.homePlayers;

  for (const opp of opps) {
    if (opp.slotIndex === 0) continue;
    if (state.expelledIds.has(opp.id)) continue;
    const d = Math.hypot(state.pos[opp.id].x - state.ball.x, state.pos[opp.id].y - state.ball.y);
    if (d > TACKLE_DIST) continue;

    // Challenge outcome: tackling/strength (defender) vs dribbling/acceleration
    // (carrier). FM traits when present, flat stats otherwise.
    const defRating = opp.attr ? opp.attr.tackleSkill * 0.65 + opp.attr.strength * 0.35
                               : (opp.defending * 0.65 + opp.physical * 0.35) / 99;
    const atkRating = carrier.attr ? carrier.attr.dribbleSkill * 0.60 + carrier.attr.acceleration * 0.40
                                   : (carrier.dribbling * 0.60 + carrier.speed * 0.40) / 99;
    const tackleProb = clamp(0.30 + (defRating - atkRating) * 0.55, 0.08, 0.78);

    if (state.rng() < tackleProb) {
      // Cleanliness (tackling/composure/anticipation, less aggression) decides
      // whether the won challenge is a clean tackle or a foul. Higher → cleaner.
      if (foulCommitted(state.rng, opp.attr ? opp.attr.tackleCleanliness * 99 : opp.physical)) {
        // Anchor the ball before executeFoul moves things: the carrier-follow
        // offset puts state.ball ~0.022 ahead of the carrier, so a snap here
        // before the spot is fixed avoids a visible ball jump back to the
        // carrier's pos at the same t.
        stateSnap(state, t);
        executeFoul(state, t, opp.id, carrier.id);
      } else {
        const newSide: TeamSide = cSide === 'home' ? 'away' : 'home';
        stateEmit(state, t, 'tackle_won', newSide, opp.id, carrier.id, '¡Robo de balón!');
        deps.setCarrier(opp.id, newSide);
        // Transfer physical ball ownership so moveAll ball-follow and the next
        // checkTackle use the correct carrier. Without this, state.ball keeps
        // following the old carrier for the whole transition window and
        // checkTackle fires a phantom tackle/foul on the new carrier immediately.
        state.ballOwner = opp.id;
        state.ball = { ...state.pos[opp.id] };
        // Freeze the old carrier briefly so they can't be detected as a
        // tackler again while still standing on top of the new carrier.
        state.kickFrozenUntil.set(carrier.id, t + KICK_FREEZE_MS);
        state.vel[carrier.id] = { x: 0, y: 0 };
        state.kickFrozenUntil.set(opp.id, t + KICK_FREEZE_MS);
        state.vel[opp.id] = { x: 0, y: 0 };
        stateSnap(state, t);
        state.phase = 'transition';
        state.phaseTicks = TRANSITION_TICKS;
      }
      return true;
    } else {
      // Tackle attempted but the carrier escaped — the defender enters a
      // short provocation window. checkOffBallAggression (run from the
      // zoneEngine tick loop) will give them a low per-tick chance of
      // committing an off-ball reckless foul during this window. The
      // provocation only "counts" for defenders who got close enough to
      // attempt a tackle in the first place, not just anyone nearby.
      if (roleOf(state, opp) !== 'gk') {
        state.aggressionWindowUntil.set(opp.id, t + AGGRESSION_WINDOW_MS);
      }
    }
  }
  return false;
}

// Per-tick check for off-ball aggression. Iterates defenders currently inside
// their provocation window (set by a failed tackle) and rolls a low per-tick
// probability that they lash out at the nearest rival. Returns true if an
// aggression fired (caller should short-circuit the rest of the tick — the
// match phase has flipped to expulsion_walk). v1 only fires during open play
// and only produces straight reds (severity = 'reckless').
export function checkOffBallAggression(state: MatchState, t: number, deps: EffectorDeps): boolean {
  if (state.phase !== 'live') return false;
  if (state.aggressionWindowUntil.size === 0) return false;

  // Drop expired entries opportunistically so the map doesn't grow unbounded.
  for (const [id, until] of state.aggressionWindowUntil) {
    if (t >= until) state.aggressionWindowUntil.delete(id);
  }

  for (const [defId, until] of state.aggressionWindowUntil) {
    if (t >= until) continue;
    const def = state.playerMap.get(defId);
    if (!def || state.expelledIds.has(defId)) continue;
    if (roleOf(state, def) === 'gk') continue;
    const defSide: TeamSide = state.homeSet.has(defId) ? 'home' : 'away';
    // Only defending team — once we have possession back, the provocation
    // window goes stale (we're attacking now). Cheap conceptual gate.
    if (state.possession === defSide) continue;

    // Find nearest rival on the pitch. Excludes the GK and any already
    // expelled players.
    const dpos = state.pos[defId];
    const opps = defSide === 'home' ? state.awayPlayers : state.homePlayers;
    let victim: EnginePlayer | null = null;
    let bestD = Infinity;
    for (const o of opps) {
      if (state.expelledIds.has(o.id)) continue;
      if (o.slotIndex === 0) continue;
      // "Off-ball" aggression — by definition the carrier isn't the victim
      // (a tackler-on-carrier foul goes through checkTackle's normal path
      // instead). Excluding both ballOwner and carrierId covers loose-ball
      // moments where the engine has set one but not the other.
      if (o.id === state.ballOwner) continue;
      if (o.id === state.carrierId) continue;
      const d = Math.hypot(state.pos[o.id].x - dpos.x, state.pos[o.id].y - dpos.y);
      if (d < bestD) { bestD = d; victim = o; }
    }
    if (!victim || bestD > AGGRESSION_RADIUS) continue;
    // Aggressive players (high FM aggression, low composure) are likelier to
    // lash out off the ball. Scale the per-tick chance by the defender's
    // aggression trait (≈0.5×..1.5×); legacy data with no attr keeps ×1, so the
    // rng() draw is still consumed once per tick and sandbox stays identical.
    const aggMult = def.attr ? 1.5 - def.attr.tackleCleanliness : 1;
    if (state.rng() >= AGGRESSION_TICK_PROB * aggMult) continue;

    // Aggression fires. Delegate everything (injury roll, card decision,
    // pendingFoul stash, walk-off start, events) to executeFoul with the
    // severity pinned to 'reckless' so the card decision tree always returns
    // a straight red.
    state.aggressionWindowUntil.delete(defId);
    // Drop the ball if someone was carrying it — startExpulsion zeroes its
    // velocity but the original carrier still needs the global carry counter
    // reset so the new ball-receiver after the walk-off gets a clean slate.
    if (state.ballOwner !== null) {
      const oldOwner = state.playerMap.get(state.ballOwner);
      if (oldOwner) deps.resetCarry(oldOwner);
    }
    stateSnap(state, t);
    executeFoul(state, t, defId, victim.id, { forceSeverity: 'reckless' });
    return true;
  }
  return false;
}
