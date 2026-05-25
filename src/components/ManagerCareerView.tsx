import { useState } from 'react';
import type { ManagerSeasonRecord } from '../store/leagueStore';
import { useT } from '../i18n';
import { formatEuros } from '../data/economy';
import type { BoardObjective } from '../engine/florentinometro';

interface CareerExport {
  managerName: string;
  managerCareer: ManagerSeasonRecord[];
  managerReputation: number;
}

export interface LiveSeasonSnap {
  year: number;
  teamName: string;
  teamId: string;
  finalPosition: number;
  totalTeams: number;
  objective: BoardObjective;
  wins: number;
  draws: number;
  losses: number;
  florentinometro: number;
}

interface Props {
  managerName: string;
  career: ManagerSeasonRecord[];
  managerReputation?: number;
  liveSnap?: LiveSeasonSnap;
  onRename?: (name: string) => void;
  onBack: () => void;
}

const OBJECTIVE_KEYS: Record<BoardObjective, string> = {
  win_league: 'florentino.obj.win_league',
  top_4: 'florentino.obj.top_4',
  top_half: 'florentino.obj.top_half',
  avoid_relegation: 'florentino.obj.avoid_relegation',
};

export const ManagerCareerView = ({ managerName, career, managerReputation, liveSnap, onRename, onBack }: Props) => {
  const t = useT();
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(managerName);

  const uniqueSeasons = new Set(career.map(r => r.year)).size;
  const totalGames = career.reduce((s, r) => s + r.gamesManaged, 0);
  const totalWins = career.reduce((s, r) => s + r.wins, 0);
  const totalDraws = career.reduce((s, r) => s + r.draws, 0);
  const totalLosses = career.reduce((s, r) => s + r.losses, 0);
  const winPct = totalGames > 0 ? ((totalWins / totalGames) * 100).toFixed(1) : '0.0';
  const titles = career.filter(r => r.finalPosition === 1).length;
  const peakMeter = career.reduce((best, r) => Math.max(best, r.florentinometroPeak), 0);
  const transferBalance = career.reduce((s, r) => s + r.transferBalance, 0);
  const careerRating = career.length > 0
    ? (career.reduce((s, r) => s + r.florentinometroFinal, 0) / career.length).toFixed(1)
    : '—';

  const ordinal = (n: number): string => {
    if (n === 1) return '1st';
    if (n === 2) return '2nd';
    if (n === 3) return '3rd';
    return `${n}th`;
  };

  const handleExport = () => {
    const data: CareerExport = {
      managerName,
      managerCareer: career,
      managerReputation: managerReputation ?? 50,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `openfutbol_career_${managerName.replace(/\s+/g, '_') || 'manager'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const commitRename = () => {
    if (nameInput.trim()) onRename?.(nameInput.trim());
    setEditingName(false);
  };

  return (
    <div className="w-full max-w-lg flex flex-col gap-4 animate-in fade-in duration-300">
      <div className="bg-vga-black border-4 border-vga-magenta p-4 vga-panel">
        <div className="flex justify-between items-start mb-4">
          <div className="flex-1 min-w-0 mr-3">
            <h2 className="text-vga-magenta text-sm font-bold uppercase">{t('career.title')}</h2>
            {editingName ? (
              <div className="flex items-center gap-2 mt-1">
                <input
                  autoFocus
                  value={nameInput}
                  onChange={e => setNameInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setEditingName(false); }}
                  className="bg-vga-blue border border-vga-cyan text-vga-bright-white text-[9px] px-2 py-1 font-mono outline-none w-40"
                  maxLength={30}
                />
                <button onClick={commitRename} className="text-[8px] bg-vga-cyan text-vga-black px-2 py-0.5 font-bold">✓</button>
                <button onClick={() => setEditingName(false)} className="text-[8px] text-vga-gray">✕</button>
              </div>
            ) : (
              <div className="flex items-center gap-2 mt-1">
                {managerName && <p className="text-vga-bright-white text-xs">{managerName}</p>}
                {onRename && (
                  <button
                    onClick={() => { setNameInput(managerName); setEditingName(true); }}
                    className="text-[8px] text-vga-gray hover:text-vga-cyan underline decoration-dotted"
                  >
                    {t('career.editName')}
                  </button>
                )}
              </div>
            )}
          </div>
          <div className="flex gap-2 items-center shrink-0">
            <button
              onClick={handleExport}
              className="text-[7px] bg-vga-blue text-vga-cyan px-2 py-1 border border-vga-cyan hover:bg-vga-cyan hover:text-vga-black"
              title={t('career.exportTitle')}
            >
              {t('career.export')}
            </button>
            <button
              onClick={onBack}
              className="text-[8px] bg-vga-gray text-vga-black px-2 py-1 border border-vga-white hover:bg-vga-red hover:text-vga-bright-white"
            >
              {t('btn.back')}
            </button>
          </div>
        </div>

        {/* Career summary stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
          {[
            { label: t('career.rating'), value: careerRating, color: 'text-vga-magenta' },
            { label: t('career.seasons'), value: String(uniqueSeasons), color: 'text-vga-yellow' },
            { label: t('career.totalGames'), value: String(totalGames), color: 'text-vga-bright-white' },
            { label: t('career.winPct'), value: `${winPct}%`, color: 'text-vga-light-green' },
            { label: t('career.titles'), value: String(titles), color: 'text-vga-yellow' },
            { label: t('career.bestMeter'), value: peakMeter.toFixed(1), color: 'text-vga-cyan' },
            ...(managerReputation !== undefined ? [{
              label: t('promanager.reputation'),
              value: String(Math.round(managerReputation)),
              color: managerReputation >= 70 ? 'text-vga-light-green' : managerReputation >= 45 ? 'text-vga-yellow' : 'text-vga-light-red',
            }] : []),
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-vga-blue border border-vga-white p-2 text-center">
              <div className="text-vga-gray text-[7px] uppercase mb-1">{label}</div>
              <div className={`font-bold text-xs ${color}`}>{value}</div>
            </div>
          ))}
        </div>

        {/* W/D/L bar */}
        {totalGames > 0 && (
          <div className="mb-4">
            <div className="text-vga-gray text-[7px] mb-1 uppercase">W {totalWins} · D {totalDraws} · L {totalLosses}</div>
            <div className="flex h-2 rounded-sm overflow-hidden">
              <div className="bg-vga-light-green" style={{ width: `${(totalWins / totalGames) * 100}%` }} />
              <div className="bg-vga-yellow" style={{ width: `${(totalDraws / totalGames) * 100}%` }} />
              <div className="bg-vga-light-red" style={{ width: `${(totalLosses / totalGames) * 100}%` }} />
            </div>
          </div>
        )}

        {/* Transfer balance */}
        <div className="bg-vga-blue border border-vga-white p-2 text-[8px] mb-4 flex justify-between">
          <span className="text-vga-gray uppercase">{t('career.transferBalance')}</span>
          <span className={`font-bold ${transferBalance >= 0 ? 'text-vga-light-green' : 'text-vga-light-red'}`}>
            {transferBalance >= 0 ? '+' : ''}{formatEuros(transferBalance)}
          </span>
        </div>

        {/* Season history */}
        {career.length === 0 && !liveSnap ? (
          <p className="text-vga-gray text-[8px] text-center py-4">{t('career.noHistory')}</p>
        ) : (
          <div className="flex flex-col gap-2 max-h-[320px] overflow-y-auto pr-1">
            {liveSnap && (() => {
              const gamesLive = liveSnap.wins + liveSnap.draws + liveSnap.losses;
              const wPctLive = gamesLive > 0 ? ((liveSnap.wins / gamesLive) * 100).toFixed(0) : '0';
              const meterColorLive =
                liveSnap.florentinometro >= 7 ? 'text-vga-light-green' :
                liveSnap.florentinometro >= 5 ? 'text-vga-yellow' :
                'text-vga-light-red';
              return (
                <div className="bg-vga-blue border-2 border-vga-cyan p-2 text-[8px]">
                  <div className="flex justify-between items-start mb-1">
                    <div>
                      <span className="text-vga-cyan font-bold text-[6px] uppercase mr-2">{t('career.inProgress')}</span>
                      <span className="text-vga-yellow font-bold">{liveSnap.year}/{(liveSnap.year + 1).toString().slice(-2)}</span>
                      <span className="text-vga-bright-white ml-2">{liveSnap.teamName}</span>
                    </div>
                  </div>
                  <div className="flex gap-4 flex-wrap">
                    <span className="text-vga-gray">
                      {ordinal(liveSnap.finalPosition)}/{liveSnap.totalTeams}
                    </span>
                    <span className="text-vga-cyan">
                      {t(OBJECTIVE_KEYS[liveSnap.objective])}
                    </span>
                    <span className="text-vga-bright-white">
                      {liveSnap.wins}W {liveSnap.draws}D {liveSnap.losses}L ({wPctLive}%)
                    </span>
                    <span className={meterColorLive}>
                      ★ {liveSnap.florentinometro.toFixed(1)}
                    </span>
                  </div>
                </div>
              );
            })()}
            {[...career].reverse().map((record, i) => {
              const yr = record.year;
              const wPct = record.gamesManaged > 0
                ? ((record.wins / record.gamesManaged) * 100).toFixed(0)
                : '0';
              const meterColor =
                record.florentinometroFinal >= 7 ? 'text-vga-light-green' :
                record.florentinometroFinal >= 5 ? 'text-vga-yellow' :
                'text-vga-light-red';
              return (
                <div
                  key={`${yr}-${record.teamId}-${i}`}
                  className="bg-vga-black border border-vga-gray p-2 text-[8px]"
                >
                  <div className="flex justify-between items-start mb-1">
                    <div>
                      <span className="text-vga-yellow font-bold">{yr}/{(yr + 1).toString().slice(-2)}</span>
                      <span className="text-vga-bright-white ml-2">{record.teamName}</span>
                    </div>
                    <div className="flex gap-2 items-center">
                      {record.fired && (
                        <span className="text-vga-light-red text-[6px] border border-vga-light-red px-1 uppercase">
                          {t('career.fired')}
                        </span>
                      )}
                      <span className={`text-[6px] border px-1 uppercase ${record.objectiveMet ? 'text-vga-light-green border-vga-light-green' : 'text-vga-gray border-vga-gray'}`}>
                        {record.objectiveMet ? t('career.metObj') : t('career.missedObj')}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-4 flex-wrap">
                    <span className="text-vga-gray">
                      {ordinal(record.finalPosition)}/{record.totalTeams}
                    </span>
                    <span className="text-vga-cyan">
                      {t(OBJECTIVE_KEYS[record.objective])}
                    </span>
                    <span className="text-vga-bright-white">
                      {record.wins}W {record.draws}D {record.losses}L ({wPct}%)
                    </span>
                    <span className={meterColor}>
                      ★ {record.florentinometroFinal.toFixed(1)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
