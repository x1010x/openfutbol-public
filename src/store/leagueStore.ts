import type { Team, Player, MatchEvent, Position } from '../types/game.d.ts';
import type { BoardObjective } from '../engine/florentinometro';
import { getTeamsForYearWithOverflow, getFreeAgents, getEligibleFreeAgents, advancePlayerToYear, extractDbId } from '../data/mockTeams';
import { generateSchedule } from '../engine/calendar';
import { pickBestFormation } from '../engine/formations';
import type { Jornada } from '../engine/calendar';
import { computeAttendance, computePrice, teamWeeklySalary } from '../data/economy';

export type PosGroup = 'POR' | 'DEF' | 'MED' | 'DEL';

export const SQUAD_TARGETS: Record<PosGroup, number> = { POR: 3, DEF: 6, MED: 6, DEL: 5 };

// Transfer window: open for first SUMMER jornadas, then WINTER jornadas around mid-season
export const SUMMER_WINDOW_SIZE = 10;
export const WINTER_WINDOW_SIZE = 8;

export const isTransferWindowOpen = (jornada: number, totalJornadas: number): boolean => {
  const midStart = Math.floor(totalJornadas / 2);
  return (jornada >= 1 && jornada <= SUMMER_WINDOW_SIZE) ||
         (jornada >= midStart && jornada < midStart + WINTER_WINDOW_SIZE);
};

// How many jornadas remain in the current open window (0 if closed)
export const windowJornadasLeft = (jornada: number, totalJornadas: number): number => {
  const midStart = Math.floor(totalJornadas / 2);
  if (jornada >= 1 && jornada <= SUMMER_WINDOW_SIZE) return SUMMER_WINDOW_SIZE - jornada + 1;
  if (jornada >= midStart && jornada < midStart + WINTER_WINDOW_SIZE) return (midStart + WINTER_WINDOW_SIZE) - jornada;
  return 0;
};

// Jornadas until the next window opens (0 if currently open)
export const jornadasUntilWindowOpen = (jornada: number, totalJornadas: number): number => {
  if (isTransferWindowOpen(jornada, totalJornadas)) return 0;
  const midStart = Math.floor(totalJornadas / 2);
  if (jornada < midStart) return midStart - jornada;
  return 999; // after winter window — next is next season
};

export const groupFor = (pos: Position): PosGroup => {
  if (pos === 'POR') return 'POR';
  if (pos === 'DEF') return 'DEF';
  if (pos === 'DEL') return 'DEL';
  return 'MED';
};

export const squadCounts = (team: Team): Record<PosGroup, number> => {
  const c: Record<PosGroup, number> = { POR: 0, DEF: 0, MED: 0, DEL: 0 };
  for (const p of team.players) c[groupFor(p.position)]++;
  return c;
};

// Positive => team wants more of this position, negative => surplus.
export const squadNeeds = (team: Team): Record<PosGroup, number> => {
  const counts = squadCounts(team);
  return {
    POR: SQUAD_TARGETS.POR - counts.POR,
    DEF: SQUAD_TARGETS.DEF - counts.DEF,
    MED: SQUAD_TARGETS.MED - counts.MED,
    DEL: SQUAD_TARGETS.DEL - counts.DEL,
  };
};

export interface TeamStats {
  teamId: string;
  name: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
}

export interface WeekFinance {
  jornada: number;
  income: number;
  salaries: number;
  tvBonus?: number;
}

export interface TeamFinances {
  seasonIncome: number;
  seasonSalaries: number;
  weeks: WeekFinance[];
  lastHomeMatch?: {
    income: number;
    attendance: number;
    capacity: number;
    fillPct: number;
    opponentId: string;
  };
}

export interface IncomingOffer {
  id: string;
  playerId: string;
  fromTeamId: string;
  amount: number;
  jornada: number;
  expiresAt: number;
  // Players the AI offers as part of a swap. Empty/absent means cash-only.
  offeredPlayerIds?: string[];
}

export interface TransferRecord {
  id: string;
  jornada: number;
  year: number;
  playerName: string;
  playerPosition: string;
  fromTeamName: string | null; // null = libre / free agent
  toTeamName: string;
  amount: number;
  tradeId?: string; // links all records that are part of the same swap
  kind?: 'transfer' | 'retirement';
  retirementAge?: number;
}

const TRANSFER_LOG_LIMIT = 30;

export const appendTransfer = (log: TransferRecord[], entry: TransferRecord): TransferRecord[] =>
  [entry, ...log].slice(0, TRANSFER_LOG_LIMIT);

export interface PlayerSeasonRecord {
  year: number;
  teamName: string;
  teamId: string;
  position: string;
  age: number;
  goals: number;
  assists: number;
  yellowCards: number;
  redCards: number;
  appearances?: number;
  minutes?: number;
  ratingSum?: number;
  cleanSheets?: number;
  goalsAgainst?: number;
  media?: number;
  shirtName?: string;
}

export type PlayerHistory = Record<string, PlayerSeasonRecord[]>;

export interface RoundRef {
  jornada: number;
  year: number;
}

export interface StreakSpan {
  from: RoundRef;
  to: RoundRef;
}

export interface TeamRecords {
  biggestWin: { gf: number; ga: number; jornada: number; year: number; opponentId: string } | null;
  heaviestDefeat: { gf: number; ga: number; jornada: number; year: number; opponentId: string } | null;
  mostGoalsInMatch: { gf: number; ga: number; jornada: number; year: number; opponentId: string } | null;
  longestUnbeaten: number;
  longestUnbeatenSpan: StreakSpan | null;
  currentUnbeaten: number;
  currentUnbeatenStart: RoundRef | null;
  longestWinning: number;
  longestWinningSpan: StreakSpan | null;
  currentWinning: number;
  currentWinningStart: RoundRef | null;
}

export interface SeasonAward {
  playerName: string;
  teamName: string;
  value: number; // goals for Pichichi, GA/game * 100 for Zamora
}

export interface SeasonHistoryEntry {
  year: number;
  standings: Array<{ teamId: string; teamName: string; points: number; gf: number; ga: number }>;
  champion: string;
  pichichi: SeasonAward | null;
  zamora: SeasonAward | null;
  mejorPorEquipo: Record<string, { playerName: string; ratingSum: number }>;
}

export interface ManagerSeasonRecord {
  year: number;
  teamName: string;
  teamId: string;
  finalPosition: number;
  totalTeams: number;
  objective: BoardObjective;
  objectiveMet: boolean;
  florentinometroFinal: number;
  florentinometroPeak: number;
  florentinometroMin: number;
  gamesManaged: number;
  wins: number;
  draws: number;
  losses: number;
  transferBalance: number;
  fired: boolean;
}

