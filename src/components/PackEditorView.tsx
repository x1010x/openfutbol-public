import { useEffect, useMemo, useRef, useState } from 'react';
import type { Pack, Continent, Country, League, Club, PackPlayer, PositionCode } from '../types/game.d.ts';
import { usePack } from '../state/PackContext';
import { parsePack } from '../data/packLoader';
import { StatsPackEditorView } from './StatsPackEditorView';
import {
  loadEditingPack, saveEditingPack, downloadPackJson,
  updateEntity, deleteEntity,
  deleteCountryCascade, deleteLeagueCascade, deleteClubCascade,
  packStats, stampMetaNow,
  blankContinent, blankCountry, blankLeague, blankClub, blankPlayer,
  validatePack, autoFixIssues, subsetPack,
  applyBulkPlayerOp,
  type ExportFilter, type BulkPlayerOp,
} from '../data/packEditor';

type Tab = 'continents' | 'countries' | 'leagues' | 'clubs' | 'players';

interface Props {
  onBack: () => void;
}

export const PackEditorView = ({ onBack }: Props) => {
  const { pack: currentPack } = usePack();
  const [pack, setPack] = useState<Pack | null>(() => loadEditingPack());
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
          <div className="max-h-[70vh] overflow-auto">
            <Listing
              pack={pack}
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
        </div>

        {/* Editor side */}
        <div className="bg-vga-black border-2 border-vga-blue p-3 flex flex-col gap-2 max-h-[70vh] overflow-auto">
          {selectedId
            ? <EntityEditor
                pack={pack}
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
const Listing = ({ pack, tab, search, selectedId, onSelect, bulkSelection, onBulkToggle, onBulkSelectAll, onBulkClear }: {
  pack: Pack; tab: Tab; search: string; selectedId: string | null;
  onSelect: (id: string) => void;
  bulkSelection: Set<string> | null;
  onBulkToggle: ((id: string) => void) | null;
  onBulkSelectAll: ((ids: string[]) => void) | null;
  onBulkClear: (() => void) | null;
}) => {
  const q = search.trim().toLowerCase();
  const items = useMemo(() => {
    const arr = pack[tab] as Array<{ id: string }>;
    if (!q) return arr;
    if (tab === 'continents' || tab === 'countries' || tab === 'leagues' || tab === 'clubs') {
      return (arr as Array<{ id: string; name?: string }>).filter(e => (e.name ?? '').toLowerCase().includes(q));
    }
    if (tab === 'players') {
      return (arr as PackPlayer[]).filter(p => (p.first_name + ' ' + p.last_name).toLowerCase().includes(q));
    }
    return arr;
  }, [pack, tab, q]);

  const allShownChecked = bulkSelection != null && items.length > 0 && items.every(it => bulkSelection.has(it.id));

  return (
    <table className="w-full text-[9px]">
      <thead className="bg-vga-blue/20 text-vga-cyan sticky top-0">
        <tr>
          {bulkSelection != null && (
            <th className="text-left px-2 py-1 w-6">
              <input
                type="checkbox"
                checked={allShownChecked}
                onChange={e => {
                  if (e.target.checked) onBulkSelectAll?.(items.map(i => i.id));
                  else onBulkClear?.();
                }}
              />
            </th>
          )}
          <HeaderColumns tab={tab} />
        </tr>
      </thead>
      <tbody>
        {items.map(item => {
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
              <RowCells pack={pack} tab={tab} item={item as never} />
            </tr>
          );
        })}
      </tbody>
    </table>
  );
};

const HeaderColumns = ({ tab }: { tab: Tab }) => {
  if (tab === 'continents') return <><th className="text-left px-2 py-1">Nombre</th></>;
  if (tab === 'countries')  return <><th className="text-left px-2 py-1">Nombre</th><th className="text-left px-2 py-1">Cód.</th><th className="text-left px-2 py-1">Continente</th><th className="text-right px-2 py-1">Rep.</th></>;
  if (tab === 'leagues')    return <><th className="text-left px-2 py-1">Nombre</th><th className="text-left px-2 py-1">País</th><th className="text-right px-2 py-1">Tier</th><th className="text-right px-2 py-1">Rep.</th></>;
  if (tab === 'clubs')      return <><th className="text-left px-2 py-1">Nombre</th><th className="text-left px-2 py-1">Liga</th><th className="text-left px-2 py-1">Colores</th></>;
  return <><th className="text-left px-2 py-1">Nombre</th><th className="text-left px-2 py-1">Pos.</th><th className="text-right px-2 py-1">CA</th><th className="text-right px-2 py-1">PA</th><th className="text-left px-2 py-1">Club</th></>;
};

const RowCells = ({ pack, tab, item }: { pack: Pack; tab: Tab; item: Continent | Country | League | Club | PackPlayer }) => {
  if (tab === 'continents') {
    const c = item as Continent;
    return <td className="px-2 py-1 text-vga-bright-white">{c.name}</td>;
  }
  if (tab === 'countries') {
    const c = item as Country;
    const cont = pack.continents.find(x => x.id === c.continent_id);
    return <>
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
  return <>
    <td className="px-2 py-1 text-vga-bright-white">{p.first_name} {p.last_name}</td>
    <td className="px-2 py-1 text-vga-magenta">{primary?.code ?? '—'} <span className="text-vga-gray">{primary?.level ?? ''}</span></td>
    <td className="px-2 py-1 text-right text-vga-yellow">{p.current_ability}</td>
    <td className="px-2 py-1 text-right text-vga-cyan">{p.potential_ability}</td>
    <td className="px-2 py-1 text-vga-gray truncate">{club?.name ?? 'libre'}</td>
  </>;
};

// ─────────────────────────────────────────────────────────────────────────
const EntityEditor = ({ pack, tab, id, onPatch, onDelete }: {
  pack: Pack; tab: Tab; id: string;
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
        <select className={inputCls} value={e.continent_id} onChange={ev => onPatch({ continent_id: ev.target.value })}>
          {pack.continents.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
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
        <select className={inputCls} value={e.country_id} onChange={ev => onPatch({ country_id: ev.target.value })}>
          {pack.countries.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
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
        <select className={inputCls} value={e.league_id} onChange={ev => onPatch({ league_id: ev.target.value })}>
          {pack.leagues.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
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
      <select className={inputCls} value={e.club_id ?? ''} onChange={ev => onPatch({ club_id: ev.target.value || null })}>
        <option value="">— libre —</option>
        {pack.clubs.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
    </Field>
    <Field label="País">
      <select className={inputCls} value={e.country_id} onChange={ev => onPatch({ country_id: ev.target.value })}>
        {pack.countries.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
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
          <select className={inputCls} value={entry.code} onChange={ev => {
            const newPositions = [...e.positions];
            newPositions[i] = { ...entry, code: ev.target.value as PositionCode };
            onPatch({ positions: newPositions });
          }}>
            {POSITION_CODES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
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
  </Form>;
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
            <select value={clubAssign} onChange={e => setClubAssign(e.target.value)} className="bg-vga-black border border-vga-blue text-vga-bright-white text-[10px] px-2 py-1 outline-none focus:border-vga-yellow font-mono">
              <option value="__none__">— sin cambio —</option>
              <option value="">— a libre —</option>
              {pack.clubs.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </BulkRow>
          <BulkRow label="Reasignar país">
            <select value={countryAssign} onChange={e => setCountryAssign(e.target.value)} className="bg-vga-black border border-vga-blue text-vga-bright-white text-[10px] px-2 py-1 outline-none focus:border-vga-yellow font-mono">
              <option value="__none__">— sin cambio —</option>
              {pack.countries.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
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
