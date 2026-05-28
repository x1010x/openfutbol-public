export type Vec2 = { x: number; y: number };
export type PlayerId = string;
export type TeamSide = 'home' | 'away';
export type Lane = 'T' | 'C' | 'B';
export type Zone = 0 | 1 | 2 | 3 | 4 | 5;
export interface Cell { zone: Zone; lane: Lane; }

export type EventKind =
  | 'kickoff'
  | 'pass_short'
  | 'pass_forward'
  | 'pass_lateral'
  | 'pass_back'
  | 'interception'
  | 'tackle_won'
  | 'shot_on'
  | 'shot_off'
  | 'save'
  | 'goal'
  | 'foul'
  | 'penalty'
  | 'card'
  | 'injury'
  | 'sub'
  | 'corner'
  | 'throw_in'
  | 'goal_kick'
  | 'gk_distribute'
  | 'reception'
  | 'tactic'
  | 'half_time'
  | 'full_time';

export interface TimelineEvent {
  t: number;
  kind: EventKind;
  cell: Cell;
  at: Vec2;
  actor?: PlayerId;
  target?: PlayerId;
  side: TeamSide;
  log?: string;
  detail?: string;   // 'yellow' | 'red' | 'long_range' | 'wall' | ...
}

export interface Keyframe {
  t: number;
  positions: Record<PlayerId, Vec2>;
  ball: Vec2;
  ballOwner: PlayerId | null;
  ballHeight?: number;
  ballState?: 'free' | 'carried' | 'flying' | 'gk_holding' | 'throw_in_holding';
  // Defensive wall member IDs during foul_* phases. Renderer uses this to
  // force a "barrier" stance facing the ball.
  wallIds?: PlayerId[];
}

export interface MatchTimeline {
  seed: number;
  homeTeamId: string;
  awayTeamId: string;
  homeLineup: PlayerId[];
  awayLineup: PlayerId[];
  durationMs: number;
  // Nominal match length (ms) the timeline REPRESENTS for display purposes,
  // i.e. 90' = 5 400 000. The viewer compresses a real match into a much
  // shorter `durationMs` (see 2D speed/time model); the log + stats remap each
  // event's `t` to a 0–90' minute via `nominalMatchMs / durationMs`. Left unset
  // by sandbox clips, which then show raw time instead of a fake 0–90' minute.
  nominalMatchMs?: number;
  // Engine `t` (ms) at which the ball goes into play for each half (entrance
  // kickoffs). entranceLiveMs[0] = first half, [1] = second half. The viewer
  // holds the clock at 0'/45' until these instants (B2). Unset by sandbox clips.
  entranceLiveMs?: number[];
  events: TimelineEvent[];
  keyframes: Keyframe[];
  finalScore: { home: number; away: number };
}
