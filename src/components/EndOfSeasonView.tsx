import type { Player } from '../types/game.d.ts';
import type { LeagueState, TeamRecords, TransferRecord } from '../store/leagueStore';
import { MAX_SEASON_YEAR } from '../store/leagueStore';
import { playerAge } from '../data/economy';
import { PlayerName } from './PlayerName';
import { PlayerPhoto } from './PlayerPhoto';
import { TeamCrest } from './TeamCrest';
import { LeagueTable } from './LeagueTable';
import type { StatKey } from './StatDrillDown';
import { useT } from '../i18n';

interface Props {
  league: LeagueState;
  onContinueSameTeam?: () => void;
  onAdvanceAndChangeTeam?: () => void;
  onResetGame?: () => void;
  onCellClick?: (teamId: string, stat: StatKey) => void;
  onTeamClick?: (teamId: string) => void;
  onPlayerClick?: (playerId: string) => void;
  hideActions?: boolean;
}

const fmtEur = (n: number): string => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M €`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K €`;
  return `${n} €`;
};

const Panel = ({ title, accent = 'text-vga-magenta', children, className = '' }: {
  title: string; accent?: string; children: React.ReactNode; className?: string;
}) => (
  <div className={`bg-vga-black border border-vga-blue flex flex-col ${className}`}>
    <div className={`${accent} text-[9px] uppercase tracking-widest px-2 py-1 border-b border-vga-blue`}>
      {title}
    </div>
    <div className="p-2 flex-1">{children}</div>
  </div>
);

const StatCard = ({ label, primary, secondary, photoId, valueColor = 'text-vga-light-green', size = 'md', onClick, player }: {
  label: string;
  primary: string;
  secondary?: string;
  photoId?: number;
  valueColor?: string;
  size?: 'md' | 'lg';
  onClick?: () => void;
  player?: Player;
}) => {
  const photoSize = size === 'lg' ? 'lg' : 'md';
  const primaryClass = `text-vga-bright-white truncate ${size === 'lg' ? 'text-[11px]' : 'text-[10px]'}`;
  return (
    <div
      onClick={onClick}
      className={`bg-vga-black border border-vga-blue p-2 flex items-center gap-3 ${onClick ? 'cursor-pointer hover:border-vga-magenta' : ''}`}
    >
      {photoId !== undefined && <PlayerPhoto sourceId={photoId} size={photoSize} className="border border-vga-blue" />}
      <div className="min-w-0 flex-1">
        <div className="text-vga-magenta text-[8px] uppercase tracking-widest truncate">{label}</div>
        {player
          ? <div className={primaryClass}><PlayerName player={player} /></div>
          : <div className={primaryClass}>{primary}</div>}
        {secondary && <div className={`${valueColor} text-[9px] truncate`}>{secondary}</div>}
      </div>
    </div>
  );
};

