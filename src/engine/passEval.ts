// Pass evaluation — Phase 1 of the engine layered refactor.
//
// Extracted from `resolvePass` in `zoneEngine.ts`. Pure functions only:
// given a carrier context and a set of candidate teammates, score each one
// and pick the best with a small noise term. Behavior matches the engine
// before this extraction; the win here is that every contribution shows up
// in `reasons[]` for debugging ("why did this back-pass win?").
//
// See ENGINE_REFACTOR.md for the wider plan and where this fits.

import type { EnginePlayer } from './zoneEngine';
import type { Vec2, PlayerId, TeamSide } from '../types/match';
import { distToSegment } from './geometry';

type CarrierRole = 'gk' | 'def' | 'mid' | 'fwd';

export interface OpponentInfo {
  id: PlayerId;
  pos: Vec2;
}

export interface PassCandidate {
  player: EnginePlayer;
  pos: Vec2;
  dist: number;
  strictAhead: boolean;
  looseAhead: boolean;
  minOppDist: number;
  lineThreat: { dist: number };
  free: boolean;
}

export interface PassCtx {
  carrier: EnginePlayer;
  carrierPos: Vec2;
  carrierSide: TeamSide;
  carrierRole: CarrierRole;
  opponents: OpponentInfo[];
  lastPassFrom: PlayerId | null;
  isThrowIn: boolean;
  isCrossingZone: boolean;
  maxPassDist: number;
}

export interface PassScore {
  score: number;
  isCrossTarget: boolean;
  reasons: string[];
}

function clamp(v: number, lo: number, hi: number) { return v < lo ? lo : v > hi ? hi : v; }

export function buildPassCandidate(
  player: EnginePlayer,
  playerPos: Vec2,
  carrierPos: Vec2,
  carrierSide: TeamSide,
  opponents: OpponentInfo[],
): PassCandidate {
  const dist = Math.hypot(playerPos.x - carrierPos.x, playerPos.y - carrierPos.y);
  const strictAhead = carrierSide === 'home'
    ? playerPos.x > carrierPos.x + 0.05
    : playerPos.x < carrierPos.x - 0.05;
  const looseAhead = carrierSide === 'home'
    ? playerPos.x > carrierPos.x - 0.05
    : playerPos.x < carrierPos.x + 0.05;

  let minOppDist = Infinity;
  for (const o of opponents) {
    const d = Math.hypot(o.pos.x - playerPos.x, o.pos.y - playerPos.y);
    if (d < minOppDist) minOppDist = d;
  }
  const free = minOppDist > 0.10;

  let lineDist = Infinity;
  for (const o of opponents) {
    const d = distToSegment(o.pos, carrierPos, playerPos);
    if (d < lineDist) lineDist = d;
  }

  return {
    player,
    pos: playerPos,
    dist,
    strictAhead,
    looseAhead,
    minOppDist,
    lineThreat: { dist: lineDist },
    free,
  };
}

