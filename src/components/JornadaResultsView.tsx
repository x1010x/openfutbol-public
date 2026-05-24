import { useState } from 'react';
import type { Team, MatchEvent } from '../types/game.d.ts';
import type { Jornada, MatchInfo } from '../engine/calendar';
import { TeamCrest } from './TeamCrest';
import { useT } from '../i18n';

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
  const t = useT();
  if (!match.played || !match.events || match.events.length === 0) return null;

  const eventsForTeam = (teamId: string, type: MatchEvent['type']) =>
    (match.events ?? [])
      .filter(e => e.type === type && e.playerId)
      .filter(e => {
        const team = teams.find(team => team.id === teamId);
        return !!team?.players.some(p => p.id === e.playerId);
      })
      .sort((a, b) => a.minute - b.minute);

  const homeGoals = eventsForTeam(match.homeId, 'goal');
  const awayGoals = eventsForTeam(match.awayId, 'goal');
  const homeYellows = eventsForTeam(match.homeId, 'yellow');
  const awayYellows = eventsForTeam(match.awayId, 'yellow');
  const homeReds = eventsForTeam(match.homeId, 'red');
  const awayReds = eventsForTeam(match.awayId, 'red');

  const hasAny =
    homeGoals.length + awayGoals.length +
    homeYellows.length + awayYellows.length +
    homeReds.length + awayReds.length > 0;
  if (!hasAny) return null;

  const EventRow = ({ e, color }: { e: MatchEvent; color: string }) => (
    <div className={`${color} text-[9px]`}>
      {e.minute}' {findPlayerName(teams, e.playerId)}
    </div>
  );

  const Section = ({ label, items, color }: { label: string; items: MatchEvent[]; color: string }) =>
    items.length > 0 ? (
      <div className="space-y-0.5">
        <div className="text-[7px] text-vga-yellow uppercase font-bold">{label}</div>
        {items.map((e, i) => <EventRow key={i} e={e} color={color} />)}
      </div>
    ) : null;

  return (
    <div className="border-t-2 border-vga-gray mt-1 pt-2 px-3 pb-2">
      <div className="grid grid-cols-2 gap-4">
        <div className="text-right space-y-2">
          <Section label={t('label.goals')} items={homeGoals} color="text-vga-light-green" />
          <Section label={t('label.yellows')} items={homeYellows} color="text-vga-yellow" />
          <Section label={t('label.redCards')} items={homeReds} color="text-vga-light-red" />
        </div>
        <div className="text-left space-y-2">
          <Section label={t('label.goals')} items={awayGoals} color="text-vga-light-green" />
          <Section label={t('label.yellows')} items={awayYellows} color="text-vga-yellow" />
          <Section label={t('label.redCards')} items={awayReds} color="text-vga-light-red" />
        </div>
      </div>
    </div>
  );
};

export const JornadaResultsView = ({ jornada, teams, userTeamId, onContinue }: Props) => {
  const t = useT();
  const teamName = (id: string) => teams.find(team => team.id === id)?.name ?? '—';
  const teamColors = (id: string) => teams.find(team => team.id === id)?.colors;

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
    <div className="w-full max-w-2xl flex flex-col gap-4 animate-in fade-in duration-300">
      <div className="bg-vga-blue p-2 border-2 border-vga-white flex justify-between items-center vga-panel">
        <h2 className="text-vga-yellow text-xs uppercase font-bold">
          {jornada ? t('section.results', { n: String(jornada.number) }) : t('section.leagueResults')}
        </h2>
      </div>

      <div className="bg-vga-gray border-4 border-vga-blue p-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
        {!jornada || jornada.matches.length === 0 ? (
          <div className="bg-vga-black border border-vga-gray p-4 text-center text-[9px] text-vga-gray">
            {t('misc.noMatchesThisRound')}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {jornada.matches.map((m, i) => {
              const isUser = m.homeId === userTeamId || m.awayId === userTeamId;
              const userWon =
                isUser && m.played &&
                ((m.homeId === userTeamId && (m.homeScore ?? 0) > (m.awayScore ?? 0)) ||
                 (m.awayId === userTeamId && (m.awayScore ?? 0) > (m.homeScore ?? 0)));
              const userLost =
                isUser && m.played &&
                ((m.homeId === userTeamId && (m.homeScore ?? 0) < (m.awayScore ?? 0)) ||
                 (m.awayId === userTeamId && (m.awayScore ?? 0) < (m.homeScore ?? 0)));
              const borderClass = isUser
                ? userWon ? 'border-vga-light-green'
                : userLost ? 'border-vga-light-red'
                : 'border-vga-yellow'
                : 'border-vga-gray';
              const expanded = expandedMatches.has(i);
              return (
                <div key={i} className={`bg-vga-black border-2 ${borderClass} cursor-pointer hover:border-opacity-80`}
                  onClick={() => toggleMatch(i)}>
                  <div className="grid grid-cols-[1fr_auto_1fr_auto] items-center gap-3 px-3 py-2">
                    <div className="flex items-center gap-2 justify-end min-w-0">
                      <span className="text-vga-bright-white text-[10px] font-bold text-right">{teamName(m.homeId)}</span>
                      <TeamCrest colors={teamColors(m.homeId)} size="sm" title={teamName(m.homeId)} teamId={m.homeId} />
                    </div>
                    <div className="text-center font-mono text-vga-yellow text-sm font-bold px-2 shrink-0">
                      {m.played ? `${m.homeScore} – ${m.awayScore}` : '—'}
                    </div>
                    <div className="flex items-center gap-2 min-w-0">
                      <TeamCrest colors={teamColors(m.awayId)} size="sm" title={teamName(m.awayId)} teamId={m.awayId} />
                      <span className="text-vga-bright-white text-[10px] font-bold">{teamName(m.awayId)}</span>
                    </div>
                    <span className="text-[8px] text-vga-gray shrink-0">{expanded ? '▼' : '▶'}</span>
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
        className="w-full bg-vga-green hover:bg-vga-light-green text-vga-bright-white py-3 border-b-4 border-r-4 border-vga-black active:border-0 text-xs font-bold uppercase tracking-wider"
      >
        {t('btn.continue')}
      </button>
    </div>
  );
};
