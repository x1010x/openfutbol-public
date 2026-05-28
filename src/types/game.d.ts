// ── Canonical types (new) ────────────────────────────────────────────────
export type PositionCode =
  | 'GK' | 'DC' | 'DL' | 'DR' | 'WBL' | 'WBR'
  | 'DMC' | 'MC' | 'ML' | 'MR'
  | 'AMC' | 'AML' | 'AMR' | 'FC';

export interface PlayerPositionEntry { code: PositionCode; level: number; } // 1-20

// ── Legacy compat (kept so UI compiles; derived at construction) ─────────
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

// Legacy pack types — components reference these inline; Phase 4 removes them.
export interface PackMeta {
  type: 'player_pack' | 'team_pack' | 'combined_pack';
  name: string;
  version: string;
  author?: string;
  source_url?: string;
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
  players: RosterEntry[] | RawPlayer[]; // RosterEntry in new DB format; RawPlayer in legacy packs
}

export interface RawTeamDB {
  id: string;
  name: string;
  country: string;
  seasons: TeamSeasonData[];
}

export interface RawTeamSeason extends TeamSeasonData {
  id: string;
  name: string;
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

// ── New pack shapes (mirrors scripts/import-pack/types.ts) ───────────────
export interface DataPackMeta {
  name: string;
  version: string;
  source_url: string;
  source_commit: string | null;
  imported_at: string;
  schema_version: 1;
}

export interface Continent { id: string; source_id: number; name: string; }

export interface Country {
  id: string; source_id: number;
  code: string; slug: string; name: string;
  continent_id: string; reputation: number;
}

export interface League {
  id: string; source_id: number; country_id: string;
  slug: string; name: string;
  reputation: number; tier: number;
  promotion_spots: number; relegation_spots: number;
}

export interface Club {
  id: string; source_id: number; league_id: string;
  name: string;
  colors: { background: string; foreground: string } | null;
  rivals_source_ids: number[];
}

export interface PackPlayer {
  id: string; source_id: number;
  club_id: string | null; country_id: string;
  first_name: string; last_name: string;
  birth_date: string;
  positions: PlayerPositionEntry[];
  current_ability: number; potential_ability: number;
  value: number;
  contract: { salary: number; expiration: string } | null;
}

export interface Pack {
  meta: DataPackMeta;
  continents: Continent[]; countries: Country[];
  leagues: League[]; clubs: Club[]; players: PackPlayer[];
}

// ── Runtime Player (canonical + legacy shim) ─────────────────────────────
// Canonical fields are optional only because legacy code paths (EditorView's
// inline createPlayer, etc.) still build players in the old shape. Pack-built
// players via playerBuilder always populate them. Phase 4 makes them required.
export interface Player {
  // Canonical (new)
  id: string;
  source_id?: number;
  club_id?: string | null;
  country_id?: string;
  first_name?: string;
  last_name?: string;
  birth_date?: string;            // ISO YYYY-MM-DD
  positions?: PlayerPositionEntry[];
  current_ability?: number;       // 1-200
  potential_ability?: number;     // 1-200
  value?: number;
  contract?: { salary: number; expiration: string } | null;

  // Runtime/game state
  number: number;
  stamina: number;               // 1-99
  injuryWeeksRemaining: number;
  suspensionMatches: number;
  forSale?: boolean;
  clubHistory?: { club: string; league_key: string; from_year: number }[];
  seasonStats: {
    goals: number; assists: number;
    yellowCards: number; redCards: number;
    appearances: number; minutes: number;
    ratingSum: number;
    cleanSheets: number; goalsAgainst: number;
  };

  // Legacy compat shim — derived from canonical fields; UI reads these.
  // Phase 4 will delete them once UI migrates.
  name: string;
  fullName: string;
  birthYear: number;
  peakAge: number;
  position: Position;
  preferredPos: Position;
  allowedPositions: Position[];
  stats: PlayerStats;
  media: number;
}

// ── Team / Match types ────────────────────────────────────────────────────
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
  playerOffId?: string;
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
