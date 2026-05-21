import type { Team, Player, Position, PlayerStats, RawTeamSeason, RawTeamDB, RawPlayerDB, RosterEntry, RawPlayer } from '../types/game.d.ts';
import freeAgentIds from './db/free_agents.json';
import playerNamesMap from './db/names/player_names.json';
import teamNamesMap from './db/names/team_names.json';
import managerNamesMap from './db/names/manager_names.json';
import stadiumNamesMap from './db/names/stadium_names.json';
import { pickBestFormation, computePositionWeightedMedia } from '../engine/formations';

const playerModules = import.meta.glob<RawPlayerDB[]>('./db/players/*.json', { eager: true, import: 'default' });
const playerMap = new Map<string, RawPlayerDB>();
for (const mod of Object.values(playerModules)) {
  for (const p of mod) {
    const names = (playerNamesMap as Record<string, { f: string, s: string }>)[p.id];
    playerMap.set(p.id, {
      ...p,
      full_name: names?.f ?? 'Unknown',
      shirt_name: names?.s ?? 'Unknown'
    });
  }
}

const teamModules = import.meta.glob<RawTeamDB[]>('./db/teams/teams_*.json', { eager: true, import: 'default' });
const allSeasons: RawTeamSeason[] = [];
const countryByTeamId = new Map<string, string>();
for (const mod of Object.values(teamModules)) {
  for (const team of mod) {
    countryByTeamId.set(team.id, team.country);
    const teamName = (teamNamesMap as Record<string, string>)[team.id] ?? team.id;
    for (const season of team.seasons) {
      const managerName = (managerNamesMap as Record<string, string>)[`${team.id}_${season.year}`] ?? 'Manager';
      const stadiumName = (stadiumNamesMap as Record<string, string>)[`${team.id}_${season.year}`] ?? 'Estadio';
      allSeasons.push({ id: team.id, name: teamName, ...season, manager: managerName, stadiumName });
    }
  }
}

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

const hashStr = (s: string): number => {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
};

const RETIRE_BANDS: Record<Position, [number, number]> = {
  POR: [40, 42],
  DEF: [35, 39],
  MED: [34, 37],
  AML: [34, 37],
  AMR: [34, 37],
  DEL: [33, 36],
};

export const getRetireAge = (dbId: string, pos: Position): number => {
  const [lo, hi] = RETIRE_BANDS[pos];
  const h = hashStr(dbId + ':retire');
  return lo + (h % (hi - lo + 1));
};

export const isPlayerActive = (dbPlayer: RawPlayerDB, year: number): boolean => {
  const age = year - dbPlayer.birth_year;
  if (age < 17) return false;
  return age < getRetireAge(dbPlayer.id, dbPlayer.preferred_pos);
};

const driftStat = (val: number, dbId: string, year: number, key: string): number => {
  const h = hashStr(`${dbId}:${year}:${key}`);
  const drift = (h % 7) - 3;
  return clamp(val + drift, 1, 99);
};

const applyAgeCurve = (
  stats: PlayerStats,
  seasonYear: number,
  birthYear: number,
  peakAge: number,
  dbId: string,
): PlayerStats => {
  const playerAge = seasonYear - birthYear;
  const factor = clamp(1 - Math.abs(playerAge - peakAge) * 0.04, 0.70, 1.0);
  return {
    speed: driftStat(Math.round(stats.speed * factor), dbId, seasonYear, 'spd'),
    dribbling: driftStat(Math.round(stats.dribbling * factor), dbId, seasonYear, 'drb'),
    passing: driftStat(Math.round(stats.passing * factor), dbId, seasonYear, 'pas'),
    shooting: driftStat(Math.round(stats.shooting * factor), dbId, seasonYear, 'sho'),
    defending: driftStat(Math.round(stats.defending * factor), dbId, seasonYear, 'def'),
    physical: driftStat(Math.round(stats.physical * factor), dbId, seasonYear, 'phy'),
    goalkeeping: driftStat(Math.round(stats.goalkeeping * factor), dbId, seasonYear, 'gk'),
  };
};

const isNewFormat = (players: (RosterEntry | RawPlayer)[]): players is RosterEntry[] => {
  return players.length > 0 && 'player_id' in players[0];
};

