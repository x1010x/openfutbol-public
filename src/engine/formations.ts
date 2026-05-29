import type { FormationId, Player, PlayerStats, Position, PositionCode, Team } from '../types/game.d.ts';
import { engineSettings } from './engineSettings';

export const OOP_PENALTY = 0.825;
export const GK_OOP_PENALTY = 0.45;

export const FORMATIONS: Record<FormationId, Position[]> = {
  '4-4-2': ['POR', 'DEF', 'DEF', 'DEF', 'DEF', 'MED', 'MED', 'MED', 'MED', 'DEL', 'DEL'],
  '5-3-2': ['POR', 'DEF', 'DEF', 'DEF', 'DEF', 'DEF', 'MED', 'MED', 'MED', 'DEL', 'DEL'],
  '4-3-3': ['POR', 'DEF', 'DEF', 'DEF', 'DEF', 'MED', 'MED', 'MED', 'AML', 'DEL', 'AMR'],
  '4-2-4': ['POR', 'DEF', 'DEF', 'DEF', 'DEF', 'MED', 'MED', 'AML', 'DEL', 'DEL', 'AMR'],
  '5-4-1': ['POR', 'DEF', 'DEF', 'DEF', 'DEF', 'DEF', 'MED', 'MED', 'MED', 'MED', 'DEL'],
  '3-4-3': ['POR', 'DEF', 'DEF', 'DEF', 'MED', 'MED', 'MED', 'MED', 'AML', 'DEL', 'AMR'],
};

export const ALL_FORMATIONS: FormationId[] = ['4-4-2', '5-3-2', '4-3-3', '4-2-4', '5-4-1', '3-4-3'];

// Map: legacy formation slot → new PositionCodes that count as natural.
const LEGACY_SLOT_TO_CODES: Record<Position, PositionCode[]> = {
  POR: ['GK'],
  DEF: ['DC', 'DL', 'DR', 'WBL', 'WBR'],
  MED: ['DMC', 'MC', 'ML', 'MR'],
  DEL: ['FC'],
  AML: ['AML', 'WBL', 'ML'],
  AMR: ['AMR', 'WBR', 'MR'],
};

// Soccer-geography distance between formation slots. Used when a player has no
// native rating for the slot they're forced into. POR is disconnected from field
// roles (any GK<->outfield swap is catastrophic).
const SLOT_DISTANCE: Record<Position, Record<Position, number>> = {
  POR: { POR: 0, DEF: 99, MED: 99, AML: 99, AMR: 99, DEL: 99 },
  DEF: { POR: 99, DEF: 0, MED: 1, AML: 2, AMR: 2, DEL: 3 },
  MED: { POR: 99, DEF: 1, MED: 0, AML: 1, AMR: 1, DEL: 2 },
  AML: { POR: 99, DEF: 2, MED: 1, AML: 0, AMR: 1, DEL: 1 },
  AMR: { POR: 99, DEF: 2, MED: 1, AML: 1, AMR: 0, DEL: 1 },
  DEL: { POR: 99, DEF: 3, MED: 2, AML: 1, AMR: 1, DEL: 0 },
};

const ALL_SLOTS: Position[] = ['POR', 'DEF', 'MED', 'AML', 'AMR', 'DEL'];

const nativeFactor = (level: number): number => (level / 20) ** 1.5;

export const positionLevelFactor = (player: Player, slotPos: Position): number => {
  // Native rating for this exact slot — use it.
  const codes = LEGACY_SLOT_TO_CODES[slotPos];
  let bestLevel = 0;
  for (const entry of player.positions ?? []) {
    if (codes.includes(entry.code) && entry.level > bestLevel) {
      bestLevel = entry.level;
    }
  }
  if (bestLevel > 0) return Math.max(0.1, nativeFactor(bestLevel));

  // OOP: find the player's best-rated slot and apply a distance penalty.
  let bestSlot: Position | null = null;
  let bestSlotLevel = 0;
  for (const slot of ALL_SLOTS) {
    const cs = LEGACY_SLOT_TO_CODES[slot];
    let lvl = 0;
    for (const entry of player.positions ?? []) {
      if (cs.includes(entry.code) && entry.level > lvl) lvl = entry.level;
    }
    if (lvl > bestSlotLevel) { bestSlotLevel = lvl; bestSlot = slot; }
  }
  if (!bestSlot) return 0.1; // player with no positional data at all

  const distance = SLOT_DISTANCE[bestSlot][slotPos] ?? 99;
  // GK <-> outfield swap: hard floor.
  if (distance >= 99) return Math.max(0.1, engineSettings.gkOopPenalty);

  const base = engineSettings.oopPenalty; // e.g. 0.825 per step
  const distancePenalty = Math.pow(base, distance);
  return Math.max(0.25, nativeFactor(bestSlotLevel) * distancePenalty);
};

