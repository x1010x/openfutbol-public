import { useState } from 'react';
import type { Team } from '../types/game.d.ts';
import type { YearStats } from '../data/mockTeams';
import { getTeamCountry } from '../data/mockTeams';
import { calculateTeamStrength } from '../engine/simEngine';
import { TeamCrest } from './TeamCrest';
import { CountryBadge } from './CountryBadge';
import { useT } from '../i18n';

interface Props {
  teams: Team[];
  selectedYear: number | null;
  availableYears: number[];
  yearStats: YearStats[];
  onSelectYear: (year: number) => void;
  onSelect: (teamId: string) => void;
  onBack: () => void;
}

export const TeamSelection = ({ teams, selectedYear, yearStats, onSelectYear, onSelect, onBack }: Props) => {
  const t = useT();
  const [openCountries, setOpenCountries] = useState<Set<string>>(new Set());

  const toggleCountry = (c: string) =>
    setOpenCountries(prev => {
      const n = new Set(prev);
      n.has(c) ? n.delete(c) : n.add(c);
      return n;
    });

  if (!selectedYear) {
    return (
      <div className="w-full max-w-2xl flex flex-col gap-6 animate-in fade-in duration-500">
        <div className="bg-vga-blue p-4 border-4 border-vga-white shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-vga-yellow text-sm underline decoration-double">
              {t('setup.selectSeason')}
            </h2>
            <button
              onClick={onBack}
              className="text-[8px] bg-vga-gray text-vga-black px-2 py-1 border border-vga-white hover:bg-vga-red hover:text-vga-bright-white"
            >
              {t('btn.back')}
            </button>
          </div>

          <div className="flex flex-col gap-2 max-h-[480px] overflow-y-auto pr-1">
            {yearStats.map(({ year, teams: tc, leagues: l, players: p }) => (
              <button
                key={year}
                onClick={() => onSelectYear(year)}
                className="bg-vga-black border-2 border-vga-gray px-3 py-2 hover:border-vga-light-green cursor-pointer text-left transition-colors flex flex-col gap-1"
              >
                <span className="text-vga-bright-white text-xs">
                  {year}/{(year + 1).toString().slice(-2)}
                </span>
                <span className="text-[7px] text-vga-gray">
                  <span className="text-vga-yellow">{t('setup.teamsCount', { n: String(tc) })}</span>
                  {'  ·  '}
                  <span className="text-vga-cyan">{l} {t('setup.leagues')}</span>
                  {'  ·  '}
                  {p.toLocaleString()} {t('setup.playersShort')}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="bg-vga-magenta p-2 text-[8px] text-vga-bright-white text-center border-2 border-vga-white">
          {t('setup.seasonHint')}
        </div>
      </div>
    );
  }

  const byCountry = new Map<string, Team[]>();
  for (const team of teams) {
    const c = getTeamCountry(team.id);
    const bucket = byCountry.get(c) ?? [];
    bucket.push(team);
    byCountry.set(c, bucket);
  }
  const sortedCountries = Array.from(byCountry.entries()).sort((a, b) => b[1].length - a[1].length);

  return (
    <div className="w-full max-w-2xl flex flex-col gap-6 animate-in fade-in duration-500">
      <div className="bg-vga-blue p-4 border-4 border-vga-white shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-vga-yellow text-sm underline decoration-double">
            {t('setup.selectClub', { year: String(selectedYear), yy: (selectedYear + 1).toString().slice(-2) })}
          </h2>
          <button
            onClick={() => onSelectYear(0)}
            className="text-[8px] bg-vga-gray text-vga-black px-2 py-1 border border-vga-white hover:bg-vga-red hover:text-vga-bright-white"
          >
            {t('setup.changeSeason')}
          </button>
        </div>

        <div className="flex flex-col gap-2 max-h-[520px] overflow-y-auto pr-1">
          {sortedCountries.map(([country, countryTeams]) => {
            const open = openCountries.has(country);
            return (
              <div key={country}>
                <button
                  onClick={() => toggleCountry(country)}
                  className="w-full flex items-center justify-between bg-vga-blue border border-vga-white px-3 py-2 hover:bg-vga-cyan hover:text-vga-black text-left"
                >
                  <span className="text-vga-yellow text-[9px] font-bold">
                    <CountryBadge code={country} size="lg" />
                  </span>
                  <span className="text-vga-gray text-[7px]">{t('setup.teamsCount', { n: String(countryTeams.length) })}  {open ? '▲' : '▼'}</span>
                </button>
                {open && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-1 pl-2">
                    {countryTeams.map((team) => {
                      const strength = Math.floor(calculateTeamStrength(team));
                      const star = team.players.reduce((best, p) => (p.media > best.media ? p : best), team.players[0]);
                      return (
                        <div
                          key={team.id}
                          className="bg-vga-black border-2 border-vga-gray p-3 hover:border-vga-light-green cursor-pointer group transition-colors"
                          onClick={() => onSelect(team.id)}
                        >
                          <div className="flex flex-col items-center gap-2">
                            <TeamCrest colors={team.colors} size="xl" title={team.name} teamId={team.id} />
                            <div className="flex justify-between items-center w-full">
                              <span className="text-vga-bright-white text-xs group-hover:text-vga-light-green truncate">{team.name}</span>
                              <span className="text-[8px] bg-vga-blue px-2 text-vga-yellow shrink-0">STR: {strength}</span>
                            </div>
                            <div className="flex items-center gap-1 text-[7px] self-start">
                              <span className="text-vga-cyan">{t('setup.starLabel')}</span>
                              <span className="text-vga-white">{star?.name ?? '—'} ({star?.media ?? 0})</span>
                            </div>
                          </div>
                          <button className="w-full mt-3 bg-vga-gray group-hover:bg-vga-green text-[8px] py-1 text-vga-bright-white border border-vga-white">
                            {t('setup.chooseTeam')}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-vga-magenta p-2 text-[8px] text-vga-bright-white text-center border-2 border-vga-white">
        {t('setup.successHint')}
      </div>
    </div>
  );
};
