// Free kicks, penalties, and red-card walk-offs. One cohesive slice because a
// penalty is just a foul variant and an expulsion always resolves into a foul.
// Contents: pitch geometry helpers, penalty-spot constants, the startFoul /
// startExpulsion entries, wall sizing/placement, the foul + expulsion force
// fields, and every foul_*/expulsion_* tick handler.

import type { Vec2, PlayerId, TeamSide } from '../../types/match';
import type { EnginePlayer } from '../zoneEngine';
import { spring } from '../forces';
import { sideOf } from '../state';
import { distToSegment } from '../geometry';
import type { FoulVariant } from '../types';
import {
  clamp, PENALTY_RUNUP_DIST, WALL_DIST_NORM,
  FOUL_SETUP_TICKS, FOUL_HOLD_TICKS, KICK_FREEZE_MS,
  EXPULSION_HOLD_TICKS, EXPULSION_WALK_TICKS, EXPULSION_WALKOUT_TICKS,
} from './shared';
import type { CarrierRole, PhaseForceCtx, PhaseCallbacks, MatchState } from './shared';

// Penalty spot is 11 m from the goal line (FIFA). Penalty box depth is 16.5 m,
// half-width is 20.16 m from the centre line.
const PENALTY_SPOT_DIST   = 11   / 105;   // 0.1048
const PENALTY_BOX_DEPTH   = 16.5 / 105;   // 0.1571
const PENALTY_BOX_HALF_W  = 20.16 / 68;   // 0.2965

// Painted penalty spots in CAMP_indexed.png are not symmetric with the
// canonical 11m point. The field art is authoritative for visual alignment
// (see CLAUDE.md Ball-in-the-net effect), so the engine spot is offset to
// match the paint instead of FIFA spec. Offsets are in canvas px and signed
// in normalized field x — negative = toward home (left) goal, positive =
// toward away (right) goal. Tune these here if the ball still doesn't sit
// exactly on the painted spot; one canvas px ≈ 1/1198 normalized.
// PLAY_X span = 1198 canvas px (see Match2D.tsx).
const PENALTY_PAINTED_OFFSET_HOME_PX = -4;  // home attacks right; tuned via sandbox until ball sat on painted spot
const PENALTY_PAINTED_OFFSET_AWAY_PX = +10; // away attacks left;  tuned via sandbox (raised across verify cycles: +2 → +4 → +6 → +10)
const PENALTY_SPOT_X_HOME_ATK = (1 - PENALTY_SPOT_DIST) + PENALTY_PAINTED_OFFSET_HOME_PX / 1198;
const PENALTY_SPOT_X_AWAY_ATK = PENALTY_SPOT_DIST       + PENALTY_PAINTED_OFFSET_AWAY_PX  / 1198;

// Field dimensions in metres. Used to convert normalized coordinates to a
// true straight-line distance — without scaling, hypot(dx, dy) would treat
// 1.0 in y as 1.0 in x even though the field is shorter on the short axis.
const FIELD_X_M = 105;
const FIELD_Y_M = 68;
const Y_TO_X = FIELD_Y_M / FIELD_X_M;

export function isInPenaltyArea(spot: Vec2, atkSide: TeamSide): boolean {
  const inDepth = atkSide === 'home'
    ? spot.x > 1.0 - PENALTY_BOX_DEPTH
    : spot.x < PENALTY_BOX_DEPTH;
  return inDepth && Math.abs(spot.y - 0.5) < PENALTY_BOX_HALF_W;
}

// Straight-line distance, in metres, from a normalized field point to the
// centre of the goal that the attacker is shooting at. Used by the foul logic
// to decide shoot/cross/pass and wall size — using x-component alone would
// treat a foul at the corner flag as "close to goal" when it's really 30m+
// from the goal mouth.
export function distToGoalCenter_m(spot: Vec2, atkSide: TeamSide): number {
  const goalX = atkSide === 'home' ? 1.0 : 0.0;
  const dx = spot.x - goalX;
  const dy = (spot.y - 0.5) * Y_TO_X;
  return Math.hypot(dx, dy) * FIELD_X_M;
}

