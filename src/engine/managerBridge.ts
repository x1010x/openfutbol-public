// Bridge between the manager (Team/Player, MatchEvent) and the zone engine
// (EnginePlayer, MatchTimeline). This is the only module that imports both the
// manager types and the engine types; the renderer never touches it.
import type { Team, Player, MatchEvent } from '../types/game.d.ts';
import type { EnginePlayer } from './zoneEngine';
import type { MatchTimeline, PlayerId } from '../types/match';
import { buildLineupLayout } from './lineup';

// Engine stat block for one manager player, with the pre-match fitness scaling
// (Bloque 2) applied to the athletic stats. Shared by the starting XI builder
// and the live-substitution path so a bench player who comes on is scaled the
// same way. See teamToEnginePlayers for the fatigue rationale.
export function engineStatsFromPlayer(p: Player): Pick<EnginePlayer,
  'speed' | 'dribbling' | 'passing' | 'shooting' | 'defending' | 'physical' | 'goalkeeping' | 'stamina' | 'enduranceBase'> {
  const stamina = Number.isFinite(p.stamina) ? Math.max(0, Math.min(99, p.stamina)) : 99;
  const fitness = 0.85 + 0.15 * (stamina / 99);
  return {
    speed: p.stats.speed * fitness,
    dribbling: p.stats.dribbling,
    passing: p.stats.passing,
    shooting: p.stats.shooting,
    defending: p.stats.defending,
    physical: p.stats.physical * fitness,
    goalkeeping: p.stats.goalkeeping,
    // Inputs for the engine's in-match fatigue model (engine/fatigue.ts): the
    // decay RATE combines the físico (enduranceBase = raw permanent stat, how
    // well they last 90') with the day's freshness (stamina = current
    // condition). The scaled speed/physical above are arrival form, a separate
    // concern (a tired player both starts and tires worse).
    stamina,
    enduranceBase: p.stats.physical,
  };
}