// LeagueState is the save format (persisted to localStorage as 'openfutbol_league').
// Any field added here that old saves won't have must also get a needsReset check in App.tsx.
export interface LeagueState {
  teams: Team[];
  stats: Record<string, TeamStats>;
  finances: Record<string, TeamFinances>;
  incomingOffers: IncomingOffer[];
  freeAgents: Player[];
  schedule: Jornada[];
  currentJornada: number;
  lastPlayedJornada: number;
  userTeamId: string;
  isStarted: boolean;
  seasonFinished: boolean;
  year: number;
  transferLog: TransferRecord[];
  playerHistory: PlayerHistory;
  teamRecords: Record<string, TeamRecords>;
  leagueHistory: SeasonHistoryEntry[];
  // Keys "sellerTeamId:playerId" or "free:playerId" the user can't bid for this season.
  blockedSignings: string[];
  // Florentinometro / PROMANAGER fields (optional so old saves load without reset).
  gameMode?: 'classic' | 'promanager';
  managerName?: string;
  florentinometro?: number;
  boardObjective?: BoardObjective;
  boardWarnings?: number;
  boardFired?: boolean;
  florentinometroPeak?: number;
  florentinometroMin?: number;
  seasonTransferSpent?: number;
  seasonTransferEarned?: number;
  managerCareer?: ManagerSeasonRecord[];
  boardRewardThreshold?: number; // 0 = none, 7 = praise given, 9 = marbella given
  managerStartJornada?: number;  // jornada when current manager took over (for grace period)
  managerWins?: number;          // wins since current manager took over (not full team season)
  managerDraws?: number;
  managerLosses?: number;
  aiClausulazoNews?: { playerName: string; teamName: string; amount: number; playerMedia: number }[];
  transferWindowEmergency?: boolean; // allow one extra signing after clausulazo on last window day
  managerReputation?: number;        // 0-100, persistent career reputation
  managerInitialSquadValue?: number; // budget + sum(playerPrices) when manager took over this stint
}

export const emptyTeamRecords = (): TeamRecords => ({
  biggestWin: null,
  heaviestDefeat: null,
  mostGoalsInMatch: null,
  longestUnbeaten: 0,
  longestUnbeatenSpan: null,
  currentUnbeaten: 0,
  currentUnbeatenStart: null,
  longestWinning: 0,
  longestWinningSpan: null,
  currentWinning: 0,
  currentWinningStart: null,
});

export const signingBlockKey = (sellerTeamId: string | null, playerId: string): string =>
  `${sellerTeamId ?? 'free'}:${playerId}`;

export const getInitialLeagueState = (
  year: number = 2024,
  selectedTeamIds?: string[],
  extraFreeAgents?: Player[],
  extraTeams?: Team[],
): LeagueState => {
  const { teams: dbTeams, overflow: squadOverflow } = getTeamsForYearWithOverflow(year);
  const allTeamsForYear = [...dbTeams, ...(extraTeams ?? [])];

  let teams: Team[];
  let bonusFreeAgents: Player[] = squadOverflow;

  if (selectedTeamIds && selectedTeamIds.length >= 4) {
    const selectedSet = new Set(selectedTeamIds);
    teams = allTeamsForYear.filter(t => selectedSet.has(t.id));
    bonusFreeAgents = [
      ...squadOverflow,
      ...allTeamsForYear.filter(t => !selectedSet.has(t.id)).flatMap(t => t.players),
    ];
  } else {
    teams = allTeamsForYear;
  }

  const freeAgents = [
    ...getFreeAgents(year),
    ...bonusFreeAgents,
    ...(extraFreeAgents ?? []),
  ];

  const initialStats: Record<string, TeamStats> = {};
  const initialFinances: Record<string, TeamFinances> = {};
  const initialRecords: Record<string, TeamRecords> = {};
  teams.forEach(team => {
    initialStats[team.id] = {
      teamId: team.id,
      name: team.name,
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      points: 0,
    };
    initialFinances[team.id] = {
      seasonIncome: 0,
      seasonSalaries: 0,
      weeks: [],
    };
    initialRecords[team.id] = emptyTeamRecords();
  });

  return {
    teams,
    stats: initialStats,
    finances: initialFinances,
    incomingOffers: [],
    freeAgents,
    schedule: generateSchedule(teams.map(t => t.id)),
    currentJornada: 1,
    lastPlayedJornada: 0,
    userTeamId: '',
    isStarted: false,
    seasonFinished: false,
    year,
    transferLog: [],
    playerHistory: {},
    teamRecords: initialRecords,
    leagueHistory: [],
    blockedSignings: [],
    gameMode: 'classic',
    managerName: '',
    florentinometro: 5,
    boardObjective: 'avoid_relegation' as BoardObjective,
    boardWarnings: 0,
    boardFired: false,
    florentinometroPeak: 5,
    florentinometroMin: 5,
    seasonTransferSpent: 0,
    seasonTransferEarned: 0,
    managerCareer: [],
  };
};

export const getFantasyLeagueState = (
  year: number,
  teams: Team[],
  allPoolPlayers: Player[],
): LeagueState => {
  const draftedIds = new Set(teams.flatMap(t => t.players.map(p => p.id)));
  const freeAgents = allPoolPlayers.filter(p => !draftedIds.has(p.id));

  const initialStats: Record<string, TeamStats> = {};
  const initialFinances: Record<string, TeamFinances> = {};
  const initialRecords: Record<string, TeamRecords> = {};
  teams.forEach(team => {
    initialStats[team.id] = {
      teamId: team.id, name: team.name,
      played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0,
    };
    initialFinances[team.id] = { seasonIncome: 0, seasonSalaries: 0, weeks: [] };
    initialRecords[team.id] = emptyTeamRecords();
  });

  return {
    teams,
    stats: initialStats,
    finances: initialFinances,
    incomingOffers: [],
    freeAgents,
    schedule: generateSchedule(teams.map(t => t.id)),
    currentJornada: 1,
    lastPlayedJornada: 0,
    userTeamId: '',
    isStarted: false,
    seasonFinished: false,
    year,
    transferLog: [],
    playerHistory: {},
    teamRecords: initialRecords,
    leagueHistory: [],
    blockedSignings: [],
  };
};

const buildMinutesMap = (startingLineup: string[], events: MatchEvent[], teamId: string): Record<string, number> => {
  const minutes: Record<string, number> = {};
  for (const pid of startingLineup) minutes[pid] = 90;
  for (const ev of events) {
    if (ev.type !== 'sub' || ev.teamId !== teamId) continue;
    if (ev.playerOffId) minutes[ev.playerOffId] = ev.minute;
    if (ev.playerId) minutes[ev.playerId] = (minutes[ev.playerId] ?? 0) + (90 - ev.minute);
  }
  return minutes;
};

