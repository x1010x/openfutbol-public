// Live substitution for the zone engine (Bloque 8). Swaps an on-pitch player
// for a bench player in place on a MatchState, preserving the formation slot so
// the team shape is unchanged. The incoming player inherits the outgoing's
// slot/role/tag and spawns just off the nearest touchline, so the normal
// off-ball slot spring jogs them onto the pitch during live play (the same
// "run on from the touchline" used by the half-time entrance, Bloque 7.b) — no
// special phase needed. Emits a 'sub' timeline event.
//
// This is a pure state mutation: the caller (the resume/splice helper) recovers
// the MatchState at the pause instant by deterministic replay, applies the
// substitution here, then continues the simulation for the rest of the match.

import type { MatchState } from './types';
import type { EnginePlayer } from './zoneEngine';
import type { PlayerId, TeamSide } from '../types/match';
import type { FormationId } from '../types/game.d.ts';
import { emit } from './state';
import { buildLineupLayout } from './lineup';

// Replace `outId` (on the pitch) with `incoming` (from the bench). `incoming`
// supplies the new player's id + stats; its slotIndex/slot/role/tag are
// overwritten from the outgoing player so the formation anchor is preserved.
// Returns the side the change happened on, or null if `outId` isn't playing.
export function applySubstitution(
  state: MatchState,
  t: number,
  outId: PlayerId,
  incoming: EnginePlayer,
  log?: string,
): TeamSide | null {
  const side: TeamSide = state.homeSet.has(outId) ? 'home' : 'away';
  const arr = side === 'home' ? state.homePlayers : state.awayPlayers;
  const idx = arr.findIndex(p => p.id === outId);
  if (idx < 0) return null;
  const outgoing = arr[idx];

  // The replacement keeps the outgoing player's position in the formation; only
  // identity, stats and (reset) discipline/fitness come from the bench player.
  const replacement: EnginePlayer = {
    ...incoming,
    slotIndex: outgoing.slotIndex,
    slot: outgoing.slot,
    slotOffset: outgoing.slotOffset,
    role: outgoing.role,
    tag: outgoing.tag,
    foulsCommitted: 0,
    yellowCount: 0,
    redCard: false,
    injured: false,
  };

  // Swap in the team array and the flat allPlayers list; keep all references
  // (the per-tick loops read these fresh each tick) by mutating in place.
  arr[idx] = replacement;
  const allIdx = state.allPlayers.findIndex(p => p.id === outId);
  if (allIdx >= 0) state.allPlayers[allIdx] = replacement;

  // Lookup structures.
  state.playerMap.delete(outId);
  state.playerMap.set(replacement.id, replacement);
  if (side === 'home') { state.homeSet.delete(outId); state.homeSet.add(replacement.id); }

  // Per-player runtime state: drop the outgoing player's entries and seed the
  // incoming one. Spawn just off the NORTH touchline at the slot's x (B3:
  // substitutes enter from the same side as the team entrance, not the nearest
  // band); the live-play clamp brings them to the touchline and the off-ball
  // forces jog them onto the pitch toward their slot.
  const offY = -0.12;
  delete state.pos[outId];
  delete state.vel[outId];
  state.pos[replacement.id] = { x: replacement.slot.x, y: offY };
  state.vel[replacement.id] = { x: 0, y: 0 };
  state.wander.delete(outId);
  state.wander.set(replacement.id, {
    dx: (state.rng() - 0.5) * 0.06,
    dy: (state.rng() - 0.5) * 0.06,
    timer: 1 + Math.floor(state.rng() * 18),
  });
  state.downUntil.delete(outId);
  state.kickFrozenUntil.delete(outId);
  state.injuredIds.delete(outId);
  state.aggressionWindowUntil.delete(outId);
  delete state.gkDive[outId];

  // If the outgoing player held the ball or any set-piece role at the pause
  // instant, hand it off cleanly: drop the ball loose (the tail sim's pickup
  // logic reassigns it to the nearest player) and clear stale references rather
  // than gluing the ball to a player who is jogging on from off-pitch.
  if (state.ballOwner === outId) { state.ballOwner = null; state.intendedReceiver = null; }
  if (state.carrierId === outId) state.carrierId = replacement.id;
  if (state.kickerId === outId) state.kickerId = null;
  if (state.partnerId === outId) state.partnerId = null;
  if (state.intendedReceiver === outId) state.intendedReceiver = null;
  if (state.ballLastKicker === outId) { state.ballLastKicker = null; state.ballLastKickerSide = null; }

  emit(state, t, 'sub', side, replacement.id, outId, log ?? 'Cambio');
  return side;
}

// Live formation/lineup change for the zone engine. Re-assigns slot, role and
// tag for each player on the field according to a new formation + lineup
// ordering. The 11 on the pitch stay the same (subs go through
// applySubstitution); only their anchors move. `newLineup[i]` is the player id
// at slot i of `newFormation`. Per-slot drag offsets are also remapped.
//
// Players in the team array that are not present in `newLineup` (e.g. someone
// who walked off after a red card) keep their existing slot data so the
// expulsion walk-off / parking logic isn't disturbed.
export function applyFormationChange(
  state: MatchState,
  t: number,
  side: TeamSide,
  newFormation: FormationId,
  newLineup: string[],
  newOffsets: Record<number, { dx: number; dy: number }> | undefined,
): void {
  const arr = side === 'home' ? state.homePlayers : state.awayPlayers;
  const layout = buildLineupLayout(newFormation, side);
  const fwdSign = side === 'home' ? 1 : -1;

  for (let i = 0; i < newLineup.length && i < 11; i++) {
    const pid = newLineup[i] as PlayerId;
    if (!pid) continue;
    const player = arr.find(p => p.id === pid);
    if (!player) continue;
    player.slotIndex = i;
    player.slot = layout.slots[i] ?? { x: 0.5, y: 0.5 };
    player.role = layout.roles[i] ?? 'mid';
    player.tag = layout.tags[i] ?? 'cm';
    const off = newOffsets?.[i];
    player.slotOffset = off ? { x: off.dx * fwdSign, y: off.dy } : undefined;
  }

  emit(state, t, 'tactic', side, undefined, undefined, `Cambio táctico: ${newFormation}`);
}
