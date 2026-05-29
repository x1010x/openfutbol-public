import { useMemo, useState } from 'react';
import type { Team } from '../types/game.d.ts';
import type { LeagueState, PlayerSeasonRecord, SeasonHistoryEntry, StreakSpan, TeamRecords } from '../store/leagueStore';
import { extractDbId, getPlayerNameByDbId } from '../data/mockTeams';
import { formatJornadaDate } from '../engine/calendar';
import { TeamCrest } from './TeamCrest';
import { PlayerName } from './PlayerName';
import { PlayerPhoto } from './PlayerPhoto';
import { computePrice, formatEuros, playerAge } from '../data/economy';
import { useT } from '../i18n';

interface Props {
  team: Team;
  league: LeagueState;
  onPlayerClick?: (playerId: string) => void;
  onBack: () => void;
}

interface CareerRow {
  playerId: string | null;
  dbId: string;
  name: string;
  appearances: number;
  minutes: number;
  goals: number;
  assists: number;
  yellowCards: number;
  redCards: number;
  cleanSheets: number;
  seasons: number;
  currentlyOnTeam: boolean;
  nowAt: string | null;
}

const estimateAppsMins = (rec: PlayerSeasonRecord): { apps: number; mins: number } => {
  if (rec.appearances !== undefined && rec.appearances !== null) {
    return { apps: rec.appearances, mins: rec.minutes ?? rec.appearances * 90 };
  }
  const events = (rec.goals ?? 0) + (rec.assists ?? 0) + (rec.yellowCards ?? 0) + (rec.redCards ?? 0);
  const apps = events > 0 ? 22 : 8;
  return { apps, mins: apps * 80 };
};

type SortKey = 'name' | 'appearances' | 'minutes' | 'goals' | 'assists' | 'yellowCards' | 'redCards' | 'cleanSheets' | 'seasons';

const formatRecord = (r: TeamRecords['biggestWin'], opponentNameById: Map<string, string>): string => {
  if (!r) return '—';
  const opp = opponentNameById.get(r.opponentId);
  return `${r.gf}-${r.ga}${opp ? ` vs ${opp}` : ''} · J${r.jornada} · ${formatJornadaDate(r.year, r.jornada)}`;
};

