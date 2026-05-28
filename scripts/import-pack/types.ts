export type PositionCode =
  | 'GK' | 'DC' | 'DL' | 'DR' | 'WBL' | 'WBR'
  | 'DMC' | 'MC' | 'ML' | 'MR'
  | 'AMC' | 'AML' | 'AMR' | 'FC';

export interface PackMeta {
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
  continent_id: string;
  reputation: number;
  raw: unknown;
}

export interface League {
  id: string; source_id: number;
  country_id: string;
  slug: string; name: string;
  reputation: number;
  tier: number;
  promotion_spots: number;
  relegation_spots: number;
  raw: unknown;
}

export interface Club {
  id: string; source_id: number;
  league_id: string;
  name: string;
  colors: { background: string; foreground: string } | null;
  rivals_source_ids: number[];
  raw: unknown;
}

export interface PlayerPosition { code: PositionCode; level: number; }

export interface Player {
  id: string; source_id: number;
  club_id: string | null;
  country_id: string;
  first_name: string; last_name: string;
  birth_date: string;
  positions: PlayerPosition[];
  current_ability: number;
  potential_ability: number;
  value: number;
  contract: { salary: number; expiration: string } | null;
  history: unknown;
  raw: unknown;
}

export interface Pack {
  meta: PackMeta;
  continents: Continent[];
  countries: Country[];
  leagues: League[];
  clubs: Club[];
  players: Player[];
}
