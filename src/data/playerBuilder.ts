// TODO(phase-4): delete shim fields from Player; use current_ability/positions directly.
import type { PackPlayer, Player, PlayerStats, PositionCode, Position, PlayerPositionEntry } from '../types/game.d.ts';
import { synthesizeAttributes, type PlayerAttributes } from './playerAttributes';

const avg = (...vals: number[]) => vals.reduce((s, v) => s + v, 0) / vals.length;

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

  const halfCa = Math.round(packPlayer.current_ability / 2);
  const attributes = synthesizeAttributes(packPlayer.current_ability, primaryCode, packPlayer.id);
  const stats: PlayerStats = statsFromAttributes(attributes, primaryCode === 'GK');

  return {
    id: packPlayer.id,
    source_id: packPlayer.source_id,
    club_id: packPlayer.club_id,
    country_id: packPlayer.country_id,
    first_name: packPlayer.first_name,
    last_name: packPlayer.last_name,
    birth_date: packPlayer.birth_date,
    positions: packPlayer.positions,
    current_ability: packPlayer.current_ability,
    potential_ability: packPlayer.potential_ability,
    attributes,
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
    name: `${packPlayer.first_name} ${packPlayer.last_name}`,
    fullName: `${packPlayer.first_name} ${packPlayer.last_name}`,
    birthYear: parseInt(packPlayer.birth_date.slice(0, 4), 10),
    peakAge: 28,
    position: primaryLegacy,
    preferredPos: primaryLegacy,
    allowedPositions,
    stats,
    media: halfCa,
  };
};
