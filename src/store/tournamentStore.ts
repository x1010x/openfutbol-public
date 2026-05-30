// Custom tournament state machine. Lives parallel to LeagueState — its own
// localStorage key, its own match flow. v1: single-elimination Copa, 4/8/16/32
// teams, single-leg ties. Mundial (groups -> KO) and live-match integration
// land in follow-up commits.

import type { Team } from '../types/game.d.ts';
import { calculateTeamStrength } from '../engine/simEngine';
import { engineSettings } from '../engine/engineSettings';

export type TournamentFormat = 'copa';

export interface TournamentTie {
  id: string;
  round: number;        // 0 = first round
  slot: number;         // position within the round
  homeTeamId: string | null;
  awayTeamId: string | null;
  homeScore: number | null;
  awayScore: number | null;
  played: boolean;
  winnerTeamId: string | null;
}

export interface TournamentState {
  id: string;
  name: string;
  format: TournamentFormat;
  userTeamId: string;
  teams: Team[];          // snapshot — tournament is closed-set
  totalRounds: number;    // 2 -> semis+final, 3 -> qf, 4 -> r16, 5 -> r32
  currentRound: number;
  ties: TournamentTie[];
  champion: string | null;
  createdAt: string;
}

const TOURNAMENT_KEY = 'openfutbol_tournament';

const log2 = (n: number) => Math.log(n) / Math.log(2);

const shuffle = <T>(arr: T[]): T[] => {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

const roundLabel = (totalRounds: number, round: number): string => {
  const remaining = totalRounds - round;
  if (remaining === 1) return 'Final';
  if (remaining === 2) return 'Semifinales';
  if (remaining === 3) return 'Cuartos';
  if (remaining === 4) return 'Octavos';
  if (remaining === 5) return '1/16';
  return `Ronda ${round + 1}`;
};
export { roundLabel };

// Build the first-round bracket. Teams are shuffled and paired sequentially.
// Subsequent rounds are pre-populated with TBD ties so the UI can render a
// full bracket from the start.
export const createCopaTournament = (
  name: string,
  teams: Team[],
  userTeamId: string,
): TournamentState => {
  if (!Number.isInteger(log2(teams.length)) || teams.length < 2) {
    throw new Error('Tournament team count must be a power of 2 (2/4/8/16/32).');
  }
  const shuffled = shuffle(teams);
  const totalRounds = Math.round(log2(teams.length));
  const ties: TournamentTie[] = [];
  // First round
  for (let i = 0; i < shuffled.length; i += 2) {
    ties.push({
      id: `t_0_${i / 2}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      round: 0,
      slot: i / 2,
      homeTeamId: shuffled[i].id,
      awayTeamId: shuffled[i + 1].id,
      homeScore: null,
      awayScore: null,
      played: false,
      winnerTeamId: null,
    });
  }
  // Subsequent rounds (TBD)
  for (let r = 1; r < totalRounds; r++) {
    const tiesInRound = shuffled.length / Math.pow(2, r + 1);
    for (let s = 0; s < tiesInRound; s++) {
      ties.push({
        id: `t_${r}_${s}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        round: r,
        slot: s,
        homeTeamId: null,
        awayTeamId: null,
        homeScore: null,
        awayScore: null,
        played: false,
        winnerTeamId: null,
      });
    }
  }
  return {
    id: `tourn_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name,
    format: 'copa',
    userTeamId,
    teams,
    totalRounds,
    currentRound: 0,
    ties,
    champion: null,
    createdAt: new Date().toISOString(),
  };
};

const samplePoisson = (lambda: number): number => {
  const L = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do { k++; p *= Math.random(); } while (p > L);
  return k - 1;
};

// Score a single tie via the same Poisson-on-strength-ratio model used for
// non-user league matches. Penalty-style tiebreak when level after 90: a
// coin-flip skewed slightly by team strength.
const scoreTie = (home: Team, away: Team): { hs: number; as: number; winnerId: string } => {
  const homeBoost = 1 + ((0.05 + Math.random() * 0.15) * engineSettings.homeAdvantageMult);
  const hStr = calculateTeamStrength(home) * homeBoost;
  const aStr = calculateTeamStrength(away);
  const ratio = hStr / Math.max(aStr, 1);
  const hL = 1.3 * Math.pow(ratio, 1.5);
  const aL = 1.0 * Math.pow(1 / ratio, 1.5);
  let hs = samplePoisson(hL);
  let as = samplePoisson(aL);
  if (hs === as) {
    // PK shootout, skew by strength so the better team wins ~58% of the time
    // when they're meaningfully better.
    const homeWinProb = 0.5 + Math.max(-0.15, Math.min(0.15, (hStr - aStr) / Math.max(hStr, aStr) * 0.5));
    if (Math.random() < homeWinProb) hs += 1; else as += 1;
  }
  return { hs, as, winnerId: hs > as ? home.id : away.id };
};

// Simulate every remaining tie in the current round; populate winners into
// the next round's tie pairings; advance the round counter; if final played,
// crown a champion.
export const advanceRound = (state: TournamentState): TournamentState => {
  if (state.champion) return state;
  const teamById = (id: string) => state.teams.find(t => t.id === id);
  const ties = state.ties.map(tie => {
    if (tie.round !== state.currentRound || tie.played) return tie;
    const home = tie.homeTeamId ? teamById(tie.homeTeamId) : null;
    const away = tie.awayTeamId ? teamById(tie.awayTeamId) : null;
    if (!home || !away) return tie;
    const { hs, as, winnerId } = scoreTie(home, away);
    return { ...tie, homeScore: hs, awayScore: as, played: true, winnerTeamId: winnerId };
  });

  // Wire winners into the next round's ties.
  const nextRound = state.currentRound + 1;
  if (nextRound < state.totalRounds) {
    const playedThisRound = ties.filter(t => t.round === state.currentRound).sort((a, b) => a.slot - b.slot);
    const nextTies = ties.filter(t => t.round === nextRound).sort((a, b) => a.slot - b.slot);
    for (let i = 0; i < nextTies.length; i++) {
      const wA = playedThisRound[i * 2]?.winnerTeamId ?? null;
      const wB = playedThisRound[i * 2 + 1]?.winnerTeamId ?? null;
      nextTies[i] = { ...nextTies[i], homeTeamId: wA, awayTeamId: wB };
    }
    const newTies = [
      ...ties.filter(t => t.round !== nextRound),
      ...nextTies,
    ].sort((a, b) => a.round - b.round || a.slot - b.slot);
    return { ...state, ties: newTies, currentRound: nextRound };
  }

  // Final just played
  const finalTie = ties.find(t => t.round === state.currentRound);
  return {
    ...state,
    ties,
    champion: finalTie?.winnerTeamId ?? null,
  };
};

// ── Persistence ────────────────────────────────────────────────────────────
export const saveTournament = (state: TournamentState | null) => {
  try {
    if (state == null) localStorage.removeItem(TOURNAMENT_KEY);
    else localStorage.setItem(TOURNAMENT_KEY, JSON.stringify(state));
  } catch { /* quota / serialization — best effort */ }
};

export const loadTournament = (): TournamentState | null => {
  try {
    const raw = localStorage.getItem(TOURNAMENT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as TournamentState;
  } catch {
    return null;
  }
};
