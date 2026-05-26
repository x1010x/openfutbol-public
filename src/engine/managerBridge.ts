// Bridge between the manager (Team/Player, MatchEvent) and the zone engine
// (EnginePlayer, MatchTimeline). This is the only module that imports both the
// manager types and the engine types; the renderer never touches it.
import type { Team, MatchEvent } from '../types/game.d.ts';
import type { EnginePlayer } from './zoneEngine';
import type { MatchTimeline, PlayerId } from '../types/match';

// Build the 11 EnginePlayers for one side from the manager's selected lineup.
// `team.lineup` is already ordered by formation slot (lineup[i] occupies slot i
// of FORMATIONS[team.formation]), so slotIndex follows that order directly —
// keeper at 0, then the formation's outfield slots. Player.stats are used as-is.
export function teamToEnginePlayers(team: Team): EnginePlayer[] {
  const byId = new Map(team.players.map(p => [p.id, p] as const));
  const out: EnginePlayer[] = [];
  for (let i = 0; i < team.lineup.length && out.length < 11; i++) {
    const p = byId.get(team.lineup[i]);
    if (!p) continue;
    out.push({
      id: p.id as PlayerId,
      slotIndex: out.length,
      speed: p.stats.speed,
      dribbling: p.stats.dribbling,
      passing: p.stats.passing,
      shooting: p.stats.shooting,
      defending: p.stats.defending,
      physical: p.stats.physical,
      foulsCommitted: 0,
      yellowCount: 0,
      redCard: false,
      injured: false,
    });
  }
  return out;
}

export interface MatchResult {
  homeScore: number;
  awayScore: number;
  events: MatchEvent[];
}

// Distil a finished timeline into the same {score, MatchEvent[]} shape the
// manager's other result modes produce, so updateLeagueStats records identical
// metrics (team standings + per-player goals/cards/suspensions).
export function timelineToMatchResult(
  timeline: MatchTimeline,
  homeTeamId: string,
  awayTeamId: string,
): MatchResult {
  const events: MatchEvent[] = [];
  for (const ev of timeline.events) {
    const minute = Math.max(1, Math.floor(ev.t / 60000));
    const teamId = ev.side === 'home' ? homeTeamId : awayTeamId;
    if (ev.kind === 'goal' && ev.actor) {
      events.push({ minute, type: 'goal', playerId: ev.actor, teamId });
    } else if (ev.kind === 'card' && ev.actor) {
      const isRed = ev.detail === 'red' || ev.detail === 'second_yellow';
      events.push({ minute, type: isRed ? 'red' : 'yellow', playerId: ev.actor, teamId });
    }
  }
  return {
    homeScore: timeline.finalScore.home,
    awayScore: timeline.finalScore.away,
    events,
  };
}
