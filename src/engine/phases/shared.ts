// Shared phase vocabulary: types, tick budgets, force/callback contracts, and
// the clamp helper. Every set-piece slice under phases/ imports from here; the
// barrel (../phases.ts) re-exports the public surface.

import type { Vec2, PlayerId, TeamSide, EventKind } from '../../types/match';
import type { EnginePlayer } from '../zoneEngine';
import type { FoulVariant, MatchState } from '../types';

export type MatchPhase =
  | 'live'
  | 'freeze'
  | 'transition'
  | 'celebration'
  | 'gk_holding'
  | 'gk_release'
  | 'kickoff_setup'
  | 'throw_in_setup'
  | 'throw_in_holding'
  | 'throw_in_release'
  | 'goal_kick_setup'
  | 'goal_kick_holding'
  | 'goal_kick_release'
  | 'corner_setup'
  | 'corner_holding'
  | 'corner_release'
  | 'foul_setup'
  | 'foul_holding'
  | 'foul_release'
  | 'expulsion_hold'
  | 'expulsion_walk'
  | 'expulsion_walkout';

export type GkPressStrategy = 'full' | 'partial' | 'drop';

export interface PendingImpulse {
  vel: Vec2;
  height: number;
  heightVel: number;
  receiverId: PlayerId;
  kickerId: PlayerId;
  kickerSide: TeamSide;
  lockUntil: number;
  detail?: string;
}

// Phase durations in 250ms ticks unless noted.
export const FREEZE_TICKS          = 6;
export const TRANSITION_TICKS      = 6;
export const CELEBRATION_TICKS     = 12;
// Match start: players already teleported into formation — brief intro.
export const KICKOFF_INITIAL_TICKS = 12;
// After-goal: ball teleports to the centre spot but players walk back to
// their kickoff formation naturally. The longer window covers the walk; the
// kickoff_setup exit logic extends it further if the kicker isn't yet at
// the centre spot when the timer expires.
export const KICKOFF_SETUP_TICKS   = 40;
export const GK_HOLD_TICKS         = 10;
export const KICK_FREEZE_MS        = 250;
// Goal kick choreography (4 acts). All in 250ms ticks.
//   setup   — walk-back run-up + others reposition (~6s — long enough
//             for the kicker to walk in from open play AND for both
//             teams to settle into their further-out targets without
//             feeling rushed)
//   holding — idle hold facing the field (~1.5s)
//   release — GK runs forward at the ball; impulse + emit fire on the
//             last tick so the kick anim plays at the moment of contact (~1s)
export const GOAL_KICK_SETUP_TICKS   = 24;
export const GOAL_KICK_HOLD_TICKS    = 6;
export const GOAL_KICK_RELEASE_TICKS = 4;
// Corner choreography. Same 4-act shape as the goal kick: the taker walks
// from open play to the corner flag, holds briefly facing the box, then
// strikes. The setup window is generous so the box can populate (attackers
// crash in, defenders pick them up) before the cross fires.
export const CORNER_SETUP_TICKS   = 28;
export const CORNER_HOLD_TICKS    = 6;
export const CORNER_RELEASE_TICKS = 4;
// Free-kick (foul) choreography. Same 4-act shape as the corner: kicker walks
// from wherever they were to a wind-up spot just behind the ball, the wall
// (if any) lines up at 9.15m, holds briefly, then strikes. Setup is generous
// so the kicker can arrive even from far away and the wall has time to set.
// Setup is longer than goal kick / corner because the defending team also
// has to walk a wall into place — they can start from anywhere on the pitch
// and need ~6-8s to settle into the perpendicular line 9.15m from the ball.
export const FOUL_SETUP_TICKS   = 36;
// Walk-off after a red card. Three legs:
//   expulsion_hold     — 5s pause so the user can read the foul + card before
//                        the player starts walking. Everyone (including the
//                        walker) is frozen.
//   expulsion_walk     — diagonal toward the top centre of the field
//                        (target ≈ (0.5, 0)). Up to ~6s depending on starting
//                        position; spring force handles arrival.
//   expulsion_walkout  — straight north past the camera (target ≈ (0.5, -0.30)).
// During hold/walk/walkout the rest of the players stay frozen, the ball stays
// wherever the foul left it (startFoul will reposition it when the walkout
// ends), and the overlay (foul/card) sits over the camera. Total ~14s.
export const EXPULSION_HOLD_TICKS    = 20;
export const EXPULSION_WALK_TICKS    = 24;
export const EXPULSION_WALKOUT_TICKS = 12;
// 5-second hold AFTER the wall is fully placed — the user explicitly wants
// the wall-formation tableau to linger so the set piece reads clearly before
// the kick. Transition to holding only fires once the wall has settled
// (see isWallSet gate in zoneEngine's canPickup), so this 20-tick window is
// pure "wall is set, kicker about to strike" time.
export const FOUL_HOLD_TICKS    = 20;
export const FOUL_RELEASE_TICKS = 4;

