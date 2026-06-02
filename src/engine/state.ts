import type { MatchState, Wander, SlotRole } from './types';
import type { TimelineEvent, PlayerId, TeamSide, Vec2 } from '../types/match';
import type { EnginePlayer } from './zoneEngine';
import { baseSlot } from './lineup';
import { mulberry32 } from './duels';

export function createInitialState(cfg: {
  homeTeamId: string;
  awayTeamId: string;
  homePlayers: EnginePlayer[];
  awayPlayers: EnginePlayer[];
  seed?: number;
  // Bench EnginePlayers the engine may bring on per side (AI substitutions,
  // engine/aiSubs.ts). Only the engine-controlled side(s) carry one — the user
  // subs via the UI. Sandbox omits it → no AI subs.
  benches?: Partial<Record<TeamSide, EnginePlayer[]>>;
}): MatchState {
  const seed = cfg.seed ?? 0xdeadbeef;
  const rng = mulberry32(seed);

  // Clone the incoming players so the simulation never mutates the caller's
  // arrays. The per-tick loops mutate player fields in place (foulsCommitted,
  // yellowCount, redCard, injured) and live changes reassign slot/role/tag and
  // swap array entries (applySubstitution/applyFormationChange). If we kept the
  // caller's references, re-running generateTimeline with the same inputs (the
  // Bloque 8 deterministic replay: initial watch, then each "continue") would
  // start from dirty players and the replayed head would diverge from what was
  // already shown. Cloning keeps every run reproducible from pristine inputs.
  const clone = (p: EnginePlayer): EnginePlayer => ({
    ...p,
    slot: { ...p.slot },
    slotOffset: p.slotOffset ? { ...p.slotOffset } : undefined,
  });
  const homePlayers = cfg.homePlayers.map(clone);
  const awayPlayers = cfg.awayPlayers.map(clone);
  // Bench players are cloned too: applySubstitution mutates them when they come
  // on, so the caller's arrays must stay pristine across the Bloque 8 replays.
  const cloneBench = (arr?: EnginePlayer[]) => (arr ?? []).map(clone);

  const allPlayers = [...homePlayers, ...awayPlayers];
  const homeSet = new Set(homePlayers.map(p => p.id));
  const playerMap = new Map<PlayerId, EnginePlayer>();
  for (const p of allPlayers) playerMap.set(p.id, p);

  const pos: Record<PlayerId, Vec2> = {};
  const vel: Record<PlayerId, Vec2> = {};
  for (const p of allPlayers) {
    pos[p.id] = baseSlot(p);
    vel[p.id] = { x: 0, y: 0 };
  }

  const wander = new Map<PlayerId, Wander>();
  for (const p of allPlayers) {
    wander.set(p.id, {
      dx: (rng() - 0.5) * 0.06,
      dy: (rng() - 0.5) * 0.06,
      timer: 1 + Math.floor(rng() * 18),
    });
  }

  const carrierId = homePlayers[9]?.id ?? homePlayers[0].id;

  return {
    rng,
    events: [],
    keyframes: [],

    homeTeamId: cfg.homeTeamId,
    awayTeamId: cfg.awayTeamId,
    homePlayers,
    awayPlayers,
    allPlayers,
    homeSet,
    playerMap,

    score: { home: 0, away: 0 },

    pos,
    vel,
    wander,

    possession: 'home',
    carrierId,
    ball: { ...pos[carrierId] },
    ballCell: { zone: 2, lane: 'C' },
    ballHeight: 0,
    ballVel: { x: 0, y: 0 },
    ballHeightVel: 0,
    ballOwner: carrierId,
    ballLastKicker: null,
    ballLastKickerSide: null,
    ballKickerLockUntil: 0,
    lastPassFrom: null,
    intendedReceiver: null,

    carryTicks: 0,
    nextAction: 8,

    phase: 'live',
    phaseTicks: 0,
    gkPressStrategy: 'partial',
    downUntil: new Map(),
    kickFrozenUntil: new Map(),
    celebSide: 'home',
    celebGoalPos: { x: 0, y: 0.5 },
    pendingGoalScorer: null,

    kickerId: null,
    partnerId: null,
    kickoffEntrance: false,
    entranceLiveMs: [],
    needsKickoffPass: false,
    needsKickoffBackPass: false,
    throwInSpot: null,
    goalKickSpot: null,
    cornerSpot: null,
    foulSpot: null,
    foulVariant: null,
    wallIds: null,
    wallTargets: null,
    wallExpireAt: 0,
    pendingImpulse: null,

    gkDive: {},

    expelledIds: new Set(),
    injuredIds: new Set(),
    aggressionWindowUntil: new Map(),
    pendingFoul: null,

    pendingSubs: [],
    subBatch: [],
    subResumePhase: null,
    subResumePhaseTicks: 0,
    subWalkoutStartMs: 0,
    clockFrozenSpans: [],

    aiSub: {
      home: { bench: cloneBench(cfg.benches?.home), subsUsed: 0, lastSubTick: -Infinity },
      away: { bench: cloneBench(cfg.benches?.away), subsUsed: 0, lastSubTick: -Infinity },
    },
  };
}

export function sideOf(state: MatchState, id: PlayerId): TeamSide {
  return state.homeSet.has(id) ? 'home' : 'away';
}

export function roleOf(_state: MatchState, p: EnginePlayer): SlotRole {
  return p.role;
}

