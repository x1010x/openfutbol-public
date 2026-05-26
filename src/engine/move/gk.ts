// Goalkeeper movement forces. The GK is line-locked in X (handled in moveAll's
// integration) and here computes its Y target: predictive shot-tracking with a
// dive commit when a shot is on target, ball-watching in the box otherwise.

import type { Vec2, TeamSide } from '../../types/match';
import type { MatchState } from '../types';
import type { EnginePlayer } from '../zoneEngine';
import { emit as stateEmit } from '../state';

const DIVE_DURATION_MS = 750;

function clamp(v: number, lo: number, hi: number) { return v < lo ? lo : v > hi ? hi : v; }

export function predictBallCrossY(state: MatchState, myGoalX: number): number | null {
  if (Math.abs(state.ballVel.x) < 0.002) return null;
  if (Math.sign(myGoalX - state.ball.x) !== Math.sign(state.ballVel.x)) return null;
  let bx = state.ball.x, by = state.ball.y, vx = state.ballVel.x, vy = state.ballVel.y;
  for (let i = 0; i < 40; i++) {
    bx += vx; by += vy;
    vx *= 0.96; vy *= 0.96;
    if ((myGoalX < 0.5 && bx <= myGoalX) || (myGoalX > 0.5 && bx >= myGoalX)) {
      return by;
    }
    if (Math.abs(vx) < 0.001) return null;
  }
  return null;
}

export function applyGKForces(
  p: EnginePlayer,
  isHome: boolean,
  pSide: TeamSide,
  ppos: Vec2,
  base: Vec2,
  state: MatchState,
  t: number,
  force: Vec2,
): void {
  force.x += (base.x - ppos.x) * 0.30;

  const myGoalX = isHome ? 0.0 : 1.0;
  const ballSpeed = Math.hypot(state.ballVel.x, state.ballVel.y);
  const ballMovingAtGoal = state.ballOwner === null && ballSpeed > 0.035 &&
    ((isHome && state.ballVel.x < -0.004) || (!isHome && state.ballVel.x > 0.004));
  const ballInOwnThird = isHome ? state.ball.x < 0.33 : state.ball.x > 0.67;
  const ballInPenaltyArea = (isHome ? state.ball.x < 0.18 : state.ball.x > 0.82) &&
                            state.ball.y > 0.28 && state.ball.y < 0.72;

  let gkTargetY = 0.50;
  let gkGain    = 0.06;

  if (ballMovingAtGoal && ballInOwnThird) {
    const predicted = predictBallCrossY(state, myGoalX);
    if (predicted !== null) {
      const isOnTarget = predicted >= 0.41 && predicted <= 0.59;
      if (isOnTarget) {
        gkTargetY = clamp(predicted, 0.38, 0.62);
        gkGain    = 0.32;
        const dive = state.gkDive[p.id];
        const isNew = !dive || t > dive.until;
        const needsLateral = Math.abs(gkTargetY - ppos.y) > 0.03;
        if (isNew && needsLateral) {
          stateEmit(state, t, 'save', pSide, p.id, state.ballLastKicker ?? undefined, 'dive');
          state.gkDive[p.id] = { until: t + DIVE_DURATION_MS, targetY: gkTargetY };
        }
      } else {
        gkTargetY = clamp(predicted, 0.44, 0.56);
        gkGain    = 0.12;
      }
    }
  } else if (ballInPenaltyArea) {
    gkTargetY = clamp(state.ball.y, 0.46, 0.54);
    gkGain    = 0.10;
  }

  force.y += (gkTargetY - ppos.y) * gkGain;
}