export function applyFoulForces(
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
  const { phase, ball, kickerId, intendedReceiver } = ctx;
  const kickerSide: TeamSide | null = kickerId !== null ? ctx.sideOf(kickerId) : null;
  const spot = ctx.foulSpot ?? ball;
  const attackSign = kickerSide === 'home' ? 1 : -1;
  const runUpDist = ctx.foulVariant === 'penalty' ? PENALTY_RUNUP_DIST : 0.012;
  const windUpX = spot.x - attackSign * runUpDist;
  const windUpY = spot.y;

  if (p.id === kickerId) {
    let target: Vec2;
    let gain: number;
    if (phase === 'foul_setup') {
      target = { x: windUpX, y: windUpY };
      gain = 0.22;
    } else if (phase === 'foul_holding') {
      target = { x: windUpX, y: windUpY };
      gain = 0.45;
    } else {
      target = { x: spot.x, y: spot.y };
      gain = 0.60;
    }
    const sf = spring(ppos, target, gain);
    force.x += sf.x;
    force.y += sf.y;
    return true;
  }

  if (isGK) {
    // GK holds their line firmly while the wall is being set.
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

  const isDefendingSide = pSide !== kickerSide;

  // Penalty: FIFA layout requires everyone outside the box AND behind the
  // 9.15m arc, except kicker + GK. Within that constraint we let a subset
  // of players from BOTH teams crowd the arc edge for rebound battles:
  // attackers ready to pounce on a parry, defenders ready to clear and
  // launch a counter. Crashers are picked deterministically by role +
  // slotIndex so the same formation always produces the same crew.
  if (ctx.foulVariant === 'penalty') {
    const arcX = kickerSide === 'home'
      ? spot.x - WALL_DIST_NORM   // ~0.808
      : spot.x + WALL_DIST_NORM;  // ~0.192
    const isKickerSide = pSide === kickerSide;

    // Attacking crashers: both forwards + one mid (slot % 3 === 0).
    // Defending crashers: two central CBs (slots 2,3) + one mid (slot % 3 === 0).
    // Result: ~3 vs 3 jostling at the arc edge while everyone else holds
    // shape further back (counter-attack potential intact).
    const isAttackingCrasher =
      isKickerSide && (role === 'fwd' || (role === 'mid' && p.slotIndex % 3 === 0));
    const isDefendingCrasher =
      !isKickerSide && (
        (role === 'def' && (p.slotIndex === 2 || p.slotIndex === 3)) ||
        (role === 'mid' && p.slotIndex % 3 === 0)
      );

    let targetX: number;
    let targetY: number;

    if (isAttackingCrasher || isDefendingCrasher) {
      // Just behind the arc — ~2m back so they don't ride the line.
      const ARC_REBOUND_GAP = 0.020;
      targetX = kickerSide === 'home'
        ? arcX - ARC_REBOUND_GAP
        : arcX + ARC_REBOUND_GAP;
      // Lateral lanes — deterministic from slotIndex, spread across [0.36, 0.64].
      const LANES_Y = [0.36, 0.50, 0.64, 0.42, 0.58];
      targetY = LANES_Y[p.slotIndex % LANES_Y.length];
    } else {
      // Non-crashers: hold base, clamped well behind the arc.
      targetX = kickerSide === 'home'
        ? clamp(base.x, 0.05, arcX - 0.05)
        : clamp(base.x, arcX + 0.05, 0.95);
      targetY = clamp(base.y, 0.20, 0.80);
    }

    const target: Vec2 = { x: targetX, y: targetY };
    const sf = spring(ppos, target, 0.18);
    force.x += sf.x;
    force.y += sf.y;
    return true;
  }

  // Wall member: slot into the perpendicular line at WALL_DIST_NORM from
  // the ball, between ball and own goal centre. Targets pre-computed at
  // startFoul so the setup gate (wait-for-wall) shares one source of truth.
  if (isDefendingSide && ctx.wallIds && ctx.wallTargets && ctx.wallIds.includes(p.id)) {
    const target = ctx.wallTargets[p.id];
    if (target) {
      const sf = spring(ppos, target, 0.40);
      force.x += sf.x;
      force.y += sf.y;
      return true;
    }
  }

  if (isDefendingSide) {
    // Non-wall defenders: pack the box for shoot/cross variants, hold a
    // compact shape for pass variant. Light pull to base so they don't
    // wander into the wall lane.
    let targetX = base.x;
    let targetY = base.y;
    const ownGoalX = pSide === 'home' ? 0.0 : 1.0;
    if (ctx.foulVariant === 'shoot' || ctx.foulVariant === 'cross') {
      // Drop into the box (~0.10 from own goal line). Wider lane assignments
      // by slotIndex so they spread along the y-axis instead of clumping.
      if (role === 'def') {
        targetX = pSide === 'home' ? 0.12 : 0.88;
        targetY = clamp(base.y, 0.30, 0.70);
      } else if (role === 'mid') {
        targetX = pSide === 'home' ? 0.20 : 0.80;
        targetY = clamp(base.y, 0.25, 0.75);
      } else {
        // Forwards: stay just past their own third, ready for a counter.
        targetX = pSide === 'home' ? clamp(base.x, 0.30, 0.55) : clamp(base.x, 0.45, 0.70);
      }
      // Keep all defenders strictly on their own side of the wall (between
      // wall and own goal). Avoid blocking the wall lane from the front.
      if (pSide === 'home' && targetX > spot.x - 0.02) targetX = ownGoalX + 0.18;
      if (pSide === 'away' && targetX < spot.x + 0.02) targetX = ownGoalX - 0.18;
    }
    const target: Vec2 = { x: clamp(targetX, 0.03, 0.97), y: clamp(targetY, 0.03, 0.97) };
    const sf = spring(ppos, target, 0.15);
    force.x += sf.x;
    force.y += sf.y;
    return true;
  }

  // Attacking (kicker's) side teammates.
  if (ctx.foulVariant === 'shoot' || ctx.foulVariant === 'cross') {
    let targetX = base.x;
    let targetY = base.y;
    if (role === 'fwd') {
      targetX = pSide === 'home' ? 0.85 : 0.15;
      targetY = p.slotIndex % 2 === 0 ? 0.42 : 0.58;
    } else if (role === 'mid') {
      // One mid joins the box; the rest hold the penalty arc for second balls.
      if (p.slotIndex % 3 === 0) {
        targetX = pSide === 'home' ? 0.80 : 0.20;
        targetY = clamp(base.y, 0.35, 0.65);
      } else {
        targetX = pSide === 'home' ? 0.70 : 0.30;
        targetY = base.y;
      }
    } else if (role === 'def') {
      // One advanced fullback for second balls, the rest hold the line.
      if (p.slotIndex === 1 || p.slotIndex === 5) {
        targetX = pSide === 'home' ? 0.55 : 0.45;
        targetY = clamp(base.y, 0.25, 0.75);
      } else {
        targetX = pSide === 'home' ? 0.45 : 0.55;
      }
    }
    // Attackers must clear the defensive wall (covers both "no one between
    // kicker and wall" and the FIFA 1m separation rule). When no wall exists
    // just stay forward of the spot.
    if (ctx.wallIds && ctx.wallIds.length > 0) {
      const clearX = pSide === 'home'
        ? spot.x + WALL_DIST_NORM + 0.015
        : spot.x - WALL_DIST_NORM - 0.015;
      if (pSide === 'home' && targetX < clearX) targetX = clearX;
      if (pSide === 'away' && targetX > clearX) targetX = clearX;
    } else {
      if (pSide === 'home' && targetX < spot.x + 0.03) targetX = spot.x + 0.03;
      if (pSide === 'away' && targetX > spot.x - 0.03) targetX = spot.x - 0.03;
    }
    const target: Vec2 = { x: clamp(targetX, 0.03, 0.97), y: clamp(targetY, 0.03, 0.97) };
    const sf = spring(ppos, target, 0.18);
    force.x += sf.x;
    force.y += sf.y;
    return true;
  }

  // Pass variant: spread shape, light hold near base. The kicker will pick
  // any forward teammate via findBestPassTarget at holding-time.
  const sf = spring(ppos, base, 0.12);
  force.x += sf.x;
  force.y += sf.y;
  return true;
}

export function applyExpulsionForces(
  _p: EnginePlayer,
  _isGK: boolean,
  _pSide: TeamSide,
  _role: CarrierRole,
  _base: Vec2,
  ppos: Vec2,
  _pvel: Vec2,
  force: Vec2,
  ctx: PhaseForceCtx,
): boolean {
  // moveAll filters everyone except the walker to a freeze before reaching
  // this branch, so we only get the expelled player here. Returning `true`
  // claims the phase so the slot-spring / wander forces don't fight the
  // walk-off integration.
  if (ctx.phase === 'expulsion_hold') {
    // 5-second pause at the foul spot so the foul + card overlays are
    // readable before the player starts walking. No force — they stay put.
  } else if (ctx.phase === 'expulsion_walk') {
    // Diagonal toward the top centreline so the walker doesn't cross the
    // sponsor boards on the far right/left of the pitch. Spring force is
    // strong enough to keep them at near-max speed for the full leg.
    const sf = spring(ppos, { x: 0.5, y: 0.0 }, 0.55);
    force.x += sf.x;
    force.y += sf.y;
  } else {
    // expulsion_walkout: straight north past the camera. Target sits well
    // above the canvas so the spring doesn't decelerate before they vanish.
    const sf = spring(ppos, { x: 0.5, y: -0.30 }, 0.60);
    force.x += sf.x;
    force.y += sf.y;
  }
  return true;
}

// Free kick (foul). Categorises the foul by spot+side, picks a stat-best
// kicker, builds a defensive wall if shooting/crossing range, and anchors the
// ball at the spot. The fouled player stays on the floor via downUntil (set in
// checkTackle); the kicker walks to the wind-up spot during the setup window.
//
// Variant is decided by (distance to goal, lane):
//   shoot — central within 30m → direct attempt (the holding phase rolls a
//           probabilistic shoot-vs-pass with closer = more shot).
//   cross — wide within 26m → lofted ball into the box.
//   pass  — too far, too wide, or both → safe build-up pass.
export function startFoul(state: MatchState, spot: Vec2, atkSide: TeamSide, victimId?: PlayerId): void {
  const variant = decideFoulVariant(spot, atkSide);
  state.foulVariant = variant;

  // Penalty: ball goes to the penalty spot regardless of where the foul happened.
  // Per-side spot constants account for an asymmetry in the painted field art.
  const ballSpot: Vec2 = variant === 'penalty'
    ? { x: atkSide === 'home' ? PENALTY_SPOT_X_HOME_ATK : PENALTY_SPOT_X_AWAY_ATK, y: 0.5 }
    : { x: spot.x, y: spot.y };
  state.foulSpot = { x: ballSpot.x, y: ballSpot.y };

  // For no-wall (pass) fouls the fouled player takes their own free kick —
  // they're already at the spot and can play quickly once they get up.
  state.kickerId = (variant === 'pass' && victimId)
    ? victimId
    : pickFoulKicker(state, atkSide, variant);
  state.partnerId = null;
  state.possession = atkSide;

  // For penalties: place the kicker at a fixed run-up start ~0.135 behind the
  // spot so they always walk forward to the wind-up mark (PENALTY_RUNUP_DIST).
  // This snap is masked by the penalty overlay and prevents the kicker from
  // being already within the canPickup radius, which would skip the walk.
  if (variant === 'penalty' && state.kickerId) {
    const attackSign = atkSide === 'home' ? 1 : -1;
    state.pos[state.kickerId] = {
      x: ballSpot.x - attackSign * (PENALTY_RUNUP_DIST + 0.08),
      y: ballSpot.y,
    };
    state.vel[state.kickerId] = { x: 0, y: 0 };
  }

  const defSide: TeamSide = atkSide === 'home' ? 'away' : 'home';
  const distGoal_m = distToGoalCenter_m(spot, atkSide);
  const wallN = wallSize(distGoal_m, variant);
  state.wallIds = wallN > 0 ? pickWall(state, defSide, spot, wallN) : null;
  // Pre-compute each wall member's target slot so applyPhaseForces and the
  // setup-gate (wait until wall is fully placed) share one source of truth.
  if (state.wallIds) {
    const targets: Record<PlayerId, Vec2> = {};
    for (let i = 0; i < state.wallIds.length; i++) {
      targets[state.wallIds[i]] = computeWallTarget(spot, defSide, i, state.wallIds.length);
    }
    state.wallTargets = targets;
  } else {
    state.wallTargets = null;
  }

  state.ball = { x: ballSpot.x, y: ballSpot.y };
  state.ballVel = { x: 0, y: 0 };
  state.ballHeight = 0;
  state.ballHeightVel = 0;
  state.ballOwner = null;
  state.ballLastKicker = null;
  state.ballLastKickerSide = null;
  state.ballKickerLockUntil = 0;
  state.intendedReceiver = null;
  state.pendingImpulse = null;
  state.needsKickoffPass = false;
  state.throwInSpot = null;
  state.goalKickSpot = null;
  state.cornerSpot = null;

  state.phase = 'foul_setup';
  state.phaseTicks = FOUL_SETUP_TICKS;
}

// Walk-off entry. Used in place of startFoul when checkTackle gives a red
// card. The ball stays wherever the foul left it — startFoul, called when
// expulsion_walkout completes, will reposition it at the foul/penalty spot.
// Avoiding the ball reposition here is what stops the visible "teleport"
// that bothered the user on off-ball aggression. Only ownership state is
// cleared so the ball is treated as loose during the hold/walk.
export function startExpulsion(state: MatchState): void {
  state.ballVel = { x: 0, y: 0 };
  state.ballHeightVel = 0;
  state.ballOwner = null;
  state.ballLastKicker = null;
  state.ballLastKickerSide = null;
  state.ballKickerLockUntil = 0;
  state.intendedReceiver = null;
  state.pendingImpulse = null;
  // Wall/kicker info is irrelevant during the walk-off. startFoul (after the
  // walkout) will populate these.
  state.kickerId = null;
  state.partnerId = null;
  state.wallIds = null;
  state.wallTargets = null;

  state.phase = 'expulsion_hold';
  state.phaseTicks = EXPULSION_HOLD_TICKS;
}

function decideFoulVariant(spot: Vec2, atkSide: TeamSide): FoulVariant {
  if (isInPenaltyArea(spot, atkSide)) return 'penalty';
  const distGoal_m = distToGoalCenter_m(spot, atkSide);
  const dyFromCenter = Math.abs(spot.y - 0.5);
  if (distGoal_m > 32) return 'pass';
  if (dyFromCenter < 0.22) return 'shoot';
  return 'cross';
}

function pickFoulKicker(state: MatchState, atkSide: TeamSide, variant: FoulVariant): PlayerId {
  const team = atkSide === 'home' ? state.homePlayers : state.awayPlayers;
  const candidates = team.filter(p => p.slotIndex !== 0 && !state.expelledIds.has(p.id));
  if (candidates.length === 0) return team[0].id;
  const score = variant === 'shoot' || variant === 'penalty'
    ? (p: EnginePlayer) => p.shooting * 0.8 + p.passing * 0.2
    : variant === 'cross'
    ? (p: EnginePlayer) => p.passing * 0.7 + p.shooting * 0.3
    : (p: EnginePlayer) => p.passing;
  return candidates.reduce((best, p) => score(p) > score(best) ? p : best).id;
}

// Wall sizing: proportional from 7 (≤16m) down to 3 (28-32m) for shoot;
// cross variant gets a smaller token wall to cover the near post.
function wallSize(distGoal_m: number, variant: FoulVariant): number {
  if (variant === 'pass' || variant === 'penalty') return 0;
  if (distGoal_m > 32) return 0;
  if (variant === 'shoot') {
    if (distGoal_m < 18) return 5;
    if (distGoal_m < 22) return 4;
    if (distGoal_m < 26) return 3;
    return 2;
  }
  // cross: smaller, just to cover near post
  if (distGoal_m < 18) return 3;
  if (distGoal_m < 22) return 2;
  return 1;
}

// Probability the kicker goes for a direct shot from a free kick rather than
// passing. Closer + better shooter = higher shot probability. Only consulted
// when foulVariant === 'shoot' (cross/pass variants never shoot).
//
// Anchor points (rough): 17m + good shooter ≈ 0.85, 30m + average ≈ 0.20.
export function decideFoulShoot(state: MatchState): boolean {
  if (state.foulVariant === 'penalty') return true;
  if (state.foulVariant !== 'shoot' || !state.kickerId || !state.foulSpot) return false;
  const kicker = state.playerMap.get(state.kickerId);
  if (!kicker) return false;
  const kSide: TeamSide = state.homeSet.has(state.kickerId) ? 'home' : 'away';
  const distGoal_m = distToGoalCenter_m(state.foulSpot, kSide);
  // Linear from 17m (0.85) down to 30m (0.20), clamped.
  const base = 0.85 - ((distGoal_m - 17) / 13) * 0.65;
  const skillBonus = (kicker.shooting / 99) * 0.15 - 0.075;
  const finalProb = Math.max(0.05, Math.min(0.92, base + skillBonus));
  return state.rng() < finalProb;
}

// Whether every wall member is within tolerance of their assigned target
// slot. Returns true if no wall is needed (variant=pass) so the setup gate
// reads "trivially ready".
//
// TOL controls how aligned the barrier looks when foul_setup ends and the
// wall freezes (move.ts pins MAX_SPEED=0 once phase flips to foul_holding).
// Previously 0.025 (~30 canvas px) which meant the slowest member could be
// stuck up to that distance from their target while faster ones had settled
// nearly on-target — producing the visible "one player adelantado" effect.
// 0.008 (~1 source px / ~2 canvas px) is tight enough to read as a clean
// line but loose enough to clear in 2-3 extra ticks given the spring
// oscillation amplitude.
export function isWallSet(state: MatchState): boolean {
  if (!state.wallIds || !state.wallTargets) return true;
  const TOL = 0.008;
  for (const wid of state.wallIds) {
    const tgt = state.wallTargets[wid];
    if (!tgt) continue;
    const wpos = state.pos[wid];
    if (Math.hypot(wpos.x - tgt.x, wpos.y - tgt.y) > TOL) return false;
  }
  return true;
}

// Target position for a single wall member. Indices [0..N-1] lay out in a
// perpendicular line to the ball→goal axis, 9.15m past the ball, with 0.025
// lateral separation between members. Symmetric: idx (N-1)/2 sits on the line.
export function computeWallTarget(spot: Vec2, defSide: TeamSide, idx: number, N: number): Vec2 {
  const goalCx = defSide === 'home' ? 0.0 : 1.0;
  const goalCy = 0.5;
  const dx = goalCx - spot.x;
  const dy = goalCy - spot.y;
  const d = Math.hypot(dx, dy) || 1;
  const ux = dx / d, uy = dy / d;
  const wallCx = spot.x + ux * WALL_DIST_NORM;
  const wallCy = spot.y + uy * WALL_DIST_NORM;
  const px = -uy, py = ux;
  const slotOffset = (idx - (N - 1) / 2) * 0.015;
  return {
    x: clamp(wallCx + px * slotOffset, 0.03, 0.97),
    y: clamp(wallCy + py * slotOffset, 0.03, 0.97),
  };
}

// Pick the N defenders closest to the ball→goal line — the natural candidates
// to step into a wall. GK excluded (they stay on the line).
function pickWall(state: MatchState, defSide: TeamSide, spot: Vec2, N: number): PlayerId[] {
  const defTeam = defSide === 'home' ? state.homePlayers : state.awayPlayers;
  const goalX = defSide === 'home' ? 0.0 : 1.0;
  const goalPos: Vec2 = { x: goalX, y: 0.5 };
  return defTeam
    .filter(p => p.slotIndex !== 0 && !state.expelledIds.has(p.id))
    .map(p => ({ p, d: distToSegment(state.pos[p.id], spot, goalPos) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, N)
    .map(c => c.p.id);
}

export function tickFoulSetup(state: MatchState, t: number, callbacks: PhaseCallbacks): void {
  // Setup timer expired. Extend if the kicker hasn't reached the wind-up
  // OR if the wall hasn't fully formed yet — the pickup branch in zoneEngine
  // will transition us to holding the moment both conditions are met.
  if (state.foulSpot) {
    const kp = state.pos[state.kickerId!];
    const attackSign = state.homeSet.has(state.kickerId!) ? 1 : -1;
    const runUpDist = state.foulVariant === 'penalty' ? PENALTY_RUNUP_DIST : 0.012;
    const windUpX = state.foulSpot.x - attackSign * runUpDist;
    const d = Math.hypot(kp.x - windUpX, kp.y - state.foulSpot.y);
    if (d > 0.025 || !isWallSet(state)) {
      state.phaseTicks = 4;
      return;
    }
  }
  // Fallback: kicker and wall are both ready but pickup didn't fire (rare).
  if (state.ballOwner !== state.kickerId) {
    state.ballOwner = state.kickerId;
    state.ballHeight = 0;
    state.ballHeightVel = 0;
    state.ballVel = { x: 0, y: 0 };
    if (state.foulSpot) state.ball = { x: state.foulSpot.x, y: state.foulSpot.y };
    callbacks.setCarrier(state.kickerId!, sideOf(state, state.kickerId!));
  }
  state.vel[state.kickerId!] = { x: 0, y: 0 };
  state.phase = 'foul_holding';
  state.phaseTicks = FOUL_HOLD_TICKS;
  callbacks.snap(t);
}

export function tickFoulHolding(state: MatchState, t: number, callbacks: PhaseCallbacks): void {
  // Probabilistic shoot for variant='shoot'; cross/pass always pass.
  const shouldShoot = decideFoulShoot(state);
  if (shouldShoot) {
    callbacks.resolveShot(t, true);
  } else {
    callbacks.resolvePass(t);
  }
  if (state.phase === 'foul_holding') state.phase = 'live';
  callbacks.snap(t);
}

export function tickFoulRelease(state: MatchState, t: number, callbacks: PhaseCallbacks): void {
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

    state.vel[state.kickerId!] = { x: 0, y: 0 };
    state.kickFrozenUntil.set(state.kickerId!, t + KICK_FREEZE_MS);

    if (imp.receiverId) {
      const rpos = state.pos[imp.receiverId];
      const kpos = state.pos[state.kickerId!];
      const dx = rpos.x - kpos.x;
      const dy = rpos.y - kpos.y;
      state.vel[state.kickerId!] = { x: dx * 0.001, y: dy * 0.001 };
    }

    // Keep the wall in formation while the ball is in flight. kickFrozen
    // pins them in place; wallExpireAt drives the time-based cleanup in
    // zoneEngine that clears wallIds/wallTargets ~1.5s later, releasing
    // them to play normally again.
    if (state.wallIds) {
      for (const wid of state.wallIds) {
        state.kickFrozenUntil.set(wid, t + 1500);
        state.vel[wid] = { x: 0, y: 0 };
      }
      state.wallExpireAt = t + 1500;
    }
  }
  state.foulSpot = null;
  state.foulVariant = null;
  state.phase = 'live';
  callbacks.snap(t);
}

export function tickExpulsionHold(state: MatchState, t: number, callbacks: PhaseCallbacks): void {
  // 5s read-time over; the player now starts walking off. Phase flip; snap
  // so the renderer can interpolate from the static hold position to the
  // first walk frame without ghosting.
  state.phase = 'expulsion_walk';
  state.phaseTicks = EXPULSION_WALK_TICKS;
  callbacks.snap(t);
}

export function tickExpulsionWalk(state: MatchState, t: number, callbacks: PhaseCallbacks): void {
  // First walking leg done — the player is near the top centreline; switch
  // to the straight-north walkout.
  state.phase = 'expulsion_walkout';
  state.phaseTicks = EXPULSION_WALKOUT_TICKS;
  callbacks.snap(t);
}

export function tickExpulsionWalkout(state: MatchState, t: number, callbacks: PhaseCallbacks): void {
  // Walker is off-camera — fire the foul that was stashed at carding time.
  // startFoul re-anchors the ball at the foul spot (or moves it to the
  // penalty spot inside the box), picks the kicker/wall from the now-10-man
  // defending side, and flips phase to foul_setup.
  if (state.pendingFoul) {
    const { spot, atkSide, victimId } = state.pendingFoul;
    state.pendingFoul = null;
    startFoul(state, spot, atkSide, victimId);
  } else {
    state.phase = 'live';
  }
  callbacks.snap(t);
}
