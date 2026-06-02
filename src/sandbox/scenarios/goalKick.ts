import type { Scenario } from '../types';
import { neutralInitialState } from '../presets';
import { startGoalKick } from '../../engine/phases';
import { snap as stateSnap } from '../../engine/state';

export const goalKickHome: Scenario = {
  id: 'goalkick-home',
  name: 'Saque de puerta — locales',
  description: 'Saque de puerta local desde el ángulo del área pequeña. El defensor central (slot 3) asume el saque y busca un receptor.',
  durationMs: 16_000,
  build: (seed) => {
    const state = neutralInitialState(seed);
    const cbId = state.homePlayers[3].id;
    startGoalKick(state, { x: 0.04, y: 0.40 }, cbId);
    stateSnap(state, 0);
    return state;
  },
};

export const goalKickAway: Scenario = {
  id: 'goalkick-away',
  name: 'Saque de puerta — visitantes',
  description: 'Saque de puerta visitante desde el ángulo del área pequeña.',
  durationMs: 16_000,
  build: (seed) => {
    const state = neutralInitialState(seed);
    const cbId = state.awayPlayers[3].id;
    startGoalKick(state, { x: 0.96, y: 0.60 }, cbId);
    stateSnap(state, 0);
    return state;
  },
};
