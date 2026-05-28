// Reimplementation in TS of the ZOXEXIVO/open-football attribute generator
// (GPL upstream; the algorithm is described in `src/database/src/generators/player.rs`
// and `src/core/src/club/player/ability/skills.rs`). Display-only: we synthesize
// 36 FM-style attributes (1..20) deterministically from CA + primary position +
// player id, so that the weighted average reconstructs the input CA within ±5.
import type { PositionCode } from '../types/game.d.ts';

export interface PlayerAttributes {
  technical: {
    corners: number; crossing: number; dribbling: number; finishing: number;
    firstTouch: number; freeKicks: number; heading: number; longShots: number;
    longThrows: number; marking: number; passing: number; penaltyTaking: number;
    tackling: number; technique: number;
  };
  mental: {
    aggression: number; anticipation: number; bravery: number; composure: number;
    concentration: number; decisions: number; determination: number; flair: number;
    leadership: number; offTheBall: number; positioning: number; teamwork: number;
    vision: number; workRate: number;
  };
  physical: {
    acceleration: number; agility: number; balance: number; jumping: number;
    naturalFitness: number; pace: number; stamina: number; strength: number;
  };
}

const TECH = [
  'corners','crossing','dribbling','finishing','firstTouch','freeKicks',
  'heading','longShots','longThrows','marking','passing','penaltyTaking',
  'tackling','technique',
] as const;
const MENT = [
  'aggression','anticipation','bravery','composure','concentration','decisions',
  'determination','flair','leadership','offTheBall','positioning','teamwork',
  'vision','workRate',
] as const;
const PHYS = [
  'acceleration','agility','balance','jumping','naturalFitness','pace',
  'stamina','strength',
] as const;

type Skill = typeof TECH[number] | typeof MENT[number] | typeof PHYS[number];
const SKILLS: Skill[] = [...TECH, ...MENT, ...PHYS];

// Weights per FM position. Default per skill is 1.0; entries below override.
// Higher weight ⇒ skill matters more for the position and is biased upward.
type WMap = Partial<Record<Skill, number>>;

const W: Record<PositionCode, WMap> = {
  GK: {
    // GK uses general skills since we don't store a separate goalkeeping group.
    // High: anticipation, positioning, concentration, agility, jumping, bravery,
    // composure, heading (cross collection), kicks via free_kicks/long_throws.
    // Low: finishing, dribbling, long_shots, marking, tackling, crossing, corners.
    corners: 0.5, crossing: 0.5, dribbling: 0.5, finishing: 0.4, firstTouch: 0.8,
    freeKicks: 1.0, heading: 1.0, longShots: 0.4, longThrows: 1.3, marking: 0.6,
    passing: 0.9, penaltyTaking: 0.5, tackling: 0.5, technique: 0.9,
    aggression: 1.0, anticipation: 1.5, bravery: 1.5, composure: 1.4,
    concentration: 1.5, decisions: 1.4, determination: 1.2, flair: 0.7,
    leadership: 1.2, offTheBall: 0.6, positioning: 1.5, teamwork: 1.0,
    vision: 0.9, workRate: 0.9,
    acceleration: 0.9, agility: 1.5, balance: 1.3, jumping: 1.4,
    naturalFitness: 1.1, pace: 0.9, stamina: 0.9, strength: 1.2,
  },
  DC: {
    finishing: 0.6, longShots: 0.6, dribbling: 0.7, crossing: 0.6, corners: 0.7,
    heading: 1.5, marking: 1.5, tackling: 1.5, longThrows: 1.0,
    aggression: 1.3, anticipation: 1.4, bravery: 1.4, concentration: 1.3,
    positioning: 1.5, decisions: 1.3, flair: 0.7, offTheBall: 0.7,
    acceleration: 1.0, agility: 1.0, jumping: 1.4, pace: 1.0, strength: 1.4,
  },
  DL: {
    finishing: 0.7, longShots: 0.7, heading: 1.0, marking: 1.3, tackling: 1.3,
    crossing: 1.3, dribbling: 1.0,
    anticipation: 1.2, positioning: 1.3, bravery: 1.2, teamwork: 1.2,
    workRate: 1.3, offTheBall: 1.0,
    acceleration: 1.3, agility: 1.2, pace: 1.3, stamina: 1.3, strength: 1.0,
  },
  DR: {
    finishing: 0.7, longShots: 0.7, heading: 1.0, marking: 1.3, tackling: 1.3,
    crossing: 1.3, dribbling: 1.0,
    anticipation: 1.2, positioning: 1.3, bravery: 1.2, teamwork: 1.2,
    workRate: 1.3, offTheBall: 1.0,
    acceleration: 1.3, agility: 1.2, pace: 1.3, stamina: 1.3, strength: 1.0,
  },
  WBL: {
    finishing: 0.8, longShots: 0.8, marking: 1.1, tackling: 1.2, crossing: 1.4,
    dribbling: 1.2, technique: 1.1,
    positioning: 1.1, workRate: 1.4, offTheBall: 1.2, teamwork: 1.2, decisions: 1.1,
    acceleration: 1.3, agility: 1.2, pace: 1.4, stamina: 1.4,
  },
  WBR: {
    finishing: 0.8, longShots: 0.8, marking: 1.1, tackling: 1.2, crossing: 1.4,
    dribbling: 1.2, technique: 1.1,
    positioning: 1.1, workRate: 1.4, offTheBall: 1.2, teamwork: 1.2, decisions: 1.1,
    acceleration: 1.3, agility: 1.2, pace: 1.4, stamina: 1.4,
  },
  DMC: {
    finishing: 0.7, longShots: 0.9, heading: 1.1, marking: 1.3, tackling: 1.4,
    passing: 1.2, firstTouch: 1.1, technique: 1.0,
    aggression: 1.2, anticipation: 1.3, positioning: 1.4, concentration: 1.2,
    decisions: 1.2, teamwork: 1.3, workRate: 1.3,
    stamina: 1.3, strength: 1.2, naturalFitness: 1.1,
  },
  MC: {
    passing: 1.4, firstTouch: 1.3, technique: 1.3, longShots: 1.1, dribbling: 1.1,
    tackling: 1.0, marking: 0.9,
    decisions: 1.4, vision: 1.4, composure: 1.2, teamwork: 1.3, workRate: 1.3,
    offTheBall: 1.1, anticipation: 1.1,
    stamina: 1.4, naturalFitness: 1.2, agility: 1.1,
  },
  ML: {
    crossing: 1.3, dribbling: 1.3, passing: 1.2, technique: 1.2, firstTouch: 1.1,
    marking: 0.9, tackling: 0.9, longShots: 1.0,
    offTheBall: 1.2, workRate: 1.3, flair: 1.1, decisions: 1.0, vision: 1.1,
    acceleration: 1.3, agility: 1.2, pace: 1.4, stamina: 1.3,
  },
  MR: {
    crossing: 1.3, dribbling: 1.3, passing: 1.2, technique: 1.2, firstTouch: 1.1,
    marking: 0.9, tackling: 0.9, longShots: 1.0,
    offTheBall: 1.2, workRate: 1.3, flair: 1.1, decisions: 1.0, vision: 1.1,
    acceleration: 1.3, agility: 1.2, pace: 1.4, stamina: 1.3,
  },
  AMC: {
    passing: 1.4, firstTouch: 1.4, technique: 1.4, dribbling: 1.3, longShots: 1.2,
    finishing: 1.1, freeKicks: 1.2, marking: 0.6, tackling: 0.6, heading: 0.8,
    vision: 1.5, decisions: 1.3, flair: 1.4, composure: 1.3, offTheBall: 1.3,
    agility: 1.3, balance: 1.2, acceleration: 1.2,
  },
  AML: {
    crossing: 1.3, dribbling: 1.4, finishing: 1.2, firstTouch: 1.3, technique: 1.3,
    longShots: 1.1, marking: 0.6, tackling: 0.6, heading: 0.8,
    flair: 1.3, offTheBall: 1.3, decisions: 1.1, composure: 1.2,
    acceleration: 1.4, agility: 1.3, pace: 1.4, balance: 1.2,
  },
  AMR: {
    crossing: 1.3, dribbling: 1.4, finishing: 1.2, firstTouch: 1.3, technique: 1.3,
    longShots: 1.1, marking: 0.6, tackling: 0.6, heading: 0.8,
    flair: 1.3, offTheBall: 1.3, decisions: 1.1, composure: 1.2,
    acceleration: 1.4, agility: 1.3, pace: 1.4, balance: 1.2,
  },
  FC: {
    finishing: 1.5, dribbling: 1.3, firstTouch: 1.4, heading: 1.3, technique: 1.3,
    longShots: 1.2, penaltyTaking: 1.2, marking: 0.5, tackling: 0.5, crossing: 0.8,
    composure: 1.4, offTheBall: 1.5, anticipation: 1.3, flair: 1.2, decisions: 1.2,
    acceleration: 1.3, pace: 1.3, strength: 1.2, jumping: 1.2, balance: 1.1,
  },
};

