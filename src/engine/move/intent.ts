// Bossy-intent → tactical force. Maps a player's current Intent to a force and
// returns a `dominance` ∈ [0,1] that moveAll uses to scale down the slot spring
// (so an active tactical pull overrides the formation pull). Add a new tactical
// idea here (new Intent variant in types.ts + a new case below) — never by
// branching on phase or slotRole in moveAll.

import type { Vec2 } from '../../types/match';
import type { MatchState, Intent } from '../types';
import type { EnginePlayer } from '../zoneEngine';
import { spring, attract } from '../forces';

export interface IntentResult { dominance: number; }

export function applyIntentForce(
  p: EnginePlayer,
  intent: Intent,
  state: MatchState,
  ppos: Vec2,
  force: Vec2,
): IntentResult {
  const pSide = state.homeSet.has(p.id) ? 'home' : 'away';
  const role = p.role;
  const roleGain = role === 'fwd' ? 0.05 : role === 'mid' ? 0.06 : 0.02;

  switch (intent.kind) {
    case 'press': {
      const ballDist = Math.hypot(state.ball.x - ppos.x, state.ball.y - ppos.y);
      const ballLoose = state.ballOwner === null;
      const carrierIsGK = !ballLoose && state.playerMap.get(state.ballOwner!)!.slotIndex === 0;

      let pressRadius: number;
      let gain: number;

      if (ballLoose) {
        pressRadius = 0.45;
        gain = role === 'def' ? 0.16 : role === 'mid' ? 0.13 : 0.08;
      } else if (carrierIsGK && (role === 'fwd' || role === 'mid')) {
        pressRadius = 0.70;
        gain = role === 'fwd' ? 0.22 : 0.16;
      } else {
        pressRadius = 0.35;
        gain = role === 'def' ? 0.14 : role === 'mid' ? 0.11 : 0.06;
      }

      if (ballDist < pressRadius) {
        const strength = (1 - ballDist / pressRadius) * gain;
        const af = attract(ppos, state.ball, strength);
        force.x += af.x;
        force.y += af.y;
      }
      return { dominance: 0.6 };
    }

    case 'support_carrier': {
      const ballDist = Math.hypot(state.ball.x - ppos.x, state.ball.y - ppos.y);
      const ballLoose = state.ballOwner === null;

      // Ball-side support (chase / move toward the ball)
      let pressRadius: number;
      let gain: number;
      if (ballLoose) {
        if (p.id === state.intendedReceiver) {
          pressRadius = 0.55;
          gain = 0.25;
        } else {
          pressRadius = 0.40;
          gain = role === 'def' ? 0.10 : role === 'mid' ? 0.12 : 0.10;
        }
      } else {
        pressRadius = 0.35;
        gain = roleGain;
      }
      if (ballDist < pressRadius) {
        const strength = (1 - ballDist / pressRadius) * gain;
        const af = attract(ppos, state.ball, strength);
        force.x += af.x;
        force.y += af.y;
      }

      // Crash-the-box bonus: non-wing fwd/mid in attacking third with ball.
      if (!ballLoose && state.possession === pSide) {
        const inAttackingThird = pSide === 'home' ? ppos.x > 0.66 : ppos.x < 0.33;
        if (inAttackingThird && (role === 'fwd' || role === 'mid')) {
          const goalX = pSide === 'home' ? 1.0 : 0.0;
          const opps = pSide === 'home' ? state.awayPlayers : state.homePlayers;
          const rivals = opps.filter(o => o.slotIndex !== 0);
          const lastDefenderX = rivals.reduce((acc, r) => {
            const rx = state.pos[r.id].x;
            return pSide === 'home' ? Math.max(acc, rx) : Math.min(acc, rx);
          }, pSide === 'home' ? 0.0 : 1.0);
          const offsideLimitX = pSide === 'home'
            ? Math.max(lastDefenderX, state.ball.x) - 0.02
            : Math.min(lastDefenderX, state.ball.x) + 0.02;
          if (role === 'fwd') {
            const targetX = pSide === 'home' ? Math.min(goalX, offsideLimitX) : Math.max(goalX, offsideLimitX);
            const af = attract(ppos, { x: targetX, y: 0.50 }, 0.06);
            force.x += af.x;
            force.y += af.y;
          } else {
            const boxEdgeX = pSide === 'home' ? 0.80 : 0.20;
            const targetX = pSide === 'home' ? Math.min(boxEdgeX, offsideLimitX) : Math.max(boxEdgeX, offsideLimitX);
            const af = attract(ppos, { x: targetX, y: 0.50 }, 0.03);
            force.x += af.x;
            force.y += af.y;
          }
        }
      }
      return { dominance: 0.4 };
    }

    case 'run_into_space': {
      const sf = spring(ppos, intent.target, 0.06);
      force.x += sf.x;
      force.y += sf.y;
      return { dominance: 0.6 };
    }

    case 'dribble': {
      // Carrier: spring toward the dribble target. Matches the prior
      // "intentional movement toward goal" force.
      const af = attract(ppos, intent.toward, 0.08);
      force.x += af.x;
      force.y += af.y;
      return { dominance: 0.6 };
    }

    default:
      return { dominance: 0.0 };
  }
}

// Legacy export retained for the (now-empty) compatibility path in zoneEngine.
// Returns whether the intent fully owned the force budget — kept for any
// callers wired before the full `moveAll` extraction.
export function intentToForce(intent: Intent, ppos: Vec2, force: Vec2): boolean {
  if (intent.kind === 'run_into_space') {
    const sf = spring(ppos, intent.target, 0.05);
    force.x += sf.x;
    force.y += sf.y;
    return true;
  }
  return false;
}
