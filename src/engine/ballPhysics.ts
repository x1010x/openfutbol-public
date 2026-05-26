// Phase 5 — ball physics, contact detection, and out-of-play resolution.
//
// Hosts the two per-tick ball routines previously embedded in zoneEngine's
// `generateTimeline`. Function bodies are unchanged: this is a mechanical
// extraction, not a rewrite.
//
//   * `simulateBallTick`     — integration + drag + gravity, then player
//                              contact (GK saves, receptions, interceptions),
//                              goal-line crossing (clean goal / posts / out),
//                              side-line throw-in setup, and pickup of a
//                              fully-stopped loose ball.
//   * `simulateBallSettling` — minimal physics for the celebration window
//                              after a goal: no contacts, no event emission.
//
// Carrier-state mutations (`setCarrier`) flow through a deps bag because
// resetting the carry-budget depends on per-player skill profiles still
// computed inside `generateTimeline`. Everything else (events, snaps, phase
// starters) is imported directly.

import type { TeamSide, PlayerId } from '../types/match';
import type { MatchState } from './types';
import type { EnginePlayer } from './zoneEngine';
import { distToSegment } from './geometry';
import { emit as stateEmit, snap as stateSnap, roleOf } from './state';
import { startGKHold, startCelebration, startThrowIn, startGoalKick, startCorner } from './phases';

const TRANSITION_TICKS = 6;

function clamp(v: number, lo: number, hi: number) { return v < lo ? lo : v > hi ? hi : v; }

export interface BallTickDeps {
  setCarrier: (id: PlayerId, side: TeamSide) => void;
}

