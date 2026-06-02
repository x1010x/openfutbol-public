import type { Scenario } from '../types';
import { neutralInitialState } from '../presets';
import { startCorner } from '../../engine/phases';
import { snap as stateSnap } from '../../engine/state';

export const cornerHomeTop: Scenario = {
  id: 'corner-home-top',
  name: 'Córner — locales (ángulo superior)',
  description: 'Córner a favor de los locales por el ángulo superior derecho. El sacador se elige por proximidad; los atacantes invaden el área, los defensores se repliegan.',
  durationMs: 18_000,
  build: (seed) => {
    const state = neutralInitialState(seed);
    startCorner(state, { x: 0.99, y: 0.01 }, 'home');
    stateSnap(state, 0);
    return state;
  },
};

export const cornerHomeBottom: Scenario = {
  id: 'corner-home-bottom',
  name: 'Córner — locales (ángulo inferior)',
  description: 'Córner local por el ángulo inferior derecho.',
  durationMs: 18_000,
  build: (seed) => {
    const state = neutralInitialState(seed);
    startCorner(state, { x: 0.99, y: 0.99 }, 'home');
    stateSnap(state, 0);
    return state;
  },
};

export const cornerAwayTop: Scenario = {
  id: 'corner-away-top',
  name: 'Córner — visitantes (ángulo superior)',
  description: 'Córner a favor de los visitantes por el ángulo superior izquierdo.',
  durationMs: 18_000,
  build: (seed) => {
    const state = neutralInitialState(seed);
    startCorner(state, { x: 0.01, y: 0.01 }, 'away');
    stateSnap(state, 0);
    return state;
  },
};
