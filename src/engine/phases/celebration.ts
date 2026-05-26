// Celebration phase: after a valid goal, the scoring side drifts toward the
// goal while everyone else springs to their formation base. The ball is
// settled into the net by simulateBallSettling (ballPhysics), not here.

import type { Vec2, TeamSide } from '../../types/match';
import type { EnginePlayer } from '../zoneEngine';
import { spring } from '../forces';
import { CELEBRATION_TICKS } from './shared';
import type { CarrierRole, PhaseForceCtx, MatchState } from './shared';

export function applyCelebrationForces(
  _p: EnginePlayer,
  _isGK: boolean,
  pSide: TeamSide,
  _role: CarrierRole,
  base: Vec2,
  ppos: Vec2,
  _pvel: Vec2,
  force: Vec2,
  ctx: PhaseForceCtx,
): boolean {
  const { celebSide, celebGoalPos } = ctx;
  const target = pSide === celebSide
    ? { x: celebGoalPos.x, y: celebGoalPos.y + (base.y - celebGoalPos.y) * 0.5 }
    : base;
  const sf = spring(ppos, target, 0.05);
  force.x += sf.x;
  force.y += sf.y;
  return true;
}

export function startCelebration(state: MatchState, scorerSide: TeamSide, goalPos: Vec2, extraDrag: number = 1): void {
  state.intendedReceiver = null;
  state.score[scorerSide]++;
  // Heavy damping. The previous 0.40/0.45 multipliers let the ball keep
  // moving fast enough that steep top-corner goals would carry the ball
  // upward into the inside-top-of-net clamp (yMin=0.428), bouncing it back
  // — visually reading as "ball passes through the goal and comes back".
  // 0.10/0.15 keeps the ball drifting into the net softly so the entry
  // looks like a settle, not a rebound.
  state.ballVel.x *= 0.10 * extraDrag;
  state.ballVel.y *= 0.10 * extraDrag;
  state.ballHeightVel *= 0.15 * extraDrag;
  state.phase = 'celebration';
  state.celebSide = scorerSide;
  state.celebGoalPos = goalPos;
  state.phaseTicks = CELEBRATION_TICKS;
  state.pendingGoalScorer = scorerSide;
}