export const updateLeagueStats = (
  state: LeagueState,
  homeId: string,
  awayId: string,
  homeScore: number,
  awayScore: number,
  events: MatchEvent[] = [],
  homeStartingLineup?: string[],
  awayStartingLineup?: string[],
): LeagueState => {
  const newStats = { ...state.stats };
  const newTeams = [...state.teams];

  const updateSingleTeam = (id: string, gf: number, ga: number) => {
    const s = { ...newStats[id] };
    s.played++;
    s.goalsFor += gf;
    s.goalsAgainst += ga;
    if (gf > ga) { s.won++; s.points += 3; }
    else if (gf < ga) { s.lost++; }
    else { s.drawn++; s.points += 1; }
    newStats[id] = s;
  };

  updateSingleTeam(homeId, homeScore, awayScore);
  updateSingleTeam(awayId, awayScore, homeScore);

  const newFinances = { ...state.finances };
  const homeTeam = newTeams.find(t => t.id === homeId);
  const awayTeam = newTeams.find(t => t.id === awayId);
  if (homeTeam && awayTeam) {
    const att = computeAttendance(homeTeam, awayTeam);
    const income = Math.floor(att.count * homeTeam.ticketPrice);
    homeTeam.budget += income;
    const prev = newFinances[homeId] ?? { seasonIncome: 0, seasonSalaries: 0, weeks: [] };
    const weeks = [...prev.weeks];
    const idx = weeks.findIndex(w => w.jornada === state.currentJornada);
    if (idx >= 0) {
      weeks[idx] = { ...weeks[idx], income: weeks[idx].income + income };
    } else {
      weeks.push({ jornada: state.currentJornada, income, salaries: 0 });
    }
    newFinances[homeId] = {
      ...prev,
      seasonIncome: prev.seasonIncome + income,
      weeks,
      lastHomeMatch: {
        income,
        attendance: att.count,
        capacity: att.capacity,
        fillPct: att.fillPct,
        opponentId: awayId,
      },
    };
  }

  // Actualizar estadísticas de jugadores. Las amarillas no acumulan sanción
  // (sólo cuentan para estadísticas). Una roja saca al jugador de la alineación
  // y le impide jugar la siguiente jornada.
  const redCardedThisMatch = new Set<string>();
  events.forEach(event => {
    if (!event.playerId) return;
    newTeams.forEach(team => {
      const player = team.players.find(p => p.id === event.playerId);
      if (player) {
        if (event.type === 'goal') {
          player.seasonStats.goals++;
        } else if (event.type === 'yellow') {
          player.seasonStats.yellowCards++;
        } else if (event.type === 'red') {
          player.seasonStats.redCards++;
          // Set to 2: post-match decrementSuspensions reduces to 1 so the
          // player is blocked for exactly the next match, then decremented to 0.
          player.suspensionMatches = 2;
          redCardedThisMatch.add(player.id);
        }
      }
      if (event.assistantId) {
        const assistant = team.players.find(p => p.id === event.assistantId);
        if (assistant) assistant.seasonStats.assists++;
      }
    });
  });

  // Sacar de la alineación a quienes han visto la roja
  if (redCardedThisMatch.size > 0) {
    for (let i = 0; i < newTeams.length; i++) {
      if (newTeams[i].lineup.some(id => redCardedThisMatch.has(id))) {
        newTeams[i] = { ...newTeams[i], lineup: newTeams[i].lineup.filter(id => !redCardedThisMatch.has(id)) };
      }
    }
  }

  // Goles y asistencias de este partido por jugador (para rating). Los contadores
  // de seasonStats ya se incrementaron arriba; aquí derivamos el delta de este partido.
  const goalsThisMatch = new Map<string, number>();
  const assistsThisMatch = new Map<string, number>();
  events.forEach(ev => {
    if (ev.type === 'goal' && ev.playerId) {
      goalsThisMatch.set(ev.playerId, (goalsThisMatch.get(ev.playerId) ?? 0) + 1);
    }
    if (ev.assistantId) {
      assistsThisMatch.set(ev.assistantId, (assistsThisMatch.get(ev.assistantId) ?? 0) + 1);
    }
  });

  const homeMinutes = homeStartingLineup ? buildMinutesMap(homeStartingLineup, events, homeId) : null;
  const awayMinutes = awayStartingLineup ? buildMinutesMap(awayStartingLineup, events, awayId) : null;

  const sides: { id: string; oppId: string; gf: number; ga: number; minutesMap: Record<string, number> | null }[] = [
    { id: homeId, oppId: awayId, gf: homeScore, ga: awayScore, minutesMap: homeMinutes },
    { id: awayId, oppId: homeId, gf: awayScore, ga: homeScore, minutesMap: awayMinutes },
  ];
  for (const side of sides) {
    const team = newTeams.find(t => t.id === side.id);
    if (!team) continue;
    team.players.forEach(player => {
      const mins = side.minutesMap ? (side.minutesMap[player.id] ?? 0) : null;
      // If we have a minutes map, use it. Otherwise fall back to lineup membership = 90 min.
      const playedMins = mins !== null ? mins : (team.lineup.includes(player.id) ? 90 : 0);
      if (playedMins <= 0) return;

      const slotIdx = team.lineup.indexOf(player.id);
      const isGK = slotIdx === 0;
      const g = goalsThisMatch.get(player.id) ?? 0;
      const a = assistsThisMatch.get(player.id) ?? 0;
      const cleanSheet = isGK && side.ga === 0;
      player.seasonStats.appearances++;
      player.seasonStats.minutes += playedMins;
      player.seasonStats.ratingSum += 1 + g * 6 + a * 3 + (cleanSheet ? 2 : 0);
      if (isGK) {
        player.seasonStats.goalsAgainst += side.ga;
        if (cleanSheet) player.seasonStats.cleanSheets++;
      }
    });
  }

  // Records por equipo: biggest win, heaviest defeat, racha (con span de jornadas), etc.
  const newRecords = { ...(state.teamRecords ?? {}) };
  for (const side of sides) {
    const cur = newRecords[side.id] ?? emptyTeamRecords();
    const recRef: TeamRecords = { ...cur };
    const ctx = { jornada: state.currentJornada, year: state.year, opponentId: side.oppId };
    const roundRef: RoundRef = { jornada: state.currentJornada, year: state.year };

    if (side.gf > side.ga) {
      const diff = side.gf - side.ga;
      const bestDiff = recRef.biggestWin ? recRef.biggestWin.gf - recRef.biggestWin.ga : -1;
      if (diff > bestDiff) recRef.biggestWin = { gf: side.gf, ga: side.ga, ...ctx };
      if (recRef.currentUnbeaten === 0) recRef.currentUnbeatenStart = roundRef;
      if (recRef.currentWinning === 0) recRef.currentWinningStart = roundRef;
      recRef.currentUnbeaten++;
      recRef.currentWinning++;
    } else if (side.gf < side.ga) {
      const diff = side.ga - side.gf;
      const worstDiff = recRef.heaviestDefeat ? recRef.heaviestDefeat.ga - recRef.heaviestDefeat.gf : -1;
      if (diff > worstDiff) recRef.heaviestDefeat = { gf: side.gf, ga: side.ga, ...ctx };
      recRef.currentUnbeaten = 0;
      recRef.currentUnbeatenStart = null;
      recRef.currentWinning = 0;
      recRef.currentWinningStart = null;
    } else {
      if (recRef.currentUnbeaten === 0) recRef.currentUnbeatenStart = roundRef;
      recRef.currentUnbeaten++;
      recRef.currentWinning = 0;
      recRef.currentWinningStart = null;
    }
    if (!recRef.mostGoalsInMatch || side.gf > recRef.mostGoalsInMatch.gf) {
      recRef.mostGoalsInMatch = { gf: side.gf, ga: side.ga, ...ctx };
    }
    if (recRef.currentUnbeaten > recRef.longestUnbeaten && recRef.currentUnbeatenStart) {
      recRef.longestUnbeaten = recRef.currentUnbeaten;
      recRef.longestUnbeatenSpan = { from: recRef.currentUnbeatenStart, to: roundRef };
    }
    if (recRef.currentWinning > recRef.longestWinning && recRef.currentWinningStart) {
      recRef.longestWinning = recRef.currentWinning;
      recRef.longestWinningSpan = { from: recRef.currentWinningStart, to: roundRef };
    }
    newRecords[side.id] = recRef;
  }

  // Las sanciones se decrementan una vez por jornada en decrementSuspensions().

  // Actualizar el partido en el calendario
  const newSchedule = state.schedule.map(j => {
    if (j.number === state.currentJornada) {
      return {
...j,
        matches: j.matches.map(m => {
          if ((m.homeId === homeId && m.awayId === awayId)) {
            return { ...m, played: true, homeScore, awayScore, events };
          }
          return m;
        })
      };
    }
    return j;
  });

  return { ...state, stats: newStats, finances: newFinances, schedule: newSchedule, teams: newTeams, teamRecords: newRecords };
};

