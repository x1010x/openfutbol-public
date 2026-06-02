import type { StatsPack, StatsPackMeta } from '../types/game.d.ts';

export interface StatsPackLoadResult { ok: true; pack: StatsPack; }
export interface StatsPackLoadError { ok: false; message: string; }
export type StatsPackLoadOutcome = StatsPackLoadResult | StatsPackLoadError;

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === 'string';
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

const validateMeta = (m: unknown): m is StatsPackMeta =>
  isObject(m) && isStr(m.name) && isStr(m.version) && isStr(m.source)
  && isStr(m.generated_at) && m.schema_version === 1 && isNum(m.count);

export const parseStatsPack = (raw: unknown): StatsPackLoadOutcome => {
  if (!isObject(raw)) return { ok: false, message: 'Archivo no es un objeto JSON.' };
  if (!validateMeta(raw.meta)) {
    return { ok: false, message: 'Metadatos de stats pack no válidos (¿schema_version 1?).' };
  }
  if (!isObject(raw.entries)) {
    return { ok: false, message: 'Campo "entries" debe ser un objeto.' };
  }
  return { ok: true, pack: raw as unknown as StatsPack };
};

export const loadStatsPackFromFile = async (file: File): Promise<StatsPackLoadOutcome> => {
  try { return parseStatsPack(JSON.parse(await file.text())); }
  catch (e) { return { ok: false, message: e instanceof Error ? e.message : 'Error de lectura' }; }
};

export const loadStatsPackFromUrl = async (url: string): Promise<StatsPackLoadOutcome> => {
  try {
    const res = await fetch(url);
    if (!res.ok) return { ok: false, message: `HTTP ${res.status}` };
    return parseStatsPack(await res.json());
  } catch (e) { return { ok: false, message: e instanceof Error ? e.message : 'Error de red' }; }
};
