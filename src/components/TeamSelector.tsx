import { useState } from 'react';
import type { TeamTemplate } from '../data/mockTeams';
import { getTeamCountry } from '../data/mockTeams';
import { TeamCrest } from './TeamCrest';
import { CountryBadge } from './CountryBadge';
import { useT as useTranslation } from '../i18n';

interface Props {
  templates: TeamTemplate[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  maxTeams: number;
  editorIds?: Set<string>;
  importedIds?: Set<string>;
  maxHeight?: string;
}

const resolveCountry = (t: TeamTemplate, isEditor: boolean, isImported: boolean): string => {
  if (isEditor || isImported) return 'editor';
  if (t.country && t.country !== 'unknown' && t.country !== 'other') return t.country;
  return getTeamCountry(t.id);
};

export const TeamSelector = ({
  templates,
  selected,
  onToggle,
  maxTeams,
  editorIds,
  importedIds,
  maxHeight = '480px',
}: Props) => {
  const tr = useTranslation();
  const [search, setSearch] = useState('');
  const [openCountries, setOpenCountries] = useState<Set<string>>(new Set());

  const toggleCountry = (c: string) =>
    setOpenCountries(prev => { const n = new Set(prev); n.has(c) ? n.delete(c) : n.add(c); return n; });

  const isSearching = search.trim().length > 0;
  const filteredFlat = isSearching
    ? templates.filter(t => t.name.toLowerCase().includes(search.trim().toLowerCase()))
    : null;

  const byCountry = new Map<string, TeamTemplate[]>();
  for (const t of templates) {
    const isEditor = editorIds?.has(t.id) ?? false;
    const isImported = importedIds?.has(t.id) ?? false;
    const country = resolveCountry(t, isEditor, isImported);
    const bucket = byCountry.get(country) ?? [];
    bucket.push(t);
    byCountry.set(country, bucket);
  }
  const sortedCountries = Array.from(byCountry.entries()).sort((a, b) => b[1].length - a[1].length);

  const renderTeamButton = (t: TeamTemplate) => {
    const active = selected.has(t.id);
    const isImported = importedIds?.has(t.id) ?? false;
    const isEditor = editorIds?.has(t.id) ?? false;
    const accent = isImported ? 'text-vga-cyan' : isEditor ? 'text-vga-magenta' : 'text-vga-gray';
    const borderActive = isImported ? 'border-vga-cyan' : isEditor ? 'border-vga-magenta' : 'border-vga-light-green';
    return (
      <button
        key={t.id}
        onClick={() => onToggle(t.id)}
        className={`flex flex-col items-center gap-2 p-3 border-2 text-center transition-colors group ${
          active ? `${borderActive} border-4 bg-vga-blue shadow-[0_0_0_2px_rgba(255,255,255,0.3)]` : 'border-vga-gray bg-vga-black hover:border-vga-white hover:bg-vga-blue'
        }`}
      >
        <TeamCrest colors={t.colors ?? ['#888', '#888', '#888']} size="lg" title={t.name} teamId={t.id} />
        <span className="text-vga-bright-white text-[9px] font-bold uppercase leading-tight">{t.name}</span>
        <span className={`text-[7px] ${accent}`}>{t.playerCount} {tr('setup.playersShort')}</span>
        <span className={`text-[10px] font-bold ${active ? 'text-vga-light-green' : 'text-vga-gray'}`}>
          {active ? '✓' : '○'}
        </span>
      </button>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={tr('placeholder.searchTeam')}
          className="flex-1 bg-vga-bright-white text-vga-black text-[9px] px-2 py-1 border-2 border-vga-black font-mono"
        />
        <span className="text-vga-blue text-[8px] font-bold shrink-0">{selected.size}/{maxTeams}</span>
      </div>

      <div className="overflow-y-auto" style={{ maxHeight }}>
        {isSearching ? (
          <div className="grid grid-cols-3 gap-2">
            {filteredFlat!.map(renderTeamButton)}
            {filteredFlat!.length === 0 && (
              <span className="col-span-2 text-vga-black text-[8px] opacity-60 p-2">{tr('misc.noResults')}</span>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {sortedCountries.map(([country, countryTeams]) => {
              const open = openCountries.has(country);
              return (
                <div key={country}>
                  <button
                    onClick={() => toggleCountry(country)}
                    className="w-full flex items-center justify-between bg-vga-blue border border-vga-white px-3 py-1.5 hover:bg-vga-cyan hover:text-vga-black text-left"
                  >
                    <span className="text-vga-yellow text-[9px] font-bold">
                      <CountryBadge code={country} size="lg" />
                    </span>
                    <span className="text-vga-gray text-[7px]">{tr('setup.teamsCount', { n: String(countryTeams.length) })}  {open ? '▲' : '▼'}</span>
                  </button>
                  {open && (
                    <div className="grid grid-cols-3 gap-2 mt-1 pl-2">
                      {countryTeams.map(renderTeamButton)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
