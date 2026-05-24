import { useMemo, useState } from 'react';
import type { Team } from '../types/game.d.ts';
import type { LeagueState, PlayerSeasonRecord, SeasonHistoryEntry, StreakSpan, TeamRecords } from '../store/leagueStore';
import { extractDbId, getPlayerNameByDbId } from '../data/mockTeams';
import { formatJornadaDate } from '../engine/calendar';
import { TeamCrest } from './TeamCrest';
import { PlayerName } from './PlayerName';
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

// Estima apps/min para registros antiguos (anteriores a v0.7.0) que no traían esos campos.
// Heurística simple: si tuvo eventos (goles/asist./tarjetas) jugó ~22 partidos; si no, ~8.
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

  // Trofeos: temporadas pasadas con posición + premios
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

  // Índice global: dbId -> equipo actual (cualquiera, no sólo este). Para mostrar "ahora en X" en ex-jugadores.
  const dbIdToCurrentTeam = useMemo(() => {
    const m = new Map<string, { teamId: string; teamName: string; playerId: string }>();
    for (const t of league.teams) {
      for (const p of t.players) {
        m.set(extractDbId(p.id), { teamId: t.id, teamName: t.name, playerId: p.id });
      }
    }
    return m;
  }, [league.teams]);

  // Plantilla histórica: union de jugadores actuales + cualquier dbId con record histórico en este equipo.
  const careerRows: CareerRow[] = useMemo(() => {
    const byDbId = new Map<string, CareerRow>();
    const seedRow = (dbId: string, name: string): CareerRow => ({
      playerId: null,
      dbId,
      name,
      appearances: 0, minutes: 0, goals: 0, assists: 0,
      yellowCards: 0, redCards: 0, cleanSheets: 0,
      seasons: 0,
      currentlyOnTeam: false,
      nowAt: null,
    });

    // 1) Históricos: registros donde teamId == este equipo
    for (const [dbId, records] of Object.entries(league.playerHistory ?? {})) {
      for (const rec of records as PlayerSeasonRecord[]) {
        if (rec.teamId !== team.id) continue;
        const row = byDbId.get(dbId) ?? seedRow(dbId, '');
        const { apps, mins } = estimateAppsMins(rec);
        row.appearances += apps;
        row.minutes += mins;
        row.goals += rec.goals;
        row.assists += rec.assists;
        row.yellowCards += rec.yellowCards;
        row.redCards += rec.redCards;
        row.cleanSheets += rec.cleanSheets ?? 0;
        row.seasons++;
        if (!row.name && rec.shirtName) row.name = rec.shirtName;
        byDbId.set(dbId, row);
      }
    }

    // 2) Plantilla actual de este equipo: añade temporada en curso y marca como "current"
    for (const p of team.players) {
      const dbId = extractDbId(p.id);
      const row = byDbId.get(dbId) ?? seedRow(dbId, p.name);
      row.name = p.name;
      row.playerId = p.id;
      row.currentlyOnTeam = true;
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

    // 3) Resolver nombre por DB y "ahora en X" para ex-jugadores
    for (const row of byDbId.values()) {
      if (!row.name) row.name = getPlayerNameByDbId(row.dbId) ?? '';
      if (!row.currentlyOnTeam) {
        const cur = dbIdToCurrentTeam.get(row.dbId);
        if (cur) {
          row.nowAt = cur.teamName;
          row.playerId = cur.playerId; // permitir clickar para ver la ficha incluso si está en otro equipo
        } else {
          row.nowAt = 'retirado';
        }
      }
    }

    return [...byDbId.values()].filter(r => r.seasons > 0);
  }, [league.playerHistory, team.id, team.players, dbIdToCurrentTeam]);

  const sorted = useMemo(() => {
    const out = [...careerRows];
    out.sort((a, b) => {
      let cmp: number;
      if (sortKey === 'name') {
        cmp = a.name.localeCompare(b.name);
      } else {
        cmp = (a[sortKey] as number) - (b[sortKey] as number);
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return out;
  }, [careerRows, sortKey, sortDir]);

  const flipSort = (k: SortKey) => {
    if (sortKey === k) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(k); setSortDir('desc'); }
  };

  // Mejor jugador esta temporada por ratingSum
  const mejorJugadorActual = useMemo(() => {
    const sorted = [...team.players].sort((a, b) => b.seasonStats.ratingSum - a.seasonStats.ratingSum);
    return sorted.slice(0, 5);
  }, [team.players]);

  const sortIndicator = (k: SortKey) => sortKey === k ? (sortDir === 'asc' ? '▲' : '▼') : '';

  return (
    <div className="w-full max-w-4xl flex flex-col gap-4 animate-in fade-in duration-300">
      <div className="bg-vga-blue p-2 border-2 border-vga-white flex justify-between items-center vga-panel">
        <h2 className="text-vga-yellow text-xs uppercase font-bold truncate">{t('section.teamTitle', { name: team.name })}</h2>
        <button onClick={onBack} className="bg-vga-red text-vga-bright-white px-3 py-1 text-[8px] border border-vga-black hover:bg-vga-light-red shrink-0">
          {t('btn.back')}
        </button>
      </div>

      <div className="bg-vga-gray border-2 border-vga-blue p-3 flex items-center gap-4">
        <TeamCrest colors={team.colors} size="lg" title={team.name} teamId={team.id} />
        <div className="flex-1 grid grid-cols-2 gap-2 text-[8px]">
          <div><span className="text-vga-blue uppercase">{t('misc.teamIdentityCoach')}</span> <span className="text-vga-black font-bold">{team.manager}</span></div>
          <div><span className="text-vga-blue uppercase">{t('misc.teamIdentityStadium')}</span> <span className="text-vga-black font-bold">{team.stadiumName}</span></div>
          <div><span className="text-vga-blue uppercase">{t('misc.teamIdentityAforo')}</span> <span className="text-vga-black font-bold">{team.stadiumCapacity.toLocaleString()}</span></div>
          <div><span className="text-vga-blue uppercase">{t('misc.teamIdentityFormation')}</span> <span className="text-vga-black font-bold">{team.formation}</span></div>
        </div>
      </div>

      <div className="bg-vga-gray border-2 border-vga-magenta p-2">
        <h3 className="text-vga-magenta text-[10px] font-bold mb-2 uppercase border-b border-vga-magenta pb-1">{t('section.clubRecords')}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[8px]">
          <div className="bg-vga-black p-2 border border-vga-gray"><span className="text-vga-cyan uppercase">{t('misc.recordBiggestWin')}</span><div className="text-vga-light-green font-bold">{formatRecord(records.biggestWin, opponentNameById)}</div></div>
          <div className="bg-vga-black p-2 border border-vga-gray"><span className="text-vga-cyan uppercase">{t('misc.recordHeaviestDefeat')}</span><div className="text-vga-light-red font-bold">{formatRecord(records.heaviestDefeat, opponentNameById)}</div></div>
          <div className="bg-vga-black p-2 border border-vga-gray"><span className="text-vga-cyan uppercase">{t('misc.recordMostGoals')}</span><div className="text-vga-light-green font-bold">{formatRecord(records.mostGoalsInMatch, opponentNameById)}</div></div>
          <div className="bg-vga-black p-2 border border-vga-gray"><span className="text-vga-cyan uppercase">{t('misc.recordUnbeaten')}</span><div className="text-vga-yellow font-bold">{formatStreak(records.longestUnbeaten, records.longestUnbeatenSpan)}{records.currentUnbeaten > 0 ? <span className="text-[7px] text-vga-cyan ml-1">{t('misc.recordCurrent', { streak: formatStreak(records.currentUnbeaten, records.currentUnbeatenStart ? { from: records.currentUnbeatenStart, to: { jornada: Math.max(1, league.currentJornada - 1), year: league.year } } : null) })}</span> : null}</div></div>
          <div className="bg-vga-black p-2 border border-vga-gray"><span className="text-vga-cyan uppercase">{t('misc.recordWinning')}</span><div className="text-vga-yellow font-bold">{formatStreak(records.longestWinning, records.longestWinningSpan)}{records.currentWinning > 0 ? <span className="text-[7px] text-vga-cyan ml-1">{t('misc.recordCurrent', { streak: formatStreak(records.currentWinning, records.currentWinningStart ? { from: records.currentWinningStart, to: { jornada: Math.max(1, league.currentJornada - 1), year: league.year } } : null) })}</span> : null}</div></div>
        </div>
      </div>

      <div className="bg-vga-gray border-2 border-vga-yellow p-2">
        <h3 className="text-vga-yellow text-[10px] font-bold mb-2 uppercase border-b border-vga-yellow pb-1 bg-vga-black px-1">{t('misc.bestPlayerSeason')}</h3>
        {mejorJugadorActual.every(p => p.seasonStats.ratingSum === 0) ? (
          <div className="text-[8px] text-vga-black p-2 text-center">{t('misc.noMatchesThisYear')}</div>
        ) : (
          <table className="w-full text-[8px]">
            <thead className="text-vga-blue text-left border-b border-vga-blue">
              <tr>
                <th className="p-1">#</th>
                <th className="p-1">NOMBRE</th>
                <th className="p-1 text-center">PJ</th>
                <th className="p-1 text-center">G</th>
                <th className="p-1 text-center">A</th>
                <th className="p-1 text-right">PUNTOS</th>
              </tr>
            </thead>
            <tbody>
              {mejorJugadorActual.map((p, i) => (
                <tr key={p.id} className={i % 2 === 0 ? 'bg-vga-black' : 'bg-vga-gray/20'}>
                  <td className={`p-1 ${i === 0 ? 'text-vga-yellow font-bold' : 'text-vga-bright-white'}`}>{i + 1}</td>
                  <td className={`p-1 ${i === 0 ? 'text-vga-yellow font-bold' : 'text-vga-bright-white'} cursor-pointer hover:underline`}
                      onClick={() => onPlayerClick?.(p.id)}>
                    <PlayerName player={p} />
                  </td>
                  <td className="p-1 text-center text-vga-cyan">{p.seasonStats.appearances}</td>
                  <td className="p-1 text-center text-vga-light-green">{p.seasonStats.goals}</td>
                  <td className="p-1 text-center text-vga-light-cyan">{p.seasonStats.assists}</td>
                  <td className="p-1 text-right text-vga-light-green font-bold">{p.seasonStats.ratingSum.toFixed(0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Plantilla histórica */}
      <div className="bg-vga-gray border-2 border-vga-cyan p-2">
        <h3 className="text-vga-cyan text-[10px] font-bold mb-2 uppercase border-b border-vga-cyan pb-1">{t('misc.historicSquad')}</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-[8px]">
            <thead className="text-vga-blue text-left border-b border-vga-blue">
              <tr>
                <th className="p-1 cursor-pointer hover:text-vga-yellow" onClick={() => flipSort('name')}>NOMBRE {sortIndicator('name')}</th>
                <th className="p-1 text-center cursor-pointer hover:text-vga-yellow" onClick={() => flipSort('seasons')}>T {sortIndicator('seasons')}</th>
                <th className="p-1 text-center cursor-pointer hover:text-vga-yellow" onClick={() => flipSort('appearances')}>PJ {sortIndicator('appearances')}</th>
                <th className="p-1 text-center cursor-pointer hover:text-vga-yellow" onClick={() => flipSort('minutes')}>MIN {sortIndicator('minutes')}</th>
                <th className="p-1 text-center cursor-pointer hover:text-vga-yellow" onClick={() => flipSort('goals')}>G {sortIndicator('goals')}</th>
                <th className="p-1 text-center cursor-pointer hover:text-vga-yellow" onClick={() => flipSort('assists')}>A {sortIndicator('assists')}</th>
                <th className="p-1 text-center cursor-pointer hover:text-vga-yellow" onClick={() => flipSort('yellowCards')}>TA {sortIndicator('yellowCards')}</th>
                <th className="p-1 text-center cursor-pointer hover:text-vga-yellow" onClick={() => flipSort('redCards')}>TR {sortIndicator('redCards')}</th>
                <th className="p-1 text-center cursor-pointer hover:text-vga-yellow" onClick={() => flipSort('cleanSheets')}>CS {sortIndicator('cleanSheets')}</th>
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 ? (
                <tr><td colSpan={9} className="p-3 text-center text-vga-black">{t('misc.noMatchesYet')}</td></tr>
              ) : sorted.map((r, i) => (
                <tr key={r.dbId} className={`${i % 2 === 0 ? 'bg-vga-black' : 'bg-vga-gray/20'}`}>
                  <td className={`p-1 ${r.playerId ? 'cursor-pointer hover:underline' : ''} ${r.currentlyOnTeam ? 'text-vga-bright-white' : 'text-vga-light-cyan italic'}`}
                      onClick={() => r.playerId && onPlayerClick?.(r.playerId)}>
                    <div className="flex flex-col">
                      <span>{r.name || `#${r.dbId.slice(0, 6)}`}</span>
                      {!r.currentlyOnTeam && r.nowAt && (
                        <span className="text-[6px] text-vga-light-magenta not-italic">{t('misc.nowAt', { team: r.nowAt })}</span>
                      )}
                    </div>
                  </td>
                  <td className="p-1 text-center text-vga-yellow">{r.seasons}</td>
                  <td className="p-1 text-center text-vga-bright-white">{r.appearances}</td>
                  <td className="p-1 text-center text-vga-bright-white">{r.minutes}</td>
                  <td className="p-1 text-center text-vga-light-green">{r.goals}</td>
                  <td className="p-1 text-center text-vga-light-cyan">{r.assists}</td>
                  <td className="p-1 text-center text-vga-yellow">{r.yellowCards}</td>
                  <td className="p-1 text-center text-vga-light-red">{r.redCards}</td>
                  <td className="p-1 text-center text-vga-light-green">{r.cleanSheets}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Salón de trofeos */}
      <div className="bg-vga-gray border-2 border-vga-blue p-2">
        <h3 className="text-vga-blue text-[10px] font-bold mb-2 uppercase border-b border-vga-blue pb-1">{t('section.trophies')}</h3>
        {historyForTeam.length === 0 ? (
          <div className="text-[8px] text-vga-black p-2 text-center">{t('misc.noSeasonsCompleted')}</div>
        ) : (
          <table className="w-full text-[8px]">
            <thead className="text-vga-blue text-left border-b border-vga-blue">
              <tr>
                <th className="p-1">{t('trophy.year')}</th>
                <th className="p-1 text-center">{t('trophy.position')}</th>
                <th className="p-1">{t('trophy.champion')}</th>
                <th className="p-1">{t('trophy.pichichi')}</th>
                <th className="p-1">{t('trophy.zamora')}</th>
                <th className="p-1">{t('trophy.best')}</th>
              </tr>
            </thead>
            <tbody>
              {historyForTeam.map((h, i) => (
                <tr key={h.year} className={i % 2 === 0 ? 'bg-vga-black' : 'bg-vga-gray/20'}>
                  <td className="p-1 text-vga-yellow font-bold">{h.year}/{(h.year + 1).toString().slice(-2)}</td>
                  <td className={`p-1 text-center font-bold ${h.position === 1 ? 'text-vga-yellow' : 'text-vga-bright-white'}`}>
                    {h.position ? `${h.position}º` : '—'}{h.position === 1 ? ' ★' : ''}
                  </td>
                  <td className="p-1 text-vga-light-green">{h.champion || '—'}</td>
                  <td className="p-1 text-vga-bright-white">{h.pichichi ? `${h.pichichi.playerName} (${h.pichichi.value}g)` : '—'}</td>
                  <td className="p-1 text-vga-bright-white">{h.zamora ? `${h.zamora.playerName} (${h.zamora.value.toFixed(2)} GA/p)` : '—'}</td>
                  <td className="p-1 text-vga-bright-white">{h.mejor ? `${h.mejor.playerName} (${h.mejor.ratingSum.toFixed(0)})` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
