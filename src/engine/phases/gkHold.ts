// GK hold/release: the keeper has caught the ball and holds it while a press
// strategy is rolled, then distributes. Entry + force field (press/push-up
// per strategy, GK pinned) + the holding/release tick handlers.

import type { Vec2, PlayerId, TeamSide } from '../../types/match';
import type { EnginePlayer } from '../zoneEngine';
import { spring, attract, repel } from '../forces';
import { clamp, GK_HOLD_TICKS } from './shared';
import type { CarrierRole, PhaseForceCtx, PhaseCallbacks, MatchState } from './shared';

export function startGKHold(state: MatchState, gkId: PlayerId): void {
  state.intendedReceiver = null;
  state.ballOwner = gkId;
  state.ball = { ...state.pos[gkId] };
  state.ballVel = { x: 0, y: 0 };
  state.ballHeight = 0;
  state.ballHeightVel = 0;
  const roll = state.rng();
  state.gkPressStrategy = roll < 0.35 ? 'full' : roll < 0.80 ? 'partial' : 'drop';
  state.phase = 'gk_holding';
  state.phaseTicks = GK_HOLD_TICKS;
}

export function applyGkHoldForces(
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
  const { ball, intendedReceiver, gkPressStrategy, possession, allPlayers, expelledIds, pos } = ctx;
  if (isGK) {
    // The GK should not drift while holding the ball.
    // They take the distribution throw/kick from exactly where they caught it.
    pvel.x = 0;
    pvel.y = 0;
    force.x = 0;
    force.y = 0;
    return true;
  }
  if (p.id === intendedReceiver) {
    pvel.x *= 0.5;
    pvel.y *= 0.5;
    return true;
  }
  // Weaker base attraction so players linger near the action.
  const sf = spring(ppos, base, 0.06);
  force.x += sf.x;
  force.y += sf.y;

  const isDefending = possession !== pSide;
  if (isDefending) {
    let shouldPress = false;
    let shouldPushUp = false;
    let pushAmount = 0;
    if (gkPressStrategy === 'full') {
      shouldPress  = role === 'fwd' || role === 'mid';
      shouldPushUp = role === 'def';
      pushAmount   = 0.15;
    } else if (gkPressStrategy === 'partial') {
      shouldPress  = role === 'fwd';
      shouldPushUp = role === 'mid' || role === 'def';
      pushAmount   = role === 'mid' ? 0.10 : 0.05;
    }
    if (shouldPress) {
      const ballDist = Math.hypot(ball.x - ppos.x, ball.y - ppos.y);
      if (ballDist > 0.22 && ballDist < 0.60) {
        const af = attract(ppos, ball, 0.10);
        force.x += af.x;
        force.y += af.y;
      } else if (ballDist < 0.18) {
        const rf = repel(ppos, ball, (0.18 - ballDist) * 0.5);
        force.x += rf.x;
        force.y += rf.y;
      }
    } else if (shouldPushUp) {
      const pushForwardX = pSide === 'home' ? pushAmount : -pushAmount;
      const advancedBase: Vec2 = { x: clamp(base.x + pushForwardX, 0.05, 0.95), y: base.y };
      const sf2 = spring(ppos, advancedBase, 0.08);
      force.x += sf2.x;
      force.y += sf2.y;
    } else {
      const sf2 = spring(ppos, base, 0.08);
      force.x += sf2.x;
      force.y += sf2.y;
    }
  } else {
    const pullX = pSide === 'home' ? 0.02 : -0.02;
    const pullY = ppos.y > 0.5 ? 0.02 : -0.02;
    force.x += pullX;
    force.y += pullY;
  }

  for (const other of allPlayers) {
    if (other.id === p.id) continue;
    if (expelledIds.has(other.id)) continue;
    const d = Math.hypot(pos[other.id].x - ppos.x, pos[other.id].y - ppos.y);
    if (d < 0.10 && d > 0) {
      const r = repel(ppos, pos[other.id], (0.10 - d) * 1.5);
      force.x += r.x;
      force.y += r.y;
    }
  }
  return true;
}

export function tickGkHolding(state: MatchState, t: number, callbacks: PhaseCallbacks): void {
  callbacks.resolvePass(t);
  if (state.phase === 'gk_holding') state.phase = 'live';
}

export function tickGkRelease(state: MatchState, t: number, _callbacks: PhaseCallbacks): void {
  const imp = state.pendingImpulse;
  if (imp !== null) {
    state.ballVel = imp.vel;
    state.ballHeight = imp.height;
    state.ballHeightVel = imp.heightVel;
    state.ballOwner = null;
    state.ballLastKicker = imp.kickerId;
    state.ballLastKickerSide = imp.kickerSide;
    state.ballKickerLockUntil = t + imp.lockUntil;
    state.intendedReceiver = imp.receiverId;
    state.pendingImpulse = null;
  }
  state.phase = 'live';
}
