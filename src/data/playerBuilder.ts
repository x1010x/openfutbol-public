// TODO(phase-4): delete shim fields from Player; use current_ability/positions directly.
import type { PackPlayer, Player, PlayerStats, PositionCode, Position, PlayerPositionEntry } from '../types/game.d.ts';
import { synthesizeAttributes, type PlayerAttributes } from './playerAttributes';
import { getFifaStats, attributesFromFifa, type FifaEntry } from './fifaStatsStore';

const statsFromFifa = (e: FifaEntry, isGK: boolean): PlayerStats => ({
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
  const fifa = getFifaStats(packPlayer.source_id);
  // When FIFA stats hit, FIFA overall (0-100) replaces the pack's CA (1-200).
  const currentAbility = fifa ? Math.min(200, fifa.ov * 2) : packPlayer.current_ability;
  const halfCa = Math.round(currentAbility / 2);
  const attributes: PlayerAttributes = fifa
    ? attributesFromFifa(fifa)
    : synthesizeAttributes(currentAbility, primaryCode, packPlayer.id);
  const stats: PlayerStats = fifa
    ? statsFromFifa(fifa, isGK)
    : statsFromAttributes(attributes, isGK);
  const fifaYear = fifa?.fy;

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
    fifa_year: fifaYear,
    value: packPlayer.value,
    contract: packPlayer.contract,
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
