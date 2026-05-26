// Phase layer — barrel + dispatchers.
//
// The per-set-piece logic lives in phases/<setpiece>.ts (kickoff, throwIn,
// goalKick, corner, foul, gkHold, celebration), each owning its tick budget,
// entry function(s), force field, and tick handler(s). Shared vocabulary
// (phase type, constants, force/callback contracts, clamp) is in phases/shared.
//
// This file re-exports the public surface and holds the two dispatchers that
// route by phase: `applyPhaseForces` (force computer, called from move.ts) and
// `tickPhase` (the phaseTicks===0 reducer, called from zoneEngine). The branch
// order and guards here mirror the original monolith exactly.

import type { Vec2, TeamSide } from '../types/match';
import type { EnginePlayer } from './zoneEngine';
import type { CarrierRole, PhaseForceCtx, PhaseCallbacks, MatchState } from './phases/shared';

import { applyCelebrationForces } from './phases/celebration';
import { applyThrowInForces, tickThrowInSetup, tickThrowInHolding, tickThrowInRelease } from './phases/throwIn';
import { applyGoalKickForces, tickGoalKickSetup, tickGoalKickHolding, tickGoalKickRelease } from './phases/goalKick';
import { applyCornerForces, tickCornerSetup, tickCornerHolding, tickCornerRelease } from './phases/corner';
import { applyFoulForces, applyExpulsionForces, tickFoulSetup, tickFoulHolding, tickFoulRelease, tickExpulsionHold, tickExpulsionWalk, tickExpulsionWalkout } from './phases/foul';
import { applyGkHoldForces, tickGkHolding, tickGkRelease } from './phases/gkHold';
import { applyKickoffForces, tickPostGoal, tickKickoffSetup } from './phases/kickoff';

// ── Public surface ─────────────────────────────────────────────────────────
export * from './phases/shared';
export { startCelebration } from './phases/celebration';
export { startThrowIn } from './phases/throwIn';
export { startGoalKick } from './phases/goalKick';
export { startCorner } from './phases/corner';
export { startGKHold } from './phases/gkHold';
export { resetKickoff } from './phases/kickoff';
export {
  startFoul, startExpulsion, isInPenaltyArea, distToGoalCenter_m,
  decideFoulShoot, isWallSet, computeWallTarget,
} from './phases/foul';

// ── applyPhaseForces dispatcher ──────────────────────────────────────────
// Mutates `force` (and sometimes `pvel`) in place; returns true if the phase
// consumed the decision so the caller skips its open-play branch.
export function applyPhaseForces(
  p: EnginePlayer,
  isGK: boolean,
  pSide: TeamSide,
  role: CarrierRole,
  base: Vec2,
  ppos: Vec2,
  pvel: Vec2,
  force: Vec2,
  ctx: PhaseForceCtx,
): boolean {
  const phase = ctx.phase;
  if (phase === 'celebration')
    return applyCelebrationForces(p, isGK, pSide, role, base, ppos, pvel, force, ctx);
  if (phase === 'throw_in_setup' || phase === 'throw_in_holding' || phase === 'throw_in_release')
    return applyThrowInForces(p, isGK, pSide, role, base, ppos, pvel, force, ctx);
  if (phase === 'goal_kick_setup' || phase === 'goal_kick_holding' || phase === 'goal_kick_release')
    return applyGoalKickForces(p, isGK, pSide, role, base, ppos, pvel, force, ctx);
  if (phase === 'corner_setup' || phase === 'corner_holding' || phase === 'corner_release')
    return applyCornerForces(p, isGK, pSide, role, base, ppos, pvel, force, ctx);
  if (phase === 'foul_setup' || phase === 'foul_holding' || phase === 'foul_release')
    return applyFoulForces(p, isGK, pSide, role, base, ppos, pvel, force, ctx);
  if (phase === 'expulsion_hold' || phase === 'expulsion_walk' || phase === 'expulsion_walkout')
    return applyExpulsionForces(p, isGK, pSide, role, base, ppos, pvel, force, ctx);
  if (phase === 'kickoff_setup')
    return applyKickoffForces(p, isGK, pSide, role, base, ppos, pvel, force, ctx);
  if (phase === 'gk_holding' || phase === 'gk_release')
    return applyGkHoldForces(p, isGK, pSide, role, base, ppos, pvel, force, ctx);
  return false;
}

// ── tickPhase dispatcher ───────────────────────────────────────────────────
// Runs when phaseTicks hits 0. The if/else chain (order + guards + the final
// fall-through to 'live') is identical to the original monolith; each branch
// body now lives in its set-piece slice.
export function tickPhase(state: MatchState, t: number, callbacks: PhaseCallbacks): void {
  const p = state.phase;
  if (state.pendingGoalScorer !== null) {
    tickPostGoal(state, t, callbacks);
  } else if (p === 'throw_in_setup' && state.kickerId) {
    tickThrowInSetup(state, t, callbacks);
  } else if (p === 'throw_in_holding' && state.ballOwner !== null) {
    tickThrowInHolding(state, t, callbacks);
  } else if (p === 'throw_in_release') {
    tickThrowInRelease(state, t, callbacks);
  } else if (p === 'kickoff_setup' && state.kickerId) {
    tickKickoffSetup(state, t, callbacks);
  } else if (p === 'goal_kick_setup' && state.kickerId) {
    tickGoalKickSetup(state, t, callbacks);
  } else if (p === 'goal_kick_holding' && state.ballOwner !== null) {
    tickGoalKickHolding(state, t, callbacks);
  } else if (p === 'goal_kick_release' && state.kickerId) {
    tickGoalKickRelease(state, t, callbacks);
  } else if (p === 'corner_setup' && state.kickerId) {
    tickCornerSetup(state, t, callbacks);
  } else if (p === 'corner_holding' && state.ballOwner !== null) {
    tickCornerHolding(state, t, callbacks);
  } else if (p === 'corner_release' && state.kickerId) {
    tickCornerRelease(state, t, callbacks);
  } else if (p === 'gk_holding' && state.ballOwner !== null) {
    tickGkHolding(state, t, callbacks);
  } else if (p === 'gk_release') {
    tickGkRelease(state, t, callbacks);
  } else if (p === 'foul_setup' && state.kickerId) {
    tickFoulSetup(state, t, callbacks);
  } else if (p === 'foul_holding' && state.ballOwner !== null) {
    tickFoulHolding(state, t, callbacks);
  } else if (p === 'foul_release' && state.kickerId) {
    tickFoulRelease(state, t, callbacks);
  } else if (p === 'expulsion_hold') {
    tickExpulsionHold(state, t, callbacks);
  } else if (p === 'expulsion_walk') {
    tickExpulsionWalk(state, t, callbacks);
  } else if (p === 'expulsion_walkout') {
    tickExpulsionWalkout(state, t, callbacks);
  } else {
    state.phase = 'live';
  }
}