const randInjuryDuration = (): number => {
  const r = Math.random();
  if (r < 0.45) return 1;
  if (r < 0.70) return 2;
  if (r < 0.85) return 3;
  if (r < 0.93) return 4 + Math.floor(Math.random() * 4);
  return 8 + Math.floor(Math.random() * 5);
};

// Write back live-match stamina and injuries to players in the league after a match.
export const writebackMatchStamina = (
  state: LeagueState,
  homeTeamId: string,
  awayTeamId: string,
  homeStamina: Record<string, number>,
  awayStamina: Record<string, number>,
  homeInjured: string[],
  awayInjured: string[],
): LeagueState => {
  const newTeams = state.teams.map(team => {
    if (team.id !== homeTeamId && team.id !== awayTeamId) return team;
    const stamMap = team.id === homeTeamId ? homeStamina : awayStamina;
    const injuredIds = team.id === homeTeamId ? homeInjured : awayInjured;
    return {
      ...team,
      players: team.players.map(p => {
        const newStamina = stamMap[p.id] !== undefined ? Math.max(1, Math.round(stamMap[p.id])) : p.stamina;
        const newInjury = injuredIds.includes(p.id) && p.injuryWeeksRemaining === 0
          ? randInjuryDuration()
          : p.injuryWeeksRemaining;
        return { ...p, stamina: newStamina, injuryWeeksRemaining: newInjury };
      }),
    };
  });
  return { ...state, teams: newTeams };
};

// Decay stamina for lineup players of an AI team after a match (no live tracking).
export const decayTeamStaminaAfterMatch = (state: LeagueState, teamId: string): LeagueState => {
  const newTeams = state.teams.map(team => {
    if (team.id !== teamId) return team;
    return {
      ...team,
      players: team.players.map(p => {
        if (!team.lineup.includes(p.id)) return p;
        const rate = 0.25 + (1 - p.stats.physical / 99) * 0.15;
        return { ...p, stamina: Math.max(1, Math.round((p.stamina ?? 99) - rate * 90)) };
      }),
    };
  });
  return { ...state, teams: newTeams };
};

export const decrementInjuries = (state: LeagueState): LeagueState => {
  const newTeams = state.teams.map(team => ({
    ...team,
    players: team.players.map(p =>
      (p.injuryWeeksRemaining ?? 0) > 0 ? { ...p, injuryWeeksRemaining: p.injuryWeeksRemaining - 1 } : p
    ),
  }));
  return { ...state, teams: newTeams };
};

export const applyStaminaRecovery = (state: LeagueState): LeagueState => {
  const newTeams = state.teams.map(team => ({
    ...team,
    players: team.players.map(p => ({
      ...p,
      stamina: Math.min(99, (p.stamina ?? 99) + Math.round(12 + (p.stats.physical / 99) * 13)),
    })),
  }));
  return { ...state, teams: newTeams };
};

// Decrement suspension counters by one per jornada played. Run once per jornada.
export const decrementSuspensions = (state: LeagueState): LeagueState => {
  const newTeams = state.teams.map(team => ({
    ...team,
    players: team.players.map(p =>
      p.suspensionMatches > 0 ? { ...p, suspensionMatches: p.suspensionMatches - 1 } : p
    ),
  }));
  return { ...state, teams: newTeams };
};

export const deductWeeklySalaries = (state: LeagueState): LeagueState => {
  const newFinances = { ...state.finances };
  const newTeams = state.teams.map(team => {
    const cost = Math.floor(teamWeeklySalary(team, state.year));
    const prev = newFinances[team.id] ?? { seasonIncome: 0, seasonSalaries: 0, weeks: [] };
    const weeks = [...prev.weeks];
    const idx = weeks.findIndex(w => w.jornada === state.currentJornada);
    if (idx >= 0) {
      weeks[idx] = { ...weeks[idx], salaries: weeks[idx].salaries + cost };
    } else {
      weeks.push({ jornada: state.currentJornada, income: 0, salaries: cost });
    }
    newFinances[team.id] = { ...prev, seasonSalaries: prev.seasonSalaries + cost, weeks };
    return { ...team, budget: team.budget - cost };
  });
  return { ...state, teams: newTeams, finances: newFinances };
};

