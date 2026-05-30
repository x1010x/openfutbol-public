import type { Player, Team } from '../types/game.d.ts';
import { engineSettings } from '../engine/engineSettings';

const TOP_PLAYER_PRICE_EUR = 70_000_000;

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

export const ageMultiplier = (player: Player, seasonYear: number): number => {
  const age = seasonYear - player.birthYear;
  if (age < player.peakAge) return engineSettings.agePeakBonusMult;
  if (age <= player.peakAge + 2) return 1.0;
  return clamp(1 - (age - player.peakAge - 2) * 0.1, 0.4, 1.0);
};

export const computePrice = (player: Player, seasonYear: number): number => {
  const base = Math.pow(player.media / 99, 3) * TOP_PLAYER_PRICE_EUR;
  const price = base * ageMultiplier(player, seasonYear) * engineSettings.transferPriceMult;
  return Math.round(price / 100_000) * 100_000;
};

export const computeWeeklySalary = (price: number): number => {
  return Math.round((price / 2000) * engineSettings.salaryMult / 10) * 10;
};

// Prefer the player's actual contract.salary (weekly). Fall back to derived from
// market price when contract is missing. Single source of truth for both the
// inspector display and the weekly wage deduction.
export const playerWeeklySalary = (player: Player, seasonYear: number): number => {
  const fromContract = player.contract?.salary;
  if (fromContract && fromContract > 0) return fromContract;
  return computeWeeklySalary(computePrice(player, seasonYear));
};

export const computeClausulazoPrice = (price: number): number =>
  Math.round(price * engineSettings.clausulazoMult / 100_000) * 100_000;

export const formatEuros = (amount: number): string => {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(amount);
};

export const playerAge = (player: Player, seasonYear: number): number => seasonYear - player.birthYear;

export interface OfferResult {
  accepted: boolean;
  message: string;
  blocked?: boolean; // when true, no more offers for this player this season
}

export const evaluateOffer = (price: number, offerAmount: number): OfferResult => {
  const insultT = engineSettings.offerInsultThreshold;
  const insultBlock = engineSettings.offerInsultBlockProb;
  const instantAccept = engineSettings.offerInstantAcceptMult;
  const negRange = engineSettings.offerNegotiationRange;
  const rejectBlock = engineSettings.offerRejectBlockProb;

  if (offerAmount < price * insultT) {
    const blocked = Math.random() < insultBlock;
    return {
      accepted: false,
      blocked,
      message: blocked
        ? 'Oferta inaceptable. El club no quiere más ofertas por este jugador esta temporada.'
        : 'Oferta inaceptable: muy por debajo del valor.',
    };
  }
  if (offerAmount >= price * instantAccept) {
    return { accepted: true, message: '¡Oferta aceptada! El club no podía dejar pasar esa cifra.' };
  }
  const threshold = price * (insultT + Math.random() * negRange);
  if (offerAmount >= threshold) {
    return { accepted: true, message: '¡Oferta aceptada!' };
  }
  const blocked = Math.random() < rejectBlock;
  return {
    accepted: false,
    blocked,
    message: blocked
      ? 'Oferta rechazada. El club no quiere más ofertas por este jugador esta temporada.'
      : 'Oferta rechazada. El club esperaba más.',
  };
};

export const offerStep = (price: number): number => {
  const step = price * 0.05;
  return Math.max(100_000, Math.round(step / 100_000) * 100_000);
};

export const lineupAvgMed = (team: Team): number => {
  const lineup = team.players.filter(p => team.lineup.includes(p.id));
  const arr = lineup.length > 0 ? lineup : team.players;
  if (arr.length === 0) return 50;
  return arr.reduce((s, p) => s + p.media, 0) / arr.length;
};

export interface AttendanceResult {
  count: number;
  capacity: number;
  fillPct: number;
}

export const computeAttendance = (homeTeam: Team, awayTeam: Team): AttendanceResult => {
  const homeMed = lineupAvgMed(homeTeam);
  const awayMed = lineupAvgMed(awayTeam);
  const teamDraw = clamp((homeMed * 0.6 + awayMed * 0.4) / 100, 0.4, 0.95);
  const fairPrice = 8 + teamDraw * 30;
  const priceFactor = clamp(fairPrice / Math.max(1, homeTeam.ticketPrice), 0.4, 1.3);
  const noise = 0.9 + Math.random() * 0.2;
  const fill = clamp(teamDraw * priceFactor * noise, 0.15, 1.0);
  return {
    count: Math.floor(homeTeam.stadiumCapacity * fill),
    capacity: homeTeam.stadiumCapacity,
    fillPct: fill,
  };
};

export const teamWeeklySalary = (team: Team, seasonYear: number): number => {
  return team.players.reduce((sum, p) => sum + playerWeeklySalary(p, seasonYear), 0);
};

// End-of-season prize money. Fixed pot of 100M split: 30M to the champion,
// 20M to the runner-up, and the remaining 50M prorated linearly from 3rd
// down to last (3rd gets the most, last gets the least).
// Returns euros (rounded to 100k for tidy numbers in the UI).
export const SEASON_PRIZE_POOL = 100_000_000;
export const SEASON_PRIZE_FIRST = 30_000_000;
export const SEASON_PRIZE_SECOND = 20_000_000;
export const computeSeasonPrizes = (teamIdsByStanding: string[]): Record<string, number> => {
  const out: Record<string, number> = {};
  const n = teamIdsByStanding.length;
  if (n === 0) return out;
  if (n >= 1) out[teamIdsByStanding[0]] = SEASON_PRIZE_FIRST;
  if (n >= 2) out[teamIdsByStanding[1]] = SEASON_PRIZE_SECOND;
  const rest = teamIdsByStanding.slice(2);
  if (rest.length === 0) return out;
  const remaining = SEASON_PRIZE_POOL - SEASON_PRIZE_FIRST - (n >= 2 ? SEASON_PRIZE_SECOND : 0);
  const k = rest.length;
  // Linear weights k, k-1, ..., 1 — top of the rest takes the largest share.
  const sumWeights = (k * (k + 1)) / 2;
  rest.forEach((id, i) => {
    const w = k - i;
    out[id] = Math.round((remaining * (w / sumWeights)) / 100_000) * 100_000;
  });
  return out;
};
