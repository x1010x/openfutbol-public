import type { MatchTimeline, PlayerId, Vec2 } from '../types/match';
import type { MatchState } from './types';
import type { SlotRole, SlotTag } from './zones';
import {
  createInitialState,
  emit as stateEmit,
  snap as stateSnap,
  sideOf,
  isGamePaused,
  setCarrier,
  resetCarry,
} from './state';
import { tickPhase, resetKickoff } from './phases';
import { decideAll, decideCarrierAction } from './decide';
import { moveAll } from './move';
import { checkTackle, checkOffBallAggression, resolvePass, resolveShot, type EffectorDeps } from './effectors';
import { tickSetupAndBallPhysics } from './loop/ballPickup';
import { tickKickoffRoutine } from './loop/kickoffRoutine';

export interface EnginePlayer {
  id: PlayerId;
  slotIndex: number;
  // Formation-derived layout for this slot (see engine/lineup.ts). `slot` is the
  // base home position the player springs back to off the ball; `slotOffset`
  // (user team only) shifts that anchor forward/back/sideways per the dragged
  // line adjustment. `role`/`tag` drive the off-ball decision layer.
  slot: Vec2;
  slotOffset?: Vec2;
  role: SlotRole;
  tag: SlotTag;
  speed: number;
  dribbling: number;
  passing: number;
  shooting: number;
  defending: number;
  physical: number;
  goalkeeping: number;
  // Disciplinary / fitness state — mutated as the match runs.
  // foulsCommitted counts only fouls *committed* (the tackler in a
  // foulCommitted roll), not received. yellowCount is 0 or 1; second yellow
  // sets redCard=true instead of incrementing. redCard is set on any sending-
  // off (second yellow or straight red). injured is set when a hard foul lands
  // a positive injury roll on the victim.
  foulsCommitted: number;
  yellowCount: number;
  redCard: boolean;
  injured: boolean;
}

const TICK_MS        = 250;
const DURATION_MS    = 90 * 60 * 1000;
const KEYFRAME_EVERY = 4;