const generateStatsFromBase = (base: number, position: Position): PlayerStats => {
  const r = () => Math.floor(Math.random() * 6) - 3;
  switch (position) {
    case 'POR':
      return { speed: clamp(base - 12 + r(), 30, 99), dribbling: clamp(base - 25 + r(), 20, 99), passing: clamp(base - 15 + r(), 25, 99), shooting: clamp(base - 35 + r(), 10, 99), defending: clamp(base + 7 + r(), 50, 99), physical: clamp(base + 2 + r(), 50, 99), goalkeeping: clamp(base + 10 + r(), 50, 99) };
    case 'DEF':
      return { speed: clamp(base - 2 + r(), 40, 99), dribbling: clamp(base - 12 + r(), 30, 99), passing: clamp(base - 5 + r(), 40, 99), shooting: clamp(base - 18 + r(), 20, 99), defending: clamp(base + 5 + r(), 50, 99), physical: clamp(base + 3 + r(), 50, 99), goalkeeping: clamp(5 + r(), 1, 20) };
    case 'MED':
      return { speed: clamp(base - 2 + r(), 40, 99), dribbling: clamp(base + 3 + r(), 40, 99), passing: clamp(base + 5 + r(), 50, 99), shooting: clamp(base - 5 + r(), 30, 99), defending: clamp(base - 10 + r(), 30, 99), physical: clamp(base - 2 + r(), 40, 99), goalkeeping: clamp(5 + r(), 1, 20) };
    case 'AML':
    case 'AMR':
      return { speed: clamp(base + 4 + r(), 50, 99), dribbling: clamp(base + 5 + r(), 50, 99), passing: clamp(base + 3 + r(), 45, 99), shooting: clamp(base - 3 + r(), 35, 99), defending: clamp(base - 20 + r(), 20, 99), physical: clamp(base - 5 + r(), 40, 99), goalkeeping: clamp(5 + r(), 1, 20) };
    case 'DEL':
      return { speed: clamp(base + 3 + r(), 50, 99), dribbling: clamp(base + 2 + r(), 40, 99), passing: clamp(base - 5 + r(), 30, 99), shooting: clamp(base + 5 + r(), 50, 99), defending: clamp(base - 25 + r(), 15, 99), physical: clamp(base - 3 + r(), 40, 99), goalkeeping: clamp(5 + r(), 1, 20) };
  }
};

const averageStats = (s: PlayerStats, pos: Position): number =>
  Math.floor(computePositionWeightedMedia(s, pos));

const allowedPositionsFromDB = (dbPlayer: RawPlayerDB): Position[] =>
  (Object.keys(dbPlayer.positions) as Position[]).filter(k => !!dbPlayer.positions[k]);

const SQUAD_SIZE = 22;
const SQUAD_MINIMUMS: Partial<Record<Position, number>> = { POR: 2, DEF: 6, MED: 6 };
const FWD_POSITIONS: Position[] = ['DEL', 'AML', 'AMR'];
const FWD_MIN = 6;

const hydrateHistory = (history?: { club: string; league_key: string; from_year: number }[]) => {
  if (!history) return [];
  return history.map(h => ({
    ...h,
    club: (teamNamesMap as Record<string, string>)[h.club] ?? h.club
  }));
};

const trimSquad = (players: Player[]): { squad: Player[]; overflow: Player[] } => {
  const byPos: Record<string, Player[]> = {};
  for (const p of [...players].sort((a, b) => b.media - a.media)) {
    (byPos[p.preferredPos] ??= []).push(p);
  }
  const picked = new Set<string>();

  const pick = (pos: string, n: number) => {
    const pool = byPos[pos] ?? [];
    let count = 0;
    for (const p of pool) {
      if (!picked.has(p.id) && count < n) { picked.add(p.id); count++; }
    }
  };

  for (const [pos, min] of Object.entries(SQUAD_MINIMUMS)) pick(pos, min);
  let fwdPicked = 0;
  for (const pos of FWD_POSITIONS) {
    const pool = (byPos[pos] ?? []).filter(p => !picked.has(p.id));
    for (const p of pool) {
      if (fwdPicked < FWD_MIN) { picked.add(p.id); fwdPicked++; }
    }
  }

  const remaining = players.filter(p => !picked.has(p.id)).sort((a, b) => b.media - a.media);
  for (const p of remaining) {
    if (picked.size >= SQUAD_SIZE) break;
    picked.add(p.id);
  }

  const squad = players.filter(p => picked.has(p.id));
  const overflow = players.filter(p => !picked.has(p.id));
  return { squad, overflow };
};

