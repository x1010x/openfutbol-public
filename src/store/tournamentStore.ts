// Custom tournament state machine, Sensible Soccer-style: a tournament is a
// chain of stages. Each stage consumes N teams and produces M survivors. The
// final stage's output is 1 (the champion). Two stage types: 'liga' (round
// robin in groups) and 'ko' (one knockout round, configurable legs).
//
// State lives in localStorage under its own key, independent of LeagueState.

import type { Team } from '../types/game.d.ts';
import { calculateTeamStrength } from '../engine/simEngine';
import { engineSettings } from '../engine/engineSettings';

export const MAX_TEAMS = 64;
export const MAX_GROUP_SIZE = 16;
export const MAX_LEGS = 4;

// ── Stage configs ─────────────────────────────────────────────────────────
export type StageKind = 'liga' | 'ko';

export interface LigaStageConfig {
  kind: 'liga';
  groupSize: number;          // ≤ MAX_GROUP_SIZE
  advancePerGroup: number;    // 1..groupSize-1
}

export interface KoStageConfig {
  kind: 'ko';
  legs: 1 | 2 | 3 | 4;
  awayGoalsRule?: boolean;    // only meaningful when legs >= 2
}

export type StageConfig = LigaStageConfig | KoStageConfig;

// ── Runtime stage state ───────────────────────────────────────────────────
export interface GroupMatch {
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number | null;
  awayScore: number | null;
  played: boolean;
  jornada: number;
}

export interface TournamentGroup {
  id: string;
  letter: string;             // "A", "B", "C"…
  teamIds: string[];
  matches: GroupMatch[];      // round-robin schedule
}

export interface TieLeg {
  homeTeamId: string;         // for this leg only (alternates in 2+ legs)
  awayTeamId: string;
  homeScore: number | null;
  awayScore: number | null;
  played: boolean;
}

export interface TournamentTie {
  id: string;
  slot: number;
  homeTeamId: string | null;  // overall fixture identity (leg 1 home)
  awayTeamId: string | null;
  legs: TieLeg[];
  played: boolean;
  winnerTeamId: string | null;
  aggHome: number;            // running aggregate
  aggAway: number;
}

export interface TournamentStage {
  id: string;
  name: string;               // user-facing label, e.g. "Fase de grupos"
  config: StageConfig;
  inputCount: number;
  outputCount: number;
  // Runtime
  inputTeamIds: string[] | null;   // filled when stage starts
  groups?: TournamentGroup[];      // when kind=liga
  ties?: TournamentTie[];          // when kind=ko
  completed: boolean;
  // Outputs (filled when completed)
  survivorIds?: string[];
}

export interface TournamentState {
  id: string;
  name: string;
  // null = spectator mode: no team is "yours", everything auto-sims.
  userTeamId: string | null;
  teams: Team[];              // closed set
  stages: TournamentStage[];
  currentStageIdx: number;
  champion: string | null;
  createdAt: string;
  // Player traffic during the tournament. v1 stores the flag and respects it
  // as a setup option; the actual transfer flow lands in a follow-up.
  transfersEnabled: boolean;
}

const TOURNAMENT_KEY = 'openfutbol_tournament';

