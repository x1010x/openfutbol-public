// Movement layer — `moveAll` (per-tick force computation + integration for
// every player) lives here. The force computers it calls live in move/:
//   move/gk.ts        — applyGKForces, predictBallCrossY
//   move/intent.ts    — applyIntentForce (bossy-intent → force), intentToForce
//   move/universal.ts — applyOutfieldUniversalForces
//
// Layer model:
//
//   * Phase forces (applyPhaseForces) take precedence — celebration, throw-in
//     phases, kickoff setup, gk_holding/release all run here. If
//     `applyPhaseForces` returns true the rest of the per-player block is
//     skipped.
//   * GK has bespoke logic: locked to the goal line in X, tracks predicted
//     shot crossing Y (committing to a dive for the animation), or watches
//     the ball when it's in the penalty area.
//   * Open-play outfield: universal forces (slot spring, teammate/rival
//     repulsion, defensive retreat, possession pull) plus a tactical force
//     from the player's current Intent. Intent-bossy semantics: the slot
//     spring is scaled by `(1 - dominance)` so an active tactical pull
//     dominates over the formation pull.
//
// Adding a new tactical idea = a new Intent variant in types.ts + a new
// branch in `applyIntentForce`. **Never branch on phase or slotRole here** —
// emit a different Intent from the decision layer instead.

import type { PlayerId, Zone, Lane } from '../types/match';
import type { MatchState, Intent } from './types';
import { clampMagnitude } from './forces';
import { baseSlot } from './lineup';
import { applyPhaseForces, type PhaseForceCtx } from './phases';
import { applyGKForces } from './move/gk';
import { applyIntentForce } from './move/intent';
import { applyOutfieldUniversalForces } from './move/universal';

export { intentToForce } from './move/intent';

function clamp(v: number, lo: number, hi: number) { return v < lo ? lo : v > hi ? hi : v; }