export const buildTeamFromSeason = (raw: RawTeamSeason): Team => {
  let players: Player[];

  if (isNewFormat(raw.players)) {
    players = raw.players.flatMap((entry) => {
      const dbPlayer = playerMap.get(entry.player_id);
      if (!dbPlayer || !isPlayerActive(dbPlayer, raw.year)) return [];
      const posStats = dbPlayer.positions[dbPlayer.preferred_pos];
      if (!posStats) return [];
      const stats = applyAgeCurve(posStats, raw.year, dbPlayer.birth_year, dbPlayer.peak_age, dbPlayer.id);
      return [{
        id: `${raw.id}_${dbPlayer.id}`,
        name: dbPlayer.shirt_name ?? 'Unknown',
        fullName: dbPlayer.full_name ?? 'Unknown',
        position: dbPlayer.preferred_pos,
        preferredPos: dbPlayer.preferred_pos,
        allowedPositions: allowedPositionsFromDB(dbPlayer),
        number: entry.number,
        stats,
        media: averageStats(stats, dbPlayer.preferred_pos),
        birthYear: dbPlayer.birth_year,
        peakAge: dbPlayer.peak_age,
        seasonStats: { goals: 0, assists: 0, yellowCards: 0, redCards: 0, appearances: 0, minutes: 0, ratingSum: 0, cleanSheets: 0, goalsAgainst: 0 },
        suspensionMatches: 0,
        stamina: 99,
        injuryWeeksRemaining: 0,
        clubHistory: hydrateHistory((dbPlayer as any).club_history),
      }];
    });
  } else {
    players = (raw.players as RawPlayer[]).map((p) => {
      const stats = generateStatsFromBase(p.base, p.pos);
      return {
        id: `${raw.id}_${p.id}`,
        name: p.name,
        fullName: p.name,
        position: p.pos,
        preferredPos: p.pos,
        allowedPositions: [p.pos],
        number: p.number ?? (p.id as number),
        stats,
        media: averageStats(stats, p.pos),
        birthYear: raw.year - 27,
        peakAge: 28,
        seasonStats: { goals: 0, assists: 0, yellowCards: 0, redCards: 0, appearances: 0, minutes: 0, ratingSum: 0, cleanSheets: 0, goalsAgainst: 0 },
        suspensionMatches: 0,
        stamina: 99,
        injuryWeeksRemaining: 0,
      };
    });
  }

  const { squad } = trimSquad(players);
  const tacticalDiscipline = true;
  const { formation, lineup } = pickBestFormation(squad, new Set(), tacticalDiscipline);
  const team: Team = {
    id: raw.id,
    name: raw.name,
    colors: raw.colors,
    year: raw.year,
    manager: raw.manager,
    stadiumName: raw.stadiumName,
    stadiumCapacity: raw.stadiumCapacity,
    ticketPrice: raw.ticketPrice,
    budget: raw.budget,
    players: squad,
    lineup,
    formation,
    tacticalDiscipline,
  };
  return team;
};

export const buildTeamFromSeasonFull = (raw: RawTeamSeason): { team: Team; overflow: Player[] } => {
  let players: Player[] = [];
  if (isNewFormat(raw.players)) {
    players = raw.players.flatMap((entry) => {
      const dbPlayer = playerMap.get(entry.player_id);
      if (!dbPlayer || !isPlayerActive(dbPlayer, raw.year)) return [];
      const posStats = dbPlayer.positions[dbPlayer.preferred_pos];
      if (!posStats) return [];
      const stats = applyAgeCurve(posStats, raw.year, dbPlayer.birth_year, dbPlayer.peak_age, dbPlayer.id);
      return [{
        id: `${raw.id}_${dbPlayer.id}`,
        name: dbPlayer.shirt_name ?? 'Unknown',
        fullName: dbPlayer.full_name ?? 'Unknown',
        position: dbPlayer.preferred_pos,
        preferredPos: dbPlayer.preferred_pos,
        allowedPositions: allowedPositionsFromDB(dbPlayer),
        number: entry.number,
        stats,
        media: averageStats(stats, dbPlayer.preferred_pos),
        birthYear: dbPlayer.birth_year,
        peakAge: dbPlayer.peak_age,
        seasonStats: { goals: 0, assists: 0, yellowCards: 0, redCards: 0, appearances: 0, minutes: 0, ratingSum: 0, cleanSheets: 0, goalsAgainst: 0 },
        suspensionMatches: 0,
        stamina: 99,
        injuryWeeksRemaining: 0,
        clubHistory: hydrateHistory((dbPlayer as any).club_history),
      }];
    });
  }
  const { squad, overflow } = trimSquad(players);
  const tacticalDiscipline = true;
  const { formation, lineup } = pickBestFormation(squad, new Set(), tacticalDiscipline);
  return {
    team: {
      id: raw.id, name: raw.name, colors: raw.colors, year: raw.year,
      manager: raw.manager, stadiumName: raw.stadiumName, stadiumCapacity: raw.stadiumCapacity,
      ticketPrice: raw.ticketPrice, budget: raw.budget,
      players: squad, lineup, formation, tacticalDiscipline,
    },
    overflow,
  };
};