export function scorePass(c: PassCandidate, ctx: PassCtx): PassScore {
  const { carrierPos, carrierSide, carrierRole, opponents,
          lastPassFrom, isThrowIn, isCrossingZone, maxPassDist } = ctx;
  const { player: tm, pos: tpos, dist, strictAhead,
          minOppDist, lineThreat, free } = c;

  const reasons: string[] = [];
  let score = 0;
  let isCrossTarget = false;
  const log = (label: string, delta: number) => {
    reasons.push(`${label} ${delta >= 0 ? '+' : ''}${delta.toFixed(2)}`);
    score += delta;
  };
  const logMul = (label: string, factor: number) => {
    reasons.push(`${label} x${factor.toFixed(2)}`);
    score *= factor;
  };

  if (isThrowIn) {
    // Throw-in scoring: prefer closer & free options. No "long ball ahead"
    // bonus — the kicker can't realistically throw far, and we never want
    // to launch toward the rival GK.
    log('throw_base', 4.0 - dist * 4.0);
    if (free) log('throw_free', 2.0);
    if (lineThreat.dist < 0.05) log('throw_line_tight', -3.0);
    else if (lineThreat.dist < 0.10) log('throw_line_close', -1.0);
    if (strictAhead) log('throw_ahead', 0.5);
    if (dist < 0.05) log('throw_self_guard', -20.0);
    return { score, isCrossTarget, reasons };
  }

  // Normalized progress scoring (open-play).
  const carrierProgressX = carrierSide === 'home' ? carrierPos.x : 1 - carrierPos.x;
  const receiverProgressX = carrierSide === 'home' ? tpos.x : 1 - tpos.x;
  const progress = receiverProgressX - carrierProgressX;
  const inAttackingHalf  = carrierProgressX > 0.50;
  const inAttackingThird = carrierProgressX > 0.66;
  const carrierPressed = opponents.some(o =>
    Math.hypot(o.pos.x - carrierPos.x, o.pos.y - carrierPos.y) < 0.16);

  if (progress >= 0.05) {
    let baseForward = 6.0 + progress * 14.0;
    if (inAttackingHalf)  baseForward += 2.0;
    if (inAttackingThird) baseForward += 3.0;
    log('forward_base', baseForward);
  } else if (progress > -0.05) {
    let baseLateral = carrierPressed ? 3.5 : 1.5;
    if (inAttackingThird && !carrierPressed) baseLateral = 0.5;
    log('lateral_base', baseLateral);
  } else {
    const backDist = -progress;
    let backPenalty = 2.0;
    if (inAttackingHalf)  backPenalty = 10.0;
    if (inAttackingThird) backPenalty = 20.0;
    if (!inAttackingHalf && carrierPressed) backPenalty = 1.0;
    log('back_base', 1.0 - backDist * 4.0 - backPenalty);
  }

  // Risk attenuation — multiplicative on positive scores, floored at 0.40 so
  // a tightly-marked forward keeps enough value to beat a free retreat.
  const safetyFactor = clamp(1 - 3.5 * Math.max(0, 0.10 - minOppDist), 0.40, 1.0);
  const lineFactor   = clamp(1 - 4.0 * Math.max(0, 0.08 - lineThreat.dist), 0.40, 1.0);
  if (score > 0) {
    logMul('safety',     safetyFactor);
    logMul('line_risk',  lineFactor);
  }

  if (free) log('free', 1.5);

  if (isCrossingZone) {
    const inBox = (carrierSide === 'home' ? tpos.x > 0.80 : tpos.x < 0.20)
                  && tpos.y > 0.25 && tpos.y < 0.75;
    if (inBox) {
      isCrossTarget = true;
      log('cross_target', 12.0);
      if (free) log('cross_free', 4.0);
    }
  }

  if (carrierRole === 'gk') {
    const isCentral = Math.abs(tpos.y - 0.5) < 0.25;
    const isWideTarget = Math.abs(tpos.y - 0.5) > 0.38;
    if (dist < 0.35 && free) {
      log('gk_safe_short', 8.0);
    } else if (dist >= 0.35 && progress > 0.10) {
      if (isCentral)    log('gk_punt_central', 4.0);
      if (isWideTarget) log('gk_punt_wide', -8.0);
      if (free)         log('gk_punt_free', 3.0);
    }
    if (minOppDist < 0.15) log('gk_marked_target', -8.0);
  }

  if (tm.id === lastPassFrom) {
    log('anti_pingpong', carrierRole === 'gk' ? -35.0 : -12.0);
  }

  // Anti-handback to own GK from outfield
  if (tm.slotIndex === 0 && carrierRole !== 'gk') {
    log('anti_gk_return', carrierPressed ? -20.0 : -50.0);
    if (dist < 0.20) log('anti_gk_return_close', -30.0);
  }

  if (dist < 0.06) log('dist_too_short', -15.0);
  if (dist > maxPassDist) log('dist_too_long', -10.0);

  return { score, isCrossTarget, reasons };
}

export interface PassSelection {
  candidate: PassCandidate;
  score: PassScore;
}

export function selectPass(
  ctx: PassCtx,
  candidates: PassCandidate[],
  rng: () => number,
): PassSelection | null {
  if (candidates.length === 0) return null;

  const scored: PassSelection[] = candidates
    .map(c => ({ candidate: c, score: scorePass(c, ctx) }))
    .sort((a, b) => b.score.score - a.score.score);

  if (scored[0].score.score < -50.0) return null;

  // Noise: only swap when scores are genuinely close (within 0.5), not when a
  // lateral is "merely competitive" with a forward option.
  if (scored.length > 1
      && scored[1].score.score > scored[0].score.score - 0.5
      && rng() < 0.30) {
    return scored[1];
  }
  return scored[0];
}
