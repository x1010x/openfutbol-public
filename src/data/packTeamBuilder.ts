import type { Pack, Club, Player, Team } from '../types/game.d.ts';
import { runtimePlayerFromPack } from './playerBuilder';
import { pickBestFormation } from '../engine/formations';

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
  const players: Player[] = clubPlayers.map((p, i) =>
    runtimePlayerFromPack(p, i + 1, p.country_id ? countryById.get(p.country_id) : undefined)
  );

  const eligible = players.filter(p => p.allowedPositions.length > 0);
  const { formation, lineup } = pickBestFormation(eligible);

  const colorBg = club.colors?.background ?? '#003366';
  const colorFg = club.colors?.foreground ?? '#ffffff';

  return {
    id: club.id,
    name: club.name,
    colors: [colorBg, colorFg],
    year,
    stadiumCapacity: 30000,
    ticketPrice: 20,
    budget: 10_000_000,
    players,
    lineup,
    formation,
    tacticalDiscipline: false,
  };
};
