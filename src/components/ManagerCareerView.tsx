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

const Panel = ({ title, accent = 'text-vga-magenta', children, className = '', right }: {
  title: string; accent?: string; children: React.ReactNode; className?: string; right?: React.ReactNode;
}) => (
  <div className={`bg-vga-black border border-vga-blue flex flex-col ${className}`}>
    <div className={`${accent} text-[9px] uppercase tracking-widest px-2 py-1 border-b border-vga-blue flex items-center justify-between`}>
      <span>{title}</span>
      {right}
    </div>
    <div className="flex-1">{children}</div>
  </div>
);

const StatTile = ({ label, value, color = 'text-vga-bright-white', sub }: {
  label: string; value: string; color?: string; sub?: string;
}) => (
  <div className="bg-vga-black border border-vga-blue p-2">
    <div className="text-vga-magenta text-[7px] uppercase tracking-widest">{label}</div>
    <div className={`${color} text-[14px] font-bold tabular-nums`}>{value}</div>
    {sub && <div className="text-vga-gray text-[7px]">{sub}</div>}
  </div>
);

const ordinal = (n: number): string => {
  if (n === 1) return '1º';
  if (n === 2) return '2º';
  if (n === 3) return '3º';
  return `${n}º`;
};

const meterColorOf = (n: number) =>
  n >= 7 ? 'text-vga-light-green' : n >= 5 ? 'text-vga-yellow' : 'text-vga-light-red';

const WDLBar = ({ w, d, l }: { w: number; d: number; l: number }) => {
  const total = Math.max(1, w + d + l);
  return (
    <div className="flex h-2 w-full border border-vga-blue overflow-hidden">
      <div className="bg-vga-light-green" style={{ width: `${(w / total) * 100}%` }} />
      <div className="bg-vga-yellow" style={{ width: `${(d / total) * 100}%` }} />
      <div className="bg-vga-light-red" style={{ width: `${(l / total) * 100}%` }} />
    </div>
  );
};

