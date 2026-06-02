// Throw-in: ball crossed a touchline. The taker walks to a stand-spot just
// off the pitch, teammates offer near options, then the throw releases as a
// pass. Entry + force field + the setup/holding/release tick handlers.

import type { Vec2, PlayerId, TeamSide } from '../../types/match';
import type { EnginePlayer } from '../zoneEngine';
import { spring } from '../forces';
import { findBestPassTarget } from '../effectors';
import { clamp } from './shared';
import type { CarrierRole, PhaseForceCtx, PhaseCallbacks, MatchState } from './shared';

export function startThrowIn(state: MatchState, ballPos: Vec2, takerId: PlayerId): void {
  state.intendedReceiver = null;
  state.kickerId = takerId;
  state.partnerId = null;
  state.ballOwner = null;
  state.ballLastKicker = null;
  state.ballLastKickerSide = null;
  state.ballKickerLockUntil = 0;
  state.needsKickoffPass = false;
  state.throwInSpot = { x: ballPos.x, y: ballPos.y < 0.5 ? 0.0 : 1.0 };
  state.phase = 'throw_in_setup';
  state.phaseTicks = 60;
}

export function applyThrowInForces(
  p: EnginePlayer,
  isGK: boolean,
  pSide: TeamSide,
  _role: CarrierRole,
  base: Vec2,
  ppos: Vec2,
  pvel: Vec2,
  force: Vec2,
  ctx: PhaseForceCtx,
): boolean {
  const { ball, ballOwner, kickerId, intendedReceiver, throwInSpot, homePlayers, awayPlayers, pos } = ctx;
  const takerSide: TeamSide | null = kickerId !== null ? ctx.sideOf(kickerId) : null;
  const spotX = throwInSpot ? throwInSpot.x : ball.x;
  const spotY = throwInSpot ? throwInSpot.y : ball.y;
  const onTop = spotY < 0.5;
  // Ball stays on the touchline; the kicker stands BEHIND the line so the
  // throw animation visually starts off-pitch (matches PC Futbol look).
  const inFieldY = onTop ? 0.0 : 1.0;
  // Sprite anchor is centred but the visual feet sit BELOW the sprite
  // centre, so identical absolute offsets render asymmetrically — the
  // south-side kicker looked too far past the line while the north-side
  // kicker stepped on it. Bias the south offset closer to the line and
  // the north offset further from it so feet land just outside on both.
  const kickerStandY = onTop ? -0.034 : 1.010;

  if (p.id === kickerId) {
    const target: Vec2 = { x: spotX, y: kickerStandY };
    // Pre-pickup (ballOwner !== kickerId): softer pull so the approach
    // doesn't look like a sprint to the line. After pickup the higher gain
    // keeps them locked to the stand-Y while the throw plays.
    const gain = ballOwner === kickerId ? 0.45 : 0.10;
    const sf = spring(ppos, target, gain);
    force.x += sf.x;
    force.y += sf.y;
    return true;
  }
  if (isGK) {
    const sf = spring(ppos, base, 0.20);
    force.x += sf.x;
    force.y += sf.y;
    return true;
  }
  if (pSide === takerSide) {
    if (p.id === intendedReceiver) {
      pvel.x *= 0.5;
      pvel.y *= 0.5;
      return true;
    }
    const teammates = pSide === 'home' ? homePlayers : awayPlayers;
    const candidates = teammates
      .filter(tm => tm.id !== kickerId && tm.slotIndex !== 0)
      .map(tm => ({ id: tm.id, d: Math.hypot(pos[tm.id].x - spotX, pos[tm.id].y - spotY) }))
      .sort((a, b) => a.d - b.d);
    const rank = candidates.findIndex(c => c.id === p.id);
    if (rank >= 0 && rank < 3) {
      const attackSign = pSide === 'home' ? 1 : -1;
      const offsets: Array<{ dx: number; dy: number }> = [
        { dx: -0.08 * attackSign, dy: onTop ? 0.10 : -0.10 },
        { dx:  0.04 * attackSign, dy: onTop ? 0.18 : -0.18 },
        { dx:  0.22 * attackSign, dy: onTop ? 0.28 : -0.28 },
      ];
      const off = offsets[rank];
      const target: Vec2 = {
        x: clamp(spotX + off.dx, 0.05, 0.95),
        y: clamp(inFieldY + off.dy, 0.06, 0.94),
      };
      const sf = spring(ppos, target, 0.14);
      force.x += sf.x;
      force.y += sf.y;
      return true;
    }
    const sf = spring(ppos, base, 0.10);
    force.x += sf.x;
    force.y += sf.y;
    return true;
  }
  // Rival side: light mark.
  const sf = spring(ppos, base, 0.10);
  force.x += sf.x;
  force.y += sf.y;
  return true;
}

export function tickThrowInSetup(state: MatchState, t: number, callbacks: PhaseCallbacks): void {
  if (state.ballOwner !== state.kickerId) {
    // Fallback: kicker didn't naturally reach the spot in time. Teleport
    // them just behind the touchline; the ball stays on the line itself.
    const onTop = state.ball.y < 0.5;
    const spot = state.throwInSpot ?? { x: state.ball.x, y: onTop ? 0.0 : 1.0 };
    state.pos[state.kickerId!] = { x: spot.x, y: onTop ? -0.034 : 1.010 };
    state.vel[state.kickerId!] = { x: 0, y: 0 };
    state.ballOwner = state.kickerId;
    state.ballHeight = 0;
    state.ballHeightVel = 0;
    state.ballVel = { x: 0, y: 0 };
    state.ball = { x: spot.x, y: spot.y };
    const side = state.homeSet.has(state.kickerId!) ? 'home' : 'away';
    callbacks.setCarrier(state.kickerId!, side);

    const bestReceiverId = findBestPassTarget(state);
    state.intendedReceiver = bestReceiverId;
    callbacks.emit(t, 'reception', side, state.kickerId ?? undefined, bestReceiverId ?? undefined, 'Fuera de banda');
  }
  // Short hold so the throw anim plays and the kicker visibly gets set;
  // tickPhase throw_in_holding fires resolvePass and advances to release.
  state.phase = 'throw_in_holding';
  state.phaseTicks = 4;
}

export function tickThrowInHolding(state: MatchState, t: number, callbacks: PhaseCallbacks): void {
  callbacks.resolvePass(t);
  // Fallback if resolvePass didn't transition for some reason
  if (state.phase === 'throw_in_holding') state.phase = 'live';
}

export function tickThrowInRelease(state: MatchState, t: number, _callbacks: PhaseCallbacks): void {
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
  state.throwInSpot = null;
  state.phase = 'live';
}
