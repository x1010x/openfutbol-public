export type Position = 'POR' | 'DEF' | 'MED' | 'DEL' | 'AML' | 'AMR';

export interface PlayerStats {
  speed: number;
  dribbling: number;
  passing: number;
  shooting: number;
  defending: number;
  physical: number;
  goalkeeping: number;
}

export interface RawPlayerDB {
  id: string;
  full_name?: string;
  shirt_name?: string;
  birth_year: number;
  peak_age: number;
  preferred_pos: Position;
  positions: Partial<Record<Position, PlayerStats>>;
}

export interface RosterEntry {
  player_id: string;
  number: number;
}

export interface RawPlayer {
  id: number | string;
  name: string;
  number?: number;
  pos: Position;
  base: number;
}

export interface TeamSeasonData {
  year: number;
  colors?: string[];
  manager?: string;
  stadiumName?: string;
  stadiumCapacity: number;
  ticketPrice: number;
  budget: number;
  players: RosterEntry[] | RawPlayer[];
}

export interface RawTeamDB {
  id: string;
  name: string;
  country: string;
  seasons: TeamSeasonData[];
}

// Internal flattened form used by the loader
export interface RawTeamSeason extends TeamSeasonData {
  id: string;
  name: string;
}

export interface Player {
  id: string;
  name: string;
  fullName: string;
  position: Position;
  preferredPos: Position;
  allowedPositions: Position[];
  number: number;
  stats: PlayerStats;
  media: number;
  birthYear: number;
  peakAge: number;
  clubHistory?: { club: string; league_key: string; from_year: number }[];
  forSale?: boolean;
  seasonStats: {
    goals: number;
    assists: number;
    yellowCards: number;
    redCards: number;
    appearances: number;
    minutes: number;
    ratingSum: number;
    cleanSheets: number;
    goalsAgainst: number;
  };
  suspensionMatches: number;
  stamina: number;              // 1-99, resets to 99 each season
  injuryWeeksRemaining: number; // 0 = healthy
}

export interface PackMeta {
  type: 'player_pack' | 'team_pack' | 'combined_pack';
  name: string;
  version: string;
  author?: string;
  source_url?: string;
}

export interface PlayerPack {
  meta: PackMeta;
  players: RawPlayerDB[];
}

export interface TeamPack {
  meta: PackMeta;
  teams: RawTeamDB[];
  players?: RawPlayerDB[];
}

export type FormationId = '4-4-2' | '5-3-2' | '4-3-3' | '4-2-4' | '5-4-1' | '3-4-3';

export interface Team {
  id: string;
  name: string;
  colors?: string[];
  year: number;
  manager?: string;
  stadiumName?: string;
  stadiumCapacity: number;
  ticketPrice: number;
  players: Player[];
  lineup: string[];
  formation: FormationId;
  budget: number;
  tacticalDiscipline: boolean;
}

export interface MatchEvent {
  minute: number;
  description?: string;
  type: 'goal' | 'shot' | 'card' | 'commentary' | 'yellow' | 'red' | 'injury' | 'sub';
  teamId?: string;
  playerId?: string;
  assistantId?: string;
  playerOffId?: string; // sub events: player who came off
}

export interface MatchState {
  homeTeam: Team;
  awayTeam: Team;
  homeScore: number;
  awayScore: number;
  minute: number;
  isFinished: boolean;
  events: MatchEvent[];
  matchSpeed: number;
  homeSentOff: string[];
  awaySentOff: string[];
  homeYellows: string[];
  awayYellows: string[];
  homePossession: number;
  awayPossession: number;
  homeShots: number;
  awayShots: number;
  homeShotsOnTarget: number;
  awayShotsOnTarget: number;
  homeFouls: number;
  awayFouls: number;
  homeBoost: number;
  homeStamina: Record<string, number>;
  awayStamina: Record<string, number>;
  homeSubsUsed: number;
  awaySubsUsed: number;
  homeInjuredInMatch: string[];
  awayInjuredInMatch: string[];
  homeStartingLineup: string[];
  awayStartingLineup: string[];
  stoppageTime1: number;
  stoppageTime2: number;
}