const PositionBar = ({ pos, total }: { pos: number; total: number }) => {
  const pct = total > 1 ? (1 - (pos - 1) / (total - 1)) * 100 : 50;
  const color = pos === 1 ? 'bg-vga-yellow' : pos <= 3 ? 'bg-vga-light-green' : pos <= total / 2 ? 'bg-vga-cyan' : 'bg-vga-light-red';
  return (
    <div className="flex items-center gap-1 w-full">
      <div className="flex-1 h-1.5 bg-vga-blue/40 border border-vga-blue overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
};

const MeterRange = ({ min, peak, final }: { min: number; peak: number; final: number }) => {
  const at = (v: number) => `${(v / 10) * 100}%`;
  return (
    <div className="relative h-2 w-full bg-vga-blue/30 border border-vga-blue">
      <div
        className="absolute h-full bg-vga-blue/70"
        style={{ left: at(min), width: `${((peak - min) / 10) * 100}%` }}
      />
      <div
        className="absolute -top-1 w-0.5 h-4 bg-vga-bright-white"
        style={{ left: at(final) }}
        title={`Final ${final.toFixed(1)}`}
      />
    </div>
  );
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
  const totalPoints = totalWins * 3 + totalDraws;
  const ppg = totalGames > 0 ? (totalPoints / totalGames).toFixed(2) : '—';
  const winPct = totalGames > 0 ? ((totalWins / totalGames) * 100).toFixed(1) : '0.0';
  const titles = career.filter(r => r.finalPosition === 1).length;
  const podiums = career.filter(r => r.finalPosition <= 3).length;
  const relegations = career.filter(r => r.finalPosition === r.totalTeams).length;
  const firings = career.filter(r => r.fired).length;
  const peakMeter = career.reduce((best, r) => Math.max(best, r.florentinometroPeak), 0);
  const transferBalance = career.reduce((s, r) => s + r.transferBalance, 0);
  const careerRating = career.length > 0
    ? (career.reduce((s, r) => s + r.florentinometroFinal, 0) / career.length).toFixed(1)
    : '—';
  const distinctTeams = new Set(career.map(r => r.teamId)).size;
  const objectivesMet = career.filter(r => r.objectiveMet).length;
  const bestSeason = [...career].sort((a, b) => b.florentinometroFinal - a.florentinometroFinal)[0] ?? null;
  const worstSeason = [...career].sort((a, b) => a.florentinometroFinal - b.florentinometroFinal)[0] ?? null;

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
    <div className="w-full flex flex-col gap-3 animate-in fade-in duration-300 px-2">
      {/* Header */}
      <div className="bg-vga-black border border-vga-blue px-3 py-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-vga-magenta text-[10px] uppercase tracking-widest">Carrera como entrenador</span>
          {editingName ? (
            <div className="flex items-center gap-1">
              <input
                autoFocus
                value={nameInput}
                onChange={e => setNameInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setEditingName(false); }}
                className="bg-vga-black border border-vga-cyan text-vga-bright-white text-[10px] px-2 py-0.5 w-40 focus:outline-none"
                maxLength={30}
              />
              <button onClick={commitRename} className="text-[8px] bg-vga-cyan text-vga-black px-2 py-0.5 font-bold">✓</button>
              <button onClick={() => setEditingName(false)} className="text-[8px] text-vga-gray">✕</button>
            </div>
          ) : (
            <>
              {managerName && <span className="text-vga-bright-white text-[12px] font-bold truncate">{managerName}</span>}
              {onRename && (
                <button onClick={() => { setNameInput(managerName); setEditingName(true); }}
                        className="text-[8px] text-vga-gray hover:text-vga-cyan underline decoration-dotted">
                  {t('career.editName')}
                </button>
              )}
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleExport} className="text-[8px] bg-vga-black border border-vga-cyan text-vga-cyan px-3 py-1 hover:bg-vga-cyan hover:text-vga-black font-bold uppercase">
            {t('career.export')}
          </button>
          <button onClick={onBack} className="bg-vga-red text-vga-bright-white px-3 py-1 text-[8px] border border-vga-black hover:bg-vga-light-red font-bold">
            {t('btn.back')}
          </button>
        </div>
      </div>

      {/* Career headline stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
        <StatTile label="Valoración" value={careerRating} color="text-vga-magenta" sub={`peak ${peakMeter.toFixed(1)}`} />
        {managerReputation !== undefined && (
          <StatTile
            label="Reputación"
            value={String(Math.round(managerReputation))}
            color={managerReputation >= 70 ? 'text-vga-light-green' : managerReputation >= 45 ? 'text-vga-yellow' : 'text-vga-light-red'}
          />
        )}
        <StatTile label="Temporadas" value={String(uniqueSeasons)} color="text-vga-yellow" sub={`${distinctTeams} equipos`} />
        <StatTile label="Partidos" value={String(totalGames)} color="text-vga-bright-white" sub={`${ppg} pts/p`} />
        <StatTile label="Victorias" value={`${winPct}%`} color="text-vga-light-green" sub={`${totalWins}W ${totalDraws}D ${totalLosses}L`} />
        <StatTile label="Títulos" value={String(titles)} color="text-vga-yellow" sub={`${podiums} podios`} />
        <StatTile label="Objetivos" value={`${objectivesMet}/${career.length}`} color="text-vga-cyan" sub={firings > 0 ? `${firings} despidos` : 'sin despidos'} />
        <StatTile
          label="Balance fichajes"
          value={`${transferBalance >= 0 ? '+' : ''}${formatEuros(transferBalance)}`}
          color={transferBalance >= 0 ? 'text-vga-light-green' : 'text-vga-light-red'}
          sub={relegations > 0 ? `${relegations} descensos` : ''}
        />
      </div>

      {/* Lifetime W/D/L bar */}
      {totalGames > 0 && (
        <Panel title={`Récord ${totalWins}-${totalDraws}-${totalLosses} · ${totalPoints} pts`}>
          <div className="p-2">
            <WDLBar w={totalWins} d={totalDraws} l={totalLosses} />
            <div className="flex justify-between text-[8px] mt-1 tabular-nums">
              <span className="text-vga-light-green">W {totalWins} ({((totalWins / totalGames) * 100).toFixed(0)}%)</span>
              <span className="text-vga-yellow">D {totalDraws}</span>
              <span className="text-vga-light-red">L {totalLosses}</span>
            </div>
          </div>
        </Panel>
      )}

      {/* Best / worst season highlights */}
      {bestSeason && worstSeason && career.length >= 2 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Panel title="Mejor temporada" accent="text-vga-light-green">
            <div className="p-2 text-[9px]">
              <div className="text-vga-yellow font-bold">{bestSeason.year}/{(bestSeason.year + 1).toString().slice(-2)} · {bestSeason.teamName}</div>
              <div className="text-vga-bright-white">{ordinal(bestSeason.finalPosition)}/{bestSeason.totalTeams} · {bestSeason.wins}W {bestSeason.draws}D {bestSeason.losses}L · <span className={meterColorOf(bestSeason.florentinometroFinal)}>★ {bestSeason.florentinometroFinal.toFixed(1)}</span></div>
            </div>
          </Panel>
          <Panel title="Peor temporada" accent="text-vga-light-red">
            <div className="p-2 text-[9px]">
              <div className="text-vga-yellow font-bold">{worstSeason.year}/{(worstSeason.year + 1).toString().slice(-2)} · {worstSeason.teamName}</div>
              <div className="text-vga-bright-white">{ordinal(worstSeason.finalPosition)}/{worstSeason.totalTeams} · {worstSeason.wins}W {worstSeason.draws}D {worstSeason.losses}L · <span className={meterColorOf(worstSeason.florentinometroFinal)}>★ {worstSeason.florentinometroFinal.toFixed(1)}</span></div>
            </div>
          </Panel>
        </div>
      )}

      {/* Season history */}
      <Panel title={`Historial · ${career.length + (liveSnap ? 1 : 0)} temporadas`}>
        {career.length === 0 && !liveSnap ? (
          <div className="text-vga-gray text-[9px] text-center p-4">{t('career.noHistory')}</div>
        ) : (
          <div className="flex flex-col gap-2 p-2 max-h-[60vh] overflow-y-auto">
            {liveSnap && (() => {
              const games = liveSnap.wins + liveSnap.draws + liveSnap.losses;
              const wPct = games > 0 ? ((liveSnap.wins / games) * 100).toFixed(0) : '0';
              const pts = liveSnap.wins * 3 + liveSnap.draws;
              return (
                <div className="bg-vga-black border-2 border-vga-cyan p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-vga-cyan text-[8px] uppercase tracking-widest border border-vga-cyan px-1">En curso</span>
                      <span className="text-vga-yellow text-[12px] font-bold">{liveSnap.year}/{(liveSnap.year + 1).toString().slice(-2)}</span>
                      <span className="text-vga-bright-white text-[11px] truncate">{liveSnap.teamName}</span>
                    </div>
                    <span className={`${meterColorOf(liveSnap.florentinometro)} text-[11px] font-bold tabular-nums`}>★ {liveSnap.florentinometro.toFixed(1)}</span>
                  </div>
                  <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 text-[9px]">
                    <div>
                      <div className="text-vga-magenta text-[7px] uppercase">Posición</div>
                      <div className="text-vga-bright-white text-[11px] font-bold tabular-nums">{ordinal(liveSnap.finalPosition)}/{liveSnap.totalTeams}</div>
                      <div className="mt-1"><PositionBar pos={liveSnap.finalPosition} total={liveSnap.totalTeams} /></div>
                    </div>
                    <div>
                      <div className="text-vga-magenta text-[7px] uppercase">W/D/L</div>
                      <div className="text-vga-bright-white text-[11px] font-bold tabular-nums">{liveSnap.wins}-{liveSnap.draws}-{liveSnap.losses}</div>
                      <div className="mt-1"><WDLBar w={liveSnap.wins} d={liveSnap.draws} l={liveSnap.losses} /></div>
                    </div>
                    <div>
                      <div className="text-vga-magenta text-[7px] uppercase">Puntos</div>
                      <div className="text-vga-bright-white text-[11px] font-bold tabular-nums">{pts}</div>
                      <div className="text-vga-gray text-[7px]">{wPct}% victorias</div>
                    </div>
                    <div>
                      <div className="text-vga-magenta text-[7px] uppercase">Objetivo</div>
                      <div className="text-vga-cyan text-[10px] truncate">{t(OBJECTIVE_KEYS[liveSnap.objective])}</div>
                    </div>
                    <div>
                      <div className="text-vga-magenta text-[7px] uppercase">Junta</div>
                      <div className={`${meterColorOf(liveSnap.florentinometro)} text-[10px] font-bold`}>
                        {liveSnap.florentinometro >= 7 ? 'Contenta' : liveSnap.florentinometro >= 5 ? 'Vigilante' : 'Enfadada'}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}
            {[...career].reverse().map((record, i) => {
              const wPct = record.gamesManaged > 0 ? ((record.wins / record.gamesManaged) * 100).toFixed(0) : '0';
              const pts = record.wins * 3 + record.draws;
              const isChamp = record.finalPosition === 1;
              const isReleg = record.finalPosition === record.totalTeams;
              return (
                <div
                  key={`${record.year}-${record.teamId}-${i}`}
                  className={`bg-vga-black border p-3 ${isChamp ? 'border-vga-yellow' : record.fired ? 'border-vga-light-red' : 'border-vga-blue'}`}
                >
                  <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-vga-yellow text-[12px] font-bold">{record.year}/{(record.year + 1).toString().slice(-2)}</span>
                      <span className="text-vga-bright-white text-[11px] truncate">{record.teamName}</span>
                      {isChamp && <span className="text-vga-yellow text-[7px] border border-vga-yellow px-1 uppercase">Campeón</span>}
                      {isReleg && <span className="text-vga-light-red text-[7px] border border-vga-light-red px-1 uppercase">Descenso</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      {record.fired && (
                        <span className="text-vga-light-red text-[7px] border border-vga-light-red px-1 uppercase">{t('career.fired')}</span>
                      )}
                      <span className={`text-[7px] border px-1 uppercase ${record.objectiveMet ? 'text-vga-light-green border-vga-light-green' : 'text-vga-light-red border-vga-light-red'}`}>
                        {record.objectiveMet ? t('career.metObj') : t('career.missedObj')}
                      </span>
                      <span className={`${meterColorOf(record.florentinometroFinal)} text-[11px] font-bold tabular-nums`}>★ {record.florentinometroFinal.toFixed(1)}</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 text-[9px]">
                    <div>
                      <div className="text-vga-magenta text-[7px] uppercase">Posición</div>
                      <div className="text-vga-bright-white text-[10px] font-bold tabular-nums">{ordinal(record.finalPosition)}/{record.totalTeams}</div>
                      <div className="mt-1"><PositionBar pos={record.finalPosition} total={record.totalTeams} /></div>
                    </div>
                    <div>
                      <div className="text-vga-magenta text-[7px] uppercase">W/D/L</div>
                      <div className="text-vga-bright-white text-[10px] font-bold tabular-nums">{record.wins}-{record.draws}-{record.losses}</div>
                      <div className="mt-1"><WDLBar w={record.wins} d={record.draws} l={record.losses} /></div>
                    </div>
                    <div>
                      <div className="text-vga-magenta text-[7px] uppercase">Puntos</div>
                      <div className="text-vga-bright-white text-[10px] font-bold tabular-nums">{pts}</div>
                      <div className="text-vga-gray text-[7px]">{wPct}% victorias</div>
                    </div>
                    <div>
                      <div className="text-vga-magenta text-[7px] uppercase">Objetivo</div>
                      <div className="text-vga-cyan text-[9px] truncate">{t(OBJECTIVE_KEYS[record.objective])}</div>
                    </div>
                    <div>
                      <div className="text-vga-magenta text-[7px] uppercase">Florentinómetro</div>
                      <div className="text-vga-bright-white text-[9px] tabular-nums">{record.florentinometroMin.toFixed(1)} · {record.florentinometroPeak.toFixed(1)}</div>
                      <div className="mt-1"><MeterRange min={record.florentinometroMin} peak={record.florentinometroPeak} final={record.florentinometroFinal} /></div>
                    </div>
                    <div>
                      <div className="text-vga-magenta text-[7px] uppercase">Balance fichajes</div>
                      <div className={`${record.transferBalance >= 0 ? 'text-vga-light-green' : 'text-vga-light-red'} text-[10px] font-bold tabular-nums`}>
                        {record.transferBalance >= 0 ? '+' : ''}{formatEuros(record.transferBalance)}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Panel>
    </div>
  );
};
