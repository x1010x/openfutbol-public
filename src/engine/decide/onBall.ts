// Carrier-side intent decision. Mirrors the inline carrier block that used
// to live in zoneEngine.ts's main loop. Returns one of:
//
//   * { kind: 'dribble' } — forceDrive (clean-through, wing drive, deep
//                           crossing zone with no teammates) or "waiting on
//                           carry budget." Orchestrator simply continues; the
//                           carrier keeps moving via `moveAll`.
//   * { kind: 'shoot' }   — opportunistic close-range shot, in-box shot, or
//                           borderline-range shot with no forward outlet.
//                           Orchestrator calls `resolveShot`.
//   * { kind: 'pass' }    — anything else. Orchestrator calls `resolvePass`,
//                           which internally selects a target (and may decide
//                           to clear instead — that's a `resolvePass` concern,
//                           not a decision-layer concern).
//
// RNG order matches the inline implementation exactly: wing-drive roll first
// (only if wide & not in deep crossing zone), then opportunistic-shot roll
// (only if path is clear), then the effector consumes rng internally. Any
// reorder breaks seeded replays.

import type { MatchState, Intent } from '../types';
import type { EnginePlayer } from '../zoneEngine';
import { distToSegment } from '../geometry';
import { roleOf } from '../state';

export function decide(carrier: EnginePlayer, state: MatchState): Intent {
  const cpos        = state.pos[carrier.id];
  const cSide       = state.homeSet.has(carrier.id) ? 'home' : 'away';
  const goalX       = cSide === 'home' ? 1.0 : 0.0;
  const distToGoalX = Math.abs(cpos.x - goalX);
  const role        = roleOf(state, carrier) as 'gk' | 'def' | 'mid' | 'fwd';
  // Filter expelled players so shot/pass/dribble decisions reason about the
  // 10-or-fewer that remain on the pitch (e.g. tap-in checks, blocker scans,
  // forward outlet detection).
  const opps        = (cSide === 'home' ? state.awayPlayers : state.homePlayers)
                        .filter(o => !state.expelledIds.has(o.id));
  const team        = (cSide === 'home' ? state.homePlayers : state.awayPlayers)
                        .filter(t => !state.expelledIds.has(t.id));
  const homeGK      = state.homePlayers[0].id;
  const awayGK      = state.awayPlayers[0].id;

  // Last line of defence (excluding GK).
  const rivals = opps.filter(o => o.slotIndex !== 0);
  const lastDefenderX = rivals.reduce((acc, r) => {
    const rx = state.pos[r.id].x;
    return cSide === 'home' ? Math.max(acc, rx) : Math.min(acc, rx);
  }, cSide === 'home' ? 0.0 : 1.0);

  const inOpponentHalf   = cSide === 'home' ? cpos.x > 0.50 : cpos.x < 0.50;
  const pastLastDefender = (cSide === 'home' ? cpos.x > lastDefenderX : cpos.x < lastDefenderX) && inOpponentHalf;
  const inPenaltyArea    = cSide === 'home' ? cpos.x > 0.82 : cpos.x < 0.18;

  // --- forceDrive: drive to box rather than decide. -----------------------
  let forceDrive = false;
  if (pastLastDefender && !inPenaltyArea) {
    forceDrive = true;
  } else {
    const isWide = cpos.y < 0.28 || cpos.y > 0.72;
    const inDeepCrossingZone = cSide === 'home' ? cpos.x > 0.80 : cpos.x < 0.20;

    if (isWide && !inDeepCrossingZone && role !== 'gk') {
      const spaceClear = !opps.some(o => {
        const isAhead = cSide === 'home'
          ? state.pos[o.id].x > cpos.x && state.pos[o.id].x < cpos.x + 0.18
          : state.pos[o.id].x < cpos.x && state.pos[o.id].x > cpos.x - 0.18;
        const sameWing = Math.abs(state.pos[o.id].y - cpos.y) < 0.10;
        return isAhead && sameWing;
      });
      // RNG consumption point #1 — must stay first to preserve seed order.
      if (spaceClear && state.rng() < 0.90) {
        forceDrive = true;
      }
    }

    if (isWide && inDeepCrossingZone && !forceDrive) {
      const teammatesInBox = team.filter(tm =>
        tm.id !== state.carrierId
        && (cSide === 'home' ? state.pos[tm.id].x > 0.80 : state.pos[tm.id].x < 0.20)
        && state.pos[tm.id].y > 0.25 && state.pos[tm.id].y < 0.75);
      const isPressedHard = opps.some(o =>
        Math.hypot(state.pos[o.id].x - cpos.x, state.pos[o.id].y - cpos.y) < 0.08);
      if (teammatesInBox.length === 0 && !isPressedHard) {
        forceDrive = true;
      }
    }
  }

  if (forceDrive) {
    // Killer through-ball: 1v1 vs GK with a support runner closer to goal
    // and in a clean lane → sometimes (probabilistic) slide them in instead
    // of forcing the dribble.
    const gkId = cSide === 'home' ? awayGK : homeGK;
    const supportRunner = team.find(tm => {
      if (tm.id === state.carrierId || tm.slotIndex === 0) return false;
      const tpos = state.pos[tm.id];
      const goalside = cSide === 'home' ? tpos.x > cpos.x + 0.04 : tpos.x < cpos.x - 0.04;
      if (!goalside) return false;
      const closerToGoal = Math.abs(tpos.x - goalX) < Math.abs(cpos.x - goalX) - 0.02;
      if (!closerToGoal) return false;
      const laneClear = opps.every(o =>
        o.id === gkId || distToSegment(state.pos[o.id], cpos, tpos) > 0.05);
      if (!laneClear) return false;
      // Receiver themselves should be reasonably clear of defenders so they
      // can actually finish the move.
      const receiverFree = opps.every(o =>
        o.id === gkId || Math.hypot(state.pos[o.id].x - tpos.x, state.pos[o.id].y - tpos.y) > 0.10);
      return receiverFree;
    });
    // Probabilistic — engine still chooses the dribble most of the time, so
    // running through alone stays the default. Roll happens AFTER the wing-
    // drive roll above (RNG consumption order shifts; no pinned snapshots).
    if (supportRunner && state.rng() < 0.45) {
      return { kind: 'pass', targetId: supportRunner.id };
    }
    return { kind: 'dribble', toward: { x: goalX, y: cpos.y } };
  }

  // --- Opportunistic shot. -------------------------------------------------
  const oppShotDist = role === 'fwd' ? 0.30 : 0.22;
  const isCentralEnoughForShot = cpos.y > 0.15 && cpos.y < 0.85;
  if (role !== 'gk' && distToGoalX < oppShotDist && isCentralEnoughForShot) {
    const gkId = cSide === 'home' ? awayGK : homeGK;
    const pathClear = opps.every(o =>
      o.id === gkId || distToSegment(state.pos[o.id], cpos, { x: goalX, y: 0.5 }) > 0.05);

    if (pathClear) {
      const shotProb = role === 'fwd' ? 0.90 : 0.50;
      // RNG consumption point #2.
      if (state.rng() < shotProb) {
        return { kind: 'shoot' };
      }
    }
  }

  // --- Wait for carry budget before regular decision. ----------------------
  if (state.carryTicks < state.nextAction) {
    return { kind: 'dribble', toward: { x: goalX, y: cpos.y } };
  }

  // --- Regular shot/pass decision. -----------------------------------------
  const MAX_SHOT_DIST    = 0.25;
  const shotThreshold    = Math.min(MAX_SHOT_DIST, role === 'fwd' ? 0.20 : 0.15);
  const extShotThreshold = Math.min(MAX_SHOT_DIST, role === 'fwd' ? 0.25 : 0.20);

  const inBoxX = cSide === 'home' ? cpos.x > 0.82 : cpos.x < 0.18;
  const inBoxY = cpos.y > 0.20 && cpos.y < 0.80;
  const isStrictlyInBox = inBoxX && inBoxY;

  if (isStrictlyInBox || (distToGoalX < shotThreshold && isCentralEnoughForShot)) {
    // Killer-pass option: if a defender is in our shooting lane AND a teammate
    // alongside us has a clean lane to goal, sometimes slide them the ball for
    // a tap-in instead of forcing the shot.
    const gkId = cSide === 'home' ? awayGK : homeGK;
    const blockerInLane = opps.some(o =>
      o.id !== gkId && distToSegment(state.pos[o.id], cpos, { x: goalX, y: 0.5 }) < 0.05);
    if (blockerInLane) {
      const tapInTeammate = team.find(tm => {
        if (tm.id === state.carrierId || tm.slotIndex === 0) return false;
        const tpos = state.pos[tm.id];
        const closeBy = Math.hypot(tpos.x - cpos.x, tpos.y - cpos.y) < 0.22;
        const inBoxArea = cSide === 'home' ? tpos.x > 0.74 : tpos.x < 0.26;
        const centralEnough = tpos.y > 0.18 && tpos.y < 0.82;
        const lateralEnough = Math.abs(tpos.y - cpos.y) > 0.06;
        const cleanLane = opps.every(o =>
          o.id === gkId || distToSegment(state.pos[o.id], tpos, { x: goalX, y: 0.5 }) > 0.05);
        return closeBy && inBoxArea && centralEnough && lateralEnough && cleanLane;
      });
      if (tapInTeammate && state.rng() < 0.55) {
        return { kind: 'pass', targetId: tapInTeammate.id };
      }
    }
    return { kind: 'shoot' };
  }

  if (role !== 'gk' && distToGoalX < extShotThreshold && isCentralEnoughForShot) {
    const isPressed = opps.some(o =>
      Math.hypot(state.pos[o.id].x - cpos.x, state.pos[o.id].y - cpos.y) < 0.12);
    const hasGoodForwardPass = team.some(tm => {
      if (tm.id === state.carrierId) return false;
      const tpos = state.pos[tm.id];
      const strictAhead = cSide === 'home' ? tpos.x > cpos.x + 0.05 : tpos.x < cpos.x - 0.05;
      if (!strictAhead) return false;
      const minOppDist = opps.reduce((m, o) =>
        Math.min(m, Math.hypot(state.pos[o.id].x - tpos.x, state.pos[o.id].y - tpos.y)), Infinity);
      return minOppDist > 0.10;
    });
    if (!hasGoodForwardPass || isPressed) return { kind: 'shoot' };
    return { kind: 'pass', targetId: '' };
  }

  // Back-pass suppression: if there's no forward/lateral outlet AND the carrier
  // isn't under real pressure, keep dribbling instead of recycling the ball
  // backwards. GK distribution is exempt (GK should pass even if it's "back"
  // relative to other GK passing options).
  if (role !== 'gk') {
    const isPressedHard = opps.some(o =>
      Math.hypot(state.pos[o.id].x - cpos.x, state.pos[o.id].y - cpos.y) < 0.14);
    if (!isPressedHard) {
      const hasForwardOutlet = team.some(tm => {
        if (tm.id === state.carrierId) return false;
        if (tm.slotIndex === 0) return false;
        const tpos = state.pos[tm.id];
        const ahead = cSide === 'home' ? tpos.x > cpos.x - 0.02 : tpos.x < cpos.x + 0.02;
        if (!ahead) return false;
        const minOppDist = opps.reduce((m, o) =>
          Math.min(m, Math.hypot(state.pos[o.id].x - tpos.x, state.pos[o.id].y - tpos.y)), Infinity);
        return minOppDist > 0.08;
      });
      if (!hasForwardOutlet) {
        return { kind: 'dribble', toward: { x: goalX, y: cpos.y } };
      }
    }
  }

  return { kind: 'pass', targetId: '' };
}
