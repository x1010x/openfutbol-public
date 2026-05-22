import { useState } from 'react';
import type { Team, MatchEvent } from '../types/game.d.ts';
import type { Jornada, MatchInfo } from '../engine/calendar';
import { TeamCrest } from './TeamCrest';

interface Props {
  jornada: Jornada | null;
  teams: Team[];
  userTeamId: string;
  onContinue: () => void;
}

const findPlayerName = (teams: Team[], playerId?: string): string => {
  if (!playerId) return '—';
  for (const t of teams) {
    const p = t.players.find(pl => pl.id === playerId);
    if (p) return p.fullName;
  }
  return '—';
};

export const MatchDetails = ({ match, teams }: { match: MatchInfo; teams: Team[] }) => {
  if (!match.played || !match.events || match.events.length === 0) return null;

  const eventsForTeam = (teamId: string, type: MatchEvent['type']) =>
    (match.events ?? [])
      .filter(e => e.type === type && e.playerId)
      .filter(e => {
        const t = teams.find(team => team.id === teamId);
        return !!t?.players.some(p => p.id === e.playerId);
      })
      .sort((a, b) => a.minute - b.minute);

  const homeGoals = eventsForTeam(match.homeId, 'goal');
  const awayGoals = eventsForTeam(match.awayId, 'goal');
  const homeYellows = eventsForTeam(match.homeId, 'yellow');
  const awayYellows = eventsForTeam(match.awayId, 'yellow');
  const homeReds = eventsForTeam(match.homeId, 'red');
  const awayReds = eventsForTeam(match.awayId, 'red');

  const hasAny =
    homeGoals.length +
      awayGoals.length +
      homeYellows.length +
      awayYellows.length +
      homeReds.length +
      awayReds.length >
    0;
  if (!hasAny) return null;

  const renderList = (items: MatchEvent[], color: string) =>
    items.map((e, i) => (
      <div key={`${e.type}${i}`} className={`${color} truncate`}>
        {e.minute}' {findPlayerName(teams, e.playerId)}
      </div>
    ));

  return (
    <div className="grid grid-cols-2 gap-2 px-2 pb-2 pt-1 border-t border-vga-gray text-[8px]">
      <div className="text-right space-y-0.5">
        {homeGoals.length > 0 && (
          <>
            <div className="text-[7px] text-vga-yellow uppercase">Goles</div>
            {renderList(homeGoals, 'text-vga-light-green')}
          </>
        )}
        {homeYellows.length > 0 && (
          <>
            <div className="text-[7px] text-vga-yellow uppercase mt-1">Amarillas</div>
            {renderList(homeYellows, 'text-vga-yellow')}
          </>
        )}
        {homeReds.length > 0 && (
          <>
            <div className="text-[7px] text-vga-yellow uppercase mt-1">Rojas</div>
            {renderList(homeReds, 'text-vga-light-red')}
          </>
        )}
      </div>
      <div className="text-left space-y-0.5">
        {awayGoals.length > 0 && (
          <>
            <div className="text-[7px] text-vga-yellow uppercase">Goles</div>
            {renderList(awayGoals, 'text-vga-light-green')}
          </>
        )}
        {awayYellows.length > 0 && (
          <>
            <div className="text-[7px] text-vga-yellow uppercase mt-1">Amarillas</div>
            {renderList(awayYellows, 'text-vga-yellow')}
          </>
        )}
        {awayReds.length > 0 && (
          <>
            <div className="text-[7px] text-vga-yellow uppercase mt-1">Rojas</div>
            {renderList(awayReds, 'text-vga-light-red')}
          </>
        )}
      </div>
    </div>
  );
};

export const JornadaResultsView = ({ jornada, teams, userTeamId, onContinue }: Props) => {
  const teamName = (id: string) => teams.find(t => t.id === id)?.name ?? '—';
  const teamColors = (id: string) => teams.find(t => t.id === id)?.colors;

  const [expandedMatches, setExpandedMatches] = useState<Set<number>>(() => {
    const s = new Set<number>();
    if (jornada) {
      jornada.matches.forEach((m, i) => {
        if (m.homeId === userTeamId || m.awayId === userTeamId) s.add(i);
      });
    }
    return s;
  });

  const toggleMatch = (i: number) =>
    setExpandedMatches(prev => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });

  return (
    <div className="w-full max-w-md flex flex-col gap-4 animate-in fade-in duration-300">
      <div className="bg-vga-blue p-2 border-2 border-vga-white flex justify-between items-center vga-panel">
        <h2 className="text-vga-yellow text-xs uppercase font-bold">
          {jornada ? `Resultados Jornada ${jornada.number}` : 'Resultados'}
        </h2>
      </div>

      <div className="bg-vga-gray border-4 border-vga-blue p-3">
        {!jornada || jornada.matches.length === 0 ? (
          <div className="bg-vga-black border border-vga-gray p-3 text-center text-[8px] text-vga-gray">
            Sin partidos en esta jornada.
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {jornada.matches.map((m, i) => {
              const isUser = m.homeId === userTeamId || m.awayId === userTeamId;
              const userWon =
                isUser &&
                m.played &&
                ((m.homeId === userTeamId && (m.homeScore ?? 0) > (m.awayScore ?? 0)) ||
                  (m.awayId === userTeamId && (m.awayScore ?? 0) > (m.homeScore ?? 0)));
              const userLost =
                isUser &&
                m.played &&
                ((m.homeId === userTeamId && (m.homeScore ?? 0) < (m.awayScore ?? 0)) ||
                  (m.awayId === userTeamId && (m.awayScore ?? 0) < (m.homeScore ?? 0)));
              const borderClass = isUser
                ? userWon
                  ? 'border-vga-light-green'
                  : userLost
                  ? 'border-vga-light-red'
                  : 'border-vga-yellow'
                : 'border-vga-gray';
              const expanded = expandedMatches.has(i);
              return (
                <div key={i} className={`bg-vga-black border-2 ${borderClass} cursor-pointer`}
                  onClick={() => toggleMatch(i)}>
                  <div className="grid grid-cols-[1fr_auto_1fr_auto] items-center gap-2 p-2 text-[9px]">
                    <div className="flex items-center gap-1.5 justify-end min-w-0">
                      <span className="text-vga-bright-white truncate">{teamName(m.homeId)}</span>
                      <TeamCrest colors={teamColors(m.homeId)} size="xs" title={teamName(m.homeId)} teamId={m.homeId} />
                    </div>
                    <div className="text-center font-mono text-vga-yellow text-[11px] px-1">
                      {m.played ? `${m.homeScore} - ${m.awayScore}` : '—'}
                    </div>
                    <div className="flex items-center gap-1.5 min-w-0">
                      <TeamCrest colors={teamColors(m.awayId)} size="xs" title={teamName(m.awayId)} teamId={m.awayId} />
                      <span className="text-vga-bright-white truncate">{teamName(m.awayId)}</span>
                    </div>
                    <span className="text-[7px] text-vga-gray pl-1">{expanded ? '▼' : '▶'}</span>
                  </div>
                  {expanded && <MatchDetails match={m} teams={teams} />}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <button
        onClick={onContinue}
        className="w-full bg-vga-green hover:bg-vga-light-green text-vga-bright-white py-2 px-4 border-b-4 border-r-4 border-vga-black active:border-0 text-xs font-bold"
      >
        CONTINUAR
      </button>
    </div>
  );
};
