import { useEffect, useState } from 'react';
import type { Team } from '../types/game.d.ts';
import type { Jornada, MatchInfo } from '../engine/calendar';
import { MatchDetails } from './JornadaResultsView';
import { TeamCrest } from './TeamCrest';

export type StatKey = 'played' | 'won' | 'drawn' | 'lost' | 'goalsFor' | 'goalsAgainst' | 'points';

interface Props {
  teamId: string;
  stat: StatKey;
  teams: Team[];
  schedule: Jornada[];
  onClose: () => void;
}

const STAT_LABEL: Record<StatKey, string> = {
  played: 'Partidos jugados',
  won: 'Partidos ganados',
  drawn: 'Empates',
  lost: 'Partidos perdidos',
  goalsFor: 'Goles a favor',
  goalsAgainst: 'Goles en contra',
  points: 'Puntos · resumen',
};

interface Row {
  jornada: number;
  match: MatchInfo;
  isHome: boolean;
  my: number;
  opp: number;
  outcome: 'W' | 'D' | 'L';
}

const buildRows = (teamId: string, schedule: Jornada[]): Row[] => {
  const rows: Row[] = [];
  for (const j of schedule) {
    for (const m of j.matches) {
      if (!m.played || m.homeScore == null || m.awayScore == null) continue;
      if (m.homeId !== teamId && m.awayId !== teamId) continue;
      const isHome = m.homeId === teamId;
      const my = isHome ? m.homeScore : m.awayScore;
      const opp = isHome ? m.awayScore : m.homeScore;
      const outcome: Row['outcome'] = my > opp ? 'W' : my === opp ? 'D' : 'L';
      rows.push({ jornada: j.number, match: m, isHome, my, opp, outcome });
    }
  }
  return rows;
};

const filterRows = (rows: Row[], stat: StatKey): Row[] => {
  switch (stat) {
    case 'won':         return rows.filter(r => r.outcome === 'W');
    case 'drawn':       return rows.filter(r => r.outcome === 'D');
    case 'lost':        return rows.filter(r => r.outcome === 'L');
    case 'goalsFor':    return rows.filter(r => r.my > 0);
    case 'goalsAgainst':return rows.filter(r => r.opp > 0);
    case 'played':
    case 'points':
    default:            return rows;
  }
};

const sumFor = (rows: Row[], stat: StatKey): number => {
  if (stat === 'goalsFor') return rows.reduce((s, r) => s + r.my, 0);
  if (stat === 'goalsAgainst') return rows.reduce((s, r) => s + r.opp, 0);
  if (stat === 'points') {
    return rows.reduce((s, r) => s + (r.outcome === 'W' ? 3 : r.outcome === 'D' ? 1 : 0), 0);
  }
  return rows.length;
};

export const StatDrillDown = ({ teamId, stat, teams, schedule, onClose }: Props) => {
  const team = teams.find(t => t.id === teamId);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!team) return null;

  const allRows = buildRows(teamId, schedule);
  const filtered = filterRows(allRows, stat);
  const total = sumFor(stat === 'points' ? allRows : filtered, stat);

  const toggle = (jornada: number) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(jornada)) next.delete(jornada);
      else next.add(jornada);
      return next;
    });
  };

  const outcomeColor = (o: Row['outcome']) =>
    o === 'W' ? 'text-vga-light-green' : o === 'D' ? 'text-vga-yellow' : 'text-vga-light-red';

  const otherTeam = (r: Row) => {
    const otherId = r.isHome ? r.match.awayId : r.match.homeId;
    return teams.find(t => t.id === otherId);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-vga-black/85 p-4"
      onClick={onClose}
    >
      <div
        className="bg-vga-blue border-4 border-vga-white vga-panel w-full max-w-3xl max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="bg-vga-blue p-2 border-b-2 border-vga-white flex items-center gap-2">
          <TeamCrest colors={team.colors} size="sm" title={team.name} teamId={team.id} />
          <div className="flex-1 min-w-0">
            <div className="text-vga-yellow text-[10px] uppercase truncate">{team.name}</div>
            <div className="text-vga-cyan text-[7px] uppercase">{STAT_LABEL[stat]} · {total}</div>
          </div>
          <button
            onClick={onClose}
            className="bg-vga-red text-vga-bright-white px-2 py-1 text-[8px] border border-vga-black hover:bg-vga-light-red"
          >
            CERRAR
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 bg-vga-black">
          {filtered.length === 0 ? (
            <div className="text-vga-gray text-[8px] text-center p-4 uppercase">
              Sin partidos para este criterio.
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {filtered.map(r => {
                const isOpen = expanded.has(r.jornada);
                const opponent = otherTeam(r);
                return (
                  <div key={r.jornada} className="bg-vga-blue border border-vga-gray">
                    <button
                      onClick={() => toggle(r.jornada)}
                      className="w-full flex items-center gap-2 p-2 text-[9px] hover:bg-vga-light-blue"
                    >
                      <span className="text-vga-cyan text-[7px] w-8 text-left">J{r.jornada}</span>
                      <span className={`text-[8px] font-bold w-4 text-center ${outcomeColor(r.outcome)}`}>
                        {r.outcome}
                      </span>
                      <span className="text-vga-bright-white text-[8px] uppercase w-6">
                        {r.isHome ? 'CASA' : 'FUERA'}
                      </span>
                      <TeamCrest colors={opponent?.colors} size="xs" title={opponent?.name} teamId={opponent?.id} />
                      <span className="text-vga-bright-white truncate flex-1 text-left">
                        {opponent?.name ?? '—'}
                      </span>
                      <span className="font-mono text-vga-yellow text-[10px] tabular-nums">
                        {r.match.homeScore}-{r.match.awayScore}
                      </span>
                      <span className="text-vga-cyan text-[7px] w-3 text-right">
                        {isOpen ? '▾' : '▸'}
                      </span>
                    </button>
                    {isOpen && <MatchDetails match={r.match} teams={teams} />}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
