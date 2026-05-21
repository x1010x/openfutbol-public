import type { PackMeta, PlayerPack, TeamPack, RawPlayerDB, RawTeamDB } from '../types/game.d.ts';
import { encodeBackup, decodeBackup } from '../utils/backupUtils';

const CURRENT_VERSION = '1.0';

const isRawPlayerDB = (p: unknown): p is RawPlayerDB =>
  typeof p === 'object' && p !== null &&
  typeof (p as RawPlayerDB).id === 'string' &&
  typeof (p as RawPlayerDB).full_name === 'string' &&
  typeof (p as RawPlayerDB).birth_year === 'number' &&
  typeof (p as RawPlayerDB).positions === 'object';

const isRawTeamDB = (t: unknown): t is RawTeamDB =>
  typeof t === 'object' && t !== null &&
  typeof (t as RawTeamDB).id === 'string' &&
  typeof (t as RawTeamDB).name === 'string' &&
  Array.isArray((t as RawTeamDB).seasons);

export type ParsedPack = PlayerPack | TeamPack;

export const parsePack = (raw: unknown): ParsedPack | null => {
  if (typeof raw !== 'object' || raw === null) return null;
  const obj = raw as Record<string, unknown>;

  // Detect wrapped pack (has meta field)
  if (obj.meta && typeof obj.meta === 'object') {
    const meta = obj.meta as PackMeta;
    if (meta.type === 'player_pack' && Array.isArray(obj.players)) {
      const players = (obj.players as unknown[]).filter(isRawPlayerDB);
      return { meta, players };
    }
    if ((meta.type === 'team_pack' || meta.type === 'combined_pack') && Array.isArray(obj.teams)) {
      const teams = (obj.teams as unknown[]).filter(isRawTeamDB);
      const players = Array.isArray(obj.players)
        ? (obj.players as unknown[]).filter(isRawPlayerDB)
        : undefined;
      return { meta, teams, players };
    }
    return null;
  }

  // Unwrapped: bare array of players
  if (Array.isArray(raw)) {
    const players = (raw as unknown[]).filter(isRawPlayerDB);
    if (players.length > 0) {
      return {
        meta: { type: 'player_pack', name: 'Importado', version: CURRENT_VERSION },
        players,
      };
    }
    const teams = (raw as unknown[]).filter(isRawTeamDB);
    if (teams.length > 0) {
      return {
        meta: { type: 'team_pack', name: 'Importado', version: CURRENT_VERSION },
        teams,
      };
    }
  }

  return null;
};

export const loadPackFromFile = (file: File): Promise<ParsedPack | null> =>
  new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const content = e.target?.result as string;
        let text: string;
        try {
          text = decodeBackup(content);
        } catch {
          text = content;
        }
        const json = JSON.parse(text);
        resolve(parsePack(json));
      } catch {
        resolve(null);
      }
    };
    reader.readAsText(file);
  });

const downloadOfb = (filename: string, content: string) => {
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

export const exportPlayerPack = async (
  players: RawPlayerDB[],
  name: string,
  author?: string,
): Promise<void> => {
  const pack: PlayerPack = {
    meta: { type: 'player_pack', name, version: CURRENT_VERSION, author },
    players,
  };
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '_');
  const encoded = encodeBackup(JSON.stringify(pack));
  downloadOfb(`players_${slug}.ofb`, encoded);
};

export const exportTeamPack = async (
  team: RawTeamDB,
  players: RawPlayerDB[],
  name: string,
  author?: string,
): Promise<void> => {
  const pack: TeamPack = {
    meta: { type: 'combined_pack', name, version: CURRENT_VERSION, author },
    teams: [team],
    players: players.length > 0 ? players : undefined,
  };
  const slug = team.id.replace(/[^a-z0-9]+/g, '_');
  const encoded = encodeBackup(JSON.stringify(pack));
  downloadOfb(`team_${slug}.ofb`, encoded);
};