function hashString(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function boxMuller(rand: () => number): number {
  // Standard normal via Box-Muller (one sample per call).
  const u1 = Math.max(rand(), 1e-9);
  const u2 = rand();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

const BIAS_K = 4.0;
const SIGMA = 1.3;

function weightFor(pos: PositionCode, skill: Skill): number {
  return W[pos]?.[skill] ?? 1.0;
}

function buildValues(ca: number, pos: PositionCode, rand: () => number, scale: number): number[] {
  const base = ca / 10; // 1..200 → 0..20 base
  return SKILLS.map(sk => {
    const w = weightFor(pos, sk);
    const bias = BIAS_K * (w - 1.0);
    const noise = boxMuller(rand) * SIGMA;
    const v = base + bias + noise * scale;
    return clamp(Math.round(v), 1, 20);
  });
}

function weightedAvg(values: number[], pos: PositionCode): number {
  let num = 0, den = 0;
  for (let i = 0; i < SKILLS.length; i++) {
    const w = weightFor(pos, SKILLS[i]);
    num += values[i] * w;
    den += w;
  }
  return num / den;
}

export function synthesizeAttributes(
  ca: number,
  primaryPositionCode: PositionCode | string,
  playerId: string,
): PlayerAttributes {
  const pos = (W[primaryPositionCode as PositionCode] ? primaryPositionCode : 'MC') as PositionCode;
  const seed = hashString(`${playerId}|${pos}|${ca}`);
  const rand = mulberry32(seed);

  let values = buildValues(ca, pos, rand, 1.0);
  // Verify weighted average reconstructs CA within ±5; one-shot rescale otherwise.
  const derived = weightedAvg(values, pos) * 10;
  if (Math.abs(derived - ca) > 5) {
    const delta = (ca - derived) / 10; // in 0..20 space
    values = values.map(v => clamp(Math.round(v + delta), 1, 20));
  }

  const out = {} as Record<Skill, number>;
  SKILLS.forEach((sk, i) => { out[sk] = values[i]; });

  return {
    technical: Object.fromEntries(TECH.map(k => [k, out[k]])) as PlayerAttributes['technical'],
    mental: Object.fromEntries(MENT.map(k => [k, out[k]])) as PlayerAttributes['mental'],
    physical: Object.fromEntries(PHYS.map(k => [k, out[k]])) as PlayerAttributes['physical'],
  };
}
