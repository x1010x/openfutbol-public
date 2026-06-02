import { useState, useRef, useMemo } from 'react';
import type { RawPlayerDB, RawTeamDB } from '../types/game.d.ts';
import type { Team } from '../types/game.d.ts';
import { getTeamTemplatesForYear, type TeamTemplate } from '../data/mockTeams';
import { loadLegacyPackFromFile as loadPackFromFile } from '../data/packLoader';
import { getPackTemplates } from '../data/packTeamBuilder';
import { usePack } from '../state/PackContext';
import { TeamSelector } from './TeamSelector';
import { useT as useTranslation } from '../i18n';

interface Props {
  year: number;
  existingTeams?: Team[];
  onConfirm: (selectedTeamIds: string[], extraPlayers: RawPlayerDB[], importedTeams: RawTeamDB[]) => void;
  onBack: () => void;
}

const MIN_TEAMS = 4;
const MAX_TEAMS = 24;

export const LeagueSetupView = ({ year, existingTeams, onConfirm, onBack }: Props) => {
  const tr = useTranslation();
  const { pack } = usePack();

  const packTemplates = useMemo((): TeamTemplate[] => {
    if (!pack) return [];
    return getPackTemplates(pack).map(pt => ({
      id: pt.clubId,
      name: pt.name,
      colors: pt.colors ? [pt.colors.background, pt.colors.foreground] : undefined,
      playerCount: pt.playerCount,
      country: pt.countryCode || 'unknown',
    }));
  }, [pack]);

  const legacyTemplates = getTeamTemplatesForYear(year);
  const templates = packTemplates.length > 0 ? packTemplates : legacyTemplates;
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
  const fileRef = useRef<HTMLInputElement>(null);

  const n = selected.size;
  const jornadas = n >= 2 ? 2 * (n - 1) : 0;
  const partidos = n >= 2 ? n * (n - 1) : 0;
  const canConfirm = n >= MIN_TEAMS && n <= MAX_TEAMS;

  const toggle = (id: string) =>
    setSelected(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });

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

  const editorIds = new Set(editorTemplates.map(t => t.id));
  const importedIds = new Set(importedTemplates.map(t => t.id));

  return (
    <div className="w-full max-w-2xl flex flex-col gap-4 animate-in fade-in duration-300">
      <div className="bg-vga-blue p-2 border-2 border-vga-white flex justify-between items-center vga-panel">
        <h2 className="text-vga-yellow text-xs uppercase font-bold">
          {tr('setup.leagueTitle', { year: String(year), yy: (year + 1).toString().slice(-2) })}
        </h2>
        <button onClick={onBack} className="bg-vga-red text-vga-bright-white px-3 py-1 text-[8px] border border-vga-black hover:bg-vga-light-red">
          {tr('btn.back')}
        </button>
      </div>

      <div className="bg-vga-gray border-4 border-vga-blue p-4 flex flex-col gap-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
        <TeamSelector
          templates={allTemplates}
          selected={selected}
          onToggle={toggle}
          maxTeams={MAX_TEAMS}
          editorIds={editorIds}
          importedIds={importedIds}
        />

        <div className="border-t-2 border-vga-blue pt-3 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="flex gap-4">
              <span className="text-vga-blue text-[9px] font-bold uppercase">{tr('setup.teamsCount', { n: String(n) })}</span>
              {n >= 2 && (
                <>
                  <span className="text-vga-black text-[9px]">→ {tr('setup.roundsCount', { n: String(jornadas) })}</span>
                  <span className="text-vga-black text-[9px]">→ {tr('setup.matchesCount', { n: String(partidos) })}</span>
                </>
              )}
            </div>
            {!canConfirm && (
              <span className="text-vga-red text-[8px]">
                {n < MIN_TEAMS ? tr('setup.minTeams', { n: String(MIN_TEAMS) }) : tr('setup.maxTeams', { n: String(MAX_TEAMS) })}
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
            <span className="text-vga-black text-[8px] uppercase font-bold">{tr('setup.importedPacks')}</span>
            <button onClick={() => fileRef.current?.click()} className="bg-vga-blue text-vga-bright-white px-3 py-1 text-[8px] border border-vga-black hover:opacity-80">
              {tr('setup.importPack')}
            </button>
            <input ref={fileRef} type="file" accept=".ofb,.json" onChange={handleImport} className="hidden" />
          </div>
          {importError && <span className="text-vga-red text-[8px]">{importError}</span>}
          {importedPacks.length === 0 ? (
            <span className="text-vga-black text-[7px] opacity-60">{tr('setup.noPacks')}</span>
          ) : (
            <ul className="flex flex-col gap-1">
              {importedPacks.map((p, i) => <li key={i} className="text-vga-black text-[8px]">+ {p}</li>)}
              {extraPlayers.length > 0 && (
                <li className="text-vga-blue text-[7px]">{tr('setup.extraPlayers', { n: String(extraPlayers.length) })}</li>
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
        {tr('setup.confirmLeague')}
      </button>
    </div>
  );
};
