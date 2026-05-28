// TODO Phase 4 rewrite for CA/PA
import type { Player, PlayerStats, Team } from '../types/game.d.ts';
import { engineSettings } from './engineSettings';

export type MoodState = 0 | 1 | 2 | 3 | 4;

export const MOOD = [
  { symbol: '▼▼', colorClass: 'text-vga-light-red',     delta: -2, label: 'Muy bajo' },
  { symbol: '▼',  colorClass: 'text-vga-brown',         delta: -1, label: 'Bajo' },
  { symbol: '—',  colorClass: 'text-vga-yellow',        delta:  0, label: 'Normal' },
  { symbol: '▲',  colorClass: 'text-vga-light-cyan',    delta: +1, label: 'Buena' },
  { symbol: '▲▲', colorClass: 'text-vga-light-green',   delta: +2, label: 'Excelente' },
] as const;

export const computeMoodScore = (player: Player, isInLineup: boolean): number => {
  const apps = player.seasonStats.appearances;
  let score = 50;

  if (isInLineup) {
    score += engineSettings.moodLineupBonus;
  } else if (apps > 0) {
    score -= engineSettings.moodBenchPenalty;
  }

  if (apps > 0) {
    const gpg = player.seasonStats.goals / apps;
    const apg = player.seasonStats.assists / apps;
    score += Math.min(15, Math.floor(gpg * 20));
    score += Math.min(10, Math.floor(apg * 15));
    const mpg = player.seasonStats.minutes / apps;
    if (mpg >= 70) score += 5;
    else if (mpg < 30) score -= 8;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
};

export const moodStateOf = (player: Player, isInLineup: boolean): MoodState => {
  const score = computeMoodScore(player, isInLineup);
  if (score >= 80) return 4;
  if (score >= 60) return 3;
  if (score >= 40) return 2;
  if (score >= 20) return 1;
  return 0;
};

// MED displayed to the user: 7-stat average including current stamina.
// Rested players (stamina=99) show higher MED than tired ones.
export const displayMed = (player: Player): number =>
  Math.floor(
    (player.stats.speed + player.stats.dribbling + player.stats.passing +
     player.stats.shooting + player.stats.defending + player.stats.physical +
     (player.stamina ?? 99)) / 7
  );

// Apply mood stat adjustments to all players in a team snapshot for one match.
// Adjusts 1–2 random stats by ±1. Does not persist — only used in match MatchState.
export const applyMoodToTeam = (team: Team): Team => {
  const statKeys: (keyof PlayerStats)[] = ['speed', 'dribbling', 'passing', 'shooting', 'defending', 'physical'];
  const players = team.players.map(player => {
    const inLineup = team.lineup.includes(player.id);
    const state = moodStateOf(player, inLineup);
    const delta = MOOD[state].delta;
    if (delta === 0) return player;

    const shuffled = [...statKeys].sort(() => Math.random() - 0.5);
    const adjustedStats = { ...player.stats };
    const count = Math.abs(delta);
    for (let i = 0; i < count; i++) {
      const stat = shuffled[i];
      adjustedStats[stat] = Math.max(1, Math.min(99, adjustedStats[stat] + (delta > 0 ? 1 : -1)));
    }
    const newMedia = Math.floor(
      (adjustedStats.speed + adjustedStats.dribbling + adjustedStats.passing +
       adjustedStats.shooting + adjustedStats.defending + adjustedStats.physical) / 6
    );
    return { ...player, stats: adjustedStats, media: newMedia };
  });
  return { ...team, players };
};
