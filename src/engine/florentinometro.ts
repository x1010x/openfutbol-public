import type { Team, Player } from '../types/game.d.ts';
import { engineSettings } from './engineSettings';

export type BoardObjective = 'avoid_relegation' | 'top_half' | 'top_4' | 'win_league';

const avgCA = (team: Team): number =>
  team.players.length > 0
    ? team.players.reduce((sum, p) => sum + (p.current_ability ?? p.media * 2), 0) / team.players.length
    : 0;

export const computeBoardObjective = (team: Team, allTeams: Team[]): BoardObjective => {
  if (allTeams.length === 0) return 'avoid_relegation';
  const teamAvg = avgCA(team);
  const bestAvg = Math.max(...allTeams.map(avgCA));
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

// Apply a delta with diminishing returns near 0 and 10.
// Positive deltas are compressed as the meter approaches 10; negative near 0.
// This makes reaching the extremes progressively harder.
export const applyMeterDelta = (current: number, delta: number): number => {
  const ZONE = 3;       // resistance zone spans 0–3 and 7–10
  const MIN_FACTOR = 0.15;
  let effective = delta;
  if (delta > 0 && current > 10 - ZONE) {
    effective = delta * Math.max(MIN_FACTOR, (10 - current) / ZONE);
  } else if (delta < 0 && current < ZONE) {
    effective = delta * Math.max(MIN_FACTOR, current / ZONE);
  }
  return clampMeter(current + effective);
};

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
  const mult = engineSettings.firingRiskMult;
  if (meter >= 5) return 0;
  if (meter >= 4) return Math.min(1, 0.20 * mult);
  if (meter >= 3) return Math.min(1, 0.35 * mult);
  if (meter >= 2) return Math.min(1, 0.55 * mult);
  if (meter >= 1) return Math.min(1, 0.75 * mult);
  return Math.min(1, 0.90 * mult);
};

// Season-end board meter delta based on whether the board objective was met.
export const computeSeasonMeterDelta = (objectiveMet: boolean): number =>
  objectiveMet ? engineSettings.seasonObjectiveBonus : engineSettings.seasonObjectivePenalty;

