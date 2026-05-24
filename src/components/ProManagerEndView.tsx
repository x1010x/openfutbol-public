import { useState } from 'react';
import type { Team } from '../types/game.d.ts';
import type { TeamStats } from '../store/leagueStore';
import type { BoardObjective } from '../engine/florentinometro';
import { isObjectiveMet, teamsOfferingJobs, clampMeter, computeBoardObjective } from '../engine/florentinometro';
import { calculateTeamStrength } from '../engine/simEngine';
import { formatEuros } from '../data/economy';
import { TeamCrest } from './TeamCrest';
import { useT } from '../i18n';

const OBJ_KEYS: Record<BoardObjective, string> = {
  win_league:       'florentino.obj.win_league',
  top_4:            'florentino.obj.top_4',
  top_half:         'florentino.obj.top_half',
  avoid_relegation: 'florentino.obj.avoid_relegation',
};

interface Props {
  teams: Team[];
  stats: Record<string, TeamStats>;
  userTeamId: string;
  managerName: string;
  florentinometro: number;
  boardObjective: BoardObjective;
  managerReputation: number;
  year: number;
  onPickTeam: (teamId: string) => void;
  onRetire: () => void;
}

export const ProManagerEndView = ({
  teams,
  stats,
  userTeamId,
  managerName,
  florentinometro,
  boardObjective,
  managerReputation,
  year,
  onPickTeam,
  onRetire,
}: Props) => {
  const t = useT();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [confirmRetire, setConfirmRetire] = useState(false);

  const sortedStats = Object.values(stats).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    return (b.goalsFor - b.goalsAgainst) - (a.goalsFor - a.goalsAgainst);
  });

  const userRank = sortedStats.findIndex(s => s.teamId === userTeamId) + 1;
  const totalTeams = sortedStats.length;
  const myStats = stats[userTeamId];
  const objectiveMet = isObjectiveMet(boardObjective, userRank, totalTeams);
  const boardHappy = florentinometro >= 5 && objectiveMet;

  const meter = clampMeter(florentinometro);
  const meterColor =
    meter >= 7 ? '#55ff55' :
    meter >= 5 ? '#ffff55' :
    '#ff5555';
  const barBg =
    meter >= 7 ? '#55ff55' :
    meter >= 5 ? '#ffff55' :
    meter >= 2 ? '#ff5555' :
    '#aa0000';

  const jobOffers = teamsOfferingJobs(teams, userTeamId, managerReputation)
    .sort((a, b) => calculateTeamStrength(b) - calculateTeamStrength(a));
  const currentTeam = teams.find(t => t.id === userTeamId);
  const yy = (y: number) => (y + 1).toString().slice(-2);

  // Mocking bad stats
  const gd = myStats ? myStats.goalsFor - myStats.goalsAgainst : 0;
  const winRate = myStats && myStats.played > 0 ? ((myStats.won / myStats.played) * 100).toFixed(0) : '0';
  const accentColor = boardHappy ? '#55ff55' : '#ff5555';
  const panelBorder = boardHappy ? '#55ff55' : '#ff5555';

  const posLabel: Record<string, string> = {
    POR: 'GK', DEF: 'DEF', MED: 'MID', DEL: 'FWD',
  };

  return (
    <div className="w-full flex flex-col gap-4 animate-in fade-in duration-300">

      {/* ─── TOP SECTION ─────────────────────────────────────────── */}
      <div
        className="w-full border-4 flex flex-col md:flex-row overflow-hidden"
        style={{ borderColor: panelBorder, background: '#000020' }}
      >
        {/* LEFT: Florentino + mocking stats */}
        <div
          className="flex flex-col items-center gap-0 shrink-0"
          style={{ borderRight: `2px solid ${panelBorder}44`, background: '#00001a', minWidth: 180 }}
        >
          <img
            src="/assets/misc/florenmsg.png"
            alt="Florentino"
            style={{ width: 180, imageRendering: 'pixelated', display: 'block' }}
          />
          {/* Stats panel */}
          <div className="w-full p-3 flex flex-col gap-1.5" style={{ borderTop: `2px solid ${panelBorder}44` }}>
            <p
              className="text-[7px] font-bold uppercase tracking-widest text-center pb-1 mb-0.5"
              style={{ color: accentColor, borderBottom: `1px solid ${accentColor}44` }}
            >
              {boardHappy ? '📋 TEMPORADA' : '📋 EXPEDIENTE'}
            </p>

            {myStats && (
              <div className="flex flex-col gap-1 font-mono text-[8px]">
                <StatRow
                  label={t('status.pos')}
                  value={`${userRank}/${totalTeams}`}
                  highlight={userRank > totalTeams / 2}
                  mockSuffix={!boardHappy && userRank > totalTeams * 0.8 ? ' 😬' : undefined}
                />
                <StatRow
                  label="W/D/L"
                  value={`${myStats.won}/${myStats.drawn}/${myStats.lost}`}
                  highlight={myStats.won < myStats.lost}
                  mockSuffix={!boardHappy && myStats.won < 4 ? ` (${myStats.won}!!!)` : undefined}
                />
                <StatRow
                  label="GF/GA"
                  value={`${myStats.goalsFor}/${myStats.goalsAgainst}`}
                  highlight={myStats.goalsAgainst > myStats.goalsFor}
                />
                <StatRow
                  label="GD"
                  value={gd > 0 ? `+${gd}` : `${gd}`}
                  highlight={gd < 0}
                />
                <StatRow
                  label="WIN%"
                  value={`${winRate}%`}
                  highlight={Number(winRate) < 40}
                  mockSuffix={!boardHappy && Number(winRate) < 25 ? ' 💀' : undefined}
                />
                <StatRow
                  label={t('status.points')}
                  value={`${myStats.points}pts`}
                  highlight={false}
                />
                {currentTeam && (
                  <StatRow
                    label={t('status.cash')}
                    value={formatEuros(currentTeam.budget)}
                    highlight={currentTeam.budget < 0}
                  />
                )}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: Season verdict */}
        <div className="flex-1 flex flex-col p-4 gap-3">
          {/* Header */}
          <div>
            <h2
              className="text-xs font-bold uppercase tracking-widest"
              style={{ color: '#ffff55' }}
            >
              {t('promanager.seasonEnd.title')} — {year}/{yy(year)}
            </h2>
            {managerName && (
              <p className="text-[9px] mt-0.5" style={{ color: '#aaaaaa' }}>{managerName}</p>
            )}
          </div>

          {/* Florentinometro */}
          <div>
            <p className="text-[7px] uppercase mb-1" style={{ color: '#888888' }}>{t('florentino.meter')}</p>
            <div className="flex items-center gap-3">
              <div className="flex-1 h-4 border-2 relative" style={{ borderColor: meterColor, background: '#000010' }}>
                <div style={{ width: `${(meter / 10) * 100}%`, background: barBg, height: '100%', transition: 'width 0.4s' }} />
              </div>
              <span className="text-lg font-bold font-mono" style={{ color: meterColor }}>{meter.toFixed(1)}</span>
            </div>
          </div>

          {/* Objective + position */}
          <div
            className="flex items-center gap-3 px-3 py-2 border"
            style={{ borderColor: accentColor, background: '#00001a' }}
          >
            <span className="text-[8px]" style={{ color: '#888888' }}>{t('promanager.objPrefix')}:</span>
            <span className="text-[9px] font-bold uppercase" style={{ color: accentColor }}>{t(OBJ_KEYS[boardObjective])}</span>
            <span className="text-[7px] ml-auto" style={{ color: '#888888' }}>#{userRank}/{totalTeams}</span>
          </div>

          {/* Board verdict */}
          <div className="flex flex-col gap-1">
            <p className="text-[10px] font-bold uppercase" style={{ color: accentColor }}>
              {boardHappy ? t('promanager.boardHappy') : t('promanager.boardUnhappy')}
            </p>
            <p className="text-[8px]" style={{ color: objectiveMet ? '#55ff55' : '#ff5555' }}>
              {objectiveMet ? t('florentino.metObj') : t('florentino.missedObj')}
            </p>
          </div>

          {/* Career rep bar (0-100) */}
          <div className="flex items-center gap-2">
            <span className="text-[7px] uppercase shrink-0" style={{ color: '#888888' }}>{t('promanager.reputation')}</span>
            <div className="flex-1 h-2 border" style={{ borderColor: '#444466', background: '#000010' }}>
              <div
                style={{
                  width: `${managerReputation}%`,
                  background: managerReputation >= 70 ? '#55ff55' : managerReputation >= 45 ? '#ffff55' : '#ff5555',
                  height: '100%',
                }}
              />
            </div>
            <span className="text-[8px] font-bold" style={{ color: managerReputation >= 70 ? '#55ff55' : managerReputation >= 45 ? '#ffff55' : '#ff5555' }}>
              {Math.round(managerReputation)}
            </span>
          </div>

          {/* Stay button */}
          {boardHappy && currentTeam && (
            <button
              onClick={() => onPickTeam(currentTeam.id)}
              className="w-full py-3 text-[10px] font-bold uppercase border-2 transition-colors"
              style={{ background: '#003300', color: '#55ff55', borderColor: '#55ff55' }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#55ff55'; (e.currentTarget as HTMLButtonElement).style.color = '#000000'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#003300'; (e.currentTarget as HTMLButtonElement).style.color = '#55ff55'; }}
            >
              ▶ {t('promanager.stay', { team: currentTeam.name })}
            </button>
          )}
        </div>
      </div>

      {/* ─── JOB OFFERS ──────────────────────────────────────────── */}
      <div className="w-full border-2 border-vga-gray" style={{ background: '#00000a' }}>
        <div className="px-4 py-2 border-b border-vga-gray flex items-center gap-3">
          <h3 className="text-vga-yellow text-[9px] font-bold uppercase tracking-widest">{t('promanager.offers')}</h3>
          <span className="text-vga-gray text-[7px]">{t('promanager.offersCount', { n: String(jobOffers.length) })}</span>
        </div>

        {jobOffers.length === 0 && (
          <p className="text-vga-gray text-[8px] text-center py-8">{t('promanager.noOffers')}</p>
        )}

        <div className="flex flex-col gap-0 divide-y divide-vga-gray">
          {jobOffers.map((team) => {
            const strength = Math.floor(calculateTeamStrength(team));
            const isOpen = expanded === team.id;
            const objective = computeBoardObjective(team, teams);
            const objColor =
              objective === 'win_league'       ? 'text-vga-yellow' :
              objective === 'top_4'            ? 'text-vga-light-green' :
              objective === 'top_half'         ? 'text-vga-cyan' :
                                                 'text-vga-gray';
            const objColorHex =
              objective === 'win_league'       ? '#ffff55' :
              objective === 'top_4'            ? '#55ff55' :
              objective === 'top_half'         ? '#55ffff' :
                                                 '#888888';
            const byMedia = [...team.players].sort((a, b) => b.media - a.media);
            const top5 = byMedia.slice(0, 5);
            const star = byMedia[0] ?? null;
            const budgetColor = team.budget < 0 ? 'text-vga-light-red' : team.budget < 1_000_000 ? 'text-vga-yellow' : 'text-vga-light-green';

            return (
              <div key={team.id} style={{ background: isOpen ? '#001122' : undefined }}>
                {/* Card header */}
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
                      onClick={() => onPickTeam(team.id)}
                      className="bg-vga-magenta hover:bg-vga-light-red text-vga-bright-white text-[8px] px-3 py-1 border border-vga-white font-bold uppercase"
                    >
                      {t('promanager.accept')}
                    </button>
                  </div>
                </div>

                {/* Expanded details */}
                {isOpen && (
                  <div className="p-4 border-t border-vga-gray flex flex-col gap-3" style={{ background: '#000020' }}>
                    {/* Club info grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <div className="bg-vga-blue border border-vga-gray p-2">
                        <p className="text-vga-gray text-[6px] uppercase mb-1">{t('promanager.budget')}</p>
                        <p className={`text-[8px] font-bold ${budgetColor}`}>{formatEuros(team.budget)}</p>
                      </div>
                      <div className="bg-vga-blue border border-vga-gray p-2">
                        <p className="text-vga-gray text-[6px] uppercase mb-1">{t('promanager.stadium')}</p>
                        <p className="text-vga-bright-white text-[8px] font-bold truncate">{team.stadiumName || '—'}</p>
                        <p className="text-vga-cyan text-[7px]">{team.stadiumCapacity.toLocaleString()} · {formatEuros(team.ticketPrice)}/{t('promanager.ticket')}</p>
                      </div>
                      <div className="bg-vga-blue border border-vga-gray p-2">
                        <p className="text-vga-gray text-[6px] uppercase mb-1">{t('promanager.formation')}</p>
                        <p className="text-vga-yellow text-[8px] font-bold">{team.formation}</p>
                        <p className="text-vga-gray text-[7px]">{t('promanager.playersCount', { n: String(team.players.length) })}</p>
                      </div>
                      <div className="border p-2" style={{ borderColor: objColorHex, background: '#00001a' }}>
                        <p className="text-[6px] uppercase opacity-60 mb-0.5" style={{ color: objColorHex }}>{t('florentino.meter')}</p>
                        <p className="text-[9px] font-bold uppercase" style={{ color: objColorHex }}>{t(OBJ_KEYS[objective])}</p>
                      </div>
                    </div>

                    {/* Current manager */}
                    {team.manager && (
                      <div className="flex items-center gap-2 text-[7px]">
                        <span className="text-vga-gray uppercase">{t('promanager.currentMgr')}:</span>
                        <span className="text-vga-light-red font-bold">{team.manager}</span>
                        <span className="text-vga-gray text-[6px]">(será despedido)</span>
                      </div>
                    )}

                    {/* Top 5 players */}
                    <div>
                      <p className="text-vga-gray text-[6px] uppercase mb-2">{t('promanager.keyPlayers')}</p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1">
                        {top5.map(p => {
                          const inLineup = team.lineup.includes(p.id);
                          const ratingColor =
                            p.media >= 80 ? 'text-vga-light-green' :
                            p.media >= 65 ? 'text-vga-yellow' :
                            'text-vga-cyan';
                          return (
                            <div key={p.id} className="bg-vga-blue border border-vga-gray px-2 py-1 flex items-center gap-2">
                              <span className="text-vga-gray text-[6px] shrink-0 w-5 text-center">
                                {posLabel[p.position] ?? p.position}
                              </span>
                              <span className="text-vga-bright-white text-[7px] flex-1 truncate">{p.name}</span>
                              <span className={`${ratingColor} text-[7px] font-bold shrink-0`}>{p.media}</span>
                              {inLineup && <span className="text-vga-yellow text-[6px] shrink-0">▶</span>}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Accept confirm button */}
                    <button
                      onClick={() => onPickTeam(team.id)}
                      className="w-full py-2.5 text-[9px] font-bold uppercase border-2 transition-colors"
                      style={{ background: '#220033', color: '#ff55ff', borderColor: '#aa00aa' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#aa00aa'; (e.currentTarget as HTMLButtonElement).style.color = '#ffffff'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#220033'; (e.currentTarget as HTMLButtonElement).style.color = '#ff55ff'; }}
                    >
                      {t('promanager.acceptOffer')} — {team.name}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ─── RETIRE ──────────────────────────────────────────────── */}
      <div>
        {!confirmRetire ? (
          <button
            onClick={() => setConfirmRetire(true)}
            className="w-full bg-vga-gray hover:bg-vga-red text-vga-black hover:text-vga-bright-white py-2 px-4 border-2 border-vga-black text-[9px] font-bold uppercase"
          >
            {t('promanager.retire')}
          </button>
        ) : (
          <div className="bg-vga-red border-2 border-vga-bright-white p-3 text-center">
            <p className="text-vga-bright-white text-[8px] mb-2">{t('promanager.retireConfirm')}</p>
            <div className="flex gap-2">
              <button
                onClick={onRetire}
                className="flex-1 bg-vga-black text-vga-bright-white py-2 text-[8px] border border-vga-bright-white hover:bg-vga-gray font-bold uppercase"
              >
                {t('btn.accept')}
              </button>
              <button
                onClick={() => setConfirmRetire(false)}
                className="flex-1 bg-vga-bright-white text-vga-black py-2 text-[8px] border border-vga-black hover:bg-vga-gray font-bold uppercase"
              >
                {t('btn.cancel')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Tiny helper component for stat rows
const StatRow = ({
  label,
  value,
  highlight,
  mockSuffix,
}: {
  label: string;
  value: string;
  highlight: boolean;
  mockSuffix?: string;
}) => (
  <div className="flex justify-between items-baseline gap-2">
    <span style={{ color: '#666688' }}>{label}</span>
    <span style={{ color: highlight ? '#ff5555' : '#aaaacc', fontWeight: highlight ? 'bold' : undefined }}>
      {value}{mockSuffix && <span style={{ color: '#ff8888', fontSize: '0.7em' }}>{mockSuffix}</span>}
    </span>
  </div>
);
