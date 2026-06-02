// Kickoff: match-start teleport-into-formation and post-goal walk-back, plus
// the kickoff_setup force field (pull home, clear the centre circle) and the
// tick handlers that release the ball once the kicker is set behind it.

import type { Vec2, TeamSide } from '../../types/match';
import type { EnginePlayer } from '../zoneEngine';
import { spring, repel } from '../forces';
import { KICKOFF_INITIAL_TICKS, KICKOFF_SETUP_TICKS } from './shared';
import type { CarrierRole, PhaseForceCtx, PhaseCallbacks, MatchState } from './shared';

// Tunnel geometry shared by both the kickoff entrance and the half-time /
// full-time walk-offs. The two teams use slightly offset x columns so the
// entrance/exit reads as two parallel single-file lines instead of one pile of
// 22 sprites converging on the same point. y=0.02 is the top touchline; the
// pre-roll spawn / post-walkout disappear point sits well above that so the
// spring keeps pulling at near-max speed before the sprite vanishes.
const TUNNEL_HOME_X = 0.470;
const TUNNEL_AWAY_X = 0.530;
const TUNNEL_OFF_FIELD_Y = -0.30;

// Per-team x column for the tunnel queue / exit.
function tunnelX(side: TeamSide): number {
  return side === 'home' ? TUNNEL_HOME_X : TUNNEL_AWAY_X;
}

// Phase entry used at match start (teleport=true) and after a goal
// (teleport=false). Both branches put the ball on the centre spot and hand
// it to the kicker; only the initial branch teleports the 22 players into
// formation. After a goal, players walk back to their kickoff slots
// naturally — the kickoff_setup phase forces in `applyPhaseForces` pull
// them home, and the `tickPhase` exit logic waits until the kicker reaches
// the behind-centre stance before releasing the ball.
export function resetKickoff(
  state: MatchState,
  lastScorer: TeamSide,
  teleport: boolean,
  deps: { resetCarry: (p: EnginePlayer) => void },
): void {
  state.possession = lastScorer === 'home' ? 'away' : 'home';
  const team = state.possession === 'home' ? state.homePlayers : state.awayPlayers;
  // Pick kicker + partner from non-expelled outfielders, preferring the
  // strikers (slots 9, 10) and falling back through mids → defenders if a
  // red card has emptied the front line. Without this filter the kickoff
  // stalls forever because the assigned slot-9/10 player is off the pitch.
  const eligible = team.filter(p => p.slotIndex !== 0 && !state.expelledIds.has(p.id));
  const byPreference = [...eligible].sort((a, b) => b.slotIndex - a.slotIndex);
  const kicker  = byPreference[0] ?? team[0];
  const partner = byPreference.find(p => p.id !== kicker.id) ?? kicker;
  state.kickerId   = kicker.id;
  state.partnerId  = partner.id;
  state.carrierId  = kicker.id;
  state.needsKickoffPass = true;
  state.needsKickoffBackPass = false;

  state.phase         = 'kickoff_setup';
  state.phaseTicks    = teleport ? KICKOFF_INITIAL_TICKS : KICKOFF_SETUP_TICKS;
  // teleport=true is the match-start / second-half entrance; teleport=false is
  // the post-goal restart (players walk back from open play, no entrance).
  state.kickoffEntrance = teleport;

  if (teleport) {
    // Tunnel entrance: each team forms a single-file column at the top-centre
    // (TUNNEL_HOME_X / TUNNEL_AWAY_X), queued above the touchline by slotIndex
    // so the GK leads each line. applyKickoffForces walks them straight down
    // the column; once they cross the touchline they fan out to their slots.
    // move.ts relaxes the vertical clamp during kickoffEntrance so the deep
    // queue spawns can sit well off the top of the frame.
    const homeSorted = [...state.homePlayers].sort((a, b) => a.slotIndex - b.slotIndex);
    const awaySorted = [...state.awayPlayers].sort((a, b) => a.slotIndex - b.slotIndex);
    const QUEUE_STEP = 0.045; // vertical gap between consecutive players in the column
    const QUEUE_HEAD_Y = -0.10; // leader of the line sits just off the touchline
    const placeQueue = (sorted: EnginePlayer[], side: TeamSide): void => {
      const xCol = tunnelX(side);
      for (let i = 0; i < sorted.length; i++) {
        const p = sorted[i];
        state.pos[p.id] = { x: xCol, y: QUEUE_HEAD_Y - QUEUE_STEP * i };
        state.vel[p.id] = { x: 0, y: 0 };
      }
    };
    placeQueue(homeSorted, 'home');
    placeQueue(awaySorted, 'away');
  }
  // Post-goal: keep all 22 player positions as-is. The kickoff_setup phase
  // forces will walk them to their kickoff stations; the tickPhase exit
  // logic keeps the phase alive until the kicker arrives at the spot.

  state.ball = { x: 0.50, y: 0.50 };
  state.ballVel = { x: 0, y: 0 };
  state.ballHeight = 0;
  state.ballHeightVel = 0;
  state.ballOwner = kicker.id;
  state.intendedReceiver = null;
  state.ballLastKicker = null;
  state.ballLastKickerSide = null;
  state.throwInSpot = null;
  state.pendingImpulse = null;

  state.ballCell = { zone: 2, lane: 'C' };
  deps.resetCarry(kicker);
}

