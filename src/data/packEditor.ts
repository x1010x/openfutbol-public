import type { Pack, Continent, Country, League, Club, PackPlayer } from '../types/game.d.ts';

const STORAGE_KEY = 'openfutbol_pack_editor_v1';

// ── Persistence ──────────────────────────────────────────────────────────
export const loadEditingPack = (): Pack | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Pack;
  } catch { return null; }
};

export const saveEditingPack = (pack: Pack | null): void => {
  try {
    if (pack == null) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, JSON.stringify(pack));
  } catch { /* quota — best effort */ }
};

// ── Export ───────────────────────────────────────────────────────────────
export const downloadPackJson = (pack: Pack, filename = 'openfutbol-pack.json'): void => {
  const blob = new Blob([JSON.stringify(pack, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 0);
};

// ── CRUD helpers (immutable updates) ─────────────────────────────────────
export type EntityKey = 'continents' | 'countries' | 'leagues' | 'clubs' | 'players';

export const updateEntity = <K extends EntityKey>(
  pack: Pack,
  key: K,
  id: string,
  patch: Partial<Pack[K][number]>,
): Pack => {
  const arr = pack[key] as Array<{ id: string }>;
  return { ...pack, [key]: arr.map(e => e.id === id ? { ...e, ...patch } : e) } as Pack;
};

export const deleteEntity = (pack: Pack, key: EntityKey, id: string): Pack => {
  const arr = pack[key] as Array<{ id: string }>;
  return { ...pack, [key]: arr.filter(e => e.id !== id) } as Pack;
};

// Cascade: when deleting a parent (country/league/club) drop the orphans too
// so the exported pack stays self-consistent.
export const deleteCountryCascade = (pack: Pack, countryId: string): Pack => {
  const leagueIds = new Set(pack.leagues.filter(l => l.country_id === countryId).map(l => l.id));
  const clubIds = new Set(pack.clubs.filter(c => leagueIds.has(c.league_id)).map(c => c.id));
  return {
    ...pack,
    countries: pack.countries.filter(c => c.id !== countryId),
    leagues: pack.leagues.filter(l => l.country_id !== countryId),
    clubs: pack.clubs.filter(c => !leagueIds.has(c.league_id)),
    players: pack.players.filter(p => !p.club_id || !clubIds.has(p.club_id)),
  };
};

export const deleteLeagueCascade = (pack: Pack, leagueId: string): Pack => {
  const clubIds = new Set(pack.clubs.filter(c => c.league_id === leagueId).map(c => c.id));
  return {
    ...pack,
    leagues: pack.leagues.filter(l => l.id !== leagueId),
    clubs: pack.clubs.filter(c => c.league_id !== leagueId),
    players: pack.players.filter(p => !p.club_id || !clubIds.has(p.club_id)),
  };
};

export const deleteClubCascade = (pack: Pack, clubId: string): Pack => {
  return {
    ...pack,
    clubs: pack.clubs.filter(c => c.id !== clubId),
    // Players don't get deleted — they become free agents (club_id = null).
    players: pack.players.map(p => p.club_id === clubId ? { ...p, club_id: null } : p),
  };
};

// ── Stats ─────────────────────────────────────────────────────────────────
export interface PackStats {
  continents: number;
  countries: number;
  leagues: number;
  clubs: number;
  players: number;
  playersWithClub: number;
  playersWithContract: number;
}

export const packStats = (pack: Pack): PackStats => ({
  continents: pack.continents.length,
  countries: pack.countries.length,
  leagues: pack.leagues.length,
  clubs: pack.clubs.length,
  players: pack.players.length,
  playersWithClub: pack.players.filter(p => p.club_id != null).length,
  playersWithContract: pack.players.filter(p => p.contract != null).length,
});

// ── Factories (id + source_id helpers) ───────────────────────────────────
const randomId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const nextSourceId = (pack: Pack, key: EntityKey): number => {
  const arr = pack[key] as Array<{ source_id: number }>;
  let max = 0;
  for (const e of arr) if (e.source_id > max) max = e.source_id;
  return max + 1;
};

export const blankContinent = (pack: Pack): Continent => ({
  id: randomId('cont'), source_id: nextSourceId(pack, 'continents'), name: 'Continente',
});

export const blankCountry = (pack: Pack): Country => ({
  id: randomId('coun'), source_id: nextSourceId(pack, 'countries'),
  code: 'XX', slug: 'pais', name: 'País',
  continent_id: pack.continents[0]?.id ?? '', reputation: 100,
});

export const blankLeague = (pack: Pack): League => ({
  id: randomId('leag'), source_id: nextSourceId(pack, 'leagues'),
  country_id: pack.countries[0]?.id ?? '',
  slug: 'liga', name: 'Liga', reputation: 100, tier: 1,
  promotion_spots: 2, relegation_spots: 3,
});

export const blankClub = (pack: Pack): Club => ({
  id: randomId('club'), source_id: nextSourceId(pack, 'clubs'),
  league_id: pack.leagues[0]?.id ?? '',
  name: 'Club',
  colors: { background: '#003366', foreground: '#ffffff' },
  rivals_source_ids: [],
});

export const blankPlayer = (pack: Pack): PackPlayer => ({
  id: randomId('plyr'), source_id: nextSourceId(pack, 'players'),
  club_id: pack.clubs[0]?.id ?? null,
  country_id: pack.countries[0]?.id ?? '',
  first_name: 'Nuevo', last_name: 'Jugador',
  birth_date: `${new Date().getFullYear() - 25}-01-01`,
  positions: [{ code: 'MC', level: 15 }],
  current_ability: 100, potential_ability: 120, value: 1_000_000,
  contract: null,
});

// Replace meta in an immutable way (used when "exporting" — we'd bump the
// imported_at marker).
export const stampMetaNow = (pack: Pack, name?: string): Pack => ({
  ...pack,
  meta: {
    ...pack.meta,
    name: name ?? pack.meta.name,
    imported_at: new Date().toISOString(),
  },
});