export function emit(
  state: MatchState,
  t: number,
  kind: TimelineEvent['kind'],
  s: TeamSide,
  actor?: PlayerId,
  target?: PlayerId,
  log?: string,
  detail?: string,
): void {
  const ev: TimelineEvent = {
    t,
    kind,
    cell: { ...state.ballCell },
    at: { ...state.ball },
    side: s,
    actor,
    target,
    log,
  };
  if (detail) ev.detail = detail;
  state.events.push(ev);
}

export function snap(state: MatchState, t: number): void {
  const positions: Record<PlayerId, Vec2> = {};
  for (const [id, p] of Object.entries(state.pos)) {
    positions[id] = { ...p };
  }

  let ballState: import('../types/match').Keyframe['ballState'];
  if (state.ballOwner) {
    const owner = state.playerMap.get(state.ballOwner)!;
    const ownerRole = roleOf(state, owner);
    const p = state.phase;
    if (p === 'throw_in_setup' || p === 'throw_in_holding' || p === 'throw_in_release') {
      ballState = 'throw_in_holding';
    } else if (ownerRole === 'gk' && (p === 'gk_holding' || p === 'gk_release')) {
      ballState = 'gk_holding';
    } else if (p === 'goal_kick_setup' || p === 'goal_kick_holding' || p === 'goal_kick_release') {
      // Ball sits on the ground at the 6-yard box corner — keep it visible
      // (unlike throw_in / gk_holding which hide it in the player's hands).
      ballState = 'carried';
    } else if (p === 'corner_setup' || p === 'corner_holding' || p === 'corner_release') {
      ballState = 'carried';
    } else if (p === 'foul_setup' || p === 'foul_holding' || p === 'foul_release') {
      // Ball sits on the ground at the foul spot — keep it visible like corner/goal kick.
      ballState = 'carried';
    } else {
      ballState = 'carried';
    }
  } else {
    ballState = 'flying';
  }

  state.keyframes.push({
    t,
    positions,
    ball: { ...state.ball },
    ballOwner: state.ballOwner,
    ballHeight: state.ballHeight,
    ballState,
    // wallIds travel for the entire lifetime of the formation — through the
    // shot's flight too, so the barrier pose holds while the ball is on its
    // way to goal. State is cleared by the time-based expiry in zoneEngine.
    wallIds: state.wallIds ? [...state.wallIds] : undefined,
  });
}

export function isGamePaused(state: MatchState): boolean {
  return state.phase === 'freeze'
      || state.phase === 'celebration'
      || state.phase === 'gk_holding'
      || state.phase === 'gk_release'
      || state.phase === 'kickoff_setup'
      || state.phase === 'throw_in_setup'
      || state.phase === 'throw_in_holding'
      || state.phase === 'throw_in_release'
      || state.phase === 'goal_kick_setup'
      || state.phase === 'goal_kick_holding'
      || state.phase === 'goal_kick_release'
      || state.phase === 'corner_setup'
      || state.phase === 'corner_holding'
      || state.phase === 'corner_release'
      || state.phase === 'foul_setup'
      || state.phase === 'foul_holding'
      || state.phase === 'foul_release'
      || state.phase === 'halftime_walkout'
      || state.phase === 'fulltime_walkout'
      || state.phase === 'sub_walkout';
}

// Carry budget — how many ticks a carrier holds the ball before the decision
// layer is allowed to fire shoot/pass. Tighter under pressure or near goal,
// looser for skilled dribblers. Lives next to MatchState because the rest of
// the engine treats `carryTicks`/`nextAction` as carrier-state fields.
const CARRY_MIN: Record<SlotRole, number> = { gk: 3, def: 5, mid: 8, fwd: 10 };
const CARRY_MAX: Record<SlotRole, number> = { gk: 6, def: 10, mid: 14, fwd: 18 };

export function resetCarry(state: MatchState, p?: EnginePlayer): void {
  if (!p) {
    state.carryTicks = 0;
    state.nextAction = 6;
    return;
  }
  const role = roleOf(state, p);
  const cpos = state.pos[p.id];
  const cSide = sideOf(state, p.id);
  const goalX = cSide === 'home' ? 1.0 : 0.0;
  const distToGoal = Math.hypot(cpos.x - goalX, cpos.y - 0.50);

  const opps = cSide === 'home' ? state.awayPlayers : state.homePlayers;
  const isPressed = opps.some(o => !state.expelledIds.has(o.id)
    && Math.hypot(state.pos[o.id].x - cpos.x, state.pos[o.id].y - cpos.y) < 0.15);

  let min = CARRY_MIN[role];
  let max = CARRY_MAX[role];

  // Skill modifier: better dribblers hold the ball longer.
  const skillMod = 0.8 + 0.4 * (p.dribbling / 99);
  min = Math.floor(min * skillMod);
  max = Math.floor(max * skillMod);

  if (isPressed) {
    min = Math.max(1, Math.floor(min * 0.5));
    max = Math.max(2, Math.floor(max * 0.6));
  }
  if (distToGoal < 0.25) {
    min = Math.max(1, Math.floor(min * 0.7));
    max = Math.max(3, Math.floor(max * 0.8));
  }

  state.carryTicks = 0;
  state.nextAction = min + Math.floor(state.rng() * (max - min + 1));
}

export function setCarrier(state: MatchState, id: PlayerId, newPossession: TeamSide): void {
  state.carrierId  = id;
  state.possession = newPossession;
  resetCarry(state, state.playerMap.get(id));
}