// Re-elige formación y alineación óptimas para todos los equipos AI tras cambios de plantilla.
// El equipo del usuario se mantiene tal cual (lo gestiona él).
export const repickAiFormations = (state: LeagueState): LeagueState => {
  const newTeams = state.teams.map(team => {
    if (team.id === state.userTeamId) return team;
    const disc = team.tacticalDiscipline ?? true;
    const { formation, lineup } = pickBestFormation(team.players, new Set(), disc);
    return { ...team, formation, lineup };
  });
  return { ...state, teams: newTeams };
};

export const autoListAiPlayers = (state: LeagueState): LeagueState => {
  const newTeams = state.teams.map(team => {
    if (team.id === state.userTeamId) return team;
    const listedCount = team.players.filter(p => p.forSale).length;
    if (listedCount >= 3) return team;

    // Priority 1: past-prime players (age > peakAge + 3) on the bench
    const pastPrime = team.players.filter(p =>
      !p.forSale && !team.lineup.includes(p.id) &&
      (state.year - p.birthYear) > p.peakAge + 3,
    );

    // Priority 2: bench players well below their positional group average
    const groupAvg: Record<string, number> = {};
    for (const grp of ['POR', 'DEF', 'MED', 'DEL'] as const) {
      const inGroup = team.players.filter(pl => groupFor(pl.position) === grp);
      if (inGroup.length > 0) groupAvg[grp] = inGroup.reduce((s, pl) => s + pl.media, 0) / inGroup.length;
    }
    const belowAvg = team.players.filter(p =>
      !p.forSale && !team.lineup.includes(p.id) &&
      p.media < (groupAvg[groupFor(p.position)] ?? 0) - 8,
    );

    const priority = [...new Set([...pastPrime, ...belowAvg])];
    const candidates = priority.length > 0 ? priority
      : Math.random() < 0.2 ? team.players.filter(p => !team.lineup.includes(p.id) && !p.forSale)
      : [];
    if (candidates.length === 0) return team;

    const target = candidates[Math.floor(Math.random() * candidates.length)];
    return { ...team, players: team.players.map(p => (p.id === target.id ? { ...p, forSale: true } : p)) };
  });
  return { ...state, teams: newTeams };
};

// AI teams buy listed players from rival AI teams when they're a clear upgrade.
// AI teams buy players from other AI teams. See also: simulateAiFreeAgentSignings, simulateAiTrades.
export const simulateAiMarketSignings = (state: LeagueState): LeagueState => {
  const aiTeams = state.teams.filter(t => t.id !== state.userTeamId);
  if (aiTeams.length < 2) return state;

  let working = state;
  for (const buyer of [...aiTeams].sort(() => Math.random() - 0.5)) {
    if (Math.random() > 0.3) continue;
    const liveTeam = working.teams.find(t => t.id === buyer.id);
    if (!liveTeam || liveTeam.players.length >= 25) continue;

    const market = working.teams
      .filter(t => t.id !== buyer.id && t.id !== working.userTeamId)
      .flatMap(t => t.players.filter(p => p.forSale).map(p => ({ player: p, seller: t })));
    if (market.length === 0) continue;

    const needs = squadNeeds(liveTeam);
    let best: { player: Player; seller: typeof market[0]['seller']; gain: number } | null = null;

    for (const { player, seller } of market) {
      const grp = groupFor(player.position);
      const price = computePrice(player, working.year);
      if (liveTeam.budget < price) continue;

      if (needs[grp] > 0) {
        if (player.media > 55 && (!best || player.media > best.gain)) {
          best = { player, seller, gain: player.media };
        }
        continue;
      }
      const inGroup = liveTeam.players.filter(p => groupFor(p.position) === grp);
      if (inGroup.length === 0) continue;
      const weakest = inGroup.reduce((m, p) => p.media < m.media ? p : m, inGroup[0]);
      const gain = player.media - weakest.media;
      if (gain >= 5 && (!best || gain > best.gain)) best = { player, seller, gain };
    }
    if (!best) continue;

    const price = computePrice(best.player, working.year);
    const newTeams = working.teams.map(t => {
      if (t.id === best!.seller.id) {
        const players = t.players.filter(p => p.id !== best!.player.id);
        return { ...t, players, lineup: t.lineup.filter(id => id !== best!.player.id), budget: t.budget + price };
      }
      if (t.id === buyer.id) {
        return { ...t, players: [...t.players, { ...best!.player, forSale: false }], budget: t.budget - price };
      }
      return t;
    });
    const record: TransferRecord = {
      id: `ai_mkt_${working.currentJornada}_${best.player.id}_${buyer.id}`,
      jornada: working.currentJornada, year: working.year,
      playerName: best.player.name, playerPosition: best.player.position,
      fromTeamName: best.seller.name, toTeamName: buyer.name,
      amount: price,
    };
    working = { ...working, teams: newTeams, transferLog: appendTransfer(working.transferLog, record) };
  }
  return working;
};

export const MAX_SEASON_YEAR = 2030;