export const effectiveAbility = (player: Player, slotPos: Position): number => {
  const stam = player.stamina ?? 99;
  const stamFactor = 0.8 + 0.2 * (stam / 99);
  const ca = player.current_ability ?? (player.media ?? 50) * 2;
  return ca * positionLevelFactor(player, slotPos) * stamFactor;
};

// Position-weighted stat importance — used by legacy code paths only.
const STAT_WEIGHTS: Record<Position, Record<keyof PlayerStats, number>> = {
  POR: { goalkeeping: 0.70, defending: 0.15, physical: 0.05, speed: 0.05, passing: 0.03, dribbling: 0.01, shooting: 0.01 },
  DEF: { defending: 0.35, physical: 0.25, speed: 0.20, passing: 0.10, dribbling: 0.06, shooting: 0.03, goalkeeping: 0.01 },
  MED: { passing: 0.25, dribbling: 0.20, defending: 0.15, physical: 0.15, speed: 0.15, shooting: 0.09, goalkeeping: 0.01 },
  DEL: { shooting: 0.30, speed: 0.22, dribbling: 0.22, passing: 0.14, physical: 0.08, defending: 0.03, goalkeeping: 0.01 },
  AML: { speed: 0.28, dribbling: 0.28, shooting: 0.22, passing: 0.14, physical: 0.05, defending: 0.02, goalkeeping: 0.01 },
  AMR: { speed: 0.28, dribbling: 0.28, shooting: 0.22, passing: 0.14, physical: 0.05, defending: 0.02, goalkeeping: 0.01 },
};

export const computePositionWeightedMedia = (stats: PlayerStats, pos: Position): number => {
  const w = STAT_WEIGHTS[pos];
  return (w.speed ?? 0) * stats.speed + (w.dribbling ?? 0) * stats.dribbling + (w.passing ?? 0) * stats.passing
       + (w.shooting ?? 0) * stats.shooting + (w.defending ?? 0) * stats.defending + (w.physical ?? 0) * stats.physical
       + (w.goalkeeping ?? 0) * (stats.goalkeeping ?? 0);
};

// Legacy shim — components still import this. Tests OOP via the legacy positions list.
export const isOOP = (player: Player, slotPos: Position): boolean =>
  !player.allowedPositions.includes(slotPos);

export const slotPenalty = (player: Player, slotPos: Position): number => {
  if (!isOOP(player, slotPos)) return 1;
  return slotPos === 'POR' ? engineSettings.gkOopPenalty : engineSettings.oopPenalty;
};

export const rawMedia = (player: Player): number => player.media ?? 50;

// Thin aliases so existing imports compile.
export const effectiveMedia = effectiveAbility;

export const liveMed = (player: Player, _stam: number, slotPos?: Position): number =>
  effectiveAbility(player, slotPos ?? player.position);

export const effectiveStat = (
  player: Player,
  stat: keyof PlayerStats,
  slotPos: Position,
): number => {
  const raw = player.stats?.[stat] ?? 50; // 0-100
  const stam = player.stamina ?? 99;
  const stamFactor = 0.8 + 0.2 * (stam / 99);
  // Scale to ~CA range (1-200) so duels stay magnitude-compatible with effectiveAbility.
  return raw * 2 * positionLevelFactor(player, slotPos) * stamFactor;
};

export const buildSlotMap = (team: Team): Map<string, Position> => {
  const slots = FORMATIONS[team.formation];
  const map = new Map<string, Position>();
  if (!slots) return map;
  for (let i = 0; i < team.lineup.length && i < slots.length; i++) {
    map.set(team.lineup[i], slots[i]);
  }
  return map;
};

export const slotPositionFor = (team: Team, playerId: string): Position | null => {
  const slots = FORMATIONS[team.formation];
  if (!slots) return null;
  const idx = team.lineup.indexOf(playerId);
  if (idx === -1) return null;
  return slots[idx] ?? null;
};

