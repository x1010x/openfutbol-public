// Universal open-play forces applied to every non-GK outfielder regardless of
// intent: slot spring (scaled by 1-dominance), teammate/rival repulsion,
// possession pull toward the attacking goal, and defensive retreat.

import type { Vec2, TeamSide } from '../../types/match';
import type { MatchState } from '../types';
import type { EnginePlayer } from '../zoneEngine';
import { spring, attract, repel } from '../forces';

export function applyOutfieldUniversalForces(
  p: EnginePlayer,
  pSide: TeamSide,
  role: 'gk' | 'def' | 'mid' | 'fwd',
  ppos: Vec2,
  base: Vec2,
  slotGain: number,
  state: MatchState,
  force: Vec2,
): void {
  // Slot spring — scaled by (1 - intent.dominance) so active tactical pulls
  // dominate over the formation pull.
  const sf = spring(ppos, base, slotGain);
  force.x += sf.x;
  force.y += sf.y;

  // Repulsion: teammates at 0.14, rivals at 0.06. Widen the teammate radius
  // inside the attacking third so multiple support runners don't pile into
  // the same corner / box area.
  const teammates = pSide === 'home' ? state.homePlayers : state.awayPlayers;
  const rivals    = pSide === 'home' ? state.awayPlayers : state.homePlayers;
  const inAttackingThird = pSide === 'home' ? ppos.x > 0.66 : ppos.x < 0.33;
  const teammateRep = inAttackingThird ? 0.18 : 0.14;
  const teammateRepGain = inAttackingThird ? 2.6 : 2.0;
  for (const other of teammates) {
    if (other.id === p.id) continue;
    if (state.expelledIds.has(other.id)) continue;
    const d = Math.hypot(state.pos[other.id].x - ppos.x, state.pos[other.id].y - ppos.y);
    if (d < teammateRep && d > 0) {
      const r = repel(ppos, state.pos[other.id], (teammateRep - d) * teammateRepGain);
      force.x += r.x; force.y += r.y;
    }
  }
  for (const rival of rivals) {
    if (state.expelledIds.has(rival.id)) continue;
    const d = Math.hypot(state.pos[rival.id].x - ppos.x, state.pos[rival.id].y - ppos.y);
    if (d < 0.06 && d > 0) {
      const r = repel(ppos, state.pos[rival.id], (0.06 - d) * 1.0);
      force.x += r.x; force.y += r.y;
    }
  }

  // Possession pull: light pull toward attacking goal for fwd/mid in possession.
  if (state.possession === pSide && (role === 'fwd' || role === 'mid')) {
    const goalX = pSide === 'home' ? 1.0 : 0.0;
    force.x += (goalX - ppos.x) * (role === 'fwd' ? 0.02 : 0.01);
  }

  // Defensive retreat: pull back to base when defending in rival half.
  if (state.possession !== pSide) {
    const inRivalHalf = pSide === 'home' ? ppos.x > 0.5 : ppos.x < 0.5;
    if (inRivalHalf) {
      const retreat = attract(ppos, base, 0.04);
      force.x += retreat.x; force.y += retreat.y;
    }
  }
}
