import { useEffect, useMemo, useRef, useState } from 'react';
import type { Pack, Continent, Country, League, Club, PackPlayer, PositionCode, StatsPack } from '../types/game.d.ts';
import type { StatsEntry } from '../data/statsIndex';

interface ListingFilters {
  continentId?: string;
  countryId?: string;
  leagueId?: string;
  clubId?: string;
  positionCode?: PositionCode;
}
import { usePack } from '../state/PackContext';
import { parsePack } from '../data/packLoader';
import { StatsPackEditorView } from './StatsPackEditorView';
import { GameSelect } from './GameSelect';

// Helper: sorted [value, label] pairs by label (case-insensitive).
const sortedNamedOptions = <T extends { id: string; name?: string }>(arr: T[]): [string, string][] =>
  [...arr]
    .sort((a, b) => (a.name ?? '').toLowerCase().localeCompare((b.name ?? '').toLowerCase()))
    .map(e => [e.id, e.name ?? '—'] as [string, string]);
import {
  loadEditingPack, saveEditingPack, downloadPackJson,
  updateEntity, deleteEntity,
  deleteCountryCascade, deleteLeagueCascade, deleteClubCascade,
  packStats, stampMetaNow,
  blankContinent, blankCountry, blankLeague, blankClub, blankPlayer,
  validatePack, autoFixIssues, subsetPack,
  applyBulkPlayerOp,
  loadEditingStatsPack, saveEditingStatsPack, updateStatsMacro,
  type ExportFilter, type BulkPlayerOp,
} from '../data/packEditor';

type Tab = 'continents' | 'countries' | 'leagues' | 'clubs' | 'players';

interface Props {
  onBack: () => void;
}

