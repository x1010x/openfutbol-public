import type { FormationId, Player, PlayerStats, Position, Team } from '../types/game.d.ts';

export const OOP_PENALTY = 0.825;
export const GK_OOP_PENALTY = 0.45; // outfield player forced into goal

export const FORMATIONS: Record<FormationId, Position[]> = {
  '4-4-2': ['POR', 'DEF', 'DEF', 'DEF', 'DEF', 'MED', 'MED', 'MED', 'MED', 'DEL', 'DEL'],
  '5-3-2': ['POR', 'DEF', 'DEF', 'DEF', 'DEF', 'DEF', 'MED', 'MED', 'MED', 'DEL', 'DEL'],
  '4-3-3': ['POR', 'DEF', 'DEF', 'DEF', 'DEF', 'MED', 'MED', 'MED', 'AML', 'DEL', 'AMR'],
  '4-2-4': ['POR', 'DEF', 'DEF', 'DEF', 'DEF', 'MED', 'MED', 'AML', 'DEL', 'DEL', 'AMR'],
  '5-4-1': ['POR', 'DEF', 'DEF', 'DEF', 'DEF', 'DEF', 'MED', 'MED', 'MED', 'MED', 'DEL'],
  '3-4-3': ['POR', 'DEF', 'DEF', 'DEF', 'MED', 'MED', 'MED', 'MED', 'AML', 'DEL', 'AMR'],
};

export const ALL_FORMATIONS: FormationId[] = ['4-4-2', '5-3-2', '4-3-3', '4-2-4', '5-4-1', '3-4-3'];

const FORWARD_FAMILY: Position[] = ['DEL', 'AML', 'AMR'];

export const isOOP = (player: Player, slotPos: Position): boolean => {
  if (FORWARD_FAMILY.includes(slotPos) && player.allowedPositions.some(p => FORWARD_FAMILY.includes(p))) return false;
  return !player.allowedPositions.includes(slotPos);
};

export const slotPenalty = (player: Player, slotPos: Position): number => {
  if (!isOOP(player, slotPos)) return 1;
  return slotPos === 'POR' ? GK_OOP_PENALTY : OOP_PENALTY;
};

// Position-weighted stat importance. Specialists are rated fairly in their role.
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
       + (w.goalkeeping ?? 0) * stats.goalkeeping;
};

export const rawMedia = (player: Player): number =>
  computePositionWeightedMedia(player.stats, player.position);

// Formation picking uses stamina so AI naturally rotates tired players out.
export const effectiveMedia = (player: Player, slotPos: Position): number => {
  const stam = player.stamina ?? 99;
  return rawMedia(player) * slotPenalty(player, slotPos) * (0.7 + 0.3 * (stam / 99));
};

// Effective MED as used by the simulation: OOP penalty + stamina factor.
export const liveMed = (player: Player, stam: number, slotPos?: Position): number => {
  const raw = rawMedia(player);
  const pen = slotPos ? slotPenalty(player, slotPos) : 1;
  return Math.floor(raw * pen * (0.7 + 0.3 * (stam / 99)));
};

export const effectiveStat = (player: Player, stat: keyof Player['stats'], slotPos: Position): number =>
  player.stats[stat] * slotPenalty(player, slotPos);

// Mapa playerId -> position del slot que ocupa en la alineación, según la formación del equipo.
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

// Asigna greedy los mejores 11 jugadores disponibles a los 11 slots de una formación.
// disciplined=true: cada slot se llena primero con jugadores en posición natural; sólo
// recurre a jugadores fuera de posición si no queda ningún nativo disponible.
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
    // POR siempre busca nativos primero. Con disciplina ON, todos los slots hacen lo mismo.
    const natives = eligible.filter(p => !used.has(p.id) && p.allowedPositions.includes(slotPos));
    const useNativesFirst = slotPos === 'POR' || (disciplined && natives.length > 0);
    const pool = useNativesFirst && natives.length > 0 ? natives : eligible;
    for (const p of pool) {
      if (used.has(p.id)) continue;
      const score = effectiveMedia(p, slotPos);
      if (score > bestScore) {
        bestScore = score;
        best = p;
      }
    }
    if (best) {
      lineup.push(best.id);
      used.add(best.id);
      strength += bestScore;
    } else {
      break;
    }
  }
  return { lineup, strength };
};

// Elige la formación que maximiza la fuerza agregada del mejor XI.
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

// Reordena un conjunto fijo de titulares en los slots de una formación dada.
// El resultado es disperso (longitud 11, '' para slots vacantes) para que los índices
// de slot se correspondan siempre con la formación.
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
      const score = effectiveMedia(p, slotPos);
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
  // Trim trailing empties so length reflects highest used slot (keeps storage compact).
  while (lineup.length > 0 && lineup[lineup.length - 1] === '') lineup.pop();
  return lineup;
};
