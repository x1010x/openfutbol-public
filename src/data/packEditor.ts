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

// ── Validation ───────────────────────────────────────────────────────────
export type IssueLevel = 'error' | 'warn' | 'info';

export interface PackIssue {
  level: IssueLevel;
  code: string;
  message: string;
  entity?: { tab: EntityKey; id: string };
  fix?: 'drop-orphan' | 'clamp-ca-pa' | 'reset-birthdate' | 'add-position';
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const validatePack = (pack: Pack): PackIssue[] => {
  const issues: PackIssue[] = [];

  // ID/source_id uniqueness within each table.
  for (const key of ['continents','countries','leagues','clubs','players'] as EntityKey[]) {
    const arr = pack[key] as Array<{ id: string; source_id?: number }>;
    const ids = new Set<string>();
    const sids = new Set<number>();
    for (const e of arr) {
      if (ids.has(e.id)) issues.push({ level: 'error', code: 'dup-id', message: `${key}: id duplicado "${e.id}"`, entity: { tab: key, id: e.id } });
      ids.add(e.id);
      if (e.source_id != null) {
        if (sids.has(e.source_id)) issues.push({ level: 'warn', code: 'dup-source-id', message: `${key}: source_id duplicado ${e.source_id}` });
        sids.add(e.source_id);
      }
    }
  }

  const continentIds = new Set(pack.continents.map(c => c.id));
  const countryIds = new Set(pack.countries.map(c => c.id));
  const leagueIds = new Set(pack.leagues.map(l => l.id));
  const clubIds = new Set(pack.clubs.map(c => c.id));

  for (const c of pack.countries) {
    if (!continentIds.has(c.continent_id)) {
      issues.push({ level: 'error', code: 'orphan-country', message: `País "${c.name}" sin continente válido`, entity: { tab: 'countries', id: c.id }, fix: 'drop-orphan' });
    }
  }
  for (const l of pack.leagues) {
    if (!countryIds.has(l.country_id)) {
      issues.push({ level: 'error', code: 'orphan-league', message: `Liga "${l.name}" sin país válido`, entity: { tab: 'leagues', id: l.id }, fix: 'drop-orphan' });
    }
  }
  for (const c of pack.clubs) {
    if (!leagueIds.has(c.league_id)) {
      issues.push({ level: 'error', code: 'orphan-club', message: `Club "${c.name}" sin liga válida`, entity: { tab: 'clubs', id: c.id }, fix: 'drop-orphan' });
    }
  }
  for (const p of pack.players) {
    if (p.club_id != null && !clubIds.has(p.club_id)) {
      issues.push({ level: 'warn', code: 'orphan-player', message: `Jugador "${p.first_name} ${p.last_name}" apunta a un club inexistente`, entity: { tab: 'players', id: p.id }, fix: 'drop-orphan' });
    }
    if (!countryIds.has(p.country_id)) {
      issues.push({ level: 'warn', code: 'player-country', message: `Jugador "${p.first_name} ${p.last_name}" sin país válido`, entity: { tab: 'players', id: p.id } });
    }
    if (p.current_ability < 1 || p.current_ability > 200 || p.potential_ability < 1 || p.potential_ability > 200) {
      issues.push({ level: 'error', code: 'ca-pa-range', message: `Jugador "${p.first_name} ${p.last_name}" CA/PA fuera de rango`, entity: { tab: 'players', id: p.id }, fix: 'clamp-ca-pa' });
    }
    if (!ISO_DATE.test(p.birth_date)) {
      issues.push({ level: 'error', code: 'birth-format', message: `Jugador "${p.first_name} ${p.last_name}" fecha de nacimiento inválida`, entity: { tab: 'players', id: p.id }, fix: 'reset-birthdate' });
    }
    if (!p.positions || p.positions.length === 0) {
      issues.push({ level: 'error', code: 'no-positions', message: `Jugador "${p.first_name} ${p.last_name}" sin posiciones`, entity: { tab: 'players', id: p.id }, fix: 'add-position' });
    }
  }

  if (pack.players.length === 0) {
    issues.push({ level: 'info', code: 'empty-players', message: 'El pack no tiene jugadores.' });
  }

  return issues;
};

export const autoFixIssues = (pack: Pack, issues: PackIssue[]): { pack: Pack; fixed: number } => {
  let p = pack;
  let fixed = 0;
  for (const issue of issues) {
    if (!issue.fix || !issue.entity) continue;
    if (issue.fix === 'drop-orphan') {
      if (issue.entity.tab === 'countries') p = deleteCountryCascade(p, issue.entity.id);
      else if (issue.entity.tab === 'leagues') p = deleteLeagueCascade(p, issue.entity.id);
      else if (issue.entity.tab === 'clubs') p = deleteClubCascade(p, issue.entity.id);
      else if (issue.entity.tab === 'players') p = deleteEntity(p, 'players', issue.entity.id);
      fixed++;
    } else if (issue.fix === 'clamp-ca-pa') {
      p = updateEntity(p, 'players', issue.entity.id, {
        current_ability: Math.max(1, Math.min(200, p.players.find(pl => pl.id === issue.entity!.id)?.current_ability ?? 100)),
        potential_ability: Math.max(1, Math.min(200, p.players.find(pl => pl.id === issue.entity!.id)?.potential_ability ?? 100)),
      } as never);
      fixed++;
    } else if (issue.fix === 'reset-birthdate') {
      p = updateEntity(p, 'players', issue.entity.id, {
        birth_date: `${new Date().getFullYear() - 25}-01-01`,
      } as never);
      fixed++;
    } else if (issue.fix === 'add-position') {
      p = updateEntity(p, 'players', issue.entity.id, {
        positions: [{ code: 'MC', level: 10 }],
      } as never);
      fixed++;
    }
  }
  return { pack: p, fixed };
};

// ── Mass operations on player selections ────────────────────────────────
export interface BulkPlayerOp {
  caDelta?: number;       // adds to current_ability, then clamps 1-200
  paDelta?: number;       // adds to potential_ability, then clamps 1-200
  ageDelta?: number;      // shifts birth_date by N years (positive = older)
  valueMultiplier?: number;  // multiplies value
  clubId?: string | null;    // reassigns club (null = free agent)
  countryId?: string;        // reassigns country
}

const clamp200 = (n: number) => Math.max(1, Math.min(200, Math.round(n)));

export const applyBulkPlayerOp = (pack: Pack, playerIds: string[], op: BulkPlayerOp): Pack => {
  const ids = new Set(playerIds);
  return {
    ...pack,
    players: pack.players.map(p => {
      if (!ids.has(p.id)) return p;
      const next = { ...p };
      if (op.caDelta != null) next.current_ability = clamp200(p.current_ability + op.caDelta);
      if (op.paDelta != null) next.potential_ability = clamp200(p.potential_ability + op.paDelta);
      if (op.ageDelta != null) {
        const m = /^(\d{4})(-\d{2}-\d{2})$/.exec(p.birth_date);
        if (m) {
          const newYear = parseInt(m[1], 10) - op.ageDelta;
          next.birth_date = `${newYear}${m[2]}`;
        }
      }
      if (op.valueMultiplier != null) next.value = Math.max(0, Math.round(p.value * op.valueMultiplier));
      if (op.clubId !== undefined) next.club_id = op.clubId;
      if (op.countryId != null) next.country_id = op.countryId;
      return next;
    }),
  };
};

// ── Filtered export ──────────────────────────────────────────────────────
export interface ExportFilter {
  countryIds?: string[];   // include only these countries (and their leagues/clubs/players)
  leagueIds?: string[];    // OR include only these leagues
}

export const subsetPack = (pack: Pack, filter: ExportFilter): Pack => {
  let countries = pack.countries;
  let leagues = pack.leagues;
  if (filter.countryIds && filter.countryIds.length > 0) {
    const keep = new Set(filter.countryIds);
    countries = countries.filter(c => keep.has(c.id));
    const keptCountryIds = new Set(countries.map(c => c.id));
    leagues = leagues.filter(l => keptCountryIds.has(l.country_id));
  }
  if (filter.leagueIds && filter.leagueIds.length > 0) {
    const keep = new Set(filter.leagueIds);
    leagues = leagues.filter(l => keep.has(l.id));
    const keptLeagueCountryIds = new Set(leagues.map(l => l.country_id));
    countries = countries.filter(c => keptLeagueCountryIds.has(c.id));
  }
  const keptCountryIds = new Set(countries.map(c => c.id));
  const keptLeagueIds = new Set(leagues.map(l => l.id));
  const clubs = pack.clubs.filter(c => keptLeagueIds.has(c.league_id));
  const keptClubIds = new Set(clubs.map(c => c.id));
  const players = pack.players.filter(p =>
    keptCountryIds.has(p.country_id) || (p.club_id && keptClubIds.has(p.club_id))
  ).map(p => p.club_id && !keptClubIds.has(p.club_id) ? { ...p, club_id: null } : p);
  // Keep all continents referenced by the kept countries (cheap, small).
  const keptContinentIds = new Set(countries.map(c => c.continent_id));
  const continents = pack.continents.filter(c => keptContinentIds.has(c.id));
  return { ...pack, continents, countries, leagues, clubs, players };
};
