// Goal kick: ball over the goal line off an attacker. The taker (GK or a CB)
// walks to the 6-yard spot, holds, then strikes a distribution pass. Entry +
// force field (own team offers short, rivals held behind the line) + ticks.

import type { Vec2, PlayerId, TeamSide } from '../../types/match';
import type { EnginePlayer } from '../zoneEngine';
import { spring } from '../forces';
import { sideOf } from '../state';
import { clamp, GOAL_KICK_SETUP_TICKS, GOAL_KICK_HOLD_TICKS, KICK_FREEZE_MS } from './shared';
import type { CarrierRole, PhaseForceCtx, PhaseCallbacks, MatchState } from './shared';

// Ball is placed at the chosen 6-yard box corner; the kicker walks naturally
// to the wind-up spot from wherever they were when the ball went out (no
// teleport — they "position themselves at a distance from the ball, run
// towards it, and kick").
//   spot     — corner of the 6-yard box on the side the ball went out
//   kickerId — defending team's chosen taker (GK by default)
export function startGoalKick(state: MatchState, spot: Vec2, kickerId: PlayerId): void {
  state.intendedReceiver = null;
  state.kickerId = kickerId;
  state.partnerId = null;
  state.ballLastKicker = null;
  state.ballLastKickerSide = null;
  state.ballKickerLockUntil = 0;
  state.needsKickoffPass = false;

  state.goalKickSpot = { x: spot.x, y: spot.y };

  // Ensure kicker is NOT the GK if possible (usually slot 3 or 2)
  const kSide = sideOf(state, kickerId);
  const team = kSide === 'home' ? state.homePlayers : state.awayPlayers;
  let finalKickerId = kickerId;
  const kickerPlayer = state.playerMap.get(kickerId);
  if (kickerPlayer && kickerPlayer.slotIndex === 0) {
    // If it was the GK, pick the central defender (slot 3)
    const cb = team.find(p => p.slotIndex === 3) || team.find(p => p.slotIndex !== 0);
    if (cb) finalKickerId = cb.id;
  }
  state.kickerId = finalKickerId;

  // Do NOT set ballOwner yet so the ball continues flying off screen.
  // The zoneEngine's pickup logic will teleport it to the spot when the
  // kicker reaches the wind-up position.
  state.ballOwner = null;

  const roll = state.rng();
  state.gkPressStrategy = roll < 0.35 ? 'full' : roll < 0.80 ? 'partial' : 'drop';

  state.pendingImpulse = null;
  state.phase = 'goal_kick_setup';
  // Long setup for natural walk-back
  state.phaseTicks = GOAL_KICK_SETUP_TICKS;
}

export function applyGoalKickForces(
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
  const { phase, ball, kickerId, intendedReceiver, goalKickSpot, pos } = ctx;
  const kickerSide: TeamSide | null = kickerId !== null ? ctx.sideOf(kickerId) : null;
  const spot = goalKickSpot ?? ball;
  // Attack direction (toward opposite goal): +1 for home (left→right), -1 for away.
  const attackSign = kickerSide === 'home' ? 1 : -1;
  // Wind-up spot: behind the ball, off-field if needed to get a good run-up.
  // Stand right next to the ball — no run-up. Reads "kicker stepping into
  // the ball" rather than the previous "kicks from a distance" look.
  const windUpX = spot.x - attackSign * 0.012;
  const windUpY = spot.y;

  if (p.id === kickerId) {
    let target: Vec2;
    let gain: number;
    if (phase === 'goal_kick_setup') {
      target = { x: windUpX, y: windUpY };
      gain = 0.20;
    } else if (phase === 'goal_kick_holding') {
      target = { x: windUpX, y: windUpY };
      gain = 0.45;
    } else {
      // Release run-up: target the ball's spot directly.
      target = { x: spot.x, y: spot.y };
      gain = 0.60;
    }
    const sf = spring(ppos, target, gain);
    force.x += sf.x;
    force.y += sf.y;
    return true;
  }

  // Rival GK: hold position firmly.
  if (isGK) {
    const sf = spring(ppos, base, 0.25);
    force.x += sf.x;
    force.y += sf.y;
    return true;
  }

  if (p.id === intendedReceiver) {
    pvel.x *= 0.5;
    pvel.y *= 0.5;
    return true;
  }

  if (pSide === kickerSide) {
    // Kicker's team: 1-2 defenders can be near the box, others behind 3/4 line.
    let targetX = base.x;

    if (role === 'def') {
      // Slot 2/3 are usually the CBs. Let them stay near the box for the short option.
      if (p.slotIndex === 2 || p.slotIndex === 3) {
        targetX = kickerSide === 'home' ? 0.18 : 0.82;
      } else {
        targetX = kickerSide === 'home' ? 0.24 : 0.76;
      }
    } else if (role === 'mid') {
      targetX = kickerSide === 'home' ? 0.38 : 0.62;
    } else if (role === 'fwd') {
      targetX = kickerSide === 'home' ? 0.48 : 0.52; // Strictly behind half-way
    }

    const target: Vec2 = { x: clamp(targetX, 0.05, 0.95), y: base.y };
    const sf = spring(ppos, target, 0.14);
    force.x += sf.x;
    force.y += sf.y;
    return true;
  }

  // Rival team: strictly behind the 3/4 line (0.22).
  const boxMinX = kickerSide === 'home' ? 0.22 : 0.78;

  if (phase === 'goal_kick_release' && intendedReceiver) {
    const rpos = pos[intendedReceiver];
    const mid: Vec2 = {
      x: (spot.x + rpos.x) * 0.5,
      y: (spot.y + rpos.y) * 0.5,
    };
    const dLane = Math.hypot(ppos.x - mid.x, ppos.y - mid.y);
    const dRecv = Math.hypot(ppos.x - rpos.x, ppos.y - rpos.y);
    const target = dLane < dRecv ? mid : rpos;
    const sf = spring(ppos, target, 0.18);
    force.x += sf.x;
    force.y += sf.y;
    return true;
  }

  // Rival setup: spread out but strictly out of the box area.
  let targetX = base.x;
  if (role === 'fwd')      targetX = kickerSide === 'home' ? 0.26 : 0.74;
  else if (role === 'mid') targetX = kickerSide === 'home' ? 0.45 : 0.55;
  else if (role === 'def') targetX = kickerSide === 'home' ? 0.70 : 0.30;

  // Hard box/3-4 line clearance for rivals
  if (kickerSide === 'home' && targetX < boxMinX) targetX = boxMinX;
  if (kickerSide === 'away' && targetX > boxMinX) targetX = boxMinX;

  const target: Vec2 = { x: clamp(targetX, 0.05, 0.95), y: base.y };
  const sf = spring(ppos, target, 0.12);
  force.x += sf.x;
  force.y += sf.y;
  return true;
}