export const PackEditorView = ({ onBack }: Props) => {
  const { pack: currentPack } = usePack();
  const [pack, setPack] = useState<Pack | null>(() => loadEditingPack());
  const [statsPack, setStatsPack] = useState<StatsPack | null>(() => loadEditingStatsPack());
  const [mode, setMode] = useState<'base' | 'stats'>('base');
  const [tab, setTab] = useState<Tab>('clubs');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showValidator, setShowValidator] = useState(false);
  const [showExportPicker, setShowExportPicker] = useState(false);
  const [showBulkOp, setShowBulkOp] = useState(false);
  // Multi-select set for the players tab (clear when tab changes).
  const [bulkSelection, setBulkSelection] = useState<Set<string>>(new Set());
  const fileRef = useRef<HTMLInputElement>(null);

  // Auto-save on every change.
  useEffect(() => { saveEditingPack(pack); }, [pack]);
  useEffect(() => { saveEditingStatsPack(statsPack); }, [statsPack]);
  // Reload the stats pack when the user enters the editor (could have edited
  // it in the stats mode).
  useEffect(() => { if (mode === 'base') setStatsPack(loadEditingStatsPack()); }, [mode]);

  const reset = () => { setPack(null); setSelectedId(null); setSearch(''); };

  const loadFromCurrent = () => {
    if (!currentPack) return;
    setPack(JSON.parse(JSON.stringify(currentPack)) as Pack);
    setSelectedId(null);
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoadError(null);
    try {
      const text = await file.text();
      const parsed = parsePack(JSON.parse(text));
      if (!parsed.ok) { setLoadError(parsed.message); return; }
      setPack(parsed.pack);
      setSelectedId(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Error al leer fichero');
    }
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleExport = (filter?: ExportFilter) => {
    if (!pack) return;
    const subsetted = filter ? subsetPack(pack, filter) : pack;
    const stamped = stampMetaNow(subsetted);
    if (!filter) setPack(stamped);
    const fname = `${(stamped.meta.name || 'openfutbol').replace(/[^a-z0-9_-]+/gi, '_')}.pack.json`;
    downloadPackJson(stamped, fname);
  };

  if (mode === 'stats') {
    return (
      <div className="w-full flex flex-col gap-2">
        <ModeSwitch mode={mode} onChange={setMode} />
        <StatsPackEditorView basePack={pack ?? currentPack ?? null} onBack={onBack} />
      </div>
    );
  }

  if (!pack) {
    return (
      <div className="w-full flex flex-col gap-2">
        <ModeSwitch mode={mode} onChange={setMode} />
        <LandingScreen
          currentAvailable={!!currentPack}
          loadError={loadError}
          onLoadCurrent={loadFromCurrent}
          onBack={onBack}
          onPickFile={() => fileRef.current?.click()}
          fileRef={fileRef}
          onFile={handleFile}
        />
      </div>
    );
  }

  const stats = packStats(pack);

  return (
    <div className="w-full max-w-6xl flex flex-col gap-3 animate-in fade-in duration-300">
      <ModeSwitch mode={mode} onChange={setMode} />
      <div className="bg-vga-blue p-2 border-2 border-vga-white flex justify-between items-center vga-panel">
        <div className="flex items-center gap-2">
          <h2 className="text-vga-yellow text-xs uppercase font-bold">Editor de packs</h2>
          <span className="text-vga-bright-white text-[9px] uppercase">{pack.meta.name || '—'}</span>
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          {tab === 'players' && bulkSelection.size > 0 && (
            <button onClick={() => setShowBulkOp(true)} className="bg-vga-magenta text-vga-bright-white px-3 py-1 text-[9px] uppercase font-bold border border-vga-black hover:bg-vga-light-magenta">
              Operación masiva ({bulkSelection.size})
            </button>
          )}
          <button onClick={() => setShowValidator(true)} className="bg-vga-cyan text-vga-black px-3 py-1 text-[9px] uppercase font-bold border border-vga-black hover:bg-vga-light-cyan">
            Validar
          </button>
          <button onClick={() => setShowExportPicker(true)} className="bg-vga-yellow text-vga-black px-3 py-1 text-[9px] uppercase font-bold border border-vga-black hover:bg-vga-bright-white">
            Exportar filtrado
          </button>
          <button onClick={() => handleExport()} className="bg-vga-light-green text-vga-black px-3 py-1 text-[9px] uppercase font-bold border border-vga-black hover:bg-vga-bright-white">
            Exportar todo
          </button>
          <button onClick={() => { if (confirm('¿Descartar el pack en edición?')) reset(); }} className="bg-vga-gray text-vga-black px-3 py-1 text-[8px] uppercase font-bold border border-vga-black hover:bg-vga-white">
            Cambiar pack
          </button>
          <button onClick={onBack} className="bg-vga-red text-vga-bright-white px-3 py-1 text-[8px] uppercase font-bold border border-vga-black hover:bg-vga-light-red">
            Salir
          </button>
        </div>
      </div>

      {/* Stats strip */}
      <div className="bg-vga-black border-2 border-vga-blue p-2 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 text-[8px] uppercase">
        <Stat label="Continentes" value={stats.continents} />
        <Stat label="Países" value={stats.countries} />
        <Stat label="Ligas" value={stats.leagues} />
        <Stat label="Clubes" value={stats.clubs} />
        <Stat label="Jugadores" value={stats.players} />
        <Stat label="Con club" value={stats.playersWithClub} />
        <Stat label="Con contrato" value={stats.playersWithContract} />
      </div>

      {/* Pack name editor */}
      <div className="flex items-center gap-2 bg-vga-black border-2 border-vga-blue p-2">
        <span className="text-vga-cyan text-[8px] uppercase tracking-widest">Nombre del pack</span>
        <input
          value={pack.meta.name}
          onChange={e => setPack(p => p ? { ...p, meta: { ...p.meta, name: e.target.value } } : p)}
          className="flex-1 bg-vga-black border border-vga-blue text-vga-bright-white text-[10px] px-2 py-1 outline-none focus:border-vga-yellow"
        />
        <span className="text-vga-gray text-[8px] uppercase">v{pack.meta.version}</span>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1">
        {(['continents','countries','leagues','clubs','players'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => { setTab(t); setSelectedId(null); setSearch(''); setBulkSelection(new Set()); }}
            className={`px-3 py-2 text-[9px] uppercase font-bold border-2 ${tab === t
              ? 'bg-vga-yellow text-vga-black border-vga-bright-white'
              : 'bg-vga-black text-vga-cyan border-vga-blue hover:border-vga-yellow'}`}
          >
            {tabLabel(t)} <span className="opacity-60">({stats[t === 'continents' ? 'continents' : t]})</span>
          </button>
        ))}
      </div>

      {showValidator && (
        <ValidatorModal
          pack={pack}
          onClose={() => setShowValidator(false)}
          onApplyFix={(fixed) => { setPack(fixed); }}
          onJumpToIssue={(tab, id) => { setTab(tab); setSelectedId(id); setShowValidator(false); }}
        />
      )}
      {showExportPicker && (
        <ExportPickerModal
          pack={pack}
          onClose={() => setShowExportPicker(false)}
          onExport={(filter) => { handleExport(filter); setShowExportPicker(false); }}
        />
      )}
      {showBulkOp && (
        <BulkOpModal
          pack={pack}
          playerIds={[...bulkSelection]}
          onClose={() => setShowBulkOp(false)}
          onApply={(op) => {
            setPack(p => p ? applyBulkPlayerOp(p, [...bulkSelection], op) : p);
            setShowBulkOp(false);
          }}
        />
      )}

      {/* Main body */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-3">
        {/* List */}
        <div className="bg-vga-black border-2 border-vga-blue flex flex-col">
          <div className="flex items-center gap-2 p-2 border-b border-vga-blue">
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar..."
              className="flex-1 bg-vga-black border border-vga-blue text-vga-bright-white text-[9px] px-2 py-1 outline-none focus:border-vga-yellow"
            />
            <button
              onClick={() => {
                let entity: Continent | Country | League | Club | PackPlayer;
                if (tab === 'continents') entity = blankContinent(pack);
                else if (tab === 'countries') entity = blankCountry(pack);
                else if (tab === 'leagues') entity = blankLeague(pack);
                else if (tab === 'clubs') entity = blankClub(pack);
                else entity = blankPlayer(pack);
                setPack(p => p ? { ...p, [tab]: [...p[tab], entity] } as Pack : p);
                setSelectedId(entity.id);
              }}
              className="bg-vga-light-green text-vga-black px-2 py-1 text-[9px] uppercase font-bold border border-vga-bright-white hover:bg-vga-bright-white"
            >
              + Nuevo
            </button>
          </div>
          <Listing
            pack={pack}
            statsPack={statsPack}
            tab={tab}
            search={search}
            selectedId={selectedId}
            onSelect={setSelectedId}
            bulkSelection={tab === 'players' ? bulkSelection : null}
            onBulkToggle={tab === 'players' ? (id) => setBulkSelection(prev => {
              const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next;
            }) : null}
            onBulkSelectAll={tab === 'players' ? (ids) => setBulkSelection(new Set(ids)) : null}
            onBulkClear={tab === 'players' ? () => setBulkSelection(new Set()) : null}
          />
        </div>

        {/* Editor side */}
        <div className="bg-vga-black border-2 border-vga-blue p-3 flex flex-col gap-2 max-h-[70vh] overflow-auto">
          {selectedId
            ? <EntityEditor
                pack={pack}
                statsPack={statsPack}
                onStatsMacroChange={(sid, key, v) => setStatsPack(prev => prev ? updateStatsMacro(prev, sid, key, v) : prev)}
                tab={tab}
                id={selectedId}
                onPatch={(patch) => setPack(p => p ? updateEntity(p, tab, selectedId, patch as never) : p)}
                onDelete={() => {
                  if (!confirm('¿Borrar (y arrastrar dependientes)?')) return;
                  setPack(p => {
                    if (!p) return p;
                    if (tab === 'countries') return deleteCountryCascade(p, selectedId);
                    if (tab === 'leagues')   return deleteLeagueCascade(p, selectedId);
                    if (tab === 'clubs')     return deleteClubCascade(p, selectedId);
                    return deleteEntity(p, tab, selectedId);
                  });
                  setSelectedId(null);
                }}
              />
            : <div className="text-vga-gray text-[8px] uppercase">Selecciona una fila para editarla.</div>
          }
        </div>
      </div>
    </div>
  );
};

const ModeSwitch = ({ mode, onChange }: { mode: 'base' | 'stats'; onChange: (m: 'base' | 'stats') => void }) => (
  <div className="flex gap-1">
    <button
      onClick={() => onChange('base')}
      className={`px-3 py-2 text-[10px] uppercase font-bold border-2 ${mode === 'base' ? 'bg-vga-yellow text-vga-black border-vga-bright-white' : 'bg-vga-black text-vga-cyan border-vga-blue hover:border-vga-yellow'}`}
    >
      Pack base
    </button>
    <button
      onClick={() => onChange('stats')}
      className={`px-3 py-2 text-[10px] uppercase font-bold border-2 ${mode === 'stats' ? 'bg-vga-yellow text-vga-black border-vga-bright-white' : 'bg-vga-black text-vga-cyan border-vga-blue hover:border-vga-yellow'}`}
    >
      Stats pack
    </button>
  </div>
);

const Stat = ({ label, value }: { label: string; value: number }) => (
  <div className="flex flex-col">
    <span className="text-vga-gray text-[7px]">{label}</span>
    <span className="text-vga-yellow font-mono text-[10px] font-bold">{value}</span>
  </div>
);

const tabLabel = (t: Tab): string => ({
  continents: 'Continentes',
  countries: 'Países',
  leagues: 'Ligas',
  clubs: 'Clubes',
  players: 'Jugadores',
}[t]);

// ─────────────────────────────────────────────────────────────────────────
const LandingScreen = ({
  currentAvailable, loadError, onLoadCurrent, onBack, onPickFile, fileRef, onFile,
}: {
  currentAvailable: boolean;
  loadError: string | null;
  onLoadCurrent: () => void;
  onBack: () => void;
  onPickFile: () => void;
  fileRef: React.RefObject<HTMLInputElement | null>;
  onFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) => (
  <div className="w-full max-w-2xl flex flex-col gap-3 animate-in fade-in duration-300">
    <div className="bg-vga-blue p-2 border-2 border-vga-white flex justify-between items-center vga-panel">
      <h2 className="text-vga-yellow text-xs uppercase font-bold">Editor de packs</h2>
      <button onClick={onBack} className="bg-vga-red text-vga-bright-white px-3 py-1 text-[8px] uppercase font-bold border border-vga-black hover:bg-vga-light-red">Volver</button>
    </div>
    <div className="bg-vga-black border-4 border-vga-blue p-4 flex flex-col gap-3">
      <div className="text-vga-bright-white text-[10px] uppercase">Elige un pack para editar</div>
      <button
        onClick={onLoadCurrent}
        disabled={!currentAvailable}
        className={`px-4 py-3 text-[10px] uppercase font-bold border-2 ${currentAvailable
          ? 'bg-vga-light-green text-vga-black border-vga-bright-white hover:bg-vga-bright-white'
          : 'bg-vga-gray text-vga-black border-vga-gray opacity-60 cursor-not-allowed'}`}
      >
        Cargar el pack actual del juego
      </button>
      <button onClick={onPickFile} className="px-4 py-3 text-[10px] uppercase font-bold border-2 bg-vga-yellow text-vga-black border-vga-bright-white hover:bg-vga-bright-white">
        Cargar desde fichero (.json)
      </button>
      <input ref={fileRef} type="file" accept=".json,application/json" onChange={onFile} className="hidden" />
      {loadError && (
        <div className="border border-vga-light-red bg-vga-black p-2 text-vga-light-red text-[8px] uppercase">
          {loadError}
        </div>
      )}
      <div className="text-vga-gray text-[8px] uppercase mt-2">
        El trabajo se autoguarda. Puedes salir y volver — el pack en edición sigue ahí.
      </div>
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────
const PAGE_SIZE = 100;

const POSITION_OPTIONS: PositionCode[] = ['GK','DC','DL','DR','WBL','WBR','DMC','MC','ML','MR','AMC','AML','AMR','FC'];

// Compare-friendly value for the current sort key per tab. Strings normalized
// to lowercase so case doesn't bias the sort.
const sortValue = (pack: Pack, tab: Tab, key: string, raw: { id: string }): string | number => {
  if (key === 'sid') return (raw as { source_id?: number }).source_id ?? 0;
  if (tab === 'continents') {
    const e = raw as Continent;
    return (e.name ?? '').toLowerCase();
  }
  if (tab === 'countries') {
    const e = raw as Country;
    if (key === 'code') return (e.code ?? '').toLowerCase();
    if (key === 'continent') return (pack.continents.find(c => c.id === e.continent_id)?.name ?? '').toLowerCase();
    if (key === 'reputation') return e.reputation;
    return (e.name ?? '').toLowerCase();
  }
  if (tab === 'leagues') {
    const e = raw as League;
    if (key === 'country') return (pack.countries.find(c => c.id === e.country_id)?.name ?? '').toLowerCase();
    if (key === 'tier') return e.tier;
    if (key === 'reputation') return e.reputation;
    return (e.name ?? '').toLowerCase();
  }
  if (tab === 'clubs') {
    const e = raw as Club;
    if (key === 'league') return (pack.leagues.find(l => l.id === e.league_id)?.name ?? '').toLowerCase();
    return (e.name ?? '').toLowerCase();
  }
  // players
  const p = raw as PackPlayer;
  if (key === 'pos') {
    const top = [...p.positions].sort((a, b) => b.level - a.level)[0];
    return top?.code ?? '';
  }
  if (key === 'ca') return p.current_ability;
  if (key === 'pa') return p.potential_ability;
  if (key === 'club') return (p.club_id ? pack.clubs.find(c => c.id === p.club_id)?.name ?? '' : 'zzzz').toLowerCase();
  // Default 'name': last name then first.
  return `${p.last_name} ${p.first_name}`.toLowerCase();
};

const Listing = ({ pack, statsPack, tab, search, selectedId, onSelect, bulkSelection, onBulkToggle, onBulkSelectAll, onBulkClear }: {
  pack: Pack; statsPack: StatsPack | null;
  tab: Tab; search: string; selectedId: string | null;
  onSelect: (id: string) => void;
  bulkSelection: Set<string> | null;
  onBulkToggle: ((id: string) => void) | null;
  onBulkSelectAll: ((ids: string[]) => void) | null;
  onBulkClear: (() => void) | null;
}) => {
  const q = search.trim().toLowerCase();
  const [filters, setFilters] = useState<ListingFilters>({});
  const [sortKey, setSortKey] = useState<string>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  // Reset filters and sort when the tab changes — country pick from "countries"
  // is not meaningful inside "leagues".
  useEffect(() => { setFilters({}); setSortKey('name'); setSortDir('asc'); }, [tab]);
  const toggleSort = (key: string, defaultDir: 'asc' | 'desc' = 'asc') => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir(defaultDir); }
  };

  // Pre-compute lookup sets when a parent filter is set.
  const leagueIdsForCountry = useMemo(() => {
    if (!filters.countryId) return null;
    return new Set(pack.leagues.filter(l => l.country_id === filters.countryId).map(l => l.id));
  }, [pack.leagues, filters.countryId]);

  const clubIdsForCurrentScope = useMemo(() => {
    // Used when filtering players: build the set of acceptable club_ids given
    // either filter.clubId, filter.leagueId, or filter.countryId.
    if (filters.clubId) return new Set([filters.clubId]);
    if (filters.leagueId) return new Set(pack.clubs.filter(c => c.league_id === filters.leagueId).map(c => c.id));
    if (leagueIdsForCountry) return new Set(pack.clubs.filter(c => leagueIdsForCountry.has(c.league_id)).map(c => c.id));
    return null;
  }, [pack.clubs, filters.clubId, filters.leagueId, leagueIdsForCountry]);

  const items = useMemo(() => {
    let arr = pack[tab] as Array<{ id: string }>;

    // Apply per-tab filters.
    if (tab === 'countries' && filters.continentId) {
      arr = (arr as Country[]).filter(c => c.continent_id === filters.continentId);
    }
    if (tab === 'leagues' && filters.countryId) {
      arr = (arr as League[]).filter(l => l.country_id === filters.countryId);
    }
    if (tab === 'clubs') {
      if (filters.leagueId) {
        arr = (arr as Club[]).filter(c => c.league_id === filters.leagueId);
      } else if (leagueIdsForCountry) {
        arr = (arr as Club[]).filter(c => leagueIdsForCountry.has(c.league_id));
      }
    }
    if (tab === 'players') {
      let ps = arr as PackPlayer[];
      if (filters.countryId && !filters.clubId && !filters.leagueId) {
        // Filter by player nationality when only country is set.
        ps = ps.filter(p => p.country_id === filters.countryId);
      }
      if (clubIdsForCurrentScope) {
        ps = ps.filter(p => p.club_id != null && clubIdsForCurrentScope.has(p.club_id));
      }
      if (filters.positionCode) {
        ps = ps.filter(p => p.positions.some(pos => pos.code === filters.positionCode));
      }
      arr = ps as Array<{ id: string }>;
    }

    // Search filter.
    if (q) {
      if (tab === 'continents' || tab === 'countries' || tab === 'leagues' || tab === 'clubs') {
        arr = (arr as Array<{ id: string; name?: string }>).filter(e => (e.name ?? '').toLowerCase().includes(q));
      } else if (tab === 'players') {
        arr = (arr as PackPlayer[]).filter(p => (p.first_name + ' ' + p.last_name).toLowerCase().includes(q));
      }
    }

    // Sort (after filtering, before pagination).
    const cmp = sortDir === 'asc' ? 1 : -1;
    const sorted = [...arr].sort((a, b) => sortValue(pack, tab, sortKey, a) > sortValue(pack, tab, sortKey, b) ? cmp : sortValue(pack, tab, sortKey, a) < sortValue(pack, tab, sortKey, b) ? -cmp : 0);
    return sorted;
  }, [pack, tab, q, filters, leagueIdsForCountry, clubIdsForCurrentScope, sortKey, sortDir]);

  // Paginate only when there's no search. Searching shows every match
  // because a deliberate filter is normally small enough to render.
  const [page, setPage] = useState(0);
  // Reset page when the result set changes (tab change, new search, etc.).
  useEffect(() => { setPage(0); }, [tab, q, pack]);
  const paginated = !q;
  const pageCount = paginated ? Math.max(1, Math.ceil(items.length / PAGE_SIZE)) : 1;
  const safePage = Math.min(page, pageCount - 1);
  const visible = paginated
    ? items.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE)
    : items;

  const allShownChecked = bulkSelection != null && visible.length > 0 && visible.every(it => bulkSelection.has(it.id));

  // Build the filter row for the current tab. continents has none.
  const filterBar = (tab === 'continents') ? null : (
    <div className="px-2 py-1.5 border-b border-vga-blue bg-vga-blue/10 flex flex-wrap items-center gap-2">
      <span className="text-vga-cyan text-[7px] uppercase tracking-widest">Filtrar:</span>
      {tab === 'countries' && (
        <FilterSelect label="Continente" value={filters.continentId ?? ''}
          options={[['', '— todos —'], ...sortedNamedOptions(pack.continents)]}
          onChange={v => setFilters({ continentId: v || undefined })} />
      )}
      {(tab === 'leagues' || tab === 'clubs' || tab === 'players') && (
        <FilterSelect label="País" value={filters.countryId ?? ''}
          options={[['', '— todos —'], ...sortedNamedOptions(pack.countries)]}
          onChange={v => setFilters(f => ({ ...f, countryId: v || undefined, leagueId: undefined, clubId: undefined }))} />
      )}
      {(tab === 'clubs' || tab === 'players') && (
        <FilterSelect label="Liga" value={filters.leagueId ?? ''}
          options={[['', '— todas —'], ...sortedNamedOptions(pack.leagues
            .filter(l => !filters.countryId || l.country_id === filters.countryId))]}
          onChange={v => setFilters(f => ({ ...f, leagueId: v || undefined, clubId: undefined }))} />
      )}
      {tab === 'players' && (
        <>
          <FilterSelect label="Club" value={filters.clubId ?? ''}
            options={[['', '— todos —'], ...sortedNamedOptions(pack.clubs
              .filter(c => {
                if (filters.leagueId) return c.league_id === filters.leagueId;
                if (filters.countryId) return leagueIdsForCountry?.has(c.league_id) ?? true;
                return true;
              }))]}
            onChange={v => setFilters(f => ({ ...f, clubId: v || undefined }))} />
          <FilterSelect label="Posición" value={filters.positionCode ?? ''}
            options={[['', '— todas —'], ...POSITION_OPTIONS.map(p => [p, p] as [string, string])]}
            onChange={v => setFilters(f => ({ ...f, positionCode: (v || undefined) as PositionCode | undefined }))} />
        </>
      )}
      {Object.values(filters).some(Boolean) && (
        <button onClick={() => setFilters({})}
          className="ml-auto px-2 py-0.5 text-[8px] uppercase border border-vga-red text-vga-light-red hover:bg-vga-red hover:text-vga-bright-white">
          Limpiar
        </button>
      )}
    </div>
  );

  return (
    <div className="flex flex-col max-h-[70vh] min-h-0">
      {filterBar}
      {/* Scrollable table area */}
      <div className="overflow-auto flex-1 min-h-0">
        <table className="w-full text-[9px]">
          <thead className="bg-vga-blue/20 text-vga-cyan sticky top-0">
            <tr>
              {bulkSelection != null && (
                <th className="text-left px-2 py-1 w-6">
                  <input
                    type="checkbox"
                    checked={allShownChecked}
                    onChange={e => {
                      if (e.target.checked) onBulkSelectAll?.(visible.map(i => i.id));
                      else onBulkClear?.();
                    }}
                  />
                </th>
              )}
              <HeaderColumns tab={tab} sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} hasStatsPack={!!statsPack} />
            </tr>
          </thead>
          <tbody>
            {visible.map(item => {
              const isSel = item.id === selectedId;
              const isBulkSel = bulkSelection?.has(item.id) ?? false;
              return (
                <tr
                  key={item.id}
                  onClick={() => onSelect(item.id)}
                  className={`${isSel ? 'bg-vga-yellow/20' : isBulkSel ? 'bg-vga-magenta/20' : ''} cursor-pointer hover:bg-vga-blue/20 border-b border-vga-blue/30`}
                >
                  {bulkSelection != null && (
                    <td className="px-2 py-1" onClick={e => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isBulkSel}
                        onChange={() => onBulkToggle?.(item.id)}
                      />
                    </td>
                  )}
                  <RowCells pack={pack} tab={tab} item={item as never} statsPack={statsPack} />
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination footer pinned outside the scroll area */}
      {paginated && items.length > PAGE_SIZE && (
        <div className="flex items-center justify-between gap-2 px-2 py-1.5 border-t-2 border-vga-blue bg-vga-blue/30 shrink-0">
          <span className="text-vga-gray text-[8px] uppercase">
            {safePage * PAGE_SIZE + 1}-{Math.min((safePage + 1) * PAGE_SIZE, items.length)} de {items.length}
          </span>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage(0)} disabled={safePage === 0}
              className={`px-2 py-0.5 text-[8px] uppercase border border-vga-blue ${safePage === 0 ? 'opacity-40 cursor-not-allowed' : 'hover:border-vga-yellow text-vga-cyan'}`}>«</button>
            <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={safePage === 0}
              className={`px-2 py-0.5 text-[8px] uppercase border border-vga-blue ${safePage === 0 ? 'opacity-40 cursor-not-allowed' : 'hover:border-vga-yellow text-vga-cyan'}`}>‹</button>
            <span className="text-vga-yellow font-mono text-[9px] px-2">{safePage + 1}/{pageCount}</span>
            <button onClick={() => setPage(p => Math.min(pageCount - 1, p + 1))} disabled={safePage >= pageCount - 1}
              className={`px-2 py-0.5 text-[8px] uppercase border border-vga-blue ${safePage >= pageCount - 1 ? 'opacity-40 cursor-not-allowed' : 'hover:border-vga-yellow text-vga-cyan'}`}>›</button>
            <button onClick={() => setPage(pageCount - 1)} disabled={safePage >= pageCount - 1}
              className={`px-2 py-0.5 text-[8px] uppercase border border-vga-blue ${safePage >= pageCount - 1 ? 'opacity-40 cursor-not-allowed' : 'hover:border-vga-yellow text-vga-cyan'}`}>»</button>
          </div>
        </div>
      )}
    </div>
  );
};

const FilterSelect = ({ label, value, options, onChange }: {
  label: string; value: string;
  options: [string, string][];
  onChange: (v: string) => void;
}) => (
  <label className="flex items-center gap-1">
    <span className="text-vga-gray text-[8px] uppercase">{label}:</span>
    <div className="min-w-[140px]">
      <GameSelect
        value={value}
        options={options.map(([v, l]) => ({ value: v, label: l }))}
        onChange={onChange}
      />
    </div>
  </label>
);

const SortableTh = ({ label, sortKey, currentSortKey, sortDir, onSort, align = 'left' }: {
  label: string; sortKey: string; currentSortKey: string; sortDir: 'asc' | 'desc';
  onSort: (k: string) => void; align?: 'left' | 'right';
}) => (
  <th
    onClick={() => onSort(sortKey)}
    className={`px-2 py-1 cursor-pointer select-none hover:text-vga-yellow ${align === 'right' ? 'text-right' : 'text-left'} ${currentSortKey === sortKey ? 'text-vga-yellow' : ''}`}
  >
    {label}{currentSortKey === sortKey ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}
  </th>
);

const HeaderColumns = ({ tab, sortKey, sortDir, onSort, hasStatsPack }: {
  tab: Tab; sortKey: string; sortDir: 'asc' | 'desc'; onSort: (k: string) => void; hasStatsPack: boolean;
}) => {
  const Sid = () => <SortableTh label="SID" sortKey="sid" currentSortKey={sortKey} sortDir={sortDir} onSort={onSort} align="right" />;
  if (tab === 'continents') return <>
    <Sid />
    <SortableTh label="Nombre" sortKey="name" currentSortKey={sortKey} sortDir={sortDir} onSort={onSort} />
  </>;
  if (tab === 'countries')  return <>
    <Sid />
    <SortableTh label="Nombre" sortKey="name" currentSortKey={sortKey} sortDir={sortDir} onSort={onSort} />
    <SortableTh label="Cód." sortKey="code" currentSortKey={sortKey} sortDir={sortDir} onSort={onSort} />
    <SortableTh label="Continente" sortKey="continent" currentSortKey={sortKey} sortDir={sortDir} onSort={onSort} />
    <SortableTh label="Rep." sortKey="reputation" currentSortKey={sortKey} sortDir={sortDir} onSort={onSort} align="right" />
  </>;
  if (tab === 'leagues')    return <>
    <Sid />
    <SortableTh label="Nombre" sortKey="name" currentSortKey={sortKey} sortDir={sortDir} onSort={onSort} />
    <SortableTh label="País" sortKey="country" currentSortKey={sortKey} sortDir={sortDir} onSort={onSort} />
    <SortableTh label="Tier" sortKey="tier" currentSortKey={sortKey} sortDir={sortDir} onSort={onSort} align="right" />
    <SortableTh label="Rep." sortKey="reputation" currentSortKey={sortKey} sortDir={sortDir} onSort={onSort} align="right" />
  </>;
  if (tab === 'clubs')      return <>
    <Sid />
    <SortableTh label="Nombre" sortKey="name" currentSortKey={sortKey} sortDir={sortDir} onSort={onSort} />
    <SortableTh label="Liga" sortKey="league" currentSortKey={sortKey} sortDir={sortDir} onSort={onSort} />
    <th className="text-left px-2 py-1">Colores</th>
  </>;
  return <>
    <Sid />
    <SortableTh label="Nombre" sortKey="name" currentSortKey={sortKey} sortDir={sortDir} onSort={onSort} />
    <SortableTh label="Pos." sortKey="pos" currentSortKey={sortKey} sortDir={sortDir} onSort={onSort} />
    <SortableTh label="CA" sortKey="ca" currentSortKey={sortKey} sortDir={sortDir} onSort={onSort} align="right" />
    <SortableTh label="PA" sortKey="pa" currentSortKey={sortKey} sortDir={sortDir} onSort={onSort} align="right" />
    <SortableTh label="Club" sortKey="club" currentSortKey={sortKey} sortDir={sortDir} onSort={onSort} />
    {hasStatsPack && <th className="text-center px-2 py-1 text-vga-cyan">★</th>}
  </>;
};

const RowCells = ({ pack, tab, item, statsPack }: {
  pack: Pack; tab: Tab; item: Continent | Country | League | Club | PackPlayer;
  statsPack: StatsPack | null;
}) => {
  const sid = (item as { source_id?: number }).source_id;
  const SidCell = <td className="px-2 py-1 text-right text-vga-gray font-mono">{sid ?? '—'}</td>;

  if (tab === 'continents') {
    const c = item as Continent;
    return <>{SidCell}<td className="px-2 py-1 text-vga-bright-white">{c.name}</td></>;
  }
  if (tab === 'countries') {
    const c = item as Country;
    const cont = pack.continents.find(x => x.id === c.continent_id);
    return <>
      {SidCell}
      <td className="px-2 py-1 text-vga-bright-white">{c.name}</td>
      <td className="px-2 py-1 text-vga-cyan">{c.code}</td>
      <td className="px-2 py-1 text-vga-gray">{cont?.name ?? '—'}</td>
      <td className="px-2 py-1 text-right text-vga-yellow">{c.reputation}</td>
    </>;
  }
  if (tab === 'leagues') {
    const l = item as League;
    const country = pack.countries.find(x => x.id === l.country_id);
    return <>
      {SidCell}
      <td className="px-2 py-1 text-vga-bright-white">{l.name}</td>
      <td className="px-2 py-1 text-vga-gray">{country?.name ?? '—'}</td>
      <td className="px-2 py-1 text-right text-vga-cyan">{l.tier}</td>
      <td className="px-2 py-1 text-right text-vga-yellow">{l.reputation}</td>
    </>;
  }
  if (tab === 'clubs') {
    const c = item as Club;
    const league = pack.leagues.find(x => x.id === c.league_id);
    const bg = c.colors?.background ?? '#333';
    const fg = c.colors?.foreground ?? '#fff';
    return <>
      {SidCell}
      <td className="px-2 py-1 text-vga-bright-white">{c.name}</td>
      <td className="px-2 py-1 text-vga-gray">{league?.name ?? '—'}</td>
      <td className="px-2 py-1 flex items-center gap-1">
        <span style={{ width: 12, height: 12, background: bg, border: `1px solid ${fg}` }} />
        <span className="text-vga-gray text-[7px] font-mono">{bg}</span>
      </td>
    </>;
  }
  const p = item as PackPlayer;
  const club = p.club_id ? pack.clubs.find(c => c.id === p.club_id) : null;
  const primary = [...p.positions].sort((a, b) => b.level - a.level)[0];
  const hasStats = statsPack ? !!statsPack.entries[String(p.source_id)] : false;
  return <>
    {SidCell}
    <td className="px-2 py-1 text-vga-bright-white">{p.first_name} {p.last_name}</td>
    <td className="px-2 py-1 text-vga-magenta">{primary?.code ?? '—'} <span className="text-vga-gray">{primary?.level ?? ''}</span></td>
    <td className="px-2 py-1 text-right text-vga-yellow">{p.current_ability}</td>
    <td className="px-2 py-1 text-right text-vga-cyan">{p.potential_ability}</td>
    <td className="px-2 py-1 text-vga-gray truncate">{club?.name ?? 'libre'}</td>
    {statsPack && (
      <td className="px-2 py-1 text-center">{hasStats ? <span className="text-vga-light-green font-bold">★</span> : <span className="text-vga-gray">·</span>}</td>
    )}
  </>;
};

// ─────────────────────────────────────────────────────────────────────────
const EntityEditor = ({ pack, statsPack, onStatsMacroChange, tab, id, onPatch, onDelete }: {
  pack: Pack; statsPack: StatsPack | null;
  onStatsMacroChange: (sourceId: string, macroKey: 'pa'|'sh'|'ps'|'dr'|'de'|'ph'|'gk', value: number) => void;
  tab: Tab; id: string;
  onPatch: (patch: Record<string, unknown>) => void;
  onDelete: () => void;
}) => {
  if (tab === 'continents') {
    const e = pack.continents.find(x => x.id === id);
    if (!e) return null;
    return <Form title="Continente" onDelete={onDelete}>
      <Field label="Nombre"><input className={inputCls} value={e.name} onChange={ev => onPatch({ name: ev.target.value })} /></Field>
    </Form>;
  }
  if (tab === 'countries') {
    const e = pack.countries.find(x => x.id === id);
    if (!e) return null;
    return <Form title="País" onDelete={onDelete}>
      <Field label="Nombre"><input className={inputCls} value={e.name} onChange={ev => onPatch({ name: ev.target.value })} /></Field>
      <Field label="Código"><input className={inputCls} maxLength={4} value={e.code} onChange={ev => onPatch({ code: ev.target.value.toUpperCase() })} /></Field>
      <Field label="Slug"><input className={inputCls} value={e.slug} onChange={ev => onPatch({ slug: ev.target.value })} /></Field>
      <Field label="Continente">
        <GameSelect
          value={e.continent_id}
          options={sortedNamedOptions(pack.continents).map(([v, l]) => ({ value: v, label: l }))}
          onChange={v => onPatch({ continent_id: v })}
        />
      </Field>
      <Field label="Reputación"><input className={inputCls} type="number" value={e.reputation} onChange={ev => onPatch({ reputation: parseInt(ev.target.value, 10) || 0 })} /></Field>
    </Form>;
  }
  if (tab === 'leagues') {
    const e = pack.leagues.find(x => x.id === id);
    if (!e) return null;
    return <Form title="Liga" onDelete={onDelete}>
      <Field label="Nombre"><input className={inputCls} value={e.name} onChange={ev => onPatch({ name: ev.target.value })} /></Field>
      <Field label="País">
        <GameSelect
          value={e.country_id}
          options={sortedNamedOptions(pack.countries).map(([v, l]) => ({ value: v, label: l }))}
          onChange={v => onPatch({ country_id: v })}
        />
      </Field>
      <Field label="Tier"><input className={inputCls} type="number" value={e.tier} onChange={ev => onPatch({ tier: parseInt(ev.target.value, 10) || 1 })} /></Field>
      <Field label="Reputación"><input className={inputCls} type="number" value={e.reputation} onChange={ev => onPatch({ reputation: parseInt(ev.target.value, 10) || 0 })} /></Field>
      <Field label="Plazas ascenso"><input className={inputCls} type="number" value={e.promotion_spots} onChange={ev => onPatch({ promotion_spots: parseInt(ev.target.value, 10) || 0 })} /></Field>
      <Field label="Plazas descenso"><input className={inputCls} type="number" value={e.relegation_spots} onChange={ev => onPatch({ relegation_spots: parseInt(ev.target.value, 10) || 0 })} /></Field>
    </Form>;
  }
  if (tab === 'clubs') {
    const e = pack.clubs.find(x => x.id === id);
    if (!e) return null;
    const bg = e.colors?.background ?? '#003366';
    const fg = e.colors?.foreground ?? '#ffffff';
    return <Form title="Club" onDelete={onDelete}>
      <Field label="Nombre"><input className={inputCls} value={e.name} onChange={ev => onPatch({ name: ev.target.value })} /></Field>
      <Field label="Liga">
        <GameSelect
          value={e.league_id}
          options={sortedNamedOptions(pack.leagues).map(([v, l]) => ({ value: v, label: l }))}
          onChange={v => onPatch({ league_id: v })}
        />
      </Field>
      <Field label="Color fondo"><input className={inputCls} type="color" value={bg} onChange={ev => onPatch({ colors: { background: ev.target.value, foreground: fg } })} /></Field>
      <Field label="Color texto"><input className={inputCls} type="color" value={fg} onChange={ev => onPatch({ colors: { background: bg, foreground: ev.target.value } })} /></Field>
    </Form>;
  }
  // Player
  const e = pack.players.find(x => x.id === id);
  if (!e) return null;
  return <Form title="Jugador" onDelete={onDelete}>
    <div className="grid grid-cols-2 gap-2">
      <Field label="Nombre"><input className={inputCls} value={e.first_name} onChange={ev => onPatch({ first_name: ev.target.value })} /></Field>
      <Field label="Apellido"><input className={inputCls} value={e.last_name} onChange={ev => onPatch({ last_name: ev.target.value })} /></Field>
    </div>
    <Field label="Club">
      <GameSelect
        value={e.club_id ?? ''}
        emptyLabel="— libre —"
        options={[{ value: '', label: '— libre —' }, ...sortedNamedOptions(pack.clubs).map(([v, l]) => ({ value: v, label: l }))]}
        onChange={v => onPatch({ club_id: v || null })}
      />
    </Field>
    <Field label="País">
      <GameSelect
        value={e.country_id}
        options={sortedNamedOptions(pack.countries).map(([v, l]) => ({ value: v, label: l }))}
        onChange={v => onPatch({ country_id: v })}
      />
    </Field>
    <Field label="Fecha de nacimiento (YYYY-MM-DD)"><input className={inputCls} value={e.birth_date} onChange={ev => onPatch({ birth_date: ev.target.value })} /></Field>
    <div className="grid grid-cols-2 gap-2">
      <Field label="Current Ability (1-200)"><input className={inputCls} type="number" min={1} max={200} value={e.current_ability} onChange={ev => onPatch({ current_ability: clampInt(ev.target.value, 1, 200) })} /></Field>
      <Field label="Potential Ability (1-200)"><input className={inputCls} type="number" min={1} max={200} value={e.potential_ability} onChange={ev => onPatch({ potential_ability: clampInt(ev.target.value, 1, 200) })} /></Field>
    </div>
    <Field label="Valor (€)"><input className={inputCls} type="number" value={e.value} onChange={ev => onPatch({ value: parseInt(ev.target.value, 10) || 0 })} /></Field>

    <div className="border border-vga-blue p-2 flex flex-col gap-1 mt-2">
      <div className="text-vga-cyan text-[8px] uppercase tracking-widest">Posiciones (1-20)</div>
      {e.positions.map((entry, i) => (
        <div key={i} className="grid grid-cols-[1fr_60px_auto] gap-1 items-center">
          <GameSelect
            value={entry.code}
            options={POSITION_CODES.map(c => ({ value: c, label: c }))}
            onChange={v => {
              const newPositions = [...e.positions];
              newPositions[i] = { ...entry, code: v as PositionCode };
              onPatch({ positions: newPositions });
            }}
          />
          <input className={inputCls} type="number" min={1} max={20} value={entry.level} onChange={ev => {
            const newPositions = [...e.positions];
            newPositions[i] = { ...entry, level: clampInt(ev.target.value, 1, 20) };
            onPatch({ positions: newPositions });
          }} />
          <button onClick={() => onPatch({ positions: e.positions.filter((_, j) => j !== i) })}
            className="bg-vga-red text-vga-bright-white px-2 py-1 text-[8px] uppercase border border-vga-black hover:bg-vga-light-red">×</button>
        </div>
      ))}
      <button
        onClick={() => onPatch({ positions: [...e.positions, { code: 'MC', level: 10 }] })}
        className="bg-vga-blue text-vga-bright-white px-2 py-1 text-[8px] uppercase border border-vga-bright-white hover:bg-vga-light-blue mt-1"
      >
        + posición
      </button>
    </div>

    <InlineStatsPanel
      player={e}
      statsPack={statsPack}
      onMacroChange={onStatsMacroChange}
    />
  </Form>;
};

// Inline panel that shows up in the player editor when there's a stats pack
// loaded. If the player has a stats entry, sliders for the seven macros let
// you edit them in-place. If not, a hint pointing at the Stats pack mode.
const InlineStatsPanel = ({ player, statsPack, onMacroChange }: {
  player: PackPlayer;
  statsPack: StatsPack | null;
  onMacroChange: (sourceId: string, macroKey: 'pa'|'sh'|'ps'|'dr'|'de'|'ph'|'gk', value: number) => void;
}) => {
  if (!statsPack) {
    return (
      <div className="border border-vga-blue p-2 mt-2 text-vga-gray text-[8px] uppercase">
        Cargá o generá un Stats pack para editar las stats extendidas desde aquí.
      </div>
    );
  }
  const sid = String(player.source_id);
  const entry = statsPack.entries[sid] as StatsEntry | undefined;
  if (!entry) {
    return (
      <div className="border border-vga-blue p-2 mt-2 text-vga-gray text-[8px] uppercase">
        Este jugador no tiene stats extendidas en el pack actual.
      </div>
    );
  }
  const MACROS: { key: 'pa'|'sh'|'ps'|'dr'|'de'|'ph'|'gk'; label: string }[] = [
    { key: 'pa', label: 'PAS' },
    { key: 'sh', label: 'TIR' },
    { key: 'ps', label: 'PSE' },
    { key: 'dr', label: 'DRI' },
    { key: 'de', label: 'DEF' },
    { key: 'ph', label: 'FIS' },
    { key: 'gk', label: 'POR' },
  ];
  return (
    <div className="border-2 border-vga-cyan p-2 mt-2 flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-vga-cyan text-[8px] uppercase tracking-widest font-bold">★ Stats extendidas</span>
        <span className="text-vga-gray text-[7px]">OV {entry.ov} · {statsPack.meta.name}</span>
      </div>
      {MACROS.map(({ key, label }) => (
        <div key={key} className="grid grid-cols-[40px_1fr_30px] items-center gap-2">
          <span className="text-vga-cyan text-[8px] uppercase">{label}</span>
          <input
            type="range" min={20} max={99}
            value={entry.macro[key] ?? 50}
            onChange={ev => onMacroChange(sid, key, parseInt(ev.target.value, 10))}
            className="w-full"
          />
          <span className="text-vga-bright-white font-mono text-[9px] text-center">{entry.macro[key] ?? '—'}</span>
        </div>
      ))}
    </div>
  );
};

const POSITION_CODES: PositionCode[] = ['GK','DC','DL','DR','WBL','WBR','DMC','MC','ML','MR','AMC','AML','AMR','FC'];

const Form = ({ title, onDelete, children }: { title: string; onDelete: () => void; children: React.ReactNode }) => (
  <>
    <div className="flex items-center justify-between border-b border-vga-blue pb-1">
      <span className="text-vga-yellow text-[10px] uppercase font-bold">{title}</span>
      <button onClick={onDelete} className="bg-vga-red text-vga-bright-white px-2 py-0.5 text-[8px] uppercase font-bold border border-vga-black hover:bg-vga-light-red">
        Borrar
      </button>
    </div>
    {children}
  </>
);

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="flex flex-col gap-0.5">
    <span className="text-vga-gray text-[7px] uppercase tracking-widest">{label}</span>
    {children}
  </label>
);

