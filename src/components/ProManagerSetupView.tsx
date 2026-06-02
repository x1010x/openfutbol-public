import { useRef, useState } from 'react';
import type { Team } from '../types/game.d.ts';
import type { ManagerSeasonRecord } from '../store/leagueStore';
import type { BoardObjective } from '../engine/florentinometro';
import { teamsOfferingJobs, computeBoardObjective } from '../engine/florentinometro';
import { calculateTeamStrength } from '../engine/simEngine';
import { TeamCrest } from './TeamCrest';
import { formatEuros } from '../data/economy';
import { useT } from '../i18n';
import { ScreenHeader } from './ScreenHeader';

const MAX_OFFERS = 10;

const OBJ_KEYS: Record<BoardObjective, string> = {
  win_league: 'florentino.obj.win_league',
  top_4: 'florentino.obj.top_4',
  top_half: 'florentino.obj.top_half',
  avoid_relegation: 'florentino.obj.avoid_relegation',
};

interface CareerImport {
  managerName?: string;
  managerCareer?: ManagerSeasonRecord[];
  managerReputation?: number;
}

interface Props {
  teams: Team[];
  managerName: string;
  managerCareer: ManagerSeasonRecord[];
  managerReputation: number;
  yearStats: { year: number; teams: number; leagues: number; players: number }[];
  selectedYear: number | null;
  onSelectYear: (year: number) => void;
  onSelectTeam: (teamId: string, name: string) => void;
  onImport?: (data: CareerImport) => void;
  onBack: () => void;
}