// Runs the per-tick loop until durationMs is reached and returns a MatchTimeline.
// Caller is responsible for populating `state` with phase, positions, and any
// phase-specific setup before invoking. `generateTimeline` (full match) and the
// sandbox (scenario presets) are the two entry points.
export function simulateFromState(
  state: MatchState,
  durationMs: number,
  seed: number,
  opts?: { emitHalfTime?: boolean },
): MatchTimeline {
  const TOTAL_TICKS = Math.floor(durationMs / TICK_MS);
  // Full matches always get a half-time at the true midpoint regardless of how
  // compressed the engine timeline is (the viewer plays a 90' game in a couple
  // of real minutes). Sandbox clips fall back to the old length gate so a short
  // scenario doesn't misfire a "Descanso" in the middle.
  const EMIT_HALF_TIME = opts?.emitHalfTime ?? (durationMs >= 5 * 60 * 1000);
  const HALF_TIME_TICK = Math.floor(TOTAL_TICKS / 2);

  const effectorDeps: EffectorDeps = {
    setCarrier: (id, s) => setCarrier(state, id, s),
    resetCarry: (p) => resetCarry(state, p),
  };

  for (let tick = 1; tick < TOTAL_TICKS; tick++) {
    const t = tick * TICK_MS;

    // Time-based wall release: the foul_release branch keeps wallIds populated
    // through the ball's flight (so the formation holds visually and the
    // kickFrozen window covers the same span). Once the window expires, free
    // the wall to play normally again.
    if (state.wallExpireAt > 0 && t >= state.wallExpireAt) {
      state.wallIds = null;
      state.wallTargets = null;
      state.wallExpireAt = 0;
    }

    if (state.phaseTicks > 0) {
      state.phaseTicks--;
      
      // Emit the goal kick event 1 tick (250ms) before the ball is released.
      // This synchronizes the renderer's kick wind-up animation with the ball's departure.
      //
      // Crucially, we also force the kicker onto the ball spot here. The previous
      // snap (after resolvePass at holding→release) captured the kicker at the
      // wind-up offset; this snap captures them on the ball. The renderer
      // interpolates between the two over the 3 release ticks (~750ms), which
      // is what visually plays the run-up. Without forcing the position here the
      // snap would capture wherever the engine integration happens to land
      // (typically a few px short, since the spring decelerates as it approaches
      // the target), and the kick frame would fire from that gap.
      if (state.phase === 'goal_kick_release' && state.phaseTicks === 1) {
        const imp = state.pendingImpulse;
        if (imp && state.kickerId && state.goalKickSpot) {
          state.pos[state.kickerId] = { x: state.goalKickSpot.x, y: state.goalKickSpot.y };
          state.vel[state.kickerId] = { x: 0, y: 0 };
          const side = sideOf(state, state.kickerId);
          stateEmit(state, t, 'goal_kick', side, state.kickerId, imp.receiverId, 'Saque de puerta');
          stateSnap(state, t);
        }
      }

      // Same emit/snap pattern for the corner cross. The 'pass_forward' kind
      // (not 'corner') is what the renderer's firePlayerEvent uses to drive the
      // kick animation; 'corner' was already announced at startCorner time.
      if (state.phase === 'corner_release' && state.phaseTicks === 1) {
        const imp = state.pendingImpulse;
        if (imp && state.kickerId && state.cornerSpot) {
          state.pos[state.kickerId] = { x: state.cornerSpot.x, y: state.cornerSpot.y };
          state.vel[state.kickerId] = { x: 0, y: 0 };
          const side = sideOf(state, state.kickerId);
          stateEmit(state, t, 'pass_forward', side, state.kickerId, imp.receiverId, imp.detail ?? '¡Centro al área!');
          stateSnap(state, t);
        }
      }

      // Foul (free kick) release: force kicker onto the spot one tick before
      // impulse so the run-up reads as a step into the ball. Emit kind depends
      // on whether the kicker shot or passed (variant decided in tickPhase
      // 'foul_holding').
      if (state.phase === 'foul_release' && state.phaseTicks === 1) {
        const imp = state.pendingImpulse;
        if (imp && state.kickerId && state.foulSpot) {
          state.pos[state.kickerId] = { x: state.foulSpot.x, y: state.foulSpot.y };
          state.vel[state.kickerId] = { x: 0, y: 0 };
          const side = sideOf(state, state.kickerId);
          const isShot = imp.detail === '¡Tiro de falta!' || imp.detail === '¡Tiro de penalti!';
          const kind = isShot ? 'shot_on' : 'pass_forward';
          stateEmit(state, t, kind, side, state.kickerId, isShot ? undefined : imp.receiverId, imp.detail);
          stateSnap(state, t);
        }
      }

      if (state.phaseTicks === 0) {
        tickPhase(state, t, {
          resetKickoff: (lastScorer, teleport) =>
            resetKickoff(state, lastScorer, teleport, { resetCarry: (p) => resetCarry(state, p) }),
          resolvePass: (tt) => resolvePass(state, tt, effectorDeps),
          resolveShot: (tt, delayed) => resolveShot(state, tt, delayed),
          emit: (tt, kind, s, actor, target, log) => stateEmit(state, tt, kind, s, actor, target, log),
          snap: (tt) => stateSnap(state, tt),
          setCarrier: (id, s) => setCarrier(state, id, s),
        });
      }
    }

    if (EMIT_HALF_TIME && tick === HALF_TIME_TICK) {
      stateEmit(state, t, 'half_time', state.possession, undefined, undefined, 'Descanso');
      // Half-time is a hard break, not a continuation: stop the current play and
      // restage a centre kickoff with the 22 teleported back into formation.
      // The match always kicks off with HOME (see generateTimeline), so the
      // second half is taken by AWAY → pass lastScorer='home' (kicker = the
      // non-scorer side). The render mirrors the pitch from this point (see
      // animator `flipped`), so the teams visibly change ends for the restart.
      resetKickoff(state, 'home', true, { resetCarry: (p) => resetCarry(state, p) });
      stateEmit(state, t, 'kickoff', state.possession, state.kickerId!, undefined, '¡Segunda parte!');
      stateSnap(state, t);
    }

    const intents = decideAll(state);
    moveAll(state, intents, t);

    // Off-ball aggression check (Fase 5). Iterates defenders inside their
    // provocation window — set by a failed tackle — and may flip the phase
    // to expulsion_walk for a straight red. When that fires, skip the rest
    // of the tick so checkTackle doesn't also run against a fresh foul.
    if (checkOffBallAggression(state, t, effectorDeps)) continue;

    tickSetupAndBallPhysics(state, t);

    // Snap on the regular cadence, plus every tick while the ball is in flight
    // so the renderer can draw a tick-accurate trajectory instead of straight-line
    // segments between sparse keyframes.
    if (tick % KEYFRAME_EVERY === 0 || state.ballOwner === null) stateSnap(state, t);

    if (isGamePaused(state)) continue;

    if (state.ballOwner === null) continue;

    if (tickKickoffRoutine(state, t, effectorDeps)) continue;

    const tackled = checkTackle(state, t, effectorDeps);
    if (tackled) continue;

    state.carryTicks++;

    const carrier = state.playerMap.get(state.carrierId)!;
    const action = decideCarrierAction(carrier, state);
    if (action.kind === 'shoot') {
      resolveShot(state, t);
    } else if (action.kind === 'pass') {
      const hint = action.targetId !== '' ? action.targetId : undefined;
      resolvePass(state, t, effectorDeps, hint);
    }
    // 'dribble' (and any other) → keep moving; movement is handled by moveAll.
  }

  stateEmit(state, durationMs, 'full_time', state.possession, undefined, undefined, '¡Pitido final!');
  stateSnap(state, durationMs);

  return {
    seed,
    homeTeamId: state.homeTeamId,
    awayTeamId: state.awayTeamId,
    homeLineup: state.homePlayers.map(p => p.id),
    awayLineup: state.awayPlayers.map(p => p.id),
    durationMs,
    events: state.events,
    keyframes: state.keyframes,
    finalScore: state.score,
  };
}

export function generateTimeline(cfg: {
  homeTeamId: string;
  awayTeamId: string;
  homePlayers: EnginePlayer[];
  awayPlayers: EnginePlayer[];
  seed?: number;
  // Engine timeline length. The viewer passes a compressed value derived from
  // the chosen watch duration (see the 2D speed/time model); omitted callers
  // get a full 90' worth of simulated time.
  durationMs?: number;
}): MatchTimeline {
  const state = createInitialState(cfg);
  const seed  = cfg.seed ?? 0xdeadbeef;
  const durationMs = cfg.durationMs ?? DURATION_MS;

  resetKickoff(state, 'away', true, { resetCarry: (p) => resetCarry(state, p) });
  stateEmit(state, 0, 'kickoff', 'home', state.kickerId!, undefined, '¡Saque inicial!');
  stateSnap(state, 0);

  const tl = simulateFromState(state, durationMs, seed, { emitHalfTime: true });
  // A full match is always shown as 0–90' regardless of how compressed the
  // timeline is; the log/stats remap each event's `t` accordingly.
  tl.nominalMatchMs = DURATION_MS;
  return tl;
}