export interface AvailableTeam {
  id: string;
  name: string;
  years: number[];
}

export const getAvailableTeams = (): AvailableTeam[] => {
  const teamMap = new Map<string, { name: string; years: Set<number> }>();
  for (const s of allSeasons) {
    const entry = teamMap.get(s.id);
    if (entry) {
      entry.years.add(s.year);
    } else {
      teamMap.set(s.id, { name: s.name, years: new Set([s.year]) });
    }
  }
  return Array.from(teamMap.entries()).map(([id, { name, years }]) => ({
    id,
    name,
    years: Array.from(years).sort((a, b) => a - b)
  }));
};

export interface YearStats {
  year: number;
  teams: number;
  leagues: number;
  players: number;
}

const buildYearStats = (): YearStats[] => {
  const yearData = new Map<number, { teams: number; countries: Set<string>; players: number }>();
  for (const s of allSeasons) {
    const activePlayers = isNewFormat(s.players)
      ? s.players
          .map(e => playerMap.get(e.player_id))
          .filter((p): p is RawPlayerDB => !!p && isPlayerActive(p, s.year))
      : [];
    const hasGK = activePlayers.some(p => p.preferred_pos === 'POR' || !!p.positions['POR']);
    if (activePlayers.length >= 11 && hasGK) {
      const entry = yearData.get(s.year) ?? { teams: 0, countries: new Set(), players: 0 };
      entry.teams++;
      entry.players += activePlayers.length;
      const country = countryByTeamId.get(s.id);
      if (country) entry.countries.add(country);
      yearData.set(s.year, entry);
    }
  }
  return Array.from(yearData.entries())
    .filter(([, d]) => d.teams >= 2)
    .map(([year, d]) => ({ year, teams: d.teams, leagues: d.countries.size, players: d.players }))
    .sort((a, b) => b.teams - a.teams || a.year - b.year);
};

const _yearStats = buildYearStats();

export const getAvailableYears = (): number[] =>
  _yearStats.map(s => s.year).sort((a, b) => a - b);

export const getAvailableYearsWithStats = (): YearStats[] => _yearStats;

export const getTeamsForYear = (year: number): Team[] => {
  return allSeasons
    .filter(s => s.year === year)
    .map(buildTeamFromSeason);
};

export const getTeamsForYearWithOverflow = (year: number): { teams: Team[]; overflow: Player[] } => {
  const results = allSeasons
    .filter(s => s.year === year)
    .map(buildTeamFromSeasonFull);
  return {
    teams: results.map(r => r.team),
    overflow: results.flatMap(r => r.overflow),
  };
};

export const getTeamCountry = (teamId: string): string =>
  countryByTeamId.get(teamId) ?? 'unknown';

export const getTeamColorsForYear = (year: number): Map<string, string[]> => {
  const m = new Map<string, string[]>();
  for (const s of allSeasons) {
    if (s.year === year && s.colors) m.set(s.id, s.colors);
  }
  return m;
};

export const getTeamDefaults = (year: number, teamId: string): { name: string; colors: string[] } | null => {
  const s = allSeasons.find(s => s.year === year && s.id === teamId);
  if (!s) return null;
  return { name: s.name, colors: s.colors ?? [] };
};

export interface TeamTemplate {
  id: string;
  name: string;
  colors?: string[];
  playerCount: number;
  country: string;
}

