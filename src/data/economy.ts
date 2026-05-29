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
  return team.players.reduce(
    (sum, p) => sum + computeWeeklySalary(computePrice(p, seasonYear)),
    0
  );
};