const formatStreak = (count: number, span: StreakSpan | null): string => {
  if (count === 0) return '—';
  if (!span) return `${count} partidos`;
  const sameYear = span.from.year === span.to.year;
  const fromLabel = `J${span.from.jornada}${sameYear ? '' : `/${span.from.year.toString().slice(-2)}`}`;
  const toLabel = `J${span.to.jornada}${sameYear ? '' : `/${span.to.year.toString().slice(-2)}`}`;
  return span.from.jornada === span.to.jornada && span.from.year === span.to.year
    ? `${count} partidos · ${fromLabel}`
    : `${count} partidos · ${fromLabel} → ${toLabel}`;
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

const Tile = ({ label, value, color = 'text-vga-bright-white', sub }: {
  label: string; value: string; color?: string; sub?: string;
}) => (
  <div className="bg-vga-black border border-vga-blue p-2">
    <div className="text-vga-magenta text-[7px] uppercase tracking-widest truncate">{label}</div>
    <div className={`${color} text-[13px] font-bold tabular-nums truncate`}>{value}</div>
    {sub && <div className="text-vga-gray text-[7px] truncate">{sub}</div>}
  </div>
);

export const EquipoView = ({ team, league, onPlayerClick, onBack }: Props) => {
  const t = useT();
  const [sortKey, setSortKey] = useState<SortKey>('appearances');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const opponentNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of league.teams) m.set(t.id, t.name);
    return m;
  }, [league.teams]);

  const records: TeamRecords = league.teamRecords[team.id] ?? {
    biggestWin: null, heaviestDefeat: null, mostGoalsInMatch: null,
    longestUnbeaten: 0, currentUnbeaten: 0, longestWinning: 0, currentWinning: 0,
  };

  // Current season standings + form
  const teamStats = league.stats[team.id];
  const sortedStats = useMemo(() => Object.values(league.stats).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    const dgA = a.goalsFor - a.goalsAgainst, dgB = b.goalsFor - b.goalsAgainst;
    return dgB - dgA;
  }), [league.stats]);
  const currentPosition = sortedStats.findIndex(s => s.teamId === team.id) + 1;
  const totalTeams = sortedStats.length;

  const last5Form = useMemo(() => {
    const out: ('W' | 'D' | 'L')[] = [];
    for (let i = league.schedule.length - 1; i >= 0 && out.length < 5; i--) {
      const m = league.schedule[i].matches.find(x => x.played && (x.homeId === team.id || x.awayId === team.id));
      if (!m || m.homeScore == null || m.awayScore == null) continue;
      const isHome = m.homeId === team.id;
      const my = isHome ? m.homeScore : m.awayScore;
      const opp = isHome ? m.awayScore : m.homeScore;
      out.push(my > opp ? 'W' : my === opp ? 'D' : 'L');
    }
    return out.reverse();
  }, [league.schedule, team.id]);

  const historyForTeam = useMemo(() => {
    return (league.leagueHistory ?? []).map((h: SeasonHistoryEntry) => {
      const idx = h.standings.findIndex(s => s.teamId === team.id);
      return {
        year: h.year,
        position: idx === -1 ? null : idx + 1,
        champion: h.champion,
        pichichi: h.pichichi,
        zamora: h.zamora,
        mejor: h.mejorPorEquipo[team.id] ?? null,
      };
    }).sort((a, b) => b.year - a.year);
  }, [league.leagueHistory, team.id]);

  const titlesWon = historyForTeam.filter(h => h.position === 1).length;
  const podiums = historyForTeam.filter(h => h.position !== null && h.position <= 3).length;

  // Squad composition + cool aggregate stats
  const lineupSet = new Set(team.lineup);
  const lineupPlayers = team.players.filter(p => lineupSet.has(p.id));
  const lineupAvgMed = lineupPlayers.length > 0
    ? lineupPlayers.reduce((s, p) => s + p.media, 0) / lineupPlayers.length
    : 0;
  const squadValue = team.players.reduce((s, p) => s + computePrice(p, league.year), 0);
  const payroll = team.players.reduce((s, p) => s + (p.contract?.salary ?? 0), 0);
  const avgAge = team.players.length > 0
    ? team.players.reduce((s, p) => s + playerAge(p, league.year), 0) / team.players.length
    : 0;
  const ages = team.players.map(p => playerAge(p, league.year));
  const youngest = team.players[ages.indexOf(Math.min(...ages))];
  const oldest = team.players[ages.indexOf(Math.max(...ages))];
  const foreigners = new Set(team.players.map(p => p.country_code).filter(Boolean));
  const topScorer = [...team.players].sort((a, b) => b.seasonStats.goals - a.seasonStats.goals)[0];
  const topAssister = [...team.players].sort((a, b) => b.seasonStats.assists - a.seasonStats.assists)[0];
  const topPaid = [...team.players].sort((a, b) => (b.contract?.salary ?? 0) - (a.contract?.salary ?? 0))[0];
  const totalGoals = team.players.reduce((s, p) => s + p.seasonStats.goals, 0);
  const totalAssists = team.players.reduce((s, p) => s + p.seasonStats.assists, 0);
  const totalYellows = team.players.reduce((s, p) => s + p.seasonStats.yellowCards, 0);
  const totalReds = team.players.reduce((s, p) => s + p.seasonStats.redCards, 0);
  const cleanSheets = team.players.filter(p => p.preferredPos === 'POR').reduce((s, p) => s + p.seasonStats.cleanSheets, 0);

  // Squad by position
  const byPos: Record<string, number> = { POR: 0, DEF: 0, MED: 0, AML: 0, AMR: 0, DEL: 0 };
  for (const p of team.players) {
    byPos[p.position] = (byPos[p.position] ?? 0) + 1;
  }

  // Career rows
  const dbIdToCurrentTeam = useMemo(() => {
    const m = new Map<string, { teamId: string; teamName: string; playerId: string }>();
    for (const t of league.teams) {
      for (const p of t.players) m.set(extractDbId(p.id), { teamId: t.id, teamName: t.name, playerId: p.id });
    }
    return m;
  }, [league.teams]);

  const careerRows: CareerRow[] = useMemo(() => {
    const byDbId = new Map<string, CareerRow>();
    const seedRow = (dbId: string, name: string): CareerRow => ({
      playerId: null, dbId, name,
      appearances: 0, minutes: 0, goals: 0, assists: 0,
      yellowCards: 0, redCards: 0, cleanSheets: 0,
      seasons: 0, currentlyOnTeam: false, nowAt: null,
    });
    for (const [dbId, records] of Object.entries(league.playerHistory ?? {})) {
      for (const rec of records as PlayerSeasonRecord[]) {
        if (rec.teamId !== team.id) continue;
        const row = byDbId.get(dbId) ?? seedRow(dbId, '');
        const { apps, mins } = estimateAppsMins(rec);
        row.appearances += apps; row.minutes += mins;
        row.goals += rec.goals; row.assists += rec.assists;
        row.yellowCards += rec.yellowCards; row.redCards += rec.redCards;
        row.cleanSheets += rec.cleanSheets ?? 0; row.seasons++;
        if (!row.name && rec.shirtName) row.name = rec.shirtName;
        byDbId.set(dbId, row);
      }
    }
    for (const p of team.players) {
      const dbId = extractDbId(p.id);
      const row = byDbId.get(dbId) ?? seedRow(dbId, p.name);
      row.name = p.name; row.playerId = p.id; row.currentlyOnTeam = true;
      row.appearances += p.seasonStats.appearances;
      row.minutes += p.seasonStats.minutes;
      row.goals += p.seasonStats.goals;
      row.assists += p.seasonStats.assists;
      row.yellowCards += p.seasonStats.yellowCards;
      row.redCards += p.seasonStats.redCards;
      row.cleanSheets += p.seasonStats.cleanSheets;
      if (p.seasonStats.appearances > 0) row.seasons++;
      byDbId.set(dbId, row);
    }
    for (const row of byDbId.values()) {
      if (!row.name) row.name = getPlayerNameByDbId(row.dbId) ?? '';
      if (!row.currentlyOnTeam) {
        const cur = dbIdToCurrentTeam.get(row.dbId);
        if (cur) { row.nowAt = cur.teamName; row.playerId = cur.playerId; }
        else row.nowAt = 'retirado';
      }
    }
    return [...byDbId.values()].filter(r => r.seasons > 0);
  }, [league.playerHistory, team.id, team.players, dbIdToCurrentTeam]);

  const sorted = useMemo(() => {
    const out = [...careerRows];
    out.sort((a, b) => {
      let cmp: number;
      if (sortKey === 'name') cmp = a.name.localeCompare(b.name);
      else cmp = (a[sortKey] as number) - (b[sortKey] as number);
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return out;
  }, [careerRows, sortKey, sortDir]);

  const flipSort = (k: SortKey) => {
    if (sortKey === k) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(k); setSortDir('desc'); }
  };
  const sortIndicator = (k: SortKey) => sortKey === k ? (sortDir === 'asc' ? '▲' : '▼') : '';

  const topPerformers = useMemo(() => {
    return [...team.players].sort((a, b) => b.seasonStats.ratingSum - a.seasonStats.ratingSum).slice(0, 5);
  }, [team.players]);

  const formColor = (c: 'W' | 'D' | 'L') => c === 'W' ? 'bg-vga-light-green' : c === 'D' ? 'bg-vga-yellow' : 'bg-vga-light-red';

  return (
    <div className="w-full flex flex-col gap-3 animate-in fade-in duration-300 px-2">
      {/* Header strip */}
      <div className="bg-vga-black border border-vga-blue px-3 py-2 flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <TeamCrest colors={team.colors} size="lg" title={team.name} teamId={team.id} />
          <div className="min-w-0">
            <div className="text-vga-magenta text-[9px] uppercase tracking-widest">Equipo</div>
            <div className="text-vga-bright-white text-[14px] font-bold truncate">{team.name}</div>
            <div className="text-vga-gray text-[8px]">
              {currentPosition > 0 && <>POS {currentPosition}/{totalTeams} · </>}
              {teamStats ? `${teamStats.points} pts · ${teamStats.goalsFor}-${teamStats.goalsAgainst}` : 'sin jornadas jugadas'}
              {titlesWon > 0 && <> · <span className="text-vga-yellow">★ {titlesWon} título{titlesWon > 1 ? 's' : ''}</span></>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {last5Form.length > 0 && (
            <div className="flex items-center gap-1">
              <span className="text-vga-gray text-[7px] uppercase">Forma</span>
              <div className="flex gap-0.5">
                {last5Form.map((f, i) => (
                  <span key={i} className={`${formColor(f)} w-3 h-3 text-vga-black text-[7px] font-bold flex items-center justify-center`}>{f}</span>
                ))}
              </div>
            </div>
          )}
          <button onClick={onBack} className="bg-vga-red text-vga-bright-white px-3 py-1 text-[8px] border border-vga-black hover:bg-vga-light-red font-bold uppercase">
            {t('btn.back')}
          </button>
        </div>
      </div>

      {/* Headline stat tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
        <Tile label="Plantilla" value={String(team.players.length)} color="text-vga-light-cyan" sub={`${lineupPlayers.length} titulares`} />
        <Tile label="MED titulares" value={lineupAvgMed.toFixed(1)} color="text-vga-yellow" sub={`form. ${team.formation}`} />
        <Tile label="Valor plantilla" value={formatEuros(squadValue)} color="text-vga-light-green" sub={`${formatEuros(team.budget)} caja`} />
        <Tile label="Salarios/sem" value={formatEuros(payroll)} color="text-vga-light-cyan" sub={topPaid ? `★ ${topPaid.name.split(' ').pop()}` : ''} />
        <Tile label="Edad media" value={avgAge.toFixed(1)} color="text-vga-bright-white" sub={youngest && oldest ? `${ages.length ? Math.min(...ages) : 0}–${ages.length ? Math.max(...ages) : 0}` : ''} />
        <Tile label="Países" value={String(foreigners.size)} color="text-vga-cyan" sub="distintos en la plantilla" />
        <Tile label="Goles a favor" value={String(totalGoals)} color="text-vga-light-green" sub={`${totalAssists} asistencias`} />
        <Tile label="Tarjetas" value={`${totalYellows}A · ${totalReds}R`} color={totalReds > 0 ? 'text-vga-light-red' : 'text-vga-yellow'} sub={cleanSheets > 0 ? `${cleanSheets} portería(s) a cero` : ''} />
      </div>

      {/* Identity + position breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
        <Panel title="Identidad del club">
          <div className="p-3 grid grid-cols-2 gap-y-1 text-[9px]">
            <span className="text-vga-magenta uppercase text-[7px]">Entrenador</span>
            <span className="text-vga-bright-white truncate">{team.manager ?? '—'}</span>
            <span className="text-vga-magenta uppercase text-[7px]">Estadio</span>
            <span className="text-vga-bright-white truncate">{team.stadiumName ?? '—'}</span>
            <span className="text-vga-magenta uppercase text-[7px]">Aforo</span>
            <span className="text-vga-bright-white tabular-nums">{team.stadiumCapacity.toLocaleString()}</span>
            <span className="text-vga-magenta uppercase text-[7px]">Formación</span>
            <span className="text-vga-yellow font-bold">{team.formation}</span>
            <span className="text-vga-magenta uppercase text-[7px]">Disciplina táctica</span>
            <span className="text-vga-cyan">{team.tacticalDiscipline ? 'Estricta' : 'Flexible'}</span>
            <span className="text-vga-magenta uppercase text-[7px]">Precio entrada</span>
            <span className="text-vga-light-green">{formatEuros(team.ticketPrice)}</span>
          </div>
        </Panel>
        <Panel title="Composición por posición">
          <div className="p-3 grid grid-cols-6 gap-2 text-center">
            {(['POR', 'DEF', 'MED', 'AML', 'AMR', 'DEL'] as const).map(pos => {
              const max = Math.max(...Object.values(byPos), 1);
              const count = byPos[pos] ?? 0;
              const heightPct = (count / max) * 100;
              return (
                <div key={pos} className="flex flex-col items-center gap-1">
                  <div className="h-16 w-full bg-vga-blue/20 border border-vga-blue flex items-end">
                    <div className="w-full bg-vga-magenta" style={{ height: `${heightPct}%` }} />
                  </div>
                  <div className="text-vga-magenta text-[7px] uppercase">{pos}</div>
                  <div className="text-vga-bright-white text-[10px] font-bold tabular-nums">{count}</div>
                </div>
              );
            })}
          </div>
        </Panel>
      </div>

      {/* Star players */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {topScorer && topScorer.seasonStats.goals > 0 && (
          <div onClick={() => onPlayerClick?.(topScorer.id)} className={`bg-vga-black border border-vga-blue p-2 flex items-center gap-2 ${onPlayerClick ? 'cursor-pointer hover:border-vga-magenta' : ''}`}>
            <PlayerPhoto sourceId={topScorer.source_id} size="md" className="border border-vga-blue" />
            <div className="min-w-0 flex-1">
              <div className="text-vga-magenta text-[7px] uppercase tracking-widest">Pichichi local</div>
              <div className="text-vga-bright-white text-[10px] truncate"><PlayerName player={topScorer} /></div>
              <div className="text-vga-light-green text-[9px]">{topScorer.seasonStats.goals} goles</div>
            </div>
          </div>
        )}
        {topAssister && topAssister.seasonStats.assists > 0 && (
          <div onClick={() => onPlayerClick?.(topAssister.id)} className={`bg-vga-black border border-vga-blue p-2 flex items-center gap-2 ${onPlayerClick ? 'cursor-pointer hover:border-vga-magenta' : ''}`}>
            <PlayerPhoto sourceId={topAssister.source_id} size="md" className="border border-vga-blue" />
            <div className="min-w-0 flex-1">
              <div className="text-vga-magenta text-[7px] uppercase tracking-widest">Asistente del año</div>
              <div className="text-vga-bright-white text-[10px] truncate"><PlayerName player={topAssister} /></div>
              <div className="text-vga-light-cyan text-[9px]">{topAssister.seasonStats.assists} asistencias</div>
            </div>
          </div>
        )}
        {topPaid && (
          <div onClick={() => onPlayerClick?.(topPaid.id)} className={`bg-vga-black border border-vga-blue p-2 flex items-center gap-2 ${onPlayerClick ? 'cursor-pointer hover:border-vga-magenta' : ''}`}>
            <PlayerPhoto sourceId={topPaid.source_id} size="md" className="border border-vga-blue" />
            <div className="min-w-0 flex-1">
              <div className="text-vga-magenta text-[7px] uppercase tracking-widest">Mejor pagado</div>
              <div className="text-vga-bright-white text-[10px] truncate"><PlayerName player={topPaid} /></div>
              <div className="text-vga-yellow text-[9px]">{formatEuros(topPaid.contract?.salary ?? 0)}/sem</div>
            </div>
          </div>
        )}
      </div>

      {/* Récords del club */}
      <Panel title="Récords del club">
        <div className="p-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-[9px]">
          <div className="bg-vga-black border border-vga-blue p-2">
            <div className="text-vga-magenta text-[7px] uppercase">Mayor victoria</div>
            <div className="text-vga-light-green truncate">{formatRecord(records.biggestWin, opponentNameById)}</div>
          </div>
          <div className="bg-vga-black border border-vga-blue p-2">
            <div className="text-vga-magenta text-[7px] uppercase">Mayor derrota</div>
            <div className="text-vga-light-red truncate">{formatRecord(records.heaviestDefeat, opponentNameById)}</div>
          </div>
          <div className="bg-vga-black border border-vga-blue p-2">
            <div className="text-vga-magenta text-[7px] uppercase">Partido loco</div>
            <div className="text-vga-bright-white truncate">{formatRecord(records.mostGoalsInMatch, opponentNameById)}</div>
          </div>
          <div className="bg-vga-black border border-vga-blue p-2">
            <div className="text-vga-magenta text-[7px] uppercase">Racha sin perder</div>
            <div className="text-vga-yellow truncate">{formatStreak(records.longestUnbeaten, records.longestUnbeatenSpan)}</div>
            {records.currentUnbeaten > 0 && <div className="text-vga-cyan text-[7px]">Actual: {records.currentUnbeaten} partidos</div>}
          </div>
          <div className="bg-vga-black border border-vga-blue p-2">
            <div className="text-vga-magenta text-[7px] uppercase">Racha ganadora</div>
            <div className="text-vga-yellow truncate">{formatStreak(records.longestWinning, records.longestWinningSpan)}</div>
            {records.currentWinning > 0 && <div className="text-vga-cyan text-[7px]">Actual: {records.currentWinning} partidos</div>}
          </div>
          <div className="bg-vga-black border border-vga-blue p-2">
            <div className="text-vga-magenta text-[7px] uppercase">Vitrina</div>
            <div className="text-vga-yellow truncate">{titlesWon} título{titlesWon === 1 ? '' : 's'} · {podiums} podio{podiums === 1 ? '' : 's'}</div>
            <div className="text-vga-gray text-[7px]">{historyForTeam.length} temporada{historyForTeam.length === 1 ? '' : 's'} jugada{historyForTeam.length === 1 ? '' : 's'}</div>
          </div>
        </div>
      </Panel>

      {/* Top performers */}
      <Panel title="Mejor jugador · temporada actual" accent="text-vga-yellow">
        {topPerformers.every(p => p.seasonStats.ratingSum === 0) ? (
          <div className="text-vga-gray text-[8px] p-3 text-center">Aún sin partidos esta temporada.</div>
        ) : (
          <table className="w-full text-[9px]">
            <thead>
              <tr className="text-vga-magenta text-[7px] uppercase">
                <th className="text-left pl-2 py-1">#</th>
                <th className="text-left">Nombre</th>
                <th className="text-right">PJ</th>
                <th className="text-right">G</th>
                <th className="text-right">A</th>
                <th className="text-right pr-2">Puntos</th>
              </tr>
            </thead>
            <tbody>
              {topPerformers.map((p, i) => (
                <tr key={p.id} onClick={() => onPlayerClick?.(p.id)} className={onPlayerClick ? 'cursor-pointer hover:bg-vga-blue/30' : ''}>
                  <td className={`pl-2 py-0.5 ${i === 0 ? 'text-vga-yellow font-bold' : 'text-vga-magenta'}`}>{i + 1}</td>
                  <td className={i === 0 ? 'text-vga-yellow font-bold truncate' : 'text-vga-bright-white truncate'}>
                    <PlayerName player={p} />
                  </td>
                  <td className="text-right text-vga-cyan tabular-nums">{p.seasonStats.appearances}</td>
                  <td className="text-right text-vga-light-green tabular-nums">{p.seasonStats.goals}</td>
                  <td className="text-right text-vga-light-cyan tabular-nums">{p.seasonStats.assists}</td>
                  <td className="text-right pr-2 text-vga-light-green font-bold tabular-nums">{p.seasonStats.ratingSum.toFixed(0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>

      {/* Plantilla histórica */}
      <Panel title="Plantilla histórica" accent="text-vga-cyan">
        <div className="overflow-x-auto max-h-[55vh] overflow-y-auto">
          <table className="w-full text-[9px]">
            <thead className="bg-vga-black sticky top-0">
              <tr className="text-vga-magenta text-[7px] uppercase">
                <th className="pl-2 py-1 text-left cursor-pointer hover:text-vga-yellow" onClick={() => flipSort('name')}>Nombre {sortIndicator('name')}</th>
                <th className="text-right cursor-pointer hover:text-vga-yellow" onClick={() => flipSort('seasons')}>T {sortIndicator('seasons')}</th>
                <th className="text-right cursor-pointer hover:text-vga-yellow" onClick={() => flipSort('appearances')}>PJ {sortIndicator('appearances')}</th>
                <th className="text-right cursor-pointer hover:text-vga-yellow" onClick={() => flipSort('minutes')}>Min {sortIndicator('minutes')}</th>
                <th className="text-right cursor-pointer hover:text-vga-yellow" onClick={() => flipSort('goals')}>G {sortIndicator('goals')}</th>
                <th className="text-right cursor-pointer hover:text-vga-yellow" onClick={() => flipSort('assists')}>A {sortIndicator('assists')}</th>
                <th className="text-right cursor-pointer hover:text-vga-yellow" onClick={() => flipSort('yellowCards')}>TA {sortIndicator('yellowCards')}</th>
                <th className="text-right cursor-pointer hover:text-vga-yellow" onClick={() => flipSort('redCards')}>TR {sortIndicator('redCards')}</th>
                <th className="text-right pr-2 cursor-pointer hover:text-vga-yellow" onClick={() => flipSort('cleanSheets')}>CS {sortIndicator('cleanSheets')}</th>
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 ? (
                <tr><td colSpan={9} className="p-3 text-center text-vga-gray text-[8px]">Aún no se ha jugado ningún partido.</td></tr>
              ) : sorted.map(r => (
                <tr key={r.dbId} onClick={() => r.playerId && onPlayerClick?.(r.playerId)} className={r.playerId ? 'cursor-pointer hover:bg-vga-blue/30' : ''}>
                  <td className="pl-2 py-0.5">
                    <div className="flex flex-col">
                      <span className={r.currentlyOnTeam ? 'text-vga-bright-white' : 'text-vga-light-cyan italic'}>{r.name || `#${r.dbId.slice(0, 6)}`}</span>
                      {!r.currentlyOnTeam && r.nowAt && (
                        <span className="text-[7px] text-vga-magenta">ahora: {r.nowAt}</span>
                      )}
                    </div>
                  </td>
                  <td className="text-right text-vga-yellow tabular-nums">{r.seasons}</td>
                  <td className="text-right text-vga-bright-white tabular-nums">{r.appearances}</td>
                  <td className="text-right text-vga-bright-white tabular-nums">{r.minutes}</td>
                  <td className="text-right text-vga-light-green tabular-nums">{r.goals}</td>
                  <td className="text-right text-vga-light-cyan tabular-nums">{r.assists}</td>
                  <td className="text-right text-vga-yellow tabular-nums">{r.yellowCards}</td>
                  <td className="text-right text-vga-light-red tabular-nums">{r.redCards}</td>
                  <td className="text-right pr-2 text-vga-light-green tabular-nums">{r.cleanSheets}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      {/* Salón de trofeos */}
      <Panel title="Salón de trofeos" accent="text-vga-yellow">
        {historyForTeam.length === 0 ? (
          <div className="text-vga-gray text-[8px] p-3 text-center">Aún no hay temporadas completadas.</div>
        ) : (
          <table className="w-full text-[9px]">
            <thead>
              <tr className="text-vga-magenta text-[7px] uppercase">
                <th className="pl-2 py-1 text-left">Año</th>
                <th className="text-center">Pos</th>
                <th className="text-left">Campeón</th>
                <th className="text-left">Pichichi</th>
                <th className="text-left">Zamora</th>
                <th className="text-left pr-2">MVP</th>
              </tr>
            </thead>
            <tbody>
              {historyForTeam.map(h => (
                <tr key={h.year}>
                  <td className="pl-2 py-0.5 text-vga-yellow font-bold tabular-nums">{h.year}/{(h.year + 1).toString().slice(-2)}</td>
                  <td className={`text-center font-bold tabular-nums ${h.position === 1 ? 'text-vga-yellow' : 'text-vga-bright-white'}`}>
                    {h.position ? `${h.position}º` : '—'}{h.position === 1 ? ' ★' : ''}
                  </td>
                  <td className="text-vga-light-green truncate">{h.champion || '—'}</td>
                  <td className="text-vga-bright-white truncate">{h.pichichi ? `${h.pichichi.playerName} (${h.pichichi.value}g)` : '—'}</td>
                  <td className="text-vga-bright-white truncate">{h.zamora ? `${h.zamora.playerName} (${h.zamora.value.toFixed(2)})` : '—'}</td>
                  <td className="text-vga-bright-white truncate pr-2">{h.mejor ? `${h.mejor.playerName} (${h.mejor.ratingSum.toFixed(0)})` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  );
};