export const advanceSeason = (state: LeagueState): LeagueState => {
  const nextYear = state.year + 1;

  // Snapshot every player's just-completed season into history before we wipe stats.
  const playerHistory: PlayerHistory = { ...state.playerHistory };
  for (const team of state.teams) {
    for (const p of team.players) {
      const dbId = extractDbId(p.id);
      const rec: PlayerSeasonRecord = {
        year: state.year,
        teamName: team.name,
        teamId: team.id,
        position: p.position,
        age: state.year - p.birthYear,
        goals: p.seasonStats.goals,
        assists: p.seasonStats.assists,
        yellowCards: p.seasonStats.yellowCards,
        redCards: p.seasonStats.redCards,
        appearances: p.seasonStats.appearances,
        minutes: p.seasonStats.minutes,
        ratingSum: p.seasonStats.ratingSum,
        cleanSheets: p.seasonStats.cleanSheets,
        goalsAgainst: p.seasonStats.goalsAgainst,
        media: p.media,
        shirtName: p.name,
      };
      playerHistory[dbId] = [...(playerHistory[dbId] ?? []), rec];
    }
  }

  // Premios de temporada + clasificación final + Mejor jugador por equipo.
  const finalStandings = Object.values(state.stats)
    .map(s => ({ teamId: s.teamId, teamName: s.name, points: s.points, gf: s.goalsFor, ga: s.goalsAgainst }))
    .sort((a, b) => b.points - a.points || (b.gf - b.ga) - (a.gf - a.ga));
  const champion = finalStandings[0]?.teamName ?? '';

  let pichichi: SeasonAward | null = null;
  let zamora: SeasonAward | null = null;
  const mejorPorEquipo: Record<string, { playerName: string; ratingSum: number }> = {};
  for (const team of state.teams) {
    let teamBest: Player | null = null;
    for (const p of team.players) {
      if (p.seasonStats.goals > (pichichi?.value ?? -1)) {
        pichichi = { playerName: p.name, teamName: team.name, value: p.seasonStats.goals };
      }
      if (p.preferredPos === 'POR' && p.seasonStats.appearances >= 5) {
        const ga = p.seasonStats.goalsAgainst / p.seasonStats.appearances;
        if (zamora === null || ga < zamora.value) {
          zamora = { playerName: p.name, teamName: team.name, value: +ga.toFixed(2) };
        }
      }
      if (!teamBest || p.seasonStats.ratingSum > teamBest.seasonStats.ratingSum) {
        teamBest = p;
      }
    }
    if (teamBest && teamBest.seasonStats.ratingSum > 0) {
      mejorPorEquipo[team.id] = { playerName: teamBest.name, ratingSum: teamBest.seasonStats.ratingSum };
    }
  }
  const historyEntry: SeasonHistoryEntry = {
    year: state.year,
    standings: finalStandings,
    champion,
    pichichi,
    zamora,
    mejorPorEquipo,
  };

  const retirements: TransferRecord[] = [];
  const newTeams: Team[] = state.teams.map(team => {
    const survivors: Player[] = [];
    for (const p of team.players) {
      const advanced = advancePlayerToYear(p, nextYear);
      if (advanced) {
        survivors.push(advanced);
      } else {
        retirements.push({
          id: `retire_${state.year}_${p.id}`,
          jornada: 0,
          year: state.year,
          playerName: p.name,
          playerPosition: p.position,
          fromTeamName: team.name,
          toTeamName: '',
          amount: 0,
          kind: 'retirement',
          retirementAge: state.year - p.birthYear,
        });
      }
    }
    // Re-elegir la mejor formación con la plantilla resultante para reflejar bajas/altas.
    const { formation, lineup } = pickBestFormation(survivors, new Set(), team.tacticalDiscipline ?? true);
    return {
      ...team,
      year: nextYear,
      players: survivors,
      lineup,
      formation,
    };
  });

  const rosteredDbIds = new Set<string>();
  for (const team of newTeams) {
    for (const p of team.players) rosteredDbIds.add(extractDbId(p.id));
  }
  const freeAgents = getEligibleFreeAgents(nextYear, rosteredDbIds);

  const stats: Record<string, TeamStats> = {};
  const finances: Record<string, TeamFinances> = {};
  for (const team of newTeams) {
    stats[team.id] = {
      teamId: team.id,
      name: team.name,
      played: 0, won: 0, drawn: 0, lost: 0,
      goalsFor: 0, goalsAgainst: 0, points: 0,
    };
    finances[team.id] = { seasonIncome: 0, seasonSalaries: 0, weeks: [] };
  }

  // Surface retirements in the fichajes feed so they remain visible next season.
  const transferLog = retirements.reduce(
    (log, rec) => appendTransfer(log, rec),
    state.transferLog,
  );

  return {
    ...state,
    year: nextYear,
    teams: newTeams,
    stats,
    finances,
    incomingOffers: [],
    freeAgents,
    schedule: generateSchedule(newTeams.map(t => t.id)),
    transferLog,
    currentJornada: 1,
    lastPlayedJornada: 0,
    seasonFinished: false,
    playerHistory,
    leagueHistory: [...(state.leagueHistory ?? []), historyEntry],
    teamRecords: state.teamRecords ?? {},
    blockedSignings: [],
    florentinometro: 5,
    boardObjective: 'avoid_relegation' as BoardObjective,
    boardWarnings: 0,
    boardFired: false,
    florentinometroPeak: 5,
    florentinometroMin: 5,
    seasonTransferSpent: 0,
    seasonTransferEarned: 0,
  };
};

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

// Player attractiveness for AI bids: young + high media => higher bids, older players
// drift toward lowball offers. Combines a media factor with an age factor anchored
// at the player's peak.
const playerAttraction = (player: Player, seasonYear: number): number => {
  const age = seasonYear - player.birthYear;
  let ageFactor: number;
  if (age < player.peakAge) ageFactor = 1.0;
  else if (age <= player.peakAge + 2) ageFactor = 0.7;
  else ageFactor = Math.max(0, 0.7 - (age - player.peakAge - 2) * 0.15);
  const mediaFactor = clamp((player.media - 60) / 30, 0, 1);
  return ageFactor * 0.6 + mediaFactor * 0.4; // 0..1
};

// Maps attraction to a bid multiplier window. Listed players cluster lower; unlisted
// must overpay to tempt the owner.
const computeBidMultiplier = (attraction: number, listed: boolean): number => {
  const lo = 0.7 + attraction * 0.5;   // 0.7..1.2
  const hi = 0.85 + attraction * 0.7;  // 0.85..1.55
  let mul = lo + Math.random() * (hi - lo);
  if (!listed) mul += 0.3;
  return mul;
};

export const computeTvBonus = (
  stats: Record<string, TeamStats>,
  homeId: string,
  awayId: string,
): number => {
  const N = Object.keys(stats).length;
  if (N < 2) return 0;
  const sorted = Object.values(stats).sort(
    (a, b) => b.points - a.points || (b.goalsFor - b.goalsAgainst) - (a.goalsFor - a.goalsAgainst),
  );
  const posHome = sorted.findIndex(s => s.teamId === homeId) + 1;
  const posAway = sorted.findIndex(s => s.teamId === awayId) + 1;
  if (posHome === 0 || posAway === 0) return 0;
  const scoreHome = N + 1 - posHome;
  const scoreAway = N + 1 - posAway;
  return Math.round(5_000_000 * (scoreHome + scoreAway) / (2 * N - 1));
};

export const applyTvBonus = (
  state: LeagueState,
  teamId: string,
  bonus: number,
): LeagueState => {
  if (bonus <= 0) return state;
  const newTeams = state.teams.map(t =>
    t.id === teamId ? { ...t, budget: t.budget + bonus } : t,
  );
  const newFinances = { ...state.finances };
  const prev = newFinances[teamId] ?? { seasonIncome: 0, seasonSalaries: 0, weeks: [] };
  const weeks = [...prev.weeks];
  const idx = weeks.findIndex(w => w.jornada === state.currentJornada);
  if (idx >= 0) {
    weeks[idx] = { ...weeks[idx], income: weeks[idx].income + bonus, tvBonus: (weeks[idx].tvBonus ?? 0) + bonus };
  } else {
    weeks.push({ jornada: state.currentJornada, income: bonus, salaries: 0, tvBonus: bonus });
  }
  newFinances[teamId] = { ...prev, seasonIncome: prev.seasonIncome + bonus, weeks };
  return { ...state, teams: newTeams, finances: newFinances };
};

