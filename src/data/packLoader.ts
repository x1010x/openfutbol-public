import type {
  Pack,
  PackPlayer,
  Continent,
  Country,
  League,
  Club,
  DataPackMeta,
  PlayerPack,
  TeamPack,
} from '../types/game.d.ts';

// ── New API ─────────────────────────────────────────────────────────────────

export interface PackLoadResult { ok: true; pack: Pack; }
export interface PackLoadError { ok: false; message: string; }
export type PackLoadOutcome = PackLoadResult | PackLoadError;

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const isStr = (v: unknown): v is string => typeof v === 'string';
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

const validateMeta = (m: unknown): m is DataPackMeta => {
  if (!isObject(m)) return false;
  return isStr(m.name) && isStr(m.version) && isStr(m.source_url)
    && (m.source_commit === null || isStr(m.source_commit))
    && isStr(m.imported_at) && m.schema_version === 1;
};

const validateContinent = (v: unknown): v is Continent =>
  isObject(v) && isStr(v.id) && isNum(v.source_id) && isStr(v.name);

const validateCountry = (v: unknown): v is Country =>
  isObject(v) && isStr(v.id) && isNum(v.source_id) && isStr(v.code) && isStr(v.slug)
  && isStr(v.name) && isStr(v.continent_id) && isNum(v.reputation);

const validateLeague = (v: unknown): v is League =>
  isObject(v) && isStr(v.id) && isNum(v.source_id) && isStr(v.country_id)
  && isStr(v.slug) && isStr(v.name) && isNum(v.reputation) && isNum(v.tier)
  && isNum(v.promotion_spots) && isNum(v.relegation_spots);

const validateClub = (v: unknown): v is Club =>
  isObject(v) && isStr(v.id) && isNum(v.source_id) && isStr(v.league_id) && isStr(v.name);

const validatePlayer = (v: unknown): v is PackPlayer => {
  if (!isObject(v)) return false;
  if (!isStr(v.id) || !isNum(v.source_id) || !isStr(v.country_id)) return false;
  if (!(v.club_id === null || isStr(v.club_id))) return false;
  if (!isStr(v.first_name) || !isStr(v.last_name) || !isStr(v.birth_date)) return false;
  if (!Array.isArray(v.positions)) return false;
  if (!isNum(v.current_ability) || !isNum(v.potential_ability) || !isNum(v.value)) return false;
  return true;
};

export const parsePack = (raw: unknown): PackLoadOutcome => {
  if (!isObject(raw)) return { ok: false, message: 'Archivo no es un objeto JSON.' };

  if (!validateMeta(raw.meta)) {
    return { ok: false, message: 'Metadatos del pack no válidos (¿schema_version 1?).' };
  }

  const arrays: Array<[string, unknown, (x: unknown) => boolean]> = [
    ['continents', raw.continents, validateContinent],
    ['countries', raw.countries, validateCountry],
    ['leagues', raw.leagues, validateLeague],
    ['clubs', raw.clubs, validateClub],
    ['players', raw.players, validatePlayer],
  ];

  for (const [name, value, validator] of arrays) {
    if (!Array.isArray(value)) {
      return { ok: false, message: `Campo "${name}" debe ser una lista.` };
    }
    if (value.length > 0 && !validator(value[0])) {
      return { ok: false, message: `Primer elemento de "${name}" no tiene la forma esperada.` };
    }
  }

  return { ok: true, pack: raw as unknown as Pack };
};

export const loadPackFromFile = async (file: File): Promise<PackLoadOutcome> => {
  try {
    const text = await file.text();
    const json = JSON.parse(text);
    return parsePack(json);
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'Error de lectura' };
  }
};

export const loadPackFromUrl = async (url: string): Promise<PackLoadOutcome> => {
  try {
    const res = await fetch(url);
    if (!res.ok) return { ok: false, message: `HTTP ${res.status}` };
    const json = await res.json();
    return parsePack(json);
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'Error de red' };
  }
};

// ── Legacy compat — used by EditorView/LeagueSetupView dead branches ────────
// TODO(phase-4): delete legacy pack-load callsites along with mockTeams stub.

export type ParsedPack = PlayerPack | TeamPack | null;

export const loadLegacyPackFromFile = (_file: File): Promise<ParsedPack> =>
  Promise.resolve(null);

export const exportPlayerPack = async (
  _players: unknown[], _name: string, _author?: string,
): Promise<void> => {
  console.warn('exportPlayerPack: legacy pack export disabled in Phase 2');
};

export const exportTeamPack = async (
  _team: unknown, _players: unknown[], _name: string, _author?: string,
): Promise<void> => {
  console.warn('exportTeamPack: legacy pack export disabled in Phase 2');
};
