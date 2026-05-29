// Live-substitution choreography (Bloque 8). Changes ordered from the manager
// during the 2D watch are queued (queueSubstitution) and held until the next
// natural stoppage, then ALL the changes pending at that stoppage play together
// as one sequence: every outgoing player walks off through the top-centre
// tunnel (the same motion as a red-card expulsion) while everyone else freezes;
// when they clear the frame applySubstitution swaps in every bench player at
// once (each jogs on from the centre toward their slot once play resumes) and
// the interrupted set-piece continues. Batching is what makes a double change
// read as one walk-off/walk-on instead of two back-to-back sequences.
//
// The clock holds across the walk-off (Bloque 9): startSubWalkout records the
// engine time it began and tickSubWalkout closes the [start,end] span into
// state.clockFrozenSpans, which toClockMs subtracts so only substitutions stop
// the match clock (routine throw-ins / fouls keep it running).
//
// Deterministic: queueing and the trigger ("first stoppage at/after the order")
// consume no RNG and are reproduced exactly on the Bloque 8 replay.

import type { Vec2, TeamSide } from '../../types/match';
import type { EnginePlayer } from '../zoneEngine';
import { spring } from '../forces';
import { applySubstitution } from '../substitution';
import type { CarrierRole, PhaseForceCtx, PhaseCallbacks, MatchState } from './shared';

export const SUB_WALKOUT_TICKS = 28;

// Stoppage phases at which a pending sub may be executed: stable windows where
// players are settled (set-piece holding) or play is already halted (goal
// celebration / keeper holding). We avoid the transient *_setup / *_release
// frames so we don't interrupt a kick mid-delivery.
const TRIGGER_PHASES = new Set<MatchState['phase']>([
  'foul_holding', 'throw_in_holding', 'goal_kick_holding', 'corner_holding',
  'celebration', 'gk_holding',
]);

export function queueSubstitution(
  state: MatchState,
  outId: string,
  incoming: EnginePlayer,
  log?: string,
): void {
  state.pendingSubs.push({ outId, incoming, log });
}

// Called each tick from the main loop. If a sub is pending and we're at a clean
// stoppage (and not already mid walk-off / expulsion), start the next one.
export function tryStartPendingSub(state: MatchState, t: number, snap: (t: number) => void): void {
  if (state.pendingSubs.length === 0) return;
  if (state.phase === 'sub_walkout') return;
  if (state.phase === 'expulsion_hold' || state.phase === 'expulsion_walk' || state.phase === 'expulsion_walkout') return;
  if (!TRIGGER_PHASES.has(state.phase)) return;
  startSubWalkout(state, t, snap);
}

function startSubWalkout(state: MatchState, t: number, snap: (t: number) => void): void {
  // Take EVERY pending change whose outgoing player is still on the pitch (skip
  // any already subbed off / sent off before the stoppage came) into one batch,
  // and drain pendingSubs (stale entries are discarded).
  const batch = state.pendingSubs.filter(j => state.playerMap.has(j.outId));
  state.pendingSubs = [];
  if (batch.length === 0) return;

  // Stash the set-piece we're interrupting so it resumes after the walk-off.
  state.subResumePhase = state.phase;
  state.subResumePhaseTicks = state.phaseTicks;

  state.subBatch = batch;
  state.subWalkoutStartMs = t;

  state.phase = 'sub_walkout';
  state.phaseTicks = SUB_WALKOUT_TICKS;
  snap(t);
}

// Force on a walking-off player: head for the top-centre tunnel and off the top
// edge past the camera (the expulsion exit, not the nearest touchline). The x
// target eases toward centre while keeping each walker's lateral offset so a
// batch of two/three doesn't perfectly overlap on the way out. moveAll freezes
// everyone except the batch walkers and routes each one here.
export function applySubWalkoutForces(
  _p: EnginePlayer,
  _isGK: boolean,
  _pSide: TeamSide,
  _role: CarrierRole,
  _base: Vec2,
  ppos: Vec2,
  _pvel: Vec2,
  force: Vec2,
  _ctx: PhaseForceCtx,
): boolean {
  const targetX = 0.5 + (ppos.x - 0.5) * 0.30;
  const sf = spring(ppos, { x: targetX, y: -0.30 }, 0.60);
  force.x += sf.x;
  force.y += sf.y;
  return true;
}

export function tickSubWalkout(state: MatchState, t: number, callbacks: PhaseCallbacks): void {
  // Walkers are off-camera: swap in every bench player of the batch at once
  // (each spawns off-pitch at the centre tunnel and jogs to their slot once
  // play is live again), close the single clock-frozen span for the whole
  // batch, and restore the interrupted set-piece so the restart continues.
  for (const job of state.subBatch) {
    if (state.playerMap.has(job.outId)) {
      applySubstitution(state, t, job.outId, job.incoming, job.log);
    }
  }
  if (state.subBatch.length > 0) {
    state.clockFrozenSpans.push([state.subWalkoutStartMs, t]);
  }
  const resume = state.subResumePhase ?? 'live';
  const resumeTicks = state.subResumePhaseTicks;

  state.subBatch = [];
  state.subResumePhase = null;
  state.subResumePhaseTicks = 0;

  state.phase = resume;
  state.phaseTicks = resumeTicks;
  callbacks.snap(t);
}
