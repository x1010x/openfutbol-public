import type { Scenario } from '../types';
import { neutralInitialState, placePlayer, giveBallTo } from '../presets';
import { snap as stateSnap } from '../../engine/state';
import { startGKHold } from '../../engine/phases';

// Open-play scenarios run with phase='live' from tick 0. The carrier-action
// loop (decideCarrierAction → shoot/pass/dribble) fires once carryTicks
// reaches nextAction (8 by default for a fresh carry). Positions are nudged
// by hand; the slot spring will pull non-carriers back to formation over a
// second or two, which is realistic and informative.

export const oneVoneHome: Scenario = {
  id: '1v1-home',
  name: '1 contra 1 — local vs portero visitante',
  description: 'Delantero local solo ante el portero, justo en el borde del área. Los defensores visitantes han quedado lejos atrás; el portero local elige salir o achicar.',
  durationMs: 10_000,
  build: (seed) => {
    const state = neutralInitialState(seed);
    // Striker on the run, edge of the box, slightly off-centre.
    const strikerId = placePlayer(state, 'home', 9, { x: 0.82, y: 0.45 });
    // Away defenders pushed back behind the play (out of the chase).
    placePlayer(state, 'away', 1, { x: 0.55, y: 0.12 });
    placePlayer(state, 'away', 2, { x: 0.55, y: 0.37 });
    placePlayer(state, 'away', 3, { x: 0.55, y: 0.63 });
    placePlayer(state, 'away', 4, { x: 0.55, y: 0.88 });
    giveBallTo(state, strikerId);
    stateSnap(state, 0);
    return state;
  },
};

export const longShotHome: Scenario = {
  id: 'longshot-home',
  name: 'Tiro lejano — local',
  description: 'Mediocentro local con balón al borde del rango de tiro (~36m). Los rivales replegados; el sacador puede chutar de lejos o esperar.',
  durationMs: 10_000,
  build: (seed) => {
    const state = neutralInitialState(seed);
    // CM with the ball, just inside shooting range.
    const cmId = placePlayer(state, 'home', 7, { x: 0.62, y: 0.50 });
    // Strikers tightly marked so passing forward is risky.
    placePlayer(state, 'home', 9, { x: 0.78, y: 0.42 });
    placePlayer(state, 'home', 10, { x: 0.78, y: 0.58 });
    placePlayer(state, 'away', 2, { x: 0.79, y: 0.40 });
    placePlayer(state, 'away', 3, { x: 0.79, y: 0.60 });
    giveBallTo(state, cmId);
    stateSnap(state, 0);
    return state;
  },
};

export const counterAttackHome: Scenario = {
  id: 'counter-home',
  name: 'Contraataque — locales 3 contra 2',
  description: 'Robo en mediocampo: tres atacantes locales (delantero + media punta + winger) corren hacia el área visitante, con sólo 2 defensores + portero por delante. Los mediocampistas visitantes han quedado adelantados.',
  durationMs: 14_000,
  build: (seed) => {
    const state = neutralInitialState(seed);
    // Three home attackers breaking forward.
    const carrierId = placePlayer(state, 'home', 9, { x: 0.55, y: 0.42 });
    placePlayer(state, 'home', 10, { x: 0.55, y: 0.62 });
    placePlayer(state, 'home', 7, { x: 0.48, y: 0.50 });
    // Away mids out of position (caught upfield after their attack broke down).
    placePlayer(state, 'away', 5, { x: 0.42, y: 0.15 });
    placePlayer(state, 'away', 6, { x: 0.42, y: 0.40 });
    placePlayer(state, 'away', 7, { x: 0.42, y: 0.60 });
    placePlayer(state, 'away', 8, { x: 0.42, y: 0.85 });
    // Only two defenders covering centrally — wing-backs left in their slots.
    placePlayer(state, 'away', 2, { x: 0.78, y: 0.42 });
    placePlayer(state, 'away', 3, { x: 0.78, y: 0.58 });
    giveBallTo(state, carrierId);
    stateSnap(state, 0);
    return state;
  },
};

export const highPressOnGK: Scenario = {
  id: 'highpress-gk',
  name: 'Presión alta sobre portero local',
  description: 'Portero local con balón en la mano, dos delanteros visitantes presionando muy cerca. El portero decide entre despeje largo o pase a un defensor.',
  durationMs: 14_000,
  build: (seed) => {
    const state = neutralInitialState(seed);
    const gkId = state.homePlayers[0].id;
    // Two away strikers right on the GK.
    placePlayer(state, 'away', 9, { x: 0.10, y: 0.42 });
    placePlayer(state, 'away', 10, { x: 0.10, y: 0.58 });
    // Home defenders at their normal slots — pass options.
    startGKHold(state, gkId);
    state.ball = { x: state.pos[gkId].x, y: state.pos[gkId].y };
    stateSnap(state, 0);
    return state;
  },
};