export const ProManagerSetupView = ({
  teams,
  managerName: initialName,
  managerCareer,
  managerReputation,
  yearStats,
  selectedYear,
  onSelectYear,
  onSelectTeam,
  onImport,
  onBack,
}: Props) => {
  const t = useT();
  const [name, setName] = useState(initialName);
  const [expanded, setExpanded] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const data = JSON.parse(ev.target?.result as string) as CareerImport;
        if (data && typeof data === 'object') {
          onImport?.(data);
          if (data.managerName) setName(data.managerName);
        }
      } catch { /* ignore bad files */ }
      if (fileRef.current) fileRef.current.value = '';
    };
    reader.readAsText(file);
  };

  const allOffers = teamsOfferingJobs(teams, '', managerReputation);

  // Year / name selection screen
  if (!selectedYear) {
    const nameReady = name.trim().length > 0;
    const hasCareer = managerCareer.length > 0;
    const totalSeasons = managerCareer.length;
    const uniqueTeams = new Set(managerCareer.map(r => r.teamId)).size;
    const trophies = managerCareer.filter(r => r.finalPosition === 1).length;
    const totalWins = managerCareer.reduce((a, r) => a + r.wins, 0);
    const totalDraws = managerCareer.reduce((a, r) => a + r.draws, 0);
    const totalLosses = managerCareer.reduce((a, r) => a + r.losses, 0);
    const totalGames = totalWins + totalDraws + totalLosses;
    const winPct = totalGames > 0 ? Math.round((totalWins / totalGames) * 100) : 0;
    const fires = managerCareer.filter(r => r.fired).length;
    const bestSeason = hasCareer ? [...managerCareer].sort((a, b) => a.finalPosition - b.finalPosition)[0] : null;
    const worstSeason = hasCareer ? [...managerCareer].sort((a, b) => b.finalPosition - a.finalPosition)[0] : null;
    return (
      <div className="w-full max-w-[1600px] mx-auto px-2 flex flex-col gap-3 animate-in fade-in duration-300">
        <ScreenHeader
          title={t('promanager.title')}
          onBack={onBack}
          backLabel={t('btn.back')}
          actions={onImport ? (
            <>
              <button
                onClick={() => fileRef.current?.click()}
                className="of-btn-neon of-btn-neon--magenta"
                style={{ fontSize: 9, padding: '0.45rem 0.8rem' }}
              >
                {t('btn.importManager')}
              </button>
              <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleImportFile} />
            </>
          ) : undefined}
        />

        <div className={`grid grid-cols-1 gap-3 ${hasCareer ? 'lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.4fr)]' : 'lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]'}`}>
          <div className="of-card" style={{ borderColor: '#33f3ff' }}>
            <h3 className="of-card-title">{t('promanager.nameLabel')}</h3>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder={t('promanager.namePlaceholder')}
              className="of-input-neon w-full"
              maxLength={30}
              autoFocus
            />
            <p className="of-card-desc">{t('promanager.hint')}</p>
          </div>

          {hasCareer && (
            <div className="of-card" style={{ borderColor: '#6dff9b' }}>
              <h3 className="of-card-title" style={{ color: '#6dff9b', textShadow: '0 0 6px rgba(109, 255, 155, 0.7)', borderBottomColor: 'rgba(109, 255, 155, 0.35)' }}>
                Carrera del mánager
              </h3>
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <div className="of-card-desc" style={{ fontSize: 12, color: '#8a8aa8' }}>Reputación</div>
                  <div className="h-2 mt-1" style={{ background: 'rgba(9, 0, 20, 0.8)', border: '1px solid #44476a' }}>
                    <div className="h-full" style={{
                      width: `${managerReputation}%`,
                      background: managerReputation >= 70 ? '#6dff9b' : managerReputation >= 45 ? '#ffe94d' : '#ff5c8a',
                      boxShadow: `0 0 8px ${managerReputation >= 70 ? '#6dff9b' : managerReputation >= 45 ? '#ffe94d' : '#ff5c8a'}`,
                    }} />
                  </div>
                </div>
                <span style={{
                  fontFamily: "'Press Start 2P', monospace",
                  fontSize: 14,
                  color: managerReputation >= 70 ? '#6dff9b' : managerReputation >= 45 ? '#ffe94d' : '#ff5c8a',
                  textShadow: `0 0 6px ${managerReputation >= 70 ? '#6dff9b' : managerReputation >= 45 ? '#ffe94d' : '#ff5c8a'}99`,
                }}>
                  {Math.round(managerReputation)}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-1.5">
                <CareerStat label="Temporadas" value={totalSeasons} />
                <CareerStat label="Equipos" value={uniqueTeams} />
                <CareerStat label="Trofeos" value={trophies} color="#ffe94d" />
                <CareerStat label="V" value={totalWins} color="#6dff9b" />
                <CareerStat label="E" value={totalDraws} color="#ffe94d" />
                <CareerStat label="D" value={totalLosses} color="#ff5c8a" />
              </div>

              <div className="flex justify-between items-center gap-2 pt-1" style={{ borderTop: '1px solid rgba(109, 255, 155, 0.18)' }}>
                <span className="of-card-desc" style={{ fontSize: 12 }}>% Victorias</span>
                <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 12, color: '#6dff9b', textShadow: '0 0 5px rgba(109, 255, 155, 0.6)' }}>{winPct}%</span>
              </div>
              <div className="flex justify-between items-center gap-2">
                <span className="of-card-desc" style={{ fontSize: 12 }}>Despidos</span>
                <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 12, color: fires > 0 ? '#ff5c8a' : '#8a8aa8' }}>{fires}</span>
              </div>
              {bestSeason && (
                <div className="flex justify-between items-baseline gap-2">
                  <span className="of-card-desc" style={{ fontSize: 12 }}>Mejor</span>
                  <span className="of-card-desc" style={{ fontSize: 12, color: '#6dff9b', textAlign: 'right' }}>
                    {bestSeason.finalPosition}º · {bestSeason.teamName} · {bestSeason.year}
                  </span>
                </div>
              )}
              {worstSeason && totalSeasons > 1 && (
                <div className="flex justify-between items-baseline gap-2">
                  <span className="of-card-desc" style={{ fontSize: 12 }}>Peor</span>
                  <span className="of-card-desc" style={{ fontSize: 12, color: '#ff5c8a', textAlign: 'right' }}>
                    {worstSeason.finalPosition}º · {worstSeason.teamName} · {worstSeason.year}
                  </span>
                </div>
              )}
            </div>
          )}

          <div className="of-card" style={{ borderColor: '#ff4df8' }}>
            <h3 className="of-card-title" style={{ color: '#ff4df8', textShadow: '0 0 6px rgba(255, 77, 248, 0.7)', borderBottomColor: 'rgba(255, 77, 248, 0.35)' }}>
              Elige temporada
            </h3>
            {!nameReady && (
              <div className="of-pill-yellow">Escribe tu nombre primero para elegir temporada.</div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[400px] overflow-y-auto pr-1">
              {yearStats.map(({ year, teams: tc, leagues: l, players: p }) => (
                <button
                  key={year}
                  onClick={() => { if (nameReady) onSelectYear(year); }}
                  disabled={!nameReady}
                  className="of-year-tile"
                >
                  <span className="of-year-tile-year">{year}/{(year + 1).toString().slice(-2)}</span>
                  <span className="of-year-tile-meta">
                    {t('setup.teamsCount', { n: tc.toLocaleString('es-ES') })} · {l} {t('setup.leagues')} · {p.toLocaleString('es-ES')} {t('setup.playersShort')}
                  </span>
                </button>
              ))}
            </div>
          </div>
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
              className={`h-full ${managerReputation >= 70 ? 'bg-vga-light-green' : managerReputation >= 45 ? 'bg-vga-yellow' : 'bg-vga-light-red'}`}
              style={{ width: `${managerReputation}%` }}
            />
          </div>
          <span className={`text-[8px] font-bold shrink-0 ${managerReputation >= 70 ? 'text-vga-light-green' : managerReputation >= 45 ? 'text-vga-yellow' : 'text-vga-light-red'}`}>
            {Math.round(managerReputation)}
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

const CareerStat = ({ label, value, color = '#ffffff' }: { label: string; value: number; color?: string }) => (
  <div style={{ background: 'rgba(9, 0, 20, 0.5)', border: '1px solid #44476a', padding: '0.4rem 0.5rem', textAlign: 'center', clipPath: 'polygon(5px 0, 100% 0, 100% calc(100% - 5px), calc(100% - 5px) 100%, 0 100%, 0 5px)' }}>
    <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 8, color: '#8a8aa8', letterSpacing: '0.12em' }}>{label}</div>
    <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 14, color, textShadow: `0 0 5px ${color}99`, marginTop: 4 }}>{value}</div>
  </div>
);
