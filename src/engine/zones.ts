import type { Lane, Cell, Vec2 } from '../types/match';

export const ZONE_BOUNDS: [number, number][] = [
  [0.00, 0.17],
  [0.17, 0.33],
  [0.33, 0.50],
  [0.50, 0.67],
  [0.67, 0.83],
  [0.83, 1.00],
];

export const LANE_BOUNDS: Record<Lane, [number, number]> = {
  T: [0.00, 0.33],
  C: [0.33, 0.67],
  B: [0.67, 1.00],
};

export const LANES: Lane[] = ['T', 'C', 'B'];

export function cellCenter(cell: Cell): Vec2 {
  const [x0, x1] = ZONE_BOUNDS[cell.zone];
  const [y0, y1] = LANE_BOUNDS[cell.lane];
  return { x: (x0 + x1) / 2, y: (y0 + y1) / 2 };
}

export type SlotRole = 'gk' | 'def' | 'mid' | 'fwd';

// Identifies a slot's tactical role beyond its line. 'wing' = forward winger
// holding width; 'fb' = full-back / wing-back who overlaps higher up when the
// team has possession past midfield. Used by decide/offBall.ts to emit
// `run_into_space` with role-appropriate targets.
export type SlotTag = 'wing' | 'pivot' | 'cb_cover' | 'striker' | 'cm' | 'fb';

// Home team: 5-3-2 (5 defenders, 3 mids, 2 strikers). Attacks left→right.
export const HOME_SLOTS: Vec2[] = [
  { x: 0.005, y: 0.50 },  // 0 GK
  { x: 0.20,  y: 0.08 },  // 1 RWB
  { x: 0.20,  y: 0.30 },  // 2 RCB
  { x: 0.20,  y: 0.50 },  // 3 CB
  { x: 0.20,  y: 0.70 },  // 4 LCB
  { x: 0.20,  y: 0.92 },  // 5 LWB
  { x: 0.42,  y: 0.25 },  // 6 RM
  { x: 0.42,  y: 0.50 },  // 7 CM
  { x: 0.42,  y: 0.75 },  // 8 LM
  { x: 0.60,  y: 0.38 },  // 9 ST
  { x: 0.60,  y: 0.62 },  // 10 ST
];

export const HOME_ROLES: SlotRole[] = [
  'gk',
  'def', 'def', 'def', 'def', 'def',
  'mid', 'mid', 'mid',
  'fwd', 'fwd',
];

// Slots 1 (RWB) and 5 (LWB) are wing-backs — they overlap when we have
// possession past midfield. 6 (RM) and 8 (LM) hold width on the wings; 7 (CM)
// is the pivot. Strikers are tagged so they can be addressed by name later.
export const HOME_TAGS: SlotTag[] = [
  'cb_cover',               // GK — unused, placeholder
  'fb',       'cb_cover', 'cb_cover', 'cb_cover', 'fb',
  'wing',     'cm',         'wing',
  'striker',  'striker',
];

// Away team: 4-4-2 (4 defenders, 4 mids, 2 strikers). Attacks right→left
// (slots already mirrored to the right side of the field).
export const AWAY_SLOTS: Vec2[] = [
  { x: 0.995, y: 0.50 },  // 0 GK
  { x: 0.80,  y: 0.12 },  // 1 RB
  { x: 0.80,  y: 0.37 },  // 2 CB
  { x: 0.80,  y: 0.63 },  // 3 CB
  { x: 0.80,  y: 0.88 },  // 4 LB
  { x: 0.60,  y: 0.12 },  // 5 RM
  { x: 0.60,  y: 0.37 },  // 6 CM
  { x: 0.60,  y: 0.63 },  // 7 CM
  { x: 0.60,  y: 0.88 },  // 8 LM
  { x: 0.38,  y: 0.38 },  // 9 ST
  { x: 0.38,  y: 0.62 },  // 10 ST
];

export const AWAY_ROLES: SlotRole[] = [
  'gk',
  'def', 'def', 'def', 'def',
  'mid', 'mid', 'mid', 'mid',
  'fwd', 'fwd',
];

// Slots 1 (RB) and 4 (LB) are full-backs (overlap when in possession).
// 5 (RM) and 8 (LM) are the wings; 6 and 7 are the central pivots.
export const AWAY_TAGS: SlotTag[] = [
  'cb_cover',
  'fb',       'cb_cover', 'cb_cover', 'fb',
  'wing',     'cm',       'cm',       'wing',
  'striker',  'striker',
];

export function mirrorSlot(s: Vec2): Vec2 {
  return { x: 1 - s.x, y: s.y };
}
