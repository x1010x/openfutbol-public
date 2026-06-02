// Decision layer entry point.
//
//   * `decideAll(state)`        — movement intents for every player on the
//                                 pitch (carrier included). Called once per
//                                 tick before `moveAll`.
//   * `decideCarrierAction`     — re-exports `decide/onBall.ts` for the
//                                 orchestrator to dispatch shoot/pass/clear.
//
// The carrier has two intents per tick: a *movement* intent (always a
// `dribble` toward a target derived from current position) and an *action*
// intent (shoot/pass/clear/dribble, returned by `decide/onBall.ts`). Action
// is consumed by the orchestrator to call effectors; movement is consumed by
// `move.ts` to spring the carrier forward.

import type { MatchState, Intent } from '../types';
import type { PlayerId } from '../../types/match';
import { decide as decideOffBall } from './offBall';

export { decide as decideCarrierAction } from './onBall';

function carrierMovementIntent(state: MatchState): Intent {
  const cId = state.carrierId;
  const cpos = state.pos[cId];
  const cSide = state.homeSet.has(cId) ? 'home' : 'away';
  const goalX = cSide === 'home' ? 1.0 : 0.0;
  const inAttackingThird = cSide === 'home' ? cpos.x > 0.66 : cpos.x < 0.33;

  let targetY = cpos.y;
  if (inAttackingThird) {
    // Wingers stay wide until they reach the deep crossing zone; then cut
    // inside. Matches the prior inline behaviour exactly.
    const isWide = cpos.y < 0.28 || cpos.y > 0.72;
    const deepCrossingZone = cSide === 'home' ? cpos.x > 0.80 : cpos.x < 0.20;
    if (isWide && !deepCrossingZone) {
      targetY = cpos.y;
    } else {
      targetY = 0.50;
    }
  }

  return { kind: 'dribble', toward: { x: goalX, y: targetY } };
}

export function decideAll(state: MatchState): Map<PlayerId, Intent> {
  const intents = new Map<PlayerId, Intent>();
  for (const p of state.allPlayers) {
    // Expelled players don't get tactical intents — their movement is driven
    // by the expulsion phase forces (or, in phases before walk-off lands,
    // they're frozen in moveAll). Skip without entering an intent so the
    // map stays clean for downstream consumers.
    if (state.expelledIds.has(p.id)) continue;
    if (p.id === state.carrierId && state.ballOwner === p.id) {
      intents.set(p.id, carrierMovementIntent(state));
    } else if (p.slotIndex === 0) {
      intents.set(p.id, { kind: 'idle' });
    } else {
      intents.set(p.id, decideOffBall(p, state));
    }
  }
  return intents;
}
