import type { EnginePlayer } from '../engine/zoneEngine';
import type { MatchState } from '../engine/types';
import { createInitialState, setCarrier, emit as stateEmit, snap as stateSnap } from '../engine/state';
import { executeFoul } from '../engine/effectors';
import type { PlayerId, Vec2 } from '../types/match';

type ForcedSeverity = 'normal' | 'cynical' | 'reckless' | 'dogso';

// Role-tinted base stats. Slot indices follow HOME_SLOTS / AWAY_SLOTS in
// zones.ts: 0 = GK, 1–5 = back line, 6–8 = midfield, 9–10 = strikers.
function statsForSlot(slotIndex: number) {
  if (slotIndex === 0) {
    return { speed: 65, dribbling: 50, passing: 65, shooting: 30, defending: 82, physical: 78 };
  }
  if (slotIndex <= 5) {
    return { speed: 72, dribbling: 60, passing: 70, shooting: 50, defending: 78, physical: 78 };
  }
  if (slotIndex <= 8) {
    return { speed: 74, dribbling: 73, passing: 78, shooting: 65, defending: 68, physical: 72 };
  }
  return { speed: 80, dribbling: 78, passing: 70, shooting: 82, defending: 45, physical: 70 };
}

function buildEleven(side: 'home' | 'away'): EnginePlayer[] {
  const arr: EnginePlayer[] = [];
  for (let i = 0; i < 11; i++) {
    arr.push({
      id: `${side}_${i}` as PlayerId,
      slotIndex: i,
      ...statsForSlot(i),
      foulsCommitted: 0,
      yellowCount: 0,
      redCard: false,
      injured: false,
    });
  }
  return arr;
}

export function neutralInitialState(seed: number): MatchState {
  return createInitialState({
    homeTeamId: 'SANDBOX_HOME',
    awayTeamId: 'SANDBOX_AWAY',
    homePlayers: buildEleven('home'),
    awayPlayers: buildEleven('away'),
    seed,
  });
}

// Move a specific player to a position and zero their velocity. Returns the id
// so callers can chain (e.g. then pass it to startThrowIn).
export function placePlayer(
  state: MatchState,
  side: 'home' | 'away',
  slotIndex: number,
  pos: Vec2,
): PlayerId {
  const team = side === 'home' ? state.homePlayers : state.awayPlayers;
  const p = team[slotIndex];
  state.pos[p.id] = { x: pos.x, y: pos.y };
  state.vel[p.id] = { x: 0, y: 0 };
  return p.id;
}

// Hand the ball to a specific player at their current position. Sets carrier,
// possession, and resets the carry timer for the new carrier.
export function giveBallTo(state: MatchState, id: PlayerId): void {
  const side = state.homeSet.has(id) ? 'home' : 'away';
  const pos = state.pos[id];
  state.ball = { x: pos.x, y: pos.y };
  state.ballVel = { x: 0, y: 0 };
  state.ballHeight = 0;
  state.ballHeightVel = 0;
  state.ballOwner = id;
  state.ballLastKicker = null;
  state.ballLastKickerSide = null;
  state.ballKickerLockUntil = 0;
  state.intendedReceiver = null;
  setCarrier(state, id, side);
}

// Pin a player in place for the entire scenario. move.ts reads downUntil and
// zeros velocity + skips forces while down. Useful for taking the GK out of
// the equation when testing post-collision / goal-line physics in isolation.
const FROZEN_FOREVER = 999_999_999;
export function freezePlayer(state: MatchState, id: PlayerId): void {
  state.downUntil.set(id, FROZEN_FOREVER);
  state.vel[id] = { x: 0, y: 0 };
}

// Force a foul on tick 0 — bypasses the tackleProb / foulCommitted rolls so a
// scenario can pin the exact severity it wants to inspect. severity drives
// the card path via decideCard (dogso/reckless → red, cynical → yellow,
// normal → no card unless the tackler is already on a yellow or has hit the
// reiteration threshold). forceInjury=true bypasses the random injury roll.
// Caller is responsible for placing the victim and tackler near each other;
// the foul spot will be the victim's current position.
export function forceFoul(
  state: MatchState,
  tacklerId: PlayerId,
  victimId: PlayerId,
  severity: ForcedSeverity = 'normal',
  opts: { forceInjury?: boolean } = {},
): void {
  executeFoul(state, 0, tacklerId, victimId, {
    forceSeverity: severity,
    forceInjury: opts.forceInjury,
  });
}

// Fire a shot at a precise target. Bypasses `resolveShot` (which adds RNG to
// aim via corner pick + aimErrorY) so post-collision / boundary tests are
// deterministic — same seed and same scenario will always cross the goal
// line at the same y, ballHeight. Caller must have set state.carrierId and
// state.ball to the shooter's feet (e.g. via giveBallTo).
export function forceShotAt(
  state: MatchState,
  target: Vec2,
  opts: { speed?: number; heightVel?: number } = {},
): void {
  if (!state.carrierId) return;
  const carrierId = state.carrierId;
  const side = state.homeSet.has(carrierId) ? 'home' : 'away';
  const dx = target.x - state.ball.x;
  const dy = target.y - state.ball.y;
  const dist = Math.hypot(dx, dy) || 0.001;
  const speed = opts.speed ?? 0.075;
  state.ballVel = { x: (dx / dist) * speed, y: (dy / dist) * speed };
  state.ballHeight = 0;
  state.ballHeightVel = opts.heightVel ?? 0.005;
  state.ballOwner = null;
  state.ballLastKicker = carrierId;
  state.ballLastKickerSide = side;
  state.ballKickerLockUntil = 1500;
  state.intendedReceiver = null;
  state.vel[carrierId] = { x: 0, y: 0 };
  stateSnap(state, 0);
  stateEmit(state, 0, 'shot_on', side, carrierId);
}
