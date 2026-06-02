// AI substitutions for engine-controlled sides (the opponent). Each tick we may
// QUEUE a change for any side that has a bench (state.aiSub) and subs to spare:
//   * Injury  — an on-pitch player flagged injured is replaced as soon as
//               possible; the queue fires it at the next ball stoppage, no
//               time/spacing gate (matches "sustituido en la siguiente parada").
//   * Fatigue — past the hour, the most tired outfielder is swapped for a
//               fresher, role-suitable bench player.
//   * Tactical— a side chasing the game (two+ goals down, late on) leans toward
//               trading a defender for a fresh attacker.
// Changes go through the same pendingSubs queue + sub_walkout choreography as
// the user's, so they execute at the next stoppage and batch with any other
// change pending at that moment (one walk-off for the lot).
//
// Deterministic: no RNG is consumed here, so the Bloque 8 re-simulation (the
// user pausing to make a change) reproduces every AI decision before the pause
// exactly. Only generateTimeline enables it (opts.aiSubs); the sandbox path
// leaves the benches empty so its scenarios are untouched.

import type { TeamSide } from '../types/match';
import type { EnginePlayer } from './zoneEngine';
import type { SlotRole } from './zones';
import type { MatchState } from './types';
import { queueSubstitution } from './phases/subWalkout';

export const MAX_AI_SUBS = 3;
const VOLUNTARY_FROM_FRAC = 0.58; // ~52' before any non-forced change
const SPACING_FRAC = 0.06;        // ~5-6 match-minutes between voluntary changes
const TIRED_THRESHOLD = 0.07;     // min fractional speed drop worth subbing for

function alreadyPending(state: MatchState, outId: string): boolean {
  return state.pendingSubs.some(j => j.outId === outId)
      || state.subBatch.some(j => j.outId === outId);
}

// Fit of a bench player for a target slot role — the engine-stat analogue of the
// manager's position-weighted media. Higher = better suited.
function roleFit(p: EnginePlayer, role: SlotRole): number {
  if (role === 'gk')  return p.goalkeeping;
  if (role === 'def') return p.defending * 0.5 + p.physical * 0.3 + p.speed * 0.2;
  if (role === 'fwd') return p.shooting * 0.4 + p.speed * 0.3 + p.dribbling * 0.3;
  return p.passing * 0.4 + p.dribbling * 0.25 + p.defending * 0.2 + p.physical * 0.15; // mid
}

// Best bench candidate for a role: prefer a natural match, else any outfielder
// (never field an outfielder in goal unless that's all that's left), then by fit.
function pickReplacement(bench: EnginePlayer[], role: SlotRole): EnginePlayer | null {
  if (bench.length === 0) return null;
  const sameRole = bench.filter(b => b.role === role);
  const outfield = bench.filter(b => b.role !== 'gk');
  const pool = sameRole.length > 0 ? sameRole : (outfield.length > 0 ? outfield : bench);
  return pool.reduce((best, p) => roleFit(p, role) > roleFit(best, role) ? p : best);
}

function queueAiSub(state: MatchState, side: TeamSide, out: EnginePlayer, incoming: EnginePlayer, tick: number, log: string): void {
  const ai = state.aiSub[side];
  ai.bench = ai.bench.filter(b => b.id !== incoming.id);
  ai.subsUsed++;
  ai.lastSubTick = tick;
  queueSubstitution(state, out.id, incoming, log);
}

export function decideAiSubs(state: MatchState, tick: number, totalTicks: number): void {
  for (const side of ['home', 'away'] as TeamSide[]) {
    const ai = state.aiSub[side];
    if (ai.bench.length === 0 || ai.subsUsed >= MAX_AI_SUBS) continue;

    const onPitch = (side === 'home' ? state.homePlayers : state.awayPlayers)
      .filter(p => !state.expelledIds.has(p.id));

    // 1) Injury — forced, replace at the next stoppage regardless of timing.
    const injured = onPitch.find(p => state.injuredIds.has(p.id) && !alreadyPending(state, p.id));
    if (injured) {
      const repl = pickReplacement(ai.bench, injured.role);
      if (repl) {
        queueAiSub(state, side, injured, repl, tick, 'Cambio por lesión');
        continue; // one change per side per tick keeps the walk-off readable
      }
    }

    // 2) Voluntary (fatigue / tactical) — only past the hour, spaced out.
    if (tick < totalTicks * VOLUNTARY_FROM_FRAC) continue;
    if (tick - ai.lastSubTick < totalTicks * SPACING_FRAC) continue;

    const myScore  = side === 'home' ? state.score.home : state.score.away;
    const oppScore = side === 'home' ? state.score.away : state.score.home;
    const chasing = oppScore - myScore >= 2 && tick > totalTicks * 0.66;

    // Most tired outfielder (largest speed drop vs their fresh base). When
    // chasing, weight defenders as more expendable so we free up an attacker.
    let worst: EnginePlayer | null = null;
    let worstScore = TIRED_THRESHOLD;
    for (const p of onPitch) {
      if (p.role === 'gk' || alreadyPending(state, p.id)) continue;
      const base = p.baseSpeed ?? p.speed;
      const tired = base > 0 ? (base - p.speed) / base : 0;
      const weighted = tired + (chasing && p.role === 'def' ? 0.06 : 0);
      if (weighted > worstScore) { worstScore = weighted; worst = p; }
    }
    if (!worst) continue;

    const targetRole: SlotRole = (chasing && worst.role === 'def') ? 'fwd' : worst.role;
    const repl = pickReplacement(ai.bench, targetRole);
    // Only swap for genuinely fresher legs (bench player's fresh speed beats the
    // tired starter's current speed); otherwise it's a pointless downgrade.
    if (!repl || (repl.baseSpeed ?? repl.speed) <= worst.speed) continue;
    queueAiSub(state, side, worst, repl, tick, chasing ? 'Cambio ofensivo' : 'Cambio por cansancio');
  }
}
