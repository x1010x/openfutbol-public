// Off-ball intent decision. Classifies each non-carrier non-GK player into a
// single intent that `move.ts` then translates into a tactical force.
//
// Intent set used here:
//   * press            — close down the ball. Top-3 nearest defenders to the
//                        ball plus high-press for fwd/mid versus a rival GK
//                        carrier. Also covers intercept-on-loose-ball when the
//                        opponent kicked.
//   * support_carrier  — provide an outlet/option. Intended receiver chasing a
//                        loose ball, attacking-third fwd/mid crashing the box,
//                        team-mates of a recent loose-ball kick.
//   * run_into_space   — slot-tagged wingers in possession past midfield. Same
//                        rule as the prior Phase 4 slice.
//   * hold_shape       — default. The player has no active tactical pull and
//                        is driven purely by universal forces (slot spring,
//                        repulsion, retreat).
//
// The classification mirrors the role/context branches that lived inside
// `moveAll`'s open-play tree. Strengths/radii live in `move.ts` so the
// decision layer stays a pure router.

import type { MatchState, Intent } from '../types';
import type { EnginePlayer } from '../zoneEngine';
import { HOME_SLOTS, AWAY_SLOTS, HOME_TAGS, AWAY_TAGS } from '../zones';
import { roleOf } from '../state';

export function decide(p: EnginePlayer, state: MatchState): Intent {
  if (p.slotIndex === 0) return { kind: 'idle' };          // GK: handled as special case
  if (p.id === state.ballOwner) return { kind: 'idle' };   // Carrier: handled by decideOnBall + a separate dribble intent

  const pSide  = state.homeSet.has(p.id) ? 'home' : 'away';
  const role   = roleOf(state, p) as 'gk' | 'def' | 'mid' | 'fwd';
  // Expelled team-mates are off the pitch — exclude them from press ranking,
  // crashers count, and any other team-relative reasoning so the remaining
  // 10 players carry the workload.
  const teammates = (pSide === 'home' ? state.homePlayers : state.awayPlayers)
    .filter(t => !state.expelledIds.has(t.id));

  // -- Loose ball --
  if (state.ballOwner === null) {
    if (p.id === state.intendedReceiver) return { kind: 'support_carrier' };

    const ourKick = state.ballLastKickerSide === pSide;
    if (ourKick) return { kind: 'support_carrier' };

    // Their team kicked — try to intercept. Empty targetId; translator chases
    // the ball directly (it's a `press` toward an absent carrier).
    return { kind: 'press', targetId: '' };
  }

  // -- Carried ball, we're defending --
  if (state.possession !== pSide) {
    const carrier = state.playerMap.get(state.ballOwner!);
    const carrierIsGK = carrier !== undefined && carrier.slotIndex === 0;

    // High press on rival GK: every fwd/mid presses, no rank gate.
    if (carrierIsGK && (role === 'fwd' || role === 'mid')) {
      return { kind: 'press', targetId: state.ballOwner! };
    }

    // Top-3 nearest outfield defenders close down. PRESSING LIMIT preserved
    // by the rank gate; off-press players fall back to hold_shape so the line
    // stays compact instead of all 11 collapsing on the ball.
    const sortedByBall = teammates
      .filter(t => t.slotIndex !== 0)
      .map(t => ({ id: t.id, dist: Math.hypot(state.pos[t.id].x - state.ball.x, state.pos[t.id].y - state.ball.y) }))
      .sort((a, b) => a.dist - b.dist);
    const myRank = sortedByBall.findIndex(r => r.id === p.id);
    if (myRank >= 0 && myRank < 3) {
      return { kind: 'press', targetId: state.ballOwner! };
    }

    return { kind: 'hold_shape' };
  }

  // -- Carried ball, we're in possession --

  // Slot-tagged winger advance once the attack crosses midfield. Same target
  // as the prior slice (0.10 ahead of slot, same touchline Y).
  const tag = pSide === 'home' ? HOME_TAGS[p.slotIndex] : AWAY_TAGS[p.slotIndex];
  if (tag === 'wing' && state.phase === 'live') {
    const ballPastMidfield = pSide === 'home' ? state.ball.x > 0.50 : state.ball.x < 0.50;
    if (ballPastMidfield) {
      const slot = pSide === 'home' ? HOME_SLOTS[p.slotIndex] : AWAY_SLOTS[p.slotIndex];
      const targetX = pSide === 'home'
        ? Math.min(0.95, slot.x + 0.10)
        : Math.max(0.05, slot.x - 0.10);
      return { kind: 'run_into_space', target: { x: targetX, y: slot.y } };
    }
  }

  // Full-back overlap: once we're in their half, the FB on the ball-side wing
  // pushes up toward the attacking third / byline. The opposite FB stays put
  // as cover. Y stays on the touchline so we keep width.
  if (tag === 'fb' && state.phase === 'live') {
    const slot = pSide === 'home' ? HOME_SLOTS[p.slotIndex] : AWAY_SLOTS[p.slotIndex];
    const ballInOppHalf  = pSide === 'home' ? state.ball.x > 0.50 : state.ball.x < 0.50;
    const ballInOppThird = pSide === 'home' ? state.ball.x > 0.66 : state.ball.x < 0.34;
    const sameSide = (slot.y < 0.5) ? state.ball.y < 0.55 : state.ball.y > 0.45;
    if (ballInOppHalf && sameSide) {
      // Push deep on the wing — to the byline area when ball is already in
      // the attacking third, to the opp half edge of the final third when the
      // ball is just past midfield. Previously the FB barely passed the
      // halfway line.
      const advance = ballInOppThird ? 0.55 : 0.35;
      const targetX = pSide === 'home'
        ? Math.min(0.88, slot.x + advance)
        : Math.max(0.12, slot.x - advance);
      return { kind: 'run_into_space', target: { x: targetX, y: slot.y } };
    }
  }

  // Crash-the-box for non-winger fwd/mid in attacking third — capped at the
  // two players closest to the ball so the box doesn't pile up with 4+ runners.
  const inAttackingThird = pSide === 'home' ? state.pos[p.id].x > 0.66 : state.pos[p.id].x < 0.33;
  if (inAttackingThird && (role === 'fwd' || role === 'mid')) {
    const crashers = teammates
      .filter(t => t.id !== state.ballOwner && t.slotIndex !== 0)
      .filter(t => {
        const r = roleOf(state, t) as 'gk' | 'def' | 'mid' | 'fwd';
        if (r !== 'fwd' && r !== 'mid') return false;
        const tx = state.pos[t.id].x;
        return pSide === 'home' ? tx > 0.66 : tx < 0.33;
      })
      .map(t => ({ id: t.id, d: Math.hypot(state.pos[t.id].x - state.ball.x, state.pos[t.id].y - state.ball.y) }))
      .sort((a, b) => a.d - b.d);
    const rank = crashers.findIndex(c => c.id === p.id);
    if (rank >= 0 && rank < 2) return { kind: 'support_carrier' };
  }

  return { kind: 'hold_shape' };
}
