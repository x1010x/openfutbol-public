import { useEffect, useMemo, useRef, useState } from 'react';
import type { Pack, Continent, Country, League, Club, PackPlayer, PositionCode } from '../types/game.d.ts';
import { usePack } from '../state/PackContext';
import { parsePack } from '../data/packLoader';
import {
  loadEditingPack, saveEditingPack, downloadPackJson,
  updateEntity, deleteEntity,
  deleteCountryCascade, deleteLeagueCascade, deleteClubCascade,
  packStats, stampMetaNow,
  blankContinent, blankCountry, blankLeague, blankClub, blankPlayer,
} from '../data/packEditor';

type Tab = 'continents' | 'countries' | 'leagues' | 'clubs' | 'players';

interface Props {
  onBack: () => void;
}

export const PackEditorView = ({ onBack }: Props) => {
  const { pack: currentPack } = usePack();
  const [pack, setPack] = useState<Pack | null>(() => loadEditingPack());
  const [tab, setTab] = useState<Tab>('clubs');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [loadError, setLoadError] = useState<string | null>(null);
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

  const handleExport = () => {
    if (!pack) return;
    const stamped = stampMetaNow(pack);
    setPack(stamped);
    const fname = `${(stamped.meta.name || 'openfutbol').replace(/[^a-z0-9_-]+/gi, '_')}.pack.json`;
    downloadPackJson(stamped, fname);
  };

  if (!pack) {
    return <LandingScreen
      currentAvailable={!!currentPack}
      loadError={loadError}
      onLoadCurrent={loadFromCurrent}
      onBack={onBack}
      onPickFile={() => fileRef.current?.click()}
      fileRef={fileRef}
      onFile={handleFile}
    />;
  }

  const stats = packStats(pack);

  return (
    <div className="w-full max-w-6xl flex flex-col gap-3 animate-in fade-in duration-300">
      <div className="bg-vga-blue p-2 border-2 border-vga-white flex justify-between items-center vga-panel">
        <div className="flex items-center gap-2">
          <h2 className="text-vga-yellow text-xs uppercase font-bold">Editor de packs</h2>
          <span className="text-vga-bright-white text-[9px] uppercase">{pack.meta.name || '—'}</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={handleExport} className="bg-vga-light-green text-vga-black px-3 py-1 text-[9px] uppercase font-bold border border-vga-black hover:bg-vga-bright-white">
            Exportar
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
            onClick={() => { setTab(t); setSelectedId(null); setSearch(''); }}
            className={`px-3 py-2 text-[9px] uppercase font-bold border-2 ${tab === t
              ? 'bg-vga-yellow text-vga-black border-vga-bright-white'
              : 'bg-vga-black text-vga-cyan border-vga-blue hover:border-vga-yellow'}`}
          >
            {tabLabel(t)} <span className="opacity-60">({stats[t === 'continents' ? 'continents' : t]})</span>
          </button>
        ))}
      </div>

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
            <Listing pack={pack} tab={tab} search={search} selectedId={selectedId} onSelect={setSelectedId} />
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
const Listing = ({ pack, tab, search, selectedId, onSelect }: {
  pack: Pack; tab: Tab; search: string; selectedId: string | null;
  onSelect: (id: string) => void;
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

  return (
    <table className="w-full text-[9px]">
      <thead className="bg-vga-blue/20 text-vga-cyan sticky top-0">
        <tr>
          <HeaderColumns tab={tab} />
        </tr>
      </thead>
      <tbody>
        {items.map(item => {
          const isSel = item.id === selectedId;
          return (
            <tr
              key={item.id}
              onClick={() => onSelect(item.id)}
              className={`${isSel ? 'bg-vga-yellow/20' : ''} cursor-pointer hover:bg-vga-blue/20 border-b border-vga-blue/30`}
            >
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
