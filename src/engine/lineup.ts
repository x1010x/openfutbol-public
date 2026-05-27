// Formation-driven slot layout for the zone engine. Replaces the hardcoded
// HOME_SLOTS / AWAY_SLOTS / *_ROLES / *_TAGS tables (which fixed home to 5-3-2
// and away to 4-4-2) with coordinates derived from each team's real formation.
//
// `FORMATIONS[id]` is an ordered list of 11 Positions; slotIndex i corresponds
// to Position[i] (and to lineup[i] in the manager). We group those positions
// into lines (GK / defence / midfield / attack) and lay each line out down the
// pitch. Home attacks left→right; away is the mirror (x → 1-x).

import type { FormationId, Position } from '../types/game.d.ts';
import type { Vec2 } from '../types/match';
import type { EnginePlayer } from './zoneEngine';
import type { SlotRole, SlotTag } from './zones';
import { FORMATIONS } from './formations';
import { mirrorSlot } from './zones';

// Off-ball home position the player anchors to: the formation slot plus any
// per-player drag offset (user team's "Ajustar alineación"). Clamped to the
// pitch so an aggressive forward push can't park a player off the field.
export function baseSlot(p: EnginePlayer): Vec2 {
  if (!p.slotOffset) return { x: p.slot.x, y: p.slot.y };
  const clamp = (v: number) => (v < 0.03 ? 0.03 : v > 0.97 ? 0.97 : v);
  return {
    x: clamp(p.slot.x + p.slotOffset.x),
    y: clamp(p.slot.y + p.slotOffset.y),
  };
}

export interface LineupLayout {
  slots: Vec2[];
  roles: SlotRole[];
  tags: SlotTag[];
}

// Column X for each line (home, attacking left→right). GK hugs its line; the
// defence/midfield/attack columns match the original 5-3-2 spacing so a team
// playing those shapes lands almost exactly where the old tables put them.
const X_GK = 0.005;
const X_DEF = 0.20;
const X_MID = 0.42;
const X_FWD = 0.60;

const FORWARD_POS: Position[] = ['DEL', 'AML', 'AMR'];

// Spread `count` players evenly down the pitch, centred on y=0.5. The vertical
// span widens with the line size (a back five is wider than a front two) so
// lines stay proportionate to how many players hold them.
function spreadY(count: number): number[] {
  if (count <= 0) return [];
  if (count === 1) return [0.5];
  const halfSpan = Math.min(0.44, 0.12 + 0.08 * (count - 1));
  const step = (2 * halfSpan) / (count - 1);
  return Array.from({ length: count }, (_, i) => +(0.5 - halfSpan + i * step).toFixed(4));
}

export function buildLineupLayout(formationId: FormationId, side: 'home' | 'away'): LineupLayout {
  const positions = FORMATIONS[formationId] ?? FORMATIONS['4-4-2'];

  // Bucket slot indices by line, preserving their order within the formation.
  const def: number[] = [];
  const mid: number[] = [];
  const fwd: number[] = [];
  positions.forEach((pos, i) => {
    if (pos === 'POR') return;
    if (pos === 'DEF') def.push(i);
    else if (pos === 'MED') mid.push(i);
    else if (FORWARD_POS.includes(pos)) fwd.push(i);
    else mid.push(i); // any future line defaults to midfield
  });

  const slots: Vec2[] = new Array(positions.length);
  const roles: SlotRole[] = new Array(positions.length);
  const tags: SlotTag[] = new Array(positions.length);

  // GK
  const gkIdx = positions.indexOf('POR');
  if (gkIdx >= 0) {
    slots[gkIdx] = { x: X_GK, y: 0.5 };
    roles[gkIdx] = 'gk';
    tags[gkIdx] = 'cb_cover'; // placeholder, GK tag is unused
  }

  const layLine = (
    indices: number[],
    x: number,
    role: SlotRole,
    tagFor: (orderInLine: number, count: number, pos: Position) => SlotTag,
  ): void => {
    const ys = spreadY(indices.length);
    indices.forEach((slotIdx, k) => {
      slots[slotIdx] = { x, y: ys[k] };
      roles[slotIdx] = role;
      tags[slotIdx] = tagFor(k, indices.length, positions[slotIdx]);
    });
  };

  // Defence: outermost players are full-backs (overlap) when the line has 4+;
  // a back three has no overlapping full-backs.
  layLine(def, X_DEF, 'def', (k, count) =>
    count >= 4 && (k === 0 || k === count - 1) ? 'fb' : 'cb_cover');

  // Midfield: outermost are wide midfielders (hold width / advance), rest are
  // central. The single pivot in a three keeps 'cm'.
  layLine(mid, X_MID, 'mid', (k, count) =>
    count >= 3 && (k === 0 || k === count - 1) ? 'wing' : 'cm');

  // Attack: wide attackers (AML/AMR) hold width, central ones are strikers.
  layLine(fwd, X_FWD, 'fwd', (_k, _count, pos) =>
    pos === 'AML' || pos === 'AMR' ? 'wing' : 'striker');

  if (side === 'away') {
    for (let i = 0; i < slots.length; i++) {
      if (slots[i]) slots[i] = mirrorSlot(slots[i]);
    }
  }

  return { slots, roles, tags };
}