export const generateIncomingOffers = (state: LeagueState): LeagueState => {
  if (!state.userTeamId) return state;
  // Outside transfer windows, clear all pending offers — no new ones generated
  if (!isTransferWindowOpen(state.currentJornada, state.schedule.length)) {
    return { ...state, incomingOffers: [] };
  }
  const userTeam = state.teams.find(t => t.id === state.userTeamId);
  if (!userTeam) return state;

  // Prune expired offers first.
  const offers: IncomingOffer[] = (state.incomingOffers ?? []).filter(
    o => (o.expiresAt ?? Infinity) > state.currentJornada,
  );
  // Cap: don't flood with more than 5 simultaneous offers
  if (offers.length >= 5) return { ...state, incomingOffers: offers };

  for (const player of userTeam.players) {
    if (offers.length >= 5) break;
    if (!player.forSale) continue; // only generate offers for players listed on the market
    const price = computePrice(player, state.year);
    const listed = true;
    const group = groupFor(player.position);
    for (const rival of state.teams) {
      if (offers.length >= 5) break;
      if (rival.id === userTeam.id) continue;
      if (offers.some(o => o.playerId === player.id && o.fromTeamId === rival.id)) continue;

      // Skip rivals already long in this position; allow some tolerance.
      const rivalNeeds = squadNeeds(rival);
      if (rivalNeeds[group] < -1) continue;

      // Quality filter: rival only bids if player genuinely improves their squad.
      // Listed players get more lenient filter — rival just needs any improvement.
      const rivalInGroup = rival.players.filter(p => groupFor(p.position) === group);
      if (rivalInGroup.length > 0) {
        const weakestMedia = Math.min(...rivalInGroup.map(p => p.media));
        const minGain = listed ? 1 : 4; // listed = any gain, unlisted = must be clear upgrade
        if (player.media <= weakestMedia + minGain) continue;
      }

      // Stronger appetite when rival is short of bodies.
      const needBoost = clamp(rivalNeeds[group] * 0.06, -0.05, 0.15);
      const surplus = Math.max(0, rival.budget - price * 1.2);
      const interestBoost = Math.min(0.2, surplus / (price * 5 || 1));
      const baseChance = listed ? 0.15 : 0.012; // listed players get much stronger interest
      const chance = baseChance + (listed ? interestBoost : interestBoost * 0.3) + needBoost;
      if (Math.random() > chance) continue;

      const attraction = playerAttraction(player, state.year);
      const bidMul = computeBidMultiplier(attraction, listed);
      const amount = Math.max(50_000, Math.round((price * bidMul) / 200_000) * 100_000);
      if (amount > rival.budget) continue;

      const expiresAt = state.currentJornada + 1 + Math.floor(Math.random() * 3);

      // Occasionally include a bench player in same position group as part of the deal.
      // Higher chance when rival has surplus in that group.
      let offeredPlayerIds: string[] | undefined;
      const surplusInGroup = -rivalNeeds[group];
      const swapChance = clamp(0.1 + surplusInGroup * 0.1, 0, 0.5);
      if (Math.random() < swapChance) {
        const bench = rival.players.filter(p =>
          !rival.lineup.includes(p.id) &&
          groupFor(p.position) === group &&
          computePrice(p, state.year) <= price * 0.9,
        );
        if (bench.length > 0) {
          const pick = bench[Math.floor(Math.random() * bench.length)];
          const pickPrice = computePrice(pick, state.year);
          const adjustedCash = Math.max(50_000, Math.round((amount - pickPrice) / 200_000) * 100_000);

          if (adjustedCash <= rival.budget && adjustedCash > 0) {
            offeredPlayerIds = [pick.id];
            offers.push({
              id: `${state.currentJornada}_${rival.id}_${player.id}`,
              playerId: player.id,
              fromTeamId: rival.id,
              amount: adjustedCash,
              jornada: state.currentJornada,
              expiresAt,
              offeredPlayerIds,
            });
            continue;
          }
        }
      }

      offers.push({
        id: `${state.currentJornada}_${rival.id}_${player.id}`,
        playerId: player.id,
        fromTeamId: rival.id,
        amount,
        jornada: state.currentJornada,
        expiresAt,
      });
    }
  }
  return { ...state, incomingOffers: offers };
};

// AI teams sign free agents, weighted by squad need x youth x media. Teams that
// already have a full positional quota effectively stop signing in that group.
// AI teams sign from the free agent pool. See also: simulateAiMarketSignings, simulateAiTrades.
export const simulateAiFreeAgentSignings = (state: LeagueState): LeagueState => {
  if (state.freeAgents.length === 0) return state;
  const aiTeams = state.teams.filter(t => t.id !== state.userTeamId);
  if (aiTeams.length === 0) return state;

  let working = state;
  const shuffled = [...aiTeams].sort(() => Math.random() - 0.5);

  for (const team of shuffled) {
    if (Math.random() > 0.25) continue;
    const liveTeam = working.teams.find(t => t.id === team.id);
    if (!liveTeam || liveTeam.players.length >= 25) continue;
    if (working.freeAgents.length === 0) break;

    const needs = squadNeeds(liveTeam);
    const candidates = working.freeAgents.map(p => {
      const age = working.year - p.birthYear;
      const group = groupFor(p.position);
      const need = needs[group];
      // Hard cap: skip positions already at/over target.
      if (need <= 0) return { player: p, weight: 0, price: computePrice(p, working.year) };
      const youthWeight = Math.max(1, 30 - age);
      const mediaWeight = Math.max(1, p.media - 50);
      const weight = need * youthWeight * mediaWeight;
      return { player: p, weight, price: computePrice(p, working.year) };
    }).filter(c => c.weight > 0 && liveTeam.budget >= c.price);

    if (candidates.length === 0) continue;

    const totalWeight = candidates.reduce((s, c) => s + c.weight, 0);
    let r = Math.random() * totalWeight;
    let pick = candidates[0];
    for (const c of candidates) {
      r -= c.weight;
      if (r <= 0) { pick = c; break; }
    }

    const newPlayer = { ...pick.player, forSale: false };
    const updatedTeams = working.teams.map(t =>
      t.id === team.id
        ? { ...t, players: [...t.players, newPlayer], budget: t.budget - pick.price }
        : t
    );
    const transfer: TransferRecord = {
      id: `fa_${working.currentJornada}_${pick.player.id}_${Date.now()}`,
      jornada: working.currentJornada,
      year: working.year,
      playerName: pick.player.name,
      playerPosition: pick.player.position,
      fromTeamName: null,
      toTeamName: team.name,
      amount: pick.price,
    };
    working = {
      ...working,
      teams: updatedTeams,
      freeAgents: working.freeAgents.filter(p => p.id !== pick.player.id),
      transferLog: appendTransfer(working.transferLog, transfer),
    };
  }

  return working;
};

