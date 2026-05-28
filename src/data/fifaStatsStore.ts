// In-memory index of stat-pack entries, keyed by data-pack source_id.
// StatsPackProvider calls setStatsIndex() when a pack loads; playerBuilder
// consults getFifaStats() during PackPlayer instantiation. Missing entries
// fall back to the deterministic synthesizer.
import type { PlayerAttributes } from './playerAttributes';

interface FifaMacro { pa: number; sh: number; ps: number; dr: number; de: number; ph: number; gk?: number; }
interface FifaMicro {
  crossing: number; finishing: number; heading: number; shortPassing: number; volleys: number;
  dribblingSkill: number; curve: number; fkAccuracy: number; longPassing: number; ballControl: number;
  longShots: number; marking: number; standingTackle: number; slidingTackle: number; penalties: number;
  aggression: number; interceptions: number; positioning: number; vision: number; composure: number;
  reactions: number; intRep: number;
  acceleration: number; sprintSpeed: number; agility: number; balance: number; shotPower: number;
  jumping: number; stamina: number; strength: number;
}
export interface FifaEntry { fy: number; ov: number; macro: FifaMacro; micro: FifaMicro; gk: number; }

let index: Map<number, FifaEntry> = new Map();

export const setStatsIndex = (entries: Record<string, FifaEntry> | null): void => {
  if (!entries) { index = new Map(); return; }
  const m = new Map<number, FifaEntry>();
  for (const [k, v] of Object.entries(entries)) m.set(Number(k), v);
  index = m;
};

export const getFifaStats = (sourceId: number | undefined): FifaEntry | undefined => {
  if (sourceId == null) return undefined;
  return index.get(sourceId);
};

const c20 = (n: number) => Math.max(1, Math.min(20, Math.round(n / 5)));

// Map FIFA micros (0-100) to FM-style attributes (1-20). Where FIFA has no
// direct equivalent we use a sensible proxy from a related field.
export const attributesFromFifa = (e: FifaEntry): PlayerAttributes => {
  const m = e.micro;
  const avg = (...v: number[]) => v.reduce((s, x) => s + x, 0) / v.length;
  return {
    technical: {
      corners: c20(avg(m.crossing, m.fkAccuracy)),
      crossing: c20(m.crossing),
      dribbling: c20(m.dribblingSkill),
      finishing: c20(m.finishing),
      firstTouch: c20(m.ballControl),
      freeKicks: c20(m.fkAccuracy),
      heading: c20(m.heading),
      longShots: c20(m.longShots),
      longThrows: c20(m.strength * 0.7),
      marking: c20(m.marking),
      passing: c20(avg(m.shortPassing, m.longPassing)),
      penaltyTaking: c20(m.penalties),
      tackling: c20(avg(m.standingTackle, m.slidingTackle)),
      technique: c20(avg(m.ballControl, m.curve, m.dribblingSkill)),
    },
    mental: {
      aggression: c20(m.aggression),
      anticipation: c20(m.interceptions),
      bravery: c20(m.aggression),
      composure: c20(m.composure),
      concentration: c20(m.composure * 0.95),
      decisions: c20(m.reactions),
      determination: c20(Math.max(m.intRep * 18, m.composure * 0.9)),
      flair: c20(m.dribblingSkill),
      leadership: c20(m.intRep * 20),
      offTheBall: c20(m.positioning),
      positioning: c20(m.positioning),
      teamwork: c20(avg(m.positioning, m.vision)),
      vision: c20(m.vision),
      workRate: c20(m.stamina * 0.9),
    },
    physical: {
      acceleration: c20(m.acceleration),
      agility: c20(m.agility),
      balance: c20(m.balance),
      jumping: c20(m.jumping),
      naturalFitness: c20(m.stamina),
      pace: c20(m.sprintSpeed),
      stamina: c20(m.stamina),
      strength: c20(m.strength),
    },
  };
};
