import type { Scenario } from '../types';
import { neutralInitialState, placePlayer, giveBallTo } from '../presets';
import { snap as stateSnap } from '../../engine/state';

// `checkTackle` (effectors.ts) fires for each opposing outfielder within
// TACKLE_DIST = 0.035 of the ball every live tick. Probability is driven by
// defender (defending*0.65 + physical*0.35) vs carrier (dribbling*0.60 +
// speed*0.40). On success, foulCommitted() decides clean tackle vs foul.
// Scenarios position one or more defenders within range so the duel fires
// immediately instead of waiting for chase mechanics.

export const tackleFromFront: Scenario = {
  id: 'tackle-front',
  name: 'Tackle — defensa de frente',
  description: 'Carrier local con balón en mediocampo; defensor visitante de frente dentro de TACKLE_DIST. Alto chance de robo limpio o falta.',
  durationMs: 6_000,
  build: (seed) => {
    const state = neutralInitialState(seed);
    const carrierId = placePlayer(state, 'home', 9, { x: 0.50, y: 0.50 });
    placePlayer(state, 'away', 3, { x: 0.527, y: 0.50 });
    giveBallTo(state, carrierId);
    stateSnap(state, 0);
    return state;
  },
};

export const tackleFromBehind: Scenario = {
  id: 'tackle-behind',
  name: 'Tackle — defensa por detrás',
  description: 'Carrier local con balón, defensor visitante persigue por detrás dentro del rango. Patrón típico de falta táctica.',
  durationMs: 7_000,
  build: (seed) => {
    const state = neutralInitialState(seed);
    const carrierId = placePlayer(state, 'home', 9, { x: 0.55, y: 0.50 });
    placePlayer(state, 'away', 3, { x: 0.522, y: 0.50 });
    giveBallTo(state, carrierId);
    stateSnap(state, 0);
    return state;
  },
};

export const tackleLateral: Scenario = {
  id: 'tackle-lateral',
  name: 'Tackle — defensa por el costado',
  description: 'Defensor visitante cruza desde el costado al carrier local en banda. Ángulo intermedio entre frente y persecución.',
  durationMs: 6_000,
  build: (seed) => {
    const state = neutralInitialState(seed);
    const carrierId = placePlayer(state, 'home', 9, { x: 0.55, y: 0.30 });
    placePlayer(state, 'away', 3, { x: 0.55, y: 0.275 });
    giveBallTo(state, carrierId);
    stateSnap(state, 0);
    return state;
  },
};

export const looseBallMidfield: Scenario = {
  id: 'loose-ball-midfield',
  name: '50/50 — balón suelto en mediocampo',
  description: 'Balón sin dueño en el centro, dos mediocampistas a igual distancia. Test del pickup en simulateBallTick + decide/offBall (chase loose-ball).',
  durationMs: 7_000,
  build: (seed) => {
    const state = neutralInitialState(seed);
    state.ballOwner = null;
    state.ball = { x: 0.50, y: 0.50 };
    state.ballVel = { x: 0, y: 0 };
    state.ballHeight = 0;
    state.ballHeightVel = 0;
    state.intendedReceiver = null;
    placePlayer(state, 'home', 7, { x: 0.45, y: 0.48 });
    placePlayer(state, 'away', 7, { x: 0.55, y: 0.52 });
    stateSnap(state, 0);
    return state;
  },
};

export const looseBallRolling: Scenario = {
  id: 'loose-ball-rolling',
  name: 'Balón en movimiento — disputa en carrera',
  description: 'Balón rodando lentamente hacia el área visitante, ambos delanteros corren a tomarlo. Test de pickup con ball en movimiento.',
  durationMs: 8_000,
  build: (seed) => {
    const state = neutralInitialState(seed);
    state.ballOwner = null;
    state.ball = { x: 0.55, y: 0.50 };
    state.ballVel = { x: 0.020, y: 0 };
    state.ballHeight = 0;
    state.ballHeightVel = 0;
    state.intendedReceiver = null;
    placePlayer(state, 'home', 9, { x: 0.48, y: 0.46 });
    placePlayer(state, 'away', 3, { x: 0.62, y: 0.54 });
    stateSnap(state, 0);
    return state;
  },
};

export const surroundedByDefenders: Scenario = {
  id: 'surrounded',
  name: 'Carrier rodeado — 3 defensores',
  description: 'Delantero local con balón al borde del área, tres defensores visitantes dentro de rango. Múltiples rolls de checkTackle por tick.',
  durationMs: 6_000,
  build: (seed) => {
    const state = neutralInitialState(seed);
    const carrierId = placePlayer(state, 'home', 9, { x: 0.80, y: 0.50 });
    placePlayer(state, 'away', 2, { x: 0.825, y: 0.48 });
    placePlayer(state, 'away', 3, { x: 0.81, y: 0.525 });
    placePlayer(state, 'away', 4, { x: 0.78, y: 0.475 });
    giveBallTo(state, carrierId);
    stateSnap(state, 0);
    return state;
  },
};