// Penalty run-up: how far behind the spot the kicker stands when they "pick
// up" the ball (arm raised, facing the goal) before the short run-up kick.
// For regular free kicks the offset is only 0.012 (step-back); penalties
// need a clearly visible gap so the kicker is obviously behind the ball.
export const PENALTY_RUNUP_DIST = 0.055; // ≈ 5.8 m

// 9.15m wall distance, in normalized field units. Field long axis = 105m.
export const WALL_DIST_NORM = 9.15 / 105;

export function clamp(v: number, lo: number, hi: number) { return v < lo ? lo : v > hi ? hi : v; }

// ── applyPhaseForces contract ────────────────────────────────────────────
// Each slice exports an `apply<X>Forces(p, isGK, pSide, role, base, ppos,
// pvel, force, ctx): boolean` that mutates `force` (and sometimes `pvel`) in
// place and returns true when it consumed the decision. The barrel dispatches
// to them by phase. `false` is only returned for live/freeze/transition.

export type CarrierRole = 'gk' | 'def' | 'mid' | 'fwd';

export interface PhaseForceCtx {
  phase: MatchPhase;
  gkPressStrategy: GkPressStrategy;
  possession: TeamSide;
  ballOwner: PlayerId | null;
  kickerId: PlayerId | null;
  partnerId: PlayerId | null;
  intendedReceiver: PlayerId | null;
  ball: Vec2;
  throwInSpot: Vec2 | null;
  goalKickSpot: Vec2 | null;
  cornerSpot: Vec2 | null;
  foulSpot: Vec2 | null;
  foulVariant: FoulVariant | null;
  wallIds: PlayerId[] | null;
  wallTargets: Record<PlayerId, Vec2> | null;
  celebSide: TeamSide;
  celebGoalPos: Vec2;
  sideOf: (id: PlayerId) => TeamSide;
  homePlayers: EnginePlayer[];
  awayPlayers: EnginePlayer[];
  allPlayers: EnginePlayer[];
  expelledIds: Set<PlayerId>;
  pos: Record<PlayerId, Vec2>;
}

// ── tickPhase contract ───────────────────────────────────────────────────
// Each slice exports tick<Phase>(state, t, callbacks) handlers that the
// barrel's tickPhase dispatcher routes to, preserving the original if/else
// chain (including its guards and fall-through to live).

export interface PhaseCallbacks {
  resetKickoff: (lastScorer: TeamSide, teleport: boolean) => void;
  resolvePass: (t: number) => void;
  resolveShot: (t: number, delayed?: boolean) => void;
  emit: (t: number, kind: EventKind, side: TeamSide, actor: PlayerId | undefined, target: PlayerId | undefined, log: string) => void;
  snap: (t: number) => void;
  setCarrier: (id: string, side: TeamSide) => void;
}

export type { MatchState };