export function tickGoalKickSetup(state: MatchState, t: number, callbacks: PhaseCallbacks): void {
  if (state.ballOwner !== state.kickerId) {
    state.ballOwner = state.kickerId;
    state.ballHeight = 0;
    state.ballHeightVel = 0;
    state.ballVel = { x: 0, y: 0 };
    if (state.goalKickSpot) {
      state.ball = { x: state.goalKickSpot.x, y: state.goalKickSpot.y };
    }
    callbacks.setCarrier(state.kickerId!, sideOf(state, state.kickerId!));
  }

  // Snap kicker right next to the ball so the kick anim plays from contact distance.
  if (state.goalKickSpot) {
    const attackSign = state.homeSet.has(state.kickerId!) ? 1 : -1;
    state.pos[state.kickerId!] = {
      x: state.goalKickSpot.x - attackSign * 0.012,
      y: state.goalKickSpot.y
    };
    state.vel[state.kickerId!] = { x: 0, y: 0 };
  }

  // End of walk-back: enter the holding/focus pause. GK keeps the ball
  // anchored at the spot (state.ball is locked in move.ts).
  state.phase = 'goal_kick_holding';
  state.phaseTicks = GOAL_KICK_HOLD_TICKS;
  callbacks.snap(t);
}

export function tickGoalKickHolding(state: MatchState, t: number, callbacks: PhaseCallbacks): void {
  // Fire the pass selection. resolvePass detects goal_kick_holding and
  // sets phase = goal_kick_release with phaseTicks = release window;
  // the impulse stays pending until the release-end branch below runs.
  callbacks.resolvePass(t);
  if (state.phase === 'goal_kick_holding') state.phase = 'live';
  // Snap at the start of release: pins the kicker at the wind-up spot in the
  // renderer so that the next snap (on the emit tick, with kicker forced onto
  // the ball) interpolates as a visible run-up rather than starting from
  // wherever the previous KEYFRAME_EVERY snap happened to land.
  callbacks.snap(t);
}

export function tickGoalKickRelease(state: MatchState, t: number, callbacks: PhaseCallbacks): void {
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

    // Brief freeze so the kick anim plays at the moment of release.
    state.vel[state.kickerId!] = { x: 0, y: 0 };
    state.kickFrozenUntil.set(state.kickerId!, t + KICK_FREEZE_MS);
    // NOTE: 'goal_kick' event is now emitted 1 tick early in zoneEngine.ts
    // to allow the animation wind-up to sync with the ball's departure.

    // Force orientation toward receiver so the kick animation looks correct.
    const rpos = state.pos[imp.receiverId];
    const kpos = state.pos[state.kickerId!];
    const dx = rpos.x - kpos.x;
    const dy = rpos.y - kpos.y;
    state.vel[state.kickerId!] = { x: dx * 0.001, y: dy * 0.001 };
  }
  state.goalKickSpot = null;
  state.phase = 'live';
  // Snap right after the impulse so the renderer gets a fresh keyframe with
  // the ball launching from the spot and the kicker frozen on it. Without
  // this the next keyframe waits for KEYFRAME_EVERY, and the ball's first
  // visible motion can lag the kick animation's contact frame.
  callbacks.snap(t);
}
