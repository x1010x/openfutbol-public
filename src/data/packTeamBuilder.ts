import type { Pack, Club, Player, Position, Team } from '../types/game.d.ts';
import { runtimePlayerFromPack } from './playerBuilder';
import { pickBestFormation } from '../engine/formations';

const MAX_SQUAD = 22;
const MIN_GK = 3;
const MIN_DEF = 6;
const MIN_MID = 6;
const MIN_FWD = 6;

const FORWARD_SLOTS: Position[] = ['DEL', 'AML', 'AMR'];

const ratingOf = (p: Player): number => p.current_ability ?? (p.media ?? 50) * 2;

// Cap a roster at MAX_SQUAD players while guaranteeing a minimum at each role
// (best-rated first). Any remaining slots are filled by the next best players
// regardless of position.
export const trimRoster = (players: Player[]): Player[] => {
  if (players.length <= MAX_SQUAD) return players;

  const sorted = [...players].sort((a, b) => ratingOf(b) - ratingOf(a));
  const picked = new Set<string>();
  const result: Player[] = [];

  const pickN = (filter: (p: Player) => boolean, n: number) => {
    let taken = 0;
    for (const p of sorted) {
      if (taken >= n || result.length >= MAX_SQUAD) break;
      if (picked.has(p.id)) continue;
      if (!filter(p)) continue;
      picked.add(p.id);
      result.push(p);
      taken++;
    }
  };

  pickN(p => p.allowedPositions.includes('POR'), MIN_GK);
  pickN(p => p.allowedPositions.includes('DEF'), MIN_DEF);
  pickN(p => p.allowedPositions.includes('MED'), MIN_MID);
  pickN(p => p.allowedPositions.some(pos => FORWARD_SLOTS.includes(pos)), MIN_FWD);

  for (const p of sorted) {
    if (result.length >= MAX_SQUAD) break;
    if (picked.has(p.id)) continue;
    picked.add(p.id);
    result.push(p);
  }

  return result;
};

export interface PackTeamTemplate {
  clubId: string;
  name: string;
  leagueName: string;
  countryName: string;
  countryCode: string;
  colors: { background: string; foreground: string } | null;
  playerCount: number;
}

export const getPackTemplates = (pack: Pack): PackTeamTemplate[] => {
  const leagueMap = new Map(pack.leagues.map(l => [l.id, l]));
  const countryMap = new Map(pack.countries.map(c => [c.id, c]));
  const playerCountByClub = new Map<string, number>();
  for (const p of pack.players) {
    if (p.club_id) playerCountByClub.set(p.club_id, (playerCountByClub.get(p.club_id) ?? 0) + 1);
  }
  return pack.clubs.map(club => {
    const league = leagueMap.get(club.league_id);
    const country = league ? countryMap.get(league.country_id) : undefined;
    return {
      clubId: club.id,
      name: club.name,
      leagueName: league?.name ?? '',
      countryName: country?.name ?? '',
      countryCode: country?.code?.toUpperCase() ?? 'unknown',
      colors: club.colors,
      playerCount: playerCountByClub.get(club.id) ?? 0,
    };
  });
};

export const buildTeamFromPackClub = (club: Club, pack: Pack, year: number): Team => {
  const clubPlayers = pack.players.filter(p => p.club_id === club.id);
  const countryById = new Map(pack.countries.map(c => [c.id, c.code?.toUpperCase()]));
  const allPlayers: Player[] = clubPlayers.map((p, i) =>
    runtimePlayerFromPack(p, i + 1, p.country_id ? countryById.get(p.country_id) : undefined)
  );

  const players = trimRoster(allPlayers);
  const eligible = players.filter(p => p.allowedPositions.length > 0);
  const { formation, lineup } = pickBestFormation(eligible);

  const colorBg = club.colors?.background ?? '#003366';
  const colorFg = club.colors?.foreground ?? '#ffffff';

  return {
    id: club.id,
    name: club.name,
    colors: [colorBg, colorFg],
    year,
    manager: makeManagerName(club.id),
    stadiumCapacity: 30000,
    ticketPrice: 20,
    budget: 10_000_000,
    players,
    lineup,
    formation,
    tacticalDiscipline: false,
  };
};

// Deterministic stub coach name per club so each AI team has a consistent
// manager across saves. Spanish-ish first + last names.
const MGR_FIRST = [
  'Pepe', 'Luis', 'Manolo', 'Quique', 'Diego', 'Marcelino', 'Unai', 'Julen',
  'Andoni', 'Míchel', 'Ernesto', 'Cholo', 'Vicente', 'Rafa', 'Antonio',
  'Iñaki', 'José', 'Pacho', 'Toni', 'Xabi',
];
const MGR_LAST = [
  'Mendilibar', 'Rodríguez', 'Aguirre', 'Sánchez Flores', 'Bordalás',
  'García Plaza', 'Setién', 'Lopetegui', 'Iraola', 'Pellegrini', 'Valverde',
  'Simeone', 'del Bosque', 'Benítez', 'Conte', 'Cazorla', 'Mourinho',
  'Herrera', 'Caparrós', 'Alonso',
];

const makeManagerName = (seed: string): string => {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return `${MGR_FIRST[h % MGR_FIRST.length]} ${MGR_LAST[(h >>> 5) % MGR_LAST.length]}`;
};
