// Multi-league save slots backed by localStorage. The active slot is mirrored
// at the legacy key `openfutbol_league` so the rest of the app (which reads
// that key directly on boot) keeps working unchanged.
import type { LeagueState } from './leagueStore';

const INDEX_KEY = 'openfutbol_slot_index';
const ACTIVE_KEY = 'openfutbol_slot_active';
const LEGACY_KEY = 'openfutbol_league';
const slotKey = (id: string) => `openfutbol_slot_${id}`;

export interface SaveSlotSummary {
  gameMode: string;
  seasonYear: number;
  currentJornada: number;
  userTeamId: string | null;
  userTeamName: string | null;
  leaguePosition: number | null;
  managerName: string | null;
}

export interface SaveSlot {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  summary: SaveSlotSummary;
}

const safeParse = <T,>(raw: string | null): T | null => {
  if (!raw) return null;
  try { return JSON.parse(raw) as T; } catch { return null; }
};

const newId = (): string => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
};

const computeSummary = (state: LeagueState): SaveSlotSummary => {
  const userTeam = state.teams.find(t => t.id === state.userTeamId) ?? null;
  let leaguePosition: number | null = null;
  if (userTeam) {
    const ranked = Object.values(state.stats)
      .map(s => ({ id: s.teamId, pts: s.points, gd: s.goalsFor - s.goalsAgainst }))
      .sort((a, b) => b.pts - a.pts || b.gd - a.gd);
    const idx = ranked.findIndex(r => r.id === userTeam.id);
    leaguePosition = idx >= 0 ? idx + 1 : null;
  }
  return {
    gameMode: state.gameMode ?? 'classic',
    seasonYear: state.year,
    currentJornada: state.currentJornada,
    userTeamId: state.userTeamId || null,
    userTeamName: userTeam?.name ?? null,
    leaguePosition,
    managerName: state.managerName ?? null,
  };
};

export const listSlots = (): SaveSlot[] => safeParse<SaveSlot[]>(localStorage.getItem(INDEX_KEY)) ?? [];

const writeIndex = (slots: SaveSlot[]): void => {
  localStorage.setItem(INDEX_KEY, JSON.stringify(slots));
};

export const getActiveSlotId = (): string | null => localStorage.getItem(ACTIVE_KEY);

export const setActiveSlot = (slotId: string | null): void => {
  if (slotId) localStorage.setItem(ACTIVE_KEY, slotId);
  else localStorage.removeItem(ACTIVE_KEY);
};

export const loadSlot = (slotId: string): LeagueState | null =>
  safeParse<LeagueState>(localStorage.getItem(slotKey(slotId)));

export const saveSlot = (slotId: string, state: LeagueState, name?: string): SaveSlot => {
  const slots = listSlots();
  const existing = slots.find(s => s.id === slotId);
  const now = new Date().toISOString();
  const slot: SaveSlot = {
    id: slotId,
    name: name ?? existing?.name ?? defaultSlotName(state),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    summary: computeSummary(state),
  };
  const next = existing ? slots.map(s => s.id === slotId ? slot : s) : [...slots, slot];
  writeIndex(next);
  localStorage.setItem(slotKey(slotId), JSON.stringify(state));
  if (getActiveSlotId() === slotId) localStorage.setItem(LEGACY_KEY, JSON.stringify(state));
  return slot;
};

export const renameSlot = (slotId: string, name: string): void => {
  const slots = listSlots();
  const next = slots.map(s => s.id === slotId ? { ...s, name, updatedAt: new Date().toISOString() } : s);
  writeIndex(next);
};

export const deleteSlot = (slotId: string): void => {
  const slots = listSlots().filter(s => s.id !== slotId);
  writeIndex(slots);
  localStorage.removeItem(slotKey(slotId));
  if (getActiveSlotId() === slotId) {
    if (slots.length > 0) {
      const sorted = [...slots].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      setActiveSlot(sorted[0].id);
      const data = loadSlot(sorted[0].id);
      if (data) localStorage.setItem(LEGACY_KEY, JSON.stringify(data));
    } else {
      setActiveSlot(null);
      localStorage.removeItem(LEGACY_KEY);
    }
  }
};

const defaultSlotName = (state: LeagueState): string => {
  const team = state.teams.find(t => t.id === state.userTeamId);
  if (team) return `Carrera de ${team.name}`;
  return `Carrera ${state.year}`;
};

export const createSlotFromCurrent = (state: LeagueState, name?: string): SaveSlot => {
  const id = newId();
  const slot = saveSlot(id, state, name);
  setActiveSlot(id);
  localStorage.setItem(LEGACY_KEY, JSON.stringify(state));
  return slot;
};

// One-shot: if the user has a pre-v1.7 single-key save and no slot index, adopt
// it as "Carrera principal" so they don't lose anything.
export const migrateLegacyKey = (): void => {
  if (localStorage.getItem(INDEX_KEY)) return;
  const legacy = localStorage.getItem(LEGACY_KEY);
  if (!legacy) { writeIndex([]); return; }
  const state = safeParse<LeagueState>(legacy);
  if (!state || !state.teams) { writeIndex([]); return; }
  const id = newId();
  const slot: SaveSlot = {
    id,
    name: 'Carrera principal',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    summary: computeSummary(state),
  };
  writeIndex([slot]);
  localStorage.setItem(slotKey(id), legacy);
  setActiveSlot(id);
};