export function applyKickoffForces(
  p: EnginePlayer,
  _isGK: boolean,
  pSide: TeamSide,
  _role: CarrierRole,
  base: Vec2,
  ppos: Vec2,
  _pvel: Vec2,
  force: Vec2,
  ctx: PhaseForceCtx,
): boolean {
  const { ball, ballOwner, kickerId, partnerId, homePlayers, awayPlayers, pos } = ctx;

  // Tunnel entrance leg: while still above the top touchline the player walks
  // straight down their team's column. Only the queue x/y matters here; the
  // slot/kicker pull is skipped so 22 players don't all sprint diagonally at
  // the centre spot from the queue. Once their sprite crosses the touchline
  // (TUNNEL_ENTER_Y) the normal kickoff pull below takes over.
  const TUNNEL_ENTER_Y = 0.06;
  if (ctx.kickoffEntrance && ppos.y < TUNNEL_ENTER_Y) {
    const xCol = tunnelX(pSide);
    const sfTunnel = spring(ppos, { x: xCol, y: TUNNEL_ENTER_Y + 0.04 }, 0.30);
    force.x += sfTunnel.x;
    force.y += sfTunnel.y;
    // Light vertical repulsion so two queued players don't end up at the same y.
    const teammates = pSide === 'home' ? homePlayers : awayPlayers;
    for (const other of teammates) {
      if (other.id === p.id) continue;
      const opos = pos[other.id];
      if (opos.y >= TUNNEL_ENTER_Y) continue; // only repel queue mates still above the line
      const dy = opos.y - ppos.y;
      const dx = opos.x - ppos.x;
      const d = Math.hypot(dx, dy);
      if (d < 0.035 && d > 0) {
        const r = repel(ppos, opos, (0.035 - d) * 2.5);
        force.x += r.x;
        force.y += r.y;
      }
    }
    return true;
  }

  let target: Vec2 = { ...base };
  if (pSide === 'home') target.x = Math.min(target.x, 0.48);
  else                  target.x = Math.max(target.x, 0.52);

  // Kicker side's "behind centre" stance — kicker + partner stay in their
  // own half so the ball sits visually on the centre line, not on their feet.
  const takerSide: TeamSide | null = kickerId !== null ? ctx.sideOf(kickerId) : null;
  const behindX = takerSide === 'home' ? 0.485 : 0.515;

  if (p.id === kickerId) {
    target = ballOwner === kickerId ? { x: behindX, y: 0.50 } : { ...ball };
  } else if (p.id === partnerId) {
    target = { x: behindX, y: 0.42 };
  } else {
    const CIRCLE_R = 0.17;
    const d = Math.hypot(target.x - 0.5, target.y - 0.5);
    if (d < CIRCLE_R && d > 0) {
      const factor = CIRCLE_R / d;
      target.x = 0.5 + (target.x - 0.5) * factor;
      target.y = 0.5 + (target.y - 0.5) * factor;
    }
  }
  const sf = spring(ppos, target, 0.15);
  force.x += sf.x;
  force.y += sf.y;

  // Repulsion to avoid overlapping while walking back to slots.
  const teammates = pSide === 'home' ? homePlayers : awayPlayers;
  for (const other of teammates) {
    if (other.id === p.id) continue;
    const d = Math.hypot(pos[other.id].x - ppos.x, pos[other.id].y - ppos.y);
    const repDist = (p.id !== kickerId && p.id !== partnerId) ? 0.08 : 0.06;
    if (d < repDist && d > 0) {
      const r = repel(ppos, pos[other.id], (repDist - d) * 2.0);
      force.x += r.x;
      force.y += r.y;
    }
  }

  // Extra push away from the centre circle (for non-kicker, non-partner).
  // Radius matches the visual centre circle so opposing players don't end
  // up standing inside it during the kickoff intro.
  if (p.id !== kickerId && p.id !== partnerId) {
    const distToCenter = Math.hypot(ppos.x - 0.5, ppos.y - 0.5);
    if (distToCenter < 0.16 && distToCenter > 0) {
      const rf = repel(ppos, { x: 0.5, y: 0.5 }, (0.16 - distToCenter) * 2.5);
      force.x += rf.x;
      force.y += rf.y;
    }
  }
  return true;
}

// Leading branch of tickPhase: a goal was scored last tick, restart from the
// centre spot (the loser kicks off).
export function tickPostGoal(state: MatchState, t: number, callbacks: PhaseCallbacks): void {
  callbacks.resetKickoff(state.pendingGoalScorer!, false);
  callbacks.emit(t, 'kickoff', state.possession, state.kickerId!, undefined, 'Reanuda el juego');
  // resetKickoff has set phase = 'kickoff_setup' and phaseTicks =
  // KICKOFF_SETUP_TICKS (post-goal window for players to walk back).
  state.pendingGoalScorer = null;
  callbacks.snap(t);
}

