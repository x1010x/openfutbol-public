import { useState } from 'react';
import type { Team, MatchEvent, Player } from '../types/game.d.ts';
import type { Jornada, MatchInfo } from '../engine/calendar';
import { TeamCrest } from './TeamCrest';
import { PlayerName } from './PlayerName';
import { useT } from '../i18n';

interface Props {
  jornada: Jornada | null;
  teams: Team[];
  userTeamId: string;
  onContinue: () => void;
}

const findPlayer = (teams: Team[], playerId?: string): Player | null => {
  if (!playerId) return null;
  for (const t of teams) {
    const p = t.players.find(pl => pl.id === playerId);
    if (p) return p;
  }
  return null;
};

interface MvpResult {
  playerId: string;
  playerName: string;
  teamId: string;
  score: number;
  goals: number;
  assists: number;
  yellows: number;
  reds: number;
}

// xmur3-style hash so ties resolve to the same player across reloads.
const tieSeed = (str: string): number => {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return (h ^ (h >>> 16)) >>> 0;
};

const computeMvp = (events: MatchEvent[], teams: Team[], match: MatchInfo): MvpResult | null => {
  const scores = new Map<string, MvpResult>();
  const ensure = (playerId: string): MvpResult | null => {
    if (scores.has(playerId)) return scores.get(playerId)!;
    let teamId: string | null = null;
    let playerName = '—';
    for (const team of teams) {
      const p = team.players.find(pl => pl.id === playerId);
      if (p) { teamId = team.id; playerName = p.fullName; break; }
    }
    if (!teamId) return null;
    const entry: MvpResult = { playerId, playerName, teamId, score: 0, goals: 0, assists: 0, yellows: 0, reds: 0 };
    scores.set(playerId, entry);
    return entry;
  };

  for (const e of events) {
    if (!e.playerId) continue;
    if (e.type === 'goal') {
      const main = ensure(e.playerId);
      if (main) { main.goals += 1; main.score += 4; }
      if (e.assistantId) {
        const ast = ensure(e.assistantId);
        if (ast) { ast.assists += 1; ast.score += 2; }
      }
    } else if (e.type === 'yellow') {
      const v = ensure(e.playerId);
      if (v) { v.yellows += 1; v.score -= 1; }
    } else if (e.type === 'red') {
      const v = ensure(e.playerId);
      if (v) { v.reds += 1; v.score -= 3; }
    }
  }

  const candidates = [...scores.values()].filter(s => s.score > 0);
  if (candidates.length === 0) return null;
  const topScore = Math.max(...candidates.map(c => c.score));
  const top = candidates.filter(c => c.score === topScore);
  if (top.length === 1) return top[0];
  // Tie-break: deterministic by (matchKey + playerId)
  const matchKey = `${match.homeId}-${match.awayId}`;
  top.sort((a, b) => tieSeed(`${matchKey}|${a.playerId}`) - tieSeed(`${matchKey}|${b.playerId}`));
  return top[0];
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
  const homeShots = eventsForTeam(match.homeId, 'shot').length + homeGoals.length;
  const awayShots = eventsForTeam(match.awayId, 'shot').length + awayGoals.length;

  const mvp = computeMvp(match.events ?? [], teams, match);
  const mvpTeam = mvp ? teams.find(t => t.id === mvp.teamId) : null;

  const hasAny =
    homeGoals.length + awayGoals.length +
    homeYellows.length + awayYellows.length +
    homeReds.length + awayReds.length > 0;
  if (!hasAny) return null;

  void t;

  // Build a single chronological timeline of relevant events (goals + cards),
  // tagged with side so we can color/align them.
  type TimelineEvent = { e: MatchEvent; side: 'home' | 'away' };
  const homePlayerIds = new Set(teams.find(t => t.id === match.homeId)?.players.map(p => p.id) ?? []);
  const timeline: TimelineEvent[] = (match.events ?? [])
    .filter(e => e.playerId && (e.type === 'goal' || e.type === 'yellow' || e.type === 'red'))
    .map(e => ({ e, side: homePlayerIds.has(e.playerId!) ? 'home' as const : 'away' as const }))
    .sort((a, b) => a.e.minute - b.e.minute);

  const eventGlyph = (type: MatchEvent['type']) =>
    type === 'goal' ? <span className="text-vga-light-green">●</span>
    : type === 'yellow' ? <span className="text-vga-yellow">▮</span>
    : type === 'red' ? <span className="text-vga-light-red">▮</span>
    : null;

  const homeTeam = teams.find(t => t.id === match.homeId);
  const awayTeam = teams.find(t => t.id === match.awayId);

  return (
    <div className="border-t border-vga-gray px-3 py-1.5 text-[8px] bg-vga-black/60 space-y-1">
      {/* Stats stripe + team headers in one grid so columns align */}
      <div className="grid grid-cols-[1fr_auto_1fr] gap-x-2 leading-snug">
        {/* Row 1: per-team stat groups */}
        <div className="flex items-center justify-end gap-2 tabular-nums">
          <span><span className="text-vga-light-green font-bold">{homeShots}</span>{' '}<span className="text-vga-gray">tiros</span></span>
          <span><span className="text-vga-yellow font-bold">{homeYellows.length}</span>{' '}<span className="text-vga-gray">TA</span></span>
          {homeReds.length > 0 && <span><span className="text-vga-light-red font-bold">{homeReds.length}</span>{' '}<span className="text-vga-gray">TR</span></span>}
        </div>
        <span className="text-vga-gray px-1 self-center">|</span>
        <div className="flex items-center justify-start gap-2 tabular-nums">
          {awayReds.length > 0 && <span><span className="text-vga-light-red font-bold">{awayReds.length}</span>{' '}<span className="text-vga-gray">TR</span></span>}
          <span><span className="text-vga-yellow font-bold">{awayYellows.length}</span>{' '}<span className="text-vga-gray">TA</span></span>
          <span><span className="text-vga-light-green font-bold">{awayShots}</span>{' '}<span className="text-vga-gray">tiros</span></span>
        </div>

        {/* Row 2: team-name headers */}
        <div className="text-right text-vga-cyan text-[7px] uppercase tracking-widest truncate border-b border-vga-gray pb-0.5">{homeTeam?.name ?? 'CASA'}</div>
        <div className="text-vga-gray text-[7px] text-center border-b border-vga-gray pb-0.5">'</div>
        <div className="text-left text-vga-cyan text-[7px] uppercase tracking-widest truncate border-b border-vga-gray pb-0.5">{awayTeam?.name ?? 'FUERA'}</div>

        {/* Rows 3..N: chronological event timeline */}
        {timeline.map((te, i) => {
          const min = `${te.e.minute}'`;
          const player = findPlayer(teams, te.e.playerId);
          const assist = te.e.assistantId ? findPlayer(teams, te.e.assistantId) : null;
          const color = te.e.type === 'goal' ? 'text-vga-light-green' : te.e.type === 'yellow' ? 'text-vga-yellow' : 'text-vga-light-red';
          const cell = (
            <span className={`${color} truncate inline-flex items-center gap-1`}>
              {eventGlyph(te.e.type)}
              {player ? <PlayerName player={player} useShirt /> : <span>—</span>}
              {assist && <><span className="text-vga-cyan">· ast.</span><PlayerName player={assist} useShirt className="text-vga-cyan" /></>}
            </span>
          );
          return (
            <div key={i} className="contents">
              {te.side === 'home' ? <div className="text-right truncate">{cell}</div> : <div />}
              <div className="text-vga-gray tabular-nums text-center">{min}</div>
              {te.side === 'away' ? <div className="text-left truncate">{cell}</div> : <div />}
            </div>
          );
        })}
      </div>

      {/* MVP centered at the bottom */}
      {mvp && (
        <div className="flex justify-center pt-1 border-t border-vga-gray">
          <div className="flex items-center gap-1 truncate">
            <span className="text-vga-magenta text-[7px] uppercase tracking-widest">MVP</span>
            {(() => {
              const p = findPlayer(teams, mvp.playerId);
              return p ? <PlayerName player={p} useShirt className="text-vga-bright-white truncate" /> : <span className="text-vga-bright-white truncate">{mvp.playerName}</span>;
            })()}
            <span className="text-vga-cyan text-[7px] truncate">· {mvpTeam?.name ?? ''}</span>
            <span className="tabular-nums">
              {mvp.goals > 0 && <span className="text-vga-light-green"> {mvp.goals}G</span>}
              {mvp.assists > 0 && <span className="text-vga-light-cyan"> {mvp.assists}A</span>}
              {mvp.yellows > 0 && <span className="text-vga-yellow"> {mvp.yellows}TA</span>}
              {mvp.reds > 0 && <span className="text-vga-light-red"> {mvp.reds}TR</span>}
            </span>
          </div>
        </div>
      )}
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
