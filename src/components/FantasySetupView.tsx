import { useState } from 'react';
import type { Team } from '../types/game.d.ts';
import { getTeamTemplatesForYear, type TeamTemplate } from '../data/mockTeams';
import { TeamCrest } from './TeamCrest';
import { useT as useTranslation } from '../i18n';

interface Props {
  availableYears: number[];
  existingTeams: Team[];
  onConfirm: (year: number, teamIds: string[], userTeamId: string, cap: number | null) => void;
  onBack: () => void;
  onOpenEditor: () => void;
}

const MAX_TEAMS = 20;

import { CountryBadge } from './CountryBadge';

const CAP_LIMIT = 1350;

export const FantasySetupView = ({ availableYears, existingTeams, onConfirm, onBack, onOpenEditor }: Props) => {
  const tr = useTranslation();
  const [year, setYear] = useState<number | null>(null);

  if (availableYears.length === 0) {
    return (
      <div className="w-full max-w-2xl flex flex-col gap-6 animate-in fade-in duration-500">
        <div className="bg-vga-blue p-4 border-4 border-vga-white shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
          <h2 className="text-vga-yellow text-center mb-4 text-sm underline decoration-double">
            {tr('setup.fantasyTitle')}
          </h2>
          <div className="bg-vga-black border border-vga-red p-3 text-[8px] text-vga-light-red leading-relaxed text-center">
            Modo Fantasy no disponible — requiere base de datos clásica.
          </div>
        </div>
        <button
          onClick={onBack}
          className="bg-vga-black border-2 border-vga-gray hover:border-vga-light-green p-2 text-[8px] text-vga-gray hover:text-vga-bright-white text-center transition-colors"
        >
          {tr('btn.back')}
        </button>
      </div>
    );
  }
  const [mode, setMode] = useState<'libre' | 'cap'>('libre');
  const [selected, setSelected] = useState<string[]>([]);
  const [userTeamId, setUserTeamId] = useState<string>('');
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());

  if (!year) {
    return (
      <div className="w-full max-w-2xl flex flex-col gap-6 animate-in fade-in duration-500">
        <div className="bg-vga-blue p-4 border-4 border-vga-white shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
          <h2 className="text-vga-yellow text-center mb-2 text-sm underline decoration-double">
            {tr('setup.fantasyTitle')}
          </h2>
          <div className="bg-vga-black border border-vga-gray p-3 mb-4 text-[8px] text-vga-cyan leading-relaxed">
            {tr('setup.fantasySubtitle')}
          </div>
          <h3 className="text-vga-yellow text-[8px] mb-3 uppercase">{tr('setup.selectSeason')}</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {availableYears.map((y) => (
              <button
                key={y}
                onClick={() => setYear(y)}
                className="bg-vga-black border-2 border-vga-gray p-3 hover:border-vga-light-green cursor-pointer text-center transition-colors"
              >
                <span className="text-vga-bright-white text-xs hover:text-vga-light-green">
                  {y}/{(y + 1).toString().slice(-2)}
                </span>
              </button>
            ))}
          </div>
        </div>
        <button
          onClick={onBack}
          className="bg-vga-black border-2 border-vga-gray hover:border-vga-light-green p-2 text-[8px] text-vga-gray hover:text-vga-bright-white text-center transition-colors"
        >
          {tr('btn.back')}
        </button>
      </div>
    );
  }

  const dbTemplates = getTeamTemplatesForYear(year);
  const editorTeamIds = new Set(dbTemplates.map(t => t.id));
  const editorTeams = existingTeams.filter(t => !editorTeamIds.has(t.id));

  const toggle = (id: string) => {
    setSelected(prev => {
      if (prev.includes(id)) {
        const next = prev.filter(x => x !== id);
        if (userTeamId === id) setUserTeamId('');
        return next;
      }
      if (prev.length >= MAX_TEAMS) return prev;
      return [...prev, id];
    });
  };

  const toggleGroup = (group: string) => {
    setOpenGroups(prev => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group); else next.add(group);
      return next;
    });
  };

  // Group unselected DB teams by country
  const unselectedDb = dbTemplates.filter(t => !selected.includes(t.id));
  const byCountry = new Map<string, TeamTemplate[]>();
  for (const t of unselectedDb) {
    const c = t.country || 'unknown';
    if (!byCountry.has(c)) byCountry.set(c, []);
    byCountry.get(c)!.push(t);
  }
  const sortedCountries = [...byCountry.keys()].sort();
  const unselectedEditor = editorTeams.filter(t => !selected.includes(t.id));

  const canStart = selected.length >= 2 && userTeamId !== '';
  const atMax = selected.length >= MAX_TEAMS;

  const teamRow = (id: string, colors: string[] | undefined, name: string) => (
    <div
      key={id}
      className="bg-vga-black border border-vga-gray p-2 flex items-center gap-2 hover:border-vga-gray"
    >
      <TeamCrest colors={colors} size="sm" title={name} />
      <span className="text-vga-bright-white text-[9px] flex-1 min-w-0 truncate">{name}</span>
      <button
        onClick={() => toggle(id)}
        disabled={atMax}
        className={`text-[8px] px-3 py-0.5 border shrink-0 ${atMax ? 'bg-vga-gray text-vga-black opacity-50 cursor-not-allowed border-vga-gray' : 'bg-vga-gray text-vga-black border-vga-white hover:bg-vga-white'}`}
      >
        {tr('setup.addTeam')}
      </button>
    </div>
  );

  return (
    <div className="w-full max-w-2xl flex flex-col gap-6 animate-in fade-in duration-500">
      <div className="bg-vga-blue p-4 border-4 border-vga-white shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-vga-yellow text-sm underline decoration-double">
            {tr('setup.fantasyHeader', { year: String(year), yy: (year + 1).toString().slice(-2) })}
          </h2>
          <button
            onClick={() => { setYear(null); setSelected([]); setUserTeamId(''); setOpenGroups(new Set()); }}
            className="text-[8px] bg-vga-gray text-vga-black px-2 py-1 border border-vga-white hover:bg-vga-red hover:text-vga-bright-white"
          >
            {tr('setup.changeYear')}
          </button>
        </div>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[8px] text-vga-cyan flex-1">{tr('setup.teamsSelected', { n: String(selected.length), max: String(MAX_TEAMS) })}</span>
        </div>
        <div className="flex gap-2 mb-3">
          <button
            onClick={() => setMode('libre')}
            className={`flex-1 px-3 py-1.5 border text-[8px] font-bold transition-colors ${mode === 'libre' ? 'bg-vga-green text-vga-black border-vga-light-green' : 'bg-vga-black text-vga-gray border-vga-gray hover:border-vga-white hover:text-vga-bright-white'}`}
          >
            {tr('setup.modeFree')}
          </button>
          <button
            onClick={() => setMode('cap')}
            className={`flex-1 px-3 py-1.5 border text-[8px] font-bold transition-colors ${mode === 'cap' ? 'bg-vga-cyan text-vga-black border-vga-cyan' : 'bg-vga-black text-vga-gray border-vga-gray hover:border-vga-white hover:text-vga-bright-white'}`}
          >
            {tr('setup.modeCap', { cap: String(CAP_LIMIT) })}
          </button>
        </div>
        {mode === 'cap' && (
          <div className="bg-vga-black border border-vga-cyan p-2 mb-3 text-[7px] text-vga-cyan leading-relaxed">
            {tr('setup.capDescFull', { cap: String(CAP_LIMIT) })}
          </div>
        )}

        {/* Selected teams — always visible */}
        {selected.length > 0 && (
          <div className="mb-4">
            <div className="text-[7px] text-vga-gray uppercase mb-2">{tr('setup.yourSelection')}</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {[...dbTemplates, ...editorTeams].filter(t => selected.includes(t.id)).map(t => {
                const isUser = userTeamId === t.id;
                return (
                  <div key={t.id} className="bg-vga-black border-2 border-vga-yellow p-2 flex items-center gap-2">
                    <TeamCrest colors={t.colors} size="sm" title={t.name} teamId={t.id} />
                    <span className="text-vga-bright-white text-[9px] flex-1 min-w-0 truncate">{t.name}</span>
                    <button
                      onClick={() => setUserTeamId(isUser ? '' : t.id)}
                      className={`text-[8px] px-2 py-0.5 border font-bold shrink-0 ${isUser ? 'bg-vga-cyan text-vga-black border-vga-cyan' : 'bg-vga-black text-vga-cyan border-vga-cyan hover:bg-vga-cyan hover:text-vga-black'}`}
                    >
                      {isUser ? tr('setup.meActive') : tr('setup.meInactive')}
                    </button>
                    <button
                      onClick={() => toggle(t.id)}
                      className="text-[8px] px-2 py-0.5 border bg-vga-gray text-vga-black border-vga-white hover:bg-vga-red hover:text-vga-bright-white shrink-0"
                    >
                      ×
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Country-grouped pool — all collapsed by default */}
        <div className="flex flex-col gap-1 mb-4">
          {sortedCountries.map(c => {
            const teams = byCountry.get(c)!;
            const open = openGroups.has(c);
            return (
              <div key={c} className="border border-vga-gray">
                <button
                  onClick={() => toggleGroup(c)}
                  className="w-full flex justify-between items-center px-2 py-1 bg-vga-black text-[8px] text-vga-gray hover:text-vga-bright-white hover:bg-vga-blue"
                >
                  <span className="font-bold"><CountryBadge code={c} size="lg" /></span>
                  <span className="flex items-center gap-2">
                    <span className="text-[7px] opacity-60">{tr('setup.teamsCount', { n: String(teams.length) })}</span>
                    <span>{open ? '−' : '+'}</span>
                  </span>
                </button>
                {open && (
                  <div className="flex flex-col gap-1 p-1 border-t border-vga-gray bg-vga-black">
                    {teams.map(t => teamRow(t.id, t.colors, t.name))}
                  </div>
                )}
              </div>
            );
          })}

          {unselectedEditor.length > 0 && (
            <div className="border border-vga-gray">
              <button
                onClick={() => toggleGroup('__editor')}
                className="w-full flex justify-between items-center px-2 py-1 bg-vga-black text-[8px] text-vga-gray hover:text-vga-bright-white hover:bg-vga-blue"
              >
                <span className="font-bold">{tr('setup.customTeams')}</span>
                <span className="flex items-center gap-2">
                  <span className="text-[7px] opacity-60">{tr('setup.teamsCount', { n: String(unselectedEditor.length) })}</span>
                  <span>{openGroups.has('__editor') ? '−' : '+'}</span>
                </span>
              </button>
              {openGroups.has('__editor') && (
                <div className="flex flex-col gap-1 p-1 border-t border-vga-gray bg-vga-black">
                  {unselectedEditor.map(t => teamRow(t.id, t.colors, t.name))}
                </div>
              )}
            </div>
          )}

          {unselectedDb.length === 0 && unselectedEditor.length === 0 && (
            <div className="text-[8px] text-vga-gray text-center py-2">{tr('setup.allTeamsSelected')}</div>
          )}
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={onOpenEditor}
          className="bg-vga-black border-2 border-vga-gray hover:border-vga-white p-2 text-[8px] text-vga-gray hover:text-vga-bright-white transition-colors px-4"
        >
          EDITOR
        </button>
        <button
          onClick={onBack}
          className="bg-vga-black border-2 border-vga-gray hover:border-vga-white p-2 text-[8px] text-vga-gray hover:text-vga-bright-white transition-colors px-4"
        >
          {tr('btn.back')}
        </button>
        <button
          disabled={!canStart}
          onClick={() => canStart && onConfirm(year, selected, userTeamId, mode === 'cap' ? CAP_LIMIT : null)}
          className={`flex-1 p-2 text-[8px] border-2 font-bold transition-colors ${canStart ? 'bg-vga-green text-vga-bright-white border-vga-light-green hover:bg-vga-light-green cursor-pointer' : 'bg-vga-black text-vga-gray border-vga-gray cursor-not-allowed'}`}
        >
          {tr('setup.startDraft')}
        </button>
      </div>

      {!canStart && (
        <div className="bg-vga-magenta p-2 text-[8px] text-vga-bright-white text-center border-2 border-vga-white">
          {selected.length < 2 ? tr('setup.needMore') : tr('setup.setUserTeam')}
        </div>
      )}
    </div>
  );
};
