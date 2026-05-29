// Pass resolution and target selection. findBestPassTarget is the generic
// scorer (also used by set-piece setup for early receiver hints);
// pickCornerTarget is the corner-specific picker; resolvePass turns the chosen
// target into a ball impulse (or a panic clear) and handles the delayed-release
// set-piece variants (throw-in, goal kick, corner, foul).

import type { TimelineEvent, Vec2, PlayerId, TeamSide } from '../../types/match';
import type { MatchState } from '../types';
import { distToSegment } from '../geometry';
import { emit as stateEmit, snap as stateSnap, roleOf } from '../state';
import { clamp, KICK_FREEZE_MS } from './shared';
import type { EffectorDeps } from './shared';

export function findBestPassTarget(state: MatchState, hintTargetId?: PlayerId): PlayerId | null {
  const carrier = state.playerMap.get(state.carrierId)!;
  const cSide: TeamSide = state.homeSet.has(state.carrierId) ? 'home' : 'away';
  const cpos    = state.pos[state.carrierId];
  const team    = cSide === 'home' ? state.homePlayers : state.awayPlayers;
  const opps    = cSide === 'home' ? state.awayPlayers : state.homePlayers;
  const role    = roleOf(state, carrier) as 'gk' | 'def' | 'mid' | 'fwd';

  // Support both setup and holding phases for early selection
  const isThrowIn = state.phase === 'throw_in_holding' || state.phase === 'throw_in_setup';
  const maxPassDist = isThrowIn ? 0.35 : (role === 'gk' ? 0.95 : role === 'def' ? 0.70 : 0.55);

  const isCrossingZone = !isThrowIn && role !== 'gk'
    && (cSide === 'home' ? cpos.x > 0.70 : cpos.x < 0.30)
    && (cpos.y < 0.25 || cpos.y > 0.75);

  const candidates = team
    .filter(tm => tm.id !== state.carrierId)
    .filter(tm => !state.expelledIds.has(tm.id))
    .filter(tm => !isThrowIn || Math.hypot(state.pos[tm.id].x - cpos.x, state.pos[tm.id].y - cpos.y) <= maxPassDist)
    .filter(tm => !isThrowIn || tm.slotIndex !== 0)
    .map(tm => {
      const tpos = state.pos[tm.id];
      const dist = Math.hypot(tpos.x - cpos.x, tpos.y - cpos.y);

      const strictAhead = cSide === 'home' ? tpos.x > cpos.x + 0.05 : tpos.x < cpos.x - 0.05;
      const looseAhead  = cSide === 'home' ? tpos.x > cpos.x - 0.05 : tpos.x < cpos.x + 0.05;

      const minOppDist = opps.reduce((m, o) =>
        Math.min(m, Math.hypot(state.pos[o.id].x - tpos.x, state.pos[o.id].y - tpos.y)), Infinity);
      const free = minOppDist > 0.10;

      const lineThreat = opps.reduce((acc, o) => {
        const d = distToSegment(state.pos[o.id], cpos, tpos);
        return d < acc.dist ? { opp: o, dist: d } : acc;
      }, { opp: opps[0], dist: Infinity });

      let score = 0;
      let isCrossTarget = false;

      if (isThrowIn) {
        score += 4.0 - dist * 4.0;
        if (free) score += 2.0;
        if (lineThreat.dist < 0.05) score -= 3.0;
        else if (lineThreat.dist < 0.10) score -= 1.0;
        if (strictAhead) score += 0.5;
        if (dist < 0.05) score -= 20.0;
      } else {
        const carrierProgressX = cSide === 'home' ? cpos.x : 1 - cpos.x;
        const receiverProgressX = cSide === 'home' ? tpos.x : 1 - tpos.x;
        const progress = receiverProgressX - carrierProgressX;
        const inAttackingHalf  = carrierProgressX > 0.50;
        const inAttackingThird = carrierProgressX > 0.66;
        const carrierPressed = opps.some(o => Math.hypot(state.pos[o.id].x - cpos.x, state.pos[o.id].y - cpos.y) < 0.16);

        // Through-ball test: where a forward-running teammate will be a moment
        // later, and whether the lane to THAT space is clear even if a defender
        // sits on the direct line. This is what bends the ball around the lone
        // covering defender in a 2v1 instead of firing it straight at them.
        const tvel = state.vel[tm.id];
        const leadPt = { x: tpos.x + tvel.x * 5.0, y: tpos.y + tvel.y * 5.0 };
        const leadLineThreat = opps.reduce((m, o) =>
          Math.min(m, distToSegment(state.pos[o.id], cpos, leadPt)), Infinity);
        const runningForward = cSide === 'home' ? tvel.x > 0.002 : tvel.x < -0.002;
        const throughBall = runningForward && progress > -0.02 && leadLineThreat > 0.08;

        if (progress >= 0.05) {
          let baseForward = 6.0 + progress * 14.0;
          if (inAttackingHalf)  baseForward += 2.0;
          if (inAttackingThird) baseForward += 3.0;
          score = baseForward;
        } else if (progress > -0.05) {
          let baseLateral = carrierPressed ? 3.5 : 1.5;
          if (inAttackingThird && !carrierPressed) baseLateral = 0.5;
          score = baseLateral;
        } else {
          const backDist = -progress;
          let backPenalty = 2.0;
          if (inAttackingHalf)  backPenalty = 10.0;
          if (inAttackingThird) backPenalty = 20.0;
          if (!inAttackingHalf && carrierPressed) backPenalty = 1.0;
          if (inAttackingHalf && backDist > 0.20) backPenalty += 60.0;
          score = 1.0 - backDist * 4.0 - backPenalty;
        }

        const safetyFactor = clamp(1 - 3.5 * Math.max(0, 0.10 - minOppDist), 0.40, 1.0);
        // A defender on the DIRECT line to the receiver heavily devalues a
        // straight pass (the "pass through the covering defender" glitch) — far
        // steeper than the old gentle multiplier. A genuine through ball into
        // open space is exempt (its real lane, to the lead point, is clear).
        let lineFactor: number;
        if (throughBall)                  lineFactor = 1.0;
        else if (lineThreat.dist < 0.035) lineFactor = 0.15;
        else if (lineThreat.dist < 0.07)  lineFactor = 0.45;
        else if (lineThreat.dist < 0.11)  lineFactor = 0.80;
        else                              lineFactor = 1.0;
        if (score > 0) score *= safetyFactor * lineFactor;

        // Actively prefer the clever ball into space when the direct line is
        // blocked but the run is on.
        if (throughBall && lineThreat.dist < 0.07) score += 5.0;

        // Switch of play: hemmed in centrally → a clear long ball to a genuinely
        // free teammate (typically wide) is worth playing even if it's lateral,
        // to escape the press rather than forcing it through the middle.
        if (carrierPressed && free && minOppDist > 0.14 && lineThreat.dist > 0.09 && dist > 0.25) {
          score += 4.0;
        }

        if (free) score += 1.5;

        if (isCrossingZone) {
          const inBox = (cSide === 'home' ? tpos.x > 0.80 : tpos.x < 0.20) && tpos.y > 0.25 && tpos.y < 0.75;
          if (inBox) {
            isCrossTarget = true;
            score += 12.0;
            if (free) score += 4.0;
          }
        }

        if (role === 'gk') {
          const isCentral = Math.abs(tpos.y - 0.5) < 0.25;
          const isWideTarget = Math.abs(tpos.y - 0.5) > 0.38;
          if (dist < 0.35 && free) {
            score += 8.0;
          } else if (dist >= 0.35 && progress > 0.10) {
            if (isCentral)    score += 4.0;
            if (isWideTarget) score -= 8.0;
            if (free)         score += 3.0;
          }
          if (minOppDist < 0.15) score -= 8.0;
        }

        if (tm.id === state.lastPassFrom) {
          score -= role === 'gk' ? 35.0 : 12.0;
        }

        if (tm.slotIndex === 0 && role !== 'gk') {
          score -= carrierPressed ? 20.0 : 50.0;
          if (dist < 0.20) score -= 30.0;
        }

        if (dist < 0.06) score -= 15.0;
        if (dist > maxPassDist) score -= 10.0;
      }

      return { tm, dist, strictAhead, looseAhead, free, score, lineThreat, isCrossTarget };
    })
    .sort((a, b) => b.score - a.score);

  if (candidates.length === 0 || candidates[0].score < -50.0) {
    if (isThrowIn) {
      const fallback = team
        .filter(tm => tm.id !== state.carrierId && tm.slotIndex !== 0 && !state.expelledIds.has(tm.id))
        .map(tm => ({ tm, d: Math.hypot(state.pos[tm.id].x - cpos.x, state.pos[tm.id].y - cpos.y) }))
        .sort((a, b) => a.d - b.d)[0];
      return fallback ? fallback.tm.id : null;
    }
    return null;
  }

  const hinted = hintTargetId ? candidates.find(c => c.tm.id === hintTargetId) : undefined;
  const chosen = hinted ?? (
    (candidates.length > 1 && candidates[1].score > candidates[0].score - 0.5 && state.rng() < 0.30)
      ? candidates[1]
      : candidates[0]
  );
  return chosen.tm.id;
}

