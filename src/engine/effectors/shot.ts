// Shot resolution. The immediate path launches the ball at goal now; the
// `delayed` path (free kicks / penalties) stashes a pendingImpulse and flips to
// foul_release so the impulse leaves the foot in sync with the kick animation.

import type { Vec2, PlayerId, TeamSide } from '../../types/match';
import type { MatchState } from '../types';
import { emit as stateEmit, snap as stateSnap } from '../state';
import { FOUL_RELEASE_TICKS } from '../phases';
import { clamp, KICK_FREEZE_MS } from './shared';

export function resolveShot(state: MatchState, t: number, delayed?: boolean): void {
  const carrier = state.playerMap.get(state.carrierId)!;
  const cSide: TeamSide = state.homeSet.has(state.carrierId) ? 'home' : 'away';
  const cpos = state.pos[state.carrierId];

  const goalLineX = cSide === 'home' ? 1.0 : 0.0;

  const cornerY = state.rng() > 0.5 ? 0.445 : 0.555;
  const intendedTarget = {
    x: goalLineX,
    y: 0.50 + (cornerY - 0.50) * clamp(0.55 + 0.45 * (carrier.shooting / 99), 0.55, 1.0)
  };

  const aimErrorY = (state.rng() - 0.5) * (1 - carrier.shooting / 99) * 0.12;
  const actualTarget = { x: intendedTarget.x, y: intendedTarget.y + aimErrorY };

  // Anchor the ball at the carrier's exact position before computing the
  // trajectory. moveAll's carrier-follow offset (~0.022 ahead) shifts the
  // shot start point in front of the foot, which both reads laggy and
  // truncates trajectory math by ~0.022. Use cpos as the canonical kick
  // origin so the snap and the velocity are consistent.
  state.ball.x = cpos.x;
  state.ball.y = cpos.y;
  state.ballHeight = 0;

  const dx = actualTarget.x - state.ball.x;
  const dy = actualTarget.y - state.ball.y;
  const dist = Math.hypot(dx, dy);

  let shotSpeed: number;
  let shotHeightVel: number;

  if (dist < 0.12) {
    shotSpeed = 0.055;
    shotHeightVel = 0.005;
  } else {
    shotSpeed = 0.065 + 0.025 * (carrier.shooting / 99);
    shotHeightVel = clamp(dist * 0.08, 0.012, 0.032);
  }

  const newBallVel: Vec2 = {
    x: (dx / dist) * shotSpeed,
    y: (dy / dist) * shotSpeed,
  };

  if (delayed) {
    const isPenalty = state.foulVariant === 'penalty';
    if (isPenalty) {
      // Penalty shot: low driven ball, no wall to clear.
      shotHeightVel = clamp(0.004 + (carrier.shooting / 99) * 0.008, 0.004, 0.012);
    } else {
      // Free-kick: loft over the wall. Height modulated by shooter skill:
      //   shooting 99 → 0.033 (clears reliably)
      //   shooting 60 → 0.026 (clears marginally)
      //   shooting 30 → 0.022 (often blocked by wall)
      shotHeightVel = clamp(0.018 + (carrier.shooting / 99) * 0.015, 0.018, 0.033);
    }
    state.pendingImpulse = {
      vel: newBallVel,
      height: 0,
      heightVel: shotHeightVel,
      receiverId: '' as PlayerId,
      kickerId: carrier.id,
      kickerSide: cSide,
      lockUntil: 1000,
      detail: isPenalty ? '¡Tiro de penalti!' : '¡Tiro de falta!',
    };
    state.intendedReceiver = null;
    state.phase = 'foul_release';
    state.phaseTicks = FOUL_RELEASE_TICKS;
    stateSnap(state, t);
    return;
  }

  state.ballVel = newBallVel;
  state.ballHeight = 0;
  state.ballHeightVel = shotHeightVel;

  state.ballOwner = null;
  state.ballLastKicker = carrier.id;
  state.ballLastKickerSide = cSide;
  state.ballKickerLockUntil = t + 1000;
  state.intendedReceiver = null;
  state.kickFrozenUntil.set(carrier.id, t + KICK_FREEZE_MS);
  state.vel[carrier.id] = { x: 0, y: 0 };

  stateSnap(state, t);
  stateEmit(state, t, 'shot_on', cSide, carrier.id);
}