export function simulateBallTick(state: MatchState, t: number, deps: BallTickDeps): void {
  const AIR_FRICTION    = 0.96;
  const GROUND_FRICTION = 0.85;
  const GRAVITY         = 0.005;
  const GOAL_POST_TOP   = 0.424; // Mapped perfectly to unscaled Y=192 on CAMP_indexed.png (post centerline)
  const GOAL_POST_BOT   = 0.568; // Mapped perfectly to unscaled Y=244 on CAMP_indexed.png (post centerline)
  // Inner edge of the painted posts plus a small margin for visual-perception
  // ambiguity. The previous bound was 0.428 (the strict inside-of-post edge)
  // but at moderate ball heights the rendered sprite (offset upward by
  // h*280 canvas px in Match2D) starts to *visually overlap* the top post
  // even when the ball's ground y is inside the goal — reading as "fuera but
  // counts as goal". 0.434 buys ~4 unscaled px of safety so the engine only
  // scores shots that are clearly under the visual top post.
  const GOAL_INNER_TOP  = 0.434;
  const GOAL_INNER_BOT  = 0.564;
  const CROSSBAR_H      = 0.12;
  // Vertical projection factor used by the renderer: ballSp.y = screenY - h*280
  // (Match2D.tsx) with PLAY_Y span = 718 canvas px. The sprite's apparent
  // ground y therefore equals (ground y) - (280/718)*h. The top inside check
  // uses this visual y so a ball whose sprite is at-or-above the visual top
  // post (e.g. h=0.075 + y=0.4513 → sprite renders just above the visible
  // post) doesn't score even though its ground y is inside the mouth.
  const VIS_H_FACTOR    = 280 / 718;
  const GK_REACH_H      = 0.22;
  const FIELD_REACH_H   = 0.06;
  const R_GK            = 0.038;
  const R_RECEIVER      = 0.028;
  const R_OTHER         = 0.022;

  const prevX = state.ball.x;
  const prevY = state.ball.y;
  const prevHeight = state.ballHeight;

  state.ball.x += state.ballVel.x;
  state.ball.y += state.ballVel.y;
  const drag = state.ballHeight > 0.003 ? AIR_FRICTION : GROUND_FRICTION;
  state.ballVel.x *= drag;
  state.ballVel.y *= drag;

  state.ballHeight += state.ballHeightVel;
  state.ballHeightVel -= GRAVITY;
  if (state.ballHeight < 0) {
    if (Math.abs(state.ballHeightVel) > 0.012) {
      state.ballHeight = 0;
      state.ballHeightVel = -state.ballHeightVel * 0.35;
      state.ballVel.x *= 0.82;
      state.ballVel.y *= 0.82;
    } else {
      state.ballHeight = 0;
      state.ballHeightVel = 0;
      state.ballVel.x *= 0.60;
      state.ballVel.y *= 0.60;
    }
  }

  // Prevent contacts and out-of-bounds re-triggering if the game isn't live
  if (state.phase !== 'live') return;

  // 1. Player contacts first — GK can save before ball crosses line
  for (const p of state.allPlayers) {
    if (p.id === state.ballLastKicker && t < state.ballKickerLockUntil) continue;
    if (state.expelledIds.has(p.id)) continue;

    const ppos   = state.pos[p.id];
    const isGKp  = p.slotIndex === 0;
    const reachH = isGKp ? GK_REACH_H : (p.id === state.intendedReceiver ? 0.12 : FIELD_REACH_H);

    const d = (isGKp || p.id === state.intendedReceiver)
      ? distToSegment(ppos, { x: prevX, y: prevY }, state.ball)
      : Math.hypot(ppos.x - state.ball.x, ppos.y - state.ball.y);

    if (isGKp) {
      const myGoalX = state.homeSet.has(p.id) ? 0.0 : 1.0;
      const isPast = (myGoalX === 0) ? (state.ball.x < -0.005) : (state.ball.x > 1.005);
      if (isPast) continue;
    }

    const isDiving = isGKp && (() => { const d = state.gkDive[p.id]; return !!d && t < d.until; })();
    const radius = isGKp
      ? (isDiving ? 0.085 : R_GK)
      : (p.id === state.intendedReceiver ? R_RECEIVER : R_OTHER);

    if (d >= radius || state.ballHeight >= reachH) continue;

    if (!isGKp && p.id !== state.intendedReceiver && state.ballHeight > 0.02 && state.ballHeightVel > 0.005) {
      continue;
    }

    if (isGKp) {
      const pSide = state.homeSet.has(p.id) ? 'home' : 'away';
      const fromTeammate = state.ballLastKickerSide === pSide;

      if (fromTeammate) {
        // Back-pass rule (1992): no hands on a deliberate pass from a teammate.
        const wasIntended = (p.id === state.intendedReceiver);
        state.lastPassFrom = state.ballLastKicker;
        state.ballOwner = p.id;
        state.ball = { ...state.pos[p.id] };
        state.ballVel = { x: 0, y: 0 };
        state.ballHeight = 0;
        state.ballHeightVel = 0;
        state.intendedReceiver = null;
        deps.setCarrier(p.id, pSide);
        stateEmit(state, t, wasIntended ? 'reception' : 'interception', pSide, p.id, state.ballLastKicker ?? undefined, wasIntended ? 'Recepción' : 'Intercepción');
        stateSnap(state, t);
      } else {
        const ballSpeed = Math.hypot(state.ballVel.x, state.ballVel.y);
        const catchProb = clamp(
          0.60 + 0.30 * (p.defending / 99) - 12.0 * ballSpeed - (isDiving ? 0.35 : 0),
          0.05, 0.85,
        );
        if (state.rng() < catchProb) {
          deps.setCarrier(p.id, pSide);
          startGKHold(state, p.id);
          stateEmit(state, t, 'save', pSide, p.id, state.ballLastKicker ?? undefined, 'catch');
          stateSnap(state, t);
        } else if (isDiving) {
          state.ballVel = {
            x: state.ballVel.x * 0.70 + (state.rng() - 0.5) * 0.015,
            y: state.ballVel.y * 0.70 + (state.rng() - 0.5) * 0.035,
          };
          state.ballHeight = Math.max(0, state.ballHeight - 0.02);
          state.intendedReceiver = null;
          state.ballKickerLockUntil = t + 400;
          state.ballLastKicker = p.id;
          state.ballLastKickerSide = pSide;
          stateEmit(state, t, 'save', pSide, p.id, state.ballLastKicker ?? undefined, 'Manotazo');
          stateSnap(state, t);
        } else {
          state.ballVel = {
            x: -state.ballVel.x * 0.45 + (state.rng() - 0.5) * 0.035,
            y: -state.ballVel.y * 0.45 + (state.rng() - 0.5) * 0.045,
          };
          state.ballHeight = 0.04;
          state.ballHeightVel = 0.01;
          state.intendedReceiver = null;
          state.ballLastKicker = p.id;
          state.ballLastKickerSide = pSide;
          stateEmit(state, t, 'save', pSide, p.id, state.ballLastKicker ?? undefined, 'Despeje');
          stateSnap(state, t);
        }
      }
    } else {
      const pSide = state.homeSet.has(p.id) ? 'home' : 'away';
      state.lastPassFrom = state.ballLastKicker;
      state.ballOwner    = p.id;
      state.ball = { ...state.pos[p.id] };
      state.ballVel      = { x: 0, y: 0 };
      state.ballHeight   = 0;
      state.ballHeightVel = 0;
      const evKind = p.id === state.intendedReceiver ? 'reception' : 'interception';
      state.intendedReceiver = null;
      deps.setCarrier(p.id, pSide);
      if (evKind === 'interception') {
        state.phase     = 'transition';
        state.phaseTicks = TRANSITION_TICKS;
      }
      stateEmit(state, t, evKind, pSide, p.id, state.ballLastKicker ?? undefined, evKind === 'reception' ? 'Recepción' : 'Intercepción');
      stateSnap(state, t);
    }
    return;
  }

  // 2. Goal line crossing (only if no player contact)
  for (const sideTeam of ['home', 'away'] as TeamSide[]) {
    const isHome = sideTeam === 'home';
    const goalX  = isHome ? 0.0 : 1.0;
    const outX   = isHome ? -0.015 : 1.015;

    const crossedGoal = (prevX < goalX && state.ball.x >= goalX) || (prevX > goalX && state.ball.x <= goalX);
    const crossedOut  = (prevX < outX && state.ball.x >= outX) || (prevX > outX && state.ball.x <= outX);

    if (!crossedGoal && !crossedOut) continue;

    // We calculate the exact Y/H of the crossing at the physical goal line (0.0/1.0)
    // even if it just crossed the out line, so post-hit math uses the correct baseline.
    const fracGoal = (goalX - prevX) / ((state.ball.x - prevX) || 0.0001);
    const crossY = prevY + fracGoal * (state.ball.y - prevY);
    const crossH = prevHeight + fracGoal * (state.ballHeight - prevHeight);

    // Use the ball SPRITE's apparent ground y (= crossY shifted up by the
    // renderer's height projection) for the top-edge inside check; keep the
    // physical ground y for the bottom edge — past the bottom post is wide
    // of the goal regardless of how the sprite renders.
    const visualCrossY = crossY - VIS_H_FACTOR * crossH;
    const insideY     = visualCrossY > GOAL_INNER_TOP && crossY < GOAL_INNER_BOT;
    const underBar    = crossH < CROSSBAR_H;

    const scorerSide = sideTeam === 'home' ? 'away' : 'home';

    const scoreGoal = (extraDrag = 1): void => {
      // Anchor the ball at the exact crossing point so the keyframe captures
      // it ON the goal line, not at the post-tick overshoot. Without this,
      // a fast shot ends one tick at (1.05, 0.55), the snap freezes that
      // overshoot, and settling pulls the ball back into the net — visually
      // reading as "ball goes fuera then teleports into the goal".
      state.ball.x = goalX;
      state.ball.y = crossY;
      state.ballHeight = Math.max(0, crossH);
      stateEmit(state, t, 'goal', scorerSide, state.ballLastKicker ?? undefined, undefined, '¡GOOOOL!');
      startCelebration(state, scorerSide, { x: goalX, y: clamp(crossY, 0.2, 0.8) }, extraDrag);
      stateSnap(state, t);
    };

    const shotOff = (atY: number): void => {
      const gk = sideTeam === 'home' ? state.homePlayers[0] : state.awayPlayers[0];
      state.intendedReceiver = null;
      stateEmit(state, t, 'shot_off', state.ballLastKickerSide ?? 'home', state.ballLastKicker ?? undefined, undefined, 'Disparo fuera');

      const lastToucherSide = state.ballLastKickerSide;
      const isCorner = lastToucherSide !== null && lastToucherSide === sideTeam;

      if (isCorner) {
        const cornerSide: TeamSide = sideTeam === 'home' ? 'away' : 'home';
        const cornerX = sideTeam === 'home' ? 0.01 : 0.99;
        const cornerY = atY < 0.5 ? 0.01 : 0.99;
        startCorner(state, { x: cornerX, y: cornerY }, cornerSide);
        stateEmit(state, t, 'corner', cornerSide, state.kickerId ?? undefined, undefined, 'Córner');
      } else {
        const spotX = sideTeam === 'home' ? 0.055 : 0.945;
        const spotY = atY < 0.5 ? 0.42 : 0.58;
        startGoalKick(state, { x: spotX, y: spotY }, gk.id);
      }
    };

    if (crossedGoal) {
      // Post / crossbar collision runs FIRST: a ball whose crossY sits inside
      // the post-collision band (e.g. crossY=0.436 grazes the top post inner
      // edge, |y - GOAL_POST_TOP|=0.012 < POST_RADIUS) is a post hit, not a
      // goal — even though crossY is also > GOAL_INNER_TOP. Same with the
      // crossbar at h≈0.107: insideY true but |h - CROSSBAR_H|<0.015 → bar.
      // The clean-goal check below catches only trajectories that are clear
      // of both bands.
      const POST_RADIUS = 0.015;
      const hitTopPost = Math.abs(crossY - GOAL_POST_TOP) <= POST_RADIUS && crossH <= CROSSBAR_H + POST_RADIUS;
      const hitBotPost = Math.abs(crossY - GOAL_POST_BOT) <= POST_RADIUS && crossH <= CROSSBAR_H + POST_RADIUS;
      const hitCrossbar = insideY && Math.abs(crossH - CROSSBAR_H) <= POST_RADIUS;

      if (hitTopPost || hitBotPost || hitCrossbar) {
        stateEmit(state, t, 'shot_off', state.ballLastKickerSide ?? 'home', state.ballLastKicker ?? undefined, undefined, '¡Al palo!');
        
        let nX: number;
        let nY = 0, nZ = 0;

        if (hitCrossbar) {
          const nz = (crossH - CROSSBAR_H) / POST_RADIUS;
          const nx = (prevX < goalX) ? -1 : 1;
          const len = Math.hypot(nx, nz);
          nX = nx / len;
          nZ = nz / len;
          state.ball.y = crossY;
          state.ballHeight = Math.max(0, CROSSBAR_H + nZ * POST_RADIUS);
        } else {
          const postY = hitTopPost ? GOAL_POST_TOP : GOAL_POST_BOT;
          const ny = (crossY - postY) / POST_RADIUS;
          const nx = (prevX < goalX) ? -1 : 1;
          const len = Math.hypot(nx, ny);
          nX = nx / len;
          nY = ny / len;
          state.ball.y = postY + nY * POST_RADIUS;
          state.ballHeight = Math.max(0, crossH);
        }

        const vx = state.ballVel.x;
        const vy = state.ballVel.y;
        const vz = state.ballHeightVel;
        
        const dot = vx * nX + vy * nY + vz * nZ;
        
        // Bounce restitution
        state.ballVel.x = (vx - 2 * dot * nX) * 0.55;
        state.ballVel.y = (vy - 2 * dot * nY) * 0.55;
        state.ballHeightVel = (vz - 2 * dot * nZ) * 0.55;

        // Visible posts/crossbar sit ~6 canvas px past the painted goal line
        // (engine x = 0 / 1). Resting the ball center on the goal line puts the
        // ball edge flush against the post front; the prior `goalX + nX * POST_RADIUS`
        // placement landed the ball ~24 canvas px in front of the visible post.
        state.ball.x = goalX;
        state.ballKickerLockUntil = t + 600;
        stateSnap(state, t);

        return;
      }

      // Clean goal — crossed cleanly inside the inner edges of the posts and
      // under the bar (no post/crossbar collision was detected above). Firing
      // here, not in the crossedOut branch, anchors the snap when the ball is
      // exactly on the goal line instead of one tick later when it has already
      // overshot 1.015 in x.
      if (insideY && underBar) {
        scoreGoal();
        return;
      }
    }

    if (crossedOut) {
      // Reached only if the ball passed both the goal line and the out line in
      // a single tick AND the crossedGoal branch above didn't return (e.g. the
      // crossing tick fell outside crossedGoal because prevX was already past
      // goalX from a previous tick). Re-check for a clean goal here as a fallback.
      if (insideY && underBar) {
        scoreGoal();
        return;
      }
      const fracOut = (outX - prevX) / ((state.ball.x - prevX) || 0.0001);
      const crossYOut = prevY + fracOut * (state.ball.y - prevY);
      shotOff(crossYOut);
      return;
    }
  }

  // 2e. Safety net: ball ended up beyond a goal line but no goal/shotOff was
  // emitted on the crossing tick. Happens for trajectories where the
  // interpolated `crossH` lands between the bar and the actual arc peak
  // (high lobs over the bar inside the posts) — the goal check rejects them
  // because !underBar, but no return fires either. Without this, the ball
  // sits OOB and players wait infinitely. Use current ball.y for the cross
  // reference since the precise crossing happened in a prior tick.
  if (state.ball.x <= -0.015 || state.ball.x >= 1.015) {
    const sideTeam: TeamSide = state.ball.x <= -0.015 ? 'home' : 'away';
    state.intendedReceiver = null;
    stateEmit(state, t, 'shot_off', state.ballLastKickerSide ?? 'home', state.ballLastKicker ?? undefined, undefined, 'Disparo fuera');
    const lastToucherSide = state.ballLastKickerSide;
    const isCorner = lastToucherSide !== null && lastToucherSide === sideTeam;
    if (isCorner) {
      const cornerSide: TeamSide = sideTeam === 'home' ? 'away' : 'home';
      const cornerX = sideTeam === 'home' ? 0.01 : 0.99;
      const cornerY = state.ball.y < 0.5 ? 0.01 : 0.99;
      startCorner(state, { x: cornerX, y: cornerY }, cornerSide);
      stateEmit(state, t, 'corner', cornerSide, state.kickerId ?? undefined, undefined, 'Córner');
    } else {
      const gk = sideTeam === 'home' ? state.homePlayers[0] : state.awayPlayers[0];
      const spotX = sideTeam === 'home' ? 0.055 : 0.945;
      const spotY = state.ball.y < 0.5 ? 0.42 : 0.58;
      startGoalKick(state, { x: spotX, y: spotY }, gk.id);
    }
    return;
  }

  // 3. Side-line: pass or loose ball exits field laterally.
  // Trigger fires when the ball fully crosses the touchline (y <= -0.015 or y >= 1.015)
  if (state.ball.y <= -0.015 || state.ball.y >= 1.015) {
    state.intendedReceiver = null;

    const outSide: TeamSide = state.ballLastKickerSide === 'home' ? 'away' : 'home';

    stateEmit(state, t, 'throw_in', outSide, undefined, undefined, 'Fuera de banda');

    const team = outSide === 'home' ? state.homePlayers : state.awayPlayers;

    // Pick the closest outfielder to the ball; prefer non-strikers so we don't
    // pull a forward all the way back to the touchline. If only strikers are
    // close, fall back to nearest defender/mid regardless.
    const eligible = team.filter(p => roleOf(state, p) !== 'gk' && !state.expelledIds.has(p.id));
    const nonStrikers = eligible.filter(p => roleOf(state, p) !== 'fwd');
    const pool = nonStrikers.length > 0 ? nonStrikers : eligible;
    const taker: EnginePlayer = pool.reduce((best, p) => {
      const d  = Math.hypot(state.pos[p.id].x - state.ball.x, state.pos[p.id].y - state.ball.y);
      const db = Math.hypot(state.pos[best.id].x - state.ball.x, state.pos[best.id].y - state.ball.y);
      return d < db ? p : best;
    }, pool[0]);

    startThrowIn(state, state.ball, taker.id);
    return;
  }

  // 4. Ball stopped: hand to a nearby player if any
  if (Math.hypot(state.ballVel.x, state.ballVel.y) < 0.003 && state.ballHeight < 0.01) {
    const PICKUP_RADIUS = 0.15;
    const eligible = state.allPlayers.filter(p =>
      !(p.id === state.ballLastKicker && t < state.ballKickerLockUntil)
      && !state.expelledIds.has(p.id));
    if (eligible.length === 0) return;

    const nearest = eligible.reduce((prev, curr) =>
      Math.hypot(state.pos[curr.id].x - state.ball.x, state.pos[curr.id].y - state.ball.y) <
      Math.hypot(state.pos[prev.id].x - state.ball.x, state.pos[prev.id].y - state.ball.y) ? curr : prev
    );
    const nearestDist = Math.hypot(state.pos[nearest.id].x - state.ball.x, state.pos[nearest.id].y - state.ball.y);
    if (nearestDist > PICKUP_RADIUS) return;

    state.intendedReceiver = null;
    const nSide = state.homeSet.has(nearest.id) ? 'home' : 'away';
    deps.setCarrier(nearest.id, nSide);
    state.ballOwner = nearest.id;
    stateEmit(state, t, 'interception', nSide, nearest.id, state.ballLastKicker ?? undefined, 'Segundo balón');
  }
}

// The post-goal celebration physics now live in ballSettling.ts; re-exported
// here so existing `from './ballPhysics'` imports keep working.
export { simulateBallSettling } from './ballSettling';