// Corner-specific picker. The generic scorer in findBestPassTarget heavily
// penalises any teammate that's "behind" the carrier (the short partner sits
// roughly level with the kicker at the corner), so we need a dedicated pick.
// Returns { id, isShort } so the caller can shape the pass appropriately.
export function pickCornerTarget(state: MatchState): { id: PlayerId; isShort: boolean } | null {
  const cSide: TeamSide = state.homeSet.has(state.carrierId) ? 'home' : 'away';
  const team = cSide === 'home' ? state.homePlayers : state.awayPlayers;
  const opps = cSide === 'home' ? state.awayPlayers : state.homePlayers;

  // Short option: the designated partner standing near the flag.
  let partnerFree = false;
  if (state.partnerId) {
    const partner = state.playerMap.get(state.partnerId);
    if (partner) {
      const pp = state.pos[partner.id];
      const closestOpp = opps.reduce((m, o) =>
        Math.min(m, Math.hypot(state.pos[o.id].x - pp.x, state.pos[o.id].y - pp.y)), Infinity);
      partnerFree = closestOpp > 0.09;
    }
  }

  // Long option: best attacker in the box, scored by openness and central Y.
  const defendingGoalX = state.cornerSpot
    ? (state.cornerSpot.x < 0.5 ? 0.0 : 1.0)
    : (cSide === 'home' ? 1.0 : 0.0);
  const boxCandidates = team
    .filter(p => p.id !== state.carrierId && p.id !== state.partnerId && p.slotIndex !== 0 && !state.expelledIds.has(p.id))
    .filter(p => {
      const pp = state.pos[p.id];
      const inBoxX = defendingGoalX < 0.5 ? pp.x < 0.18 : pp.x > 0.82;
      const inBoxY = pp.y > 0.20 && pp.y < 0.80;
      return inBoxX && inBoxY;
    })
    .map(p => {
      const pp = state.pos[p.id];
      const closestOpp = opps.reduce((m, o) =>
        Math.min(m, Math.hypot(state.pos[o.id].x - pp.x, state.pos[o.id].y - pp.y)), Infinity);
      const central = 1 - Math.abs(pp.y - 0.5) * 1.6;
      const freedom = clamp(closestOpp / 0.10, 0, 2);
      return { p, score: central + freedom + state.rng() * 0.3 };
    })
    .sort((a, b) => b.score - a.score);
  const longTarget = boxCandidates[0]?.p;

  // 30% short if the partner is genuinely free; otherwise the cross.
  const goShort = partnerFree && state.rng() < 0.30;
  if (goShort && state.partnerId) return { id: state.partnerId, isShort: true };
  if (longTarget) return { id: longTarget.id, isShort: false };
  if (state.partnerId) return { id: state.partnerId, isShort: true };
  return null;
}

