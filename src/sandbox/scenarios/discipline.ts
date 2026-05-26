import type { Scenario } from '../types';
import { neutralInitialState, placePlayer, giveBallTo, forceFoul } from '../presets';
import { snap as stateSnap } from '../../engine/state';

// Discipline scenarios bypass the engine's tackleProb / foulCommitted dice.
// Each scenario places the actors, pre-loads any discipline counters (yellow
// count, foulsCommitted for reiteration) and calls forceFoul at t=0 with the
// exact severity it wants to test. From that point the timeline plays out
// naturally: card emit → 5s hold → diagonal walk → north walkout → set piece
// (or, for yellow-only paths, straight to the free kick).
//
// Severities → cards (via decideCard in effectors.ts):
//   dogso     → red (direct)
//   reckless  → red (direct)
//   cynical   → yellow (or second_yellow if yellowCount=1 already, or
//               second_yellow if foulsCommitted>=3 already)
//   normal    → no card unless reiteration (foulsCommitted>=3) lifts it to
//               yellow / second_yellow
//
// Duration accounting for expulsion clips:
//   expulsion_hold     5s
//   expulsion_walk     6s
//   expulsion_walkout  3s
//   foul_setup         9s + foul_holding 5s + release/aftermath
// → 28–35s before kick. 45s clips cover the full sequence.

export const yellowReiteration: Scenario = {
  id: 'discipline-yellow-reiteration',
  name: 'Amarilla por reiteración (3ª falta)',
  description: 'Defensor visitante con 2 faltas previas; falta forzada de severity=normal — el árbol de decisión la sube a amarilla por reiteración. Espera ver "¡Falta!" + sprite tarjeta amarilla, seguido del set-piece normal.',
  durationMs: 22_000,
  build: (seed) => {
    const state = neutralInitialState(seed);
    const carrierId = placePlayer(state, 'home', 9, { x: 0.50, y: 0.50 });
    const tacklerId = placePlayer(state, 'away', 3, { x: 0.527, y: 0.50 });
    state.awayPlayers[3].foulsCommitted = 2;
    giveBallTo(state, carrierId);
    forceFoul(state, tacklerId, carrierId, 'normal');
    stateSnap(state, 0);
    return state;
  },
};

export const secondYellow: Scenario = {
  id: 'discipline-second-yellow',
  name: 'Doble amarilla por reiteración',
  description: 'Defensor ya amonestado (yellowCount=1) con 4 faltas previas; falta forzada de severity=normal — al incrementar foulsCommitted a 5 se cumple el umbral de reiteración post-amarilla (3+2 más). → 2ª amarilla → roja + walk-off.',
  durationMs: 45_000,
  build: (seed) => {
    const state = neutralInitialState(seed);
    const carrierId = placePlayer(state, 'home', 9, { x: 0.50, y: 0.50 });
    const tacklerId = placePlayer(state, 'away', 3, { x: 0.527, y: 0.50 });
    state.awayPlayers[3].yellowCount = 1;
    state.awayPlayers[3].foulsCommitted = 4;
    giveBallTo(state, carrierId);
    forceFoul(state, tacklerId, carrierId, 'normal');
    stateSnap(state, 0);
    return state;
  },
};

export const secondYellowCynical: Scenario = {
  id: 'discipline-second-yellow-cynical',
  name: 'Doble amarilla — cínica clara',
  description: 'Defensor amonestado (yellowCount=1) sin contador alto; falta forzada de severity=cynical — sortea la reiteración y va directa a 2ª amarilla → roja. Verifica que cynical sigue siendo vía rápida tras amarilla.',
  durationMs: 45_000,
  build: (seed) => {
    const state = neutralInitialState(seed);
    const carrierId = placePlayer(state, 'home', 9, { x: 0.50, y: 0.50 });
    const tacklerId = placePlayer(state, 'away', 3, { x: 0.527, y: 0.50 });
    state.awayPlayers[3].yellowCount = 1;
    giveBallTo(state, carrierId);
    forceFoul(state, tacklerId, carrierId, 'cynical');
    stateSnap(state, 0);
    return state;
  },
};

export const dogsoRed: Scenario = {
  id: 'discipline-dogso-red',
  name: 'DOGSO → roja directa',
  description: 'Delantero local en 1v1 contra el portero; falta forzada de severity=dogso → roja directa + walk-off. Posición y orientación pensadas para que cuando se ejecute la falta como penalti (el spot está dentro del área visitante) se vea el lanzamiento.',
  durationMs: 45_000,
  build: (seed) => {
    const state = neutralInitialState(seed);
    const carrierId = placePlayer(state, 'home', 9, { x: 0.88, y: 0.50 });
    const tacklerId = placePlayer(state, 'away', 3, { x: 0.86, y: 0.50 });
    giveBallTo(state, carrierId);
    forceFoul(state, tacklerId, carrierId, 'dogso');
    stateSnap(state, 0);
    return state;
  },
};

