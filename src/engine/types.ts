import type { PlayerId, TeamSide, Vec2, Cell, TimelineEvent } from '../types/match';
import type { EnginePlayer } from './zoneEngine';
import type { GkPressStrategy, PendingImpulse } from './phases';

export type MatchPhase = 'live' | 'freeze' | 'transition' | 'celebration' | 'gk_holding' | 'gk_release' | 'kickoff_setup' | 'throw_in_setup' | 'throw_in_holding' | 'throw_in_release' | 'goal_kick_setup' | 'goal_kick_holding' | 'goal_kick_release' | 'corner_setup' | 'corner_holding' | 'corner_release' | 'foul_setup' | 'foul_holding' | 'foul_release' | 'expulsion_hold' | 'expulsion_walk' | 'expulsion_walkout' | 'halftime_walkout' | 'fulltime_walkout';

// Free-kick variant. Decides the shape of the choreography (wall or not),
// where teammates run, and whether the kicker shoots, crosses, or passes.
//   shoot — central, in shooting range → direct attempt on goal (probabilistic
//           against a pass; closer = more likely shot).
//   cross — wide, near box → lofted ball into the area.
//   pass  — too far or too wide for a goal attempt → safe build-up pass.
export type FoulVariant = 'shoot' | 'cross' | 'pass' | 'penalty';

export type Intent =
  | { kind: 'idle' }
  | { kind: 'dribble',          toward: Vec2 }
  | { kind: 'pass',             targetId: PlayerId; isCross?: boolean }
  | { kind: 'shoot' }
  | { kind: 'clear' }
  | { kind: 'press',            targetId: PlayerId }
  | { kind: 'mark',             targetId: PlayerId }
  | { kind: 'cover_lane',       laneY: number }
  | { kind: 'support_carrier' }
  | { kind: 'run_into_space',   target: Vec2 }
  | { kind: 'hold_shape' };

export interface Wander { dx: number; dy: number; timer: number; }
export interface DiveState { until: number; targetY: number; }

export type CarrierRole = 'gk' | 'def' | 'mid' | 'fwd';

// Dummy types for Phase 4 API (added early as requested in ENGINE_REFACTOR.md)
export type SlotRole = 'gk' | 'def' | 'mid' | 'fwd';
export type SlotTag = 'wing' | 'pivot' | 'cb_cover' | 'striker' | 'cm';

export interface Formation {
  slots: Vec2[];
  roles: SlotRole[];
  tags?: SlotTag[];
}

export interface Tactics {
  pressing: number;
  defensiveLine: number;
  buildUp: number;
  width: number;
  tempo: number;
  passStyle: 'short' | 'mixed' | 'direct';
}

export interface TeamCfg {
  teamId: string;
  players: EnginePlayer[];
  formation?: Formation;
  tactics?: Tactics;
}

export interface MatchState {
  rng: () => number;
  events: TimelineEvent[];
  keyframes: import('../types/match').Keyframe[];

  homeTeamId: string;
  awayTeamId: string;
  homePlayers: EnginePlayer[];
  awayPlayers: EnginePlayer[];
  allPlayers: EnginePlayer[];
  homeSet: Set<PlayerId>;
  playerMap: Map<PlayerId, EnginePlayer>;

  score: { home: number; away: number };

  pos: Record<PlayerId, Vec2>;
  vel: Record<PlayerId, Vec2>;
  wander: Map<PlayerId, Wander>;

  possession: TeamSide;
  carrierId: PlayerId;
  ball: Vec2;
  ballCell: Cell;
  ballHeight: number;
  ballVel: Vec2;
  ballHeightVel: number;
  ballOwner: PlayerId | null;
  ballLastKicker: PlayerId | null;
  ballLastKickerSide: TeamSide | null;
  ballKickerLockUntil: number;
  lastPassFrom: PlayerId | null;
  intendedReceiver: PlayerId | null;

  carryTicks: number;
  nextAction: number;

  phase: MatchPhase;
  phaseTicks: number;
  gkPressStrategy: GkPressStrategy;
  downUntil: Map<PlayerId, number>;
  kickFrozenUntil: Map<PlayerId, number>;
  celebSide: TeamSide;
  celebGoalPos: Vec2;
  pendingGoalScorer: TeamSide | null;

  kickerId: PlayerId | null;
  partnerId: PlayerId | null;
  // True while a kickoff_setup is the match-start / second-half entrance (the
  // 22 spawn off-pitch and jog into formation), false for the post-goal
  // restart (players walk back from open play). Drives the entrance speed
  // boost in move.ts; cleared when the phase hands off to 'live'.
  kickoffEntrance: boolean;
  // Engine `t` (ms) at which the ball is first put into play for each half (the
  // kickoff_setup→live transition of an entrance kickoff). Used by the viewer to
  // freeze the cosmetic clock at 0' / 45' during the player entrances (B2).
  entranceLiveMs: number[];
  needsKickoffPass: boolean;
  needsKickoffBackPass: boolean;
  throwInSpot: Vec2 | null;
  goalKickSpot: Vec2 | null;
  cornerSpot: Vec2 | null;
  foulSpot: Vec2 | null;
  foulVariant: FoulVariant | null;
  wallIds: PlayerId[] | null;
  wallTargets: Record<PlayerId, Vec2> | null;
  // When > 0, t (ms) at which the wall stops being authoritative — kept
  // populated through the shot's flight so the barrier holds its formation
  // visually and the kickFrozen window matches.
  wallExpireAt: number;
  pendingImpulse: PendingImpulse | null;

  gkDive: Record<PlayerId, DiveState>;

  // Disciplinary state. expelledIds drives the filtering of red-carded players
  // out of every per-player loop (decide, move, pass targeting, wall picking,
  // tackle opps loop). injuredIds slows wandering/sprint speed for players who
  // suffered an injury foul. pendingFoul is set when a red card is about to
  // trigger an expulsion sequence — startFoul is deferred until the walk-off
  // finishes (Fase 3); during Fase 1/2 it remains null because the foul fires
  // immediately as today.
  expelledIds: Set<PlayerId>;
  injuredIds: Set<PlayerId>;
  // Defenders that just got dribbled past enter a short provocation window
  // during which they may commit an off-ball reckless foul (Fase 5). Map
  // value is the absolute ms timestamp at which the window expires.
  aggressionWindowUntil: Map<PlayerId, number>;
  pendingFoul: {
    spot: Vec2;
    atkSide: TeamSide;
    victimId: PlayerId;
    severity: 'dogso' | 'cynical' | 'reckless' | 'normal';
    // The player walking off during expulsion_walk / expulsion_walkout. Used
    // by moveAll to gate everyone else to a freeze while still letting the
    // walker integrate forces from applyPhaseForces.
    expelledId: PlayerId;
  } | null;
}
