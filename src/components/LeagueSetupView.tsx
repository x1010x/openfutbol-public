import { useState, useRef } from 'react';
import type { RawPlayerDB, RawTeamDB } from '../types/game.d.ts';
import type { Team } from '../types/game.d.ts';
import { getTeamTemplatesForYear, getTeamCountry, type TeamTemplate } from '../data/mockTeams';
import { loadPackFromFile } from '../data/packLoader';
import { TeamCrest } from './TeamCrest';

interface Props {
  year: number;
  existingTeams?: Team[];
  onConfirm: (selectedTeamIds: string[], extraPlayers: RawPlayerDB[], importedTeams: RawTeamDB[]) => void;
  onBack: () => void;
}

const MIN_TEAMS = 4;
const MAX_TEAMS = 24;

const COUNTRY_LABELS: Record<string, string> = {
  spain: 'ESPAÑA',
  england: 'INGLATERRA',
  germany: 'ALEMANIA',
  france: 'FRANCIA',
  italy: 'ITALIA',
  portugal: 'PORTUGAL',
  netherlands: 'PAÍSES BAJOS',
  scotland: 'ESCOCIA',
  editor: 'MIS EQUIPOS',
  unknown: '—',
};

export const LeagueSetupView = ({ year, existingTeams, onConfirm, onBack }: Props) => {
  const templates = getTeamTemplatesForYear(year);
  const dbIds = new Set(templates.map(t => t.id));

  const editorTemplates: TeamTemplate[] = (existingTeams ?? [])
    .filter(t => {
      if (dbIds.has(t.id)) return false;
      const ageValidCount = t.players.filter(p => {
        const age = year - p.birthYear;
        return age >= 17 && age <= 42;
      }).length;
      const hasGK = t.players.some(p => {
        const age = year - p.birthYear;
        return age >= 17 && age <= 42 && p.preferredPos === 'POR';
      });
      return ageValidCount >= 11 && hasGK;
    })
    .map(t => ({ id: t.id, name: t.name, colors: t.colors, country: 'other', playerCount: t.players.filter(p => {
      const age = year - p.birthYear;
      return age >= 17 && age <= 42;
    }).length }));

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [extraPlayers, setExtraPlayers] = useState<RawPlayerDB[]>([]);
  const [importedRawTeams, setImportedRawTeams] = useState<RawTeamDB[]>([]);
  const [importedTemplates, setImportedTemplates] = useState<TeamTemplate[]>([]);
  const [importedPacks, setImportedPacks] = useState<string[]>([]);
  const [importError, setImportError] = useState<string | null>(null);
  const [openCountries, setOpenCountries] = useState<Set<string>>(new Set());
  const [teamSearch, setTeamSearch] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const n = selected.size;
  const jornadas = n >= 2 ? 2 * (n - 1) : 0;
  const partidos = n >= 2 ? n * (n - 1) : 0;
  const canConfirm = n >= MIN_TEAMS && n <= MAX_TEAMS;

  const toggle = (id: string) =>
    setSelected(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });

  const toggleCountry = (c: string) =>
    setOpenCountries(prev => { const n = new Set(prev); n.has(c) ? n.delete(c) : n.add(c); return n; });

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError(null);
    const pack = await loadPackFromFile(file);
    if (!pack) { setImportError('Archivo no válido o formato desconocido.'); return; }
    if (pack.meta.type === 'player_pack') {
      setExtraPlayers(prev => [...prev, ...(pack as import('../types/game.d.ts').PlayerPack).players]);
      setImportedPacks(prev => [...prev, `${pack.meta.name} (${(pack as import('../types/game.d.ts').PlayerPack).players.length} jugadores)`]);
    } else {
      const tp = pack as import('../types/game.d.ts').TeamPack;
      if (tp.players) setExtraPlayers(prev => [...prev, ...tp.players!]);
      const newRawTeams = tp.teams;
      const newTemplates: TeamTemplate[] = newRawTeams.map(rt => {
        const season = rt.seasons.find(s => s.year === year) ?? rt.seasons[0];
        return { id: rt.id, name: rt.name, colors: season?.colors, country: 'other', playerCount: season?.players.length ?? 0 };
      });
      setImportedRawTeams(prev => { const ids = new Set(prev.map(t => t.id)); return [...prev, ...newRawTeams.filter(t => !ids.has(t.id))]; });
      setImportedTemplates(prev => { const ids = new Set(prev.map(t => t.id)); return [...prev, ...newTemplates.filter(t => !ids.has(t.id))]; });
      setSelected(prev => { const next = new Set(prev); for (const rt of newRawTeams) next.add(rt.id); return next; });
      setImportedPacks(prev => [...prev, `${pack.meta.name} (${tp.teams.length} equipos)`]);
    }
    if (fileRef.current) fileRef.current.value = '';
  };

  const allTemplates = [
    ...templates,
    ...editorTemplates.filter(et => !importedTemplates.some(it => it.id === et.id)),
    ...importedTemplates.filter(it => !templates.some(t => t.id === it.id) && !editorTemplates.some(et => et.id === it.id)),
  ];

  const selectedNames = allTemplates.filter(t => selected.has(t.id)).map(t => t.name);

  const isSearching = teamSearch.trim().length > 0;
  const filteredFlat = isSearching
    ? allTemplates.filter(t => t.name.toLowerCase().includes(teamSearch.trim().toLowerCase()))
    : null;

  // Group by country for non-search view
  const byCountry = new Map<string, TeamTemplate[]>();
  for (const t of allTemplates) {
    const isEditor = editorTemplates.some(et => et.id === t.id);
    const isImported = importedTemplates.some(it => it.id === t.id);
    const country = isEditor || isImported ? 'editor' : getTeamCountry(t.id);
    const bucket = byCountry.get(country) ?? [];
    bucket.push(t);
    byCountry.set(country, bucket);
  }
  const sortedCountries = Array.from(byCountry.entries()).sort((a, b) => b[1].length - a[1].length);

  const renderTeamButton = (t: TeamTemplate) => {
    const active = selected.has(t.id);
    const isImported = importedTemplates.some(it => it.id === t.id);
    const isEditor = editorTemplates.some(et => et.id === t.id);
    const accent = isImported ? 'text-vga-cyan' : isEditor ? 'text-vga-magenta' : 'text-vga-blue';
    const borderActive = isImported ? 'border-vga-cyan' : isEditor ? 'border-vga-magenta' : 'border-vga-blue';
    return (
      <button
        key={t.id}
        onClick={() => toggle(t.id)}
        className={`flex items-center gap-2 p-2 border-2 text-left transition-colors ${
          active ? `${borderActive} bg-vga-bright-white` : 'border-vga-black bg-vga-gray opacity-50'
        }`}
      >
        <TeamCrest colors={t.colors ?? ['#888', '#888', '#888']} size="sm" title={t.name} />
        <div className="flex flex-col min-w-0">
          <span className="text-vga-black text-[8px] font-bold uppercase truncate">{t.name}</span>
          <span className={`text-[7px] ${accent}`}>{t.playerCount} jug.</span>
        </div>
        <span className={`ml-auto text-[10px] font-bold ${active ? 'text-vga-green' : 'text-vga-black'}`}>
          {active ? '✓' : '○'}
        </span>
      </button>
    );
  };

  return (
    <div className="w-full max-w-2xl flex flex-col gap-4 animate-in fade-in duration-300">
      <div className="bg-vga-blue p-2 border-2 border-vga-white flex justify-between items-center vga-panel">
        <h2 className="text-vga-yellow text-xs uppercase font-bold">
          CONFIGURAR LIGA — {year}/{(year + 1).toString().slice(-2)}
        </h2>
        <button onClick={onBack} className="bg-vga-red text-vga-bright-white px-3 py-1 text-[8px] border border-vga-black hover:bg-vga-light-red">
          VOLVER
        </button>
      </div>

      <div className="bg-vga-gray border-4 border-vga-blue p-4 flex flex-col gap-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
        <div className="flex items-center gap-2">
          <input
            value={teamSearch}
            onChange={e => setTeamSearch(e.target.value)}
            placeholder="Buscar equipo..."
            className="flex-1 bg-vga-bright-white text-vga-black text-[9px] px-2 py-1 border-2 border-vga-black font-mono"
          />
          <span className="text-vga-blue text-[8px] font-bold shrink-0">{n}/{MAX_TEAMS}</span>
        </div>

        <div className="overflow-y-auto" style={{ maxHeight: '360px' }}>
          {isSearching ? (
            <div className="grid grid-cols-2 gap-2">
              {filteredFlat!.map(renderTeamButton)}
              {filteredFlat!.length === 0 && (
                <span className="col-span-2 text-vga-black text-[8px] opacity-60 p-2">Sin resultados.</span>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {sortedCountries.map(([country, countryTeams]) => {
                const label = COUNTRY_LABELS[country] ?? country.toUpperCase();
                const open = openCountries.has(country);
                return (
                  <div key={country}>
                    <button
                      onClick={() => toggleCountry(country)}
                      className="w-full flex items-center justify-between bg-vga-blue border border-vga-white px-3 py-1.5 hover:bg-vga-cyan hover:text-vga-black text-left"
                    >
                      <span className="text-vga-yellow text-[9px] font-bold">{label}</span>
                      <span className="text-vga-gray text-[7px]">{countryTeams.length} equipos  {open ? '▲' : '▼'}</span>
                    </button>
                    {open && (
                      <div className="grid grid-cols-2 gap-2 mt-1 pl-2">
                        {countryTeams.map(renderTeamButton)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="border-t-2 border-vga-blue pt-3 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="flex gap-4">
              <span className="text-vga-blue text-[9px] font-bold uppercase">{n} equipos</span>
              {n >= 2 && (
                <>
                  <span className="text-vga-black text-[9px]">→ {jornadas} jornadas</span>
                  <span className="text-vga-black text-[9px]">→ {partidos} partidos</span>
                </>
              )}
            </div>
            {!canConfirm && (
              <span className="text-vga-red text-[8px]">
                {n < MIN_TEAMS ? `Mínimo ${MIN_TEAMS}` : `Máximo ${MAX_TEAMS}`}
              </span>
            )}
          </div>
          {selectedNames.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {selectedNames.map(name => (
                <span key={name} className="bg-vga-blue text-vga-bright-white text-[7px] px-1.5 py-0.5 font-bold uppercase">{name}</span>
              ))}
            </div>
          )}
        </div>

        <div className="border-t-2 border-vga-blue pt-3 flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <span className="text-vga-black text-[8px] uppercase font-bold">Packs importados</span>
            <button onClick={() => fileRef.current?.click()} className="bg-vga-blue text-vga-bright-white px-3 py-1 text-[8px] border border-vga-black hover:opacity-80">
              IMPORTAR PACK
            </button>
            <input ref={fileRef} type="file" accept=".ofb,.json" onChange={handleImport} className="hidden" />
          </div>
          {importError && <span className="text-vga-red text-[8px]">{importError}</span>}
          {importedPacks.length === 0 ? (
            <span className="text-vga-black text-[7px] opacity-60">Ninguno — usa los datos oficiales</span>
          ) : (
            <ul className="flex flex-col gap-1">
              {importedPacks.map((p, i) => <li key={i} className="text-vga-black text-[8px]">+ {p}</li>)}
              {extraPlayers.length > 0 && (
                <li className="text-vga-blue text-[7px]">{extraPlayers.length} jugadores extra en agentes libres</li>
              )}
            </ul>
          )}
        </div>
      </div>

      <button
        onClick={() => canConfirm && onConfirm(Array.from(selected), extraPlayers, importedRawTeams)}
        disabled={!canConfirm}
        className="bg-vga-green hover:bg-vga-light-green disabled:bg-vga-gray disabled:text-vga-black disabled:cursor-not-allowed text-vga-bright-white py-3 border-b-4 border-r-4 border-vga-black active:border-0 text-[10px] font-bold uppercase tracking-wider"
      >
        CONFIRMAR LIGA
      </button>
    </div>
  );
};