export function moveAll(state: MatchState, intents: Map<PlayerId, Intent>, t: number): void {
  let globalFactor = 1.0;
  if (state.phase === 'freeze') globalFactor = 0.05;

  // Sync ballCell
  const az = clamp(Math.floor(state.ball.x * 6), 0, 5) as Zone;
  const ln: Lane = state.ball.y < 0.33 ? 'T' : state.ball.y < 0.67 ? 'C' : 'B';
  state.ballCell = { zone: az, lane: ln };

  const phaseCtx: PhaseForceCtx = {
    phase: state.phase,
    gkPressStrategy: state.gkPressStrategy,
    possession: state.possession,
    ballOwner: state.ballOwner,
    kickerId: state.kickerId,
    partnerId: state.partnerId,
    intendedReceiver: state.intendedReceiver,
    ball: state.ball,
    throwInSpot: state.throwInSpot,
    goalKickSpot: state.goalKickSpot,
    cornerSpot: state.cornerSpot,
    foulSpot: state.foulSpot,
    foulVariant: state.foulVariant,
    wallIds: state.wallIds,
    wallTargets: state.wallTargets,
    celebSide: state.celebSide,
    celebGoalPos: state.celebGoalPos,
    sideOf: id => state.homeSet.has(id) ? 'home' : 'away',
    homePlayers: state.homePlayers,
    awayPlayers: state.awayPlayers,
    allPlayers: state.allPlayers,
    expelledIds: state.expelledIds,
    pos: state.pos,
    kickoffEntrance: state.kickoffEntrance,
  };

  const inExpulsionPhase = state.phase === 'expulsion_hold'
                        || state.phase === 'expulsion_walk'
                        || state.phase === 'expulsion_walkout';
  // A live substitution plays the same "everyone freezes but the walker(s)"
  // choreography (Bloque 8): the outgoing player(s) walk off while the rest
  // hold. A batch of changes ordered together walk off at once, so the walker
  // is a set here rather than a single id.
  const inSubWalkout = state.phase === 'sub_walkout';
  const inWalkoffPhase = inExpulsionPhase || inSubWalkout;
  const subWalkerSet = inSubWalkout ? new Set(state.subBatch.map(j => j.outId)) : null;
  const expulsionWalkerId = state.pendingFoul?.expelledId ?? null;
  const isWalker = (id: PlayerId): boolean =>
    inSubWalkout ? subWalkerSet!.has(id) : id === expulsionWalkerId;

  for (const p of state.allPlayers) {
    // During the walk-off sequence everyone except the current walker freezes
    // — the camera focuses on the player leaving the pitch and the rest of
    // the set-piece (wall, kicker) doesn't materialise until startFoul fires
    // in tickPhase('expulsion_walkout'). Previously-expelled players (a
    // second sending-off in the same match, say) stay frozen wherever they
    // last were.
    if (inWalkoffPhase) {
      if (!isWalker(p.id)) {
        state.vel[p.id] = { x: 0, y: 0 };
        continue;
      }
      // Walker falls through to the normal force loop so applyPhaseForces
      // can drive them. Skip the standard "expelled = freeze" branch below.
    } else if (state.expelledIds.has(p.id)) {
      // Outside the walk-off phases, expelled players stay parked wherever
      // their walkout left them (off-screen past the top edge).
      state.vel[p.id] = { x: 0, y: 0 };
      continue;
    }
    // Fouled player: pinned to the ground.
    const down = state.downUntil.get(p.id);
    if (down !== undefined) {
      if (t >= down) state.downUntil.delete(p.id);
      else { state.vel[p.id] = { x: 0, y: 0 }; continue; }
    }
    // Kicker frozen during pass/shot delivery animation.
    const kickF = state.kickFrozenUntil.get(p.id);
    if (kickF !== undefined) {
      if (t >= kickF) state.kickFrozenUntil.delete(p.id);
      else { state.vel[p.id] = { x: 0, y: 0 }; continue; }
    }

    const ppos   = state.pos[p.id];
    const pvel   = state.vel[p.id];
    const isHome = state.homeSet.has(p.id);
    const pSide  = isHome ? 'home' : 'away';
    const base   = baseSlot(p);
    const isGK   = p.slotIndex === 0;
    const role   = p.role;

    // Wander timer / vector
    const w = state.wander.get(p.id)!;
    if (--w.timer <= 0) {
      w.dx = (state.rng() - 0.5) * 0.06;
      w.dy = (state.rng() - 0.5) * 0.06;
      w.timer = 5 + Math.floor(state.rng() * 10);
    }

    // Role-aware compactness shift. Defenders hold their line (tight Y, modest
    // X follow); midfielders shift more; forwards push highest and track the
    // ball most aggressively. This is what makes the team advance/retreat as
    // a unit instead of every player drifting toward the ball uniformly.
    if (!isGK && state.phase !== 'celebration' && state.phase !== 'kickoff_setup') {
      let xGain = role === 'def' ? 0.07 : role === 'mid' ? 0.13 : 0.17;
      const yGain = role === 'def' ? 0.04 : role === 'mid' ? 0.10 : 0.11;
      // Push the defensive line higher when our side has possession and the
      // ball is past midfield — otherwise defenders barely advance and the
      // team looks stretched in the opponent's half.
      if (state.possession === pSide) {
        const ballPastMid = pSide === 'home' ? state.ball.x > 0.50 : state.ball.x < 0.50;
        if (ballPastMid) {
          if (role === 'def') xGain = 0.18;
          else if (role === 'mid') xGain = 0.22;
        }
      }
      base.x += (state.ball.x - base.x) * xGain + w.dx;
      base.y += (state.ball.y - base.y) * yGain + w.dy;
    }

    const force = { x: 0, y: 0 };
    const phaseHandled = applyPhaseForces(p, isGK, pSide, role, base, ppos, pvel, force, phaseCtx);

    if (!phaseHandled) {
      if (isGK) {
        applyGKForces(p, isHome, pSide, ppos, base, state, t, force);
      } else {
        const intent = intents.get(p.id) ?? { kind: 'idle' };
        const { dominance } = applyIntentForce(p, intent, state, ppos, force);
        const slotGain = 0.15 * (1 - dominance);
        applyOutfieldUniversalForces(p, pSide, role, ppos, base, slotGain, state, force);
      }
    }

    // Integrate.
    pvel.x = (pvel.x + force.x) * 0.78;
    pvel.y = (pvel.y + force.y) * 0.78;

    // Idle stop: very close to base and ball far away → freeze, enable idle anim.
    if (!isGK && p.id !== state.ballOwner && p.id !== state.intendedReceiver && state.phase === 'live') {
      const distToBase = Math.hypot(ppos.x - base.x, ppos.y - base.y);
      const ballDist   = Math.hypot(ppos.x - state.ball.x, ppos.y - state.ball.y);
      if (distToBase < 0.015 && ballDist > 0.32) {
        pvel.x = 0;
        pvel.y = 0;
      }
    }

    const speedFactor = 0.7 + 0.3 * (p.speed / 99);
    let MAX_SPEED = 0.025 * speedFactor * globalFactor;
    // Injured players move at a fraction of their normal pace. Reads as a
    // limp without any sprite work — they fall behind the play visibly. The
    // multiplier compounds with all other MAX_SPEED tweaks below.
    if (state.injuredIds.has(p.id)) MAX_SPEED *= 0.35;

    // Entrance jog (match start / second-half restart): the 22 walk in from
    // the top-centre tunnel in two single-file lines and disperse to slots
    // once they cross the touchline. Pace is a calm walk-on (not a sprint) so
    // the line stays visibly orderly. KICKOFF_INITIAL_TICKS is sized to give
    // the slowest player (deep in the queue + a south-side slot) time to
    // reach formation; the kicker-arrival gate extends the window if needed.
    if (state.phase === 'kickoff_setup' && state.kickoffEntrance) {
      MAX_SPEED = 0.035 * globalFactor;
    } else if (state.phase === 'halftime_walkout' || state.phase === 'fulltime_walkout') {
      // Walk-off to the locker room: every player diagonals to the top-centre
      // tunnel and queues out. A brisk-jog pace so deep south-side players
      // can still cross the diagonal and exit the frame within the walkout
      // window before kickoff (or the loop) takes over.
      MAX_SPEED = 0.045 * globalFactor;
    } else if (inSubWalkout) {
      // Outgoing player(s) jog briskly to the top-centre tunnel within the
      // SUB_WALKOUT_TICKS window. Only batch walkers reach here; the rest are
      // frozen above.
      MAX_SPEED = 0.05 * globalFactor;
    }

    // Special speeds for Goal Kick
    const inGoalKickPhase =
         state.phase === 'goal_kick_setup'
      || state.phase === 'goal_kick_holding'
      || state.phase === 'goal_kick_release';

    if (inGoalKickPhase) {
      if (p.id === state.kickerId) {
        if (state.phase === 'goal_kick_setup') {
          MAX_SPEED *= 0.6; // Natural walk-back pace
        } else if (state.phase === 'goal_kick_release') {
          MAX_SPEED = 0.015; // Balanced sprint speed to cover the distance in the release window
        } else {
          MAX_SPEED = 0;    // Pinned during hold
        }
      } else {
        MAX_SPEED *= 0.7;   // Others move calmly to positions
      }
    }

    // Same speed shaping for Corner kick.
    const inCornerPhase =
         state.phase === 'corner_setup'
      || state.phase === 'corner_holding'
      || state.phase === 'corner_release';

    if (inCornerPhase) {
      if (p.id === state.kickerId) {
        if (state.phase === 'corner_setup') {
          // Natural sprint to the flag at the kicker's full stat speed —
          // the player isn't tied to any ball-setup timer.
          MAX_SPEED *= 1.0;
        } else {
          MAX_SPEED = 0;    // Pinned at the flag through hold/release
        }
      } else {
        MAX_SPEED *= 0.7;   // Others jog into the box / mark
      }
    }

    // Foul (free kick) speed shaping: lanzador camina al windup, queda pinned
    // en idle durante el holding (5s), y arranca al balón en el release.
    const inFoulPhase =
         state.phase === 'foul_setup'
      || state.phase === 'foul_holding'
      || state.phase === 'foul_release';

    if (inFoulPhase) {
      if (p.id === state.kickerId) {
        if (state.phase === 'foul_setup') {
          MAX_SPEED *= 0.6;   // Natural walk to wind-up
        } else if (state.phase === 'foul_release') {
          MAX_SPEED = 0.015;  // Step into the ball (run-up window)
        } else {
          MAX_SPEED = 0;      // Holding: idle behind the ball
        }
      } else if (state.wallIds && state.wallIds.includes(p.id) && state.phase !== 'foul_setup') {
        // Wall members lock in place once the holding phase begins so the
        // barrier reads as a static formation rather than a fidgeting line.
        MAX_SPEED = 0;
      } else {
        MAX_SPEED *= 0.7;     // Others jog into mark / box
      }
    }

    if (isGK && state.ballOwner === null && !inGoalKickPhase) MAX_SPEED *= 2.0;
    if (isGK) {
      const dive = state.gkDive[p.id];
      if (dive && t < dive.until) MAX_SPEED *= 1.8;
    }
    const newVel = clampMagnitude(pvel, MAX_SPEED);
    pvel.x = newVel.x;
    pvel.y = newVel.y;

    // Throw-in and Goal Kick takers can stand BEHIND the line.
    const inGkPhase = (state.phase === 'goal_kick_setup' || state.phase === 'goal_kick_holding' || state.phase === 'goal_kick_release');
    const isGkKicker = p.id === state.kickerId && inGkPhase;
    const isThrowKicker = p.id === state.kickerId &&
      (state.phase === 'throw_in_setup' || state.phase === 'throw_in_holding' || state.phase === 'throw_in_release');
    const isCornerKicker = p.id === state.kickerId && inCornerPhase;

    // Horizontal bounds: kicker can go slightly off-pitch for the run-up
    let xMin = 0.02, xMax = 0.98;
    if (isGkKicker) {
      const isHome = state.homeSet.has(p.id);
      if (isHome) xMin = -0.05; else xMax = 1.05;
    }
    if (isCornerKicker) {
      // The corner spot is at x ≈ 0.01 / 0.99 — well outside the default
      // [0.02, 0.98] window. Relax in both directions so the kicker can sit
      // exactly on the flag.
      xMin = -0.02; xMax = 1.02;
    }

    // Vertical bounds: throw-in taker stands off-pitch
    let yMin = isThrowKicker ? -0.04 : 0.02;
    let yMax = isThrowKicker ? 1.04  : 0.98;
    if (isCornerKicker) { yMin = -0.02; yMax = 1.02; }
    // Expulsion walker needs to cross the touchline and disappear above the
    // camera — well past the canvas top. Same player is filtered out of all
    // other loops via expelledIds so loosening the bound only affects them.
    if (inExpulsionPhase && isWalker(p.id)) { yMin = -0.30; }
    // Half-time / full-time walk-off: every player leaves through the top
    // tunnel and disappears above the camera. Only the top bound needs to
    // open up — nobody exits south anymore.
    if (state.phase === 'halftime_walkout' || state.phase === 'fulltime_walkout') { yMin = -0.40; }
    // Substitution walk-off: the outgoing player(s) leave through the top-centre
    // tunnel (north, like an expulsion), so only the top bound needs opening.
    if (inSubWalkout && isWalker(p.id)) { yMin = -0.40; }
    // Tunnel entrance: the 22 spawn queued well above the touchline
    // (slot-stacked at y as low as -0.55), so loosen the top clamp until the
    // force field walks them onto the pitch.
    if (state.phase === 'kickoff_setup' && state.kickoffEntrance) { yMin = -0.60; }

    ppos.x = clamp(ppos.x + pvel.x, xMin, xMax);
    ppos.y = clamp(ppos.y + pvel.y, yMin, yMax);

    // Goal-kick rule: no rival outfielder may be inside the kicker's penalty box.
    if (inGoalKickPhase && !isGK && state.kickerId !== null) {
      const kickerSide: 'home' | 'away' = state.homeSet.has(state.kickerId) ? 'home' : 'away';
      const rival = pSide !== kickerSide;
      if (rival && ppos.y > 0.205 && ppos.y < 0.795) {
        if (kickerSide === 'home' && ppos.x < 0.20) {
          ppos.x = 0.20;
          if (pvel.x < 0) pvel.x = 0;
        } else if (kickerSide === 'away' && ppos.x > 0.80) {
          ppos.x = 0.80;
          if (pvel.x > 0) pvel.x = 0;
        }
      }
    }

    if (isGK && !isGkKicker) {
      // GK is normally line-locked to their slot x.
      // During goal kicks, the GK (if they are NOT the kicker) stays on the line.
      ppos.x = base.x;
    }
  }

  // Ball follows the carrier (or stays anchored at the throw-in spot).
  if (state.ballOwner !== null) {
    if ((state.phase === 'throw_in_setup' || state.phase === 'throw_in_holding' || state.phase === 'throw_in_release')
        && state.throwInSpot && state.ballOwner === state.kickerId) {
      state.ball = { x: state.throwInSpot.x, y: state.throwInSpot.y };
    } else if ((state.phase === 'goal_kick_setup' || state.phase === 'goal_kick_holding' || state.phase === 'goal_kick_release')
        && state.goalKickSpot && state.ballOwner === state.kickerId) {
      // Ball sits on the spot through the walk-back, hold, and run-up.
      // The release-end branch in tickPhase is what finally releases it.
      state.ball = { x: state.goalKickSpot.x, y: state.goalKickSpot.y };
    } else if ((state.phase === 'corner_setup' || state.phase === 'corner_holding' || state.phase === 'corner_release')
        && state.cornerSpot && state.ballOwner === state.kickerId) {
      // Ball anchored on the corner flag through the whole sequence.
      state.ball = { x: state.cornerSpot.x, y: state.cornerSpot.y };
    } else if ((state.phase === 'foul_setup' || state.phase === 'foul_holding' || state.phase === 'foul_release')
        && state.foulSpot && state.ballOwner === state.kickerId) {
      // Ball stays exactly on the foul spot through the walk-up, hold, and
      // run-up — without this the generic carrier-follow offset shifts it
      // ~0.022 forward of the kicker as soon as they pick up.
      state.ball = { x: state.foulSpot.x, y: state.foulSpot.y };
    } else if ((state.phase === 'kickoff_setup' || state.needsKickoffPass)
        && state.ballOwner === state.kickerId) {
      // Kickoff: ball stays on the centre spot while the kicker stands behind
      // it. Same trick as throw-in — without this the carrier-follow offset
      // pushes the ball ~0.022 forward of the kicker.
      state.ball = { x: 0.50, y: 0.50 };
    } else {
      const cvel = state.vel[state.ballOwner];
      const speed = Math.hypot(cvel.x, cvel.y);
      const offset = 0.022;
      let dirX: number, dirY: number;
      if (speed > 0.001) {
        dirX = cvel.x / speed;
        dirY = cvel.y / speed;
      } else {
        dirX = state.homeSet.has(state.ballOwner) ? 1.0 : -1.0;
        dirY = 0;
      }
      state.ball = {
        x: clamp(state.pos[state.ballOwner].x + dirX * offset, 0.01, 0.99),
        y: clamp(state.pos[state.ballOwner].y + dirY * offset, 0.01, 0.99),
      };
    }
  }
}