export const aggressionRed: Scenario = {
  id: 'discipline-aggression-red',
  name: 'Tackle reckless → roja directa',
  description: 'Falta forzada de severity=reckless en mediocampo. La secuencia walk-off es el patrón de referencia: foul + sprite rojo → 5s hold → diagonal a (0.5, 0) → walkout vertical → set-piece con 10 jugadores.',
  durationMs: 45_000,
  build: (seed) => {
    const state = neutralInitialState(seed);
    const carrierId = placePlayer(state, 'home', 9, { x: 0.55, y: 0.50 });
    const tacklerId = placePlayer(state, 'away', 3, { x: 0.525, y: 0.50 });
    giveBallTo(state, carrierId);
    forceFoul(state, tacklerId, carrierId, 'reckless');
    stateSnap(state, 0);
    return state;
  },
};

export const injuryHardFoul: Scenario = {
  id: 'discipline-injury-hard-foul',
  name: 'Lesión por entrada dura',
  description: 'Falta reckless + lesión forzada (bypassea el roll de lesión). Tras la falta y durante el setup del lanzamiento, el carrier camina a 0.35× del resto. 60s para tener tiempo a comparar visualmente.',
  durationMs: 60_000,
  build: (seed) => {
    const state = neutralInitialState(seed);
    const carrierId = placePlayer(state, 'home', 9, { x: 0.55, y: 0.50 });
    const tacklerId = placePlayer(state, 'away', 3, { x: 0.525, y: 0.50 });
    giveBallTo(state, carrierId);
    forceFoul(state, tacklerId, carrierId, 'reckless', { forceInjury: true });
    stateSnap(state, 0);
    return state;
  },
};

export const walkoffTopRight: Scenario = {
  id: 'discipline-walkoff-top-right',
  name: 'Walk-off — desde banda derecha-superior',
  description: 'Aggression colocada arriba a la derecha. Inspecciona el walk diagonal NW hacia (0.5, 0) y luego el walkout vertical sin atravesar la valla publicitaria.',
  durationMs: 45_000,
  build: (seed) => {
    const state = neutralInitialState(seed);
    const carrierId = placePlayer(state, 'home', 9, { x: 0.75, y: 0.25 });
    const tacklerId = placePlayer(state, 'away', 3, { x: 0.725, y: 0.25 });
    giveBallTo(state, carrierId);
    forceFoul(state, tacklerId, carrierId, 'reckless');
    stateSnap(state, 0);
    return state;
  },
};

export const walkoffTopLeft: Scenario = {
  id: 'discipline-walkoff-top-left',
  name: 'Walk-off — desde banda izquierda-superior',
  description: 'Espejo del top_right en la mitad izquierda. Walker debería ir diagonal NE hacia (0.5, 0) y luego norte.',
  durationMs: 45_000,
  build: (seed) => {
    const state = neutralInitialState(seed);
    const carrierId = placePlayer(state, 'away', 9, { x: 0.25, y: 0.25 });
    const tacklerId = placePlayer(state, 'home', 3, { x: 0.275, y: 0.25 });
    giveBallTo(state, carrierId);
    forceFoul(state, tacklerId, carrierId, 'reckless');
    stateSnap(state, 0);
    return state;
  },
};

export const offBallAggression: Scenario = {
  id: 'discipline-offball-aggression',
  name: 'Agresión off-ball (víctima sin balón)',
  description: 'Carrier local con balón en una posición; defensor visitante junto a un segundo home (slot 8) que NO lleva el balón. La falta forzada se aplica entre el defensor y el segundo home (no el carrier). Verifica que: (1) la víctima del walk-off es el slot 8, (2) el balón se queda en el slot 9 hasta que startFoul lo mueva al spot tras el walkout.',
  durationMs: 45_000,
  build: (seed) => {
    const state = neutralInitialState(seed);
    const carrierId = placePlayer(state, 'home', 9, { x: 0.55, y: 0.50 });
    const offBallVictimId = placePlayer(state, 'home', 8, { x: 0.30, y: 0.30 });
    const tacklerId = placePlayer(state, 'away', 3, { x: 0.275, y: 0.30 });
    giveBallTo(state, carrierId);
    forceFoul(state, tacklerId, offBallVictimId, 'reckless');
    stateSnap(state, 0);
    return state;
  },
};
