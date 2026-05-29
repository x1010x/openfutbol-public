// Phase 2 stub. UI still imports these symbols but no pack data is loaded.
// Phase 4 will delete this file once UI consumes the new entity store directly.
import type { Team, Player, Position, RawPlayerDB, RawTeamSeason } from '../types/game.d.ts';

export interface YearStats {
  year: number;
  teams: number;
  leagues: number;
  players: number;
}

export interface TeamTemplate {
  id: string;
  name: string;
  colors?: string[];
  playerCount: number;
  country: string;
}

export interface LightPlayerEntry {
  dbId: string;
  name: string;
  fullName: string;
  preferredPos: Position;
  birthYear: number;
}

export const getAvailableYears = (): number[] => [];
export const getAvailableYearsWithStats = (): YearStats[] => [];
export const getTeamColorsForYear = (_year: number): Map<string, string[]> => new Map();
export const getTeamTemplatesForYear = (_year: number): TeamTemplate[] => [];
export const getTeamCountry = (_teamId: string): string => 'unknown';
export const getTeamDefaults = (_year: number, _teamId: string): { name: string; colors: string[] } | null => null;
export const getPlayerNameByDbId = (_dbId: string): string | null => null;
export const getAllDBPlayerEntries = (): LightPlayerEntry[] => [];
export const extractDbId = (playerId: string): string => playerId;
export const getRetireAge = (_dbId: string, _pos: Position): number => 40;
export const isPlayerActive = (_player: unknown, _year: number): boolean => false;

export const migrateTeam = (team: Team): Team => team;

export const buildFreeAgentFromDB = (_dbPlayer: RawPlayerDB, _year: number): Player | null => null;
export const buildPlayerForYear = (_dbId: string, _year: number): Player | null => null;
export const buildTeamFromSeason = (_raw: RawTeamSeason): Team => ({
  id: '', name: '', year: 0, stadiumCapacity: 0,
  ticketPrice: 0, budget: 0, players: [], lineup: [], formation: '4-4-2', tacticalDiscipline: true,
});

export const getTeamsForYearWithOverflow = (_year: number): { teams: Team[]; overflow: Player[] } =>
  ({ teams: [], overflow: [] });

export const getFreeAgents = (_year: number): Player[] => [];
export const getEligibleFreeAgents = (_year: number, _excludeDbIds: Set<string>): Player[] => [];
export { advancePlayer as advancePlayerToYear } from '../engine/retirement';

export const getFantasyPool = (_year: number): Player[] => [];
export const buildFantasyTeam = (
  teamId: string,
  year: number,
  draftedPlayers: Player[],
  editorTeam?: Team,
): Team => {
  if (editorTeam) return { ...editorTeam, players: draftedPlayers, lineup: [], year };
  return {
    id: teamId, name: teamId, year,
    stadiumCapacity: 30000, ticketPrice: 10, budget: 15000000,
    players: draftedPlayers, lineup: [], formation: '4-4-2', tacticalDiscipline: false,
  };
};