const inputCls = 'bg-vga-black border border-vga-blue text-vga-bright-white text-[10px] px-2 py-1 outline-none focus:border-vga-yellow font-mono';

const clampInt = (v: string, min: number, max: number): number => {
  const n = parseInt(v, 10);
  if (Number.isNaN(n)) return min;
  return Math.max(min, Math.min(max, n));
};

// ── Validator modal ──────────────────────────────────────────────────────
const ValidatorModal = ({ pack, onClose, onApplyFix, onJumpToIssue }: {
  pack: Pack; onClose: () => void;
  onApplyFix: (fixedPack: Pack) => void;
  onJumpToIssue: (tab: Tab, id: string) => void;
}) => {
  const issues = useMemo(() => validatePack(pack), [pack]);
  const errors = issues.filter(i => i.level === 'error');
  const warns = issues.filter(i => i.level === 'warn');
  const infos = issues.filter(i => i.level === 'info');
  const fixable = issues.filter(i => i.fix);

  return (
    <div onClick={onClose} className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div onClick={e => e.stopPropagation()} className="w-full max-w-3xl border-4 border-vga-bright-white bg-vga-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] max-h-[90vh] flex flex-col">
        <div className="bg-vga-blue/40 border-b-2 border-vga-blue px-3 py-2 flex items-center justify-between gap-2">
          <span className="text-vga-yellow text-[10px] uppercase tracking-widest font-bold">Validación del pack</span>
          <div className="flex items-center gap-2 text-[9px] uppercase">
            <span className="text-vga-light-red">Errores: {errors.length}</span>
            <span className="text-vga-yellow">Avisos: {warns.length}</span>
            <span className="text-vga-cyan">Info: {infos.length}</span>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-1">
          {issues.length === 0 ? (
            <div className="text-vga-light-green text-[10px] uppercase text-center py-6">✓ Pack limpio. Sin problemas detectados.</div>
          ) : (
            issues.map((iss, i) => (
              <div key={i} className={`border-l-2 p-2 text-[9px] flex items-center justify-between gap-2 ${
                iss.level === 'error' ? 'border-vga-light-red bg-vga-light-red/10' :
                iss.level === 'warn'  ? 'border-vga-yellow bg-vga-yellow/10' :
                                        'border-vga-cyan bg-vga-cyan/10'
              }`}>
                <div className="min-w-0">
                  <div className={`uppercase font-bold text-[7px] ${iss.level === 'error' ? 'text-vga-light-red' : iss.level === 'warn' ? 'text-vga-yellow' : 'text-vga-cyan'}`}>
                    {iss.level} · {iss.code}
                  </div>
                  <div className="text-vga-bright-white">{iss.message}</div>
                </div>
                {iss.entity && (
                  <button
                    onClick={() => onJumpToIssue(iss.entity!.tab as Tab, iss.entity!.id)}
                    className="bg-vga-blue text-vga-bright-white px-2 py-1 text-[8px] uppercase border border-vga-bright-white hover:bg-vga-light-blue shrink-0"
                  >
                    Ir
                  </button>
                )}
              </div>
            ))
          )}
        </div>
        <div className="border-t-2 border-vga-blue p-2 bg-vga-blue/30 flex gap-2 justify-end">
          {fixable.length > 0 && (
            <button
              onClick={() => {
                const { pack: fixed, fixed: n } = autoFixIssues(pack, fixable);
                onApplyFix(fixed);
                alert(`Auto-arreglos aplicados: ${n}`);
              }}
              className="bg-vga-yellow text-vga-black px-3 py-1.5 text-[9px] uppercase font-bold border-2 border-vga-bright-white hover:bg-vga-bright-white"
            >
              Auto-arreglar ({fixable.length})
            </button>
          )}
          <button onClick={onClose} className="bg-vga-blue text-vga-bright-white px-3 py-1.5 text-[9px] uppercase font-bold border-2 border-vga-bright-white hover:bg-vga-light-blue">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Bulk operation modal ────────────────────────────────────────────────
const BulkOpModal = ({ pack, playerIds, onClose, onApply }: {
  pack: Pack;
  playerIds: string[];
  onClose: () => void;
  onApply: (op: BulkPlayerOp) => void;
}) => {
  const [caDelta, setCaDelta] = useState<number>(0);
  const [paDelta, setPaDelta] = useState<number>(0);
  const [ageDelta, setAgeDelta] = useState<number>(0);
  const [valueMult, setValueMult] = useState<number>(1);
  const [clubAssign, setClubAssign] = useState<string>('__none__');   // __none__ = no change, '' = free agent
  const [countryAssign, setCountryAssign] = useState<string>('__none__');

  const buildOp = (): BulkPlayerOp => {
    const op: BulkPlayerOp = {};
    if (caDelta !== 0) op.caDelta = caDelta;
    if (paDelta !== 0) op.paDelta = paDelta;
    if (ageDelta !== 0) op.ageDelta = ageDelta;
    if (valueMult !== 1) op.valueMultiplier = valueMult;
    if (clubAssign !== '__none__') op.clubId = clubAssign === '' ? null : clubAssign;
    if (countryAssign !== '__none__') op.countryId = countryAssign;
    return op;
  };
  const op = buildOp();
  const willChange = Object.keys(op).length > 0;

  return (
    <div onClick={onClose} className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div onClick={e => e.stopPropagation()} className="w-full max-w-xl border-4 border-vga-bright-white bg-vga-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] flex flex-col">
        <div className="bg-vga-magenta/40 border-b-2 border-vga-magenta px-3 py-2">
          <span className="text-vga-yellow text-[10px] uppercase tracking-widest font-bold">
            Operación masiva — {playerIds.length} jugador{playerIds.length === 1 ? '' : 'es'}
          </span>
        </div>
        <div className="p-3 flex flex-col gap-3 max-h-[70vh] overflow-y-auto">
          <BulkRow label="CA (±)">
            <BulkNumber value={caDelta} onChange={setCaDelta} step={1} />
            <span className="text-vga-gray text-[8px] uppercase">Se clamea a 1-200</span>
          </BulkRow>
          <BulkRow label="PA (±)">
            <BulkNumber value={paDelta} onChange={setPaDelta} step={1} />
          </BulkRow>
          <BulkRow label="Edad (±años)">
            <BulkNumber value={ageDelta} onChange={setAgeDelta} step={1} />
            <span className="text-vga-gray text-[8px] uppercase">Positivo = más viejos</span>
          </BulkRow>
          <BulkRow label="Valor (×)">
            <BulkNumber value={valueMult} onChange={setValueMult} step={0.1} />
            <span className="text-vga-gray text-[8px] uppercase">1.0 = sin cambio</span>
          </BulkRow>
          <BulkRow label="Reasignar club">
            <div className="min-w-[220px] flex-1">
              <GameSelect
                value={clubAssign}
                options={[
                  { value: '__none__', label: '— sin cambio —' },
                  { value: '', label: '— a libre —' },
                  ...sortedNamedOptions(pack.clubs).map(([v, l]) => ({ value: v, label: l })),
                ]}
                onChange={setClubAssign}
              />
            </div>
          </BulkRow>
          <BulkRow label="Reasignar país">
            <div className="min-w-[220px] flex-1">
              <GameSelect
                value={countryAssign}
                options={[
                  { value: '__none__', label: '— sin cambio —' },
                  ...sortedNamedOptions(pack.countries).map(([v, l]) => ({ value: v, label: l })),
                ]}
                onChange={setCountryAssign}
              />
            </div>
          </BulkRow>
        </div>
        <div className="border-t-2 border-vga-blue p-2 bg-vga-blue/30 flex gap-2 justify-end">
          <button onClick={onClose} className="bg-vga-gray text-vga-black px-3 py-1.5 text-[9px] uppercase border-2 border-vga-black hover:bg-vga-white">Cancelar</button>
          <button
            onClick={() => onApply(op)}
            disabled={!willChange}
            className={`px-3 py-1.5 text-[9px] uppercase font-bold border-2 ${willChange
              ? 'bg-vga-light-green text-vga-black border-vga-bright-white hover:bg-vga-bright-white'
              : 'bg-vga-gray text-vga-black border-vga-gray opacity-60 cursor-not-allowed'}`}
          >
            Aplicar a {playerIds.length}
          </button>
        </div>
      </div>
    </div>
  );
};

const BulkRow = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="grid grid-cols-[120px_1fr] items-center gap-2">
    <span className="text-vga-cyan text-[8px] uppercase tracking-widest">{label}</span>
    <div className="flex items-center gap-2 flex-wrap">{children}</div>
  </div>
);

const BulkNumber = ({ value, onChange, step }: { value: number; onChange: (n: number) => void; step: number }) => (
  <div className="flex items-center gap-1">
    <button onClick={() => onChange(value - step)} className="bg-vga-gray text-vga-black px-2 py-0.5 text-[10px] border border-vga-black">−</button>
    <input
      type="number"
      step={step}
      value={value}
      onChange={e => onChange(parseFloat(e.target.value) || 0)}
      className="w-20 bg-vga-black border border-vga-blue text-vga-bright-white text-[10px] px-2 py-1 outline-none focus:border-vga-yellow font-mono text-center"
    />
    <button onClick={() => onChange(value + step)} className="bg-vga-gray text-vga-black px-2 py-0.5 text-[10px] border border-vga-black">+</button>
  </div>
);

// ── Export picker modal ─────────────────────────────────────────────────
const ExportPickerModal = ({ pack, onClose, onExport }: {
  pack: Pack;
  onClose: () => void;
  onExport: (filter: ExportFilter) => void;
}) => {
  const [mode, setMode] = useState<'countries' | 'leagues'>('countries');
  const [picked, setPicked] = useState<Set<string>>(new Set());

  const toggle = (id: string) => setPicked(prev => {
    const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next;
  });

  const items = mode === 'countries' ? pack.countries : pack.leagues;
  const itemsByParent = mode === 'leagues'
    ? new Map(pack.countries.map(c => [c.id, c.name]))
    : new Map<string, string>();

  // Preview counts
  const preview = useMemo(() => {
    const filter: ExportFilter = mode === 'countries' ? { countryIds: [...picked] } : { leagueIds: [...picked] };
    return picked.size > 0 ? subsetPack(pack, filter) : null;
  }, [pack, mode, picked]);

  return (
    <div onClick={onClose} className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div onClick={e => e.stopPropagation()} className="w-full max-w-2xl border-4 border-vga-bright-white bg-vga-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] max-h-[90vh] flex flex-col">
        <div className="bg-vga-blue/40 border-b-2 border-vga-blue px-3 py-2 flex items-center justify-between">
          <span className="text-vga-yellow text-[10px] uppercase tracking-widest font-bold">Exportar filtrado</span>
          <div className="flex gap-1">
            <button onClick={() => { setMode('countries'); setPicked(new Set()); }} className={`px-2 py-1 text-[8px] uppercase border ${mode === 'countries' ? 'bg-vga-yellow text-vga-black border-vga-bright-white' : 'bg-vga-black text-vga-cyan border-vga-blue'}`}>Por país</button>
            <button onClick={() => { setMode('leagues'); setPicked(new Set()); }} className={`px-2 py-1 text-[8px] uppercase border ${mode === 'leagues' ? 'bg-vga-yellow text-vga-black border-vga-bright-white' : 'bg-vga-black text-vga-cyan border-vga-blue'}`}>Por liga</button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-3 grid grid-cols-1 md:grid-cols-2 gap-1">
          {items.map(item => {
            const sel = picked.has(item.id);
            const parent = mode === 'leagues' ? itemsByParent.get((item as { country_id: string }).country_id) : null;
            return (
              <button
                key={item.id}
                onClick={() => toggle(item.id)}
                className={`text-left px-2 py-1 text-[9px] uppercase border ${sel ? 'bg-vga-yellow text-vga-black border-vga-bright-white font-bold' : 'bg-vga-black text-vga-bright-white border-vga-blue hover:border-vga-yellow'}`}
              >
                {item.name}
                {parent && <span className="ml-1 text-vga-gray normal-case">({parent})</span>}
              </button>
            );
          })}
        </div>
        <div className="border-t-2 border-vga-blue p-2 bg-vga-blue/30 flex items-center justify-between gap-2">
          <div className="text-vga-cyan text-[8px] uppercase">
            {preview
              ? `${preview.clubs.length} clubes · ${preview.players.length} jugadores`
              : 'Selecciona algún ítem'}
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="bg-vga-gray text-vga-black px-3 py-1.5 text-[9px] uppercase border-2 border-vga-black hover:bg-vga-white">
              Cancelar
            </button>
            <button
              onClick={() => onExport(mode === 'countries' ? { countryIds: [...picked] } : { leagueIds: [...picked] })}
              disabled={picked.size === 0}
              className={`px-3 py-1.5 text-[9px] uppercase font-bold border-2 ${picked.size > 0
                ? 'bg-vga-light-green text-vga-black border-vga-bright-white hover:bg-vga-bright-white'
                : 'bg-vga-gray text-vga-black border-vga-gray opacity-60 cursor-not-allowed'}`}
            >
              Exportar selección
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