export const EndOfSeasonView = ({ league, onContinueSameTeam, onAdvanceAndChangeTeam, onResetGame, onCellClick, onTeamClick, onPlayerClick, hideActions }: Props) => {
  const t = useT();
  const { teams, stats, userTeamId, teamRecords, transferLog, finances, gameMode, florentinometroPeak, florentinometroMin, boardObjective, boardWarnings, schedule } = league;
  const year = teams[0]?.year ?? 0;
  const atCap = year >= MAX_SEASON_YEAR;

  // ── Classification ───────────────────────────────────────────────────────
  const sortedStats = Object.values(stats).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    const dgA = a.goalsFor - a.goalsAgainst;
    const dgB = b.goalsFor - b.goalsAgainst;
    if (dgB !== dgA) return dgB - dgA;
    return b.goalsFor - a.goalsFor;
  });
  const champion = sortedStats[0];
  const championTeam = teams.find(t => t.id === champion?.teamId) ?? null;
  const userIsChampion = champion?.teamId === userTeamId;

  // ── Player pools ─────────────────────────────────────────────────────────
  type EnrichedPlayer = Player & { teamName: string; teamId: string };
  const allPlayers: EnrichedPlayer[] = teams.flatMap(team =>
    team.players.map(p => ({ ...p, teamName: team.name, teamId: team.id }))
  );
  const withApps = allPlayers.filter(p => p.seasonStats.appearances > 0);
  // Minimum appearances required to qualify for rate-based / "regular" awards.
  // 50% of a team's played matches, with a floor of 5 so it never drops to
  // "1 game with a 9.0 rating wins MVP".
  const perTeamMatches = Math.max(...Object.values(stats).map(s => s.played), 0);
  const minAppsRegular = Math.max(5, Math.floor(perTeamMatches * 0.5));

  // ── Hero awards ──────────────────────────────────────────────────────────
  const pichichi = [...allPlayers].sort((a, b) => b.seasonStats.goals - a.seasonStats.goals)[0];
  const topAssister = [...allPlayers].sort((a, b) => b.seasonStats.assists - a.seasonStats.assists)[0];

  const eligibleGks = allPlayers.filter(p => p.position === 'POR' && p.seasonStats.appearances >= minAppsRegular);
  const zamora = [...eligibleGks].sort((a, b) =>
    (a.seasonStats.goalsAgainst / a.seasonStats.appearances) - (b.seasonStats.goalsAgainst / b.seasonStats.appearances)
  )[0];

  const mvpPool = withApps.filter(p => p.seasonStats.appearances >= minAppsRegular);
  const mvp = [...mvpPool].sort((a, b) =>
    (b.seasonStats.ratingSum / Math.max(1, b.seasonStats.appearances)) -
    (a.seasonStats.ratingSum / Math.max(1, a.seasonStats.appearances))
  )[0];
  const mvpAvg = mvp ? (mvp.seasonStats.ratingSum / Math.max(1, mvp.seasonStats.appearances)).toFixed(2) : '0';

  // ── Team-level records ──────────────────────────────────────────────────
  const totalGoals = sortedStats.reduce((sum, s) => sum + s.goalsFor, 0);
  const matchesPlayed = sortedStats.reduce((sum, s) => sum + s.played, 0) / 2;
  const avgGoalsPerMatch = matchesPlayed > 0 ? (totalGoals / matchesPlayed).toFixed(2) : '0.00';
  const bestAttack = [...sortedStats].sort((a, b) => b.goalsFor - a.goalsFor)[0];
  const bestDefense = [...sortedStats].sort((a, b) => a.goalsAgainst - b.goalsAgainst)[0];
  const mostDraws = [...sortedStats].sort((a, b) => b.drawn - a.drawn)[0];

  const teamNameById = (id: string): string => teams.find(t => t.id === id)?.name ?? '???';
  const fmtScoreVs = (rec: NonNullable<TeamRecords['biggestWin']>, ownTeamName: string, isHome = true): string => {
    const a = isHome ? rec.gf : rec.ga;
    const b = isHome ? rec.ga : rec.gf;
    return `${ownTeamName} ${a}-${b} ${teamNameById(rec.opponentId)} (J${rec.jornada})`;
  };

  let biggestWin: { ownerName: string; rec: NonNullable<TeamRecords['biggestWin']> } | null = null;
  let heaviestDefeat: { ownerName: string; rec: NonNullable<TeamRecords['heaviestDefeat']> } | null = null;
  let craziestMatch: { ownerName: string; rec: NonNullable<TeamRecords['mostGoalsInMatch']> } | null = null;
  let longestUnbeaten: { teamName: string; runs: number } | null = null;
  let longestWinning: { teamName: string; runs: number } | null = null;

  for (const [teamId, rec] of Object.entries(teamRecords ?? {})) {
    const team = teams.find(t => t.id === teamId);
    if (!team) continue;
    if (rec.biggestWin && rec.biggestWin.year === year) {
      const diff = rec.biggestWin.gf - rec.biggestWin.ga;
      const curDiff = biggestWin ? biggestWin.rec.gf - biggestWin.rec.ga : -1;
      if (diff > curDiff) biggestWin = { ownerName: team.name, rec: rec.biggestWin };
    }
    if (rec.heaviestDefeat && rec.heaviestDefeat.year === year) {
      const diff = rec.heaviestDefeat.ga - rec.heaviestDefeat.gf;
      const curDiff = heaviestDefeat ? heaviestDefeat.rec.ga - heaviestDefeat.rec.gf : -1;
      if (diff > curDiff) heaviestDefeat = { ownerName: team.name, rec: rec.heaviestDefeat };
    }
    if (rec.mostGoalsInMatch && rec.mostGoalsInMatch.year === year) {
      const total = rec.mostGoalsInMatch.gf + rec.mostGoalsInMatch.ga;
      const curTotal = craziestMatch ? craziestMatch.rec.gf + craziestMatch.rec.ga : -1;
      if (total > curTotal) craziestMatch = { ownerName: team.name, rec: rec.mostGoalsInMatch };
    }
    if ((rec.longestUnbeaten ?? 0) > (longestUnbeaten?.runs ?? 0)) {
      longestUnbeaten = { teamName: team.name, runs: rec.longestUnbeaten };
    }
    if ((rec.longestWinning ?? 0) > (longestWinning?.runs ?? 0)) {
      longestWinning = { teamName: team.name, runs: rec.longestWinning };
    }
  }

  // ── Curiosidades ────────────────────────────────────────────────────────
  const teamsAvgAge = teams.map(team => {
    const roster = team.players.length ? team.players : [];
    const avg = roster.length === 0 ? 0 : roster.reduce((s, p) => s + playerAge(p, year), 0) / roster.length;
    return { team, avgAge: avg };
  });
  const youngestTeam = [...teamsAvgAge].filter(t => t.avgAge > 0).sort((a, b) => a.avgAge - b.avgAge)[0];
  const oldestTeam = [...teamsAvgAge].sort((a, b) => b.avgAge - a.avgAge)[0];

  const scorers = allPlayers.filter(p => p.seasonStats.goals > 0);
  const youngestScorer = [...scorers].sort((a, b) => playerAge(a, year) - playerAge(b, year))[0];
  const oldestScorer = [...scorers].sort((a, b) => playerAge(b, year) - playerAge(a, year))[0];
  const youngestRegular = [...withApps].filter(p => p.seasonStats.appearances >= minAppsRegular).sort((a, b) => playerAge(a, year) - playerAge(b, year))[0];
  const oldestActive = [...withApps].filter(p => p.seasonStats.appearances >= minAppsRegular).sort((a, b) => playerAge(b, year) - playerAge(a, year))[0];

  const mostYellows = [...allPlayers].sort((a, b) => b.seasonStats.yellowCards - a.seasonStats.yellowCards)[0];
  const mostReds = [...allPlayers].sort((a, b) => b.seasonStats.redCards - a.seasonStats.redCards)[0];

  const phantom = [...withApps]
    .filter(p => p.seasonStats.appearances >= minAppsRegular && p.seasonStats.goals === 0 && p.seasonStats.assists === 0 && p.position !== 'POR')
    .sort((a, b) => b.seasonStats.appearances - a.seasonStats.appearances)[0];

  const teamCards = teams.map(team => ({
    team,
    yellow: team.players.reduce((s, p) => s + p.seasonStats.yellowCards, 0),
    red: team.players.reduce((s, p) => s + p.seasonStats.redCards, 0),
  }));
  const cardScored = teamCards.map(c => ({ ...c, total: c.yellow + c.red * 3 }));
  const mostViolent = [...cardScored].sort((a, b) => b.total - a.total)[0];
  const mostFair = [...cardScored].sort((a, b) => a.total - b.total)[0];

  // Foreigners: count by country_code != home team's country (we don't have team.country here so just count distinct countries)
  const teamForeignCounts = teams.map(team => {
    const countries = new Set(team.players.map(p => p.country_code).filter(Boolean));
    return { team, distinct: countries.size };
  });
  const mostForeign = [...teamForeignCounts].sort((a, b) => b.distinct - a.distinct)[0];
  const distinctCountries = new Set(allPlayers.map(p => p.country_code).filter(Boolean)).size;

  // Squad valuations / wage bills
  const teamValuations = teams.map(team => ({
    team,
    squadValue: team.players.reduce((s, p) => s + (p.value ?? 0), 0),
    payroll: team.players.reduce((s, p) => s + (p.contract?.salary ?? 0), 0),
  }));
  const richestSquad = [...teamValuations].sort((a, b) => b.squadValue - a.squadValue)[0];
  const biggestPayroll = [...teamValuations].sort((a, b) => b.payroll - a.payroll)[0];
  const tightestPayroll = [...teamValuations].sort((a, b) => a.payroll - b.payroll)[0];

  // ── Market ──────────────────────────────────────────────────────────────
  const yearTransfers: TransferRecord[] = (transferLog ?? []).filter(r => r.year === year);
  const realTransfers = yearTransfers.filter(r => (r.kind ?? 'transfer') === 'transfer' && r.amount > 0);
  const biggestTransfer = [...realTransfers].sort((a, b) => b.amount - a.amount)[0];
  const retirementsThisYear = yearTransfers.filter(r => r.kind === 'retirement');
  const retirementsSortedByAge = [...retirementsThisYear].sort((a, b) => (b.retirementAge ?? 0) - (a.retirementAge ?? 0));

  // ── Finances ────────────────────────────────────────────────────────────
  const teamIncome = (finances && teams.map(team => ({
    team,
    income: finances[team.id]?.seasonIncome ?? 0,
    salaries: finances[team.id]?.seasonSalaries ?? 0,
  }))) || [];
  const richestEarner = [...teamIncome].sort((a, b) => b.income - a.income)[0];

  // ── Render ──────────────────────────────────────────────────────────────
  const yy = (y: number) => (y + 1).toString().slice(-2);

  return (
    <div className="w-full flex flex-col gap-3 animate-in fade-in duration-300 px-2">
      {/* Header */}
      <div className="bg-vga-black border border-vga-blue px-3 py-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-vga-magenta text-[9px] uppercase tracking-widest">Fin de Temporada</span>
          <span className="text-vga-bright-white text-[12px] font-bold">{year}/{(year + 1).toString().slice(-2)}</span>
        </div>
        <div className="text-[8px] text-vga-gray">
          {teams.length} equipos · {matchesPlayed} partidos · {totalGoals} goles · {avgGoalsPerMatch} g/p
        </div>
      </div>

      {/* Hero trophy strip: champion (wide) + pichichi/zamora/mvp (3 narrower) */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
        <div
          onClick={championTeam && onTeamClick ? () => onTeamClick(championTeam.id) : undefined}
          className={`md:col-span-2 bg-vga-black border-2 border-vga-yellow p-3 flex items-center gap-4 ${onTeamClick && championTeam ? 'cursor-pointer hover:border-vga-bright-white' : ''}`}
        >
          <TeamCrest teamId={championTeam?.id} colors={championTeam?.colors} size="lg" title={championTeam?.name} />
          <div className="min-w-0 flex-1">
            <div className="text-vga-yellow text-[9px] uppercase tracking-widest">Campeón de Liga</div>
            <div className="text-vga-bright-white text-[16px] font-bold truncate">{championTeam?.name ?? champion?.name}</div>
            <div className="text-vga-light-green text-[10px] mt-1">{champion?.points ?? 0} pts · DG {((champion?.goalsFor ?? 0) - (champion?.goalsAgainst ?? 0))} · {champion?.won}V {champion?.drawn}E {champion?.lost}D</div>
            {userIsChampion && <div className="text-vga-yellow text-[9px] mt-1 animate-pulse">¡SOIS CAMPEONES!</div>}
          </div>
        </div>
        {pichichi && pichichi.seasonStats.goals > 0 && (
          <StatCard label="Pichichi" primary={pichichi.name} secondary={`${pichichi.teamName} · ${pichichi.seasonStats.goals} goles`} photoId={pichichi.source_id} size="lg" onClick={onPlayerClick ? () => onPlayerClick(pichichi.id) : undefined} player={pichichi} />
        )}
        {zamora && (
          <StatCard label="Zamora" primary={zamora.name} secondary={`${zamora.teamName} · ${(zamora.seasonStats.goalsAgainst / zamora.seasonStats.appearances).toFixed(2)} GC/p`} photoId={zamora.source_id} valueColor="text-vga-light-red" size="lg" onClick={onPlayerClick ? () => onPlayerClick(zamora.id) : undefined} player={zamora} />
        )}
        {mvp && (
          <StatCard label="MVP" primary={mvp.name} secondary={`${mvp.teamName} · ${mvpAvg} avg`} photoId={mvp.source_id} valueColor="text-vga-light-cyan" size="lg" onClick={onPlayerClick ? () => onPlayerClick(mvp.id) : undefined} player={mvp} />
        )}
      </div>

      {/* Main grid: classification | records */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-2">
        <Panel title="Clasificación final" className="lg:col-span-2">
          <LeagueTable
            stats={stats}
            schedule={schedule}
            teams={teams}
            userTeamId={userTeamId}
            onCellClick={onCellClick}
            onTeamClick={onTeamClick}
          />
        </Panel>

        <Panel title="Récords">
          <div className="flex flex-col gap-2 text-[8px]">
            {biggestWin && (
              <div>
                <div className="text-vga-magenta text-[7px] uppercase">Goleada del año</div>
                <div className="text-vga-bright-white truncate">{fmtScoreVs(biggestWin.rec, biggestWin.ownerName, true)}</div>
              </div>
            )}
            {heaviestDefeat && (
              <div>
                <div className="text-vga-magenta text-[7px] uppercase">Ridículo del año</div>
                <div className="text-vga-bright-white truncate">{fmtScoreVs(heaviestDefeat.rec, heaviestDefeat.ownerName, false)}</div>
              </div>
            )}
            {craziestMatch && (
              <div>
                <div className="text-vga-magenta text-[7px] uppercase">Partido loco</div>
                <div className="text-vga-bright-white truncate">{fmtScoreVs(craziestMatch.rec, craziestMatch.ownerName, true)} · {craziestMatch.rec.gf + craziestMatch.rec.ga}g</div>
              </div>
            )}
            {longestUnbeaten && longestUnbeaten.runs > 0 && (
              <div>
                <div className="text-vga-magenta text-[7px] uppercase">Racha invicta</div>
                <div className="text-vga-bright-white truncate">{longestUnbeaten.teamName} · {longestUnbeaten.runs} jornadas</div>
              </div>
            )}
            {longestWinning && longestWinning.runs > 0 && (
              <div>
                <div className="text-vga-magenta text-[7px] uppercase">Mejor racha ganadora</div>
                <div className="text-vga-bright-white truncate">{longestWinning.teamName} · {longestWinning.runs} victorias</div>
              </div>
            )}
            {bestAttack && (
              <div>
                <div className="text-vga-magenta text-[7px] uppercase">Ataque atómico</div>
                <div className="text-vga-bright-white truncate">{bestAttack.name} <span className="text-vga-light-green">· {bestAttack.goalsFor}G</span></div>
              </div>
            )}
            {bestDefense && (
              <div>
                <div className="text-vga-magenta text-[7px] uppercase">El muro</div>
                <div className="text-vga-bright-white truncate">{bestDefense.name} <span className="text-vga-light-red">· {bestDefense.goalsAgainst} encajados</span></div>
              </div>
            )}
            {mostDraws && (
              <div>
                <div className="text-vga-magenta text-[7px] uppercase">Mr. Empate</div>
                <div className="text-vga-bright-white truncate">{mostDraws.name} <span className="text-vga-light-cyan">· {mostDraws.drawn} empates</span></div>
              </div>
            )}
          </div>
        </Panel>
      </div>

      {/* Player oddities */}
      <Panel title="Datos curiosos · Jugadores">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          {(() => {
            const click = (p: EnrichedPlayer) => onPlayerClick ? () => onPlayerClick(p.id) : undefined;
            return (
              <>
                {topAssister && topAssister.seasonStats.assists > 0 && (
                  <StatCard label="Olé olé · asistencias" primary={topAssister.name} secondary={`${topAssister.teamName} · ${topAssister.seasonStats.assists} ast.`} photoId={topAssister.source_id} valueColor="text-vga-light-cyan" onClick={click(topAssister)} player={topAssister} />
                )}
                {youngestRegular && (
                  <StatCard label="Más joven (titular)" primary={youngestRegular.name} secondary={`${youngestRegular.teamName} · ${playerAge(youngestRegular, year)} años`} photoId={youngestRegular.source_id} valueColor="text-vga-light-green" onClick={click(youngestRegular)} player={youngestRegular} />
                )}
                {oldestActive && (
                  <StatCard label="El abuelo" primary={oldestActive.name} secondary={`${oldestActive.teamName} · ${playerAge(oldestActive, year)} años`} photoId={oldestActive.source_id} valueColor="text-vga-light-cyan" onClick={click(oldestActive)} player={oldestActive} />
                )}
                {oldestScorer && (
                  <StatCard label="Joaquín Award" primary={oldestScorer.name} secondary={`${playerAge(oldestScorer, year)} años · ${oldestScorer.seasonStats.goals}G`} photoId={oldestScorer.source_id} valueColor="text-vga-light-cyan" onClick={click(oldestScorer)} player={oldestScorer} />
                )}
                {youngestScorer && (
                  <StatCard label="Goleador joven" primary={youngestScorer.name} secondary={`${playerAge(youngestScorer, year)} años · ${youngestScorer.seasonStats.goals}G`} photoId={youngestScorer.source_id} valueColor="text-vga-light-green" onClick={click(youngestScorer)} player={youngestScorer} />
                )}
                {mostYellows && mostYellows.seasonStats.yellowCards > 0 && (
                  <StatCard label="El duro" primary={mostYellows.name} secondary={`${mostYellows.teamName} · ${mostYellows.seasonStats.yellowCards} TA`} photoId={mostYellows.source_id} valueColor="text-vga-yellow" onClick={click(mostYellows)} player={mostYellows} />
                )}
                {mostReds && mostReds.seasonStats.redCards > 0 && (
                  <StatCard label="Sheriff" primary={mostReds.name} secondary={`${mostReds.teamName} · ${mostReds.seasonStats.redCards} TR`} photoId={mostReds.source_id} valueColor="text-vga-light-red" onClick={click(mostReds)} player={mostReds} />
                )}
                {phantom && (
                  <StatCard label="El fantasma" primary={phantom.name} secondary={`${phantom.teamName} · ${phantom.seasonStats.appearances} PJ · 0G·0A`} photoId={phantom.source_id} valueColor="text-vga-gray" onClick={click(phantom)} player={phantom} />
                )}
              </>
            );
          })()}
        </div>
      </Panel>

      {/* Team curiosities */}
      <Panel title="Datos curiosos · Equipos">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 text-[8px]">
          {youngestTeam && (
            <div className="bg-vga-black border border-vga-blue p-2">
              <div className="text-vga-magenta text-[7px] uppercase">Equipo más joven</div>
              <div className="text-vga-bright-white truncate">{youngestTeam.team.name}</div>
              <div className="text-vga-light-green">{youngestTeam.avgAge.toFixed(1)} años</div>
            </div>
          )}
          {oldestTeam && (
            <div className="bg-vga-black border border-vga-blue p-2">
              <div className="text-vga-magenta text-[7px] uppercase">Equipo más veterano</div>
              <div className="text-vga-bright-white truncate">{oldestTeam.team.name}</div>
              <div className="text-vga-light-cyan">{oldestTeam.avgAge.toFixed(1)} años</div>
            </div>
          )}
          {mostFair && (
            <div className="bg-vga-black border border-vga-blue p-2">
              <div className="text-vga-magenta text-[7px] uppercase">Juego limpio</div>
              <div className="text-vga-bright-white truncate">{mostFair.team.name}</div>
              <div className="text-vga-light-green">{mostFair.yellow} TA · {mostFair.red} TR</div>
            </div>
          )}
          {mostViolent && (
            <div className="bg-vga-black border border-vga-blue p-2">
              <div className="text-vga-magenta text-[7px] uppercase">Molino de tarjetas</div>
              <div className="text-vga-bright-white truncate">{mostViolent.team.name}</div>
              <div className="text-vga-light-red">{mostViolent.yellow} TA · {mostViolent.red} TR</div>
            </div>
          )}
          {mostForeign && mostForeign.distinct > 0 && (
            <div className="bg-vga-black border border-vga-blue p-2">
              <div className="text-vga-magenta text-[7px] uppercase">Extranjerización</div>
              <div className="text-vga-bright-white truncate">{mostForeign.team.name}</div>
              <div className="text-vga-light-cyan">{mostForeign.distinct} países</div>
            </div>
          )}
          <div className="bg-vga-black border border-vga-blue p-2">
            <div className="text-vga-magenta text-[7px] uppercase">Liga de naciones</div>
            <div className="text-vga-bright-white">{distinctCountries}</div>
            <div className="text-vga-gray">países en la liga</div>
          </div>
          {richestSquad && (
            <div className="bg-vga-black border border-vga-blue p-2">
              <div className="text-vga-magenta text-[7px] uppercase">Equipo más valioso</div>
              <div className="text-vga-bright-white truncate">{richestSquad.team.name}</div>
              <div className="text-vga-light-green">{fmtEur(richestSquad.squadValue)}</div>
            </div>
          )}
          {biggestPayroll && (
            <div className="bg-vga-black border border-vga-blue p-2">
              <div className="text-vga-magenta text-[7px] uppercase">El jeque</div>
              <div className="text-vga-bright-white truncate">{biggestPayroll.team.name}</div>
              <div className="text-vga-yellow">{fmtEur(biggestPayroll.payroll)}/sem</div>
            </div>
          )}
          {tightestPayroll && (
            <div className="bg-vga-black border border-vga-blue p-2">
              <div className="text-vga-magenta text-[7px] uppercase">El tacaño</div>
              <div className="text-vga-bright-white truncate">{tightestPayroll.team.name}</div>
              <div className="text-vga-gray">{fmtEur(tightestPayroll.payroll)}/sem</div>
            </div>
          )}
          {richestEarner && (
            <div className="bg-vga-black border border-vga-blue p-2">
              <div className="text-vga-magenta text-[7px] uppercase">Más ingresos</div>
              <div className="text-vga-bright-white truncate">{richestEarner.team.name}</div>
              <div className="text-vga-light-green">{fmtEur(richestEarner.income)}</div>
            </div>
          )}
        </div>
      </Panel>

      {/* Mercado + Bajas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
        <Panel title="Mercado">
          <div className="flex flex-col gap-2 text-[8px]">
            {biggestTransfer ? (
              <div>
                <div className="text-vga-magenta text-[7px] uppercase">Fichaje del año</div>
                <div className="text-vga-bright-white truncate">{biggestTransfer.playerName}</div>
                <div className="text-vga-light-green">{biggestTransfer.fromTeamName ?? 'Libre'} → {biggestTransfer.toTeamName} · {fmtEur(biggestTransfer.amount)}</div>
              </div>
            ) : (
              <div className="text-vga-gray">Sin movimientos relevantes este año.</div>
            )}
            <div>
              <div className="text-vga-magenta text-[7px] uppercase">Total operaciones</div>
              <div className="text-vga-bright-white">{realTransfers.length} fichajes · {retirementsThisYear.length} retiros</div>
            </div>
          </div>
        </Panel>

        <Panel title={`Bajas · Retiros (${retirementsThisYear.length})`}>
          {retirementsThisYear.length === 0 ? (
            <div className="text-vga-gray text-[8px]">Ningún jugador se ha retirado esta temporada.</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-[8px] max-h-48 overflow-y-auto pr-1">
              {retirementsSortedByAge.slice(0, 12).map(r => (
                <div key={r.id} className="bg-vga-black border border-vga-blue px-2 py-1 flex justify-between items-center">
                  <div className="min-w-0 truncate">
                    <span className="text-vga-magenta mr-1">{r.playerPosition}</span>
                    <span className="text-vga-bright-white">{r.playerName}</span>
                    <span className="text-vga-gray"> · {r.fromTeamName}</span>
                  </div>
                  {r.retirementAge != null && <span className="text-vga-light-cyan shrink-0 ml-2">{r.retirementAge} años</span>}
                </div>
              ))}
              {retirementsSortedByAge.length > 12 && (
                <div className="text-vga-gray col-span-full text-center">+{retirementsSortedByAge.length - 12} más…</div>
              )}
            </div>
          )}
        </Panel>
      </div>

      {/* Pro Manager flavour */}
      {gameMode === 'promanager' && !hideActions && (
        <Panel title="Pro Manager" accent="text-vga-yellow">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[8px]">
            <div className="bg-vga-black border border-vga-blue p-2">
              <div className="text-vga-magenta text-[7px] uppercase">Florentinómetro pico</div>
              <div className="text-vga-light-green text-[10px] font-bold">{florentinometroPeak ?? '?'}</div>
            </div>
            <div className="bg-vga-black border border-vga-blue p-2">
              <div className="text-vga-magenta text-[7px] uppercase">Florentinómetro mínimo</div>
              <div className="text-vga-light-red text-[10px] font-bold">{florentinometroMin ?? '?'}</div>
            </div>
            <div className="bg-vga-black border border-vga-blue p-2">
              <div className="text-vga-magenta text-[7px] uppercase">Objetivo</div>
              <div className="text-vga-bright-white">{boardObjective ?? '—'}</div>
            </div>
            <div className="bg-vga-black border border-vga-blue p-2">
              <div className="text-vga-magenta text-[7px] uppercase">Avisos</div>
              <div className="text-vga-light-red text-[10px] font-bold">{boardWarnings ?? 0}</div>
            </div>
          </div>
        </Panel>
      )}

      {/* Continue buttons */}
      {hideActions ? null : atCap ? (
        <div className="flex flex-col gap-2">
          <div className="bg-vga-black border-2 border-vga-yellow p-3 text-center">
            <p className="text-vga-yellow text-xs font-bold uppercase">{t('misc.gameOver')}</p>
            <p className="text-vga-bright-white text-[8px] mt-2 uppercase">
              {t('misc.atCap', { year: String(MAX_SEASON_YEAR), yy: yy(MAX_SEASON_YEAR) })}
            </p>
          </div>
          <button onClick={onResetGame} className="w-full bg-vga-red hover:bg-vga-light-red text-vga-bright-white py-3 px-4 border-b-4 border-r-4 border-vga-black active:border-0 text-xs font-bold">
            {t('btn.newGame')}
          </button>
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row gap-2">
          <button onClick={onContinueSameTeam} className="flex-1 bg-vga-green hover:bg-vga-light-green text-vga-bright-white py-3 px-4 border-b-4 border-r-4 border-vga-black active:border-0 text-xs font-bold">
            {t('misc.continueNextSeason', { year: String(year + 1), yy: yy(year + 1) })}
          </button>
          <button onClick={onAdvanceAndChangeTeam} className="bg-vga-blue hover:bg-vga-light-blue text-vga-bright-white py-2 px-4 border-b-4 border-r-4 border-vga-black active:border-0 text-[10px] font-bold">
            {t('btn.changeTeam')}
          </button>
        </div>
      )}
    </div>
  );
};

// PlayerName import retained for potential future use (suppresses lint by referencing)
void PlayerName;
