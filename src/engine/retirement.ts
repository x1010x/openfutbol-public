import type { Player } from '../types/game.d.ts';

export const SOFT_RETIREMENT_AGE = { POR: 38, default: 35 } as const;
export const HARD_RETIREMENT_AGE = { POR: 42, default: 38 } as const;

const isGK = (player: Player): boolean => player.preferredPos === 'POR';

// xmur3 string hash → uint32 seed for mulberry32, so the same (playerId, year)
// pair always yields the same retirement decision across reloads.
const hashSeed = (str: string): number => {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h ^= h >>> 16;
  return h >>> 0;
};

const seededUnit = (id: string, year: number): number => {
  let t = hashSeed(`${id}|${year}`) + 0x6d2b79f5;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

export const shouldRetire = (player: Player, nextYear: number): boolean => {
  const age = nextYear - player.birthYear;
  const soft = isGK(player) ? SOFT_RETIREMENT_AGE.POR : SOFT_RETIREMENT_AGE.default;
  const hard = isGK(player) ? HARD_RETIREMENT_AGE.POR : HARD_RETIREMENT_AGE.default;
  if (age < soft) return false;
  if (age >= hard) return true;
  const prob = ((age - soft) / (hard - soft)) * 0.6;
  return seededUnit(player.id, nextYear) < prob;
};

export const advancePlayer = (player: Player, nextYear: number): Player | null => {
  if (shouldRetire(player, nextYear)) return null;
  return {
    ...player,
    stamina: 99,
    injuryWeeksRemaining: 0,
    suspensionMatches: 0,
    forSale: false,
    seasonStats: {
      goals: 0,
      assists: 0,
      yellowCards: 0,
      redCards: 0,
      appearances: 0,
      minutes: 0,
      ratingSum: 0,
      cleanSheets: 0,
      goalsAgainst: 0,
    },
  };
};
