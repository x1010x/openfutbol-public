// Kickoff ball routine: the initial tap to the partner and the partner's
// immediate lay-off to a deeper teammate (classic kickoff). Also hosts two
// visual-debug boots (set to null in normal play). Returns true when it
// consumed the tick (caller should `continue`). Extracted verbatim from
// simulateFromState's tick loop.

import type { MatchState } from '../types';
import { emit as stateEmit, snap as stateSnap, sideOf } from '../state';
import { resolvePass, type EffectorDeps } from '../effectors';

const KICK_FREEZE_MS = 250;

// Visual-debug knob: when set, the very first kickoff is replaced with a
// sideways boot that sails out for a throw-in on the chosen touchline. Lets
// us inspect the OOB throw-in flow without waiting for a natural sideline
// exit. Set to null once the throw-in look-and-feel is validated.
type DebugKickoffSide = null | 'north' | 'south';
const DEBUG_KICKOFF_OOB: DebugKickoffSide = null;

// Same idea for the goal-kick sequence: boot the kickoff over a goal line
// (wide of the posts so it's an OOB, not a goal). Both directions use the
// natural last-toucher (the home kicker who booted it):
//   'east' → ball over away goal line  → goal kick for the away GK
//   'west' → ball over home goal line  → corner for the away team
// Set to null once validated.
type DebugGoalKickSide = null | 'east' | 'west';
const DEBUG_KICKOFF_GOAL_KICK: DebugGoalKickSide = null;

export function tickKickoffRoutine(state: MatchState, t: number, effectorDeps: EffectorDeps): boolean {
  if (state.needsKickoffPass) {
    state.needsKickoffPass = false;
    if (DEBUG_KICKOFF_GOAL_KICK === 'east' || DEBUG_KICKOFF_GOAL_KICK === 'west') {
      // Boot the kickoff straight at a goal line, wide of the posts so
      // it's an OOB not a goal. Trajectory targets a *high* arc on top
      // of fast horizontal so the ball clears the rival GK's reach
      // ceiling (GK_REACH_H = 0.22) — at lower arcs the keeper tracks
      // the y-cross and catches the ball before it crosses the line.
      stateSnap(state, t);
      const goingEast = DEBUG_KICKOFF_GOAL_KICK === 'east';
      const dirX = goingEast ?  0.090 : -0.090;
      // y deflection puts the ball comfortably outside the goal mouth
      // (y in [0.435, 0.565]) by the time it crosses the goal line.
      const dirY = 0.025;
      state.ballVel = { x: dirX, y: dirY };
      state.ballHeight = 0;
      state.ballHeightVel = 0.050;
      state.ballOwner = null;
      state.ballLastKicker = state.carrierId;
      const carrierSide = sideOf(state, state.carrierId);
      // 'east': real last-toucher (home/kicker) → ball over away goal →
      //         away is the defender → goal kick for away GK. Works as is.
      // 'west': ball over home goal. With real last-toucher (home) the
      //         result would be a corner for away. We're testing the
      //         goal-kick sequence, so forge the last-toucher to the
      //         opposite team so home GK takes the kick.
      // Natural last-toucher (= the home kicker) works for both directions:
      //   east → ball over away goal, defender side = away ≠ home → goal kick for away GK
      //   west → ball over home goal, defender side = home = home  → corner for away
      state.ballLastKickerSide = carrierSide;
      // Longer kicker lock — the boot needs ~7 ticks to clear the goal
      // line, more than the default 800ms (3.2 ticks) of carrier lock.
      state.ballKickerLockUntil = t + 2000;
      state.intendedReceiver = null;
      state.kickFrozenUntil.set(state.carrierId, t + KICK_FREEZE_MS);
      stateEmit(state, t, 'pass_forward', carrierSide, state.carrierId, undefined, 'DEBUG: boot a portería');
      return true;
    }
    if (DEBUG_KICKOFF_OOB !== null) {
      // Boot the ball straight at the chosen touchline so we can watch the
      // throw-in flow on demand. Carrier is at centre (0.5, 0.5).
      stateSnap(state, t);
      const dirY = DEBUG_KICKOFF_OOB === 'north' ? -0.060 : 0.060;
      state.ballVel = { x: 0.005, y: dirY };
      state.ballHeight = 0;
      state.ballHeightVel = 0.020;
      state.ballOwner = null;
      state.ballLastKicker = state.carrierId;
      state.ballLastKickerSide = sideOf(state, state.carrierId);
      state.ballKickerLockUntil = t + 800;
      state.intendedReceiver = null;
      state.kickFrozenUntil.set(state.carrierId, t + KICK_FREEZE_MS);
      stateEmit(state, t, 'pass_short', sideOf(state, state.carrierId), state.carrierId, undefined, 'DEBUG: boot a banda');
      return true;
    }
    // Force pass to partner for kickoff
    const p = state.playerMap.get(state.partnerId!);
    if (p) {
      stateSnap(state, t);
      const tpos = state.pos[p.id];
      const cpos = state.pos[state.carrierId];
      const dx = tpos.x - cpos.x;
      const dy = tpos.y - cpos.y;
      const dist = Math.hypot(dx, dy) || 0.001;
      const speed = 0.045;
      state.ballVel = { x: (dx / dist) * speed, y: (dy / dist) * speed };
      state.ballHeight = 0;
      state.ballHeightVel = 0;
      state.ballOwner = null;
      state.ballLastKicker = state.carrierId;
      state.ballLastKickerSide = sideOf(state, state.carrierId);
      state.ballKickerLockUntil = t + 800;
      state.intendedReceiver = p.id;
      state.kickFrozenUntil.set(state.carrierId, t + KICK_FREEZE_MS);
      // Partner stays put while the ball arrives and through the back-pass
      // animation. Without this they'd chase the ball forward via the
      // intended-receiver support force and the "stay in the circle" feel
      // is lost.
      state.kickFrozenUntil.set(p.id, t + 1500);
      state.needsKickoffBackPass = true;
      stateEmit(state, t, 'pass_short', sideOf(state, state.carrierId), state.carrierId, p.id, 'Saque inicial');
    } else {
      resolvePass(state, t, effectorDeps);
    }
    return true;
  }

  // After the kickoff tap, partner receives and immediately plays it back to
  // a midfielder/defender behind them — classic kickoff routine.
  if (state.needsKickoffBackPass && state.partnerId !== null && state.ballOwner === state.partnerId) {
    state.needsKickoffBackPass = false;
    const partnerSide = sideOf(state, state.partnerId);
    const ownTeam = partnerSide === 'home' ? state.homePlayers : state.awayPlayers;
    const ppos = state.pos[state.partnerId];
    const isHome = partnerSide === 'home';
    // Pick the closest teammate that's strictly behind the partner (in the
    // own half). Mids preferred; falls back to anyone behind if none qualify.
    const behind = ownTeam
      .filter(tm => tm.id !== state.partnerId && tm.slotIndex !== 0 && !state.expelledIds.has(tm.id))
      .filter(tm => isHome ? state.pos[tm.id].x < ppos.x - 0.04 : state.pos[tm.id].x > ppos.x + 0.04)
      .sort((a, b) => {
        const ap = state.pos[a.id], bp = state.pos[b.id];
        return Math.hypot(ap.x - ppos.x, ap.y - ppos.y) - Math.hypot(bp.x - ppos.x, bp.y - ppos.y);
      });
    const target = behind[0];
    if (target) {
      resolvePass(state, t, effectorDeps, target.id);
    }
    return true;
  }

  return false;
}