// AI team triggers a clausulazo on a high-value user player (unlisted, pays 2× price immediately).
// Only happens during open transfer windows. Max 1 clausulazo per jornada.
export const simulateAiClausulazos = (state: LeagueState): LeagueState => {
  if (!state.userTeamId) return state;
  if (!isTransferWindowOpen(state.currentJornada, state.schedule.length)) return state;
  const userTeam = state.teams.find(t => t.id === state.userTeamId);
  if (!userTeam) return state;

  // Only consider unlisted high-media players as clausulazo targets
  const targets = userTeam.players.filter(p => !p.forSale && p.media >= 72);
  if (targets.length === 0) return state;

  const aiTeams = state.teams.filter(t => t.id !== state.userTeamId);
  if (aiTeams.length === 0) return state;

  // Shuffle both lists to avoid systematic bias
  const shuffledTargets = [...targets].sort(() => Math.random() - 0.5);
  const shuffledAi = [...aiTeams].sort(() => Math.random() - 0.5);

  for (const player of shuffledTargets) {
    const price = computePrice(player, state.year);
    const clausulaPrice = price * 2;
    const group = groupFor(player.position);

    for (const rival of shuffledAi) {
      // Rival must afford the clausulazo
      if (rival.budget < clausulaPrice) continue;

      // Rival must genuinely need an upgrade in this position group
      const rivalInGroup = rival.players.filter(p => groupFor(p.position) === group);
      const weakestMedia = rivalInGroup.length > 0
        ? Math.min(...rivalInGroup.map(p => p.media))
        : 0;
      if (player.media <= weakestMedia + 5) continue; // must be a substantial upgrade

      // ~5% chance per eligible rival → averages ~1 clausulazo per window
      if (Math.random() > 0.05) continue;

      // Execute the clausulazo
      const newTeams = state.teams.map(t => {
        if (t.id === userTeam.id) {
          return {
            ...t,
            players: t.players.filter(p => p.id !== player.id),
            lineup: t.lineup.filter(id => id !== player.id),
            budget: t.budget + clausulaPrice,
          };
        }
        if (t.id === rival.id) {
          return {
            ...t,
            players: [...t.players, { ...player, forSale: false }],
            budget: t.budget - clausulaPrice,
          };
        }
        return t;
      });

      const record: TransferRecord = {
        id: `clausulazo_${state.currentJornada}_${player.id}_${rival.id}`,
        jornada: state.currentJornada,
        year: state.year,
        playerName: player.name,
        playerPosition: player.position,
        fromTeamName: userTeam.name,
        toTeamName: rival.name,
        amount: clausulaPrice,
      };

      const news = [...(state.aiClausulazoNews ?? []), {
        playerName: player.name,
        teamName: rival.name,
        amount: clausulaPrice,
        playerMedia: player.media,
      }];

      return {
        ...state,
        teams: newTeams,
        transferLog: appendTransfer(state.transferLog, record),
        aiClausulazoNews: news,
      };
    }
  }
  return state;
};

// AI-vs-AI player swaps. One try per jornada. Players must share a position group
// and the trade should plausibly help both squads (surplus <-> need where possible);
// the team receiving the higher-valued player pays the cash difference.
// Two AI teams swap bench players with each other. See also: simulateAiMarketSignings, simulateAiFreeAgentSignings.
export const simulateAiTrades = (state: LeagueState): LeagueState => {
  const aiTeams = state.teams.filter(t => t.id !== state.userTeamId);
  if (aiTeams.length < 2) return state;
  if (Math.random() > 0.45) return state;

  const shuffled = [...aiTeams].sort(() => Math.random() - 0.5);
  const teamA = shuffled[0];
  const teamB = shuffled[1];

  const benchA = teamA.players.filter(p => !teamA.lineup.includes(p.id));
  const benchB = teamB.players.filter(p => !teamB.lineup.includes(p.id));
  if (benchA.length === 0 || benchB.length === 0) return state;

  for (let attempt = 0; attempt < 6; attempt++) {
    const pA = benchA[Math.floor(Math.random() * benchA.length)];
    const pB = benchB[Math.floor(Math.random() * benchB.length)];
    if (groupFor(pA.position) !== groupFor(pB.position)) continue;

    const priceA = computePrice(pA, state.year);
    const priceB = computePrice(pB, state.year);
    const ratio = Math.min(priceA, priceB) / Math.max(priceA, priceB, 1);
    if (ratio < 0.55) continue; // too lopsided

    const diff = Math.abs(priceA - priceB);
    const cash = Math.round(diff / 100_000) * 100_000;
    // The team receiving the more valuable player pays cash.
    const receiverIsB = priceA > priceB;
    const payer = receiverIsB ? teamB : teamA;
    if (payer.budget < cash) continue;

    const tradeId = `trade_${state.currentJornada}_${teamA.id}_${teamB.id}_${pA.id}_${pB.id}`;

    const newTeams = state.teams.map(t => {
      if (t.id === teamA.id) {
        const players = t.players.filter(p => p.id !== pA.id).concat({ ...pB, forSale: false });
        const lineup = t.lineup.filter(id => id !== pA.id);
        const budget = receiverIsB ? t.budget + cash : t.budget - cash;
        return { ...t, players, lineup, budget };
      }
      if (t.id === teamB.id) {
        const players = t.players.filter(p => p.id !== pB.id).concat({ ...pA, forSale: false });
        const lineup = t.lineup.filter(id => id !== pB.id);
        const budget = receiverIsB ? t.budget - cash : t.budget + cash;
        return { ...t, players, lineup, budget };
      }
      return t;
    });

    const log1: TransferRecord = {
      id: `${tradeId}_a`,
      jornada: state.currentJornada,
      year: state.year,
      playerName: pA.name,
      playerPosition: pA.position,
      fromTeamName: teamA.name,
      toTeamName: teamB.name,
      amount: receiverIsB ? cash : 0,
      tradeId,
    };
    const log2: TransferRecord = {
      id: `${tradeId}_b`,
      jornada: state.currentJornada,
      year: state.year,
      playerName: pB.name,
      playerPosition: pB.position,
      fromTeamName: teamB.name,
      toTeamName: teamA.name,
      amount: receiverIsB ? 0 : cash,
      tradeId,
    };
    return {
      ...state,
      teams: newTeams,
      transferLog: appendTransfer(appendTransfer(state.transferLog, log2), log1),
    };
  }
  return state;
};
