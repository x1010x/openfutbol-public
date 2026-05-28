// TODO(phase-4): delete shim fields from Player; use current_ability/positions directly.
import type { PackPlayer, Player, PlayerStats, PositionCode, Position, PlayerPositionEntry } from '../types/game.d.ts';

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
  const stats: PlayerStats = {
    speed: halfCa, dribbling: halfCa, passing: halfCa,
    shooting: halfCa, defending: halfCa, physical: halfCa, goalkeeping: halfCa,
  };

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