export function resolvePass(state: MatchState, t: number, deps: EffectorDeps, hintTargetId?: PlayerId): void {
  const carrier = state.playerMap.get(state.carrierId)!;
  const cSide: TeamSide = state.homeSet.has(state.carrierId) ? 'home' : 'away';
  const cpos    = state.pos[state.carrierId];
  const opps    = cSide === 'home' ? state.awayPlayers : state.homePlayers;
  const role    = roleOf(state, carrier) as 'gk' | 'def' | 'mid' | 'fwd';

  const isThrowIn = state.phase === 'throw_in_holding';
  const isGoalKick = state.phase === 'goal_kick_holding';
  const isCornerPass = state.phase === 'corner_holding';
  const isFoulPass = state.phase === 'foul_holding';

  const isCrossingZone = !isThrowIn && !isGoalKick && role !== 'gk'
    && (cSide === 'home' ? cpos.x > 0.70 : cpos.x < 0.30)
    && (cpos.y < 0.25 || cpos.y > 0.75);

  const isPressed = opps.some(o => Math.hypot(state.pos[o.id].x - cpos.x, state.pos[o.id].y - cpos.y) < 0.16);

  // Panic clear: pressed defender / GK considers booting it long.
  const isDeep = cSide === 'home' ? cpos.x < 0.25 : cpos.x > 0.75;
  if (!isThrowIn && !isGoalKick && !isFoulPass && !isCornerPass && isPressed && (role === 'gk' || role === 'def')) {
    const clearProb = (role === 'gk') ? 0.50 : (isDeep ? 0.35 : 0.15);
    if (state.rng() < clearProb) {
      stateSnap(state, t);
      const clearDirX = cSide === 'home' ? 1.0 : -1.0;
      // Wider Y range than a controlled pass — panic clears spray sideways
      // and occasionally go out for a throw-in. That's intentional.
      const clearDirY = (state.rng() - 0.5) * 1.4;

      state.ballVel = { x: clearDirX * 0.045, y: clearDirY * 0.040 };
      state.ballHeight = 0;
      state.ballHeightVel = 0.035;
      state.ballOwner = null;
      state.ballLastKicker = state.carrierId;
      state.ballLastKickerSide = cSide;
      state.ballKickerLockUntil = t + 1000;
      state.intendedReceiver = null;
      state.kickFrozenUntil.set(state.carrierId, t + KICK_FREEZE_MS);
      state.vel[state.carrierId] = { x: 0, y: 0 };

      stateEmit(state, t, role === 'gk' ? 'goal_kick' : 'pass_forward', cSide, state.carrierId, undefined, '¡Despeje!');
      return;
    }
  }

  // Corner cross/short choice runs through its own picker — the generic
  // scorer treats the short partner as a "back pass" and tanks their score.
  let cornerIsShort = false;
  let chosenId: PlayerId | null;
  if (isCornerPass) {
    const pick = pickCornerTarget(state);
    chosenId = pick?.id ?? null;
    cornerIsShort = pick?.isShort ?? false;
  } else {
    chosenId = findBestPassTarget(state, hintTargetId);
  }
  if (!chosenId) {
    if (isPressed && !isThrowIn) {
      const clearDirX = cSide === 'home' ? 1.0 : -1.0;
      const clearDirY = (state.rng() - 0.5) * 1.8;
      state.ballVel = { x: clearDirX * 0.045, y: clearDirY * 0.035 };
      state.ballHeight = 0;
      state.ballHeightVel = 0.030;
      state.ballOwner = null;
      state.ballLastKicker = state.carrierId;
      state.ballLastKickerSide = cSide;
      state.ballKickerLockUntil = t + 1000;
      state.intendedReceiver = null;
      state.kickFrozenUntil.set(state.carrierId, t + KICK_FREEZE_MS);
      stateEmit(state, t, 'pass_forward', cSide, state.carrierId, undefined, '¡Despeje de emergencia!');
      return;
    }
    deps.resetCarry(carrier);
    return;
  }

  const tpos = state.pos[chosenId];
  const dist = Math.hypot(tpos.x - cpos.x, tpos.y - cpos.y);
  const strictAhead = cSide === 'home' ? tpos.x > cpos.x + 0.05 : tpos.x < cpos.x - 0.05;
  const looseAhead  = cSide === 'home' ? tpos.x > cpos.x - 0.05 : tpos.x < cpos.x + 0.05;
  const lineThreatDist = opps.reduce((acc, o) =>
    Math.min(acc, distToSegment(state.pos[o.id], cpos, tpos)), Infinity);
  const isCrossTarget = isCrossingZone && (cSide === 'home' ? tpos.x > 0.80 : tpos.x < 0.20) && tpos.y > 0.25 && tpos.y < 0.75;

  let passSuccessProb = carrier.passing / 100.0;
  if (lineThreatDist < 0.045) passSuccessProb -= 0.50;
  else if (lineThreatDist < 0.10) passSuccessProb -= 0.25;
  passSuccessProb = Math.max(0.05, Math.min(0.95, passSuccessProb));

  let kind: TimelineEvent['kind'] = strictAhead
    ? (dist > 0.18 ? 'pass_forward' : 'pass_short')
    : (looseAhead ? 'pass_lateral' : 'pass_back');

  const isGKDistribute = role === 'gk' && state.phase === 'gk_holding';
  if (isGKDistribute) kind = 'gk_distribute';
  // Goal kick from the spot: treat like a GK distribute for shaping
  // (lateral pick, lofted height, delayed release) but the actual emit
  // happens in tickPhase 'goal_kick_release' so the kick anim lines up
  // with the impulse leaving the foot.
  const isGoalKickPass = isGoalKick && role === 'gk';

  // Reset the ball to the carrier's exact position before the snap. moveAll
  // pushes state.ball ~0.022 ahead of the carrier (carrier-follow offset for
  // dribbling). Without this, the kick-moment keyframe shows the ball already
  // 0.022 in front of the foot — interpolation to the next keyframe makes
  // the ball continue from there instead of "leaving the foot", which reads
  // as the ball departing a tick late.
  state.ball.x = cpos.x;
  state.ball.y = cpos.y;
  state.ballHeight = 0;

  stateSnap(state, t);

  const targetVel = state.vel[chosenId];
  const isDelayed = isThrowIn || isGKDistribute || isGoalKickPass || isCornerPass || isFoulPass;
  // Lead the pass further when slotting a forward-running teammate in behind, so
  // the ball is played into the space ahead of them (bending around a covering
  // defender) rather than to their feet. Set pieces are never led.
  const receiverRunningForward = cSide === 'home' ? targetVel.x > 0.003 : targetVel.x < -0.003;
  const leadFactor = isDelayed ? 0.0 : (strictAhead && receiverRunningForward ? 6.5 : 3.0);
  const aimX = tpos.x + targetVel.x * leadFactor;
  const aimY = tpos.y + targetVel.y * leadFactor;

  const dx = aimX - cpos.x;
  const dy = aimY - cpos.y;
  const passDist = Math.hypot(dx, dy) || 0.01;

  const aimError = (() => {
    const baseErr = (state.rng() - 0.5) * (1 - passSuccessProb) * 0.25;
    if (isThrowIn || isGKDistribute || isGoalKickPass || isCornerPass || isFoulPass) return baseErr;
    const skillMiss = 1 - carrier.passing / 99;
    const isLongLateral = !strictAhead && passDist > 0.25;
    const isLongForward = strictAhead && passDist > 0.30;
    const shankProb = isLongLateral ? 0.14 + 0.20 * skillMiss : isLongForward ? 0.08 + 0.14 * skillMiss : 0;
    if (state.rng() < shankProb) return (state.rng() - 0.5) * 0.80;
    return baseErr;
  })();
  const cos_e = Math.cos(aimError);
  const sin_e = Math.sin(aimError);
  const errDx = dx * cos_e - dy * sin_e;
  const errDy = dx * sin_e + dy * cos_e;
  const errDist = Math.hypot(errDx, errDy) || passDist;

  let passSpeed: number;
  let heightVelInit: number;

  // Short corner is a low driven ball, not the high cross used for the long
  // option. Treat it as a ground pass so the receiver controls cleanly.
  const isShortCorner = isCornerPass && cornerIsShort;
  // Foul cross variant lofts the ball into the box; pass variant is a normal
  // ground pass; shoot variant falling back here (kicker chose pass) is a
  // controlled lay-off so the receiver can run onto it.
  const isFoulCross = isFoulPass && state.foulVariant === 'cross';
  const isGroundPass = (passDist < 0.25 && !isThrowIn && !isGKDistribute && !isGoalKickPass && !isCornerPass && !isFoulCross && !isCrossTarget)
                    || isShortCorner;

  if (isGroundPass) {
    heightVelInit = 0.0;
    passSpeed = clamp(passDist * 0.15 + 0.02, 0.035, 0.06);
  } else {
    heightVelInit = clamp(passDist * 0.06, 0.015, 0.035);
    if (isThrowIn || isGKDistribute || isGoalKickPass) heightVelInit = Math.max(heightVelInit, 0.025);
    if (isCornerPass)  heightVelInit = clamp(passDist * 0.08, 0.030, 0.050);
    if (isFoulCross)   heightVelInit = clamp(passDist * 0.08, 0.030, 0.050);
    if (isCrossTarget) heightVelInit = clamp(passDist * 0.08, 0.030, 0.050);

    const skillFactor = carrier.passing / 99;
    if (skillFactor > 0.75 && !isCrossTarget && !isCornerPass) heightVelInit *= 0.85;

    const N = (heightVelInit * 2) / 0.005;
    const requiredSpeed = (passDist * 0.04) / (1 - Math.pow(0.96, N));
    passSpeed = clamp(requiredSpeed * 1.02, 0.03, 0.075);
  }

  const newBallVel: Vec2 = { x: (errDx / errDist) * passSpeed, y: (errDy / errDist) * passSpeed };
  const newBallHeight = (isThrowIn || isGKDistribute) ? 0.04 : 0;
  const newBallHeightVel = heightVelInit;

  // Goal kick, corner, and foul kicks keep the kicker mobile through the
  // release window (impulse + freeze + emit happen from tickPhase). Throw-in
  // and gk_holding still freeze here.
  if (!isGoalKickPass && !isCornerPass && !isFoulPass) {
    const freezeMs = isThrowIn ? KICK_FREEZE_MS + 750 : KICK_FREEZE_MS;
    state.kickFrozenUntil.set(state.carrierId, t + freezeMs);
    state.vel[state.carrierId] = { x: 0, y: 0 };
  }

  let distDetail: string | undefined;
  if (isGKDistribute) {
    distDetail = passDist < 0.35 ? 'throw' : 'punt';
  } else if (isThrowIn) {
    distDetail = 'Fuera de banda';
  } else if (isCornerPass) {
    distDetail = isShortCorner ? 'Córner en corto' : '¡Centro al área!';
  } else if (isFoulCross) {
    distDetail = '¡Centro de falta!';
  } else if (isFoulPass) {
    distDetail = 'Falta';
  } else if (isCrossTarget) {
    distDetail = '¡Centro al área!';
  }

  if (isThrowIn || isGKDistribute || isGoalKickPass || isCornerPass || isFoulPass) {
    const isThrowDetail = distDetail === 'throw' || distDetail === 'Fuera de banda';
    const releaseTicks = (isGoalKickPass || isCornerPass || isFoulPass) ? 4 : isThrowDetail ? 1 : 4;
    const lockMs = isThrowDetail ? 600 : 800;

    state.pendingImpulse = {
      vel: newBallVel,
      height: newBallHeight,
      heightVel: newBallHeightVel,
      receiverId: chosenId,
      kickerId: state.carrierId,
      kickerSide: cSide,
      lockUntil: lockMs,
      detail: distDetail,
    };
    if (isGoalKickPass) {
      state.phase = 'goal_kick_release';
    } else if (isCornerPass) {
      state.phase = 'corner_release';
    } else if (isFoulPass) {
      state.phase = 'foul_release';
    } else if (isGKDistribute) {
      state.phase = 'gk_release';
    } else {
      state.phase = 'throw_in_release';
    }
    state.phaseTicks = releaseTicks;
    state.intendedReceiver = chosenId;
    // For goal_kick, corner, and foul, the emit is deferred to tickPhase
    // '*_release' so the renderer's kick animation fires when the ball
    // actually leaves the foot.
    if (!isGoalKickPass && !isCornerPass && !isFoulPass) {
      stateEmit(state, t, kind, cSide, state.carrierId, chosenId, distDetail);
    }
    return;
  }

  state.ballVel = newBallVel;
  state.ballHeight = newBallHeight;
  state.ballHeightVel = newBallHeightVel;
  state.ballOwner = null;
  state.ballLastKicker = state.carrierId;
  state.ballLastKickerSide = cSide;
  state.ballKickerLockUntil = t + 800;
  state.intendedReceiver = chosenId;

  stateEmit(state, t, kind, cSide, state.carrierId, chosenId, distDetail);
}
