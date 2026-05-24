import type { Team, Player } from '../types/game.d.ts';

export type BoardObjective = 'avoid_relegation' | 'top_half' | 'top_4' | 'win_league';

const avgMedia = (team: Team): number =>
  team.players.length > 0
    ? team.players.reduce((sum, p) => sum + p.media, 0) / team.players.length
    : 0;

export const computeBoardObjective = (team: Team, allTeams: Team[]): BoardObjective => {
  if (allTeams.length === 0) return 'avoid_relegation';
  const teamAvg = avgMedia(team);
  const bestAvg = Math.max(...allTeams.map(avgMedia));
  const gap = bestAvg - teamAvg;
  // Gap in average media rating from the best team drives the objective.
  // Teams are usually very close, so most should chase the title.
  if (gap <= 3) return 'win_league';
  if (gap <= 8) return 'top_4';
  if (gap <= 15) return 'top_half';
  return 'avoid_relegation';
};

export const isObjectiveMet = (
  objective: BoardObjective,
  finalPosition: number,
  totalTeams: number,
): boolean => {
  switch (objective) {
    case 'win_league': return finalPosition === 1;
    case 'top_4': return finalPosition <= 4;
    case 'top_half': return finalPosition <= Math.ceil(totalTeams / 2);
    case 'avoid_relegation': return finalPosition <= totalTeams - 3;
  }
};

export const objectiveLabel = (obj: BoardObjective): string => {
  switch (obj) {
    case 'win_league': return 'WIN LEAGUE';
    case 'top_4': return 'TOP 4';
    case 'top_half': return 'MID TABLE';
    case 'avoid_relegation': return 'STAY UP';
  }
};

export const clampMeter = (v: number): number => Math.max(0, Math.min(10, v));

export const METER_DELTAS = {
  win: 0.3,
  draw: -0.1,
  loss: -0.5,
  goodTransfer: 0.2,
  badTransfer: -0.3,
  playerRetiredUnsold: -0.4,
  weeklyPositive: 0.1,
  weeklyNegative: -0.15,
  seasonObjectiveMet: 1.5,
  seasonObjectiveMissed: -1.5,
  seasonInBlack: 0.5,
  seasonInRed: -0.5,
} as const;

// Returns the per-jornada probability of a board warning/firing event.
export const firingChance = (meter: number): number => {
  if (meter >= 5) return 0;
  if (meter >= 4) return 0.20;
  if (meter >= 3) return 0.35;
  if (meter >= 2) return 0.55;
  if (meter >= 1) return 0.75;
  return 0.90;
};

// Compute quality delta for a transfer made by the user.
export const computeTransferDelta = (
  player: Player,
  amount: number,
  marketValue: number,
  isBuying: boolean,
  year: number,
): number => {
  const age = year - player.birthYear;
  const isYoung = age < player.peakAge;
  const isOld = age > player.peakAge + 2;
  const priceRatio = marketValue > 0 ? amount / marketValue : 1;

  if (isBuying) {
    if (isYoung && priceRatio <= 1.1) return METER_DELTAS.goodTransfer;
    if (isOld && priceRatio > 1.0) return METER_DELTAS.badTransfer;
    return 0;
  } else {
    if (isOld && priceRatio >= 0.8) return METER_DELTAS.goodTransfer;
    if (isYoung && player.media >= 75 && priceRatio < 0.8) return METER_DELTAS.badTransfer;
    return 0;
  }
};

// Compute career rating as average of all season final florentinometro values.
export const computeCareerRating = (
  managerCareer: { florentinometroFinal: number }[],
  currentMeter: number,
): number => {
  if (managerCareer.length === 0) return currentMeter;
  const total = managerCareer.reduce((s, r) => s + r.florentinometroFinal, 0) + currentMeter;
  return total / (managerCareer.length + 1);
};

// Returns which teams are willing to offer a job based on career rating.
// Always includes the weakest team. Better rating = better clubs available.
export const teamsOfferingJobs = (
  allTeams: Team[],
  excludeTeamId: string,
  careerRating: number,
): Team[] => {
  const candidates = allTeams.filter(t => t.id !== excludeTeamId);
  if (candidates.length === 0) return [];

  const sorted = [...candidates].sort((a, b) => avgMedia(a) - avgMedia(b)); // weakest first
  const N = sorted.length;

  let cutoffPct: number;
  if (careerRating < 3) cutoffPct = 0.35;
  else if (careerRating < 5) cutoffPct = 0.60;
  else if (careerRating < 7) cutoffPct = 0.85;
  else cutoffPct = 1.0;

  const cutoff = Math.max(1, Math.ceil(N * cutoffPct));
  const eligible = sorted.slice(0, cutoff);

  // Always add the absolute weakest if not already included.
  if (eligible.length === 0 || eligible[0].id !== sorted[0].id) {
    eligible.unshift(sorted[0]);
  }

  // Return sorted strongest-first for display.
  return eligible.sort((a, b) => avgMedia(b) - avgMedia(a));
};