export function tickKickoffSetup(state: MatchState, t: number, _callbacks: PhaseCallbacks): void {
  const kSide: TeamSide = state.homeSet.has(state.kickerId!) ? 'home' : 'away';
  const behindX = kSide === 'home' ? 0.485 : 0.515;
  const kpos = state.pos[state.kickerId!];
  const atSpot = Math.hypot(kpos.x - behindX, kpos.y - 0.5) < 0.02;
  if (!atSpot && state.ballOwner === state.kickerId) {
    state.phaseTicks = 4;
  } else {
    if (state.ballOwner === state.kickerId) {
      // Snap kicker to "behind ball" stance and anchor ball on the centre
      // spot. The ball stays on (0.5, 0.5) — the kicker just steps in to play.
      state.pos[state.kickerId!] = { x: behindX, y: 0.5 };
      state.ballHeight = 0;
      state.ballHeightVel = 0;
      state.ballVel = { x: 0, y: 0 };
      state.ball = { x: 0.5, y: 0.5 };
    }
    // Pin kicker and partner for the moveAll that runs right after this
    // phase transition: without this they'd drift toward the opposing half
    // (dribble intent + slot spring) in the single tick before the kickoff
    // pass fires. The pass logic itself overrides the kicker's freeze.
    state.vel[state.kickerId!] = { x: 0, y: 0 };
    state.kickFrozenUntil.set(state.kickerId!, t + 250);
    if (state.partnerId) {
      state.vel[state.partnerId] = { x: 0, y: 0 };
      state.kickFrozenUntil.set(state.partnerId, t + 250);
    }
    // Record the instant the ball goes into play on an entrance kickoff (match
    // start + second half) so the viewer can hold the clock at 0'/45' through
    // the player entrance (B2).
    if (state.kickoffEntrance) state.entranceLiveMs.push(t);
    state.kickoffEntrance = false;
    state.phase = 'live';
  }
}

// Half-time / full-time walk-off. All 22 leave through the top-centre tunnel,
// inspired by the expulsion sequence: a diagonal leg toward the touchline
// column, then a straight-north walkout past the camera. Home and away use
// slightly offset columns (TUNNEL_HOME_X / TUNNEL_AWAY_X) so the two teams
// form two parallel single-file lines instead of converging to one point.
// Teammate repulsion (only on the diagonal leg) staggers each line into a
// natural queue. Claims the phase (returns true) so open-play forces don't
// fight the walk-off.
export function applyHalftimeWalkoutForces(
  p: EnginePlayer,
  _isGK: boolean,
  pSide: TeamSide,
  _role: CarrierRole,
  _base: Vec2,
  ppos: Vec2,
  _pvel: Vec2,
  force: Vec2,
  ctx: PhaseForceCtx,
): boolean {
  const TUNNEL_EXIT_Y = 0.06; // top touchline crossover
  const xCol = tunnelX(pSide);

  if (ppos.y > TUNNEL_EXIT_Y) {
    // Diagonal leg: pull each player to the tunnel column at the touchline.
    const sf = spring(ppos, { x: xCol, y: TUNNEL_EXIT_Y }, 0.45);
    force.x += sf.x;
    force.y += sf.y;
    // Teammate repulsion so the line stays single-file rather than a pile-up.
    const teammates = pSide === 'home' ? ctx.homePlayers : ctx.awayPlayers;
    for (const other of teammates) {
      if (other.id === p.id) continue;
      const opos = ctx.pos[other.id];
      const d = Math.hypot(opos.x - ppos.x, opos.y - ppos.y);
      if (d < 0.055 && d > 0) {
        const r = repel(ppos, opos, (0.055 - d) * 2.0);
        force.x += r.x;
        force.y += r.y;
      }
    }
  } else {
    // Walkout leg: straight north past the camera, hugging the column x.
    const sf = spring(ppos, { x: xCol, y: TUNNEL_OFF_FIELD_Y }, 0.55);
    force.x += sf.x;
    force.y += sf.y;
  }
  return true;
}

// End of the half-time walk-off: restage the second-half kickoff. HOME kicked
// off the match, so AWAY takes the second half → lastScorer='home' (kicker =
// the non-kicking side). teleport=true spawns the 22 off-pitch for the
// entrance jog back in; the render has already mirrored ends at the whistle.
export function tickHalftimeWalkout(state: MatchState, t: number, callbacks: PhaseCallbacks): void {
  callbacks.resetKickoff('home', true);
  callbacks.emit(t, 'kickoff', state.possession, state.kickerId!, undefined, '¡Segunda parte!');
  callbacks.snap(t);
}

// Full-time walk-off ends. No restart: the simulation loop terminates right
// after the walkout window closes. Snap so the final off-frame positions are
// captured in a keyframe the viewer can interpolate to.
export function tickFulltimeWalkout(state: MatchState, t: number, callbacks: PhaseCallbacks): void {
  state.phase = 'live'; // cosmetic terminator; the loop is about to exit
  callbacks.snap(t);
}
