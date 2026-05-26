import type { Scenario } from '../types';
import { neutralInitialState } from '../presets';
import { startFoul } from '../../engine/phases';
import { snap as stateSnap } from '../../engine/state';

// `startFoul` auto-detects 'penalty' when the spot is inside the box; the
// exact x/y doesn't matter beyond that, since the ball is moved to the
// canonical penalty mark.
const HOME_PEN_SPOT = { x: 0.90, y: 0.50 };
const AWAY_PEN_SPOT = { x: 0.10, y: 0.50 };

export const penaltyHome: Scenario = {
  id: 'penalty-home',
  name: 'Penalti — locales lanzan',
  description: 'Penalti a favor del equipo local. El delantero local se coloca para chutar; el portero visitante en su línea.',
  durationMs: 18_000,
  build: (seed) => {
    const state = neutralInitialState(seed);
    startFoul(state, HOME_PEN_SPOT, 'home');
    stateSnap(state, 0);
    return state;
  },
};

export const penaltyAway: Scenario = {
  id: 'penalty-away',
  name: 'Penalti — visitantes lanzan',
  description: 'Penalti a favor del equipo visitante. El delantero visitante se coloca para chutar; el portero local en su línea.',
  durationMs: 18_000,
  build: (seed) => {
    const state = neutralInitialState(seed);
    startFoul(state, AWAY_PEN_SPOT, 'away');
    stateSnap(state, 0);
    return state;
  },
};