export const getTeamTemplatesForYear = (year: number): TeamTemplate[] =>
  allSeasons
    .filter(s => s.year === year)
    .map(s => {
      const activePlayers = isNewFormat(s.players)
        ? s.players.filter(e => {
            const p = playerMap.get(e.player_id);
            return p && isPlayerActive(p, year);
          }).map(e => playerMap.get(e.player_id)!)
        : [];
      const hasGK = activePlayers.some(p => p.preferred_pos === 'POR' || !!p.positions['POR']);
      return { id: s.id, name: s.name, colors: s.colors, playerCount: activePlayers.length, hasGK, country: countryByTeamId.get(s.id) ?? 'other' };
    })
    .filter(t => t.playerCount >= 11 && t.hasGK);

export const MOCK_TEAMS: Team[] = getTeamsForYear(2024);

export const buildFreeAgentFromDB = (dbPlayer: RawPlayerDB, year: number): Player | null => {
  const posStats = dbPlayer.positions[dbPlayer.preferred_pos];
  if (!posStats) return null;
  const stats = applyAgeCurve(posStats, year, dbPlayer.birth_year, dbPlayer.peak_age, dbPlayer.id);
  return {
    id: `FA_${dbPlayer.id}`,
    name: dbPlayer.shirt_name ?? 'Unknown',
    fullName: dbPlayer.full_name ?? 'Unknown',
    position: dbPlayer.preferred_pos,
    preferredPos: dbPlayer.preferred_pos,
    allowedPositions: allowedPositionsFromDB(dbPlayer),
    number: 0,
    stats,
    media: averageStats(stats, dbPlayer.preferred_pos),
    birthYear: dbPlayer.birth_year,
    peakAge: dbPlayer.peak_age,
    seasonStats: { goals: 0, assists: 0, yellowCards: 0, redCards: 0, appearances: 0, minutes: 0, ratingSum: 0, cleanSheets: 0, goalsAgainst: 0 },
    suspensionMatches: 0,
    stamina: 99,
    injuryWeeksRemaining: 0,
    clubHistory: hydrateHistory((dbPlayer as any).club_history),
  };
};

export const getFreeAgents = (year: number): Player[] => {
  return (freeAgentIds as string[])
    .map(id => playerMap.get(id))
    .filter((p): p is RawPlayerDB => !!p)
    .map(p => buildFreeAgentFromDB(p, year))
    .filter((p): p is Player => p !== null);
};

export const getEligibleFreeAgents = (year: number, excludeDbIds: Set<string>): Player[] => {
  const out: Player[] = [];
  for (const dbPlayer of playerMap.values()) {
    if (excludeDbIds.has(dbPlayer.id)) continue;
    if (!isPlayerActive(dbPlayer, year)) continue;
    const fa = buildFreeAgentFromDB(dbPlayer, year);
    if (fa) out.push(fa);
  }
  return out;
};

export const getYouthCohort = (year: number, excludeDbIds: Set<string>): Player[] => {
  const out: Player[] = [];
  for (const dbPlayer of playerMap.values()) {
    if (excludeDbIds.has(dbPlayer.id)) continue;
    if (year - dbPlayer.birth_year !== 17) continue;
    const fa = buildFreeAgentFromDB(dbPlayer, year);
    if (fa) out.push(fa);
  }
  return out;
};

export const extractDbId = (playerId: string): string => {
  const parts = playerId.split('_');
  return parts[parts.length - 1];
};

export const getPlayerNameByDbId = (dbId: string): string | null => {
  const dbPlayer = playerMap.get(dbId);
  return dbPlayer?.shirt_name ?? null;
};

export interface LightPlayerEntry {
  dbId: string;
  name: string;
  fullName: string;
  preferredPos: Position;
  birthYear: number;
}

