// TODO(phase-4): delete shim fields from Player; use current_ability/positions directly.
import type { PackPlayer, Player, PlayerStats, PositionCode, Position, PlayerPositionEntry } from '../types/game.d.ts';
import { synthesizeAttributes, type PlayerAttributes } from './playerAttributes';
import { getStatsForPlayer, attributesFromStats, type StatsEntry } from './statsIndex';

const statsFromEntry = (e: StatsEntry, isGK: boolean): PlayerStats => ({
  speed: e.macro.pa,
  shooting: e.macro.sh,
  passing: e.macro.ps,
  dribbling: e.macro.dr,
  defending: e.macro.de,
  physical: e.macro.ph,
  goalkeeping: e.macro.gk ?? (isGK ? 70 : 10),
});

const avg = (...vals: number[]) => vals.reduce((s, v) => s + v, 0) / vals.length;

export const joinPlayerName = (first: string, last: string): string => {
  const f = first.trim();
  const l = last.trim();
  if (!f) return l;
  if (!l) return f;
  if (f === l) return f;
  if (l.startsWith(f + ' ')) return l;
  if (f.startsWith(l + ' ')) return f;
  return `${f} ${l}`;
};

// Map FM 1-20 attribute groups into the legacy 0-100 PlayerStats. Five-times the
// attribute average lands the result on the same 0-100 scale the engine expects.
const statsFromAttributes = (a: PlayerAttributes, isGK: boolean): PlayerStats => {
  const t = a.technical, m = a.mental, p = a.physical;
  const speed       = avg(p.pace, p.acceleration) * 5;
  const dribbling   = avg(t.dribbling, t.technique, p.agility, t.firstTouch) * 5;
  const passing     = avg(t.passing, m.vision, m.decisions, t.firstTouch) * 5;
  const shooting    = avg(t.finishing, t.longShots, m.composure, t.technique) * 5;
  const defending   = avg(t.tackling, t.marking, m.positioning, m.anticipation) * 5;
  const physical    = avg(p.strength, p.stamina, p.jumping, p.naturalFitness) * 5;
  const goalkeeping = isGK
    ? avg(m.anticipation, m.positioning, m.concentration, p.agility, p.jumping, m.composure) * 5
    : avg(p.agility, m.anticipation) * 3;
  return {
    speed: Math.round(speed),
    dribbling: Math.round(dribbling),
    passing: Math.round(passing),
    shooting: Math.round(shooting),
    defending: Math.round(defending),
    physical: Math.round(physical),
    goalkeeping: Math.round(goalkeeping),
  };
};

// Synth weekly salary when the pack ships no contract. Driven by current_ability
// (1-200) on a curve, lightly tempered by age — peak earners are 25-31 stars.
// Returns weekly euros, and an expiration 2-4 years from birth-year context.
const synthesizeContract = (currentAbility: number, birthYear: number): { salary: number; expiration: string } => {
  const ca = Math.max(40, Math.min(200, currentAbility));
  // Curve: 60 CA -> ~3k/wk, 120 CA -> ~25k/wk, 160 CA -> ~120k/wk, 180 CA -> ~280k/wk.
  const base = Math.pow(ca / 60, 3.6) * 3000;
  // Rough age penalty for very young (still on academy terms) and over-32.
  const now = new Date().getFullYear();
  const age = Math.max(16, now - birthYear);
  const ageMult = age < 21 ? 0.55 : age < 24 ? 0.85 : age >= 34 ? 0.7 : age >= 32 ? 0.85 : 1;
  const weekly = Math.max(500, Math.round((base * ageMult) / 100) * 100);
  const expYear = now + (ca >= 140 ? 4 : ca >= 100 ? 3 : 2);
  return { salary: weekly, expiration: `${expYear}-06-30` };
};

const NEW_CODE_TO_LEGACY: Record<PositionCode, Position> = {
  GK: 'POR',
  DC: 'DEF', DL: 'DEF', DR: 'DEF', WBL: 'DEF', WBR: 'DEF',
  DMC: 'MED', MC: 'MED', ML: 'MED', MR: 'MED', AMC: 'MED',
  AML: 'AML', AMR: 'AMR',
  FC: 'DEL',
};

export const runtimePlayerFromPack = (
  packPlayer: PackPlayer,
  number: number,
  countryCode?: string,
): Player => {
  const sorted = [...packPlayer.positions].sort((a, b) => b.level - a.level);
  const primaryEntry: PlayerPositionEntry | undefined = sorted[0];
  const primaryCode: PositionCode = primaryEntry?.code ?? 'GK';
  const primaryLegacy: Position = NEW_CODE_TO_LEGACY[primaryCode];

  const allowedSet = new Set<Position>(
    packPlayer.positions.filter(e => e.level >= 12).map(e => NEW_CODE_TO_LEGACY[e.code]),
  );
  if (allowedSet.size === 0) allowedSet.add(primaryLegacy);
  const allowedPositions: Position[] = [...allowedSet];

  const isGK = primaryCode === 'GK';
  const stats_entry = getStatsForPlayer(packPlayer.source_id);
  // Pick the best signal we have between the data pack's CA and the optional
  // stats-pack overall. Both can be missing/garbage in individual entries, so:
  //  - take the higher of the two (a mismatched stats-pack entry should never
  //    drag a legitimate rating down);
  //  - and apply a minimum CA floor (60 → media 30) for any player whose
  //    sources both look broken. That keeps an Odegaard from rendering as
  //    media 8 because the pack ships CA=16 for him.
  const statsCa = stats_entry ? Math.min(200, stats_entry.ov * 2) : 0;
  const packCa = packPlayer.current_ability ?? 0;
  const currentAbility = Math.max(60, packCa, statsCa);
  const halfCa = Math.round(currentAbility / 2);
  const attributes: PlayerAttributes = stats_entry
    ? attributesFromStats(stats_entry)
    : synthesizeAttributes(currentAbility, primaryCode, packPlayer.id);
  const stats: PlayerStats = stats_entry
    ? statsFromEntry(stats_entry, isGK)
    : statsFromAttributes(attributes, isGK);
  const statsYear = stats_entry?.fy;

  return {
    id: packPlayer.id,
    source_id: packPlayer.source_id,
    club_id: packPlayer.club_id,
    country_id: packPlayer.country_id,
    country_code: countryCode,
    first_name: packPlayer.first_name,
    last_name: packPlayer.last_name,
    birth_date: packPlayer.birth_date,
    positions: packPlayer.positions,
    current_ability: currentAbility,
    potential_ability: Math.max(packPlayer.potential_ability, currentAbility),
    attributes,
    stats_year: statsYear,
    value: packPlayer.value,
    contract: packPlayer.contract ?? synthesizeContract(currentAbility, parseInt(packPlayer.birth_date.slice(0, 4), 10)),
    number,
    stamina: 99,
    injuryWeeksRemaining: 0,
    suspensionMatches: 0,
    seasonStats: {
      goals: 0, assists: 0, yellowCards: 0, redCards: 0,
      appearances: 0, minutes: 0, ratingSum: 0,
      cleanSheets: 0, goalsAgainst: 0,
    },
    name: joinPlayerName(packPlayer.first_name, packPlayer.last_name),
    fullName: joinPlayerName(packPlayer.first_name, packPlayer.last_name),
    birthYear: parseInt(packPlayer.birth_date.slice(0, 4), 10),
    peakAge: 28,
    position: primaryLegacy,
    preferredPos: primaryLegacy,
    allowedPositions,
    stats,
    media: halfCa,
  };
};