// Score used to rank players *for lineup selection*. Steeper stamina penalty than
// effectiveAbility so the AI naturally rotates tired stars out when a fresher sub
// is in striking distance. Match-time strength still uses effectiveAbility.
const selectionScore = (player: Player, slotPos: Position): number => {
  const stam = player.stamina ?? 99;
  // Curve: 99 → 1.00, 80 → 0.87, 60 → 0.72, 40 → 0.58, 20 → 0.44
  const stamFactor = 0.3 + 0.7 * (stam / 99);
  const ca = player.current_ability ?? (player.media ?? 50) * 2;
  return ca * positionLevelFactor(player, slotPos) * stamFactor;
};

export const pickBestXI = (
  players: Player[],
  formationId: FormationId,
  excludeIds: Set<string> = new Set(),
  disciplined: boolean = false,
): { lineup: string[]; strength: number } => {
  const slots = FORMATIONS[formationId];
  const eligible = players.filter(p =>
    !excludeIds.has(p.id) &&
    (p.suspensionMatches ?? 0) === 0 &&
    (p.injuryWeeksRemaining ?? 0) === 0
  );
  const used = new Set<string>();
  const lineup: string[] = [];
  let strength = 0;

  for (const slotPos of slots) {
    let best: Player | null = null;
    let bestScore = -Infinity;
    const natives = eligible.filter(p => !used.has(p.id) && p.allowedPositions.includes(slotPos));
    const useNativesFirst = slotPos === 'POR' || (disciplined && natives.length > 0);
    const pool = useNativesFirst && natives.length > 0 ? natives : eligible;

    for (const p of pool) {
      if (used.has(p.id)) continue;
      const score = selectionScore(p, slotPos);
      if (score > bestScore) {
        bestScore = score;
        best = p;
      }
    }

    if (!best && disciplined) {
      for (const p of eligible) {
        if (used.has(p.id)) continue;
        const score = selectionScore(p, slotPos);
        if (score > bestScore) {
          bestScore = score;
          best = p;
        }
      }
    }

    if (best) {
      lineup.push(best.id);
      used.add(best.id);
      // Report match-time strength (used by pickBestFormation to compare formations).
      strength += effectiveAbility(best, slotPos);
    } else {
      lineup.push('');
    }
  }
  return { lineup, strength };
};

export const pickBestFormation = (
  players: Player[],
  excludeIds: Set<string> = new Set(),
  disciplined: boolean = false,
): { formation: FormationId; lineup: string[] } => {
  let bestFormation: FormationId = '4-4-2';
  let bestLineup: string[] = [];
  let bestStrength = -Infinity;
  for (const f of ALL_FORMATIONS) {
    const { lineup, strength } = pickBestXI(players, f, excludeIds, disciplined);
    if (lineup.length === 11 && strength > bestStrength) {
      bestStrength = strength;
      bestFormation = f;
      bestLineup = lineup;
    }
  }
  if (bestLineup.length === 0) {
    const r = pickBestXI(players, '4-4-2', excludeIds, disciplined);
    return { formation: '4-4-2', lineup: r.lineup };
  }
  return { formation: bestFormation, lineup: bestLineup };
};

export const reslotLineup = (
  team: Team,
  titularIds: string[],
  formationId: FormationId,
): string[] => {
  const slots = FORMATIONS[formationId];
  const candidates = team.players.filter(p => titularIds.includes(p.id));
  const used = new Set<string>();
  const lineup: string[] = [];
  for (const slotPos of slots) {
    let best: Player | null = null;
    let bestScore = -Infinity;
    const natives = slotPos === 'POR'
      ? candidates.filter(p => !used.has(p.id) && p.allowedPositions.includes('POR'))
      : null;
    const pool = natives && natives.length > 0 ? natives : candidates;
    for (const p of pool) {
      if (used.has(p.id)) continue;
      const score = effectiveAbility(p, slotPos);
      if (score > bestScore) {
        bestScore = score;
        best = p;
      }
    }
    if (best) {
      lineup.push(best.id);
      used.add(best.id);
    } else {
      lineup.push('');
    }
  }
  while (lineup.length > 0 && lineup[lineup.length - 1] === '') lineup.pop();
  return lineup;
};