export const getAllDBPlayerEntries = (): LightPlayerEntry[] =>
  Array.from(playerMap.values())
    .map(p => ({ 
      dbId: p.id, 
      name: p.shirt_name ?? 'Unknown', 
      fullName: p.full_name ?? 'Unknown', 
      preferredPos: p.preferred_pos, 
      birthYear: p.birth_year 
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

export const buildPlayerForYear = (dbId: string, year: number): Player | null => {
  const dbPlayer = playerMap.get(dbId);
  if (!dbPlayer) return null;
  return buildFreeAgentFromDB(dbPlayer, year);
};

export const advancePlayerToYear = (player: Player, year: number): Player | null => {
  const dbId = extractDbId(player.id);
  const age = year - player.birthYear;
  if (age >= getRetireAge(dbId, player.preferredPos)) return null;
  const dbPlayer = playerMap.get(dbId);
  const basePosStats = dbPlayer?.positions[player.preferredPos];
  if (!basePosStats) {
    return {
      ...player,
      seasonStats: { goals: 0, assists: 0, yellowCards: 0, redCards: 0, appearances: 0, minutes: 0, ratingSum: 0, cleanSheets: 0, goalsAgainst: 0 },
      suspensionMatches: 0,
      forSale: false,
      stamina: 99,
      injuryWeeksRemaining: 0,
    };
  }
  const stats = applyAgeCurve(basePosStats, year, player.birthYear, player.peakAge, dbId);
  return {
    ...player,
    stats,
    media: averageStats(stats, player.preferredPos),
    seasonStats: { goals: 0, assists: 0, yellowCards: 0, redCards: 0, appearances: 0, minutes: 0, ratingSum: 0, cleanSheets: 0, goalsAgainst: 0 },
    suspensionMatches: 0,
    forSale: false,
    stamina: 99,
    injuryWeeksRemaining: 0,
    clubHistory: hydrateHistory((dbPlayer as any).club_history),
  };
};

export const getFantasyPool = (year: number): Player[] => {
  const out: Player[] = [];
  for (const p of playerMap.values()) {
    const age = year - p.birth_year;
    if (age < 17 || age > 40) continue;
    if (!isPlayerActive(p, year)) continue;
    const fa = buildFreeAgentFromDB(p, year);
    if (fa) out.push(fa);
  }
  return out.sort((a, b) => b.media - a.media);
};

export const buildFantasyTeam = (
  teamId: string,
  year: number,
  draftedPlayers: Player[],
  editorTeam?: Team,
): Team => {
  if (editorTeam) {
    return { ...editorTeam, players: draftedPlayers, lineup: [], year };
  }
  const s = allSeasons.find(season => season.id === teamId && season.year === year);
  const { formation, lineup } = pickBestFormation(draftedPlayers, new Set(), false);
  return {
    id: teamId,
    name: s?.name ?? teamId,
    colors: s?.colors,
    year,
    manager: s?.manager ?? 'Manager',
    stadiumName: s?.stadiumName ?? 'Estadio',
    stadiumCapacity: s?.stadiumCapacity ?? 30000,
    ticketPrice: s?.ticketPrice ?? 10,
    players: draftedPlayers,
    lineup,
    formation,
    budget: s?.budget ?? 15000000,
    tacticalDiscipline: false,
  };
};

export const migrateTeam = (team: Team): Team => {
  const players = team.players.map(p => {
    const allowedPositions = (Array.isArray(p.allowedPositions) && p.allowedPositions.length > 0)
      ? p.allowedPositions
      : (() => {
          const dbPlayer = playerMap.get(extractDbId(p.id));
          return dbPlayer ? allowedPositionsFromDB(dbPlayer) : [p.preferredPos ?? p.position];
        })();
    const ss = p.seasonStats ?? { goals: 0, assists: 0, yellowCards: 0, redCards: 0 };
    const seasonStats = {
      goals: ss.goals ?? 0,
      assists: ss.assists ?? 0,
      yellowCards: ss.yellowCards ?? 0,
      redCards: ss.redCards ?? 0,
      appearances: ss.appearances ?? 0,
      minutes: ss.minutes ?? 0,
      ratingSum: ss.ratingSum ?? 0,
      cleanSheets: ss.cleanSheets ?? 0,
      goalsAgainst: ss.goalsAgainst ?? 0,
    };
    const dbPlayer = playerMap.get(extractDbId(p.id));
    return { ...p, allowedPositions, seasonStats, stamina: p.stamina ?? 99, injuryWeeksRemaining: p.injuryWeeksRemaining ?? 0, clubHistory: hydrateHistory((dbPlayer as any)?.club_history) };
  });
  const hasFormation = !!team.formation;
  const lineupOk = Array.isArray(team.lineup) && team.lineup.length === 11;
  if (hasFormation && lineupOk) {
    return { ...team, players, tacticalDiscipline: team.tacticalDiscipline ?? true };
  }
  const disc = team.tacticalDiscipline ?? true;
  const { formation, lineup } = pickBestFormation(players, new Set(), disc);
  return { ...team, players, formation, lineup, tacticalDiscipline: disc };
};
