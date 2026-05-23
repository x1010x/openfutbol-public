import type { MatchEvent } from '../types/game.d.ts';

export interface MatchInfo {
  homeId: string;
  awayId: string;
  played: boolean;
  homeScore?: number;
  awayScore?: number;
  events?: MatchEvent[];
}

export interface Jornada {
  number: number;
  matches: MatchInfo[];
}

const BYE = '__BYE__';

export const generateSchedule = (teamIds: string[]): Jornada[] => {
  const schedule: Jornada[] = [];
  const teams = [...teamIds];
  // Si es impar, añadimos un equipo "BYE" para que cada jornada uno descanse
  if (teams.length % 2 !== 0) {
    teams.push(BYE);
  }
  const n = teams.length;
  const matchesPerJornada = n / 2;

  // Algoritmo de rotación
  for (let i = 0; i < n - 1; i++) {
    const matches: MatchInfo[] = [];
    for (let j = 0; j < matchesPerJornada; j++) {
      const home = teams[j];
      const away = teams[n - 1 - j];
      if (home === BYE || away === BYE) continue; // el equipo emparejado con BYE descansa
      matches.push({ homeId: home, awayId: away, played: false });
    }
    schedule.push({ number: i + 1, matches });

    // Rotar equipos (manteniendo el primero fijo)
    teams.splice(1, 0, teams.pop()!);
  }

  // Segunda vuelta
  const secondRound = schedule.map(j => ({
    number: j.number + (n - 1),
    matches: j.matches.map(m => ({
      homeId: m.awayId,
      awayId: m.homeId,
      played: false
    }))
  }));

  const fullSchedule = [...schedule, ...secondRound];
  return balanceSchedule(fullSchedule, teamIds);
};

const balanceSchedule = (schedule: Jornada[], teamIds: string[]): Jornada[] => {
  const teamHomeCount: Record<string, number> = {};
  teamIds.forEach(t => teamHomeCount[t] = 0);
  const n = teamIds.length;
  const maxHomeGames = Math.ceil(n); // Total matches n-1 in first round, n-1 in second.

  for (let i = 0; i < schedule.length; i++) {
    const jornada = schedule[i];
    for (let j = 0; j < jornada.matches.length; j++) {
      const match = jornada.matches[j];
      
      // Check for streaks or balance violations
      // This is a greedy swap
      if (canSwap(match, schedule, i, teamHomeCount, maxHomeGames)) {
        // Swap
        const temp = match.homeId;
        match.homeId = match.awayId;
        match.awayId = temp;
      }
      
      teamHomeCount[match.homeId] = (teamHomeCount[match.homeId] || 0) + 1;
    }
  }
  return schedule;
};

const canSwap = (
  match: MatchInfo,
  schedule: Jornada[],
  currentJornadaIndex: number,
  teamHomeCount: Record<string, number>,
  maxHomeGames: number
): boolean => {
  const isHomeStreak = (teamId: string, index: number): boolean => {
    // Check previous 2 games
    let count = 0;
    for (let i = index - 1; i >= 0 && i >= index - 2; i--) {
      const jornada = schedule[i];
      const m = jornada.matches.find(match => match.homeId === teamId || match.awayId === teamId);
      if (m && m.homeId === teamId) count++;
      else break;
    }
    return count >= 2;
  };

  const isAwayStreak = (teamId: string, index: number): boolean => {
    let count = 0;
    for (let i = index - 1; i >= 0 && i >= index - 2; i--) {
      const jornada = schedule[i];
      const m = jornada.matches.find(match => match.homeId === teamId || match.awayId === teamId);
      if (m && m.awayId === teamId) count++;
      else break;
    }
    return count >= 2;
  };

  const home = match.homeId;
  const away = match.awayId;

  // If home team has streak, swap to make it away (if allowed)
  if (isHomeStreak(home, currentJornadaIndex) && (teamHomeCount[home] > 0)) {
     return true;
  }
  
  // If away team has streak, swap to make it home (if allowed)
  if (isAwayStreak(away, currentJornadaIndex) && (teamHomeCount[home] < maxHomeGames)) {
    return true;
  }

  return false;
};

// Each jornada is one calendar week. Jornada 1 = September 1 of the season year.
export const jornadaDate = (seasonYear: number, jornadaNumber: number): Date => {
  return new Date(seasonYear, 8, 1 + (jornadaNumber - 1) * 7);
};

const MESES = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];

export const formatJornadaDate = (seasonYear: number, jornadaNumber: number): string => {
  const d = jornadaDate(seasonYear, jornadaNumber);
  return `${d.getDate()} ${MESES[d.getMonth()]} ${d.getFullYear()}`;
};
