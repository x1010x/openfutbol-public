import { useState } from 'react';
import type { Team } from '../types/game.d.ts';
import type { ManagerSeasonRecord } from '../store/leagueStore';
import type { BoardObjective } from '../engine/florentinometro';
import { teamsOfferingJobs, computeCareerRating, computeBoardObjective } from '../engine/florentinometro';
import { calculateTeamStrength } from '../engine/simEngine';
import { TeamCrest } from './TeamCrest';
import { formatEuros } from '../data/economy';
import { useT } from '../i18n';

const MAX_OFFERS = 10;

const OBJ_KEYS: Record<BoardObjective, string> = {
  win_league: 'florentino.obj.win_league',
  top_4: 'florentino.obj.top_4',
  top_half: 'florentino.obj.top_half',
  avoid_relegation: 'florentino.obj.avoid_relegation',
};

interface Props {
  teams: Team[];
  managerName: string;
  managerCareer: ManagerSeasonRecord[];
  currentMeter: number;
  yearStats: { year: number; teams: number; leagues: number; players: number }[];
  selectedYear: number | null;
  onSelectYear: (year: number) => void;
  onSelectTeam: (teamId: string, name: string) => void;
  onBack: () => void;
}

export const ProManagerSetupView = ({
  teams,
  managerName: initialName,
  managerCareer,
  currentMeter,
  yearStats,
  selectedYear,
  onSelectYear,
  onSelectTeam,
  onBack,
}: Props) => {
  const t = useT();
  const [name, setName] = useState(initialName);
  const [expanded, setExpanded] = useState<string | null>(null);

  const careerRating = computeCareerRating(managerCareer, currentMeter);
  const allOffers = teamsOfferingJobs(teams, '', careerRating);

  // Year / name selection screen
  if (!selectedYear) {
    return (
      <div className="w-full max-w-2xl flex flex-col gap-6 animate-in fade-in duration-500">
        <div className="bg-vga-black p-4 border-4 border-vga-magenta shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-vga-magenta text-sm underline decoration-double uppercase">
              {t('promanager.title')}
            </h2>
            <button
              onClick={onBack}
              className="text-[8px] bg-vga-gray text-vga-black px-2 py-1 border border-vga-white hover:bg-vga-red hover:text-vga-bright-white"
            >
              {t('btn.back')}
            </button>
          </div>

          <div className="flex flex-col gap-4 mb-6">
            <div>
              <label className="block text-vga-cyan text-[8px] uppercase mb-1">{t('promanager.nameLabel')}</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder={t('promanager.namePlaceholder')}
                className="w-full bg-vga-blue border-2 border-vga-white text-vga-bright-white px-3 py-2 text-[10px] font-mono outline-none focus:border-vga-cyan"
                maxLength={30}
              />
            </div>
            <p className="text-vga-gray text-[7px]">{t('promanager.hint')}</p>
          </div>

          <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto pr-1">
            {yearStats.map(({ year, teams: tc, leagues: l, players: p }) => (
              <button
                key={year}
                onClick={() => { if (name.trim()) onSelectYear(year); }}
                disabled={!name.trim()}
                className={`bg-vga-black border-2 px-3 py-2 text-left transition-colors flex flex-col gap-1 ${name.trim() ? 'border-vga-gray hover:border-vga-magenta cursor-pointer' : 'border-vga-gray opacity-50 cursor-not-allowed'}`}
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
          {t('promanager.hint')}
        </div>
      </div>
    );
  }

  // Team offer list — sorted strongest first, capped at MAX_OFFERS
  const sortedOffers = [...allOffers]
    .sort((a, b) => calculateTeamStrength(b) - calculateTeamStrength(a))
    .slice(0, MAX_OFFERS);

  return (
    <div className="w-full max-w-2xl flex flex-col gap-4 animate-in fade-in duration-500">
      <div className="bg-vga-black border-4 border-vga-magenta p-4">
        <div className="flex justify-between items-center mb-3">
          <div>
            <h2 className="text-vga-magenta text-sm uppercase font-bold">{t('promanager.offers')}</h2>
            <p className="text-vga-bright-white text-[8px] mt-1">
              {name} · {t('promanager.offersCount', { n: String(sortedOffers.length) })}
            </p>
          </div>
          <button
            onClick={() => onSelectYear(0)}
            className="text-[8px] bg-vga-gray text-vga-black px-2 py-1 border border-vga-white hover:bg-vga-red hover:text-vga-bright-white"
          >
            {t('btn.back')}
          </button>
        </div>

        {/* Manager reputation bar */}
        <div className="bg-vga-blue border border-vga-white px-3 py-2 mb-3 flex items-center gap-3">
          <span className="text-vga-gray text-[7px] uppercase shrink-0">{t('promanager.reputation')}</span>
          <div className="flex-1 bg-vga-black h-2 border border-vga-gray">
            <div
              className={`h-full ${careerRating >= 7 ? 'bg-vga-light-green' : careerRating >= 5 ? 'bg-vga-yellow' : 'bg-vga-light-red'}`}
              style={{ width: `${(careerRating / 10) * 100}%` }}
            />
          </div>
          <span className={`text-[8px] font-bold shrink-0 ${careerRating >= 7 ? 'text-vga-light-green' : careerRating >= 5 ? 'text-vga-yellow' : 'text-vga-light-red'}`}>
            {careerRating.toFixed(1)}
          </span>
          {managerCareer.length === 0 && (
            <span className="text-vga-gray text-[6px] shrink-0">({t('promanager.rookie')})</span>
          )}
        </div>

        {sortedOffers.length === 0 && (
          <p className="text-vga-gray text-[8px] text-center py-6">{t('promanager.noOffers')}</p>
        )}

        <div className="flex flex-col gap-3 max-h-[600px] overflow-y-auto pr-1">
          {sortedOffers.map((team) => {
            const strength = Math.floor(calculateTeamStrength(team));
            const isOpen = expanded === team.id;
            const objective = computeBoardObjective(team, teams);
            const objColor =
              objective === 'win_league' ? 'text-vga-yellow' :
              objective === 'top_4' ? 'text-vga-light-green' :
              objective === 'top_half' ? 'text-vga-cyan' :
              'text-vga-gray';

            const byMedia = [...team.players].sort((a, b) => b.media - a.media);
            const top5 = byMedia.slice(0, 5);
            const star = byMedia[0] ?? null;

            const budgetColor =
              team.budget < 0 ? 'text-vga-light-red' :
              team.budget < 1_000_000 ? 'text-vga-yellow' :
              'text-vga-light-green';

            const posLabel: Record<string, string> = {
              POR: 'GK', DEF: 'DEF', MED: 'MID', DEL: 'FWD', AML: 'LW', AMR: 'RW',
            };

            return (
              <div key={team.id} className={`border-2 transition-colors ${isOpen ? 'border-vga-magenta' : 'border-vga-gray hover:border-vga-cyan'}`}>
                {/* Header row — always visible */}
                <div className="bg-vga-blue p-3 flex items-center gap-3">
                  <TeamCrest colors={team.colors} size="lg" title={team.name} teamId={team.id} />
                  <div className="flex-1 min-w-0">
                    <p className="text-vga-bright-white text-[10px] font-bold truncate">{team.name}</p>
                    <div className="flex gap-3 mt-0.5 flex-wrap">
                      <span className="text-vga-yellow text-[7px]">STR {strength}</span>
                      {star && <span className="text-vga-cyan text-[7px] truncate">★ {star.name} ({star.media})</span>}
                      <span className={`text-[7px] ${budgetColor}`}>{formatEuros(team.budget)}</span>
                      <span className={`text-[7px] font-bold uppercase ${objColor}`}>
                        {t('promanager.objPrefix')}: {t(OBJ_KEYS[objective])}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => setExpanded(isOpen ? null : team.id)}
                      className={`text-[7px] px-2 py-1 border font-bold uppercase ${isOpen ? 'bg-vga-cyan text-vga-black border-vga-cyan' : 'bg-vga-black text-vga-cyan border-vga-cyan hover:bg-vga-cyan hover:text-vga-black'}`}
                    >
                      {isOpen ? `▲ ${t('promanager.less')}` : `▼ ${t('promanager.moreInfo')}`}
                    </button>
                    <button
                      onClick={() => onSelectTeam(team.id, name.trim())}
                      className="bg-vga-magenta hover:bg-vga-light-red text-vga-bright-white text-[8px] px-3 py-1 border border-vga-white font-bold uppercase"
                    >
                      {t('promanager.accept')}
                    </button>
                  </div>
                </div>

                {/* Expanded details */}
                {isOpen && (
                  <div className="bg-vga-black p-3 border-t border-vga-gray flex flex-col gap-3">
                    {/* Club info row */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      <div className="bg-vga-blue border border-vga-gray p-2">
                        <p className="text-vga-gray text-[6px] uppercase mb-1">{t('promanager.budget')}</p>
                        <p className={`text-[8px] font-bold ${budgetColor}`}>{formatEuros(team.budget)}</p>
                      </div>
                      <div className="bg-vga-blue border border-vga-gray p-2">
                        <p className="text-vga-gray text-[6px] uppercase mb-1">{t('promanager.stadium')}</p>
                        <p className="text-vga-bright-white text-[8px] font-bold truncate">
                          {team.stadiumName || '—'}
                        </p>
                        <p className="text-vga-cyan text-[7px]">
                          {team.stadiumCapacity.toLocaleString()} {t('promanager.cap')} · {formatEuros(team.ticketPrice)}/{t('promanager.ticket')}
                        </p>
                      </div>
                      <div className="bg-vga-blue border border-vga-gray p-2">
                        <p className="text-vga-gray text-[6px] uppercase mb-1">{t('promanager.formation')}</p>
                        <p className="text-vga-yellow text-[8px] font-bold">{team.formation}</p>
                        <p className="text-vga-gray text-[7px]">{t('promanager.playersCount', { n: String(team.players.length) })}</p>
                      </div>
                    </div>

                    {/* Objective highlight */}
                    <div className={`border px-3 py-2 text-center ${objColor} border-current`}>
                      <p className="text-[6px] uppercase opacity-70 mb-0.5">{t('florentino.meter')} — {t('label.season')}</p>
                      <p className="text-[9px] font-bold uppercase">{t(OBJ_KEYS[objective])}</p>
                    </div>

                    {/* Current manager */}
                    {team.manager && (
                      <div className="flex items-center gap-2 text-[7px]">
                        <span className="text-vga-gray uppercase">{t('promanager.currentMgr')}:</span>
                        <span className="text-vga-light-red font-bold">{team.manager}</span>
                      </div>
                    )}

                    {/* Top 5 players */}
                    <div>
                      <p className="text-vga-gray text-[6px] uppercase mb-1">{t('promanager.keyPlayers')}</p>
                      <div className="flex flex-col gap-1">
                        {top5.map(p => {
                          const inLineup = team.lineup.includes(p.id);
                          const ratingColor =
                            p.media >= 80 ? 'text-vga-light-green' :
                            p.media >= 65 ? 'text-vga-yellow' :
                            'text-vga-bright-white';
                          return (
                            <div key={p.id} className="flex items-center gap-2 text-[7px]">
                              <span className="text-vga-gray w-6 text-right shrink-0">
                                {posLabel[p.position] ?? p.position}
                              </span>
                              <span className={`flex-1 truncate ${inLineup ? 'text-vga-bright-white' : 'text-vga-gray'}`}>
                                {p.name}
                              </span>
                              <span className={`font-bold shrink-0 ${ratingColor}`}>{p.media}</span>
                              {inLineup && (
                                <span className="text-vga-light-green text-[6px] shrink-0">●</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      <p className="text-vga-gray text-[6px] mt-1">{t('promanager.lineupHint')}</p>
                    </div>

                    {/* Confirm button */}
                    <button
                      onClick={() => onSelectTeam(team.id, name.trim())}
                      className="w-full bg-vga-magenta hover:bg-vga-light-red text-vga-bright-white py-2 text-[9px] border border-vga-white font-bold uppercase"
                    >
                      {t('promanager.acceptOffer', { team: team.name.toUpperCase() })}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