// ── Helpers ──────────────────────────────────────────────────────────────
const shuffle = <T>(arr: T[]): T[] => {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

const letterFor = (i: number): string => String.fromCharCode(65 + i);

const samplePoisson = (lambda: number): number => {
  const L = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do { k++; p *= Math.random(); } while (p > L);
  return k - 1;
};

const scoreMatch = (home: Team, away: Team): { hs: number; as: number } => {
  const homeBoost = 1 + ((0.05 + Math.random() * 0.15) * engineSettings.homeAdvantageMult);
  const hStr = calculateTeamStrength(home) * homeBoost;
  const aStr = calculateTeamStrength(away);
  const ratio = hStr / Math.max(aStr, 1);
  const hL = 1.3 * Math.pow(ratio, 1.5);
  const aL = 1.0 * Math.pow(1 / ratio, 1.5);
  return { hs: samplePoisson(hL), as: samplePoisson(aL) };
};

const skewedShootout = (home: Team, away: Team): 'home' | 'away' => {
  const hStr = calculateTeamStrength(home);
  const aStr = calculateTeamStrength(away);
  const homeProb = 0.5 + Math.max(-0.15, Math.min(0.15, (hStr - aStr) / Math.max(hStr, aStr, 1) * 0.5));
  return Math.random() < homeProb ? 'home' : 'away';
};

// ── Validation ───────────────────────────────────────────────────────────
export interface StageDraft {
  kind: StageKind;
  groupSize?: number;
  advancePerGroup?: number;
  legs?: 1 | 2 | 3 | 4;
  awayGoalsRule?: boolean;    // ko only, legs >= 2
}

export interface ChainValidation {
  ok: boolean;
  reason?: string;
  stageIO: { input: number; output: number }[];
}

export const validateStageChain = (totalTeams: number, drafts: StageDraft[]): ChainValidation => {
  if (totalTeams < 2 || totalTeams > MAX_TEAMS) return { ok: false, reason: `Equipos fuera de rango (2-${MAX_TEAMS}).`, stageIO: [] };
  if (drafts.length === 0) return { ok: false, reason: 'Añade al menos una fase.', stageIO: [] };
  const io: { input: number; output: number }[] = [];
  let input = totalTeams;
  for (let i = 0; i < drafts.length; i++) {
    const d = drafts[i];
    let output: number;
    if (d.kind === 'liga') {
      const gs = d.groupSize ?? 0;
      const adv = d.advancePerGroup ?? 0;
      if (gs < 2 || gs > MAX_GROUP_SIZE) return { ok: false, reason: `Fase ${i + 1}: tamaño de grupo inválido.`, stageIO: io };
      if (input % gs !== 0) return { ok: false, reason: `Fase ${i + 1}: ${input} equipos no se reparten en grupos de ${gs}.`, stageIO: io };
      if (adv < 1 || adv >= gs) return { ok: false, reason: `Fase ${i + 1}: clasificados por grupo inválido.`, stageIO: io };
      const groups = input / gs;
      output = groups * adv;
    } else {
      const legs = d.legs ?? 1;
      if (legs < 1 || legs > MAX_LEGS) return { ok: false, reason: `Fase ${i + 1}: nº de partidos por eliminatoria 1-${MAX_LEGS}.`, stageIO: io };
      if (input % 2 !== 0) return { ok: false, reason: `Fase ${i + 1}: necesitas un nº par de equipos para una eliminatoria.`, stageIO: io };
      output = input / 2;
    }
    io.push({ input, output });
    input = output;
  }
  if (io[io.length - 1].output !== 1) return { ok: false, reason: 'La última fase debe acabar con 1 ganador.', stageIO: io };
  return { ok: true, stageIO: io };
};

// ── Stage construction ───────────────────────────────────────────────────
const nameForStage = (kind: StageKind, input: number, output: number, idx: number): string => {
  if (kind === 'liga') {
    return input === output ? 'Liga' : `Fase de grupos`;
  }
  if (output === 1) return 'Final';
  if (output === 2) return 'Semifinales';
  if (output === 4) return 'Cuartos';
  if (output === 8) return 'Octavos';
  return `Eliminatoria ${idx + 1}`;
};

const makeId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

const buildStage = (draft: StageDraft, input: number, idx: number): TournamentStage => {
  let output: number;
  let config: StageConfig;
  if (draft.kind === 'liga') {
    config = { kind: 'liga', groupSize: draft.groupSize!, advancePerGroup: draft.advancePerGroup! };
    const groups = input / config.groupSize;
    output = groups * config.advancePerGroup;
  } else {
    config = { kind: 'ko', legs: (draft.legs ?? 1) as 1 | 2 | 3 | 4, awayGoalsRule: !!draft.awayGoalsRule };
    output = input / 2;
  }
  return {
    id: makeId('stg'),
    name: nameForStage(draft.kind, input, output, idx),
    config,
    inputCount: input,
    outputCount: output,
    inputTeamIds: null,
    completed: false,
  };
};

export const createTournament = (
  name: string,
  teams: Team[],
  userTeamId: string | null,
  drafts: StageDraft[],
  transfersEnabled = false,
): TournamentState => {
  const validation = validateStageChain(teams.length, drafts);
  if (!validation.ok) throw new Error(validation.reason ?? 'Configuración inválida');
  let cursor = teams.length;
  const stages: TournamentStage[] = drafts.map((d, i) => {
    const s = buildStage(d, cursor, i);
    cursor = s.outputCount;
    return s;
  });
  // Seed first stage with shuffled team ids.
  const seeded = shuffle(teams.map(t => t.id));
  stages[0] = startStage(stages[0], seeded, teams);
  return {
    id: makeId('tourn'),
    name,
    userTeamId,
    teams,
    stages,
    currentStageIdx: 0,
    champion: null,
    createdAt: new Date().toISOString(),
    transfersEnabled,
  };
};

// Round-robin schedule using the standard rotating algorithm. Returns
// jornadas of length n/2 each (n-1 jornadas total, ida only).
const buildRoundRobin = (teamIds: string[]): GroupMatch[] => {
  const ids = [...teamIds];
  if (ids.length % 2 === 1) ids.push('__BYE__');
  const n = ids.length;
  const jornadas = n - 1;
  const matches: GroupMatch[] = [];
  const arr = ids.slice();
  for (let j = 0; j < jornadas; j++) {
    for (let i = 0; i < n / 2; i++) {
      const home = arr[i];
      const away = arr[n - 1 - i];
      if (home !== '__BYE__' && away !== '__BYE__') {
        matches.push({
          homeTeamId: j % 2 === 0 ? home : away,
          awayTeamId: j % 2 === 0 ? away : home,
          homeScore: null, awayScore: null, played: false, jornada: j + 1,
        });
      }
    }
    // Rotate (keep arr[0] fixed).
    const last = arr.pop()!;
    arr.splice(1, 0, last);
  }
  return matches;
};

const startStage = (stage: TournamentStage, inputTeamIds: string[], _teams: Team[]): TournamentStage => {
  const result: TournamentStage = { ...stage, inputTeamIds };
  if (stage.config.kind === 'liga') {
    const gs = stage.config.groupSize;
    const groupCount = stage.inputCount / gs;
    const shuffled = shuffle(inputTeamIds);
    const groups: TournamentGroup[] = [];
    for (let g = 0; g < groupCount; g++) {
      const teamIds = shuffled.slice(g * gs, (g + 1) * gs);
      groups.push({
        id: makeId('grp'),
        letter: letterFor(g),
        teamIds,
        matches: buildRoundRobin(teamIds),
      });
    }
    result.groups = groups;
  } else {
    const legs = (stage.config as KoStageConfig).legs;
    const shuffled = shuffle(inputTeamIds);
    const ties: TournamentTie[] = [];
    for (let i = 0; i < shuffled.length; i += 2) {
      const homeId = shuffled[i];
      const awayId = shuffled[i + 1];
      const legArr: TieLeg[] = [];
      for (let l = 0; l < legs; l++) {
        // Alternate home/away across legs; PK leg (if legs>2 odd) follows pattern.
        const homeIsFirst = l % 2 === 0;
        legArr.push({
          homeTeamId: homeIsFirst ? homeId : awayId,
          awayTeamId: homeIsFirst ? awayId : homeId,
          homeScore: null, awayScore: null, played: false,
        });
      }
      ties.push({
        id: makeId('tie'),
        slot: i / 2,
        homeTeamId: homeId,
        awayTeamId: awayId,
        legs: legArr,
        played: false,
        winnerTeamId: null,
        aggHome: 0,
        aggAway: 0,
      });
    }
    result.ties = ties;
  }
  return result;
};

// ── Group standings ───────────────────────────────────────────────────────
export interface GroupStanding {
  teamId: string;
  played: number; won: number; drawn: number; lost: number;
  gf: number; ga: number; gd: number; points: number;
}

export const groupStandings = (group: TournamentGroup): GroupStanding[] => {
  const map = new Map<string, GroupStanding>();
  for (const id of group.teamIds) {
    map.set(id, { teamId: id, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, gd: 0, points: 0 });
  }
  for (const m of group.matches) {
    if (!m.played || m.homeScore == null || m.awayScore == null) continue;
    const h = map.get(m.homeTeamId)!;
    const a = map.get(m.awayTeamId)!;
    h.played++; a.played++;
    h.gf += m.homeScore; h.ga += m.awayScore;
    a.gf += m.awayScore; a.ga += m.homeScore;
    if (m.homeScore > m.awayScore) { h.won++; h.points += 3; a.lost++; }
    else if (m.homeScore < m.awayScore) { a.won++; a.points += 3; h.lost++; }
    else { h.drawn++; a.drawn++; h.points += 1; a.points += 1; }
  }
  for (const s of map.values()) s.gd = s.gf - s.ga;
  return [...map.values()].sort((a, b) =>
    (b.points - a.points) || (b.gd - a.gd) || (b.gf - a.gf) || a.teamId.localeCompare(b.teamId)
  );
};

// ── Stage advancement ─────────────────────────────────────────────────────

const simulateUnplayedGroupMatches = (group: TournamentGroup, state: TournamentState): TournamentGroup => {
  const teamById = (id: string) => state.teams.find(t => t.id === id)!;
  return {
    ...group,
    matches: group.matches.map(m => {
      if (m.played) return m;
      const home = teamById(m.homeTeamId);
      const away = teamById(m.awayTeamId);
      const { hs, as } = scoreMatch(home, away);
      return { ...m, homeScore: hs, awayScore: as, played: true };
    }),
  };
};

const simulateUnplayedTies = (ties: TournamentTie[], cfg: KoStageConfig, state: TournamentState): TournamentTie[] => {
  const teamById = (id: string) => state.teams.find(t => t.id === id)!;
  return ties.map(tie => {
    if (tie.played || !tie.homeTeamId || !tie.awayTeamId) return tie;
    const legs = tie.legs.map(leg => {
      if (leg.played) return leg;
      const { hs, as } = scoreMatch(teamById(leg.homeTeamId), teamById(leg.awayTeamId));
      return { ...leg, homeScore: hs, awayScore: as, played: true };
    });
    return finalizeTie(tie, legs, cfg, state);
  });
};

const finalizeTie = (tie: TournamentTie, legs: TieLeg[], cfg: KoStageConfig, state: TournamentState): TournamentTie => {
  // Aggregate from the canonical (homeTeamId, awayTeamId) perspective.
  let aggHome = 0;
  let aggAway = 0;
  // Away goals = goals scored at the OTHER team's stadium.
  let awayHome = 0; // home team's goals scored away
  let awayAway = 0; // away team's goals scored away
  const home = tie.homeTeamId!;
  const away = tie.awayTeamId!;
  for (const leg of legs) {
    if (!leg.played || leg.homeScore == null || leg.awayScore == null) continue;
    if (leg.homeTeamId === home) {
      aggHome += leg.homeScore; aggAway += leg.awayScore;
      awayAway += leg.awayScore; // away team scored at home team's stadium
    } else {
      aggHome += leg.awayScore; aggAway += leg.homeScore;
      awayHome += leg.awayScore; // home team scored at away team's stadium
    }
  }
  let winner: string;
  if (aggHome > aggAway) winner = home;
  else if (aggAway > aggHome) winner = away;
  else if (cfg.legs >= 2 && cfg.awayGoalsRule && awayHome !== awayAway) {
    winner = awayHome > awayAway ? home : away;
  } else {
    const homeTeam = state.teams.find(t => t.id === home)!;
    const awayTeam = state.teams.find(t => t.id === away)!;
    winner = skewedShootout(homeTeam, awayTeam) === 'home' ? home : away;
  }
  return { ...tie, legs, played: true, aggHome, aggAway, winnerTeamId: winner };
};

const stageSurvivors = (stage: TournamentStage): string[] => {
  if (stage.config.kind === 'liga' && stage.groups) {
    const adv = stage.config.advancePerGroup;
    const out: string[] = [];
    for (const g of stage.groups) {
      const standings = groupStandings(g);
      for (let i = 0; i < adv; i++) out.push(standings[i].teamId);
    }
    return out;
  }
  if (stage.config.kind === 'ko' && stage.ties) {
    return stage.ties
      .slice()
      .sort((a, b) => a.slot - b.slot)
      .map(t => t.winnerTeamId)
      .filter((id): id is string => Boolean(id));
  }
  return [];
};

// Advance: simulate everything unplayed in the current stage, compute
// survivors, kick off the next stage. If this is the final stage, crown a
// champion.
export const advanceCurrentStage = (state: TournamentState): TournamentState => {
  if (state.champion) return state;
  const stage = state.stages[state.currentStageIdx];
  let updated: TournamentStage;
  if (stage.config.kind === 'liga') {
    const groups = (stage.groups ?? []).map(g => simulateUnplayedGroupMatches(g, state));
    updated = { ...stage, groups, completed: true };
  } else {
    const ties = simulateUnplayedTies(stage.ties ?? [], stage.config as KoStageConfig, state);
    updated = { ...stage, ties, completed: true };
  }
  const survivors = stageSurvivors(updated);
  updated.survivorIds = survivors;
  const newStages = [...state.stages];
  newStages[state.currentStageIdx] = updated;
  const isLast = state.currentStageIdx === state.stages.length - 1;
  if (isLast) {
    return { ...state, stages: newStages, champion: survivors[0] ?? null };
  }
  // Start next stage seeded with survivors.
  const next = startStage(newStages[state.currentStageIdx + 1], survivors, state.teams);
  newStages[state.currentStageIdx + 1] = next;
  return { ...state, stages: newStages, currentStageIdx: state.currentStageIdx + 1 };
};

// ── Persistence ───────────────────────────────────────────────────────────
export const saveTournament = (state: TournamentState | null) => {
  try {
    if (state == null) localStorage.removeItem(TOURNAMENT_KEY);
    else localStorage.setItem(TOURNAMENT_KEY, JSON.stringify(state));
  } catch { /* best-effort */ }
};

export const loadTournament = (): TournamentState | null => {
  try {
    const raw = localStorage.getItem(TOURNAMENT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Reject old-shape snapshots so users don't get a stale Copa loaded with
    // the new model. They can start fresh.
    if (!Array.isArray(parsed?.stages)) return null;
    return parsed as TournamentState;
  } catch {
    return null;
  }
};

// ── Presets (UI shortcut) ─────────────────────────────────────────────────
export const presetCopa = (teamCount: number): StageDraft[] => {
  // Single-elimination chain: log2(teamCount) ko stages, all 1-leg.
  const drafts: StageDraft[] = [];
  let n = teamCount;
  while (n > 1) {
    drafts.push({ kind: 'ko', legs: 1 });
    n /= 2;
  }
  return drafts;
};

export const presetMundial = (teamCount: number): StageDraft[] => {
  // Groups of 4, top 2 advance, then knockout to the final.
  if (teamCount % 4 !== 0) return presetCopa(teamCount);
  const drafts: StageDraft[] = [{ kind: 'liga', groupSize: 4, advancePerGroup: 2 }];
  let survivors = (teamCount / 4) * 2;
  while (survivors > 1) {
    drafts.push({ kind: 'ko', legs: 1 });
    survivors /= 2;
  }
  return drafts;
};
