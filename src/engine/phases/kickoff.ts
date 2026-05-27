// Kickoff: match-start teleport-into-formation and post-goal walk-back, plus
// the kickoff_setup force field (pull home, clear the centre circle) and the
// tick handlers that release the ball once the kicker is set behind it.

import type { Vec2, TeamSide } from '../../types/match';
import type { EnginePlayer } from '../zoneEngine';
import { spring, repel } from '../forces';
import { baseSlot } from '../lineup';
import { KICKOFF_INITIAL_TICKS, KICKOFF_SETUP_TICKS } from './shared';
import type { CarrierRole, PhaseForceCtx, PhaseCallbacks, MatchState } from './shared';

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

  state.phase      = 'kickoff_setup';
  state.phaseTicks = teleport ? KICKOFF_INITIAL_TICKS : KICKOFF_SETUP_TICKS;

  const behindX = state.possession === 'home' ? 0.485 : 0.515;

  if (teleport) {
    // Match start. 22 players snap into formation; the brief intro lets the
    // user see the shape before the first pass.
    for (const p of state.homePlayers) {
      const slot = baseSlot(p);
      if (p.id !== kicker.id && p.id !== partner.id) slot.x = Math.min(slot.x, 0.48);
      state.pos[p.id] = slot;
      state.vel[p.id] = { x: 0, y: 0 };
    }
    for (const p of state.awayPlayers) {
      const slot = baseSlot(p);
      if (p.id !== kicker.id && p.id !== partner.id) slot.x = Math.max(slot.x, 0.52);
      state.pos[p.id] = slot;
      state.vel[p.id] = { x: 0, y: 0 };
    }
    state.pos[kicker.id]  = { x: behindX, y: 0.50 };
    state.pos[partner.id] = { x: behindX, y: 0.42 };

    // Centre-circle clearance: shove anyone whose teleported slot lands
    // inside the centre circle out to the boundary.
    const CIRCLE_R = 0.15;
    for (const p of state.allPlayers) {
      if (p.id === kicker.id || p.id === partner.id) continue;
      const d = Math.hypot(state.pos[p.id].x - 0.5, state.pos[p.id].y - 0.5);
      if (d < CIRCLE_R && d > 0) {
        const factor = CIRCLE_R / d;
        state.pos[p.id] = {
          x: 0.5 + (state.pos[p.id].x - 0.5) * factor,
          y: 0.5 + (state.pos[p.id].y - 0.5) * factor,
        };
      }
    }
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
    state.phase = 'live';
  }
}