// Compute quality delta for a transfer made by the user.
export const computeTransferDelta = (
  player: Player,
  amount: number,
  marketValue: number,
  isBuying: boolean,
  year: number,
): number => {
  const birthYear = player.birth_date
    ? parseInt(player.birth_date.slice(0, 4), 10)
    : player.birthYear;
  const age = year - birthYear;
  const peakAge = player.peakAge ?? 28;
  const isYoung = age < peakAge;
  const isOld = age > peakAge + 2;
  const priceRatio = marketValue > 0 ? amount / marketValue : 1;
  const ca = player.current_ability ?? player.media * 2;

  if (isBuying) {
    if (isYoung && priceRatio <= 1.1) return engineSettings.transferGoodDelta;
    if (isOld && priceRatio > 1.0) return engineSettings.transferBadDelta;
    return 0;
  } else {
    if (isOld && priceRatio >= 0.8) return engineSettings.transferGoodDelta;
    if (isYoung && ca >= 150 && priceRatio < 0.8) return engineSettings.transferBadDelta;
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

// Minimum reputation required to be offered a job by a team with each objective.
const MIN_REP_FOR_OBJECTIVE: Record<BoardObjective, number> = {
  win_league:       70,
  top_4:            45,
  top_half:         20,
  avoid_relegation: 0,
};

// Returns which teams are willing to offer a job based on manager reputation (0-100).
// Always includes the weakest team. Higher reputation = more prestigious clubs available.
// Teams whose objective exceeds the manager's reputation gate are filtered out.
export const teamsOfferingJobs = (
  allTeams: Team[],
  excludeTeamId: string,
  reputation: number,
  firedByTeamIds: string[] = [],
): Team[] => {
  const blacklist = new Set([excludeTeamId, ...firedByTeamIds]);
  const candidates = allTeams.filter(t => !blacklist.has(t.id));
  if (candidates.length === 0) return [];

  const sorted = [...candidates].sort((a, b) => avgCA(a) - avgCA(b)); // weakest first
  const N = sorted.length;

  let cutoffPct: number;
  if (reputation < 30) cutoffPct = 0.35;
  else if (reputation < 45) cutoffPct = 0.55;
  else if (reputation < 60) cutoffPct = 0.75;
  else if (reputation < 75) cutoffPct = 0.90;
  else cutoffPct = 1.0;

  const cutoff = Math.max(1, Math.ceil(N * cutoffPct));
  const byStrength = sorted.slice(0, cutoff);

  // Also filter by objective: don't offer jobs from teams whose ambition exceeds reputation
  const eligible = byStrength.filter(team => {
    const obj = computeBoardObjective(team, allTeams);
    return reputation >= MIN_REP_FOR_OBJECTIVE[obj];
  });

  // Always guarantee at least the weakest available team
  if (eligible.length === 0 || eligible[0].id !== sorted[0].id) {
    const weakest = sorted[0];
    if (!eligible.some(t => t.id === weakest.id)) eligible.unshift(weakest);
  }

  return eligible.sort((a, b) => avgCA(b) - avgCA(a));
};

// Context-aware match delta for florentinometro. Replaces the simple win/draw/loss lookup.
export const computeMatchMeterDelta = (params: {
  userGoals: number;
  oppGoals: number;
  isHome: boolean;
  userAvgMedia: number;
  oppAvgMedia: number;
  yellowCards: number;
  redCards: number;
}): number => {
  const { userGoals, oppGoals, isHome, userAvgMedia, oppAvgMedia, yellowCards, redCards } = params;
  const isWin = userGoals > oppGoals;
  const isDraw = userGoals === oppGoals;
  const strengthDiff = userAvgMedia - oppAvgMedia; // positive = user is stronger
  const goalDiff = userGoals - oppGoals;
  const cleanSheet = oppGoals === 0;

  let delta = isWin ? engineSettings.meterWinBase : isDraw ? engineSettings.meterDrawBase : engineSettings.meterLossBase;

  if (isWin) {
    if (strengthDiff < -5) delta += isHome ? 0.20 : 0.30; // upset win
    if (goalDiff >= 4) delta += 0.15; // dominant win
  } else if (isDraw) {
    if (strengthDiff < -5) delta += isHome ? 0.12 : 0.20; // respectable draw vs stronger
    else if (strengthDiff > 5) delta -= isHome ? 0.15 : 0.08; // poor draw vs weaker
  } else {
    if (strengthDiff < -8) delta += 0.15; // forgive heavy loss to a much better team
    if (strengthDiff > 5) delta -= isHome ? 0.30 : 0.15; // embarrassing loss vs weaker
    if (oppGoals - userGoals >= 4) delta -= 0.20; // thrashing penalty
  }

  // Match performance
  delta += Math.min(userGoals * 0.04, 0.16);
  if (cleanSheet) delta += 0.12;
  delta -= yellowCards * 0.015;
  delta -= redCards * 0.08;

  return delta;
};

// Per-match reputation delta (0-100 scale, small amounts that accumulate over a career).
export const computeMatchReputationDelta = (params: {
  userGoals: number;
  oppGoals: number;
  isHome: boolean;
  userAvgMedia: number;
  oppAvgMedia: number;
}): number => {
  const { userGoals, oppGoals, isHome, userAvgMedia, oppAvgMedia } = params;
  const isWin = userGoals > oppGoals;
  const isDraw = userGoals === oppGoals;
  const strengthDiff = userAvgMedia - oppAvgMedia;

  let delta = 0;

  if (isWin) {
    if (strengthDiff < -8) delta = isHome ? 0.18 : 0.25;      // upset vs much stronger
    else if (strengthDiff < -3) delta = isHome ? 0.14 : 0.18; // beat stronger team
    else if (strengthDiff > 5) delta = 0.07;                   // expected win vs weaker
    else delta = 0.11;                                         // even match
  } else if (isDraw) {
    if (!isHome && strengthDiff < -5) delta = 0.14;  // great away draw vs stronger
    else if (strengthDiff < -3) delta = 0.08;        // draw vs stronger
    else if (strengthDiff > 5) delta = -0.06;        // disappointing draw vs weaker
    else delta = 0.04;                               // even draw
  } else {
    if (strengthDiff < -8) delta = -0.04;                        // lost to much better, forgiven
    else if (strengthDiff < -3) delta = -0.08;                   // lost to stronger
    else if (strengthDiff > 5 && isHome) delta = -0.30;          // shameful home loss to weaker
    else if (strengthDiff > 5) delta = -0.18;                    // away loss to weaker
    else delta = -0.12;                                          // even loss
    if (oppGoals - userGoals >= 4) delta -= 0.25;                // thrashing
  }

  return delta >= 0
    ? delta * engineSettings.reputationGainMult
    : delta * engineSettings.reputationLossMult;
};

// Season-end reputation adjustment after a completed stint.
export const computeSeasonReputationDelta = (params: {
  objective: BoardObjective;
  objectiveMet: boolean;
  fired: boolean;
  squadValueChangePct: number; // (finalValue - initialValue) / initialValue
}): number => {
  let delta = 0;

  if (params.objectiveMet) {
    switch (params.objective) {
      case 'win_league':        delta += 10; break;
      case 'top_4':             delta += 6;  break;
      case 'top_half':          delta += 3;  break;
      case 'avoid_relegation':  delta += 2;  break;
    }
  } else {
    switch (params.objective) {
      case 'win_league':        delta -= 4; break;
      case 'top_4':             delta -= 3; break;
      case 'top_half':          delta -= 2; break;
      case 'avoid_relegation':  delta -= 6; break; // relegated = very bad for reputation
    }
  }

  if (params.fired) delta -= 4;

  // Squad value significantly improved/worsened
  if (params.squadValueChangePct > 0.25) delta += 2;
  else if (params.squadValueChangePct < -0.25) delta -= 2;

  return delta >= 0
    ? delta * engineSettings.reputationGainMult
    : delta * engineSettings.reputationLossMult;
};
