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

  return [...schedule, ...secondRound];
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