// Build the 11 EnginePlayers for one side from the manager's selected lineup.
// `team.lineup` is already ordered by formation slot (lineup[i] occupies slot i
// of FORMATIONS[team.formation]), so slotIndex follows that order directly —
// keeper at 0, then the formation's outfield slots. Slot coordinates / role /
// tag come from the team's real formation (see engine/lineup.ts); `side`
// mirrors the layout for the away team. Per-slot drag offsets (user team only)
// flow in via `team.lineupOffsets`. Player.stats are used as-is.
export function teamToEnginePlayers(team: Team, side: 'home' | 'away' = 'home'): EnginePlayer[] {
  const byId = new Map(team.players.map(p => [p.id, p] as const));
  const layout = buildLineupLayout(team.formation, side);
  const out: EnginePlayer[] = [];
  for (let i = 0; i < team.lineup.length && out.length < 11; i++) {
    const p = byId.get(team.lineup[i]);
    if (!p) continue;
    const slotIndex = out.length;
    const off = team.lineupOffsets?.[slotIndex];
    // Offsets are stored in the team frame (dx = forward toward the opponent
    // goal). The away side's slots are mirrored across x, so "forward" is the
    // -x direction there; flip dx. Lateral (dy) is preserved by the mirror.
    const fwdSign = side === 'home' ? 1 : -1;
    // Pre-match fitness scaling (Bloque 2) lives in engineStatsFromPlayer: a
    // tired player (low stamina) runs/duels slightly worse. It's arrival
    // fitness, not in-match decay (the engine precomputes the timeline).
    out.push({
      id: p.id as PlayerId,
      slotIndex,
      slot: layout.slots[slotIndex] ?? { x: 0.5, y: 0.5 },
      slotOffset: off ? { x: off.dx * fwdSign, y: off.dy } : undefined,
      role: layout.roles[slotIndex] ?? 'mid',
      tag: layout.tags[slotIndex] ?? 'cm',
      ...engineStatsFromPlayer(p),
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
  // Per-side breakdowns the manager's MatchState carries (ids are player ids).
  homeSentOff: string[];
  awaySentOff: string[];
  homeYellows: string[];
  awayYellows: string[];
  homeInjured: string[];
  awayInjured: string[];
  homeFouls: number;
  awayFouls: number;
  homeShots: number;
  awayShots: number;
  homeShotsOnTarget: number;
  awayShotsOnTarget: number;
  homePossession: number; // percentage, sums to 100 with away
  awayPossession: number;
  homeSubsUsed: number;
  awaySubsUsed: number;
  stoppageTime1: number;  // added minutes, first / second half
  stoppageTime2: number;
}

// Added minutes for a half, from the significant in-play delays (goals, subs,
// injuries, reds) that fall in its minute window. Mirrors simEngine's
// calcStoppage so 2D and text matches report the same kind of figure; kept
// local to avoid pulling the text sim's i18n into the bridge.
function calcStoppage(events: MatchEvent[], fromMin: number, toMin: number): number {
  const half = events.filter(e => e.minute > fromMin && e.minute <= toMin);
  const goals    = half.filter(e => e.type === 'goal').length;
  const subs     = half.filter(e => e.type === 'sub').length;
  const injuries = half.filter(e => e.type === 'injury').length;
  const reds     = half.filter(e => e.type === 'red').length;
  const isFirst  = fromMin === 0;
  const base = isFirst ? 1 : 3;
  const raw  = base + goals * 0.5 + subs * 0.3 + injuries * 0.5 + reds * 0.3;
  return Math.round(Math.min(isFirst ? 3 : 7, Math.max(isFirst ? 1 : 3, raw)));
}

// Distil a finished timeline into the manager's result shape: the MatchEvent[]
// that drives standings / player stats (goals, cards) plus the per-side
// breakdowns (sendings-off, bookings, injuries, fouls, shots, possession) that
// finalizeMatch / writebackMatchStamina / the stats panel consume — so a 2D
// match records the same metrics as the text modes.
export function timelineToMatchResult(
  timeline: MatchTimeline,
  homeTeamId: string,
  awayTeamId: string,
): MatchResult {
  const events: MatchEvent[] = [];
  // Full per-side roster (final eleven + anyone involved in a sub), so a player
  // subbed off is still attributed to the right side for fouls/possession even
  // though they're absent from the final lineup. Mirrors the renderer's roster
  // reconstruction.
  const homeSet = new Set(timeline.homeLineup);
  for (const ev of timeline.events) {
    if (ev.kind !== 'sub' || ev.side !== 'home') continue;
    if (ev.actor) homeSet.add(ev.actor);
    if (ev.target) homeSet.add(ev.target);
  }
  const isHomeId = (id: string | undefined) => id !== undefined && homeSet.has(id);

  const homeSentOff: string[] = [], awaySentOff: string[] = [];
  const homeYellows: string[] = [], awayYellows: string[] = [];
  const homeInjured: string[] = [], awayInjured: string[] = [];
  let homeFouls = 0, awayFouls = 0;
  let homeShots = 0, awayShots = 0;
  let homeShotsOnTarget = 0, awayShotsOnTarget = 0;
  let homeSubsUsed = 0, awaySubsUsed = 0;

  // The viewer compresses a full match into a short timeline; remap each event's
  // timestamp back to a 0–90' minute so standings/player stats record the real
  // match minute, not the compressed one. (See the 2D speed/time model.)
  const scale = timeline.nominalMatchMs && timeline.durationMs > 0
    ? timeline.nominalMatchMs / timeline.durationMs
    : 1;
  const minuteCap = timeline.nominalMatchMs ? timeline.nominalMatchMs / 60000 : 90;
  for (const ev of timeline.events) {
    const minute = Math.max(1, Math.min(minuteCap, Math.floor((ev.t * scale) / 60000)));
    const teamId = ev.side === 'home' ? homeTeamId : awayTeamId;
    switch (ev.kind) {
      case 'goal':
        if (ev.actor) events.push({ minute, type: 'goal', playerId: ev.actor, teamId });
        break;
      case 'card': {
        if (!ev.actor) break;
        // Card `side` is the booked player's team.
        const onHome = ev.side === 'home';
        const isRed = ev.detail === 'red' || ev.detail === 'second_yellow';
        events.push({ minute, type: isRed ? 'red' : 'yellow', playerId: ev.actor, teamId });
        if (isRed) (onHome ? homeSentOff : awaySentOff).push(ev.actor);
        else (onHome ? homeYellows : awayYellows).push(ev.actor);
        break;
      }
      case 'injury':
        // Injury `side` is the victim's team.
        if (ev.actor) {
          events.push({ minute, type: 'injury', playerId: ev.actor, teamId });
          (ev.side === 'home' ? homeInjured : awayInjured).push(ev.actor);
        }
        break;
      case 'foul':
      case 'penalty':
        // `actor` is the fouler; count the foul against the fouler's team.
        if (isHomeId(ev.actor)) homeFouls++; else awayFouls++;
        break;
      case 'shot_on':
        // `side` is the shooting team. A shot on target also counts as a shot.
        if (ev.side === 'home') { homeShots++; homeShotsOnTarget++; }
        else { awayShots++; awayShotsOnTarget++; }
        break;
      case 'shot_off':
        if (ev.side === 'home') homeShots++; else awayShots++;
        break;
      case 'sub':
        // `actor` came on, `target` came off; `side` is their team.
        if (ev.actor) {
          events.push({ minute, type: 'sub', playerId: ev.actor, playerOffId: ev.target, teamId });
          if (ev.side === 'home') homeSubsUsed++; else awaySubsUsed++;
        }
        break;
    }
  }

  // Possession: share of keyframes where each side owned the ball.
  let homeOwned = 0, awayOwned = 0;
  for (const kf of timeline.keyframes) {
    if (kf.ballOwner === null || kf.ballOwner === undefined) continue;
    if (homeSet.has(kf.ballOwner)) homeOwned++; else awayOwned++;
  }
  const totalOwned = homeOwned + awayOwned;
  const homePossession = totalOwned === 0 ? 50 : Math.round((homeOwned / totalOwned) * 100);
  const awayPossession = totalOwned === 0 ? 50 : 100 - homePossession;

  return {
    homeScore: timeline.finalScore.home,
    awayScore: timeline.finalScore.away,
    events,
    homeSentOff, awaySentOff,
    homeYellows, awayYellows,
    homeInjured, awayInjured,
    homeFouls, awayFouls,
    homeShots, awayShots,
    homeShotsOnTarget, awayShotsOnTarget,
    homePossession, awayPossession,
    homeSubsUsed, awaySubsUsed,
    // Prefer the figures the engine already attached to the timeline (what the
    // on-screen clock showed as "45+X'/90+X'"); fall back to recomputing from
    // the remapped events for timelines that don't carry them (older sims).
    stoppageTime1: timeline.stoppage1Min ?? calcStoppage(events, 0, 45),
    stoppageTime2: timeline.stoppage2Min ?? calcStoppage(events, 45, 90),
  };
}
